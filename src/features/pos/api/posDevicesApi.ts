import { http } from "../../../api/http";
import type { Guid } from "../types/posTypes";

export type PosScope = { companyId: Guid; branchId: Guid };

export type PrepStationKind = "kitchen" | "bar" | "pastry" | "other";

export type PrepStationDto = {
  id: Guid;
  code: string;
  name: string;
  kind: PrepStationKind;
  printerId?: Guid | null;
  usesDisplay: boolean;
  isDefault: boolean;
  isActive: boolean;
  categoryIds: Guid[];
  menuItemIds: Guid[];
  version: Guid;
};

export type SavePrepStationRequest = Omit<PrepStationDto, "id" | "version"> & { version?: Guid | null };

export type PosPrinterDto = {
  id: Guid;
  name: string;
  role: "receipt" | "kitchen";
  address: string;
  charsPerLine: number;
  hasCashDrawer: boolean;
  isActive: boolean;
  version: Guid;
};

export type SavePosPrinterRequest = Omit<PosPrinterDto, "id" | "version"> & { version?: Guid | null };

export type PrintAgentDto = { id: Guid; name: string; keyPrefix: string; isActive: boolean; createdAtUtc: string; lastSeenAtUtc?: string | null; lastSeenVersion?: string | null };

export type PrintJobDto = {
  id: Guid; printerId: Guid; printerName: string; kind: string; documentNo?: string | null;
  status: "queued" | "sent" | "printed" | "failed"; attempts: number; lastError?: string | null; createdAtUtc: string; completedAtUtc?: string | null;
};

export type TillDto = { id: Guid; code: string; name: string; receiptPrinterId?: Guid | null; fiscalMachineCode?: string | null };
export type RoutableMenuDto = { categories: Array<{ id: Guid; name: string }>; items: Array<{ id: Guid; name: string; categoryId: Guid }> };

export type KitchenOrderStatus = "new" | "inprogress" | "ready" | "served" | "voided";

export type KitchenOrderDto = {
  id: Guid; stationId: Guid; stationName: string; orderNo: string; ticketNo?: string | null; round: number; tableLabel?: string | null;
  waiterName?: string | null; orderType: string; guestCount?: number | null; note?: string | null; status: KitchenOrderStatus;
  sentAtUtc: string; sentByName: string; startedAtUtc?: string | null; readyAtUtc?: string | null; servedAtUtc?: string | null;
  ageSeconds: number; version: Guid;
  lines: Array<{ id: Guid; itemName: string; quantity: number; note?: string | null; isVoided: boolean; voidReason?: string | null }>;
};

const devices = (scope: PosScope) => `/companies/${scope.companyId}/branches/${scope.branchId}/pos/devices`;
const kitchen = (scope: PosScope) => `/companies/${scope.companyId}/branches/${scope.branchId}/pos/kitchen`;

/** Preparation stations and routing, printers, tills, print agents and the print queue. */
export const posDevicesApi = {
  stations: async (scope: PosScope) => (await http.get<PrepStationDto[]>(`${devices(scope)}/stations`)).data,
  saveStation: async (scope: PosScope, id: Guid | null, body: SavePrepStationRequest) =>
    (id ? await http.put<PrepStationDto>(`${devices(scope)}/stations/${id}`, body) : await http.post<PrepStationDto>(`${devices(scope)}/stations`, body)).data,
  printers: async (scope: PosScope) => (await http.get<PosPrinterDto[]>(`${devices(scope)}/printers`)).data,
  savePrinter: async (scope: PosScope, id: Guid | null, body: SavePosPrinterRequest) =>
    (id ? await http.put<PosPrinterDto>(`${devices(scope)}/printers/${id}`, body) : await http.post<PosPrinterDto>(`${devices(scope)}/printers`, body)).data,
  testPrinter: async (scope: PosScope, id: Guid) => { await http.post(`${devices(scope)}/printers/${id}/test`); },
  saveTill: async (scope: PosScope, storeId: Guid, body: { receiptPrinterId: Guid | null; fiscalMachineCode: string | null }) => {
    await http.put(`${devices(scope)}/tills/${storeId}`, body);
  },
  tills: async (scope: PosScope) => (await http.get<TillDto[]>(`${devices(scope)}/tills`)).data,
  menu: async (scope: PosScope) => (await http.get<RoutableMenuDto>(`${devices(scope)}/menu`)).data,
  agents: async (scope: PosScope) => (await http.get<PrintAgentDto[]>(`${devices(scope)}/agents`)).data,
  registerAgent: async (scope: PosScope, name: string) => (await http.post<{ agent: PrintAgentDto; key: string }>(`${devices(scope)}/agents`, { name })).data,
  revokeAgent: async (scope: PosScope, id: Guid) => { await http.post(`${devices(scope)}/agents/${id}/revoke`); },
  jobs: async (scope: PosScope) => (await http.get<PrintJobDto[]>(`${devices(scope)}/jobs`)).data,
  retryJob: async (scope: PosScope, id: Guid) => { await http.post(`${devices(scope)}/jobs/${id}/retry`); },
};

/** The kitchen display. */
export const kitchenApi = {
  stations: async (scope: PosScope) => (await http.get<PrepStationDto[]>(`${kitchen(scope)}/stations`)).data,
  orders: async (scope: PosScope, stationId: Guid | null, signal?: AbortSignal) =>
    (await http.get<KitchenOrderDto[]>(`${kitchen(scope)}/orders`, { params: { stationId: stationId || undefined, servedMinutes: 15 }, signal })).data,
  bump: async (scope: PosScope, id: Guid, action: "start" | "ready" | "served" | "recall", version: Guid) =>
    (await http.post<KitchenOrderDto>(`${kitchen(scope)}/orders/${id}/bump`, { action, version })).data,
  reprint: async (scope: PosScope, id: Guid) => { await http.post(`${kitchen(scope)}/orders/${id}/reprint`); },
};
