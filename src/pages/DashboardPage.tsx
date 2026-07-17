import { useCallback, useEffect, useMemo, useState } from "react";

import { getDashboardOverview } from "../api/dashboard/dashboardApi";
import type {
  DashboardOverviewDto,
  MenuEngineeringSummaryDto,
} from "../api/dashboard/dashboardTypes";
import { useAppScope } from "../app/useAppScope";
import { dashboardQuickActionPaths } from "../routes/routeConfig";
import { useErpNavigate } from "../routes/useErpNavigation";
import ModernDashboardView from "../components/ModernDashboardView";
import "../components/dashboard-modern-saas.css";

type DashboardState =
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

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDashboard(raw: any): DashboardOverviewDto {
  const salesSource = raw?.sales ?? raw ?? {};
  const inventorySource = raw?.inventorySummary ?? raw ?? {};
  const procurementSource = raw?.procurement ?? raw ?? {};
  const identitySource = raw?.identity ?? raw ?? {};
  const menuMap = raw?.menuEngineeringMap ?? {};

  const todaySales = toNumber(salesSource.todaySales);
  const todayCogs = toNumber(salesSource.todayCogs);
  const todayGrossProfit = toNumber(
    salesSource.todayGrossProfit ?? todaySales - todayCogs,
  );

  const todayMarginPct =
    salesSource.todayMarginPct != null
      ? toNumber(salesSource.todayMarginPct)
      : todaySales > 0
        ? (todayGrossProfit / todaySales) * 100
        : 0;

  const todayFoodCostPct =
    salesSource.todayFoodCostPct != null
      ? toNumber(salesSource.todayFoodCostPct)
      : todaySales > 0
        ? (todayCogs / todaySales) * 100
        : 0;

  return {
    generatedAtUtc: raw?.generatedAtUtc ?? new Date().toISOString(),

    sales: {
      todaySales,
      todayCogs,
      todayGrossProfit,
      todayOrders: toNumber(salesSource.todayOrders),
      averageOrderValue: toNumber(salesSource.averageOrderValue),
      todayMarginPct,
      todayFoodCostPct,
      last7DaysRevenue: toNumber(salesSource.last7DaysRevenue),
      last30DaysRevenue: toNumber(salesSource.last30DaysRevenue),
      yearToDateRevenue: toNumber(salesSource.yearToDateRevenue),
    },

    inventorySummary: {
      lowStockItems: toNumber(inventorySource.lowStockItems),
      inventoryValue:
        inventorySource.inventoryValue == null
          ? null
          : toNumber(inventorySource.inventoryValue),
      openTransfers: toNumber(inventorySource.openTransfers),
    },

    procurement: {
      pendingPurchaseOrders: toNumber(
        procurementSource.pendingPurchaseOrders,
      ),
    },

    identity: {
      totalUsers: toNumber(identitySource.totalUsers),
      totalRoles: toNumber(identitySource.totalRoles),
    },

    hr: raw?.hr ?? null,

    menuEngineering: raw?.menuEngineering ?? {
      ...zeroMenuEngineering,
      star: toNumber(menuMap.star ?? menuMap.STAR ?? menuMap.Star),
      puzzle: toNumber(
        menuMap.puzzle ?? menuMap.PUZZLE ?? menuMap.Puzzle,
      ),
      plowhorse: toNumber(
        menuMap.plowhorse ??
          menuMap.PLOWHORSE ??
          menuMap.Plowhorse ??
          menuMap.PlowHorse,
      ),
      dog: toNumber(menuMap.dog ?? menuMap.DOG ?? menuMap.Dog),
    },

    alerts: Array.isArray(raw?.alerts) ? raw.alerts : [],
    bestSellers: Array.isArray(raw?.bestSellers) ? raw.bestSellers : [],
    inventory: Array.isArray(raw?.inventory)
      ? raw.inventory
      : Array.isArray(raw?.lowInventory)
        ? raw.lowInventory
        : [],
    revenueTrend: Array.isArray(raw?.revenueTrend)
      ? raw.revenueTrend
      : [],
    foodCostTrend: Array.isArray(raw?.foodCostTrend)
      ? raw.foodCostTrend
      : [],
  };
}

function extractErrorMessage(error: unknown): string {
  const candidate = error as any;

  return (
    candidate?.response?.data?.message ??
    candidate?.response?.data?.error ??
    candidate?.response?.data?.title ??
    candidate?.message ??
    "Failed to load dashboard."
  );
}

function useSafeErpNavigation() {
  const navigation = useErpNavigate() as any;

  const go = useCallback(
    (path: string, options?: { replace?: boolean }) => {
      if (typeof navigation === "function") {
        navigation(path, options);
        return;
      }

      if (typeof navigation?.go === "function") {
        navigation.go(path, options?.replace);
        return;
      }

      console.error("Invalid ERP navigation hook result", navigation);
    },
    [navigation],
  );

  return { go };
}

export default function DashboardPage() {
  const { go } = useSafeErpNavigation();
  const { companyId } = useAppScope();

  const [state, setState] = useState<DashboardState>({ status: "idle" });
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  const inventoryItemsPath = companyId
    ? `/companies/${companyId}/inventory-master/items`
    : "/platform";

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
    [inventoryItemsPath],
  );

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
        if (controller.signal.aborted) return;

        setState({
          status: "loaded",
          data: normalizeDashboard(raw),
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        setState({
          status: "error",
          message: extractErrorMessage(error),
        });
      });

    return () => controller.abort();
  }, [companyId, reloadKey]);

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="page modern-saas-dashboard">
        <DashboardLoadingState />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="page modern-saas-dashboard">
        <DashboardErrorState
          message={state.message}
          onRetry={reload}
        />
      </div>
    );
  }

  const updatedAt = new Date(
    state.data.generatedAtUtc,
  ).toLocaleString();

  return (
    <div className="page">
      <ModernDashboardView
        dashboard={state.data}
        updatedAt={updatedAt}
        actions={actions}
        onNavigate={go}
        onRefresh={reload}
        refreshing={false}
      />
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <>
      <header className="saas-page-header">
        <div>
          <div className="saas-eyebrow">RestaurantFNB Command Center</div>
          <h1>Operations dashboard</h1>
          <p>Loading live operational data…</p>
        </div>
      </header>

      <section className="saas-kpi-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="saas-skeleton saas-kpi-skeleton"
          />
        ))}
      </section>

      <section className="saas-dashboard-layout">
        <div className="saas-skeleton" style={{ height: 520 }} />
        <div className="saas-skeleton" style={{ height: 520 }} />
      </section>
    </>
  );
}

function DashboardErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <>
      <header className="saas-page-header">
        <div>
          <div className="saas-eyebrow">RestaurantFNB Command Center</div>
          <h1>Operations dashboard</h1>
          <p>The dashboard could not be loaded.</p>
        </div>
      </header>

      <div className="saas-error-panel">
        <div className="saas-error-icon">
          <i className="ti ti-alert-triangle" aria-hidden="true" />
        </div>

        <div>
          <strong>Couldn’t load dashboard</strong>
          <p>{message}</p>
        </div>

        <button
          type="button"
          className="saas-btn saas-btn-secondary"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    </>
  );
}
