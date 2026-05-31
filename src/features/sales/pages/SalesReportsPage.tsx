import { useEffect, useMemo, useState } from "react";
import { salesApi } from "../api/salesApi";
import type { SaleListItemDto } from "../api/salesTypes";
import { Alert, Button, Card, Kpi, extractApiError, money } from "../components/pos-ui";
import "../components/pos.css";

function useAppScope() {
  return {
    companyId: localStorage.getItem("companyId") ?? "",
    branchId: localStorage.getItem("branchId") ?? "",
  };
}

export default function SalesReportsPage() {
  const { companyId, branchId } = useAppScope();
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<SaleListItemDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const response = await salesApi.list(companyId, branchId, {
        page: 1,
        pageSize: 100,
        fromDate,
        toDate,
      });
      const data = (response as any).data ?? response;
      setItems(data.items ?? []);
    } catch (e) {
      setErr(extractApiError(e, "Failed to load reports."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { if (companyId && branchId) load(); }, [companyId, branchId]);

  const summary = useMemo(() => {
    const sales = items.reduce((s, x) => s + x.totalAmount, 0);
    const cogs = items.reduce((s, x) => s + x.totalCogs, 0);
    const posted = items.filter((x) => x.isInventoryPosted).length;
    return {
      sales,
      cogs,
      gp: sales - cogs,
      margin: sales > 0 ? ((sales - cogs) / sales) * 100 : 0,
      transactions: items.length,
      avgTicket: items.length > 0 ? sales / items.length : 0,
      posted,
      pending: items.length - posted,
    };
  }, [items]);

  return (
    <div className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title">
          <h1>Sales Reports</h1>
          <p>Daily sales, COGS, gross profit, and inventory-posting status.</p>
        </div>
        <div className="pos-actions">
          <label className="pos-field"><span>From</span><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
          <label className="pos-field"><span>To</span><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
          <Button variant="primary" onClick={load} disabled={busy}>{busy ? "Loading..." : "Run"}</Button>
        </div>
      </div>

      {err && <Alert tone="danger">{err}</Alert>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Kpi label="Sales" value={money(summary.sales)} />
        <Kpi label="COGS" value={money(summary.cogs)} />
        <Kpi label="Gross Profit" value={money(summary.gp)} />
        <Kpi label="Margin" value={`${summary.margin.toFixed(1)}%`} />
        <Kpi label="Transactions" value={summary.transactions} />
        <Kpi label="Average Ticket" value={money(summary.avgTicket)} />
        <Kpi label="Inventory Posted" value={summary.posted} />
        <Kpi label="Inventory Pending" value={summary.pending} />
      </div>

      <Card title="Report Detail">
        <table className="pos-table">
          <thead><tr><th>Sale</th><th>Date</th><th style={{ textAlign: "right" }}>Sales</th><th style={{ textAlign: "right" }}>COGS</th><th style={{ textAlign: "right" }}>Profit</th><th>Inventory</th></tr></thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td>{x.saleNo}</td>
                <td>{new Date(x.soldAtUtc).toLocaleString()}</td>
                <td style={{ textAlign: "right" }}>{money(x.totalAmount)}</td>
                <td style={{ textAlign: "right" }}>{money(x.totalCogs)}</td>
                <td style={{ textAlign: "right" }}>{money(x.grossProfit)}</td>
                <td>{x.isInventoryPosted ? "Posted" : "Pending"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
