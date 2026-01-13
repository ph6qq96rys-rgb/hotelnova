import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import LocationSelect from "../components/LocationSelect";
import { SelectDropdown, type SelectOption } from "../../../../components/controls/SelectDropdown";

import { stockTransfersApi } from "../api/stockTransfersApi";
import { inventoryItemsApi } from "../../../inventoryMaster/items/api/inventoryItemsApi";
import { lookupsApi } from "../../../inventoryMaster/lookups/api/lookupsApi";
import type { UomDto, InventoryItemDto } from "../../../inventoryMaster/items/types";
import { useAppScope } from "../../../../app/useAppScope";

/** ================= Types ================= */
type DraftLine = {
  tempId: string;
  inventoryItemId: string | null;
  unitId: string | null;
  quantity: number;
  notes: string; // UI-only; send null when empty
};

type TouchedHeader = { from?: boolean; to?: boolean; date?: boolean };
type FieldErrors = { from?: string; to?: string; date?: string };

type LineTouched = { item?: boolean; unit?: boolean; qty?: boolean };
type LineErrors = { item?: string; unit?: string; qty?: string };

const newTempId = () => crypto.randomUUID();

export default function StockTransferCreatePage() {
  const nav = useNavigate();

  // TODO: replace with AppScope/context later
  const {companyId} =useAppScope();// localStorage.getItem("company_id") ?? "";

  /** ===== Header ===== */
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [transferDate, setTransferDate] = useState<Date>(() => new Date());
  const [reference, setReference] = useState("");

  /** ===== UI state ===== */
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** ===== Touched ===== */
  const [touched, setTouched] = useState<TouchedHeader>({});
  const [touchedLines, setTouchedLines] = useState<Record<string, LineTouched>>({});

  /** ===== Lookups ===== */
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [units, setUnits] = useState<UomDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [unitsLoading, setUnitsLoading] = useState(true);

  /** ===== Lines ===== */
  const [lines, setLines] = useState<DraftLine[]>([]);

  /**============Helper======================= */
function unwrapList<T>(res: any): T[] {
  const d = res?.data ?? res; // axios or raw

  if (Array.isArray(d)) return d;

  // common shapes
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.results)) return d.results;
  if (Array.isArray(d?.value)) return d.value; // some APIs use "value"

  // fallback: nothing usable
  return [];
}

  /** ================= Validation ================= */
  const fieldErrors: FieldErrors = useMemo(() => {
    const e: FieldErrors = {};
    if (!fromLocationId) e.from = "From location is required.";
    if (!toLocationId) e.to = "To location is required.";
    if (fromLocationId && toLocationId && fromLocationId === toLocationId) {
      e.to = "To location must be different from From location.";
    }
    if (!transferDate) e.date = "Transfer date is required.";
    return e;
  }, [fromLocationId, toLocationId, transferDate]);

  const validateLine = (l: DraftLine): LineErrors => {
    const e: LineErrors = {};
    if (!l.inventoryItemId) e.item = "Item is required.";
    if (!l.unitId) e.unit = "Unit is required.";
    if (!Number.isFinite(l.quantity) || l.quantity <= 0) e.qty = "Quantity must be greater than 0.";
    return e;
  };

  const hasLineErrors = useMemo(() => {
    if (lines.length === 0) return true;
    return lines.some((l) => {
      const e = validateLine(l);
      return Boolean(e.item || e.unit || e.qty);
    });
  }, [lines]);

  const canCreate =
    Boolean(companyId) &&
    !busy &&
    !itemsLoading &&
    !unitsLoading &&
    !fieldErrors.from &&
    !fieldErrors.to &&
    !fieldErrors.date &&
    lines.length > 0 &&
    !hasLineErrors;

  /** ================= Load lookups ================= */
  useEffect(() => {
  let alive = true;
  async function loadLookups() {
    if (!companyId) {
      if (!alive) return;
      setItems([]);
      setUnits([]);
      setItemsLoading(false);
      setUnitsLoading(false);
      setSubmitError("companyId is missing (localStorage).");
      return;
    }

    setSubmitError(null);
    setItemsLoading(true);
    setUnitsLoading(true);

    try {
      const [itemsRes, unitsRes] = await Promise.all([
        inventoryItemsApi.list(companyId),
        lookupsApi.uoms(companyId),
      ]);

      if (!alive) return;

      const itemsData = unwrapList<InventoryItemDto>(itemsRes);
      const unitsData = unwrapList<UomDto>(unitsRes);

      setItems(itemsData);
      setUnits(unitsData);

      // 🔍 quick visibility while debugging
      if (itemsData.length === 0 || unitsData.length === 0) {
        console.log("LOOKUPS RAW:", { itemsRes, unitsRes });
        console.log("LOOKUPS UNWRAPPED:", { itemsData, unitsData });
      }
    } catch (e: any) {
      if (!alive) return;
      setSubmitError(e?.response?.data?.title ?? e?.message ?? "Failed to load Items / Units");
    } finally {
      if (!alive) return;
      setItemsLoading(false);
      setUnitsLoading(false);
    }
  }

  loadLookups();
  return () => {
    alive = false;
  };
}, [companyId]);


  /** ================= Options ================= */
  const itemOptions: SelectOption<string>[] = useMemo(
  () => items.map((x) => ({ value: x.id, label: x.name })),
  [items]
);

const unitOptions: SelectOption<string>[] = useMemo(
  () => units.map((x) => ({ value: x.id, label: x.name })),
  [units]
);


  /** ================= Line helpers ================= */
  const addLine = () => {
    const id = newTempId();
    setLines((prev) => [
      ...prev,
      { tempId: id, inventoryItemId: null, unitId: null, quantity: 1, notes: "" },
    ]);
    setTouchedLines((prev) => ({ ...prev, [id]: {} }));
  };

  const removeLine = (tempId: string) => {
    setLines((prev) => prev.filter((x) => x.tempId !== tempId));
    setTouchedLines((prev) => {
      const copy = { ...prev };
      delete copy[tempId];
      return copy;
    });
  };

  const updateLine = (tempId: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.tempId === tempId ? { ...l, ...patch } : l)));
  };

  const touchLine = (tempId: string, patch: Partial<LineTouched>) => {
    setTouchedLines((prev) => ({
      ...prev,
      [tempId]: { ...(prev[tempId] ?? {}), ...patch },
    }));
  };

  const markAllTouched = () => {
    setTouched({ from: true, to: true, date: true });
    setTouchedLines((prev) => {
      const next = { ...prev };
      for (const l of lines) next[l.tempId] = { item: true, unit: true, qty: true };
      return next;
    });
  };

  /** ================= Submit ================= */
  const onCreateDraftAndContinue = async () => {
    setSubmitError(null);
    markAllTouched();

    if (!companyId) return;

    if (!canCreate) {
      if (lines.length === 0) setSubmitError("Add at least one line item.");
      return;
    }

    setBusy(true);
    try {
      const body = {
        companyId,
        fromLocationId,
        toLocationId,
        requestedAtUtc: transferDate.toISOString(),
        notes: reference.trim() ? reference.trim() : null,
        lines: lines.map((l) => ({
          inventoryItemId: l.inventoryItemId!,
          quantity: Number(l.quantity),
          unitId: l.unitId!,
          notes: l.notes.trim() ? l.notes.trim() : null,
        })),
      };

      const id = await stockTransfersApi.create(companyId, body);
      nav(`/inventory/stock-transfers/${id}/edit`);
    } catch (e: any) {
      const data = e?.response?.data;
      const msg =
        data?.title ??
        (data?.errors
          ? Object.entries(data.errors)
              .map(([k, v]: any) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
              .join(" | ")
          : null) ??
        e?.message ??
        "Failed to create draft";

      setSubmitError(msg);
    } finally {
      setBusy(false);
    }
  };

  /** ================= Render ================= */
  return (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <h2 style={{ marginBottom: 12 }}>Create Stock Transfer</h2>

      {submitError && (
        <div style={{ marginBottom: 12, color: "#b91c1c", fontSize: 13 }}>{submitError}</div>
      )}

      {/* ---------- Header ---------- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <LocationSelect
            label="From Location (Branch)"
            value={fromLocationId}
            onChange={(v: string | null) => {
              if (!v) return;
              setFromLocationId(v);
              setTouched((t) => ({ ...t, from: true }));
            }}
            placeholder="Select branch…"
            excludeId={toLocationId}
          />
          {touched.from && fieldErrors.from && (
            <div className="mt-1 text-xs text-rose-600">{fieldErrors.from}</div>
          )}
        </div>

        <div>
          <LocationSelect
            label="To Location (Branch)"
            value={toLocationId}
            onChange={(v: string | null) => {
              if (!v) return;
              setToLocationId(v);
              setTouched((t) => ({ ...t, to: true }));
            }}
            placeholder="Select branch…"
            excludeId={fromLocationId}
          />
          {touched.to && fieldErrors.to && (
            <div className="mt-1 text-xs text-rose-600">{fieldErrors.to}</div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Transfer Date</label>
          <input
            type="date"
            value={transferDate.toISOString().slice(0, 10)}
            onChange={(e) => {
              const [y, m, d] = e.target.value.split("-").map(Number);
              setTransferDate(new Date(Date.UTC(y, m - 1, d)));
              setTouched((t) => ({ ...t, date: true }));
            }}
            style={inputStyle}
          />
          {touched.date && fieldErrors.date && (
            <div className="mt-1 text-xs text-rose-600">{fieldErrors.date}</div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Notes (optional)</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional…"
            style={inputStyle}
          />
        </div>
      </div>

      <hr style={{ margin: "18px 0" }} />

      {/* ---------- Lines ---------- */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Line Items</h3>
        <button type="button" onClick={addLine} disabled={busy} style={btnStyle}>
          + Add Line
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        {lines.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            No line items. Add at least one item to create the draft.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {lines.map((l, idx) => {
              const t = touchedLines[l.tempId] ?? {};
              const e = validateLine(l);

              return (
                <div key={l.tempId} style={lineCard}>
                  {/* Item */}
                  <div>
                    <SelectDropdown<string>
                      label={`Item ${idx + 1}`}
                      value={l.inventoryItemId}
                      options={itemOptions}
                      placeholder="Select item…"
                      loading={itemsLoading}
                      onChange={(inventoryItemId) => {
                        updateLine(l.tempId, { inventoryItemId });
                        touchLine(l.tempId, { item: true });
                      }}
                    />
                    {t.item && e.item && <div className="mt-1 text-xs text-rose-600">{e.item}</div>}
                  </div>

                  {/* Unit */}
                  <div>
                    <SelectDropdown<string>
                      label="Unit (UOM)"
                      value={l.unitId}
                      options={unitOptions}
                      placeholder="Select unit…"
                      loading={unitsLoading}
                      onChange={(unitId) => {
                        updateLine(l.tempId, { unitId });
                        touchLine(l.tempId, { unit: true });
                      }}
                    />
                    {t.unit && e.unit && <div className="mt-1 text-xs text-rose-600">{e.unit}</div>}
                  </div>

                  {/* Quantity */}
                  <div>
                    <label style={labelStyle}>Quantity</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      value={Number.isFinite(l.quantity) ? l.quantity : 0}
                      onChange={(ev) => {
                        updateLine(l.tempId, { quantity: Number(ev.target.value) });
                        touchLine(l.tempId, { qty: true });
                      }}
                      style={inputStyle}
                    />
                    {t.qty && e.qty && <div className="mt-1 text-xs text-rose-600">{e.qty}</div>}
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={labelStyle}>Notes (optional)</label>
                    <input
                      value={l.notes}
                      onChange={(ev) => updateLine(l.tempId, { notes: ev.target.value })}
                      placeholder="Optional…"
                      style={inputStyle}
                    />
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeLine(l.tempId)}
                    style={{ ...btnStyle, height: 42 }}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <hr style={{ margin: "18px 0" }} />

      {/* ---------- Actions ---------- */}
      <button
        type="button"
        onClick={onCreateDraftAndContinue}
        disabled={!canCreate}
        style={primaryBtn(canCreate)}
      >
        {busy ? "Creating…" : "Create Draft & Continue"}
      </button>

      {!canCreate && (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          {fieldErrors.from ||
            fieldErrors.to ||
            fieldErrors.date ||
            (lines.length === 0
              ? "Add at least one line item."
              : hasLineErrors
              ? "Fix line item errors."
              : "")}
        </div>
      )}
    </div>
  );
}

/** ===== Small inline styles (keeps your GRN-like look) ===== */
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  opacity: 0.75,
  marginBottom: 6,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  width: "100%",
  background: "white",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "white",
  cursor: "pointer",
};

const lineCard: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gridTemplateColumns: "2fr 1.5fr 1fr 2fr auto",
  gap: 10,
  alignItems: "end",
};

const primaryBtn = (enabled: boolean): React.CSSProperties => ({
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.15)",
  background: enabled ? "white" : "rgba(0,0,0,0.05)",
  cursor: enabled ? "pointer" : "not-allowed",
  fontWeight: 700,
});
