export type DashboardAlertSeverity = "info" | "warning" | "critical";

export type DashboardAlertDto = {
  key: string;
  severity: DashboardAlertSeverity;
  title: string;
  message?: string | null;
  count?: number | null;
  route?: string | null;
  /** operations | inventory | procurement | hr | sales | menu */
  area?: string | null;
  /** What to do, used as the link label (for example "Approve requests"). */
  actionLabel?: string | null;
};

export type RevenueTrendPointDto = {
  date: string;
  revenue: number;
};

export type FoodCostTrendPointDto = {
  date: string;
  foodCostPct: number;
};

export type BestSellerDto = {
  itemId?: string | null;
  itemName: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
};

export type InventorySummaryDto = {
  itemId?: string | null;
  itemName: string;
  quantity: number;
  availableQuantity?: number | null;
  reservedQuantity?: number | null;
  reorderLevel?: number | null;
  uomCode?: string | null;
  locationName?: string | null;
};

export type MenuQuadrantKey = "star" | "plowhorse" | "puzzle" | "dog";

export type MenuItemBriefDto = {
  menuItemId: string;
  name: string;
  branchName?: string | null;
  unitsSold: number;
  price: number;
  contributionMargin: number;
  totalContribution: number;
  foodCostPct: number;
};

export type MenuQuadrantDto = {
  key: MenuQuadrantKey;
  label: string;
  advice: string;
  count: number;
  /** Share of the menu's total contribution, in percent. */
  contributionShare: number;
  unitsShare: number;
  topItems: MenuItemBriefDto[];
};

export type MenuActionDto = {
  kind: "protect" | "promote" | "recost" | "review";
  quadrant: MenuQuadrantKey;
  menuItemId: string;
  itemName: string;
  branchName?: string | null;
  detail: string;
};

/** Live menu engineering over the last `periodDays` days (same rules as the menu engineering page). */
export type MenuEngineeringSummaryDto = {
  star: number;
  puzzle: number;
  plowhorse: number;
  dog: number;
  periodDays?: number;
  itemsAnalysed?: number;
  unitsSold?: number;
  totalContribution?: number;
  hasSales?: boolean;
  quadrants?: MenuQuadrantDto[];
  actions?: MenuActionDto[];
};

export type HealthStatus = "good" | "watch" | "poor" | "none";

export type HealthIndicatorDto = {
  key: string;
  label: string;
  area: string;
  value?: number | null;
  format: "percent" | "money" | "days" | "number";
  target: string;
  status: HealthStatus;
  detail: string;
  route?: string | null;
};

export type BusinessHealthDto = {
  score?: number | null;
  status: HealthStatus;
  periodNote: string;
  indicators: HealthIndicatorDto[];
};

export type SalesDashboardSummaryDto = {
  todaySales: number;
  todayCogs: number;
  todayGrossProfit: number;
  todayOrders: number;
  averageOrderValue: number;
  todayMarginPct: number;
  todayFoodCostPct: number;
  last7DaysRevenue: number;
  last30DaysRevenue: number;
  yearToDateRevenue: number;
  /** Sales excluding VAT on the same weekday last week, up to the same time of day. */
  sameTimeLastWeekSales?: number | null;
  sameTimeLastWeekOrders?: number | null;
};

/** Sections the signed-in user may see (decided by the server). */
export type DashboardAccessDto = {
  sales: boolean;
  inventory: boolean;
  procurement: boolean;
  hr: boolean;
  identity: boolean;
  menu: boolean;
  operations: boolean;
  companyWide: boolean;
};

export type OperationsPlanStatusDto = {
  branchId: string;
  branchName: string;
  shiftName: string;
  status: string;
  criticalOpenCount: number;
};

export type OperationsDashboardSummaryDto = {
  plans: OperationsPlanStatusDto[];
  openCashierShifts: number;
  branchesInScope: number;
  branchesReady: number;
  endOfDayGenerated: number;
};

export type InventoryDashboardSummaryDto = {
  lowStockItems: number;
  inventoryValue?: number | null;
  openTransfers: number;
  outOfStockItems?: number | null;
  lockedStockItems?: number | null;
};

export type ProcurementDashboardSummaryDto = {
  pendingPurchaseOrders: number;
  pendingFnbApprovals?: number | null;
  pendingFinanceApprovals?: number | null;
  approvedRequisitions?: number | null;
};

export type IdentityDashboardSummaryDto = {
  totalUsers: number;
  totalRoles: number;
};

export type HrDashboardSummaryDto = {
  employeesPresentToday?: number | null;
  employeesAbsentToday?: number | null;
  employeesLateToday?: number | null;
  overtimeHoursToday?: number | null;
  pendingLeaveRequests?: number | null;
};

export type DashboardOverviewDto = {
  generatedAtUtc: string;
  currencyCode?: string | null;
  branchId?: string | null;
  scopeName?: string | null;
  companyName?: string | null;
  /** The company's local business date the "today" figures refer to (yyyy-MM-dd). */
  businessDate?: string | null;
  timeZone?: string | null;
  access?: DashboardAccessDto | null;
  operations?: OperationsDashboardSummaryDto | null;

  sales: SalesDashboardSummaryDto;
  inventorySummary: InventoryDashboardSummaryDto;
  procurement: ProcurementDashboardSummaryDto;
  identity: IdentityDashboardSummaryDto;
  hr?: HrDashboardSummaryDto | null;

  menuEngineering: MenuEngineeringSummaryDto;
  businessHealth?: BusinessHealthDto | null;

  alerts: DashboardAlertDto[];
  bestSellers: BestSellerDto[];
  inventory: InventorySummaryDto[];

  revenueTrend: RevenueTrendPointDto[];
  foodCostTrend: FoodCostTrendPointDto[];
};