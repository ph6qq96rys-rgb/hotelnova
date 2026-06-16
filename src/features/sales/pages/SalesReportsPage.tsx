import { useCallback, useEffect, useMemo, useState } from "react";
import { salesApi } from "../api/salesApi";
import type { SaleListItemDto } from "../api/salesTypes";
import {
  Alert,
  Button,
  Card,
  Kpi,
  extractApiError,
  money,
} from "../components/pos-ui";
import "../components/pos.css";

type SalesSummary = {
  sales: number;
  cogs: number;
  grossProfit: number;
  margin: number;
  transactions: number;
  avgTicket: number;
  posted: number;
  pending: number;
};

function useAppScope() {
  return {
    companyId: localStorage.getItem("companyId") ?? "",
    branchId: localStorage.getItem("branchId") ?? "",
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function normalizeSalesList(response: unknown): SaleListItemDto[] {
  const data = (response as any)?.data ?? response;

  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.items)) return data.items;

  if (Array.isArray(data?.Items)) return data.Items;

  return [];
}

export default function SalesReportsPage() {
  const { companyId, branchId } = useAppScope();

  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());

  const [items, setItems] = useState<SaleListItemDto[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [postingCogs, setPostingCogs] = useState(false);

  const canQuery = Boolean(companyId && branchId);

  const load = useCallback(async () => {
    if (!canQuery) {
      setErr("Company and branch are required. Please select a company and branch first.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const response = await salesApi.list(companyId, branchId, {
        page: 1,
        pageSize: 100,
        fromDate,
        toDate,
      });

      setItems(normalizeSalesList(response));
    } catch (e) {
      setErr(extractApiError(e, "Failed to load sales reports."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, canQuery, companyId, fromDate, toDate]);

  useEffect(() => {
    if (canQuery) {
      void load();
    }
  }, [canQuery, load]);

  const summary = useMemo<SalesSummary>(() => {
    const sales = items.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
    const cogs = items.reduce((sum, row) => sum + Number(row.totalCogs || 0), 0);
    const posted = items.filter((row) => row.isInventoryPosted).length;
    const grossProfit = sales - cogs;

    return {
      sales,
      cogs,
      grossProfit,
      margin: sales > 0 ? (grossProfit / sales) * 100 : 0,
      transactions: items.length,
      avgTicket: items.length > 0 ? sales / items.length : 0,
      posted,
      pending: items.length - posted,
    };
  }, [items]);

  const handlePostBulkCogs = async () => {
    if (!canQuery) {
      setErr("Company and branch are required.");
      return;
    }

    setPostingCogs(true);
    setErr(null);

    try {
      await salesApi.postBulkCogs(companyId, branchId, {
        fromDate,
        toDate,
      });

      await load();
    } catch (e) {
      setErr(extractApiError(e, "Failed to post bulk COGS."));
    } finally {
      setPostingCogs(false);
    }
  };

  return (
    <div className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title">
          <h1>Sales Reports</h1>
          <p>Daily sales, COGS, gross profit, and inventory-posting status.</p>
        </div>

        <div className="pos-actions">
          <label className="pos-field">
            <span>From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>

          <label className="pos-field">
            <span>To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>

          <Button variant="primary" onClick={load} disabled={loading || postingCogs}>
            {loading ? "Loading..." : "Run"}
          </Button>

          <Button
            variant="secondary"
            onClick={handlePostBulkCogs}
            disabled={loading || postingCogs || items.length === 0}
          >
            {postingCogs ? "Posting COGS..." : "Post Pending COGS"}
          </Button>
        </div>
      </div>

      {!canQuery && (
        <Alert tone="danger">
          Missing company or branch context. Please select company and branch again.
        </Alert>
      )}

      {err && <Alert tone="danger">{err}</Alert>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <Kpi label="Sales" value={money(summary.sales)} />
        <Kpi label="COGS" value={money(summary.cogs)} />
        <Kpi label="Gross Profit" value={money(summary.grossProfit)} />
        <Kpi label="Margin" value={`${summary.margin.toFixed(1)}%`} />
        <Kpi label="Transactions" value={summary.transactions} />
        <Kpi label="Average Ticket" value={money(summary.avgTicket)} />
        <Kpi label="Inventory Posted" value={summary.posted} />
        <Kpi label="Inventory Pending" value={summary.pending} />
      </div>

      <Card title="Report Detail">
        <table className="pos-table">
          <thead>
            <tr>
              <th>Sale</th>
              <th>Date</th>
              <th style={{ textAlign: "right" }}>Sales</th>
              <th style={{ textAlign: "right" }}>COGS</th>
              <th style={{ textAlign: "right" }}>Profit</th>
              <th>Inventory</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 24 }}>
                  {loading ? "Loading sales..." : "No sales found for this date range."}
                </td>
              </tr>
            )}

            {items.map((row) => {
              const totalAmount = Number(row.totalAmount || 0);
              const totalCogs = Number(row.totalCogs || 0);
              const grossProfit =
                typeof row.grossProfit === "number"
                  ? row.grossProfit
                  : totalAmount - totalCogs;

              return (
                <tr key={row.id}>
                  <td>{row.saleNo || row.id}</td>
                  <td>{formatDate(row.soldAtUtc)}</td>
                  <td style={{ textAlign: "right" }}>{money(totalAmount)}</td>
                  <td style={{ textAlign: "right" }}>{money(totalCogs)}</td>
                  <td style={{ textAlign: "right" }}>{money(grossProfit)}</td>
                  <td>{row.isInventoryPosted ? "Posted" : "Pending"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}