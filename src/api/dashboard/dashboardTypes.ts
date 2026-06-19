export type DashboardAlertSeverity = "info" | "warning" | "critical";

export type DashboardAlertDto = {
  key: string;
  severity: DashboardAlertSeverity;
  title: string;
  message?: string | null;
  count?: number | null;
  route?: string | null;
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

export type MenuEngineeringSummaryDto = {
  star: number;
  puzzle: number;
  plowhorse: number;
  dog: number;
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
};

export type InventoryDashboardSummaryDto = {
  lowStockItems: number;
  inventoryValue?: number | null;
  openTransfers: number;
};

export type ProcurementDashboardSummaryDto = {
  pendingPurchaseOrders: number;
};

export type IdentityDashboardSummaryDto = {
  totalUsers: number;
  totalRoles: number;
};

export type HrDashboardSummaryDto = {
  employeesPresentToday?: number | null;
  employeesAbsentToday?: number | null;
  employeesLateToday?: number | null;
};

export type DashboardOverviewDto = {
  generatedAtUtc: string;

  sales: SalesDashboardSummaryDto;
  inventorySummary: InventoryDashboardSummaryDto;
  procurement: ProcurementDashboardSummaryDto;
  identity: IdentityDashboardSummaryDto;
  hr?: HrDashboardSummaryDto | null;

  menuEngineering: MenuEngineeringSummaryDto;

  alerts: DashboardAlertDto[];
  bestSellers: BestSellerDto[];
  inventory: InventorySummaryDto[];

  revenueTrend: RevenueTrendPointDto[];
  foodCostTrend: FoodCostTrendPointDto[];
};