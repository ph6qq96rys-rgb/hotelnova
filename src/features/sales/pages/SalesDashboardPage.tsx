// src/features/sales/pages/SalesDashboardPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Monitor,
  RefreshCw,
  ShoppingCart,
  Upload,
} from "lucide-react";

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

const DASHBOARD_PAGE_SIZE = 50;
const RECENT_SALES_LIMIT = 10;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded" }
  | { status: "error"; message: string };

type SalesPaths = {
  pos: string;
  session: string;
  import: string;
  register: string;
  reports: string;
  saleDetail: (saleId: string) => string;
};

type SalesSummary = {
  totalSales: number;
  totalCogs: number;
  grossProfit: number;
  margin: number;
  transactions: number;
  avgTicket: number;
  pendingInventory: number;
  postedInventory: number;
};

function buildSalesPaths(companyId: string): SalesPaths {
  const base = `/companies/${companyId}/sales`;

  return {
    pos: `${base}/pos`,
    session: `${base}/pos/session`,
    import: `${base}/import`,
    register: `${base}/list`,
    reports: `${base}/reports`,
    saleDetail: (saleId: string) => `${base}/${saleId}`,
  };
}

function formatRefreshText(pageState: PageState, lastLoadedAt: Date | null): string {
  if (pageState.status === "loading") return "Refreshing dashboard...";
  if (pageState.status === "error") return "Dashboard refresh failed";
  if (lastLoadedAt) return `Last refreshed ${lastLoadedAt.toLocaleTimeString()}`;
  return "Ready for refresh";
}

function buildSummary(sales: SaleListItemDto[]): SalesSummary {
  const totalSales = sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
  const totalCogs = sales.reduce((sum, sale) => sum + Number(sale.totalCogs || 0), 0);
  const grossProfit = totalSales - totalCogs;
  const transactions = sales.length;

  return {
    totalSales,
    totalCogs,
    grossProfit,
    margin: totalSales > 0 ? (grossProfit / totalSales) * 100 : 0,
    transactions,
    avgTicket: transactions > 0 ? totalSales / transactions : 0,
    pendingInventory: sales.filter((sale) => !sale.isInventoryPosted).length,
    postedInventory: sales.filter((sale) => sale.isInventoryPosted).length,
  };
}

export default function SalesDashboardPage() {
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [sales, setSales] = useState<SaleListItemDto[]>([]);
  const [pageState, setPageState] = useState<PageState>({ status: "idle" });
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const requestIdRef = useRef(0);

  const paths = useMemo(() => (companyId ? buildSalesPaths(companyId) : null), [companyId]);
  const summary = useMemo(() => buildSummary(sales), [sales]);

  const loading = pageState.status === "loading";
  const errorMessage = pageState.status === "error" ? pageState.message : null;
  const refreshText = formatRefreshText(pageState, lastLoadedAt);

  const go = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  const load = useCallback(async () => {
    if (!companyId || !branchId) {
      setSales([]);
      setPageState({
        status: "error",
        message:
          "Company and branch context are required before the sales dashboard can be loaded.",
      });
      return;
    }

    const requestId = ++requestIdRef.current;
    setPageState({ status: "loading" });

    try {
      const response = await salesApi.list(companyId, branchId, {
        page: 1,
        pageSize: DASHBOARD_PAGE_SIZE,
        fromDate: todayIsoDate(),
        toDate: todayIsoDate(),
      });

      if (requestId !== requestIdRef.current) return;

      const data = response.data ?? response;
      setSales(Array.isArray(data.items) ? data.items : []);
      setLastLoadedAt(new Date());
      setPageState({ status: "loaded" });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;

      setSales([]);
      setPageState({
        status: "error",
        message: extractApiError(
          error,
          "The sales dashboard could not be refreshed. Please retry or contact your system administrator."
        ),
      });
    }
  }, [companyId, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId || !branchId || !paths) {
    return (
      <div className="pos-page">
        <Alert tone="warning">
          Company and branch context are required before opening the sales control dashboard.
        </Alert>
      </div>
    );
  }

  return (
    <div className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title">
          <h1>Sales Control Dashboard</h1>
          <p>
            Executive view of today&apos;s revenue, COGS, gross profit, cashier activity,
            and inventory accounting status.
          </p>
          <p style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>{refreshText}</p>
        </div>

        <div className="pos-actions">
          <Button onClick={() => go(paths.pos)}>
            <Monitor size={16} /> POS Terminal
          </Button>

          <Button onClick={() => go(paths.session)}>
            <CalendarClock size={16} /> Session Control
          </Button>

          <Button onClick={() => go(paths.import)}>
            <Upload size={16} /> Import Sales
          </Button>

          <Button variant="primary" onClick={() => go(paths.register)}>
            <ShoppingCart size={16} /> Sales Register
          </Button>
        </div>
      </div>

      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}

      <SalesKpis summary={summary} />

      {summary.pendingInventory > 0 ? (
        <Alert tone="warning">
          <AlertTriangle size={16} /> {summary.pendingInventory} sale
          {summary.pendingInventory !== 1 ? "s" : ""} require inventory and COGS posting
          before the day can be fully reconciled.
        </Alert>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 0.8fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        <RecentSalesCard
          sales={sales}
          loading={loading}
          onRefresh={() => void load()}
          onOpenSale={(saleId) => go(paths.saleDetail(saleId))}
        />

        <QuickActionsCard paths={paths} go={go} />
      </div>
    </div>
  );
}

function SalesKpis({ summary }: { summary: SalesSummary }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
        gap: 12,
        marginBottom: 14,
      }}
    >
      <Kpi label="Net Sales Today" value={money(summary.totalSales)} />
      <Kpi label="Cost of Goods Sold" value={money(summary.totalCogs)} />
      <Kpi label="Gross Profit" value={money(summary.grossProfit)} />
      <Kpi label="Gross Margin" value={`${summary.margin.toFixed(1)}%`} />
      <Kpi label="Transactions" value={summary.transactions} />
      <Kpi label="Average Ticket" value={money(summary.avgTicket)} />
      <Kpi label="Inventory Posted" value={summary.postedInventory} />
      <Kpi label="Inventory Pending" value={summary.pendingInventory} />
    </div>
  );
}

function RecentSalesCard({
  sales,
  loading,
  onRefresh,
  onOpenSale,
}: {
  sales: SaleListItemDto[];
  loading: boolean;
  onRefresh: () => void;
  onOpenSale: (saleId: string) => void;
}) {
  const subtitle = loading
    ? "Refreshing today&apos;s transaction register"
    : `${sales.length} transaction${sales.length === 1 ? "" : "s"} recorded today`;

  return (
    <Card
      title="Recent Sales Activity"
      subtitle={subtitle}
      action={
        <Button size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <div style={{ overflowX: "auto" }}>
        <table className="pos-table">
          <thead>
            <tr>
              <th>Sale No.</th>
              <th>Transaction Time</th>
              <th>Sale Status</th>
              <th>Payment Status</th>
              <th style={{ textAlign: "right" }}>Net Amount</th>
              <th>Inventory Accounting</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 28 }}>
                  Loading today&apos;s sales activity...
                </td>
              </tr>
            ) : null}

            {!loading && sales.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 28 }}>
                  No sales transactions have been recorded for today.
                </td>
              </tr>
            ) : null}

            {!loading
              ? sales.slice(0, RECENT_SALES_LIMIT).map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => onOpenSale(sale.id)}
                    style={{ cursor: "pointer" }}
                    title="Open sale detail"
                  >
                    <td style={{ fontFamily: "monospace" }}>{sale.saleNo}</td>
                    <td>{dateTime(sale.soldAtUtc)}</td>
                    <td>
                      <SaleStatusBadge status={sale.status} />
                    </td>
                    <td>
                      <PaymentStatusBadge status={sale.paymentStatus} />
                    </td>
                    <td style={{ textAlign: "right" }}>{money(sale.totalAmount)}</td>
                    <td>
                      <InventoryBadge posted={sale.isInventoryPosted} />
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function QuickActionsCard({ paths, go }: { paths: SalesPaths; go: (path: string) => void }) {
  return (
    <Card title="Operational Shortcuts" subtitle="Daily sales and POS control workflow">
      <div style={{ display: "grid", gap: 10 }}>
        <Button variant="primary" size="lg" block onClick={() => go(paths.pos)}>
          <Monitor size={16} /> Start POS Transaction
        </Button>

        <Button block onClick={() => go(paths.session)}>
          <CalendarClock size={16} /> Open / Close Cashier Session
        </Button>

        <Button block onClick={() => go(paths.register)}>
          <ShoppingCart size={16} /> Review Sales Register
        </Button>

        <Button block onClick={() => go(paths.reports)}>
          <BarChart3 size={16} /> Open Sales Reports
        </Button>

        <Button block onClick={() => go(paths.import)}>
          <Upload size={16} /> Import External POS Sales
        </Button>
      </div>
    </Card>
  );
}
