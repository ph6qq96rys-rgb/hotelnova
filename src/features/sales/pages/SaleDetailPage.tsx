import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { salesApi } from "../api/salesApi";
import type { SaleDto } from "../api/salesTypes";
import { Alert, Button, Card, InventoryBadge, Kpi, PaymentStatusBadge, SaleStatusBadge, dateTime, extractApiError, money } from "../components/pos-ui";
import "../components/pos.css";

function useAppScope() {
  return {
    companyId: localStorage.getItem("companyId") ?? "",
    branchId: localStorage.getItem("branchId") ?? "",
  };
}

export default function SaleDetailPage() {
  const nav = useNavigate();
  const { saleId } = useParams<{ saleId: string }>();
  const { companyId, branchId } = useAppScope();

  const [sale, setSale] = useState<SaleDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    if (!companyId || !branchId || !saleId) return;
    setBusy(true);
    setErr(null);
    try {
      const response = await salesApi.get(companyId, branchId, saleId);
      setSale((response as any).data ?? response);
    } catch (e) {
      setErr(extractApiError(e, "Failed to load sale."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, [companyId, branchId, saleId]);

  async function postCogs() {
    if (!saleId) return;
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      await salesApi.postCogs(companyId, branchId, saleId);
      setNotice("Inventory and COGS posted.");
      await load();
    } catch (e) {
      setErr(extractApiError(e, "COGS posting failed."));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!saleId || !window.confirm("Cancel this sale?")) return;
    setBusy(true);
    setErr(null);
    try {
      await salesApi.cancel(companyId, branchId, saleId, "Cancelled from UI");
      nav("/sales");
    } catch (e) {
      setErr(extractApiError(e, "Failed to cancel sale."));
    } finally {
      setBusy(false);
    }
  }

  if (!sale) {
    return (
      <div className="pos-page">
        {err ? <Alert tone="danger">{err}</Alert> : <Alert>{busy ? "Loading sale..." : "Sale not found."}</Alert>}
      </div>
    );
  }

  return (
    <div className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title">
          <h1>{sale.saleNo}</h1>
          <p>{dateTime(sale.soldAtUtc)}</p>
        </div>
        <div className="pos-actions">
          <Button onClick={() => nav("/sales")}>Back</Button>
          {!sale.isInventoryPosted && <Button onClick={postCogs} disabled={busy}>Post COGS</Button>}
          <Button variant="danger" onClick={cancel} disabled={busy}>Cancel</Button>
        </div>
      </div>

      {err && <Alert tone="danger">{err}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Kpi label="Total" value={money(sale.totalAmount)} />
        <Kpi label="COGS" value={money(sale.totalCogs)} />
        <Kpi label="Gross Profit" value={money(sale.grossProfit)} />
        <Kpi label="Items" value={sale.saleItems?.length ?? 0} />
      </div>

      <Card title="Sale Status">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SaleStatusBadge status={sale.status} />
          <PaymentStatusBadge status={sale.paymentStatus} />
          <InventoryBadge posted={sale.isInventoryPosted} />
        </div>
      </Card>

      <div style={{ height: 14 }} />

      <Card title="Items">
        <table className="pos-table">
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Price</th>
              <th style={{ textAlign: "right" }}>Total</th>
              <th style={{ textAlign: "right" }}>COGS</th>
            </tr>
          </thead>
          <tbody>
            {sale.saleItems.map((x) => (
              <tr key={x.id}>
                <td>{x.menuItemName}</td>
                <td style={{ textAlign: "right" }}>{x.quantity}</td>
                <td style={{ textAlign: "right" }}>{money(x.unitPrice)}</td>
                <td style={{ textAlign: "right" }}>{money(x.lineTotal)}</td>
                <td style={{ textAlign: "right" }}>{money(x.lineCogs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ height: 14 }} />

      <Card title="Payments">
        <table className="pos-table">
          <thead><tr><th>Method</th><th>Reference</th><th>Date</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>
            {sale.payments.map((x) => (
              <tr key={x.id}>
                <td>{x.method}</td>
                <td>{x.referenceCode || "—"}</td>
                <td>{dateTime(x.paidAt)}</td>
                <td style={{ textAlign: "right" }}>{money(x.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
