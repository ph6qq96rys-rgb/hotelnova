import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../../../../api/http";
import { useAppScope } from "../../../../app/useAppScope";
import { stockTransfersApi } from "../api/stockTransfersApi";
import {
  STOCK_TRANSFER_STATUS,
  type StockTransferDetailDto,
  type StockTransferStatus,
  type StockLocationDto,
} from "../types";

/* =========================
   CONFIG: Fix endpoints here
   ========================= */
const LOOKUP_ENDPOINTS = {
  locations: (companyId: string, branchId: string) =>
    `/companies/${companyId}/branches/${branchId}/stock-locations`,

  // ⚠️ MUST be real endpoints returning IDs
  items: (companyId: string) => `/companies/${companyId}/inventory/items`,
  uoms: (companyId: string) => `/companies/${companyId}/inventory-master/uoms`,
};
/* ========================= */

type SelectOption<T> = { value: T; label: string };

type ItemLookupDto = {
  id: string;
  code?: string | null;
  name?: string | null;
  label?: string | null;
  defaultUomId?: string | null;
  uoms?: Array<{ uomId: string }>;
};

type UomLookupDto = {
  id: string;
  code?: string | null;
  name?: string | null;
};

type MsgTone = "success" | "error" | "info";
type Msg = { tone: MsgTone; text: string } | null;

type FormLine = {
  id: string; // stable UI key
  inventoryItemId: string;
  unitId: string;
  qty: number;
  note: string;
  // keep display in case mapping fails
  _itemCode?: string;
  _itemName?: string;
  _uomText?: string;
};

type FormState = {
  fromLocationId: string;
  toLocationId: string;
  transferDate: string; // yyyy-mm-dd
  reference: string;
  lines: FormLine[];
};

type FieldErrors = {
  fromLocationId?: string;
  toLocationId?: string;
  transferDate?: string;
  lines?: string;
  lineErrors?: Record<number, Partial<Record<keyof FormLine, string>>>;
};

function clean(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}
function norm(v: any) {
  return clean(v).toLowerCase();
}
function newKey() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function isoToDateOnly(iso: string | null | undefined) {
  const s = clean(iso);
  if (!s) return "";
  return s.includes("T") ? s.slice(0, 10) : s;
}
function dateOnlyToUtcIso(dateOnly: string) {
  if (!dateOnly) return null;
  const [y, m, d] = dateOnly.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).toISOString();
}
function apiErr(e: any) {
  return String(e?.response?.data?.message || e?.response?.data || e?.message || "Request failed");
}

/** Status normalization (no number casts!) */
const STATUS_VALUES = new Set<StockTransferStatus>(Object.values(STOCK_TRANSFER_STATUS));
function isStatus(v: any): v is StockTransferStatus {
  return STATUS_VALUES.has(v);
}
function normalizeStatus(raw: any): StockTransferStatus {
  if (isStatus(raw)) return raw;
  const v = norm(raw);
  if (v === "draft") return STOCK_TRANSFER_STATUS.Draft;
  if (v === "submitted") return STOCK_TRANSFER_STATUS.Submitted;
  if (v === "approved") return STOCK_TRANSFER_STATUS.Approved;
  if (v === "rejected") return STOCK_TRANSFER_STATUS.Rejected;
  if (v === "posted") return STOCK_TRANSFER_STATUS.Posted;
  if (v === "reversed") return STOCK_TRANSFER_STATUS.Reversed;
  if (v === "cancelled" || v === "canceled") return STOCK_TRANSFER_STATUS.Cancelled;
  return STOCK_TRANSFER_STATUS.Draft;
}

const canEdit = (s: StockTransferStatus) =>
  s === STOCK_TRANSFER_STATUS.Draft || s === STOCK_TRANSFER_STATUS.Rejected;
const canSubmit = canEdit;
const canCancel = (s: StockTransferStatus) =>
  s === STOCK_TRANSFER_STATUS.Draft || s === STOCK_TRANSFER_STATUS.Submitted || s === STOCK_TRANSFER_STATUS.Approved;
const canPost = (s: StockTransferStatus) => s === STOCK_TRANSFER_STATUS.Approved;

/* ======================
   Lookups (no custom hooks)
   ====================== */
async function listLocations(companyId: string, branchId: string): Promise<StockLocationDto[]> {
  const res = await http.get(LOOKUP_ENDPOINTS.locations(companyId, branchId));
  return res.data ?? [];
}
async function listItems(companyId: string): Promise<ItemLookupDto[]> {
  const res = await http.get(LOOKUP_ENDPOINTS.items(companyId));
  const data = res.data;
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.data)
        ? data.data
        : [];
  return (rows ?? []) as ItemLookupDto[];
}
async function listUoms(companyId: string): Promise<UomLookupDto[]> {
  const res = await http.get(LOOKUP_ENDPOINTS.uoms(companyId));
  const data = res.data;
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.data)
        ? data.data
        : [];
  return (rows ?? []) as UomLookupDto[];
}

/* ======================
   Read-only table (non-draft)
   ====================== */
function ReadOnlyLinesTable(props: { items: StockTransferDetailDto["items"] }) {
  const { items } = props;
  return (
    <div style={{ marginTop: 14, overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 150 }}>Item Code</th>
            <th style={{ ...thStyle, width: 420 }}>Item Name</th>
            <th style={{ ...thStyle, width: 120 }}>UOM</th>
            <th style={{ ...thStyle, width: 120 }}>Qty</th>
            <th style={{ ...thStyle, width: 140 }}>Avg Cost</th>
            <th style={{ ...thStyle, width: 140 }}>Line Value</th>
          </tr>
        </thead>
        <tbody>
          {(items ?? []).length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: 18, opacity: 0.75 }}>
                No items.
              </td>
            </tr>
          ) : (
            items.map((x) => (
              <tr key={x.id}>
                <td style={tdStyle}>{x.itemCode}</td>
                <td style={tdStyle}>{x.itemName}</td>
                <td style={tdStyle}>{x.uom}</td>
                <td style={tdStyle}>{x.quantity}</td>
                <td style={tdStyle}>{x.avgUnitCost ?? "—"}</td>
                <td style={tdStyle}>{x.lineValue ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ======================
   PAGE
   ====================== */
export default function StockTransferEditPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<StockTransferDetailDto | null>(null);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [items, setItems] = useState<ItemLookupDto[]>([]);
  const [uoms, setUoms] = useState<UomLookupDto[]>([]);

  const [form, setForm] = useState<FormState>({
    fromLocationId: "",
    toLocationId: "",
    transferDate: "",
    reference: "",
    lines: [],
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<null | "submit" | "cancel" | "post">(null);
  const [needsRemap, setNeedsRemap] = useState(false);

  const status: StockTransferStatus = useMemo(() => normalizeStatus(detail?.status), [detail]);
  const editable = !!detail && canEdit(status);
  const busy = loading || saving || acting !== null;

  const locationOptions = useMemo<SelectOption<string>[]>(
    () => locations.map((x) => ({ value: x.id, label: clean(x.name) || clean(x.code) || "Location" })),
    [locations]
  );

  const itemOptions = useMemo<SelectOption<string>[]>(
    () =>
      items
        .filter((x) => clean(x.id))
        .map((x) => ({
          value: String(x.id),
          label: clean(x.label) || `${clean(x.code)} ${clean(x.name)}`.trim() || "Item",
        })),
    [items]
  );

  const uomOptionsAll = useMemo<SelectOption<string>[]>(
    () =>
      uoms
        .filter((x) => clean(x.id))
        .map((x) => ({
          value: String(x.id),
          label: clean(x.name) || clean(x.code) || "UOM",
        })),
    [uoms]
  );

  const itemById = useMemo(() => new Map(items.map((it) => [String(it.id), it])), [items]);

  const totals = useMemo(() => {
    if (!editable && detail) {
      return {
        qty: Number(detail.totalQuantity ?? 0) || 0,
        lines: detail.items?.length ?? 0,
      };
    }
    return {
      qty: form.lines.reduce((a, l) => a + (Number(l.qty) || 0), 0),
      lines: form.lines.length,
    };
  }, [editable, detail, form.lines]);

  function uomOptionsForLine(inventoryItemId: string): SelectOption<string>[] {
    const it = inventoryItemId ? itemById.get(inventoryItemId) : undefined;
    const allowed = (it?.uoms ?? []).map((x) => String(x.uomId)).filter(Boolean);
    if (allowed.length) {
      const set = new Set(allowed);
      return uoms
        .filter((u) => set.has(String(u.id)))
        .map((u) => ({ value: String(u.id), label: clean(u.name) || clean(u.code) || "UOM" }));
    }
    return uomOptionsAll;
  }

  /* ===========
     LOAD
     =========== */
  async function loadAll() {
    if (!companyId || !branchId || !id) return;

    setLoading(true);
    setMsg(null);

    try {
      const [d, locs, its, us] = await Promise.all([
        stockTransfersApi.get(companyId, id),
        listLocations(companyId, branchId),
        listItems(companyId),
        listUoms(companyId),
      ]);

      setDetail(d);
      setLocations(locs);
      setItems(its);
      setUoms(us);

      // Build mapping tables immediately (use fresh its/us)
      const itemIdByCode = new Map<string, string>();
      its.forEach((it) => {
        const code = norm(it.code);
        if (code) itemIdByCode.set(code, String(it.id));
      });

      const uomIdByCodeOrName = new Map<string, string>();
      us.forEach((u) => {
        const code = norm(u.code);
        const name = norm(u.name);
        if (code) uomIdByCodeOrName.set(code, String(u.id));
        if (name) uomIdByCodeOrName.set(name, String(u.id));
      });

      // ✅ ALWAYS build form.lines from detail.items so draft lines show on open
      const mappedLines: FormLine[] = (d.items ?? []).map((x: any) => {
        const mappedItemId =
          clean(x.inventoryItemId) ||
          itemIdByCode.get(norm(x.itemCode)) ||
          "";

        const mappedUnitId =
          clean(x.unitId) ||
          uomIdByCodeOrName.get(norm(x.uom)) ||
          "";

        return {
          id: clean(x.id) || newKey(),
          inventoryItemId: mappedItemId,
          unitId: mappedUnitId,
          qty: Number(x.quantity) || 0,
          note: clean(x.notes) || "",
          _itemCode: clean(x.itemCode),
          _itemName: clean(x.itemName),
          _uomText: clean(x.uom),
        };
      });

      setNeedsRemap(mappedLines.some((l) => !clean(l.inventoryItemId) || !clean(l.unitId)));

      setForm({
        fromLocationId: clean((d as any).fromLocationId),
        toLocationId: clean((d as any).toLocationId),
        transferDate: isoToDateOnly(d.transferDateUtc),
        reference: clean(d.reference),
        lines: mappedLines, // ✅ draft lines show immediately
      });

      setErrors({});
    } catch (e: any) {
      setMsg({ tone: "error", text: apiErr(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, branchId, id]);

  /* ===========
     EDIT HELPERS
     =========== */
  const updateHeader = (patch: Partial<FormState>) => setForm((s) => ({ ...s, ...patch }));

  const updateLine = (idx: number, patch: Partial<FormLine>) =>
    setForm((s) => ({ ...s, lines: s.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));

  const addLine = () => {
    setForm((s) => ({
      ...s,
      lines: [...s.lines, { id: newKey(), inventoryItemId: "", unitId: "", qty: 1, note: "" }],
    }));
  };

  const removeLine = (idx: number) => {
    setForm((s) => ({ ...s, lines: s.lines.filter((_, i) => i !== idx) }));
  };

  const onItemChange = (idx: number, inventoryItemId: string) => {
    const it = inventoryItemId ? itemById.get(inventoryItemId) : undefined;
    updateLine(idx, {
      inventoryItemId,
      unitId: clean(it?.defaultUomId) || "",
    });
  };

  /* ===========
     VALIDATION
     =========== */
  function validate(current: FormState): FieldErrors {
    const e: FieldErrors = {};
    if (!clean(current.fromLocationId)) e.fromLocationId = "From location is required.";
    if (!clean(current.toLocationId)) e.toLocationId = "To location is required.";
    if (clean(current.fromLocationId) && clean(current.toLocationId) && current.fromLocationId === current.toLocationId) {
      e.toLocationId = "From and To locations must be different.";
    }
    if (!clean(current.transferDate)) e.transferDate = "Transfer date is required.";
    if (!current.lines.length) e.lines = "Add at least one line.";

    const lineErrors: NonNullable<FieldErrors["lineErrors"]> = {};
    current.lines.forEach((l, idx) => {
      const le: Partial<Record<keyof FormLine, string>> = {};
      if (!clean(l.inventoryItemId)) le.inventoryItemId = "Item is required.";
      if (!clean(l.unitId)) le.unitId = "UOM is required.";
      if (!Number.isFinite(l.qty) || l.qty <= 0) le.qty = "Qty must be > 0.";
      if (Object.keys(le).length) lineErrors[idx] = le;
    });

    if (Object.keys(lineErrors).length) e.lineErrors = lineErrors;
    return e;
  }

  function hasErrors(e: FieldErrors) {
    return !!(e.fromLocationId || e.toLocationId || e.transferDate || e.lines || (e.lineErrors && Object.keys(e.lineErrors).length));
  }

  /* ===========
     SAVE / ACTIONS
     =========== */
  async function save() {
    if (!companyId || !id) return;
    setMsg(null);

    const e = validate(form);
    setErrors(e);
    if (hasErrors(e)) return;

    setSaving(true);
    try {
      const dto: any = {
        companyId,
        fromLocationId: form.fromLocationId,
        toLocationId: form.toLocationId,
        reference: clean(form.reference) ? clean(form.reference) : null,
        transferDateUtc: form.transferDate ? dateOnlyToUtcIso(form.transferDate) : null,
        items: form.lines.map((l) => ({
          inventoryItemId: l.inventoryItemId,
          unitId: l.unitId,
          quantity: Number(l.qty),
          notes: clean(l.note) ? clean(l.note) : null,
        })),
      };

      await stockTransfersApi.update(companyId, id, dto);
      await loadAll();
      setMsg({ tone: "success", text: "Saved." });
    } catch (e: any) {
      setMsg({ tone: "error", text: apiErr(e) });
    } finally {
      setSaving(false);
    }
  }

  async function doAction(kind: "submit" | "cancel" | "post") {
    if (!companyId || !id) return;
    setMsg(null);
    setActing(kind);

    try {
      if (kind === "submit") {
        const e = validate(form);
        setErrors(e);
        if (hasErrors(e)) {
          setMsg({ tone: "error", text: "Fix validation errors before submitting." });
          return;
        }
        await stockTransfersApi.submit(companyId, id);
      } else if (kind === "cancel") {
        await stockTransfersApi.cancel(companyId, id);
      } else {
        await stockTransfersApi.post(companyId, id);
      }

      await loadAll();
      setMsg({ tone: "success", text: "Done." });
    } catch (e: any) {
      setMsg({ tone: "error", text: apiErr(e) });
    } finally {
      setActing(null);
    }
  }

  /* ===========
     GUARDS
     =========== */
  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;
  if (!branchId) return <div style={{ padding: 16 }}>Select a branch first.</div>;
  if (!id) return <div style={{ padding: 16 }}>Missing transfer id.</div>;

  const transferNo = clean(detail?.transferNumber);

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            Stock Transfer {transferNo ? <span style={{ fontWeight: 700 }}>{transferNo}</span> : ""}
          </div>
          <div style={{ opacity: 0.78, marginTop: 6 }}>
            Status: <b>{String(status)}</b> {editable ? "• Editable" : "• Read-only"}
          </div>

          {editable && needsRemap && (
            <div style={{ marginTop: 10, ...warnStyle }}>
              Some draft rows could not be mapped to Item/UOM IDs.
              Those rows will show empty dropdowns — select Item and UOM then Save.
            </div>
          )}

          {msg && (
            <div style={{ marginTop: 10, ...(msg.tone === "success" ? successStyle : msg.tone === "info" ? infoStyle : errorStyle) }}>
              {msg.text}
            </div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Total Qty</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{totals.qty}</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            Lines: <b>{totals.lines}</b>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ ...cardStyle, marginTop: 14 }}>
          <div style={{ padding: 6, opacity: 0.75 }}>Loading…</div>
        </div>
      )}

      {/* Header Card */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>From Location *</label>
            <select
              style={inputStyle(!!errors.fromLocationId)}
              value={form.fromLocationId || ""}
              disabled={!editable || busy}
              onChange={(e) => updateHeader({ fromLocationId: e.target.value || "" })}
            >
              {!form.fromLocationId && <option value="" disabled>Select from…</option>}
              {locationOptions
                .filter((o) => o.value !== form.toLocationId)
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
              value={form.toLocationId || ""}
              disabled={!editable || busy}
              onChange={(e) => updateHeader({ toLocationId: e.target.value || "" })}
            >
              {!form.toLocationId && <option value="" disabled>Select to…</option>}
              {locationOptions
                .filter((o) => o.value !== form.fromLocationId)
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </select>
            {errors.toLocationId && <div style={errorStyle}>{errors.toLocationId}</div>}
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>Transfer Date *</label>
            <input
              style={inputStyle(!!errors.transferDate)}
              type="date"
              value={form.transferDate}
              disabled={!editable || busy}
              onChange={(e) => updateHeader({ transferDate: e.target.value })}
            />
            {errors.transferDate && <div style={errorStyle}>{errors.transferDate}</div>}
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>Reference</label>
            <input
              style={inputStyle(false)}
              value={form.reference}
              disabled={!editable || busy}
              onChange={(e) => updateHeader({ reference: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      {/* Lines Card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900 }}>Draft Items</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>
              Draft opens with items listed + edit + remove.
            </div>
          </div>

          <button style={primaryBtn} disabled={!editable || busy} onClick={addLine}>
            + Add line
          </button>
        </div>

        {/* Non-draft shows read-only inventory */}
        {!editable && detail ? (
          <ReadOnlyLinesTable items={detail.items} />
        ) : (
          <>
            {errors.lines && <div style={{ ...errorStyle, marginTop: 10 }}>{errors.lines}</div>}

            <div style={{ marginTop: 14, overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 420 }}>Item *</th>
                    <th style={{ ...thStyle, width: 240 }}>UOM *</th>
                    <th style={{ ...thStyle, width: 160 }}>Qty *</th>
                    <th style={{ ...thStyle, width: 360 }}>Note</th>
                    <th style={{ ...thStyle, width: 120, textAlign: "right" }}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {form.lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 18, opacity: 0.75 }}>
                        No draft lines yet.
                      </td>
                    </tr>
                  ) : (
                    form.lines.map((l, idx) => {
                      const le = errors.lineErrors?.[idx] ?? {};
                      const uomOpts = uomOptionsForLine(l.inventoryItemId);

                      return (
                        <tr key={l.id}>
                          <td style={tdStyle}>
                            <select
                              style={inputStyle(!!le.inventoryItemId)}
                              value={l.inventoryItemId || ""}
                              disabled={!editable || busy}
                              onChange={(e) => onItemChange(idx, e.target.value || "")}
                            >
                              {!l.inventoryItemId && (
                                <option value="" disabled>
                                  {l._itemCode ? `Map failed (${l._itemCode}) - select item…` : "Select item…"}
                                </option>
                              )}
                              {itemOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            {le.inventoryItemId && <div style={errorStyle}>{le.inventoryItemId}</div>}
                          </td>

                          <td style={tdStyle}>
                            <select
                              style={inputStyle(!!le.unitId)}
                              value={l.unitId || ""}
                              disabled={!editable || busy || !l.inventoryItemId}
                              onChange={(e) => updateLine(idx, { unitId: e.target.value || "" })}
                            >
                              {!l.unitId && (
                                <option value="" disabled>
                                  {l._uomText ? `Map failed (${l._uomText}) - select UOM…` : "Select UOM…"}
                                </option>
                              )}
                              {uomOpts.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            {le.unitId && <div style={errorStyle}>{le.unitId}</div>}
                          </td>

                          <td style={tdStyle}>
                            <input
                              style={inputStyle(!!le.qty)}
                              type="number"
                              min={0}
                              step={0.01}
                              value={Number.isFinite(l.qty) ? l.qty : 0}
                              disabled={!editable || busy}
                              onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                            />
                            {le.qty && <div style={errorStyle}>{le.qty}</div>}
                          </td>

                          <td style={tdStyle}>
                            <input
                              style={inputStyle(false)}
                              value={l.note}
                              disabled={!editable || busy}
                              onChange={(e) => updateLine(idx, { note: e.target.value })}
                              placeholder="Optional"
                            />
                          </td>

                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            <button style={dangerBtn} disabled={!editable || busy} onClick={() => removeLine(idx)}>
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
          </>
        )}
      </div>

      {/* Sticky Bar */}
      <div style={stickyBar}>
        <div style={{ opacity: 0.85 }}>
          <b>Workflow:</b> Draft → Submit → Approve → Post
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button style={secondaryBtn} onClick={() => nav(-1)} disabled={busy}>
            Back
          </button>

          <button style={secondaryBtn} onClick={loadAll} disabled={busy}>
            Refresh
          </button>

          <button style={secondaryBtn} disabled={!editable || busy} onClick={save}>
            {saving ? "Saving..." : "Save"}
          </button>

          <button style={primaryBtn} disabled={!canSubmit(status) || busy} onClick={() => doAction("submit")}>
            {acting === "submit" ? "Submitting..." : "Submit"}
          </button>

          <button style={secondaryBtn} disabled={!canCancel(status) || busy} onClick={() => doAction("cancel")}>
            {acting === "cancel" ? "Cancelling..." : "Cancel"}
          </button>

          <button style={primaryBtn} disabled={!canPost(status) || busy} onClick={() => doAction("post")}>
            {acting === "post" ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Styles ---------------- */

const cardStyle: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
  padding: 14,
  background: "white",
  color: "#0f172a",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.75,
  marginBottom: 6,
};

const inputStyle = (invalid: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: invalid ? "1px solid rgba(220, 38, 38, 0.55)" : "1px solid rgba(0,0,0,0.15)",
  outline: "none",
  background: "white",
  color: "#0f172a",
});

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 1100,
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.2,
  padding: "10px 10px",
  borderBottom: "1px solid rgba(0,0,0,0.12)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  verticalAlign: "top",
};

const errorStyle: React.CSSProperties = {
  color: "rgb(220, 38, 38)",
  fontSize: 12,
};

const successStyle: React.CSSProperties = {
  color: "rgb(22, 163, 74)",
  fontSize: 12,
};

const infoStyle: React.CSSProperties = {
  color: "rgb(2, 132, 199)",
  fontSize: 12,
};

const warnStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(234, 179, 8, 0.35)",
  background: "rgba(234, 179, 8, 0.10)",
  padding: "10px 12px",
  fontSize: 12,
  color: "#0f172a",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "#0f172a",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "white",
  color: "#0f172a",
  fontWeight: 900,
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(220, 38, 38, 0.35)",
  background: "rgba(220, 38, 38, 0.08)",
  color: "rgb(220, 38, 38)",
  fontWeight: 900,
  cursor: "pointer",
};

const stickyBar: React.CSSProperties = {
  position: "sticky",
  bottom: 0,
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};