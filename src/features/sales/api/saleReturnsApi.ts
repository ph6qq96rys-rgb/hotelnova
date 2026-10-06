import { http } from "../../../api/http";

type Guid = string;
type Scope = { companyId: Guid; branchId: Guid };

export type ReturnableLineDto = {
  saleItemId: Guid;
  menuItemId: Guid;
  itemName: string;
  quantity: number;
  returnedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  lineTotal: number;
  stockTracked: boolean;
};

export type ReturnableSaleDto = {
  saleId: Guid;
  saleNo: string;
  soldAtUtc: string;
  soldByName: string;
  totalAmount: number;
  returnedAmount: number;
  paidAmount: number;
  refundedAmount: number;
  balanceDue: number;
  returnState: "none" | "partial" | "full";
  canReturn: boolean;
  blockedReason?: string | null;
  pendingReturnId?: Guid | null;
  lines: ReturnableLineDto[];
  tenders: Array<{ method: string; amount: number }>;
};

export type ReturnPreviewDto = {
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceChargeAmount: number;
  totalAmount: number;
  refundDue: number;
  balanceReduced: number;
};

export type SaleReturnDto = {
  id: Guid;
  returnNo: string;
  saleId: Guid;
  saleNo: string;
  status: "requested" | "approved" | "rejected";
  reason: string;
  requestedByUserId: Guid;
  requestedByName: string;
  requestedAtUtc: string;
  decidedByName?: string | null;
  decidedAtUtc?: string | null;
  decisionNote?: string | null;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceChargeAmount: number;
  totalAmount: number;
  refundAmount: number;
  stockStatus: "notRequired" | "pending" | "posted" | "failed";
  stockError?: string | null;
  canDecide: boolean;
  decideBlockedReason?: string | null;
  lines: Array<{ saleItemId: Guid; itemName: string; quantity: number; unitPrice: number; totalAmount: number; restock: boolean }>;
  refunds: Array<{ method: string; amount: number; referenceCode?: string | null }>;
};

export type ReturnLineRequest = { saleItemId: Guid; quantity: number; restock: boolean };
export type RefundRequest = { method: string; amount: number; referenceCode?: string | null };

const base = (scope: Scope) => `/companies/${scope.companyId}/branches/${scope.branchId}/sales`;

/** Returns and refunds as approved credit notes. */
export const saleReturnsApi = {
  returnable: async (scope: Scope, saleId: Guid) => (await http.get<ReturnableSaleDto>(`${base(scope)}/${saleId}/returnable`)).data,
  preview: async (scope: Scope, saleId: Guid, lines: ReturnLineRequest[]) =>
    (await http.post<ReturnPreviewDto>(`${base(scope)}/${saleId}/returns/preview`, { lines })).data,
  request: async (scope: Scope, saleId: Guid, body: { reason: string; lines: ReturnLineRequest[]; refunds: RefundRequest[] }) =>
    (await http.post<SaleReturnDto>(`${base(scope)}/${saleId}/returns`, body)).data,
  list: async (scope: Scope, params: { status?: string; from?: string; to?: string; search?: string }) =>
    (await http.get<SaleReturnDto[]>(`${base(scope)}/returns`, { params })).data,
  approve: async (scope: Scope, id: Guid, note?: string) => (await http.post<SaleReturnDto>(`${base(scope)}/returns/${id}/approve`, { note: note || null })).data,
  reject: async (scope: Scope, id: Guid, note: string) => (await http.post<SaleReturnDto>(`${base(scope)}/returns/${id}/reject`, { note })).data,
  retryStock: async (scope: Scope, id: Guid) => (await http.post<SaleReturnDto>(`${base(scope)}/returns/${id}/retry-stock`)).data,
};

export const REFUND_METHODS = ["CASH", "CARD", "MOBILE", "TRANSFER"];
