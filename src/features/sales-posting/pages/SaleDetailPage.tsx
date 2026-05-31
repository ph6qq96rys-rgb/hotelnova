import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { salesApi } from "../api/salesApi";
import type { SaleDto } from "../sales.types";
import { SALE_STATUS, PAYMENT_STATUS } from "../sales.types";
import { fmt, fmtDate, extractApiError } from "../utils/sales.utils";
import {
  Alert, StatusBadge, InventoryBadge, KpiCard,
  SectionHead, EmptyRow,
} from "../components/sales.ui";

export default function SaleDetailPage() {
  const nav = useNavigate();
  const { saleId } = useParams<{ saleId: string }>();
  const { companyId, branchId } = useAppScope();

  const [sale,        setSale]        = useState<SaleDto | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState<string | null>(null);
  const [ok,          setOk]          = useState<string | null>(null);
  const [confirming,  setConfirming]  = useState(false);
  const [cancelling,  setCancelling]  = useState(false);
  const [postingCogs, setPostingCogs] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!companyId || !branchId || !saleId) return;
    let cancelled = false;
    setLoading(true);
    salesApi.get(companyId, branchId, saleId)
      .then((d)  => { if (!cancelled) setSale(d); })
      .catch((e) => { if (!cancelled) setErr(extractApiError(e, "Failed to load sale.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId, branchId, saleId]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const reset = () => { setErr(null); setOk(null); };

  async function confirm() {
    if (!companyId || !branchId || !saleId) return;
    reset(); setConfirming(true);
    try {
      setSale(await salesApi.confirm(companyId, branchId, saleId));
      setOk("Sale confirmed.");
    } catch (e) {
      setErr(extractApiError(e, "Failed to confirm."));
    } finally { setConfirming(false); }
  }

  async function cancel() {
    if (!companyId || !branchId || !saleId) return;
    if (!window.confirm("Cancel this sale?")) return;
    reset(); setCancelling(true);
    try {
      await salesApi.cancel(companyId, branchId, saleId);
      nav("/sales");
    } catch (e) {
      setErr(extractApiError(e, "Failed to cancel."));
    } finally { setCancelling(false); }
  }

  async function postCogs() {
    if (!companyId || !branchId || !saleId) return;
    reset(); setPostingCogs(true);
    try {
      await salesApi.postCogs(companyId, branchId, saleId);
      setSale(await salesApi.get(companyId, branchId, saleId));
      setOk("COGS posted successfully.");
    } catch (e) {
      setErr(extractApiError(e, "COGS posting failed."));
    } finally { setPostingCogs(false); }
  }

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="page">
      <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        Loading…
      </div>
    </div>
  );

  if (!sale) return (
    <div className="page">
      <div className="card" style={{ padding: 24 }}>
        <Alert type="error" message={err ?? "Sale not found."} />
      </div>
    </div>
  );

  const ss = SALE_STATUS[sale.status];
  const ps = PAYMENT_STATUS[sale.paymentStatus];
  const busy = confirming || cancelling || postingCogs;

  return (
    <div className="page">
      <div className="card">

        {/* Header */}
        <div className="card-header" style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", gap: 12, flexWrap: "wrap",
        }}>
          <div>
            <div className="card-title" style={{ fontFamily: "monospace" }}>
              {sale.saleNo}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {ss && <StatusBadge label={ss.label} color={ss.color} />}
              {ps && <StatusBadge label={ps.label} color={ps.color} />}
              <InventoryBadge posted={sale.isInventoryPosted} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => nav("/sales")} disabled={busy}>
              ← Back
            </button>
            {sale.status === 1 && (
              <button className="btn btn-primary" onClick={confirm} disabled={busy}>
                {confirming ? "Confirming…" : "Confirm Sale"}
              </button>
            )}
            {[1, 2].includes(sale.status) && (
              <button className="btn btn-danger" onClick={cancel} disabled={busy}>
                {cancelling ? "Cancelling…" : "Cancel Sale"}
              </button>
            )}
            {sale.status === 2 && !sale.isInventoryPosted && (
              <button className="btn" onClick={postCogs} disabled={busy}>
                {postingCogs ? "Posting COGS…" : "Post COGS"}
              </button>
            )}
          </div>
        </div>

        <div className="card-body">
          {err && <Alert type="error"   message={err} />}
          {ok  && <Alert type="success" message={ok}  />}

          {/* KPI strip */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12, marginBottom: 24,
          }}>
            <KpiCard label="Date"         value={fmtDate(sale.soldAtUtc)} />
            <KpiCard label="Subtotal"     value={`$${fmt(sale.subTotal)}`}       mono />
            <KpiCard label="Discount"     value={`$${fmt(sale.discountAmount)}`} mono />
            <KpiCard label="Tax"          value={`$${fmt(sale.taxAmount)}`}      mono />
            <KpiCard label="Total"        value={`$${fmt(sale.totalAmount)}`}    mono bold />
            <KpiCard label="COGS"         value={`$${fmt(sale.totalCogs)}`}      mono />
            <KpiCard
              label="Gross Profit"
              value={`$${fmt(sale.grossProfit)}`}
              mono
              color={sale.grossProfit >= 0 ? "#10b981" : "#ef4444"}
            />
          </div>

          {/* Lines */}
          <SectionHead title="Sale Lines" />
          <div style={{ overflowX: "auto", marginBottom: 24 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Unit Price</th>
                  <th style={{ textAlign: "right" }}>Line Total</th>
                  <th style={{ textAlign: "right" }}>COGS</th>
                  <th style={{ textAlign: "right" }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {sale.saleItems.length === 0 ? (
                  <EmptyRow colSpan={6} />
                ) : sale.saleItems.map((l) => {
                  const margin = l.lineTotal - l.lineCogs;
                  return (
                    <tr key={l.id}>
                      <td>{l.menuItemName || l.menuItemId}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{l.quantity}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>${fmt(l.unitPrice)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>${fmt(l.lineTotal)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>${fmt(l.lineCogs)}</td>
                      <td style={{
                        textAlign: "right", fontFamily: "monospace",
                        color: margin >= 0 ? "#10b981" : "#ef4444",
                      }}>
                        ${fmt(margin)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Payments */}
          {sale.payments.length > 0 && (
            <>
              <SectionHead title="Payments" />
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th>Reference</th>
                      <th>Paid At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.payments.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{p.method}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                          ${fmt(p.amount)}
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>
                          {p.referenceCode || "—"}
                        </td>
                        <td style={{ fontSize: 12 }}>{fmtDate(p.paidAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}