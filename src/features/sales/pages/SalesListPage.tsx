import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { salesApi } from "../api/salesApi";
import type { SaleListItemDto } from "../api/salesTypes";
import {
  Alert,
  Button,
  Card,
  InventoryBadge,
  Kpi,
  PaymentStatusBadge,
  SaleStatusBadge,
  dateTime,
  extractApiError,
  money,
} from "../components/pos-ui";
import "../components/pos.css";

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

  const missingScope = !companyId || !branchId;

  const kpis = useMemo(() => {
    const total = items.reduce((s, x) => s + Number(x.totalAmount || 0), 0);
    const cogs = items.reduce((s, x) => s + Number(x.totalCogs || 0), 0);
    const gp = total - cogs;
    const pending = items.filter((x) => !x.isInventoryPosted).length;
    const marginPct = total > 0 ? (gp / total) * 100 : 0;

    return {
      total,
      cogs,
      gp,
      pending,
      marginPct,
    };
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  async function load() {
    if (missingScope) {
      setItems([]);
      setTotalCount(0);
      setErr("Company or branch is not selected.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const response = await salesApi.list(companyId, branchId, {
        page,
        pageSize: PAGE_SIZE,
        q: q.trim() || undefined,
        status: status ? Number(status) : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });

      const data = (response as any).data ?? response;

      setItems(Array.isArray(data.items) ? data.items : []);
      setTotalCount(Number(data.totalCount || 0));
    } catch (e) {
      setItems([]);
      setTotalCount(0);
      setErr(extractApiError(e, "Failed to load sales."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, branchId, page, status, fromDate, toDate]);

  function applySearch() {
    setPage(1);
    void load();
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  async function postBulkCogs() {
    if (missingScope) {
      setErr("Company or branch is not selected.");
      return;
    }

    setBulkBusy(true);
    setNotice(null);
    setErr(null);

    try {
      const response = await salesApi.postBulkCogs(companyId, branchId, {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });

      const data = (response as any).data ?? response;

      setNotice(
        `Bulk COGS complete. Posted: ${data.posted ?? 0}, skipped: ${
          data.skipped ?? 0
        }, failed: ${data.failed ?? 0}.`
      );

      await load();
    } catch (e) {
      setErr(extractApiError(e, "Bulk COGS posting failed."));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title">
          <h1>Sales Register</h1>
          <p>POS, back-office, imported sales, COGS, and inventory posting status.</p>
        </div>

        <div className="pos-actions">
          <Button onClick={() => nav("/sales/import")} disabled={missingScope}>
            External Import
          </Button>

          <Button onClick={postBulkCogs} disabled={bulkBusy || missingScope}>
            {bulkBusy ? "Posting..." : "Post Pending COGS"}
          </Button>

          <Button variant="primary" onClick={() => nav("/sales/pos")} disabled={missingScope}>
            Open POS
          </Button>
        </div>
      </div>

      {missingScope && (
        <Alert tone="warning">
          Company or branch is not selected. Select a branch before viewing sales.
        </Alert>
      )}

      {err && <Alert tone="danger">{err}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <Kpi label="Page Sales" value={money(kpis.total)} />
        <Kpi label="COGS" value={money(kpis.cogs)} />
        <Kpi label="Gross Profit" value={money(kpis.gp)} />
        <Kpi label="Margin %" value={`${kpis.marginPct.toFixed(2)}%`} />
        <Kpi label="Inventory Pending" value={kpis.pending} />
      </div>

      <Card title="Sales Register" subtitle={`${totalCount} records`}>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "end",
            marginBottom: 14,
          }}
        >
          <label className="pos-field" style={{ flex: "1 1 220px" }}>
            <span>Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="Sale number or source..."
              disabled={busy || missingScope}
            />
          </label>

          <label className="pos-field">
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              disabled={busy || missingScope}
            >
              <option value="">All</option>
              <option value="1">Draft</option>
              <option value="2">Confirmed</option>
              <option value="3">Posted</option>
              <option value="4">Cancelled</option>
              <option value="5">Reversed</option>
            </select>
          </label>

          <label className="pos-field">
            <span>From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              disabled={busy || missingScope}
            />
          </label>

          <label className="pos-field">
            <span>To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              disabled={busy || missingScope}
            />
          </label>

          <Button onClick={applySearch} disabled={busy || missingScope}>
            {busy ? "Loading..." : "Search"}
          </Button>

          <Button onClick={clearFilters} disabled={busy || missingScope}>
            Clear
          </Button>
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
                <th style={{ textAlign: "right" }}>Margin</th>
                <th>Inventory</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      textAlign: "center",
                      color: "#6b7280",
                      padding: 30,
                    }}
                  >
                    {busy ? "Loading sales..." : "No sales found."}
                  </td>
                </tr>
              ) : (
                items.map((s) => {
                  const total = Number(s.totalAmount || 0);
                  const profit = Number(s.grossProfit ?? total - Number(s.totalCogs || 0));
                  const margin = total > 0 ? (profit / total) * 100 : 0;

                  return (
                    <tr
                      key={s.id}
                      onClick={() => nav(`/sales/${s.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ fontFamily: "monospace" }}>{s.saleNo}</td>
                      <td>{dateTime(s.soldAtUtc)}</td>
                      <td>
                        <SaleStatusBadge status={s.status} />
                      </td>
                      <td>
                        <PaymentStatusBadge status={s.paymentStatus} />
                      </td>
                      <td style={{ textAlign: "right" }}>{money(s.totalAmount)}</td>
                      <td style={{ textAlign: "right" }}>{money(s.totalCogs)}</td>
                      <td style={{ textAlign: "right" }}>{money(profit)}</td>
                      <td style={{ textAlign: "right" }}>{margin.toFixed(2)}%</td>
                      <td>
                        <InventoryBadge posted={s.isInventoryPosted} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 14,
          }}
        >
          <span style={{ color: "#6b7280", fontSize: 13 }}>
            Page {page} of {totalPages}
          </span>

          <div style={{ display: "flex", gap: 8 }}>
            <Button disabled={page <= 1 || busy || missingScope} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>

            <Button disabled={page >= totalPages || busy || missingScope} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}