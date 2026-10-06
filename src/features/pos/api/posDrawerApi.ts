import { http } from "../../../api/http";
import type { Guid } from "../types/posTypes";
import type { PosScope } from "./posServiceApi";

export type CashVarianceStatus = "none" | "pending" | "approved";
export type CashMovementType = "paidIn" | "paidOut" | "safeDrop";

export type DrawerDto = {
  id: Guid;
  storeId: Guid;
  storeName?: string | null;
  cashierId: Guid;
  cashierName: string;
  terminal?: string | null;
  currencyCode: string;
  openingFloat: number;
  closingFloat?: number | null;
  openedAtUtc: string;
  closedAtUtc?: string | null;
  status: "Open" | "Closed" | string;
  countedCash?: number | null;
  /** Only for supervisors while open, and for everyone once closed (blind close). */
  expectedCash?: number | null;
  cashVariance?: number | null;
  varianceStatus: CashVarianceStatus;
  varianceApprovedByName?: string | null;
  closedByName?: string | null;
  closeNote?: string | null;
  pendingReturns: number;
};

export type CashMovementDto = { id: Guid; type: CashMovementType; amount: number; reason: string; createdByName: string; createdAtUtc: string };
export type CashCountLineDto = { value: number; count: number; total: number };

export type DrawerReportDto = {
  sessionId: Guid;
  kind: "X" | "Z";
  currencyCode: string;
  cashierName: string;
  storeName?: string | null;
  openedAtUtc: string;
  closedAtUtc?: string | null;
  closedByName?: string | null;
  closeNote?: string | null;
  generatedAtUtc: string;
  saleCount: number;
  transactionCount: number;
  grossSales: number;
  totalDiscount: number;
  totalTax: number;
  netSales: number;
  totalSales: number;
  totalCogs: number;
  grossProfit: number;
  totalPayments: number;
  cashSales: number;
  cardSales: number;
  openingFloat: number;
  totalTips: number;
  cashTips: number;
  cashTipPayouts: number;
  cashRefunds: number;
  totalRefunds: number;
  returnsTotal: number;
  returnCount: number;
  paidIn: number;
  paidOut: number;
  safeDrops: number;
  expectedCash: number;
  countedCash?: number | null;
  cashVariance?: number | null;
  varianceStatus: CashVarianceStatus;
  varianceApprovedByName?: string | null;
  varianceNote?: string | null;
  denominations: CashCountLineDto[];
  movements: CashMovementDto[];
  paymentBreakdown: Array<{ method: string; count: number; total: number }>;
};

const base = (scope: PosScope) => `/companies/${scope.companyId}/branches/${scope.branchId}/pos-sessions`;

/** Cashier drawers: blind close, cash movements, supervisor approval and frozen Z reports. */
export const posDrawerApi = {
  current: async (scope: PosScope) => {
    const response = await http.get<DrawerDto | "">(`${base(scope)}/current`);
    return response.status === 204 || !response.data ? null : (response.data as DrawerDto);
  },
  list: async (scope: PosScope, params: { status?: string; variancePending?: boolean; from?: string; to?: string }) =>
    (await http.get<DrawerDto[]>(base(scope), { params })).data,
  move: async (scope: PosScope, sessionId: Guid, body: { type: CashMovementType; amount: number; reason: string }) =>
    (await http.post<CashMovementDto>(`${base(scope)}/${sessionId}/movements`, body)).data,
  close: async (scope: PosScope, sessionId: Guid, body: { closingFloat: number; denominations: Array<{ value: number; count: number }>; note?: string | null }) =>
    (await http.post<DrawerDto>(`${base(scope)}/${sessionId}/close`, body)).data,
  approveVariance: async (scope: PosScope, sessionId: Guid, note: string) =>
    (await http.post<DrawerDto>(`${base(scope)}/${sessionId}/approve-variance`, { note })).data,
  xReport: async (scope: PosScope, sessionId: Guid) => (await http.get<DrawerReportDto>(`${base(scope)}/${sessionId}/x-report`)).data,
  zReport: async (scope: PosScope, sessionId: Guid) => (await http.get<DrawerReportDto>(`${base(scope)}/${sessionId}/z-report`)).data,
};

/** Ethiopian birr notes and coins, largest first. */
export const BIRR_DENOMINATIONS = [200, 100, 50, 10, 5, 1, 0.5, 0.25, 0.1, 0.05];
