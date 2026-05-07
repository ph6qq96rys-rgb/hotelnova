import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";

import { stockTransfersApi } from "../api/stockTransfersApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import { inventoryItemsApi } from "../../../inventoryMaster/items/api/inventoryItemsApi";

import type { InventoryItemDto } from "../../../inventoryMaster/items/types";

import {
  cardStyle,
  labelStyle,
  inputStyle,
  errorStyle,
  tableStyle,
  thStyle,
  tdStyle,
  primaryBtn,
  secondaryBtn,
  dangerBtn,
  stickyBar,
} from "../../../../shared/inventoryStyles";

/** ================= Helpers ================= */

type SelectOption<T extends string> = { value: T; label: string };

const todayDateOnly = () => new Date().toISOString().slice(0, 10);

function dateOnlyToUtcIso(dateOnly: string) {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

const clean = (s?: string | null) => (s ?? "").trim();

function getErrorMessage(e: any) {
  return e?.response?.data?.title ?? e?.response?.data?.message ?? e?.message ?? "Request failed";
}

/** ================= Item VM (same spirit as GRN) ================= */

type ItemUomVm = {
  uomId: string;
  uomName: string;
  isDefault?: boolean;
};

type ItemVm = {
  id: string;
  label: string;
  uoms: ItemUomVm[];
  defaultUomId: string;
};

function toItemVm(dto: InventoryItemDto): ItemVm {
  const d: any = dto;

  const id = clean(d.id);
  const name = clean(d.name) || "Item";
  const code = clean(d.code) || clean(d.sku) || "";

  const uomsRaw: any[] =
    Array.isArray(d.uoms) ? d.uoms : Array.isArray(d.itemUoms) ? d.itemUoms : Array.isArray(d.allowedUoms) ? d.allowedUoms : [];

  const uoms: ItemUomVm[] = (uomsRaw ?? [])
    .map((u: any) => {
      const uomId = clean(u.uomId ?? u.id);
      const uomName = clean(u.uomName ?? u.name ?? u.code ?? "UOM");
      const isDefault = !!u.isDefaultIssue || !!u.isDefaultPurchase || !!u.isDefault || !!u.isBase;
      return { uomId, uomName, isDefault };
    })
    .filter((x) => !!x.uomId);

  const baseUomId = clean(d.baseUomId);
  const baseUomName = clean(d.baseUomName ?? d.baseUomCode ?? d.baseUom?.name ?? d.baseUom?.code);

  if (!uoms.length && baseUomId) {
    uoms.push({ uomId: baseUomId, uomName: baseUomName || "Base UOM", isDefault: true });
  }

  const defaultUomId = uoms.find((x) => x.isDefault)?.uomId ?? baseUomId ?? (uoms[0]?.uomId ?? "");
  const label = code ? `${code} — ${name}` : name;

  return { id, label, uoms, defaultUomId };
}

/** ================= Draft Types ================= */

type TransferLineDraft = {
  inventoryItemId: string;
  unitId: string;
  quantity: number;
  notes: string;
};

type TransferDraft = {
  fromLocationId: string;
  toLocationId: string;
  transferDate: string; // date-only
  reference: string;
  lines: TransferLineDraft[];
};

type FieldErrors = {
  fromLocationId?: string;
  toLocationId?: string;
  transferDate?: string;
  lines?: string;
  lineErrors?: Record<number, Partial<Record<keyof TransferLineDraft, string>>>;
};

export default function StockTransferCreatePage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  /** Form */
  const [form, setForm] = useState<TransferDraft>({
    fromLocationId: "",
    toLocationId: "",
    transferDate: todayDateOnly(),
    reference: "",
    lines: [],
  });

  const setHeader = (patch: Partial<TransferDraft>) => setForm((f) => ({ ...f, ...patch }));
  const updateLine = (idx: number, patch: Partial<TransferLineDraft>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));

  /** Warehouses / Locations (same as GRN) */
  const [locationOptions, setLocationOptions] = useState<SelectOption<string>[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

  const [locationLabelById, setLocationLabelById] = useState<Record<string, string>>({});
  const fetchedLocationRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLocationOptions([]);
    if (!companyId || !branchId) return;

    setLocationsLoading(true);
    stockLocationsApi
      .list(companyId, branchId)
      .then((rows: any[]) => {
        const opts: SelectOption<string>[] = (rows ?? []).map((x) => ({
          value: String(x.id),
          label: clean(x.name) || "Location",
        }));
        setLocationOptions(opts);
      })
      .catch(() => setLocationOptions([]))
      .finally(() => setLocationsLoading(false));
  }, [companyId, branchId]);

  // cache labels
  useEffect(() => {
    if (!locationOptions.length) return;
    setLocationLabelById((prev) => {
      const next = { ...prev };
      locationOptions.forEach((o) => (next[o.value] = o.label));
      return next;
    });
  }, [locationOptions]);

  // best-effort getById if location saved but not in options (optional, like GRN)
  useEffect(() => {
    const ids = [clean(form.fromLocationId), clean(form.toLocationId)].filter(Boolean);
    if (!companyId || !branchId) return;

    ids.forEach((id) => {
      if (!id) return;
      if (locationLabelById[id]) return;
      if (fetchedLocationRef.current.has(id)) return;

      const apiAny: any = stockLocationsApi as any;
      if (typeof apiAny.getById !== "function") {
        setLocationLabelById((prev) => ({ ...prev, [id]: "Saved location" }));
        fetchedLocationRef.current.add(id);
        return;
      }

      fetchedLocationRef.current.add(id);
      (async () => {
        try {
          const loc = await apiAny.getById(companyId, branchId, id);
          const name = clean(loc?.name) || "Location";
          setLocationLabelById((prev) => ({ ...prev, [id]: name }));
        } catch {
          setLocationLabelById((prev) => ({ ...prev, [id]: "Saved location" }));
        }
      })();
    });
  }, [companyId, branchId, form.fromLocationId, form.toLocationId, locationLabelById]);

  /** Items */
  const [items, setItems] = useState<ItemVm[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  const [itemLabelById, setItemLabelById] = useState<Record<string, string>>({});
  const [uomLabelById, setUomLabelById] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;

    async function loadItems() {
      if (!companyId) {
        if (!alive) return;
        setItems([]);
        setItemsLoading(false);
        return;
      }

      setItemsLoading(true);
      try {
        const res = await inventoryItemsApi.list(companyId);
        const list: InventoryItemDto[] = Array.isArray(res) ? res : res ?? [];
        const vms = (list ?? []).map(toItemVm);

        if (!alive) return;
        setItems(vms);

        setItemLabelById((prev) => {
          const next = { ...prev };
          vms.forEach((it) => (next[it.id] = it.label));
          return next;
        });
        setUomLabelById((prev) => {
          const next = { ...prev };
          vms.forEach((it) => it.uoms.forEach((u) => (next[u.uomId] = u.uomName)));
          return next;
        });
      } catch {
        if (!alive) return;
        setItems([]);
      } finally {
        if (!alive) return;
        setItemsLoading(false);
      }
    }

    loadItems();
    return () => {
      alive = false;
    };
  }, [companyId]);

  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const itemOptions = useMemo<SelectOption<string>[]>(() => items.map((it) => ({ value: it.id, label: it.label })), [items]);

  /** Validation / submit */
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (current: TransferDraft): FieldErrors => {
    const e: FieldErrors = {};

    if (!clean(current.fromLocationId)) e.fromLocationId = "From location is required.";
    if (!clean(current.toLocationId)) e.toLocationId = "To location is required.";
    if (clean(current.fromLocationId) && clean(current.toLocationId) && current.fromLocationId === current.toLocationId) {
      e.toLocationId = "To location must be different from From location.";
    }
    if (!clean(current.transferDate)) e.transferDate = "Transfer date is required.";

    if (!current.lines.length) e.lines = "Add at least one line.";

    const lineErrors: FieldErrors["lineErrors"] = {};
    current.lines.forEach((l, idx) => {
      const le: Partial<Record<keyof TransferLineDraft, string>> = {};
      if (!clean(l.inventoryItemId)) le.inventoryItemId = "Item is required.";
      if (!clean(l.unitId)) le.unitId = "Unit is required.";
      if (!Number.isFinite(l.quantity) || l.quantity <= 0) le.quantity = "Qty must be > 0.";
      if (Object.keys(le).length) lineErrors[idx] = le;
    });

    if (Object.keys(lineErrors).length) e.lineErrors = lineErrors;
    return e;
  };

  const hasErrors = (e: FieldErrors) =>
    !!(e.fromLocationId || e.toLocationId || e.transferDate || e.lines || (e.lineErrors && Object.keys(e.lineErrors).length));

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { inventoryItemId: "", unitId: "", quantity: 1, notes: "" }],
    }));
  };

  const removeLine = (idx: number) => {
  setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));

  setErrors((prev) => {
    const next: FieldErrors = { ...prev };

    if (next.lineErrors) {
      const remapped: NonNullable<FieldErrors["lineErrors"]> = {};

      Object.entries(next.lineErrors).forEach(([k, v]) => {
        const i = Number(k);
        if (!Number.isFinite(i)) return;

        if (i < idx) remapped[i] = v as Partial<Record<keyof TransferLineDraft, string>>;
        else if (i > idx) remapped[i - 1] = v as Partial<Record<keyof TransferLineDraft, string>>;
      });

      next.lineErrors = remapped;
    }

    return next;
  });
};


  const onCreateDraftAndContinue = async () => {
    setSubmitError(null);

    const e = validate(form);
    setErrors(e);
    if (hasErrors(e) || !companyId) return;

    setBusy(true);
    try {
      const body: any = {
        companyId,
        fromLocationId: form.fromLocationId,
        toLocationId: form.toLocationId,
        requestedAtUtc: dateOnlyToUtcIso(form.transferDate),
        notes: clean(form.reference) ? clean(form.reference) : null,
        lines: form.lines.map((l) => ({
          inventoryItemId: l.inventoryItemId,
          quantity: Number(l.quantity),
          unitId: l.unitId,
          notes: clean(l.notes) ? clean(l.notes) : null,
        })),
      };

      const id = await stockTransfersApi.create(companyId, body);
      nav(`/inventory/stock-transfers/${id}/edit`);
    } catch (err: any) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /** Render guards */
  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;
  if (!branchId) return <div style={{ padding: 16 }}>Select a branch first.</div>;

  /** Saved location handling (name-first) */
  const fromId = clean(form.fromLocationId);
  const toId = clean(form.toLocationId);

  const fromExists = fromId ? locationOptions.some((o) => o.value === fromId) : false;
  const toExists = toId ? locationOptions.some((o) => o.value === toId) : false;

  const fromLabel = locationLabelById[fromId] || (fromId ? "Saved location" : "");
  const toLabel = locationLabelById[toId] || (toId ? "Saved location" : "");

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Create Stock Transfer</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Choose From/To locations, add line items, then continue to the editor.
          </div>

          {submitError && <div style={{ marginTop: 10, ...errorStyle }}>{submitError}</div>}
        </div>
      </div>

      {/* Header Card */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>From Location *</label>
            <select
              style={inputStyle(!!errors.fromLocationId)}
              value={fromId || ""}
              disabled={locationsLoading || busy}
              onChange={(e) => {
                const v = e.target.value || "";
                setHeader({ fromLocationId: v });

                // if selecting same as "to", clear to
                if (v && v === clean(form.toLocationId)) setHeader({ toLocationId: "" });
              }}
            >
              {!fromExists && fromId && <option value={fromId}>{fromLabel}</option>}

              {!fromId && (
                <option value="" disabled>
                  {locationsLoading ? "Loading locations..." : "Select from location…"}
                </option>
              )}

              {locationOptions
                .filter((o) => o.value !== toId) // exclude currently selected "to"
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </select>
            {errors.fromLocationId && <div style={errorStyle}>{errors.fromLocationId}</div>}
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>To Location *</label>
            <select
              style={inputStyle(!!errors.toLocationId)}
              value={toId || ""}
              disabled={locationsLoading || busy}
              onChange={(e) => {
                const v = e.target.value || "";
                setHeader({ toLocationId: v });

                // if selecting same as "from", clear from
                if (v && v === clean(form.fromLocationId)) setHeader({ fromLocationId: "" });
              }}
            >
              {!toExists && toId && <option value={toId}>{toLabel}</option>}

              {!toId && (
                <option value="" disabled>
                  {locationsLoading ? "Loading locations..." : "Select to location…"}
                </option>
              )}

              {locationOptions
                .filter((o) => o.value !== fromId) // exclude currently selected "from"
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </select>
            {errors.toLocationId && <div style={errorStyle}>{errors.toLocationId}</div>}
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>Transfer Date *</label>
            <input
              style={inputStyle(!!errors.transferDate)}
              type="date"
              value={form.transferDate}
              onChange={(e) => setHeader({ transferDate: e.target.value })}
            />
            {errors.transferDate && <div style={errorStyle}>{errors.transferDate}</div>}
          </div>

          <div style={{ gridColumn: "span 12" }}>
            <label style={labelStyle}>Notes</label>
            <input
              style={inputStyle(false)}
              value={form.reference}
              onChange={(e) => setHeader({ reference: e.target.value })}
              placeholder="Optional…"
            />
          </div>
        </div>
      </div>

      {/* Lines */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Line Items</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>Units are filtered by each item’s allowed UOM list.</div>
          </div>

          <button style={primaryBtn} onClick={addLine} disabled={busy}>
            + Add Line
          </button>
        </div>

        {errors.lines && <div style={{ ...errorStyle, marginTop: 10 }}>{errors.lines}</div>}

        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Item *</th>
                <th style={thStyle}>Qty *</th>
                <th style={thStyle}>Unit (UOM) *</th>
                <th style={thStyle}>Notes</th>
                <th style={{ ...thStyle, textAlign: "right" }}></th>
              </tr>
            </thead>

            <tbody>
              {form.lines.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 18, opacity: 0.75 }}>
                    No lines yet. Click <b>Add Line</b>.
                  </td>
                </tr>
              ) : (
                form.lines.map((l, idx) => {
                  const le = errors.lineErrors?.[idx] ?? {};

                  const savedItemId = clean(l.inventoryItemId);
                  const savedUomId = clean(l.unitId);

                  const item = savedItemId ? itemById.get(savedItemId) : undefined;
                  const uomOptions: SelectOption<string>[] =
                    item?.uoms.map((u) => ({ value: u.uomId, label: u.uomName })) ?? [];

                  const itemExists = savedItemId ? itemById.has(savedItemId) : false;
                  const uomExists = savedUomId ? uomOptions.some((o) => o.value === savedUomId) : false;

                  const savedItemLabel = itemLabelById[savedItemId] || (savedItemId ? "Saved item" : "");
                  const savedUomLabel = uomLabelById[savedUomId] || (savedUomId ? "Saved unit" : "");

                  return (
                    <tr key={idx}>
                      <td style={tdStyle}>
                        <select
                          style={inputStyle(!!le.inventoryItemId)}
                          value={savedItemId || ""}
                          disabled={itemsLoading || busy}
                          onChange={(e) => {
                            const id = e.target.value || "";
                            const it = id ? itemById.get(id) : undefined;

                            updateLine(idx, {
                              inventoryItemId: id,
                              unitId: it?.defaultUomId ?? "",
                            });
                          }}
                        >
                          {!itemExists && savedItemId && <option value={savedItemId}>{savedItemLabel}</option>}

                          {!savedItemId && (
                            <option value="" disabled>
                              {itemsLoading ? "Loading items..." : "Select item…"}
                            </option>
                          )}

                          {itemOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {le.inventoryItemId && <div style={errorStyle}>{le.inventoryItemId}</div>}
                      </td>

                      <td style={tdStyle}>
                        <input
                          style={inputStyle(!!le.quantity)}
                          type="number"
                          min={0}
                          step={0.01}
                          value={Number.isFinite(l.quantity) ? l.quantity : 0}
                          onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                        />
                        {le.quantity && <div style={errorStyle}>{le.quantity}</div>}
                      </td>

                      <td style={tdStyle}>
                        <select
                          style={inputStyle(!!le.unitId)}
                          value={savedUomId || ""}
                          disabled={!savedItemId || busy}
                          onChange={(e) => updateLine(idx, { unitId: e.target.value || "" })}
                        >
                          {!uomExists && savedUomId && <option value={savedUomId}>{savedUomLabel}</option>}

                          {!savedUomId && (
                            <option value="" disabled>
                              {!savedItemId
                                ? "Select item first…"
                                : uomOptions.length === 0
                                ? "Loading units..."
                                : "Select unit…"}
                            </option>
                          )}

                          {uomOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {le.unitId && <div style={errorStyle}>{le.unitId}</div>}
                      </td>

                      <td style={tdStyle}>
                        <input
                          style={inputStyle(false)}
                          value={l.notes}
                          onChange={(e) => updateLine(idx, { notes: e.target.value })}
                          placeholder="Optional"
                        />
                      </td>

                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button style={dangerBtn} onClick={() => removeLine(idx)} disabled={busy}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div style={stickyBar}>
        <div style={{ opacity: 0.85 }}>
          <b>Tip:</b> Create draft and continue to edit/submit.
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} onClick={() => nav(`/inventory/stock-transfers`)} disabled={busy}>
            Transfers
          </button>

          <button style={primaryBtn} onClick={onCreateDraftAndContinue} disabled={busy || !companyId}>
            {busy ? "Creating..." : "Create Draft & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
