import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { grnApi } from "../api/grnApi";
import type { GrnDraftLine, CreateGrnDraftRequest } from "../types/grn";
import {SelectDropdown, type SelectOption} from "../../../../components/controls/SelectDropdown";
import { inventoryItemsApi } from "../../../inventoryMaster/items/api/inventoryItemsApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";

type Props = { mode: "new" | "edit" };

type LineErrors = {
  item?: string;
  uom?: string;
  qty?: string;
  cost?: string;
};

export default function GrnDraftEditorPage({ mode }: Props) {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();
  const { draftId } = useParams<{ draftId: string }>();

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");
  const [error, setError] = useState<string | null>(null);

  // header fields
  const [locationId, setLocationId] = useState<string | null>(null);
  const [receivedAt, setReceivedAt] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [supplierName, setSupplierName] = useState<string | null|undefined>(null);
  const [reference, setReference] = useState<string>("");

  // lines
  const [lines, setLines] = useState<GrnDraftLine[]>(() => [
    { tempId: crypto.randomUUID(), inventoryItemId: null, unitId: null, quantity: 1, unitCost: 0 },
  ]);

  // dropdown options
  const [warehouseOptions, setWarehouseOptions] = useState<SelectOption<string>[]>([]);
  const [itemOptions, setItemOptions] = useState<SelectOption<string>[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  // per-item uoms cache: itemId -> options
  const [uomMap, setUomMap] = useState<Record<string, SelectOption<string>[]>>({});
  const [uomLoadingMap, setUomLoadingMap] = useState<Record<string, boolean>>({});

  // load warehouses + items
  useEffect(() => {
    if (!companyId) return;

    setWarehousesLoading(true);
    stockLocationsApi
      .list(companyId, branchId) // adjust to your API signature
      .then((rows: any[]) =>
        setWarehouseOptions(rows.map((x) => ({ value: x.id, label: `${x.code} — ${x.name}` })))
      )
      .catch(() => setWarehouseOptions([]))
      .finally(() => setWarehousesLoading(false));

    setItemsLoading(true);
    inventoryItemsApi
      .list(companyId, { page: 1, pageSize: 500 } as any)
      .then((rows: any[]) => setItemOptions(rows.map((x) => ({ value: x.id, label: `${x.name}` }))))
      .catch(() => setItemOptions([]))
      .finally(() => setItemsLoading(false));
  }, [companyId]);

  // load draft when edit
  useEffect(() => {
    if (mode !== "edit") return;
    if (!companyId || !draftId) return;

    setLoading(true);
    setError(null);

    grnApi
      .getById(companyId, draftId)
      .then((d) => {
        setLocationId(d.warehouseId?? null);
        setReceivedAt(new Date(d.receivedDate).toISOString().slice(0, 16));
        setSupplierName(d.supplierName);
        setReference(d.notes ?? "");

        setLines(
          (d.lines ?? []).map((l) => ({
            tempId: crypto.randomUUID(),
            inventoryItemId: l.itemId,
            unitId: l.uomId,
            quantity: l.quantity,
            unitCost: l.unitCost,
            batchNo: l.batchNo ?? null,
            expiryDateUtc: l.expiryDate ?? null,
          }))
        );
      })
      .catch((e) => setError(e?.response?.data?.message ?? e?.message ?? "Failed to load draft"))
      .finally(() => setLoading(false));
  }, [mode, companyId, draftId]);

  async function ensureUomsLoaded(itemId: string) {
    if (!companyId) return;
    if (uomMap[itemId]?.length) return;
    if (uomLoadingMap[itemId]) return;

    setUomLoadingMap((m) => ({ ...m, [itemId]: true }));
    try {
      const rows = await inventoryItemsApi.getUoms(companyId, { itemId } as any);
      const opts = rows
        //.filter((x) => x.isBase !== false)
        .map((x) => ({ value: x.id, label: `${x.name}` }));
      setUomMap((m) => ({ ...m, [itemId]: opts }));
    } finally {
      setUomLoadingMap((m) => ({ ...m, [itemId]: false }));
    }
  }

  const headerValid = useMemo(() => {
    if (!locationId) return false;
    if (!supplierName?.trim()) return false;
    return true;
  }, [locationId, supplierName]);

  function validateLines(): Record<string, LineErrors> {
    const map: Record<string, LineErrors> = {};
    for (const l of lines) {
      const e: LineErrors = {};
      if (!l.inventoryItemId) e.item = "Item is required";
      if (!l.unitId) e.uom = "UOM is required";
      if (!l.quantity || l.quantity <= 0) e.qty = "Quantity must be > 0";
      if (l.unitCost < 0) e.cost = "Unit cost cannot be negative";
      if (Object.keys(e).length) map[l.tempId] = e;
    }
    return map;
  }

  function updateLine(tempId: string, patch: Partial<GrnDraftLine>) {
    setLines((prev) => prev.map((x) => (x.tempId === tempId ? { ...x, ...patch } : x)));
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), inventoryItemId: null, unitId: null, quantity: 1, unitCost: 0 },
    ]);
  }

  function removeLine(tempId: string) {
    setLines((prev) => prev.filter((x) => x.tempId !== tempId));
  }

  async function onSaveDraft() {
    if (!companyId) return;
    setError(null);

    const lineErrors = validateLines();
    if (!headerValid || Object.keys(lineErrors).length > 0) {
      setError("Please complete required fields (header + lines).");
      return;
    }

    const body: CreateGrnDraftRequest = {
      locationId,
      receivedDate: new Date(receivedAt).toISOString(),
      supplierName: supplierName?.trim() ?? null,
      reference: reference?.trim() ? reference.trim() : null,
      notes: null,
      lines: lines.map((l) => ({
        inventoryItemId: l.inventoryItemId!,
        unitId: l.unitId!,
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost),
        batchNo: l.batchNo ?? null,
        expiryDateUtc: l.expiryDateUtc ?? null,
        notes: l.notes ?? null,
      })),
    };

    setBusy(true);
    try {
      if (mode === "new") {
        const created = await grnApi.createDraft(companyId, body);
        nav(`/companies/${companyId}/grns/drafts/${created.id}`, { replace: true });
      } else {
        if (!draftId) throw new Error("Draftv is Id missing");
        await grnApi.updateDraft(companyId, draftId, body);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to save draft");
    } finally {
      setBusy(false);
    }
  }

  async function onPostDraft() {
    if (!companyId || !draftId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await grnApi.postDraft(companyId, draftId);
      nav(`/companies/${companyId}/grns/${res.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to post draft");
    } finally {
      setBusy(false);
    }
  }

  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;
  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  const lineErrors = validateLines();

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>{mode === "new" ? "New GRN Draft" : "Edit GRN Draft"}</h2>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onSaveDraft} disabled={busy}>
            Save Draft
          </button>

          {mode === "edit" && (
            <button type="button" onClick={onPostDraft} disabled={busy}>
              Post Draft
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ marginTop: 10, color: "crimson" }}>{error}</div>}

      {/* Header */}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SelectDropdown<string>
          label="Warehouse"
          value={locationId}
          options={warehouseOptions}
          loading={warehousesLoading}
          placeholder="Select warehouse…"
          onChange={(v) => setLocationId(v)}
        />

        <div>
          <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Received At</div>
          <input
            type="datetime-local"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Supplier</div>
          <input
            value={supplierName ?? ""}
            onChange={(e) => setSupplierName(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Reference</div>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>
      </div>

      {/* Lines */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Lines</h3>
          <button type="button" onClick={addLine}>
            + Add Line
          </button>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
          {lines.map((l, idx) => {
            const itemId = l.inventoryItemId;
            const uomOptions = itemId ? uomMap[itemId] ?? [] : [];
            const uomLoading = itemId ? !!uomLoadingMap[itemId] : false;
            const e = lineErrors[l.tempId] ?? {};

            return (
              <div key={l.tempId} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>Line {idx + 1}</div>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(l.tempId)}>
                      Remove
                    </button>
                  )}
                </div>

                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <SelectDropdown<string>
                      label="Item"
                      value={l.inventoryItemId}
                      options={itemOptions}
                      loading={itemsLoading}
                      placeholder="Select item…"
                      onChange={async (v) => {
                        updateLine(l.tempId, { inventoryItemId: v, unitId: null });
                        if (v) await ensureUomsLoaded(v);
                      }}
                    />
                    {e.item && <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>{e.item}</div>}
                  </div>

                  <div>
                    <SelectDropdown<string>
                      label="Unit (UOM)"
                      value={l.unitId}
                      options={uomOptions}
                      loading={uomLoading}
                      disabled={!l.inventoryItemId}
                      placeholder={l.inventoryItemId ? "Select UOM…" : "Select item first"}
                      onChange={(v) => updateLine(l.tempId, { unitId: v })}
                    />
                    {e.uom && <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>{e.uom}</div>}
                  </div>

                  <div>
                    <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Qty</div>
                    <input
                      type="number"
                      value={l.quantity}
                      min={0}
                      onChange={(e) => updateLine(l.tempId, { quantity: Number(e.target.value) })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                    />
                    {e.qty && <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>{e.qty}</div>}
                  </div>

                  <div>
                    <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Unit Cost</div>
                    <input
                      type="number"
                      value={l.unitCost}
                      min={0}
                      onChange={(e) => updateLine(l.tempId, { unitCost: Number(e.target.value) })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                    />
                    {e.cost && <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>{e.cost}</div>}
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Batch No</div>
                    <input
                      value={l.batchNo ?? ""}
                      onChange={(e) => updateLine(l.tempId, { batchNo: e.target.value || null })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Expiry (UTC ISO)</div>
                    <input
                     type="datetime-local"
                      value={l.expiryDateUtc ?? ""}
                      onChange={(e) => updateLine(l.tempId, { expiryDateUtc: e.target.value || null })}
                      placeholder="2026-01-09T00:00:00Z"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Notes</div>
                    <input
                      value={l.notes ?? ""}
                      onChange={(e) => updateLine(l.tempId, { notes: e.target.value || null })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 16, opacity: 0.7, fontSize: 12 }}>
        Tip: UOM dropdown is loaded per selected item using <code>/inventory-items/&lt;itemId&gt;/uoms</code>.
      </div>
    </div>
  );
}
