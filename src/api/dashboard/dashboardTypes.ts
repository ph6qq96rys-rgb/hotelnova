// src/api/dashboard/dashboardTypes.ts

export type BestSellerDto = {
  itemName:  string;
  unitsSold: number;
  revenue:   number;
};

export type InventorySummaryDto = {
  itemName: string;
  quantity: number;
  uomCode?: string;
};

export type DashboardOverviewDto = {
  generatedAtUtc:        string;

  // Today
  todaySales:            number;
  todayCogs:             number;
  todayGrossProfit:      number;
  todayOrders:           number;

  // Trends
  last7DaysRevenue:      number;
  last30DaysRevenue:     number;
  yearToDateRevenue:     number;

  // Operations
  lowStockItems:         number;
  pendingPurchaseOrders: number;
  openTransfers:         number;

  // Identity
  totalUsers:            number;
  totalRoles:            number;

  // Menu engineering
  menuEngineeringMap:    Record<string, number>;

  // Detail
  bestSellers:           BestSellerDto[];
  inventory:             InventorySummaryDto[];
};