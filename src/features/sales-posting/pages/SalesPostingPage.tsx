import { useMemo, useState } from "react";
import { salesApi } from "../api/salesApi";
import type { CreateSaleDto } from "../types";
import { useAppScope } from "../../../app/useAppScope";

function extractApiError(err: any): string {
  const data = err?.response?.data;

  if (typeof data === "string" && data.trim()) return data;
  if (data?.message) return data.message;

  // ASP.NET validation problem details
  if (data?.errors && typeof data.errors === "object") {
    const key = Object.keys(data.errors)[0];
    const msg = data.errors[key]?.[0];
    if (msg) return msg;
  }

  return err?.message ?? "Failed to post sale";
}

type UiLine = { menuItemId: string; qty: number; unitPrice: number };

function newLine(): UiLine {
  return { menuItemId: "", qty: 1, unitPrice: 0 };
}

type PaymentMethod = "CASH" | "CARD" | "MOBILE";

export default function SalesPostingPage() {
  const { companyId } = useAppScope();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // For now, let user paste/select a locationId (GUID). Later replace with dropdown.
  const [locationId, setLocationId] = useState("");

  // Single payment (matches your backend CreateSaleDto)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentRef, setPaymentRef] = useState<string>("");

  // TEMP UI lines (replace with POS cart later)
  const [lines, setLines] = useState<UiLine[]>([newLine()]);

  const totals = useMemo(() => {
    const subTotal = lines.reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.qty) || 0), 0);
    // If you later add discount/tax/service charge, compute here
    const grandTotal = subTotal;
    return { subTotal, grandTotal };
  }, [lines]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!companyId) return false;
    if (!locationId.trim()) return false;
    if (!lines.length) return false;

    const linesOk = lines.every(l =>
      l.menuItemId.trim() &&
      Number.isFinite(l.qty) && l.qty > 0 &&
      Number.isFinite(l.unitPrice) && l.unitPrice >= 0
    );

    // Allow 0 payment if you want (e.g., pay-later); otherwise enforce >= grandTotal
    const paymentOk = Number.isFinite(paymentAmount) && paymentAmount >= 0;

    return linesOk && paymentOk;
  }, [loading, companyId, locationId, lines, paymentAmount]);

  function updateLine(i: number, patch: Partial<UiLine>) {
    setLines(prev => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function addLine() {
    setLines(prev => [...prev, newLine()]);
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handlePostSale() {
    if (!companyId) {
      setError("Company is not selected. Please finish onboarding or select a company.");
      return;
    }
    if (!locationId.trim()) {
      setError("Location is required.");
      return;
    }
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const payload: CreateSaleDto = {
      companyId,
      locationId: locationId.trim(),
      payment: {
        method: paymentMethod,
        amount: paymentAmount,
        ref: paymentRef.trim() || undefined,
      },
      lines: lines.map(l => ({
        menuItemId: l.menuItemId.trim(),
        quantity: l.qty,
        unitPrice: l.unitPrice,
      })),
    };

    try {
      await salesApi.postSale(payload);
      setSuccessMsg("Sale posted successfully. Inventory & COGS updated.");

      // reset
      setLocationId(locationId.trim()); // keep location for faster posting
      setPaymentAmount(0);
      setPaymentRef("");
      setLines([newLine()]);
    } catch (err: any) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Sales Posting</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Post sale → Inventory movement + COGS
          </div>
        </div>

        <button
          className="btn"
          disabled={!canSubmit}
          onClick={handlePostSale}
          title={!canSubmit ? "Fill required fields and add valid lines." : "Post sale"}
        >
          {loading ? "Posting..." : "Post Sale"}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success" style={{ marginTop: 12 }}>
          {successMsg}
        </div>
      )}

      {/* Scope + Payment */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
        <div>
          <label className="label">Company</label>
          <input className="input" value={companyId ?? ""} disabled placeholder="CompanyId from scope" />
          {!companyId && (
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Company scope is missing.
            </div>
          )}
        </div>

        <div>
          <label className="label">Location ID</label>
          <input
            className="input"
            value={locationId}
            onChange={e => setLocationId(e.target.value)}
            placeholder="GUID"
            disabled={loading}
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            This must match your backend LocationId.
          </div>
        </div>

        <div>
          <label className="label">Payment Method</label>
          <select
            className="input"
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
            disabled={loading}
          >
            <option value="CASH">CASH</option>
            <option value="CARD">CARD</option>
            <option value="MOBILE">MOBILE</option>
          </select>
        </div>

        <div>
          <label className="label">Payment Amount</label>
          <input
            className="input"
            type="number"
            value={paymentAmount}
            onChange={e => setPaymentAmount(Number(e.target.value))}
            disabled={loading}
            min={0}
            step="0.01"
          />
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <label className="label">Payment Reference</label>
          <input
            className="input"
            value={paymentRef}
            onChange={e => setPaymentRef(e.target.value)}
            placeholder="Optional (Txn ref, last 4 digits, etc.)"
            disabled={loading}
          />
        </div>
      </div>

      {/* Lines */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Lines</h3>
          <button className="btn btn-secondary" onClick={addLine} disabled={loading}>
            + Add Line
          </button>
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 260 }}>Menu Item ID</th>
                <th style={{ width: 120 }}>Qty</th>
                <th style={{ width: 160 }}>Unit Price</th>
                <th style={{ width: 160 }}>Line Total</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>

            <tbody>
              {lines.map((l, i) => {
                const lineTotal = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
                return (
                  <tr key={i}>
                    <td>
                      <input
                        className="input"
                        value={l.menuItemId}
                        onChange={e => updateLine(i, { menuItemId: e.target.value })}
                        placeholder="GUID"
                        disabled={loading}
                      />
                    </td>

                    <td>
                      <input
                        className="input"
                        type="number"
                        value={l.qty}
                        onChange={e => updateLine(i, { qty: Number(e.target.value) })}
                        disabled={loading}
                        min={1}
                        step="1"
                      />
                    </td>

                    <td>
                      <input
                        className="input"
                        type="number"
                        value={l.unitPrice}
                        onChange={e => updateLine(i, { unitPrice: Number(e.target.value) })}
                        disabled={loading}
                        min={0}
                        step="0.01"
                      />
                    </td>

                    <td className="muted" style={{ fontSize: 13 }}>
                      {Number.isFinite(lineTotal) ? lineTotal.toFixed(2) : "0.00"}
                    </td>

                    <td>
                      <button
                        className="btn btn-danger"
                        onClick={() => removeLine(i)}
                        disabled={loading || lines.length === 1}
                        title={lines.length === 1 ? "At least one line is required." : "Remove line"}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}

              {lines.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: 16 }}>
                    No lines added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <div className="card" style={{ minWidth: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span className="muted">Subtotal</span>
              <strong>{totals.subTotal.toFixed(2)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6 }}>
              <span className="muted">Grand Total</span>
              <strong>{totals.grandTotal.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Tip: Replace Menu Item ID with a searchable dropdown from your Menu Items endpoint, and auto-fill Unit Price.
        </div>
      </div>
    </div>
  );
}
