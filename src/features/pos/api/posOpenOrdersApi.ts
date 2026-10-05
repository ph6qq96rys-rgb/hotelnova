import { http } from "../../../api/http";
import type { Guid, MenuItemDto, PaymentMethod } from "../types/posTypes";
import type { PosScope, PosTicketDto, PosTicketItemRequest } from "./posServiceApi";

export type HeldOrderDto = {
  id: Guid;
  ticketNo: string;
  orderType: string;
  tableLabel?: string | null;
  areaName?: string | null;
  guestCount: number;
  customerName?: string | null;
  waiterEmployeeId?: Guid | null;
  waiterUserId?: Guid | null;
  waiterName?: string | null;
  itemCount: number;
  subtotal: number;
  openedAtUtc: string;
  lastActivityAtUtc: string;
  ageMinutes: number;
  idleMinutes: number;
  version: Guid;
};

export type UncollectedSaleDto = {
  id: Guid;
  saleNo: string;
  soldAtUtc: string;
  customerName?: string | null;
  tableLabel?: string | null;
  waiterName?: string | null;
  soldByName: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  paymentStatus: "unpaid" | "partiallyPaid";
  ageDays: number;
};

export type OpenOrdersDto = {
  generatedAtUtc: string;
  currencyCode: string;
  summary: {
    heldCount: number;
    heldAmount: number;
    staleCount: number;
    staleAfterMinutes: number;
    uncollectedCount: number;
    uncollectedBalance: number;
  };
  held: HeldOrderDto[];
  uncollected: UncollectedSaleDto[];
};

export type CollectResultDto = {
  saleId: Guid;
  saleNo: string;
  collected: number;
  balance: number;
  paymentStatus: "paid" | "partiallyPaid";
  posSessionId: Guid;
};

const base = (scope: PosScope) => `/companies/${scope.companyId}/branches/${scope.branchId}/pos/open-orders`;

/** Held orders and uncollected payments for cashiers, the F&B controller and finance. */
export const posOpenOrdersApi = {
  list: async (scope: PosScope, params: { search?: string; waiterEmployeeId?: Guid | null; waiterUserId?: Guid | null; staleAfterMinutes?: number } = {}, signal?: AbortSignal) =>
    (await http.get<OpenOrdersDto>(base(scope), {
      params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "")),
      signal,
    })).data,
  ticket: async (scope: PosScope, id: Guid) => (await http.get<PosTicketDto>(`${base(scope)}/tickets/${id}`)).data,
  menu: async (scope: PosScope, q?: string) => (await http.get<MenuItemDto[]>(`${base(scope)}/menu`, { params: { q: q || undefined } })).data,
  addItems: async (scope: PosScope, id: Guid, version: Guid, items: PosTicketItemRequest[]) =>
    (await http.post<PosTicketDto>(`${base(scope)}/tickets/${id}/items`, { version, items })).data,
  collect: async (scope: PosScope, saleId: Guid, payments: Array<{ method: PaymentMethod; amount: number; referenceCode?: string | null }>) =>
    (await http.post<CollectResultDto>(`${base(scope)}/sales/${saleId}/payments`, { payments })).data,
};
