import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { usePageMeta } from "../../../../hooks/usePageMeta";

import { stockTransfersApi } from "../api/stockTransfersApi";
import { inventoryItemsApi } from "../../../inventoryMaster/items/api/inventoryItemsApi";
import { lookupsApi } from "../../../inventoryMaster/lookups/api/lookupsApi";
//import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import {locationsApi} from "../../stock-transfers/api/locationsApi"

import  {type StockTransferDetailDto, StockTransferStatus } from "../types";
import type { UomDto, InventoryItemDto } from "../../../inventoryMaster/items/types";
import type { SelectOption } from "../../../../components/controls/SelectDropdown";
import { SelectDropdown } from "../../../../components/controls/SelectDropdown";

import { DocHeader, StatusPill, KpiRow, Kpi } from "../../../../shared/ui/DocUI";

/* ---------------- Status rules ---------------- */

const statusTone: Record<StockTransferStatus, string> = {
  [StockTransferStatus.Draft]: "bg-slate-100 text-slate-700",
  [StockTransferStatus.Submitted]: "bg-amber-100 text-amber-800",
  [StockTransferStatus.Approved]: "bg-blue-100 text-blue-800",
  [StockTransferStatus.Rejected]: "bg-rose-100 text-rose-800",
  [StockTransferStatus.Posted]: "bg-emerald-100 text-emerald-800",
  [StockTransferStatus.Reversed]: "bg-purple-100 text-purple-800",
};

const canEdit = (s: StockTransferStatus) =>
  s === StockTransferStatus.Draft ||
  s === StockTransferStatus.Rejected;

//const canEdit = (s: StockTransferStatus) => s === "Draft" || s === "Rejected";
const canSubmit = (s: StockTransferStatus) => s === StockTransferStatus.Draft || s === StockTransferStatus.Rejected;
const canCancel = (s: StockTransferStatus) => s === StockTransferStatus.Submitted || s === StockTransferStatus.Approved;
const canPost = (s: StockTransferStatus) => s === StockTransferStatus.Approved;

/* ---------------- Helpers ---------------- */

function toDateInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// Send a DateOnly (yyyy-mm-dd) as UTC ISO at midnight


function qtyOk(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

/* ---------------- Form types ---------------- */

type FormLine = {
  tempId: string;
  itemId: string | null;
  uomId: string | null;
  qty: string;
  note?: string | null;
};

type FormState = {
  transferDate: string; // yyyy-mm-dd
  reference: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  lines: FormLine[];
};

const newTempId = () => crypto.randomUUID();

/* ================================================================= */

export default function StockTransferEditPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [detail, setDetail] = useState<StockTransferDetailDto | null>(null);
  const [form, setForm] = useState<FormState>({
    transferDate: "",
    reference: "",
    fromLocationId: null,
    toLocationId: null,
    lines: [],
  });

  // catalogs
  const [stockLocations, setStockLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [uoms, setUoms] = useState<UomDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<null | "submit" | "cancel" | "post">(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  usePageMeta({
    title: "Stock Transfer",
    subtitle: "Edit transfer and manage workflow",
  });

  /* ---------------- Load catalogs ---------------- */

  const loadCatalogs = useCallback(async () => {
    if (!companyId) return;

    try {
      const [locs, invItems, units] = await Promise.all([
        locationsApi.list(companyId,branchId),
        inventoryItemsApi.list(companyId),
        lookupsApi.uoms(companyId),
      ]);

      setStockLocations(locs ?? []);
      setItems(invItems ?? []);
      setUoms(units.data ?? []);
    } catch (e: any) {
      // keep page usable, but show message
      setError(e?.message ?? "Failed to load catalogs (locations/items/uoms).");
    }
  }, [companyId]);

  /* ---------------- Load transfer ---------------- */

  const load = useCallback(async () => {
    if (!companyId || !id) return;

    setLoading(true);
    setError(null);

    try {
      // load catalogs and detail in parallel
      const [_, d] = await Promise.all([loadCatalogs(), stockTransfersApi.get(companyId, id)]);
      setDetail(d);

      setForm({
        transferDate: toDateInput((d as any).transferDateUtc),
        reference: (d as any).reference ?? "",
        fromLocationId: (d as any).fromLocationId ?? null,
        toLocationId: (d as any).toLocationId ?? null,
        lines: ((d as any).items ?? []).map((x: any) => ({
          tempId: newTempId(),
          itemId: x.itemId ?? null,
          uomId: x.uomId ?? null,
          qty: String(x.quantity ?? 0),
          note: x.note ?? null,
        })),
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load stock transfer.");
    } finally {
      setLoading(false);
    }
  }, [companyId, id, loadCatalogs]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------- Derived ---------------- */

  const status: StockTransferStatus = (detail as any)?.status ?? "Draft";
  const editable = detail ? canEdit(status) : false;

  const locationOptions: SelectOption<string>[] = useMemo(
    () => stockLocations.map((x) => ({ value: x.id, label: x.name })),
    [stockLocations]
  );
const itemOptions = useMemo(
  () => items.map((x) => ({ value: x.id, label: x.name })), // adjust label field if needed
  [items]
);

  
  const uomOptions = useMemo(
  () => uoms.map((x) => ({ value: x.id, label: x.name })), // adjust label field if needed
  [items]
);

  const totals = useMemo(() => {
    return {
      lines: form.lines.length,
      qty: form.lines.reduce((a, b) => a + (Number(b.qty) || 0), 0),
    };
  }, [form.lines]);

  const validation = useMemo(() => {
    const issues: string[] = [];

    if (!form.fromLocationId) issues.push("From location is required.");
    if (!form.toLocationId) issues.push("To location is required.");
    if (form.fromLocationId && form.toLocationId && form.fromLocationId === form.toLocationId)
      issues.push("From and To locations must be different.");
    if (!form.transferDate) issues.push("Transfer date is required.");
    if (!form.lines.length) issues.push("At least one line is required.");

    form.lines.forEach((l, i) => {
      if (!l.itemId) issues.push(`Line ${i + 1}: item is required.`);
      if (!l.uomId) issues.push(`Line ${i + 1}: UOM is required.`);
      if (!qtyOk(l.qty)) issues.push(`Line ${i + 1}: quantity must be > 0.`);
    });

    return { ok: issues.length === 0, issues };
  }, [form]);
const locationCodeById = useMemo(() => {
  const m = new Map<string, string>();
  stockLocations.forEach((x: any) => m.set(x.id, x.code)); // stock location must have "code"
  return m;
}, [stockLocations]);

  /* ---------------- Line helpers ---------------- */

  function updateHeader(patch: Partial<FormState>) {
    setForm((s) => ({ ...s, ...patch }));
  }

  function addLine() {
    setForm((s) => ({
      ...s,
      lines: [
        ...s.lines,
        { tempId: newTempId(), itemId: null, uomId: null, qty: "1", note: null },
      ],
    }));
  }

  function removeLine(tempId: string) {
    setForm((s) => ({ ...s, lines: s.lines.filter((x) => x.tempId !== tempId) }));
  }

  function updateLine(tempId: string, patch: Partial<FormLine>) {
    setForm((s) => ({
      ...s,
      lines: s.lines.map((x) => (x.tempId === tempId ? { ...x, ...patch } : x)),
    }));
  }

  function onItemChange(tempId: string, itemId: string | null) {
    const item = items.find((x) => x.id === itemId);
    updateLine(tempId, {
      itemId,
      // auto-pick default UOM if item has one AND line UOM empty
      uomId: item?.baseUomId ?? null,
    });
  }

  /* ---------------- Mutations ---------------- */

  async function saveDraft() {
  if (!companyId || !id || !detail) return;

  if (!validation.ok) {
    setError(validation.issues.join(" "));
    return;
  }

  const fromCode = form.fromLocationId ? locationCodeById.get(form.fromLocationId) : undefined;
  const toCode = form.toLocationId ? locationCodeById.get(form.toLocationId) : undefined;

  if (!toCode) {
    setError("To location is required.");
    return;
  }
  if (!fromCode) {
    // optional per DTO, but you probably want it
    setError("From location is required.");
    return;
  }
  if (fromCode === toCode) {
    setError("From and To locations must be different.");
    return;
  }

  setSaving(true);
  setError(null);
  setToast(null);

  try {
    const payload = {
      companyId,
      fromLocationCode: fromCode, // optional but included
      toLocationCode: toCode,     // required
      reference: form.reference.trim() ? form.reference.trim() : null,
      transferDate: form.transferDate ? form.transferDate : null, // yyyy-mm-dd
      items: form.lines.map((l) => ({
        inventoryItemId: l.itemId!,   // or l.inventoryItemId if you renamed
        unitId: l.uomId!,             // or l.unitId
        quantity: Number(l.qty),
        notes: l.note?.trim() ? l.note.trim() : null,
      })),
    } satisfies import("../types").UpdateStockTransferRequest;

    await stockTransfersApi.update(companyId, id, payload);

    await load();
    setToast("Saved.");
  } catch (e: any) {
    setError(e?.response?.data?.message ?? e?.message ?? "Failed to save.");
  } finally {
    setSaving(false);
  }
}


  async function doAction(kind: "submit" | "cancel" | "post") {
    if (!companyId || !id) return;

    setActing(kind);
    setError(null);
    setToast(null);

    try {
      if (kind === "submit") {
        if (!validation.ok) {
          setError(validation.issues.join(" "));
          return;
        }
        await stockTransfersApi.submit(companyId, id);
      } else if (kind === "cancel") {
        await stockTransfersApi.cancel(companyId, id);
      } else {
        await stockTransfersApi.post(companyId, id);
      }

      await load();
      setToast(kind === "post" ? "Posted." : "Action completed.");
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Action failed.");
    } finally {
      setActing(null);
    }
  }

  if (!companyId) return <div className="p-4">Select company</div>;

  /* ========================== RENDER ========================== */

  return (
    <div className="page space-y-4 pb-24">
      <DocHeader
        title={
          <div className="flex items-center gap-2">
            Stock Transfer{" "}
            <span className="font-semibold">{(detail as any)?.transferNumber ?? ""}</span>
           {detail && (
                <StatusPill
                  text={StockTransferStatus[status]}
                  tone={statusTone[status]}
                />
              )}
          </div>
        }
        subtitle="Edit transfer and manage workflow actions."
        right={
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => nav(-1)}>
              Back
            </button>
            <button className="btn btn-primary" disabled={!editable || saving} onClick={saveDraft}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        }
      />

      {loading && <div className="card p-4">Loading…</div>}
      {error && <div className="alert danger">{error}</div>}
      {toast && <div className="alert success">{toast}</div>}

      {!loading && detail && (
        <>
          <KpiRow>
            <Kpi label="Lines" value={totals.lines} />
            <Kpi label="Total Qty" value={totals.qty} />
            <Kpi label="From" value={(detail as any).fromLocationName} />
            <Kpi label="To" value={(detail as any).toLocationName} />
            <Kpi label="Status" value={status} />
          </KpiRow>

          {/* ================= Header ================= */}
          <div className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <SelectDropdown<string>
              label="From Location"
              value={form.fromLocationId}
              options={locationOptions}
              placeholder="Select from…"
              disabled={!editable}
              onChange={(v) => updateHeader({ fromLocationId: v })}
            />

            <SelectDropdown<string>
              label="To Location"
              value={form.toLocationId}
              options={locationOptions}
              placeholder="Select to…"
              disabled={!editable}
              onChange={(v) => updateHeader({ toLocationId: v })}
            />

            <div>
              <label className="text-sm font-medium">Transfer Date</label>
              <input
                className="input mt-1 w-full"
                type="date"
                value={form.transferDate}
                disabled={!editable}
                onChange={(e) => updateHeader({ transferDate: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Reference</label>
              <input
                className="input mt-1 w-full"
                value={form.reference}
                disabled={!editable}
                onChange={(e) => updateHeader({ reference: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* ================= Lines ================= */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Lines</div>
              <button className="btn btn-secondary" disabled={!editable} onClick={addLine}>
                + Add line
              </button>
            </div>

            {form.lines.length === 0 && (
              <div className="text-sm text-slate-500">No lines yet.</div>
            )}

            {form.lines.map((l, idx) => (
              <div key={l.tempId} className="grid grid-cols-1 md:grid-cols-12 gap-3 border-t pt-3">
                <div className="md:col-span-5">
                  <SelectDropdown<string>
                    label={`Item ${idx + 1}`}
                    value={l.itemId}
                    options={itemOptions}
                    placeholder="Select item…"
                    disabled={!editable}
                    onChange={(v) => onItemChange(l.tempId, v)}
                  />
                </div>

                <div className="md:col-span-3">
                  <SelectDropdown<string>
                    label="UOM"
                    value={l.uomId}
                    options={uomOptions}
                    placeholder="Select UOM…"
                    disabled={!editable || !l.itemId}
                    onChange={(v) => updateLine(l.tempId, { uomId: v })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Qty</label>
                  <input
                    className="input mt-1 w-full"
                    value={l.qty}
                    disabled={!editable}
                    onChange={(e) => updateLine(l.tempId, { qty: e.target.value })}
                    inputMode="decimal"
                  />
                </div>

                <div className="md:col-span-2 flex items-end gap-2">
                  <button
                    className="btn btn-secondary w-full"
                    disabled={!editable}
                    onClick={() => removeLine(l.tempId)}
                  >
                    Remove
                  </button>
                </div>

                <div className="md:col-span-12">
                  <label className="text-sm font-medium">Note</label>
                  <input
                    className="input mt-1 w-full"
                    value={l.note ?? ""}
                    disabled={!editable}
                    onChange={(e) => updateLine(l.tempId, { note: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ================= Sticky Actions ================= */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 border-t">
            <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between">
              <div className="text-xs text-slate-500">
                {editable ? "Review and save, then submit when ready." : "Read-only in current status."}
              </div>

              <div className="flex gap-2">
                <button
                  className="btn btn-primary"
                  disabled={!canSubmit(status) || acting !== null}
                  onClick={() => doAction("submit")}
                >
                  Submit
                </button>

                <button
                  className="btn btn-secondary"
                  disabled={!canCancel(status) || acting !== null}
                  onClick={() => doAction("cancel")}
                >
                  Cancel
                </button>

                <button
                  className="btn btn-primary"
                  disabled={!canPost(status) || acting !== null}
                  onClick={() => doAction("post")}
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
