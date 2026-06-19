import { useCallback, useEffect, useMemo, useState } from "react";

import { getDashboardOverview } from "../api/dashboard/dashboardApi";
import type {
  BestSellerDto,
  DashboardAlertDto,
  DashboardOverviewDto,
  InventorySummaryDto,
  MenuEngineeringSummaryDto,
} from "../api/dashboard/dashboardTypes";
import { useAppScope } from "../app/useAppScope";
import { dashboardQuickActionPaths } from "../routes/routeConfig";
import { useErpNavigate } from "../routes/useErpNavigation";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: DashboardOverviewDto }
  | { status: "error"; message: string };

type QuickAction = {
  icon: string;
  title: string;
  sub: string;
  href: string;
};

const zeroMenuEngineering: MenuEngineeringSummaryDto = {
  star: 0,
  puzzle: 0,
  plowhorse: 0,
  dog: 0,
};

const fmtMoney = (value?: number | null) =>
  "$" +
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const fmtPct = (value?: number | null) => `${Number(value ?? 0).toFixed(1)}%`;

const fmtNum = (value?: number | null) =>
  new Intl.NumberFormat(undefined).format(Number(value ?? 0));

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDashboard(raw: any): DashboardOverviewDto {
  const salesSource = raw?.sales ?? raw ?? {};
  const inventorySource = raw?.inventorySummary ?? raw ?? {};
  const procurementSource = raw?.procurement ?? raw ?? {};
  const identitySource = raw?.identity ?? raw ?? {};
  const menuMap = raw?.menuEngineeringMap ?? {};

  const todaySales = num(salesSource.todaySales);
  const todayCogs = num(salesSource.todayCogs);
  const todayGrossProfit = num(
    salesSource.todayGrossProfit ?? todaySales - todayCogs
  );

  const todayMarginPct =
    salesSource.todayMarginPct != null
      ? num(salesSource.todayMarginPct)
      : todaySales > 0
      ? (todayGrossProfit / todaySales) * 100
      : 0;

  const todayFoodCostPct =
    salesSource.todayFoodCostPct != null
      ? num(salesSource.todayFoodCostPct)
      : todaySales > 0
      ? (todayCogs / todaySales) * 100
      : 0;

  return {
    generatedAtUtc: raw?.generatedAtUtc ?? new Date().toISOString(),

    sales: {
      todaySales,
      todayCogs,
      todayGrossProfit,
      todayOrders: num(salesSource.todayOrders),
      averageOrderValue: num(salesSource.averageOrderValue),
      todayMarginPct,
      todayFoodCostPct,
      last7DaysRevenue: num(salesSource.last7DaysRevenue),
      last30DaysRevenue: num(salesSource.last30DaysRevenue),
      yearToDateRevenue: num(salesSource.yearToDateRevenue),
    },

    inventorySummary: {
      lowStockItems: num(inventorySource.lowStockItems),
      inventoryValue:
        inventorySource.inventoryValue == null
          ? null
          : num(inventorySource.inventoryValue),
      openTransfers: num(inventorySource.openTransfers),
    },

    procurement: {
      pendingPurchaseOrders: num(procurementSource.pendingPurchaseOrders),
    },

    identity: {
      totalUsers: num(identitySource.totalUsers),
      totalRoles: num(identitySource.totalRoles),
    },

    hr: raw?.hr ?? null,

    menuEngineering: raw?.menuEngineering ?? {
      star: num(menuMap.star ?? menuMap.STAR ?? menuMap.Star),
      puzzle: num(menuMap.puzzle ?? menuMap.PUZZLE ?? menuMap.Puzzle),
      plowhorse: num(
        menuMap.plowhorse ??
          menuMap.PLOWHORSE ??
          menuMap.Plowhorse ??
          menuMap.PlowHorse
      ),
      dog: num(menuMap.dog ?? menuMap.DOG ?? menuMap.Dog),
    },

    alerts: Array.isArray(raw?.alerts) ? raw.alerts : [],
    bestSellers: Array.isArray(raw?.bestSellers) ? raw.bestSellers : [],
    inventory: Array.isArray(raw?.inventory)
      ? raw.inventory
      : Array.isArray(raw?.lowInventory)
      ? raw.lowInventory
      : [],
    revenueTrend: Array.isArray(raw?.revenueTrend) ? raw.revenueTrend : [],
    foodCostTrend: Array.isArray(raw?.foodCostTrend) ? raw.foodCostTrend : [],
  };
}

function extractErrorMessage(err: unknown): string {
  const anyErr = err as any;

  return (
    anyErr?.response?.data?.message ??
    anyErr?.response?.data?.error ??
    anyErr?.response?.data?.title ??
    anyErr?.message ??
    "Failed to load dashboard."
  );
}

function useSafeErpNavigation() {
  const erpNav = useErpNavigate() as any;

  const go = useCallback(
    (path: string, options?: { replace?: boolean }) => {
      if (typeof erpNav === "function") {
        erpNav(path, options);
        return;
      }

      if (typeof erpNav?.go === "function") {
        erpNav.go(path, options?.replace);
        return;
      }

      console.error("Invalid ERP navigation hook result", erpNav);
    },
    [erpNav]
  );

  return { go };
}

export default function DashboardPage() {
  const { go } = useSafeErpNavigation();
  const { companyId } = useAppScope();

  const [state, setState] = useState<State>({ status: "idle" });
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((value) => value + 1);
  const inventoryItemsPath = companyId
  ? `/companies/${companyId}/inventory-master/items`
  : "/platform";

  useEffect(() => {
    if (!companyId) {
      setState({
        status: "error",
        message: "Missing company context. Please select a company workspace.",
      });
      return;
    }

    const controller = new AbortController();

    setState({ status: "loading" });

    getDashboardOverview(controller.signal)
      .then((raw) => {
        setState({
          status: "loaded",
          data: normalizeDashboard(raw),
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;

        setState({
          status: "error",
          message: extractErrorMessage(err),
        });
      });

    return () => controller.abort();
  }, [companyId, reloadKey]);

  const actions = useMemo<QuickAction[]>(
    () => [
      {
        icon: "ti-package",
        title: "Inventory Items",
        sub: "Manage inventory master",
        href: inventoryItemsPath,
      },
      {
        icon: "ti-arrows-transfer-up-down",
        title: "Stock Transfer",
        sub: "Move inventory",
        href: dashboardQuickActionPaths.stockTransferNew,
      },
      {
        icon: "ti-adjustments",
        title: "Stock Adjustment",
        sub: "Adjust inventory",
        href: dashboardQuickActionPaths.adjustmentNew,
      },
      {
        icon: "ti-tools-kitchen-2",
        title: "Production Batch",
        sub: "Execute recipe",
        href: dashboardQuickActionPaths.productionBatchNew,
      },
      {
        icon: "ti-chef-hat",
        title: "Recipe Management",
        sub: "Manage recipes",
        href: dashboardQuickActionPaths.recipeManagement,
      },
      {
        icon: "ti-chart-dots",
        title: "Menu Engineering",
        sub: "Boston Matrix",
        href: dashboardQuickActionPaths.menuEngineering,
      },
    ],
    []
  );

  const updatedAt =
    state.status === "loaded"
      ? new Date(state.data.generatedAtUtc).toLocaleString()
      : null;

  const header = (
    <div className="page-header">
      <div>
        <div className="page-kicker">Operations</div>
        <div className="page-title">Dashboard</div>
        <div className="page-sub">
          {updatedAt ? `Updated ${updatedAt}` : "Overview & quick actions"}
        </div>
      </div>

      <button
        type="button"
        className="btn"
        onClick={reload}
        disabled={state.status === "loading"}
      >
        <i className="ti ti-refresh" aria-hidden="true" />
        {state.status === "loading" ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="page">
        {header}

        <div className="kpi-grid" style={{ marginBottom: 20 }}>
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="skeleton kpi" style={{ height: 88 }} />
          ))}
        </div>

        <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="page">
        {header}

        <div className="alert alert-danger">
          <strong>Couldn't load dashboard</strong>
          <p style={{ marginTop: 4, fontSize: 12 }}>{state.message}</p>

          <button type="button" className="btn btn-sm" onClick={reload}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const dashboard = state.data;
  const sales = dashboard.sales;
  const inventorySummary = dashboard.inventorySummary;
  const procurement = dashboard.procurement;
  const identity = dashboard.identity;
  const hr = dashboard.hr ?? null;

  const alerts = Array.isArray(dashboard.alerts) ? dashboard.alerts : [];
  const bestSellers = Array.isArray(dashboard.bestSellers)
    ? dashboard.bestSellers
    : [];
  const lowInventory = Array.isArray(dashboard.inventory)
    ? dashboard.inventory
    : [];

  const menuEngineering = dashboard.menuEngineering ?? zeroMenuEngineering;

  const menuEngineeringTotal =
    num(menuEngineering.star) +
    num(menuEngineering.puzzle) +
    num(menuEngineering.plowhorse) +
    num(menuEngineering.dog);

  const kpis = [
    {
      label: "Today's revenue",
      value: fmtMoney(sales.todaySales),
      sub: "Gross sales today",
    },
    {
      label: "Orders today",
      value: fmtNum(sales.todayOrders),
      sub:
        Number(sales.todayOrders ?? 0) > 0
          ? `avg ${fmtMoney(sales.averageOrderValue)} / order`
          : "No orders yet",
    },
    {
      label: "Gross profit",
      value: fmtMoney(sales.todayGrossProfit),
      sub: `${fmtPct(sales.todayMarginPct)} margin`,
      badge: sales.todayMarginPct >= 50 ? "On target" : "Below target",
      badgeTone: sales.todayMarginPct >= 50 ? "up" : "warn",
    },
    {
      label: "COGS",
      value: fmtMoney(sales.todayCogs),
      sub: `${fmtPct(sales.todayFoodCostPct)} food cost`,
      badge: sales.todayFoodCostPct > 40 ? "High" : undefined,
      badgeTone: sales.todayFoodCostPct > 40 ? "down" : undefined,
    },
    {
      label: "Low stock items",
      value: fmtNum(inventorySummary.lowStockItems),
      sub: "Below reorder level",
      badge: inventorySummary.lowStockItems > 0 ? "Action needed" : undefined,
      badgeTone: inventorySummary.lowStockItems > 0 ? "warn" : undefined,
    },
    {
      label: "Transfer requests",
      value: fmtNum(inventorySummary.openTransfers),
      sub: "In progress",
    },
    {
      label: "Pending POs",
      value: fmtNum(procurement.pendingPurchaseOrders),
      sub: "Awaiting approval / receiving",
    },
    {
      label: "Users",
      value: fmtNum(identity.totalUsers),
      sub: `${fmtNum(identity.totalRoles)} roles configured`,
    },
  ] as const;

  return (
    <div className="page">
      {header}

      {alerts.length > 0 ? <DashboardAlerts alerts={alerts} go={go} /> : null}

      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="metrics-strip">
        <MetricCell
          label="7-day revenue"
          value={fmtMoney(sales.last7DaysRevenue)}
        />
        <MetricCell
          label="30-day revenue"
          value={fmtMoney(sales.last30DaysRevenue)}
        />
        <MetricCell
          label="YTD revenue"
          value={fmtMoney(sales.yearToDateRevenue)}
        />
        <MetricCell
          label="Avg food cost"
          value={fmtPct(sales.todayFoodCostPct)}
        />

        {hr ? (
          <>
            <MetricCell
              label="Present today"
              value={fmtNum(hr.employeesPresentToday)}
            />
            <MetricCell
              label="Late today"
              value={fmtNum(hr.employeesLateToday)}
            />
          </>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            bestSellers.length > 0 && menuEngineeringTotal > 0
              ? "1fr 1fr"
              : "1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {bestSellers.length > 0 ? (
          <BestSellersCard items={bestSellers} />
        ) : null}

        {menuEngineeringTotal > 0 ? (
          <MenuEngineeringCard
            summary={menuEngineering}
            total={menuEngineeringTotal}
            go={go}
          />
        ) : null}
      </div>

      {lowInventory.length > 0 ? <InventoryCard items={lowInventory} /> : null}

      <div className="section">
        <div className="section-header">
          <div className="section-title">Quick actions</div>
        </div>

        <div className="act-grid">
          {actions.map((action) => (
            <button
              key={action.href}
              type="button"
              className="act-tile"
              onClick={() => go(action.href)}
              style={{
                textAlign: "left",
                border: "none",
                cursor: "pointer",
              }}
            >
              <div className="act-icon">
                <i className={`ti ${action.icon}`} aria-hidden="true" />
              </div>

              <div className="act-title">{action.title}</div>
              <div className="act-sub">{action.sub}</div>
              <div className="act-arr">→</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardAlerts({
  alerts,
  go,
}: {
  alerts: DashboardAlertDto[];
  go: (path: string) => void;
}) {
  return (
    <div className="section" style={{ marginBottom: 16 }}>
      <div className="section-header">
        <div className="section-title">Operational alerts</div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {alerts.map((alert) => {
          const alertClass =
            alert.severity === "critical"
              ? "alert alert-danger"
              : alert.severity === "warning"
              ? "alert alert-warning"
              : "alert alert-info";

          return (
            <button
              key={alert.key}
              type="button"
              className={alertClass}
              onClick={() => {
                if (alert.route) go(alert.route);
              }}
              style={{
                textAlign: "left",
                cursor: alert.route ? "pointer" : "default",
                border: "none",
              }}
            >
              <strong>
                {alert.count != null ? `${fmtNum(alert.count)} ` : ""}
                {alert.title}
              </strong>

              {alert.message ? (
                <p style={{ marginTop: 4, fontSize: 12 }}>{alert.message}</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BestSellersCard({ items }: { items: BestSellerDto[] }) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Best sellers</div>
          <div className="card-subtitle">Last 30 days by profitability</div>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Item</th>
            <th style={{ textAlign: "right" }}>Units</th>
            <th style={{ textAlign: "right" }}>Revenue</th>
            <th style={{ textAlign: "right" }}>Profit</th>
            <th style={{ textAlign: "right" }}>Margin</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item, index) => (
            <tr key={item.itemId ?? `${item.itemName}-${index}`}>
              <td style={{ fontSize: 13 }}>{item.itemName}</td>
              <td className="mono-right">{fmtNum(item.unitsSold)}</td>
              <td className="mono-right">{fmtMoney(item.revenue)}</td>
              <td className="mono-right">{fmtMoney(item.grossProfit)}</td>
              <td className="mono-right">{fmtPct(item.marginPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MenuEngineeringCard({
  summary,
  total,
  go,
}: {
  summary: MenuEngineeringSummaryDto;
  total: number;
  go: (path: string) => void;
}) {
  const quadrants = [
    { key: "star", label: "Stars", value: summary.star },
    { key: "puzzle", label: "Puzzles", value: summary.puzzle },
    { key: "plowhorse", label: "Plowhorses", value: summary.plowhorse },
    { key: "dog", label: "Dogs", value: summary.dog },
  ];

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Menu engineering</div>
          <div className="card-subtitle">
            Boston Matrix — {fmtNum(total)} items analysed
          </div>
        </div>

        <button
          type="button"
          className="btn btn-sm"
          onClick={() => go(dashboardQuickActionPaths.menuEngineering)}
        >
          Full report
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 1,
          background: "var(--border-soft)",
        }}
      >
        {quadrants.map((quadrant) => (
          <button
            key={quadrant.key}
            type="button"
            onClick={() =>
              go(`${dashboardQuickActionPaths.menuEngineering}?quadrant=${quadrant.key}`)
            }
            style={{
              padding: "16px 20px",
              background: "var(--surface)",
              border: "none",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                fontFamily: "var(--mono)",
              }}
            >
              {quadrant.label}
            </div>

            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {fmtNum(quadrant.value)}
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              items
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function InventoryCard({ items }: { items: InventorySummaryDto[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Inventory watchlist</div>
          <div className="card-subtitle">Items requiring stock attention</div>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Location</th>
            <th style={{ textAlign: "right" }}>Qty</th>
            <th style={{ textAlign: "right" }}>Available</th>
            <th style={{ textAlign: "right" }}>Reorder</th>
          </tr>
        </thead>

        <tbody>
          {items.slice(0, 8).map((item, index) => (
            <tr key={item.itemId ?? `${item.itemName}-${index}`}>
              <td>{item.itemName}</td>
              <td>{item.locationName ?? "—"}</td>
              <td className="mono-right">
                {fmtNum(item.quantity)} {item.uomCode ?? ""}
              </td>
              <td className="mono-right">{fmtNum(item.availableQuantity)}</td>
              <td className="mono-right">{fmtNum(item.reorderLevel)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-cell">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  badge,
  badgeTone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  badge?: string;
  badgeTone?: "up" | "down" | "warn";
}) {
  const badgeClass =
    badgeTone === "up"
      ? "kpi-badge badge-up"
      : badgeTone === "down"
      ? "kpi-badge badge-down"
      : badgeTone === "warn"
      ? "kpi-badge badge-warn"
      : "kpi-badge";

  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-val">{value}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
      {badge ? <div className={badgeClass}>{badge}</div> : null}
    </div>
  );
}