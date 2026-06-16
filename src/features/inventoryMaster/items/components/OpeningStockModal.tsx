// src/features/inventoryMaster/items/components/OpeningStockModal.tsx
//
// Modal for posting opening stock against a specific item.
// Loads available locations from the inventory locations endpoint,
// then dispatches to openingStockApi.post on confirm.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openingStockApi } from "../api/openingStockApi";
import { http }            from "../../../../api/http";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UomOption      { id: string; code: string; name: string; }
interface LocationLite   { id: string; name: string; }

interface Props {
  open:      boolean;
  onClose:   () => void;
  companyId: string;
  itemId:    string;
  itemName:  string;
  uoms:      UomOption[];
  baseUomId: string;
}

// ── Error helper ──────────────────────────────────────────────────────────────

function extractError(e: unknown, fallback: string): string {
  const err  = e as any;
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  return data?.message ?? err?.message ?? fallback;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OpeningStockModal({
  open, onClose, companyId, itemId, itemName, uoms, baseUomId,
}: Props) {
  const [locations,  setLocations]  = useState<LocationLite[]>([]);
  const [locationId, setLocationId] = useState("");
  const [qty,        setQty]        = useState("");
  const [uomId,      setUomId]      = useState(baseUomId);
  const [unitCost,   setUnitCost]   = useState("");
  const [asOfDate,   setAsOfDate]   = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [note,       setNote]       = useState("");
  const [saving,     setSaving]     = useState(false);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [saveError,  setSaveError]  = useState<string | null>(null);

  // Prevent double-submit
  const inFlight = useRef(false);

  const baseUom = useMemo(
    () => uoms.find(u => u.id === baseUomId),
    [uoms, baseUomId],
  );

  // Reset UOM selector when baseUomId changes (item changed on parent)
  useEffect(() => { setUomId(baseUomId); }, [baseUomId]);

  // Load locations when modal opens; cancel if it closes before response
  useEffect(() => {
    if (!open) return;
    setLoadError(null);
    let cancelled = false;

    http
      .get<LocationLite[]>("/inventory/locations", {
        params: { companyId, activeOnly: true },
      })
      .then(r => { if (!cancelled) setLocations(r.data ?? []); })
      .catch(e => { if (!cancelled) setLoadError(extractError(e, "Failed to load locations.")); });

    return () => { cancelled = true; };
  }, [open, companyId]);

  // Reset form fields each time the modal opens
  useEffect(() => {
    if (!open) return;
    setLocationId("");
    setQty("");
    setUomId(baseUomId);
    setUnitCost("");
    setAsOfDate(new Date().toISOString().slice(0, 10));
    setNote("");
    setSaveError(null);
  }, [open, baseUomId]);

  if (!open) return null;

  const parsedQty  = Number(qty);
  const canSave    =
    !!locationId &&
    !!uomId      &&
    !!asOfDate   &&
    qty.trim() !== "" &&
    Number.isFinite(parsedQty) &&
    parsedQty > 0;

  const submit = useCallback(async () => {
    if (!canSave || inFlight.current) return;
    inFlight.current = true;
    setSaveError(null);
    setSaving(true);

    try {
      const parsedCost = unitCost.trim() ? Number(unitCost) : null;
      if (parsedCost !== null && !Number.isFinite(parsedCost))
        throw new Error("Unit cost must be a valid number.");

      await openingStockApi.post({
        companyId,
        itemId,
        locationId,
        qty:      parsedQty,
        uomId,
        unitCost: parsedCost,
        asOfDate: new Date(asOfDate).toISOString(),
        note:     note.trim() || null,
      });

      onClose();
    } catch (e) {
      setSaveError(extractError(e, "Failed to post opening stock."));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [
    canSave, companyId, itemId, locationId, parsedQty,
    uomId, unitCost, asOfDate, note, onClose,
  ]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="inv-modal-overlay">
      <div className="inv-modal">

        {/* ── Header ── */}
        <div className="inv-modal__head">
          <div className="inv-modal__title">Add Opening Stock</div>
          <div className="inv-modal__subtitle">
            Item: <strong>{itemName}</strong>
            {baseUom && (
              <> &bull; Base UOM: <strong>{baseUom.code}</strong></>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="inv-modal__body">

          {loadError && (
            <div className="inv-alert inv-alert--warn" style={{ marginBottom: 14 }}>
              ⚠ {loadError}
            </div>
          )}

          {saveError && (
            <div className="inv-alert inv-alert--error" style={{ marginBottom: 14 }}>
              {saveError}
            </div>
          )}

          <div className="inv-modal__grid">

            {/* Location */}
            <div>
              <label className="inv-modal-label">Location *</label>
              <select
                className="inv-input"
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
                disabled={saving}
              >
                <option value="">Select location…</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* As of date */}
            <div>
              <label className="inv-modal-label">As of date *</label>
              <input
                type="date"
                className="inv-input"
                value={asOfDate}
                onChange={e => setAsOfDate(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="inv-modal-label">Quantity *</label>
              <input
                type="number"
                className="inv-input"
                min={0.0001}
                step="0.0001"
                inputMode="decimal"
                value={qty}
                placeholder="0.0000"
                onChange={e => setQty(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Unit */}
            <div>
              <label className="inv-modal-label">Unit *</label>
              <select
                className="inv-input"
                value={uomId}
                onChange={e => setUomId(e.target.value)}
                disabled={saving}
              >
                {uoms.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit cost */}
            <div className="full">
              <label className="inv-modal-label">Unit cost (optional)</label>
              <input
                type="number"
                className="inv-input"
                min={0}
                step="0.000001"
                inputMode="decimal"
                value={unitCost}
                placeholder="0.000000"
                onChange={e => setUnitCost(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Note */}
            <div className="full">
              <label className="inv-modal-label">Note (optional)</label>
              <textarea
                className="inv-input"
                value={note}
                onChange={e => setNote(e.target.value)}
                disabled={saving}
                style={{ height: 80, resize: "vertical", paddingTop: 8, paddingBottom: 8 }}
              />
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="inv-modal__foot">
          <button
            className="inv-btn inv-btn--outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="inv-btn inv-btn--primary"
            onClick={submit}
            disabled={!canSave || saving}
          >
            {saving ? "Saving…" : "Post opening stock"}
          </button>
        </div>

      </div>
    </div>
  );
}