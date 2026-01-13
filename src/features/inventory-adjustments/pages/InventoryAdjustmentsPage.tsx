import { useEffect, useMemo, useRef, useState } from "react";
import { usePageMeta } from "../../../hooks/usePageMeta";
import { useInventoryAdjustment } from "../useInventoryAdjustment";
import { useAppScope } from "../../../app/useAppScope";
import type { CreateInventoryAdjustmentDto } from "../types";
import { http } from "../../../api/http"; // adjust path if needed

type AdjustmentType = "COUNT" | "WASTE" | "DAMAGE" | "VARIANCE";

const ADJUSTMENT_TYPES: {
  value: AdjustmentType;
  title: string;
  subtitle: string;
  badge?: string;
}[] = [
  { value: "COUNT", title: "Stock Count", subtitle: "Set on-hand quantities based on physical count.", badge: "Most used" },
  { value: "WASTE", title: "Waste", subtitle: "Expired, spoilage, kitchen waste." },
  { value: "DAMAGE", title: "Damage", subtitle: "Broken / damaged items written off." },
  { value: "VARIANCE", title: "Variance", subtitle: "Manual correction after investigation." },
];

type CatalogItem = { id: string; name: string; sku?: string; baseUnit?: string; allowedUnits?: string[] };
type CatalogLocation = { id: string; name: string };

type LineUI = {
  _rowId: string;
  inventoryItemId: string; // internal only
  inventoryItemLabel: string;
  locationId: string; // internal only
  locationLabel: string;
  quantity: number;
  unit: string;
  note?: string;
};

function uid() {
  return Math.random().toString(16).slice(2);
}

function debounce<T extends (...args: any[]) => void>(fn: T, waitMs: number) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), waitMs);
  };
}

async function searchItems(companyId: string, q: string): Promise<CatalogItem[]> {
  // Swap to your real endpoint when ready
  const r = await http.get<CatalogItem[]>("/api/inventory-master/items/search", {
    params: { companyId, q, limit: 20 },
  });
  return r.data ?? [];
}

async function searchLocations(companyId: string, q: string): Promise<CatalogLocation[]> {
  // Swap to your real endpoint when ready
  const r = await http.get<CatalogLocation[]>("/api/inventory/locations/search", {
    params: { companyId, q, limit: 20, activeOnly: true },
  });
  return r.data ?? [];
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "3px 10px",
        borderRadius: 999,
        background: "rgba(15, 23, 42, 0.06)",
        color: "#0f172a",
        fontWeight: 700,
        lineHeight: "18px",
      }}
    >
      {children}
    </span>
  );
}

function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{title}</div>
        {subtitle ? <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{subtitle}</div> : null}
      </div>
      {right ? <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{right}</div> : null}
    </div>
  );
}

function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 14,
        zIndex: 60,
      }}
      onMouseDown={onClose}
    >
      <div
        className="card"
        style={{ width: "min(840px, 96vw)", maxHeight: "88vh", overflow: "auto" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <CardHeader
          title={title}
          subtitle={subtitle}
          right={
            <button className="btn" onClick={onClose}>
              Close
            </button>
          }
        />
        <div className="p-4 md:p-5">{children}</div>
      </div>
    </div>
  );
}

export default function InventoryAdjustmentsPage() {
  const { companyId } = useAppScope(); // only for lookup/search; NOT sent in dto
  usePageMeta({
    title: "Inventory Adjustments",
    subtitle: "Stock count, waste, damage & variance",
  });

  const { submit, loading } = useInventoryAdjustment();

  const [type, setType] = useState<AdjustmentType>("COUNT");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<LineUI[]>([
    {
      _rowId: uid(),
      inventoryItemId: "",
      inventoryItemLabel: "",
      locationId: "",
      locationLabel: "",
      quantity: 1,
      unit: "pcs",
      note: "",
    },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Picker state
  const [pickItemRowId, setPickItemRowId] = useState<string | null>(null);
  const [pickLocRowId, setPickLocRowId] = useState<string | null>(null);

  const [itemQ, setItemQ] = useState("");
  const [itemRes, setItemRes] = useState<CatalogItem[]>([]);
  const [itemSearching, setItemSearching] = useState(false);

  const [locQ, setLocQ] = useState("");
  const [locRes, setLocRes] = useState<CatalogLocation[]>([]);
  const [locSearching, setLocSearching] = useState(false);

  const typeHint = useMemo(() => ADJUSTMENT_TYPES.find((t) => t.value === type)?.subtitle ?? "", [type]);

  const totals = useMemo(() => {
    const linesCount = lines.length;
    const missingItem = lines.filter((l) => !l.inventoryItemId).length;
    const missingLoc = lines.filter((l) => !l.locationId).length;
    const zeroQty = lines.filter((l) => !Number.isFinite(l.quantity) || l.quantity === 0).length;
    return { linesCount, missingItem, missingLoc, zeroQty };
  }, [lines]);

  const issues = useMemo(() => {
    const list: string[] = [];
    if (type !== "COUNT" && !reason.trim()) list.push("Reason is required for Waste/Damage/Variance.");
    lines.forEach((l, i) => {
      if (!l.inventoryItemId) list.push(`Line ${i + 1}: Select an item.`);
      if (!l.locationId) list.push(`Line ${i + 1}: Select a location.`);
      if (!Number.isFinite(l.quantity) || l.quantity === 0) list.push(`Line ${i + 1}: Quantity must not be 0.`);
      if (!l.unit) list.push(`Line ${i + 1}: Select a unit.`);
    });
    return list;
  }, [lines, reason, type]);

  const canSubmit = useMemo(() => issues.length === 0 && lines.length > 0, [issues, lines.length]);

  const debouncedItemSearch = useRef(
    debounce(async (q: string) => {
      if (!companyId) return;
      if (!q.trim()) {
        setItemRes([]);
        return;
      }
      setItemSearching(true);
      try {
        setItemRes(await searchItems(companyId, q.trim()));
      } catch {
        setItemRes([]);
      } finally {
        setItemSearching(false);
      }
    }, 250)
  ).current;

  useEffect(() => {
    if (pickItemRowId) debouncedItemSearch(itemQ);
  }, [itemQ, pickItemRowId, debouncedItemSearch]);

  const debouncedLocSearch = useRef(
    debounce(async (q: string) => {
      if (!companyId) return;
      if (!q.trim()) {
        setLocRes([]);
        return;
      }
      setLocSearching(true);
      try {
        setLocRes(await searchLocations(companyId, q.trim()));
      } catch {
        setLocRes([]);
      } finally {
        setLocSearching(false);
      }
    }, 250)
  ).current;

  useEffect(() => {
    if (pickLocRowId) debouncedLocSearch(locQ);
  }, [locQ, pickLocRowId, debouncedLocSearch]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        _rowId: uid(),
        inventoryItemId: "",
        inventoryItemLabel: "",
        locationId: "",
        locationLabel: "",
        quantity: 1,
        unit: "pcs",
        note: "",
      },
    ]);
  }

  function removeLine(rowId: string) {
    setLines((prev) => prev.filter((x) => x._rowId !== rowId));
  }

  function updateLine(rowId: string, patch: Partial<LineUI>) {
    setLines((prev) => prev.map((x) => (x._rowId === rowId ? { ...x, ...patch } : x)));
  }

  function pickItem(rowId: string, it: CatalogItem) {
    const baseUnit = it.baseUnit?.trim();
    const allowed = it.allowedUnits?.length ? it.allowedUnits : baseUnit ? [baseUnit] : [];
    updateLine(rowId, {
      inventoryItemId: it.id,
      inventoryItemLabel: it.sku ? `${it.name} (${it.sku})` : it.name,
      unit: allowed[0] ?? "pcs",
    });
    setPickItemRowId(null);
    setItemQ("");
    setItemRes([]);
  }

  function pickLocation(rowId: string, loc: CatalogLocation) {
    updateLine(rowId, { locationId: loc.id, locationLabel: loc.name });
    setPickLocRowId(null);
    setLocQ("");
    setLocRes([]);
  }

  async function onSubmit() {
    setError(null);
    setSuccess(null);

    if (!canSubmit) {
      setError(issues[0] ?? "Please complete required fields.");
      return;
    }

    // IMPORTANT: do NOT send companyId/branchId from UI
    const dto: CreateInventoryAdjustmentDto = {
      type,
      reason: reason.trim(),
      lines: lines.map((l) => ({
        inventoryItemId: l.inventoryItemId,
        locationId: l.locationId,
        quantity: l.quantity,
        unit: l.unit,
        note: l.note?.trim() || undefined,
      })),
    } as any;

    try {
      await submit(dto);
      setSuccess("Adjustment submitted successfully.");
      setReason("");
      setLines([
        {
          _rowId: uid(),
          inventoryItemId: "",
          inventoryItemLabel: "",
          locationId: "",
          locationLabel: "",
          quantity: 1,
          unit: "pcs",
          note: "",
        },
      ]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit adjustment.");
    }
  }

  return (
    <div className="page" style={{ display: "grid", gap: 12 }}>
      {/* Top Summary / Header */}
      <div className="card">
        <CardHeader
          title="Inventory Adjustment"
          subtitle="Record stock count, waste, damage, and variance — no IDs needed."
          right={
            <>
              <Pill>{type}</Pill>
              <button className="btn btn-primary" disabled={loading || !canSubmit} onClick={onSubmit}>
                {loading ? "Submitting..." : "Submit"}
              </button>
            </>
          }
        />

        <div className="p-4 md:p-5" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>Lines</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{totals.linesCount}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>Missing item</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{totals.missingItem}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>Missing location</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{totals.missingLoc}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>Zero quantity</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{totals.zeroQty}</div>
          </div>
        </div>

        {(error || success) && (
          <div className="p-4 md:p-5" style={{ paddingTop: 0 }}>
            {error ? <div className="alert alert-danger">{error}</div> : null}
            {success ? <div className="alert alert-success">{success}</div> : null}
          </div>
        )}
      </div>

      {/* Type Selection (Card Grid) */}
      <div className="card">
        <CardHeader title="Adjustment Type" subtitle={typeHint} />
        <div className="p-4 md:p-5" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {ADJUSTMENT_TYPES.map((t) => {
            const selected = t.value === type;
            return (
              <button
                key={t.value}
                className="card"
                type="button"
                onClick={() => setType(t.value)}
                disabled={loading}
                style={{
                  textAlign: "left",
                  padding: 14,
                  cursor: loading ? "not-allowed" : "pointer",
                  border: selected ? "2px solid rgba(15,23,42,0.22)" : "1px solid rgba(15,23,42,0.08)",
                  background: selected ? "rgba(15,23,42,0.03)" : "white",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>{t.title}</div>
                  {t.badge ? <Pill>{t.badge}</Pill> : null}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {t.subtitle}
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-4 md:p-5" style={{ paddingTop: 0 }}>
          <div className="label">Reason / Notes</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {type === "COUNT" ? "Optional for Stock Count (recommended for audit)." : "Required for Waste/Damage/Variance."}
          </div>
          <textarea
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            placeholder={type === "COUNT" ? "Optional notes..." : "Explain why this adjustment is needed..."}
            style={{ marginTop: 8, minHeight: 74, resize: "vertical" }}
          />
        </div>
      </div>

      {/* Lines Table */}
      <div className="card">
        <CardHeader
          title="Items"
          subtitle="Add the items and locations you want to adjust."
          right={
            <button className="btn btn-secondary" onClick={addLine} disabled={loading}>
              + Add line
            </button>
          }
        />

        <div className="p-4 md:p-5" style={{ paddingTop: 12 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 360 }}>Item</th>
                  <th style={{ width: 260 }}>Location</th>
                  <th style={{ width: 120 }}>Qty</th>
                  <th style={{ width: 140 }}>Unit</th>
                  <th>Note</th>
                  <th style={{ width: 72 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={l._rowId}>
                    <td>
                      <button
                        type="button"
                        className="input"
                        onClick={() => setPickItemRowId(l._rowId)}
                        disabled={loading}
                        style={{
                          width: "100%",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          cursor: loading ? "not-allowed" : "pointer",
                        }}
                        title="Select item"
                      >
                        <span style={{ color: l.inventoryItemId ? "inherit" : "rgba(15,23,42,0.5)" }}>
                          {l.inventoryItemLabel || "Select item…"}
                        </span>
                        <span className="muted" style={{ fontSize: 12 }}>Search</span>
                      </button>
                      {!l.inventoryItemId ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                          Line {idx + 1}: choose an item.
                        </div>
                      ) : null}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="input"
                        onClick={() => setPickLocRowId(l._rowId)}
                        disabled={loading}
                        style={{
                          width: "100%",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          cursor: loading ? "not-allowed" : "pointer",
                        }}
                        title="Select location"
                      >
                        <span style={{ color: l.locationId ? "inherit" : "rgba(15,23,42,0.5)" }}>
                          {l.locationLabel || "Select location…"}
                        </span>
                        <span className="muted" style={{ fontSize: 12 }}>Search</span>
                      </button>
                    </td>

                    <td>
                      <input
                        className="input"
                        type="number"
                        value={Number.isFinite(l.quantity) ? l.quantity : 0}
                        onChange={(e) => updateLine(l._rowId, { quantity: Number(e.target.value) })}
                        disabled={loading}
                        step="0.01"
                        placeholder="0"
                      />
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        Negative reduces
                      </div>
                    </td>

                    <td>
                      <select
                        className="input"
                        value={l.unit}
                        onChange={(e) => updateLine(l._rowId, { unit: e.target.value })}
                        disabled={loading}
                      >
                        <option value="pcs">pcs</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="l">l</option>
                        <option value="ml">ml</option>
                      </select>
                    </td>

                    <td>
                      <input
                        className="input"
                        value={l.note ?? ""}
                        onChange={(e) => updateLine(l._rowId, { note: e.target.value })}
                        disabled={loading}
                        placeholder="Optional (e.g., damaged during delivery)"
                      />
                    </td>

                    <td>
                      <button
                        className="btn btn-danger"
                        onClick={() => removeLine(l._rowId)}
                        disabled={loading || lines.length === 1}
                        title={lines.length === 1 ? "At least one line is required." : "Remove line"}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}

                {!lines.length ? (
                  <tr>
                    <td colSpan={6} className="muted" style={{ padding: 16 }}>
                      No lines yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {issues.length ? (
            <div className="card" style={{ marginTop: 12, padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Please fix</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {issues.slice(0, 6).map((x) => (
                  <li key={x} className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                    {x}
                  </li>
                ))}
                {issues.length > 6 ? (
                  <li className="muted" style={{ fontSize: 12 }}>
                    …and {issues.length - 6} more
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* Item Picker Modal */}
      <Modal
        open={!!pickItemRowId}
        title="Select Item"
        subtitle="Search by item name or SKU."
        onClose={() => {
          setPickItemRowId(null);
          setItemQ("");
          setItemRes([]);
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            className="input"
            value={itemQ}
            onChange={(e) => setItemQ(e.target.value)}
            placeholder="Type to search…"
            autoFocus
            disabled={loading}
          />
          <div className="muted" style={{ fontSize: 12, minWidth: 90 }}>
            {itemSearching ? "Searching…" : `${itemRes.length} results`}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {itemRes.map((it) => (
            <button
              key={it.id}
              type="button"
              className="card"
              disabled={loading}
              onClick={() => pickItem(pickItemRowId!, it)}
              style={{ textAlign: "left", padding: 12, cursor: loading ? "not-allowed" : "pointer" }}
            >
              <div style={{ fontWeight: 900 }}>{it.sku ? `${it.name} (${it.sku})` : it.name}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Unit: {it.baseUnit ?? "—"}
              </div>
            </button>
          ))}

          {!itemSearching && itemQ.trim() && itemRes.length === 0 ? (
            <div className="muted">No items found.</div>
          ) : null}

          {!itemQ.trim() ? (
            <div className="muted" style={{ fontSize: 12 }}>
              Tip: type at least 2–3 characters.
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Location Picker Modal */}
      <Modal
        open={!!pickLocRowId}
        title="Select Location"
        subtitle="Search by location name (e.g., Main Store, Kitchen, Bar)."
        onClose={() => {
          setPickLocRowId(null);
          setLocQ("");
          setLocRes([]);
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            className="input"
            value={locQ}
            onChange={(e) => setLocQ(e.target.value)}
            placeholder="Type to search…"
            autoFocus
            disabled={loading}
          />
          <div className="muted" style={{ fontSize: 12, minWidth: 90 }}>
            {locSearching ? "Searching…" : `${locRes.length} results`}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {locRes.map((lo) => (
            <button
              key={lo.id}
              type="button"
              className="card"
              disabled={loading}
              onClick={() => pickLocation(pickLocRowId!, lo)}
              style={{ textAlign: "left", padding: 12, cursor: loading ? "not-allowed" : "pointer" }}
            >
              <div style={{ fontWeight: 900 }}>{lo.name}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Active location
              </div>
            </button>
          ))}

          {!locSearching && locQ.trim() && locRes.length === 0 ? (
            <div className="muted">No locations found.</div>
          ) : null}

          {!locQ.trim() ? (
            <div className="muted" style={{ fontSize: 12 }}>
              Tip: type at least 2–3 characters.
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
