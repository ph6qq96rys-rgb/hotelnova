import { useEffect, useMemo, useState } from "react";
import { openingStockApi } from "../api/openingStockApi";
import { http } from "../../../../api/http";

type Uom = { id: string; code: string; name: string };
type LocationLite = { id: string; name: string };

export default function OpeningStockModal(props: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  itemId: string;
  itemName: string;
  uoms: Uom[];
  baseUomId: string;
}) {
  const { open, onClose, companyId, itemId, itemName, uoms, baseUomId } = props;

  const [locations, setLocations] = useState<LocationLite[]>([]);
  const [locationId, setLocationId] = useState("");
  const [qty, setQty] = useState<number>(0);
  const [uomId, setUomId] = useState<string>(baseUomId);
  const [unitCost, setUnitCost] = useState<number | "">("");
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUom = useMemo(() => uoms.find(u => u.id === baseUomId), [uoms, baseUomId]);

  useEffect(() => {
    if (!open) return;

    // Assuming you already have locations endpoint (name only shown in UI)
    // Example: GET /api/inventory/locations?companyId=...
    http
      .get<LocationLite[]>("/api/inventory/locations", { params: { companyId, activeOnly: true } })
      .then(r => setLocations(r.data))
      .catch(e => setError(e?.message ?? "Failed to load locations"));
  }, [open, companyId]);

  if (!open) return null;

  const canSave =
    !!locationId &&
    qty > 0 &&
    !!uomId &&
    !!asOfDate;

  const submit = async () => {
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
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? "Failed to post opening stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-base font-bold text-slate-900">Add Opening Stock</div>
          <div className="text-xs text-slate-500">
            Item: <span className="font-semibold">{itemName}</span>
            {baseUom ? <> • Base UOM: <span className="font-semibold">{baseUom.code}</span></> : null}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {String(error)}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="label">Location</div>
              <select className="input" value={locationId} onChange={e => setLocationId(e.target.value)}>
                <option value="">Select location</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="label">As of date</div>
              <input className="input" type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
            </div>

            <div>
              <div className="label">Quantity</div>
              <input
                className="input"
                type="number"
                min={0}
                step="0.0001"
                value={String(qty)}
                onChange={e => setQty(Number(e.target.value))}
              />
            </div>

            <div>
              <div className="label">Unit</div>
              <select className="input" value={uomId} onChange={e => setUomId(e.target.value)}>
                {uoms.map(u => (
                  <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="label">Unit Cost (optional)</div>
              <input
                className="input"
                type="number"
                min={0}
                step="0.0001"
                value={unitCost === "" ? "" : String(unitCost)}
                onChange={e => setUnitCost(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>

            <div className="md:col-span-2">
              <div className="label">Note (optional)</div>
              <textarea className="input min-h-[90px]" value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!canSave || saving}>
            {saving ? "Saving…" : "Post Opening Stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
