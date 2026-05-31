import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { salesApi } from "../api/salesApi";
import type { SaleListItemDto } from "../api/salesTypes";
import { InventoryBadge, PaymentStatusBadge, SaleStatusBadge, Alert, Button, Card, Kpi, dateTime, extractApiError, money } from "../components/pos-ui";
import "../components/pos.css";

function useAppScope() {
  return {
    companyId: localStorage.getItem("companyId") ?? "",
    branchId: localStorage.getItem("branchId") ?? "",
  };
}

const PAGE_SIZE = 20;

export default function SalesListPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [items, setItems] = useState<SaleListItemDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    if (!companyId || !branchId) return;
    setBusy(true);
    setErr(null);
    try {
      const response = await salesApi.list(companyId, branchId, {
        page,
        pageSize: PAGE_SIZE,
        q: q || undefined,
        status: status ? Number(status) : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      const data = (response as any).data ?? response;
      setItems(data.items ?? []);
      setTotalCount(data.totalCount ?? 0);
    } catch (e) {
      setErr(extractApiError(e, "Failed to load sales."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, [companyId, branchId, page, status, fromDate, toDate]);

  const kpis = useMemo(() => {
    const total = items.reduce((s, x) => s + x.totalAmount, 0);
    const cogs = items.reduce((s, x) => s + x.totalCogs, 0);
    return {
      total,
      cogs,
      gp: total - cogs,
      pending: items.filter((x) => !x.isInventoryPosted).length,
    };
  }, [items]);

  async function postBulkCogs() {
    setBulkBusy(true);
    setNotice(null);
    setErr(null);
    try {
      const response = await salesApi.postBulkCogs(companyId, branchId, {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      const data = (response as any).data ?? response;
      setNotice(`Bulk COGS complete. Posted: ${data.posted ?? 0}, skipped: ${data.skipped ?? 0}, failed: ${data.failed ?? 0}.`);
      await load();
    } catch (e) {
      setErr(extractApiError(e, "Bulk COGS posting failed."));
    } finally {
      setBulkBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title">
          <h1>Sales</h1>
          <p>POS, back-office, and imported sales.</p>
        </div>
        <div className="pos-actions">
          <Button onClick={() => nav("/sales/import")}>External Import</Button>
          <Button onClick={postBulkCogs} disabled={bulkBusy}>{bulkBusy ? "Posting..." : "Post COGS"}</Button>
          <Button variant="primary" onClick={() => nav("/sales/pos")}>Open POS</Button>
        </div>
      </div>

      {err && <Alert tone="danger">{err}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Kpi label="Page Sales" value={money(kpis.total)} />
        <Kpi label="COGS" value={money(kpis.cogs)} />
        <Kpi label="Gross Profit" value={money(kpis.gp)} />
        <Kpi label="Inventory Pending" value={kpis.pending} />
      </div>

      <Card title="Sales Register" subtitle={`${totalCount} records`}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 14 }}>
          <label className="pos-field" style={{ flex: "1 1 220px" }}>
            <span>Search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Sale number or source..." />
          </label>
          <label className="pos-field">
            <span>Status</span>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="1">Draft</option>
              <option value="2">Confirmed</option>
              <option value="3">Posted</option>
              <option value="4">Cancelled</option>
              <option value="5">Reversed</option>
            </select>
          </label>
          <label className="pos-field"><span>From</span><input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} /></label>
          <label className="pos-field"><span>To</span><input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} /></label>
          <Button onClick={load} disabled={busy}>{busy ? "Loading..." : "Refresh"}</Button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="pos-table">
            <thead>
              <tr>
                <th>Sale No</th>
                <th>Date</th>
                <th>Status</th>
                <th>Payment</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ textAlign: "right" }}>COGS</th>
                <th style={{ textAlign: "right" }}>Profit</th>
                <th>Inventory</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "#6b7280", padding: 30 }}>No sales found.</td></tr>
              ) : items.map((s) => (
                <tr key={s.id} onClick={() => nav(`/sales/${s.id}`)} style={{ cursor: "pointer" }}>
                  <td style={{ fontFamily: "monospace" }}>{s.saleNo}</td>
                  <td>{dateTime(s.soldAtUtc)}</td>
                  <td><SaleStatusBadge status={s.status} /></td>
                  <td><PaymentStatusBadge status={s.paymentStatus} /></td>
                  <td style={{ textAlign: "right" }}>{money(s.totalAmount)}</td>
                  <td style={{ textAlign: "right" }}>{money(s.totalCogs)}</td>
                  <td style={{ textAlign: "right" }}>{money(s.grossProfit)}</td>
                  <td><InventoryBadge posted={s.isInventoryPosted} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          <span style={{ color: "#6b7280", fontSize: 13 }}>Page {page} of {totalPages}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
