// src/features/sales/pages/SalesDashboardPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Monitor,
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

const TODAY = new Date().toISOString().slice(0, 10);

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

export default function SalesDashboardPage() {
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [sales, setSales] = useState<SaleListItemDto[]>([]);
  const [pageState, setPageState] = useState<PageState>({ status: "idle" });
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const requestIdRef = useRef(0);

  const paths = useMemo<SalesPaths | null>(() => {
    if (!companyId) return null;

    const base = `/companies/${companyId}/sales`;

    return {
      pos: `${base}/pos`,
      session: `${base}/pos/session`,
      import: `${base}/import`,
      register: `${base}/list`,
      reports: `${base}/reports`,
      saleDetail: (saleId: string) => `${base}/${saleId}`,
    };
  }, [companyId]);

  const go = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  const loading = pageState.status === "loading";
  const errorMessage = pageState.status === "error" ? pageState.message : null;

  const load = useCallback(async () => {
    if (!companyId || !branchId) {
      setSales([]);
      setPageState({
        status: "error",
        message: "Company and branch context are required to load sales.",
      });
      return;
    }

    const requestId = ++requestIdRef.current;

    setPageState({ status: "loading" });

    try {
      const response = await salesApi.list(companyId, branchId, {
        page: 1,
        pageSize: 50,
        fromDate: TODAY,
        toDate: TODAY,
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
        message: extractApiError(error, "Failed to load sales dashboard."),
      });
    }
  }, [companyId, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const totalSales = sales.reduce((sum, sale) => {
      return sum + Number(sale.totalAmount || 0);
    }, 0);

    const totalCogs = sales.reduce((sum, sale) => {
      return sum + Number(sale.totalCogs || 0);
    }, 0);

    const grossProfit = totalSales - totalCogs;
    const transactions = sales.length;
    const avgTicket = transactions > 0 ? totalSales / transactions : 0;

    const pendingInventory = sales.filter((sale) => !sale.isInventoryPosted).length;
    const postedInventory = sales.filter((sale) => sale.isInventoryPosted).length;

    return {
      totalSales,
      totalCogs,
      grossProfit,
      margin: totalSales > 0 ? (grossProfit / totalSales) * 100 : 0,
      transactions,
      avgTicket,
      pendingInventory,
      postedInventory,
    };
  }, [sales]);

  if (!companyId || !branchId || !paths) {
    return (
      <div className="pos-page">
        <Alert tone="warning">
          Company and branch context are required before opening the sales
          dashboard.
        </Alert>
      </div>
    );
  }

  const statusText = loading
    ? "Loading..."
    : errorMessage
    ? "Failed to load"
    : lastLoadedAt
    ? `Updated ${lastLoadedAt.toLocaleTimeString()}`
    : "Ready";

  return (
    <div className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title">
          <h1>Sales Dashboard</h1>
          <p>
            Today&apos;s sales, COGS, gross profit, POS sessions, and inventory
            posting status.
          </p>
          <p style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
            {statusText}
          </p>
        </div>

        <div className="pos-actions">
          <Button onClick={() => go(paths.pos)}>
            <Monitor size={16} /> POS Terminal
          </Button>

          <Button onClick={() => go(paths.session)}>
            <CalendarClock size={16} /> Session
          </Button>

          <Button onClick={() => go(paths.import)}>
            <Upload size={16} /> Import
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
          {summary.pendingInventory !== 1 ? "s" : ""} still need inventory/COGS
          posting.
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

function SalesKpis({
  summary,
}: {
  summary: {
    totalSales: number;
    totalCogs: number;
    grossProfit: number;
    margin: number;
    transactions: number;
    avgTicket: number;
    pendingInventory: number;
    postedInventory: number;
  };
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
        gap: 12,
        marginBottom: 14,
      }}
    >
      <Kpi label="Today's Sales" value={money(summary.totalSales)} />
      <Kpi label="COGS" value={money(summary.totalCogs)} />
      <Kpi label="Gross Profit" value={money(summary.grossProfit)} />
      <Kpi label="Margin" value={`${summary.margin.toFixed(1)}%`} />
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
  return (
    <Card
      title="Recent Sales"
      subtitle={loading ? "Loading..." : `${sales.length} sale(s) today`}
      action={
        <Button size="sm" onClick={onRefresh} disabled={loading}>
          Refresh
        </Button>
      }
    >
      <div style={{ overflowX: "auto" }}>
        <table className="pos-table">
          <thead>
            <tr>
              <th>Sale No</th>
              <th>Time</th>
              <th>Status</th>
              <th>Payment</th>
              <th style={{ textAlign: "right" }}>Total</th>
              <th>Inventory</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 28 }}>
                  Loading sales…
                </td>
              </tr>
            ) : null}

            {!loading && sales.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 28 }}>
                  No sales found for today.
                </td>
              </tr>
            ) : null}

            {!loading
              ? sales.slice(0, 10).map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => onOpenSale(sale.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontFamily: "monospace" }}>{sale.saleNo}</td>
                    <td>{dateTime(sale.soldAtUtc)}</td>
                    <td>
                      <SaleStatusBadge status={sale.status} />
                    </td>
                    <td>
                      <PaymentStatusBadge status={sale.paymentStatus} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {money(sale.totalAmount)}
                    </td>
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

function QuickActionsCard({
  paths,
  go,
}: {
  paths: SalesPaths;
  go: (path: string) => void;
}) {
  return (
    <Card title="Quick Actions" subtitle="Restaurant POS workflow">
      <div style={{ display: "grid", gap: 10 }}>
        <Button variant="primary" size="lg" block onClick={() => go(paths.pos)}>
          <Monitor size={16} /> Start New Order
        </Button>

        <Button block onClick={() => go(paths.session)}>
          <CalendarClock size={16} /> Open / Close Session
        </Button>

        <Button block onClick={() => go(paths.register)}>
          <ShoppingCart size={16} /> View Sales Register
        </Button>

        <Button block onClick={() => go(paths.reports)}>
          <BarChart3 size={16} /> Sales Reports
        </Button>

        <Button block onClick={() => go(paths.import)}>
          <Upload size={16} /> External POS Import
        </Button>
      </div>
    </Card>
  );
}