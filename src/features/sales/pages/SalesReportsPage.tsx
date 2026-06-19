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

type AppScope = {
  companyId: string;
  branchId: string;
};

function clean(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readJsonStorage(key: string): any | null {
  const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readJwtPayload(token?: string | null): any | null {
  if (!token || !token.includes(".")) return null;

  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(normalized));
  } catch {
    return null;
  }
}

function getStoredValue(keys: string[]): string {
  for (const key of keys) {
    const value = clean(localStorage.getItem(key) ?? sessionStorage.getItem(key));
    if (value) return value;
  }

  return "";
}

function resolveAppScope(): AppScope {
  const auth =
    readJsonStorage("auth") ??
    readJsonStorage("authState") ??
    readJsonStorage("restaurantfnb.auth") ??
    readJsonStorage("hotelnova.auth");

  const token =
    clean(auth?.accessToken) ||
    clean(auth?.token) ||
    clean(localStorage.getItem("accessToken")) ||
    clean(sessionStorage.getItem("accessToken"));

  const claims = readJwtPayload(token);

  const companyId =
    getStoredValue(["companyId", "company_id", "selectedCompanyId"]) ||
    clean(auth?.companyId) ||
    clean(auth?.company_id) ||
    clean(claims?.company_id) ||
    clean(claims?.CompanyId);

  const branchId =
    getStoredValue(["branchId", "branch_id", "selectedBranchId"]) ||
    clean(auth?.branchId) ||
    clean(auth?.branch_id) ||
    clean(claims?.branch_id) ||
    clean(claims?.BranchId);

  return {
    companyId,
    branchId,
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
  if (Array.isArray(data?.data?.items)) return data.data.items;

  return [];
}

export default function SalesReportsPage() {
  const [scope, setScope] = useState<AppScope>(() => resolveAppScope());

  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());

  const [items, setItems] = useState<SaleListItemDto[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [postingCogs, setPostingCogs] = useState(false);

  const companyId = scope.companyId;
  const branchId = scope.branchId;

  const canQuery = Boolean(companyId && branchId);

  const refreshScope = useCallback(() => {
    const next = resolveAppScope();
    setScope(next);

    if (!next.companyId || !next.branchId) {
      setItems([]);
      setErr(
        "Missing company or branch context. Please switch tenant again or select a default branch."
      );
    } else {
      setErr(null);
    }

    return next;
  }, []);

  const load = useCallback(async () => {
    const activeScope = refreshScope();

    if (!activeScope.companyId || !activeScope.branchId) {
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const response = await salesApi.list(
        activeScope.companyId,
        activeScope.branchId,
        {
          page: 1,
          pageSize: 100,
          fromDate,
          toDate,
        }
      );

      setItems(normalizeSalesList(response));
    } catch (e) {
      setErr(extractApiError(e, "Failed to load sales reports."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, refreshScope, toDate]);

  useEffect(() => {
    const activeScope = refreshScope();

    if (activeScope.companyId && activeScope.branchId) {
      void load();
    }
  }, [load, refreshScope]);

  const summary = useMemo<SalesSummary>(() => {
    const sales = items.reduce(
      (sum, row) => sum + Number(row.totalAmount || 0),
      0
    );

    const cogs = items.reduce(
      (sum, row) => sum + Number(row.totalCogs || 0),
      0
    );

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
    const activeScope = refreshScope();

    if (!activeScope.companyId || !activeScope.branchId) {
      return;
    }

    setPostingCogs(true);
    setErr(null);

    try {
      await salesApi.postBulkCogs(activeScope.companyId, activeScope.branchId, {
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
            disabled={loading || postingCogs || items.length === 0 || !canQuery}
          >
            {postingCogs ? "Posting COGS..." : "Post Pending COGS"}
          </Button>
        </div>
      </div>

      {!canQuery && (
        <Alert tone="danger">
          Missing company or branch context. Please switch tenant again or make sure
          the selected user has a default branch.
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