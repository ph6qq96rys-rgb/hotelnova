export type Guid = string;

export interface CashierShiftDto {
  id: Guid;
  companyId: Guid;
  branchId: Guid;
  cashierId: Guid;
  cashierName: string;
  terminal: string;
  openingFloat: number;
  closingCash?: number | null;
  openedAtUtc: string;
  closedAtUtc?: string | null;
  status: string;
}

export interface SafeDropDto {
  id: Guid;
  cashierShiftId: Guid;
  amount: number;
  method: string;
  referenceNo: string;
  droppedByName: string;
  droppedAtUtc: string;
  notes?: string | null;
}

export interface SalesSummaryDto {
  salesCount: number;
  grossSales: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  netSales: number;
  totalCogs: number;
  grossProfit: number;
  payments: Array<{ method: string; amount: number; count: number }>;
}

export interface EndOfDayReportDto {
  id: Guid;
  businessDate: string;
  grossSales: number;
  netSales: number;
  totalPayments: number;
  totalSafeDrops: number;
  cashVariance: number;
  salesCount: number;
  generatedAtUtc: string;
  generatedByName: string;
}
