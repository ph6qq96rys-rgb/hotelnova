// src/features/inventory/items/components/OpeningStockModal.tsx

import { useEffect, useMemo, useState } from "react";
import { openingStockApi } from "../api/openingStockApi";
import { http } from "../../../../api/http";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Uom          { id: string; code: string; name: string; }
interface LocationLite { id: string; name: string; }

interface Props {
  open:       boolean;
  onClose:    () => void;
  companyId:  string;
  itemId:     string;
  itemName:   string;
  uoms:       Uom[];
  baseUomId:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractError(e: unknown, fallback: string): string {
  const err  = e as any;
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  return data?.message ?? err?.message ?? fallback;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OpeningStockModal({ open, onClose, companyId, itemId, itemName, uoms, baseUomId }: Props) {
  const [locations,   setLocations]   = useState<LocationLite[]>([]);
  const [locationId,  setLocationId]  = useState("");
  const [qty,         setQty]         = useState<number>(0);
  const [uomId,       setUomId]       = useState(baseUomId);
  const [unitCost,    setUnitCost]    = useState<number | "">("");
  const [asOfDate,    setAsOfDate]    = useState(() => new Date().toISOString().slice(0, 10));
  const [note,        setNote]        = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const baseUom = useMemo(() => uoms.find((u) => u.id === baseUomId), [uoms, baseUomId]);

  // Reset UOM when baseUomId changes.
  useEffect(() => { setUomId(baseUomId); }, [baseUomId]);

  // Load locations when modal opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    http
      .get<LocationLite[]>("/inventory/locations", { params: { companyId, activeOnly: true } })
      .then((r) => setLocations(r.data ?? []))
      .catch((e) => setError(extractError(e, "Failed to load locations.")));
  }, [open, companyId]);

  if (!open) return null;

  const canSave = !!locationId && qty > 0 && !!uomId && !!asOfDate;

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await openingStockApi.post({
        companyId,
        itemId,
        locationId,
        qty,
        uomId,
        unitCost: unitCost === "" ? null : unitCost,
        asOfDate: new Date(asOfDate).toISOString(),
        note: note || null,
      });
      onClose();
    } catch (e) {
      setError(extractError(e, "Failed to post opening stock."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inv-modal-overlay">
      <div className="inv-modal">
        {/* Header */}
        <div className="inv-modal__head">
          <div className="inv-modal__title">Add Opening Stock</div>
          <div className="inv-modal__subtitle">
            Item: <strong>{itemName}</strong>
            {baseUom ? <> &bull; Base UOM: <strong>{baseUom.code}</strong></> : null}
          </div>
        </div>

        {/* Body */}
        <div className="inv-modal__body">
          {error && (
            <div className="inv-alert inv-alert--error" style={{ marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div className="inv-modal__grid">
            {/* Location */}
            <div>
              <label className="inv-modal-label">Location *</label>
              <select
                className="inv-input"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={saving}
              >
                <option value="">Select location</option>
                {locations.map((l) => (
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
                onChange={(e) => setAsOfDate(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="inv-modal-label">Quantity *</label>
              <input
                type="number"
                className="inv-input"
                min={0}
                step="0.0001"
                value={qty === 0 ? "" : String(qty)}
                onChange={(e) => setQty(Number(e.target.value))}
                disabled={saving}
              />
            </div>

            {/* UOM */}
            <div>
              <label className="inv-modal-label">Unit *</label>
              <select
                className="inv-input"
                value={uomId}
                onChange={(e) => setUomId(e.target.value)}
                disabled={saving}
              >
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
                ))}
              </select>
            </div>

            {/* Unit cost */}
            <div className="full">
              <label className="inv-modal-label">Unit Cost (optional)</label>
              <input
                type="number"
                className="inv-input"
                min={0}
                step="0.0001"
                value={unitCost === "" ? "" : String(unitCost)}
                onChange={(e) => setUnitCost(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={saving}
                placeholder="0.0000"
              />
            </div>

            {/* Note */}
            <div className="full">
              <label className="inv-modal-label">Note (optional)</label>
              <textarea
                className="inv-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={saving}
                style={{ height: 80, resize: "vertical", paddingTop: 8, paddingBottom: 8 }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="inv-modal__foot">
          <button className="inv-btn inv-btn--outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="inv-btn inv-btn--primary" onClick={submit} disabled={!canSave || saving}>
            {saving ? "Saving…" : "Post Opening Stock"}
          </button>
        </div>
      </div>
    </div>
  );
}