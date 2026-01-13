export type DashboardOverviewDto = {
  totalUsers: number;
  totalRoles: number;

  lowStockItems: number;
  pendingPurchaseOrders: number;
  openTransfers: number;

  todaySales: number;
  todayOrders: number;

  generatedAtUtc: string; // ISO string
};
