// StockTransferEditPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../../../../api/http";
import { useAppScope } from "../../../../app/useAppScope";
import { stockTransfersApi } from "../api/stockTransfersApi";
import type { ItemLookupDto, UomLookupDto } from "../api/stockTransfersApi";
import {
  STOCK_TRANSFER_STATUS,
  type StockTransferDetailDto,
  type StockTransferStatus,
  type StockLocationDto,
} from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

type SelectOption<T> = { value: T; label: string };
type MsgTone = "success" | "error" | "info" | "warn";
type Msg = { tone: MsgTone; text: string } | null;

type FormLine = {
  id:              string;
  inventoryItemId: string;
  unitId:          string;
  qty:             number;
  note:            string;
  _itemCode?:      string;
  _itemName?:      string;
  _uomText?:       string;
};

type FormState = {
  fromLocationId: string;
  toLocationId:   string;
  transferDate:   string;
  reference:      string;
  lines:          FormLine[];
};

type FieldErrors = {
  fromLocationId?: string;
  toLocationId?:   string;
  transferDate?:   string;
  lines?:          string;
  lineErrors?:     Record<number, Partial<Record<keyof FormLine, string>>>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const clean = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return s;
};

const norm  = (v: unknown) => clean(v).toLowerCase();
const newKey = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isoToDateOnly = (iso: string | null | undefined): string => {
  const s = clean(iso);
  if (!s) return "";
  return s.includes("T") ? s.slice(0, 10) : s;
};

const dateOnlyToUtcIso = (dateOnly: string): string | null => {
  if (!dateOnly) return null;
  const [y, m, d] = dateOnly.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
};

// FIX: original cast response data objects to string, producing "[object Object]"
const apiErr = (e: unknown): string => {
  const err  = e as any;
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  return data?.message ?? data?.title ?? err?.message ?? "Request failed";
};

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_VALUES = new Set<StockTransferStatus>(Object.values(STOCK_TRANSFER_STATUS));

const normalizeStatus = (raw: unknown): StockTransferStatus => {
  if (STATUS_VALUES.has(raw as StockTransferStatus)) return raw as StockTransferStatus;
  const v = norm(raw);
  if (v === "draft")                         return STOCK_TRANSFER_STATUS.Draft;
  if (v === "submitted")                     return STOCK_TRANSFER_STATUS.Submitted;
  if (v === "approved")                      return STOCK_TRANSFER_STATUS.Approved;
  if (v === "rejected")                      return STOCK_TRANSFER_STATUS.Rejected;
  if (v === "posted")                        return STOCK_TRANSFER_STATUS.Posted;
  if (v === "reversed")                      return STOCK_TRANSFER_STATUS.Reversed;
  if (v === "cancelled" || v === "canceled") return STOCK_TRANSFER_STATUS.Cancelled;
  return STOCK_TRANSFER_STATUS.Draft;
};

const canEdit   = (s: StockTransferStatus) =>
  s === STOCK_TRANSFER_STATUS.Draft || s === STOCK_TRANSFER_STATUS.Rejected;
const canSubmit = canEdit;
const canCancel = (s: StockTransferStatus) =>
  s === STOCK_TRANSFER_STATUS.Draft ||
  s === STOCK_TRANSFER_STATUS.Submitted ||
  s === STOCK_TRANSFER_STATUS.Approved;
const canPost   = (s: StockTransferStatus) => s === STOCK_TRANSFER_STATUS.Approved;

// ── Location fetcher ──────────────────────────────────────────────────────────
//
// FIX: was `return res.data ?? []` — res.data is a PagedResult envelope
// ({ items, totalCount, page, pageSize }), not an array. The ?? [] fallback
// never fired because the object is truthy. locations.map() then threw
// "not a function" because the object has no .map method.

async function listLocations(
  companyId: string,
  branchId: string,
  signal?: AbortSignal
): Promise<StockLocationDto[]> {
  const res  = await http.get(
    `/companies/${companyId}/branches/${branchId}/stock-locations`,
    { signal }
  );
  const data = res.data;
  if (Array.isArray(data))        return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

// ── ReadOnlyLinesTable ────────────────────────────────────────────────────────

function ReadOnlyLinesTable({ items }: { items: StockTransferDetailDto["items"] }) {
  if (!items?.length) {
    return <div className="ob-empty"><div className="ob-empty__title">No items.</div></div>;
  }
  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--ob-slate-200)" }}>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["Item Code", "Item Name", "UOM", "Qty", "Avg Cost", "Line Value", "Note"].map(h => (
              <th key={h} style={{
                padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b",
                borderBottom: "1px solid var(--ob-slate-200)", whiteSpace: "nowrap",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(x => (
            <tr key={x.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>{x.itemCode}</td>
              <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{x.itemName}</td>
              <td style={{ padding: "9px 12px", fontSize: 12, color: "#475569" }}>{x.uom}</td>
              <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 600 }}>{x.quantity}</td>
              <td style={{ padding: "9px 12px", fontSize: 12, color: "#475569" }}>{x.avgUnitCost ?? "—"}</td>
              <td style={{ padding: "9px 12px", fontSize: 12, color: "#475569" }}>{x.lineValue ?? "—"}</td>
              <td style={{ padding: "9px 12px", fontSize: 12, color: "#475569" }}>{(x as any).notes || (x as any).note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StockTransferStatus }) {
  const map: Record<string, string> = {
    Draft:     "ob-badge--default",
    Submitted: "ob-badge--info",
    Approved:  "ob-badge--success",
    Rejected:  "ob-badge--danger",
    Posted:    "ob-badge--success",
    Reversed:  "ob-badge--warn",
    Cancelled: "ob-badge--warn",
  };
  return (
    <span className={`ob-badge ${map[String(status)] ?? "ob-badge--default"}`}>
      {String(status)}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StockTransferEditPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();
  const { id } = useParams<{ id: string }>();

  // ── State ─────────────────────────────────────────────────────────────────

  const [detail,     setDetail]     = useState<StockTransferDetailDto | null>(null);
  const [locations,  setLocations]  = useState<StockLocationDto[]>([]);
  const [items,      setItems]      = useState<ItemLookupDto[]>([]);
  const [uoms,       setUoms]       = useState<UomLookupDto[]>([]);

  // Refs hold the latest lookup data — prevents stale-state issues
  // when useMemo dependencies reference state set in the same batch.
  const itemsRef = useRef<ItemLookupDto[]>([]);
  const uomsRef  = useRef<UomLookupDto[]>([]);

  const [form, setForm] = useState<FormState>({
    fromLocationId: "", toLocationId: "", transferDate: "", reference: "", lines: [],
  });

  const [errors,     setErrors]     = useState<FieldErrors>({});
  const [msg,        setMsg]        = useState<Msg>(null);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [acting,     setActing]     = useState<null | "submit" | "cancel" | "post">(null);
  const [needsRemap, setNeedsRemap] = useState(false);

  // Ref guard — prevents double-submit before React re-renders busy state.
  const inFlight = useRef(false);

  const status   = useMemo(() => normalizeStatus(detail?.status), [detail]);
  const editable = canEdit(status);
  const busy     = loading || saving || acting !== null;

  // ── Derived options ───────────────────────────────────────────────────────

  const locationOptions = useMemo<SelectOption<string>[]>(
    () => locations.map(x => ({
      value: x.id,
      label: clean(x.name) || clean(x.code) || "Location",
    })),
    [locations]
  );

  const itemOptions = useMemo<SelectOption<string>[]>(
    () => itemsRef.current
      .filter(x => clean(x.id))
      .map(x => ({
        value: String(x.id),
        label: clean(x.label) ||
               `${clean(x.sku) || clean(x.code)} ${clean(x.name)}`.trim() ||
               clean(x.name) || "Item",
      })),
    [items]
  );

  const uomOptionsAll = useMemo<SelectOption<string>[]>(
    () => uomsRef.current
      .filter(x => clean(x.id))
      .map(x => ({ value: String(x.id), label: clean(x.name) || clean(x.code) || "UOM" })),
    [uoms]
  );

  const itemById = useMemo(
    () => new Map(itemsRef.current.map(it => [String(it.id), it])),
    [items]
  );

  const totals = useMemo(() => {
    if (!editable && detail) {
      return {
        qty:   Number(detail.totalQuantity ?? 0) || 0,
        lines: detail.items?.length ?? 0,
      };
    }
    return {
      qty:   form.lines.reduce((a, l) => a + (Number(l.qty) || 0), 0),
      lines: form.lines.length,
    };
  }, [editable, detail, form.lines]);

  const uomOptionsForLine = useCallback((inventoryItemId: string): SelectOption<string>[] => {
    const it      = inventoryItemId ? itemById.get(inventoryItemId) : undefined;
    const allowed = ((it as any)?.uoms ?? [])
      .map((u: any) => String(u.uomId))
      .filter(Boolean) as string[];

    if (allowed.length) {
      const set = new Set(allowed);
      return uomsRef.current
        .filter(u => set.has(String(u.id)))
        .map(u => ({ value: String(u.id), label: clean(u.name) || clean(u.code) || "UOM" }));
    }
    return uomOptionsAll;
  }, [itemById, uomOptionsAll]);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!companyId || !branchId || !id) return;
    setLoading(true);
    setMsg(null);
    try {
      const [d, locs, its, us] = await Promise.all([
        stockTransfersApi.get(companyId, branchId, id),
        listLocations(companyId, branchId),
        stockTransfersApi.listItems(companyId),
        stockTransfersApi.listUoms(companyId),
      ]);

      itemsRef.current = its;
      uomsRef.current  = us;

      const itemIdByCode      = new Map(its.map(it => [norm(it.code), String(it.id)]));
      const uomIdByCodeOrName = new Map<string, string>();
      us.forEach(u => {
        if (norm(u.code)) uomIdByCodeOrName.set(norm(u.code), String(u.id));
        if (norm(u.name)) uomIdByCodeOrName.set(norm(u.name), String(u.id));
      });

      const mappedLines: FormLine[] = (d.items ?? []).map((x: any) => {
        const mappedItemId =
          clean(x.inventoryItemId) ||
          clean(x.itemId) ||
          itemIdByCode.get(norm(x.itemCode)) || "";
        const mappedUnitId =
          clean(x.unitId) ||
          clean(x.uomId) ||
          uomIdByCodeOrName.get(norm(x.uom)) || "";
        return {
          id:              clean(x.id) || newKey(),
          inventoryItemId: mappedItemId,
          unitId:          mappedUnitId,
          qty:             Number(x.quantity) || 0,
          note:            clean(x.notes) || clean(x.note) || "",
          _itemCode:       clean(x.itemCode) || clean(x.sku),
          _itemName:       clean(x.itemName) || clean(x.name),
          _uomText:        clean(x.uom)      || clean(x.uomCode),
        };
      });

      setNeedsRemap(mappedLines.some(l => !clean(l.inventoryItemId) || !clean(l.unitId)));
      setDetail(d);
      setLocations(locs);
      setItems(its);
      setUoms(us);
      setForm({
        fromLocationId: clean(d.fromLocationId),
        toLocationId:   clean(d.toLocationId),
        transferDate:   isoToDateOnly(d.transferDateUtc),
        reference:      clean(d.reference),
        lines:          mappedLines,
      });
      setErrors({});
    } catch (e) {
      setMsg({ tone: "error", text: apiErr(e) });
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, id]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // ── Form mutation ─────────────────────────────────────────────────────────

  const updateHeader = useCallback((patch: Partial<FormState>) =>
    setForm(s => ({ ...s, ...patch })), []);

  const updateLine = useCallback((idx: number, patch: Partial<FormLine>) =>
    setForm(s => ({
      ...s,
      lines: s.lines.map((l, i) => i === idx ? { ...l, ...patch } : l),
    })), []);

  const addLine = useCallback(() =>
    setForm(s => ({
      ...s,
      lines: [...s.lines, { id: newKey(), inventoryItemId: "", unitId: "", qty: 1, note: "" }],
    })), []);

  const removeLine = useCallback((idx: number) =>
    setForm(s => ({ ...s, lines: s.lines.filter((_, i) => i !== idx) })), []);

  const onItemChange = useCallback((idx: number, inventoryItemId: string) => {
    const it          = inventoryItemId ? itemById.get(inventoryItemId) : undefined;
    const defaultUnit = clean((it as any)?.baseUomId) || clean(it?.defaultUomId) || "";
    updateLine(idx, { inventoryItemId, unitId: defaultUnit });
  }, [itemById, updateLine]);

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = useCallback((current: FormState): FieldErrors => {
    const e: FieldErrors = {};

    if (!clean(current.fromLocationId)) e.fromLocationId = "From location is required.";
    if (!clean(current.toLocationId))   e.toLocationId   = "To location is required.";
    if (clean(current.fromLocationId) && clean(current.toLocationId) &&
        current.fromLocationId === current.toLocationId) {
      e.toLocationId = "From and To locations must be different.";
    }
    if (!clean(current.transferDate)) e.transferDate = "Transfer date is required.";
    if (!current.lines.length)        e.lines        = "Add at least one line.";

    const lineErrors: NonNullable<FieldErrors["lineErrors"]> = {};
    current.lines.forEach((l, idx) => {
      const le: Partial<Record<keyof FormLine, string>> = {};
      if (!clean(l.inventoryItemId))              le.inventoryItemId = "Item is required.";
      if (!clean(l.unitId))                       le.unitId          = "UOM is required.";
      if (!Number.isFinite(l.qty) || l.qty <= 0) le.qty             = "Qty must be > 0.";
      // FIX: note is now required — highlights field in red when empty.
      if (!clean(l.note))                         le.note            = "Note is required.";
      if (Object.keys(le).length) lineErrors[idx] = le;
    });
    if (Object.keys(lineErrors).length) e.lineErrors = lineErrors;
    return e;
  }, []);

  const hasErrors = useCallback((e: FieldErrors) =>
    !!(e.fromLocationId || e.toLocationId || e.transferDate || e.lines ||
       (e.lineErrors && Object.keys(e.lineErrors).length)), []);

  // ── Save ──────────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (!companyId || !id || inFlight.current) return;
    setMsg(null);
    const e = validate(form);
    setErrors(e);
    if (hasErrors(e)) return;

    inFlight.current = true;
    setSaving(true);
    try {
      await stockTransfersApi.update(companyId, branchId, id, {
        companyId,
        fromLocationId:  form.fromLocationId,
        toLocationId:    form.toLocationId,
        reference:       clean(form.reference) || null,
        transferDateUtc: form.transferDate ? dateOnlyToUtcIso(form.transferDate) : null,
        items: form.lines.map(l => ({
          inventoryItemId: l.inventoryItemId,
          unitId:          l.unitId,
          quantity:        Number(l.qty),
          // FIX: was `clean(l.note) || null` — backend has [Required] on Notes,
          // null fails validation. Always send a string.
          notes:           clean(l.note) || "",
        })),
      } as any);
      await loadAll();
      setMsg({ tone: "success", text: "Saved." });
    } catch (e) {
      setMsg({ tone: "error", text: apiErr(e) });
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [companyId, branchId, id, form, validate, hasErrors, loadAll]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const doAction = useCallback(async (kind: "submit" | "cancel" | "post") => {
    if (!companyId || !id || inFlight.current) return;
    setMsg(null);

    if (kind === "submit") {
      const e = validate(form);
      setErrors(e);
      if (hasErrors(e)) {
        setMsg({ tone: "error", text: "Fix validation errors before submitting." });
        return;
      }
    }

    inFlight.current = true;
    setActing(kind);
    try {
      if (kind === "submit") {
        await stockTransfersApi.submit(companyId, branchId, id);
      } else if (kind === "cancel") {
        await stockTransfersApi.cancel(companyId, branchId, id);
      } else {
        await stockTransfersApi.post(companyId, branchId, id);
      }
      await loadAll();
      setMsg({ tone: "success", text: "Done." });
    } catch (e) {
      setMsg({ tone: "error", text: apiErr(e) });
    } finally {
      inFlight.current = false;
      setActing(null);
    }
  }, [companyId, branchId, id, form, validate, hasErrors, loadAll]);

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!companyId) return (
    <div className="ob-page">
      <div className="ob-alert ob-alert--warn">
        <span className="ob-alert__icon">⚠</span>
        <div><div className="ob-alert__title">No company selected</div></div>
      </div>
    </div>
  );
  if (!branchId) return (
    <div className="ob-page">
      <div className="ob-alert ob-alert--warn">
        <span className="ob-alert__icon">⚠</span>
        <div><div className="ob-alert__title">No branch selected</div></div>
      </div>
    </div>
  );
  if (!id) return (
    <div className="ob-page">
      <div className="ob-alert ob-alert--danger">
        <span className="ob-alert__icon">✕</span>
        <div><div className="ob-alert__title">Missing transfer ID</div></div>
      </div>
    </div>
  );

  const transferNo = clean(detail?.transferNumber);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ob-page">

      {/* Page header */}
      <div className="ob-page-header">
        <div>
          <div className="ob-page-title">
            Stock Transfer{transferNo ? ` — ${transferNo}` : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <StatusBadge status={status} />
            <span className={`ob-badge ${editable ? "ob-badge--warn" : "ob-badge--default"}`}>
              {editable ? "Editable" : "Read-only"}
            </span>
            {loading && <span style={{ fontSize: 12, color: "#64748b" }}>Loading…</span>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.06em", color: "#94a3b8" }}>
            Total qty
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a",
            letterSpacing: "-0.03em" }}>
            {totals.qty}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            Lines: <b>{totals.lines}</b>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {editable && needsRemap && (
        <div className="ob-alert ob-alert--warn">
          <span className="ob-alert__icon">⚠</span>
          <div>
            <div className="ob-alert__title">Item mapping incomplete</div>
            <div className="ob-alert__msg">
              Some rows could not be auto-mapped to Item / UOM IDs.
              Select Item and UOM for those rows, then Save.
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className={`ob-alert ob-alert--${
          msg.tone === "success" ? "ok"
          : msg.tone === "warn"  ? "warn"
          : msg.tone === "info"  ? "info"
          : "danger"}`}>
          <span className="ob-alert__icon">
            {msg.tone === "success" ? "✓" : msg.tone === "warn" ? "⚠" : msg.tone === "info" ? "i" : "✕"}
          </span>
          <div><div className="ob-alert__title">{msg.text}</div></div>
        </div>
      )}

      {/* Header card */}
      <div className="ob-card" style={{ marginBottom: 14 }}>
        {(detail || !loading) && (
          <div className="ob-card-header">
            <div className="ob-card-title">Transfer details</div>
            <div className="ob-card-subtitle">From / To location, date, and reference</div>
          </div>
        )}
        <div className="ob-card-body">
          {loading && !detail ? (
            <div style={{ padding: "12px 0", color: "#94a3b8", fontSize: 13 }}>
              Loading transfer…
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px 1fr", gap: 12 }}>

              <div className="ob-field">
                <label className="ob-label">
                  From location <span className="ob-label-req">*</span>
                </label>
                <select
                  className="ob-select"
                  style={errors.fromLocationId ? { borderColor: "#fca5a5" } : undefined}
                  value={form.fromLocationId || ""}
                  disabled={!editable || busy}
                  onChange={e => updateHeader({ fromLocationId: e.target.value || "" })}
                >
                  {!form.fromLocationId && <option value="" disabled>Select from…</option>}
                  {locationOptions
                    .filter(o => o.value !== form.toLocationId)
                    .map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {errors.fromLocationId && (
                  <span className="ob-hint" style={{ color: "#dc2626" }}>
                    {errors.fromLocationId}
                  </span>
                )}
              </div>

              <div className="ob-field">
                <label className="ob-label">
                  To location <span className="ob-label-req">*</span>
                </label>
                <select
                  className="ob-select"
                  style={errors.toLocationId ? { borderColor: "#fca5a5" } : undefined}
                  value={form.toLocationId || ""}
                  disabled={!editable || busy}
                  onChange={e => updateHeader({ toLocationId: e.target.value || "" })}
                >
                  {!form.toLocationId && <option value="" disabled>Select to…</option>}
                  {locationOptions
                    .filter(o => o.value !== form.fromLocationId)
                    .map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {errors.toLocationId && (
                  <span className="ob-hint" style={{ color: "#dc2626" }}>
                    {errors.toLocationId}
                  </span>
                )}
              </div>

              <div className="ob-field">
                <label className="ob-label">
                  Transfer date <span className="ob-label-req">*</span>
                </label>
                <input
                  className="ob-input"
                  style={errors.transferDate ? { borderColor: "#fca5a5" } : undefined}
                  type="date"
                  value={form.transferDate}
                  disabled={!editable || busy}
                  onChange={e => updateHeader({ transferDate: e.target.value })}
                />
                {errors.transferDate && (
                  <span className="ob-hint" style={{ color: "#dc2626" }}>
                    {errors.transferDate}
                  </span>
                )}
              </div>

              <div className="ob-field">
                <label className="ob-label">Reference</label>
                <input
                  className="ob-input"
                  value={form.reference}
                  disabled={!editable || busy}
                  onChange={e => updateHeader({ reference: e.target.value })}
                  placeholder="Optional"
                />
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Lines card */}
      <div className="ob-card" style={{ marginBottom: 70 }}>
        <div className="ob-card-header" style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div className="ob-card-title">{editable ? "Draft items" : "Items"}</div>
            <div className="ob-card-subtitle">
              {editable
                ? "Add, edit, or remove line items."
                : "Posted items — read-only."}
            </div>
          </div>
          {editable && (
            <button
              className="ob-btn ob-btn--primary"
              disabled={busy}
              onClick={addLine}
              style={{ minHeight: 34, padding: "0 14px", fontSize: 12 }}
            >
              + Add line
            </button>
          )}
        </div>

        <div className="ob-card-body">
          {loading && !detail ? (
            <div style={{ padding: "12px 0", color: "#94a3b8", fontSize: 13 }}>
              Loading items…
            </div>
          ) : !editable && detail ? (
            <ReadOnlyLinesTable items={detail.items} />
          ) : (
            <>
              {errors.lines && (
                <div className="ob-alert ob-alert--danger" style={{ marginBottom: 10 }}>
                  <span className="ob-alert__icon">✕</span>
                  <div><div className="ob-alert__title">{errors.lines}</div></div>
                </div>
              )}

              {form.lines.length === 0 ? (
                <div className="ob-empty">
                  <div className="ob-empty__title">No draft lines yet</div>
                  <div className="ob-empty__sub">Click "+ Add line" to add items.</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 1000, fontSize: 13, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Item *", "UOM *", "Qty *", "Note *", ""].map((h, i) => (
                          <th key={i} style={{
                            padding: "9px 10px", textAlign: "left", fontSize: 11,
                            fontWeight: 700, textTransform: "uppercase",
                            letterSpacing: "0.06em", color: "#64748b",
                            borderBottom: "1px solid var(--ob-slate-200)",
                            whiteSpace: "nowrap",
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {form.lines.map((l, idx) => {
                        const le      = errors.lineErrors?.[idx] ?? {};
                        const uomOpts = uomOptionsForLine(l.inventoryItemId);
                        const noteErr = !!le.note;
                        return (
                          <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9" }}>

                            {/* Item */}
                            <td style={{ padding: "8px 10px", minWidth: 260 }}>
                              <select
                                className="ob-select"
                                style={le.inventoryItemId ? { borderColor: "#fca5a5" } : undefined}
                                value={l.inventoryItemId || ""}
                                disabled={!editable || busy}
                                onChange={e => onItemChange(idx, e.target.value || "")}
                              >
                                {!l.inventoryItemId && (
                                  <option value="" disabled>
                                    {l._itemCode ? `Remap: ${l._itemCode}` : "Select item…"}
                                  </option>
                                )}
                                {itemOptions.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                              {le.inventoryItemId && (
                                <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>
                                  {le.inventoryItemId}
                                </div>
                              )}
                            </td>

                            {/* UOM */}
                            <td style={{ padding: "8px 10px", minWidth: 160 }}>
                              <select
                                className="ob-select"
                                style={le.unitId ? { borderColor: "#fca5a5" } : undefined}
                                value={l.unitId || ""}
                                disabled={!editable || busy || !l.inventoryItemId}
                                onChange={e => updateLine(idx, { unitId: e.target.value || "" })}
                              >
                                {!l.unitId && (
                                  <option value="" disabled>
                                    {l._uomText ? `Remap: ${l._uomText}` : "Select UOM…"}
                                  </option>
                                )}
                                {uomOpts.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                              {le.unitId && (
                                <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>
                                  {le.unitId}
                                </div>
                              )}
                            </td>

                            {/* Qty */}
                            <td style={{ padding: "8px 10px", minWidth: 100 }}>
                              <input
                                className="ob-input"
                                style={le.qty ? { borderColor: "#fca5a5" } : undefined}
                                type="number"
                                min={0}
                                step={0.01}
                                value={Number.isFinite(l.qty) ? l.qty : 0}
                                disabled={!editable || busy}
                                onChange={e => updateLine(idx, { qty: Number(e.target.value) })}
                              />
                              {le.qty && (
                                <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>
                                  {le.qty}
                                </div>
                              )}
                            </td>

                            {/* Note — required, highlighted red when empty */}
                            <td style={{ padding: "8px 10px", minWidth: 220 }}>
                              <input
                                className="ob-input"
                                style={noteErr ? {
                                  borderColor: "#fca5a5",
                                  background:  "#fff5f5",
                                  outline:     "none",
                                  boxShadow:   "0 0 0 2px rgba(239,68,68,.15)",
                                } : undefined}
                                value={l.note}
                                disabled={!editable || busy}
                                onChange={e => updateLine(idx, { note: e.target.value })}
                                placeholder="Required"
                              />
                              {noteErr && (
                                <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>
                                  {le.note}
                                </div>
                              )}
                            </td>

                            {/* Remove */}
                            <td style={{ padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                              <button
                                className="ob-btn ob-btn--danger"
                                style={{ minHeight: 30, padding: "0 10px", fontSize: 12 }}
                                disabled={!editable || busy}
                                onClick={() => removeLine(idx)}
                              >
                                Remove
                              </button>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      <div style={{
        position: "sticky", bottom: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 10,
        padding: "12px 16px", borderRadius: 14,
        border: "1px solid var(--ob-slate-200)",
        background: "rgba(255,255,255,.97)",
        backdropFilter: "blur(8px)",
        boxShadow: "0 -2px 12px -4px rgba(15,23,42,.1)",
      }}>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          <b>Workflow:</b> Draft → Submit → Approve → Post
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="ob-btn ob-btn--ghost"
            onClick={() => nav(-1)} disabled={busy}>
            Back
          </button>
          <button className="ob-btn ob-btn--ghost"
            onClick={loadAll} disabled={busy}>
            Refresh
          </button>
          <button className="ob-btn ob-btn--ghost"
            onClick={save} disabled={!editable || busy}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="ob-btn ob-btn--primary"
            onClick={() => doAction("submit")} disabled={!canSubmit(status) || busy}>
            {acting === "submit" ? "Submitting…" : "Submit"}
          </button>
          <button className="ob-btn ob-btn--ghost"
            onClick={() => doAction("cancel")} disabled={!canCancel(status) || busy}>
            {acting === "cancel" ? "Cancelling…" : "Cancel"}
          </button>
          <button className="ob-btn ob-btn--primary"
            onClick={() => doAction("post")} disabled={!canPost(status) || busy}>
            {acting === "post" ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

    </div>
  );
}