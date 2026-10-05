import { http } from "../../../api/http";
import type { Guid, MenuItemDto, PaymentMethod, SaleDto } from "../types/posTypes";
import type { PosStoreDto } from "./posApi";

export type PosOrderType = "dineIn" | "takeAway" | "delivery" | "roomService";
export type PosTicketStatus = "open" | "settled" | "cancelled";

export type PosActorDto = {
  userId: Guid;
  name: string;
  employeeId?: Guid | null;
  canManageTickets: boolean;
  canVoid: boolean;
};

export type PosWaiterDto = {
  employeeId?: Guid | null;
  userId?: Guid | null;
  name: string;
  employeeNo?: string | null;
  position?: string | null;
  hasLogin: boolean;
  openTickets: number;
};

export type RestaurantTableDto = {
  id: Guid;
  areaId: Guid;
  number: string;
  seats: number;
  sortOrder: number;
  isActive: boolean;
};

export type DiningAreaDto = {
  id: Guid;
  name: string;
  sortOrder: number;
  isActive: boolean;
  tables: RestaurantTableDto[];
};

export type PosTicketSummaryDto = {
  id: Guid;
  ticketNo: string;
  orderType: PosOrderType;
  status: PosTicketStatus;
  tableId?: Guid | null;
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
  version: Guid;
  heldAtUtc?: string | null;
  holdReason?: string | null;
};

/** What staff set on a table. */
export type TableServiceState = "available" | "reserved" | "needsCleaning" | "unavailable";
/** What the floor shows: open orders decide occupied/held, otherwise the staff-set state. */
export type TableFloorStatus = TableServiceState | "occupied" | "held";

export type PosFloorTableDto = {
  id: Guid;
  number: string;
  seats: number;
  status: TableFloorStatus;
  serviceState: TableServiceState;
  serviceNote?: string | null;
  serviceStateChangedAtUtc?: string | null;
  serviceStateChangedBy?: string | null;
  tickets: PosTicketSummaryDto[];
};

export type PosTicketEventDto = {
  type: "opened" | "held" | "resumed" | "waiterChanged" | "tableMoved" | "cancelled" | string;
  fromValue?: string | null;
  toValue?: string | null;
  reason?: string | null;
  atUtc: string;
  byName: string;
};

export type PosServiceSettingsDto = {
  source: "branch" | "company" | "default";
  serviceStyle: "tableService" | "quickService";
  quickServiceRequiresTable: boolean;
  quickServiceRequiresWaiter: boolean;
  requireGuestCount: boolean;
  requireHoldReason: boolean;
  holdReasons: string[];
  markTableForCleaningAfterPayment: boolean;
  tableRequired: Record<string, boolean>;
  waiterRequired: Record<string, boolean>;
  version?: Guid | null;
};

export type SavePosServiceSettingsRequest = Omit<PosServiceSettingsDto, "source" | "tableRequired" | "waiterRequired">;

export type HoldOrderRequest = {
  orderType: PosOrderType;
  tableId?: Guid | null;
  waiterEmployeeId?: Guid | null;
  waiterUserId?: Guid | null;
  guestCount?: number | null;
  customerName?: string | null;
  note?: string | null;
  holdReason?: string | null;
  items: PosTicketItemRequest[];
  appendToTicketId?: Guid | null;
};

export type PosFloorDto = {
  generatedAtUtc: string;
  areas: Array<{ id: Guid; name: string; tables: PosFloorTableDto[] }>;
  unseatedTickets: PosTicketSummaryDto[];
};

export type PosTicketLineDto = {
  id: Guid;
  menuItemId: Guid;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note?: string | null;
  round: number;
  addedAtUtc: string;
  addedByName: string;
  isVoided: boolean;
  voidReason?: string | null;
};

export type PosTicketDto = Omit<PosTicketSummaryDto, "itemCount"> & {
  note?: string | null;
  openedByName: string;
  closedAtUtc?: string | null;
  saleId?: Guid | null;
  cancelReason?: string | null;
  canEdit: boolean;
  canManage: boolean;
  posSessionId?: Guid | null;
  heldByName?: string | null;
  lines: PosTicketLineDto[];
  events: PosTicketEventDto[];
};

export type PosTicketItemRequest = { menuItemId: Guid; quantity: number; note?: string | null };

export type OpenTicketRequest = {
  orderType: PosOrderType;
  tableId?: Guid | null;
  guestCount: number;
  waiterEmployeeId?: Guid | null;
  waiterUserId?: Guid | null;
  customerName?: string | null;
  note?: string | null;
  items?: PosTicketItemRequest[];
};

export type UpdateTicketRequest = {
  version: Guid;
  orderType: PosOrderType;
  tableId?: Guid | null;
  guestCount: number;
  customerName?: string | null;
  note?: string | null;
};

export type SettleTicketRequest = {
  version: Guid;
  storeId: Guid;
  discountAmount: number;
  taxAmount: number;
  serviceChargeAmount: number;
  payments: Array<{ method: PaymentMethod; amount: number; referenceCode?: string | null }>;
};

export type PosScope = { companyId: Guid; branchId: Guid };

const base = (scope: PosScope) => `/companies/${scope.companyId}/branches/${scope.branchId}/pos`;

async function get<T>(scope: PosScope, path: string, params?: Record<string, unknown>, signal?: AbortSignal) {
  return (await http.get<T>(`${base(scope)}${path}`, { params, signal })).data;
}
async function post<T>(scope: PosScope, path: string, body: unknown) {
  return (await http.post<T>(`${base(scope)}${path}`, body)).data;
}
async function put<T>(scope: PosScope, path: string, body: unknown) {
  return (await http.put<T>(`${base(scope)}${path}`, body)).data;
}

/** Table service: floor plan, waiters and open tickets. */
export const posServiceApi = {
  me: (scope: PosScope) => get<PosActorDto>(scope, "/me"),
  menu: (scope: PosScope, q?: string, signal?: AbortSignal) => get<MenuItemDto[]>(scope, "/menu", { q: q || undefined }, signal),
  stores: (scope: PosScope) => get<PosStoreDto[]>(scope, "/stores"),
  floor: (scope: PosScope, signal?: AbortSignal) => get<PosFloorDto>(scope, "/floor", undefined, signal),
  waiters: (scope: PosScope) => get<PosWaiterDto[]>(scope, "/waiters"),

  areas: (scope: PosScope, includeInactive = false) => get<DiningAreaDto[]>(scope, "/areas", { includeInactive }),
  createArea: (scope: PosScope, body: { name: string; sortOrder: number; isActive: boolean }) => post<DiningAreaDto>(scope, "/areas", body),
  updateArea: (scope: PosScope, id: Guid, body: { name: string; sortOrder: number; isActive: boolean }) => put<DiningAreaDto>(scope, `/areas/${id}`, body),
  createTable: (scope: PosScope, body: Omit<RestaurantTableDto, "id">) => post<RestaurantTableDto>(scope, "/tables", body),
  updateTable: (scope: PosScope, id: Guid, body: Omit<RestaurantTableDto, "id">) => put<RestaurantTableDto>(scope, `/tables/${id}`, body),

  tickets: (scope: PosScope, params: { status?: PosTicketStatus | "all"; mine?: boolean } = {}) =>
    get<PosTicketSummaryDto[]>(scope, "/tickets", params),
  ticket: (scope: PosScope, id: Guid) => get<PosTicketDto>(scope, `/tickets/${id}`),
  openTicket: (scope: PosScope, body: OpenTicketRequest) => post<PosTicketDto>(scope, "/tickets", body),
  addItems: (scope: PosScope, id: Guid, version: Guid, items: PosTicketItemRequest[]) =>
    post<PosTicketDto>(scope, `/tickets/${id}/items`, { version, items }),
  updateTicket: (scope: PosScope, id: Guid, body: UpdateTicketRequest) => put<PosTicketDto>(scope, `/tickets/${id}`, body),
  assignWaiter: (scope: PosScope, id: Guid, version: Guid, waiter: Pick<PosWaiterDto, "employeeId" | "userId"> | null) =>
    post<PosTicketDto>(scope, `/tickets/${id}/assign`, {
      version, waiterEmployeeId: waiter?.employeeId ?? null, waiterUserId: waiter?.employeeId ? null : waiter?.userId ?? null,
    }),
  voidLine: (scope: PosScope, id: Guid, lineId: Guid, version: Guid, reason: string) =>
    post<PosTicketDto>(scope, `/tickets/${id}/lines/${lineId}/void`, { version, reason }),
  cancelTicket: (scope: PosScope, id: Guid, version: Guid, reason: string) =>
    post<PosTicketDto>(scope, `/tickets/${id}/cancel`, { version, reason }),
  settle: (scope: PosScope, id: Guid, body: SettleTicketRequest) => post<SaleDto>(scope, `/tickets/${id}/settle`, body),

  holdOrder: (scope: PosScope, body: HoldOrderRequest) => post<PosTicketDto>(scope, "/orders/hold", body),
  holdTicket: (scope: PosScope, id: Guid, version: Guid, holdReason: string | null, items?: PosTicketItemRequest[]) =>
    post<PosTicketDto>(scope, `/tickets/${id}/hold`, { version, holdReason, items }),
  setTableState: (scope: PosScope, tableId: Guid, state: TableServiceState, note?: string | null) =>
    put<PosFloorTableDto>(scope, `/tables/${tableId}/state`, { state, note: note || null }),
  serviceSettings: (scope: PosScope) => get<PosServiceSettingsDto>(scope, "/service-settings"),
  saveServiceSettings: async (scope: PosScope, body: SavePosServiceSettingsRequest, level: "branch" | "company") =>
    (await http.put<PosServiceSettingsDto>(`${base(scope)}/service-settings`, body, { params: { scope: level } })).data,
};

/** Whether Hold Order needs a table / a waiter for this order type in this branch. */
export function holdRequires(settings: PosServiceSettingsDto | null | undefined, orderType: PosOrderType) {
  return {
    table: settings ? !!settings.tableRequired[orderType] : orderType === "dineIn",
    waiter: settings ? !!settings.waiterRequired[orderType] : orderType === "dineIn",
  };
}

/** Key used to match a waiter option to the waiter stored on a ticket. */
export function waiterKey(waiter: { employeeId?: Guid | null; userId?: Guid | null; waiterEmployeeId?: Guid | null; waiterUserId?: Guid | null } | null | undefined) {
  if (!waiter) return "";
  const employee = "waiterEmployeeId" in waiter ? waiter.waiterEmployeeId : waiter.employeeId;
  const user = "waiterUserId" in waiter ? waiter.waiterUserId : waiter.userId;
  return employee ? `e:${employee}` : user ? `u:${user}` : "";
}
