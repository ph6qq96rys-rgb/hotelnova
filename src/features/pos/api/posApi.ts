// src/features/pos/api/posApi.ts

import type {
  BulkPostCogsResultDto,
  CloseSessionRequest,
  CreateSaleRequest,
  Guid,
  MenuItemDto,
  OpenSessionRequest,
  PosSessionDto,
  SaleDto,
  SaleInventoryConsumptionDto,
  SessionReportDto,
} from "../types/posTypes";

import { http, resolveBranchId, resolveCompanyId } from "../../../api/http";

export type PosScope = {
  companyId: Guid;
  branchId: Guid;
};

export type PosDashboardDto = {
  openSessionCount: number;
  todaySales: number;
  todayOrders: number;
  pendingCogsCount: number;
};

export type PosStoreDto = {
  id: Guid;
  companyId: Guid;
  branchId: Guid;
  code?: string | null;
  name: string;
  addressLine?: string | null;
  isActive: boolean;
  issueStockLocationId?: Guid | null;
  issueStockLocationName?: string | null;
};

type ListResponse<T> =
  | T[]
  | {
      items?: T[];
      data?: T[];
      results?: T[];
      value?: T[];
    };

function extractList<T>(response: ListResponse<T> | null | undefined): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.value)) return response.value;
  return [];
}

function requireValue(name: string, value: string | null | undefined): string {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(
      `${name} is missing. Please select company, branch, and POS store again.`
    );
  }

  return text;
}

export function getCompanyId(): Guid {
  return requireValue("Company ID", resolveCompanyId());
}

export function getBranchId(): Guid {
  return requireValue("Branch ID", resolveBranchId());
}

function readStoredValue(...keys: string[]): string | null {
  for (const key of keys) {
    const local = localStorage.getItem(key);
    if (local?.trim()) return local.trim();

    const session = sessionStorage.getItem(key);
    if (session?.trim()) return session.trim();
  }

  return null;
}

export function getStoreId(): Guid {
  return requireValue(
    "POS/store ID",
    readStoredValue("storeId", "posStoreId", "activeStoreId")
  );
}

export function tryGetStoreId(): Guid | null {
  return readStoredValue("storeId", "posStoreId", "activeStoreId");
}

export function setActiveStore(storeId: Guid, storeName?: string): void {
  const id = requireValue("POS/store ID", storeId);

  for (const storage of [localStorage, sessionStorage]) {
    storage.setItem("storeId", id);
    storage.setItem("posStoreId", id);
    storage.setItem("activeStoreId", id);

    if (storeName?.trim()) {
      storage.setItem("storeName", storeName.trim());
    }
  }
}

export function clearActiveStore(): void {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem("storeId");
    storage.removeItem("posStoreId");
    storage.removeItem("activeStoreId");
    storage.removeItem("storeName");
  }
}

function normalizeScope(scope?: Partial<PosScope>): PosScope {
  return {
    companyId: requireValue("Company ID", scope?.companyId || resolveCompanyId()),
    branchId: requireValue("Branch ID", scope?.branchId || resolveBranchId()),
  };
}

function branchPrefix(scope?: Partial<PosScope>): string {
  const resolved = normalizeScope(scope);
  return `/companies/${resolved.companyId}/branches/${resolved.branchId}`;
}

function query(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      qs.set(key, String(value));
    }
  }

  const text = qs.toString();
  return text ? `?${text}` : "";
}

async function get<T>(scope: Partial<PosScope> | undefined, path: string): Promise<T> {
  const response = await http.get<T>(`${branchPrefix(scope)}${path}`);
  return response.data;
}

async function getList<T>(scope: Partial<PosScope> | undefined, path: string): Promise<T[]> {
  const response = await http.get<ListResponse<T>>(`${branchPrefix(scope)}${path}`);
  return extractList<T>(response.data);
}

async function post<T>(scope: Partial<PosScope> | undefined, path: string, body?: unknown): Promise<T> {
  const response = await http.post<T>(`${branchPrefix(scope)}${path}`, body ?? {});
  return response.data;
}

function normalizeStore(store: PosStoreDto): PosStoreDto {
  return {
    ...store,
    id: String(store.id ?? "").trim(),
    companyId: String(store.companyId ?? "").trim(),
    branchId: String(store.branchId ?? "").trim(),
    code: store.code ?? null,
    name: String(store.name ?? "").trim(),
    addressLine: store.addressLine ?? null,
    isActive: store.isActive !== false,
    issueStockLocationId: store.issueStockLocationId ?? null,
    issueStockLocationName: store.issueStockLocationName ?? null,
  };
}

function normalizeOpenSessionRequest(
  body: OpenSessionRequest
): OpenSessionRequest {
  return {
    ...body,
    storeId: body.storeId || getStoreId(),
    cashierName: String(body.cashierName ?? "").trim(),
    terminal: String(body.terminal ?? "POS-1").trim() || "POS-1",
    openingFloat: Number(body.openingFloat ?? 0),
  };
}

function normalizeCreateSaleRequest(body: CreateSaleRequest): CreateSaleRequest {
  return {
    ...body,
    companyId: body.companyId || getCompanyId(),
    branchId: body.branchId || getBranchId(),
    storeId: body.storeId || getStoreId(),
  };
}

export const posApi = {
  currentSession: (scope: PosScope): Promise<PosSessionDto | null> =>
    get<PosSessionDto | null>(scope, "/pos-sessions/current"),

  stores: async (scope: PosScope): Promise<PosStoreDto[]> => {
    const rows = await getList<PosStoreDto>(scope, "/stores");
    return rows.map(normalizeStore).filter((x) => x.id && x.name && x.isActive !== false);
  },

  openSession: (scope: PosScope, body: OpenSessionRequest): Promise<PosSessionDto> =>
    post<PosSessionDto>(scope, "/pos-sessions/open", normalizeOpenSessionRequest(body)),

  closeSession: (scope: PosScope, sessionId: Guid, body: CloseSessionRequest): Promise<PosSessionDto> =>
    post<PosSessionDto>(scope, `/pos-sessions/${sessionId}/close`, {
      ...body,
      closingFloat: Number(body.closingFloat ?? 0),
    }),

  xReport: (scope: PosScope, sessionId: Guid): Promise<SessionReportDto> =>
    get<SessionReportDto>(scope, `/pos-sessions/${sessionId}/x-report`),

  zReport: (scope: PosScope, sessionId: Guid): Promise<SessionReportDto> =>
    post<SessionReportDto>(scope, `/pos-sessions/${sessionId}/z-report`),

  menuItems: (scope: PosScope, q = "", activeOnly = true): Promise<MenuItemDto[]> =>
    getList<MenuItemDto>(scope, `/menu/items${query({ q, activeOnly })}`),

  dashboard: (scope: PosScope): Promise<PosDashboardDto> =>
    get<PosDashboardDto>(scope, "/pos/dashboard"),

  createSale: (scope: PosScope, body: CreateSaleRequest): Promise<SaleDto> =>
    post<SaleDto>(scope, "/sales", normalizeCreateSaleRequest(body)),

  postSaleCogs: (scope: PosScope, saleId: Guid): Promise<void> =>
    post<void>(scope, `/sales/${saleId}/post-cogs`),

  postBulkCogs: (scope: PosScope, fromDate?: string, toDate?: string): Promise<BulkPostCogsResultDto> =>
    post<BulkPostCogsResultDto>(scope, `/sales/post-cogs/bulk${query({ fromDate, toDate })}`),

  saleInventoryConsumption: (scope: PosScope, saleId: Guid): Promise<SaleInventoryConsumptionDto[]> =>
    getList<SaleInventoryConsumptionDto>(scope, `/sales/${saleId}/inventory-consumption`),
};
