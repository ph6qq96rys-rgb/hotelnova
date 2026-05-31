import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { salesApi } from "../api/salesApi";
import { menuItemsApi } from "../../production/api/menuItemsApi";
import { stockLocationsApi } from "../../inventory/stock-locations/api/stockLocationsApi";
import type { SaleLineRow, LocationLite, MenuItemLite } from "../sales.types";
import {
  newLineUid, calcTotals, validateSaleLines,
  extractApiError, fmt,
} from "../utils/sales.utils";
import {
  Alert, TotalsSummary, PaymentMethodSelect, SectionHead,
} from "../components/sales.ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

const blankLine = (): SaleLineRow => ({
  _uid: newLineUid(), menuItemId: "", menuItemName: "",
  quantity: "1", unitPrice: "0",
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewSalePage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [menuItems,   setMenuItems]   = useState<MenuItemLite[]>([]);
  const [locations,   setLocations]   = useState<LocationLite[]>([]);
  const [locationId,  setLocationId]  = useState("");
  const [lines,       setLines]       = useState<SaleLineRow[]>([blankLine()]);
  const [discount,    setDiscount]    = useState("0");
  const [tax,         setTax]         = useState("0");
  const [payMethod,   setPayMethod]   = useState("CASH");
  const [payAmount,   setPayAmount]   = useState("0");
  const [payRef,      setPayRef]      = useState("");
  const [withPayment, setWithPayment] = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState<string | null>(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!companyId || !branchId) return;
    menuItemsApi.list(companyId, branchId).then(setMenuItems).catch(() => {});
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId || !branchId) return;
    let cancelled = false;
    stockLocationsApi.list(companyId, branchId)
      .then((rows) => {
        if (cancelled) return;
        const active = (rows ?? []).filter((x) => x.isActive !== false);
        setLocations(active);
        if (active.length > 0) setLocationId(active[0].id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [companyId, branchId]);

  // ── Line helpers ───────────────────────────────────────────────────────────

  const itemById = useMemo(
    () => new Map(menuItems.map((m) => [m.id, m])),
    [menuItems]
  );

  const addLine    = () => setLines((p) => [...p, blankLine()]);
  const removeLine = (uid: string) => setLines((p) => p.filter((l) => l._uid !== uid));
  const updateLine = (uid: string, patch: Partial<SaleLineRow>) =>
    setLines((p) => p.map((l) => (l._uid === uid ? { ...l, ...patch } : l)));

  const selectItem = (uid: string, menuItemId: string) => {
    const item = itemById.get(menuItemId);
    updateLine(uid, {
      menuItemId,
      menuItemName: item?.name ?? "",
      unitPrice: String(item?.sellingPrice ?? 0),
    });
  };

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totals = useMemo(
    () => calcTotals(lines, discount, tax),
    [lines, discount, tax]
  );

  // ── Save ───────────────────────────────────────────────────────────────────

  async function save(andConfirm = false) {
    if (!companyId || !branchId) return;

    const lineErr = validateSaleLines(lines);
    if (!locationId) { setErr("Stock location is required."); return; }
    if (lineErr)     { setErr(lineErr); return; }
    if (withPayment && Number(payAmount) <= 0) {
      setErr("Payment amount must be > 0."); return;
    }

    setErr(null);
    setSaving(true);
    try {
      const sale = await salesApi.create(companyId, branchId, {
        companyId,
        branchId,
        locationId,
        lines: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity:   Number(l.quantity),
          unitPrice:  Number(l.unitPrice),
        })),
        discountAmount: Number(discount) || 0,
        taxAmount:      Number(tax)      || 0,
        payment: withPayment ? {
          method:        payMethod,
          amount:        Number(payAmount),
          referenceCode: payRef || undefined,
        } : null,
      });

      if (andConfirm && sale?.id)
        await salesApi.confirm(companyId, branchId, sale.id);

      nav(`/sales/${sale.id}`);
    } catch (e) {
      setErr(extractApiError(e, "Failed to create sale."));
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="card">

        {/* Header */}
        <div className="card-header" style={{
          display: "flex", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <div className="card-title">New Sale</div>
            <div className="card-subtitle">
              Back-office sale entry. Use POS for point-of-sale transactions.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => nav(-1)} disabled={saving}>Cancel</button>
            <button className="btn" onClick={() => save(false)} disabled={saving}>
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button className="btn btn-primary" onClick={() => save(true)} disabled={saving}>
              {saving ? "Saving…" : "Save & Confirm"}
            </button>
          </div>
        </div>

        <div className="card-body">
          {err && <Alert type="error" message={err} />}

          {/* Location */}
          <div className="field">
            <label>Stock Location *</label>
            <select
              className="input"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              disabled={saving}
              style={{ maxWidth: 320 }}
            >
              <option value="">Select location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Lines */}
          <div style={{ marginBottom: 20 }}>
            <SectionHead
              title="Line Items"
              action={
                <button className="btn" onClick={addLine} disabled={saving}
                  style={{ fontSize: 12, padding: "3px 12px" }}>
                  + Add Line
                </button>
              }
            />
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 240 }}>Menu Item</th>
                    <th style={{ width: 100, textAlign: "right" }}>Qty</th>
                    <th style={{ width: 120, textAlign: "right" }}>Unit Price</th>
                    <th style={{ width: 120, textAlign: "right" }}>Line Total</th>
                    <th style={{ width: 60,  textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const lineTotal = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
                    return (
                      <tr key={l._uid}>
                        <td>
                          <select className="input" value={l.menuItemId}
                            onChange={(e) => selectItem(l._uid, e.target.value)}
                            disabled={saving}>
                            <option value="">Select menu item…</option>
                            {menuItems.map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <input className="input" value={l.quantity} inputMode="decimal"
                            onChange={(e) => updateLine(l._uid, { quantity: e.target.value })}
                            disabled={saving} style={{ textAlign: "right" }} />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <input className="input" value={l.unitPrice} inputMode="decimal"
                            onChange={(e) => updateLine(l._uid, { unitPrice: e.target.value })}
                            disabled={saving} style={{ textAlign: "right" }} />
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>
                          ${fmt(lineTotal)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button className="btn btn-danger"
                            onClick={() => removeLine(l._uid)}
                            disabled={saving || lines.length === 1}
                            style={{ fontSize: 11, padding: "3px 10px" }}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals + Payment */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Totals */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
              <SectionHead title="Totals" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Discount</label>
                  <input className="input" value={discount} inputMode="decimal"
                    onChange={(e) => setDiscount(e.target.value)} disabled={saving} />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Tax</label>
                  <input className="input" value={tax} inputMode="decimal"
                    onChange={(e) => setTax(e.target.value)} disabled={saving} />
                </div>
                <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                  <TotalsSummary {...totals} />
                </div>
              </div>
            </div>

            {/* Payment */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Payment</div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={withPayment}
                    onChange={(e) => setWithPayment(e.target.checked)} />
                  Include payment
                </label>
              </div>
              {withPayment && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Method</label>
                    <PaymentMethodSelect value={payMethod} onChange={setPayMethod} disabled={saving} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Amount</label>
                    <input className="input" value={payAmount} inputMode="decimal"
                      onChange={(e) => setPayAmount(e.target.value)} disabled={saving} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Reference Code</label>
                    <input className="input" value={payRef} placeholder="Optional"
                      onChange={(e) => setPayRef(e.target.value)} disabled={saving} />
                  </div>
                  <button className="btn" style={{ fontSize: 12 }} type="button"
                    onClick={() => setPayAmount(totals.grandTotal.toFixed(2))}>
                    Use Total (${fmt(totals.grandTotal)})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}