import { http } from "../../../api/http";
import type { Guid } from "../types/posTypes";
import type { PosOrderType, PosScope } from "./posServiceApi";

export type TipBasis = "beforeTax" | "afterTax";
export type TipPayoutMethod = "cashDrawer" | "payroll" | "bankTransfer";

/** Effective tip configuration for a branch: the branch override, else the company default. */
export type TipSettingsDto = {
  source: "branch" | "company" | "default";
  isEnabled: boolean;
  suggestedPercents: number[];
  allowCustom: boolean;
  allowNoTip: boolean;
  basis: TipBasis;
  distribution: "individual";
  poolingEnabled: boolean;
  trackCashTips: boolean;
  enabledForDineIn: boolean;
  enabledForTakeAway: boolean;
  enabledForDelivery: boolean;
  enabledForRoomService: boolean;
  updatedAtUtc?: string | null;
  version?: Guid | null;
};

export type SaveTipSettingsRequest = Omit<TipSettingsDto, "source" | "updatedAtUtc" | "distribution" | "basis"> & {
  basis: TipBasis;
  distribution: "individual";
};

export type TipReportRowDto = {
  waiterEmployeeId?: Guid | null;
  waiterUserId?: Guid | null;
  waiterName: string;
  tablesServed: number;
  sales: number;
  cashTips: number;
  cardTips: number;
  otherTips: number;
  totalTips: number;
  paidOut: number;
  outstanding: number;
};

export type TipAdjustmentDto = {
  oldAmount: number;
  newAmount: number;
  oldWaiterName: string;
  newWaiterName: string;
  reason: string;
  adjustedAtUtc: string;
  adjustedByName: string;
};

export type TipDetailDto = {
  id: Guid;
  saleId: Guid;
  saleNo: string;
  paymentId: Guid;
  posTicketId?: Guid | null;
  posSessionId?: Guid | null;
  tableLabel?: string | null;
  waiterEmployeeId?: Guid | null;
  waiterUserId?: Guid | null;
  waiterName: string;
  method: string;
  amount: number;
  basisAmount: number;
  percent?: number | null;
  status: "recorded" | "voided";
  createdAtUtc: string;
  createdByName: string;
  version: Guid;
  adjustments: TipAdjustmentDto[];
};

export type TipPayoutDto = {
  id: Guid;
  waiterEmployeeId?: Guid | null;
  waiterUserId?: Guid | null;
  waiterName: string;
  amount: number;
  method: TipPayoutMethod;
  posSessionId?: Guid | null;
  note?: string | null;
  paidAtUtc: string;
  paidByName: string;
};

export type TipReportDto = {
  from: string;
  to: string;
  timeZone: string;
  currencyCode: string;
  rows: TipReportRowDto[];
  totals: TipReportRowDto;
  tips: TipDetailDto[];
  payouts: TipPayoutDto[];
  sessions: Array<{ id: Guid; cashierName: string; terminal: string; openedAtUtc: string; closedAtUtc?: string | null }>;
};

export type TipReportQuery = {
  from: string;
  to: string;
  waiterEmployeeId?: Guid | null;
  waiterUserId?: Guid | null;
  method?: string | null;
  posSessionId?: Guid | null;
  tableId?: Guid | null;
};

const base = (scope: PosScope) => `/companies/${scope.companyId}/branches/${scope.branchId}/pos/tips`;

/** Tips & gratuity: settings, report, corrections and payouts. */
export const posTipsApi = {
  settings: async (scope: PosScope) => (await http.get<TipSettingsDto>(`${base(scope)}/settings`)).data,
  saveSettings: async (scope: PosScope, body: SaveTipSettingsRequest, level: "branch" | "company") =>
    (await http.put<TipSettingsDto>(`${base(scope)}/settings`, body, { params: { scope: level } })).data,
  report: async (scope: PosScope, query: TipReportQuery) =>
    (await http.get<TipReportDto>(`${base(scope)}/report`, {
      params: Object.fromEntries(Object.entries(query).filter(([, value]) => value !== null && value !== undefined && value !== "")),
    })).data,
  adjust: async (scope: PosScope, tipId: Guid, body: { version: Guid; amount: number; waiterEmployeeId?: Guid | null; waiterUserId?: Guid | null; reason: string }) =>
    (await http.post<TipDetailDto>(`${base(scope)}/${tipId}/adjust`, body)).data,
  payout: async (scope: PosScope, body: { waiterEmployeeId?: Guid | null; waiterUserId?: Guid | null; amount: number; method: TipPayoutMethod; note?: string | null }) =>
    (await http.post<TipPayoutDto>(`${base(scope)}/payouts`, body)).data,
};

/** Whether the guest may leave a tip on this order. Mirrors TipSettings.IsEnabledFor on the server. */
export function tipsEnabledFor(settings: TipSettingsDto | null | undefined, orderType: PosOrderType | null | undefined) {
  if (!settings?.isEnabled) return false;
  switch (orderType ?? "takeAway") {
    case "dineIn": return settings.enabledForDineIn;
    case "takeAway": return settings.enabledForTakeAway;
    case "delivery": return settings.enabledForDelivery;
    case "roomService": return settings.enabledForRoomService;
    default: return false;
  }
}
