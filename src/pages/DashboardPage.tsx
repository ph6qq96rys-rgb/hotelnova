import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getDashboardOverview } from "../api/dashboard/dashboardApi";
import type {
  DashboardOverviewDto,
  MenuEngineeringSummaryDto,
} from "../api/dashboard/dashboardTypes";
import { useAppScope } from "../app/useAppScope";
import { useAuth } from "../auth/AuthProvider";
import { hasErpPermission } from "../auth/erpAccess";
import { dashboardQuickActionPaths } from "../routes/routeConfig";
import { useErpNavigate } from "../routes/useErpNavigation";
import ModernDashboardView from "../components/ModernDashboardView";
import "../components/dashboard-modern-saas.css";

/** Figures refresh on their own while the page is visible. */
const AUTO_REFRESH_MS = 5 * 60 * 1000;

type DashboardState =
  | { status: "loading" }
  | { status: "loaded"; data: DashboardOverviewDto; refreshing: boolean; refreshError: string | null }
  | { status: "error"; message: string; forbidden: boolean };

type QuickAction = {
  icon: string;
  title: string;
  sub: string;
  href: string;
  permissions?: string[];
};

const zeroMenuEngineering: MenuEngineeringSummaryDto = { star: 0, puzzle: 0, plowhorse: 0, dog: 0 };

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
  const todayGrossProfit = toNumber(salesSource.todayGrossProfit ?? todaySales - todayCogs);

  return {
    generatedAtUtc: raw?.generatedAtUtc ?? new Date().toISOString(),
    currencyCode: raw?.currencyCode ?? null,
    branchId: raw?.branchId ?? null,
    scopeName: raw?.scopeName ?? null,
    companyName: raw?.companyName ?? null,
    businessDate: raw?.businessDate ?? null,
    timeZone: raw?.timeZone ?? null,
    access: raw?.access ?? null,
    operations: raw?.operations ?? null,

    sales: {
      todaySales,
      todayCogs,
      todayGrossProfit,
      todayOrders: toNumber(salesSource.todayOrders),
      averageOrderValue: toNumber(salesSource.averageOrderValue),
      todayMarginPct:
        salesSource.todayMarginPct != null
          ? toNumber(salesSource.todayMarginPct)
          : todaySales > 0 ? (todayGrossProfit / todaySales) * 100 : 0,
      todayFoodCostPct:
        salesSource.todayFoodCostPct != null
          ? toNumber(salesSource.todayFoodCostPct)
          : todaySales > 0 ? (todayCogs / todaySales) * 100 : 0,
      last7DaysRevenue: toNumber(salesSource.last7DaysRevenue),
      last30DaysRevenue: toNumber(salesSource.last30DaysRevenue),
      yearToDateRevenue: toNumber(salesSource.yearToDateRevenue),
      sameTimeLastWeekSales: salesSource.sameTimeLastWeekSales == null ? null : toNumber(salesSource.sameTimeLastWeekSales),
      sameTimeLastWeekOrders: salesSource.sameTimeLastWeekOrders == null ? null : toNumber(salesSource.sameTimeLastWeekOrders),
    },

    inventorySummary: {
      lowStockItems: toNumber(inventorySource.lowStockItems),
      inventoryValue: inventorySource.inventoryValue == null ? null : toNumber(inventorySource.inventoryValue),
      openTransfers: toNumber(inventorySource.openTransfers),
      outOfStockItems: toNumber(inventorySource.outOfStockItems),
      lockedStockItems: toNumber(inventorySource.lockedStockItems),
    },

    procurement: {
      pendingPurchaseOrders: toNumber(procurementSource.pendingPurchaseOrders),
      pendingFnbApprovals: toNumber(procurementSource.pendingFnbApprovals),
      pendingFinanceApprovals: toNumber(procurementSource.pendingFinanceApprovals),
      approvedRequisitions: toNumber(procurementSource.approvedRequisitions),
    },

    identity: {
      totalUsers: toNumber(identitySource.totalUsers),
      totalRoles: toNumber(identitySource.totalRoles),
    },

    hr: raw?.hr ?? null,

    menuEngineering: raw?.menuEngineering ?? {
      ...zeroMenuEngineering,
      star: toNumber(menuMap.star ?? menuMap.STAR ?? menuMap.Star),
      puzzle: toNumber(menuMap.puzzle ?? menuMap.PUZZLE ?? menuMap.Puzzle),
      plowhorse: toNumber(menuMap.plowhorse ?? menuMap.PLOWHORSE ?? menuMap.Plowhorse ?? menuMap.PlowHorse),
      dog: toNumber(menuMap.dog ?? menuMap.DOG ?? menuMap.Dog),
    },

    businessHealth: raw?.businessHealth ?? null,
    alerts: Array.isArray(raw?.alerts) ? raw.alerts : [],
    bestSellers: Array.isArray(raw?.bestSellers) ? raw.bestSellers : [],
    inventory: Array.isArray(raw?.inventory) ? raw.inventory : Array.isArray(raw?.lowInventory) ? raw.lowInventory : [],
    revenueTrend: Array.isArray(raw?.revenueTrend) ? raw.revenueTrend : [],
    foodCostTrend: Array.isArray(raw?.foodCostTrend) ? raw.foodCostTrend : [],
  };
}

function extractErrorMessage(error: unknown): string {
  const candidate = error as any;
  return (
    candidate?.response?.data?.message ??
    candidate?.response?.data?.error ??
    candidate?.response?.data?.Error ??
    candidate?.response?.data?.title ??
    candidate?.message ??
    "Failed to load dashboard."
  );
}

function getStatusCode(error: unknown): number | null {
  const status = (error as any)?.response?.status;
  return Number.isFinite(status) ? Number(status) : null;
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
  const { companyId, branchId } = useAppScope();
  const auth = useAuth();

  const accessIdentity = useMemo(
    () => ({ roles: auth.roles, permissions: auth.permissions }),
    [auth.roles, auth.permissions],
  );

  const can = useCallback(
    (permission: string) => hasErpPermission(accessIdentity, permission),
    [accessIdentity],
  );

  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const stateRef = useRef(state);
  stateRef.current = state;
  const loadedAtRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  /** Loads the dashboard. A refresh keeps the current figures on screen until the new ones arrive. */
  const load = useCallback(async () => {
    if (!companyId) {
      setState({ status: "error", message: "Missing company context. Please select a company workspace.", forbidden: false });
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const current = stateRef.current;
    if (current.status === "loaded") setState({ ...current, refreshing: true, refreshError: null });
    else setState({ status: "loading" });

    try {
      const raw = await getDashboardOverview(branchId, controller.signal);
      if (controller.signal.aborted) return;
      loadedAtRef.current = Date.now();
      setState({ status: "loaded", data: normalizeDashboard(raw), refreshing: false, refreshError: null });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = extractErrorMessage(error);
      const latest = stateRef.current;
      if (latest.status === "loaded") {
        // Keep the last figures and say they could not be refreshed.
        setState({ ...latest, refreshing: false, refreshError: message });
        return;
      }
      const forbidden = getStatusCode(error) === 403;
      setState({
        status: "error",
        forbidden,
        message: forbidden ? "Your role does not include access to this dashboard. Ask your administrator if you need it." : message,
      });
    }
  }, [companyId, branchId]);

  // First load, and reload when the company or branch changes.
  useEffect(() => {
    setState({ status: "loading" });
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  // Auto-refresh while visible; catch up when the tab becomes visible again.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, AUTO_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAtRef.current > AUTO_REFRESH_MS) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const inventoryItemsPath = companyId ? `/companies/${companyId}/inventory-master/items` : "/platform";

  const actions = useMemo<QuickAction[]>(
    () => [
      { icon: "ti-clipboard-check", title: "Daily Operation Plan", sub: "Plan, brief, ready, close", href: "sales/operations", permissions: ["operations.view"] },
      { icon: "ti-package", title: "Inventory Items", sub: "Manage inventory master", href: inventoryItemsPath, permissions: ["items.view"] },
      { icon: "ti-arrows-transfer-up-down", title: "Stock Transfer", sub: "Move inventory", href: dashboardQuickActionPaths.stockTransferNew, permissions: ["stocktransfers.create"] },
      { icon: "ti-adjustments", title: "Stock Adjustment", sub: "Adjust inventory", href: dashboardQuickActionPaths.adjustmentNew, permissions: ["inventory.adjustments.create"] },
      { icon: "ti-tools-kitchen-2", title: "Production Batch", sub: "Execute recipe", href: dashboardQuickActionPaths.productionBatchNew, permissions: ["production.create"] },
      { icon: "ti-chef-hat", title: "Recipe Management", sub: "Manage recipes", href: dashboardQuickActionPaths.recipeManagement, permissions: ["recipes.view"] },
      { icon: "ti-chart-dots", title: "Menu Engineering", sub: "Boston Matrix", href: dashboardQuickActionPaths.menuEngineering, permissions: ["menu.view"] },
    ],
    [inventoryItemsPath],
  );

  const visibleActions = useMemo(
    () => actions.filter((action) => !action.permissions?.length || action.permissions.some((permission) => can(permission))),
    [actions, can],
  );

  if (state.status === "loading") {
    return (
      <div className="page modern-saas-dashboard">
        <DashboardLoadingState />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="page modern-saas-dashboard">
        <DashboardErrorState message={state.message} forbidden={state.forbidden} onRetry={() => void load()} />
      </div>
    );
  }

  // The server decides what the user may see; the client check is only a fallback for older APIs.
  const access = state.data.access;
  const capabilities = access
    ? {
        sales: access.sales,
        inventory: access.inventory,
        procurement: access.procurement,
        identity: access.identity,
        menu: access.menu,
        operations: access.operations,
        hr: access.hr,
      }
    : {
        sales: can("sales.view"),
        inventory: can("inventory.view"),
        procurement: can("purchasing.view") || can("grn.view"),
        identity: can("users.view") || can("roles.view"),
        menu: can("menu.view") || can("recipes.view") || can("production.view"),
        operations: can("operations.view"),
        hr: can("hr.view"),
      };

  return (
    <div className="page">
      <ModernDashboardView
        dashboard={state.data}
        updatedAt={state.data.generatedAtUtc}
        actions={visibleActions}
        capabilities={capabilities}
        onNavigate={go}
        onRefresh={() => void load()}
        refreshing={state.refreshing}
        refreshError={state.refreshError}
      />
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <>
      <header className="saas-page-header">
        <div>
          <div className="saas-eyebrow">Command center</div>
          <h1>Operations dashboard</h1>
          <p>Loading live operational data...</p>
        </div>
      </header>

      <section className="saas-kpi-grid" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="saas-skeleton saas-kpi-skeleton" />
        ))}
      </section>

      <section className="saas-dashboard-layout">
        <div className="saas-skeleton" style={{ height: 520 }} />
        <div className="saas-skeleton" style={{ height: 520 }} />
      </section>
    </>
  );
}

function DashboardErrorState({ message, forbidden, onRetry }: { message: string; forbidden: boolean; onRetry: () => void }) {
  return (
    <>
      <header className="saas-page-header">
        <div>
          <div className="saas-eyebrow">Command center</div>
          <h1>Operations dashboard</h1>
          <p>{forbidden ? "No access" : "The dashboard could not be loaded."}</p>
        </div>
      </header>

      <div className="saas-error-panel" role="alert">
        <div className="saas-error-icon">
          <i className={`ti ${forbidden ? "ti-lock" : "ti-alert-triangle"}`} aria-hidden="true" />
        </div>

        <div>
          <strong>{forbidden ? "You don't have access to this dashboard" : "Couldn't load dashboard"}</strong>
          <p>{message}</p>
        </div>

        {!forbidden && (
          <button type="button" className="saas-btn saas-btn-secondary" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </>
  );
}
