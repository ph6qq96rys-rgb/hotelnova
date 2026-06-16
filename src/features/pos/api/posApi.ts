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

export type PosDashboardDto = {
  openSessionCount: number;
  todaySales: number;
  todayOrders: number;
  pendingCogsCount: number;
};

type ListResponse<T> =
  | T[]
  | {
      items?: T[];
      data?: T[];
      results?: T[];
    };

function requireValue(name: string, value: string | null | undefined): string {
  if (!value) {
    throw new Error(`${name} is missing. Please select company and branch again.`);
  }

  return value;
}

export function getCompanyId(): Guid {
  return requireValue("Company ID", resolveCompanyId());
}

export function getBranchId(): Guid {
  return requireValue("Branch ID", resolveBranchId());
}

function branchPrefix(): string {
  return `/companies/${getCompanyId()}/branches/${getBranchId()}`;
}

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      qs.set(key, String(value));
    }
  }

  const text = qs.toString();
  return text ? `?${text}` : "";
}

function unwrapList<T>(response: ListResponse<T> | null | undefined): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.results)) return response.results;
  return [];
}

async function get<T>(path: string): Promise<T> {
  const response = await http.get<T>(`${branchPrefix()}${path}`);
  return response.data;
}

async function getList<T>(path: string): Promise<T[]> {
  const response = await http.get<ListResponse<T>>(`${branchPrefix()}${path}`);
  return unwrapList<T>(response.data);
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await http.post<T>(`${branchPrefix()}${path}`, body ?? {});
  return response.data;
}

export const posApi = {
  currentSession: (): Promise<PosSessionDto | null> =>
    get<PosSessionDto | null>("/pos-sessions/current"),

  openSession: (body: OpenSessionRequest): Promise<PosSessionDto> =>
    post<PosSessionDto>("/pos-sessions/open", body),

  closeSession: (sessionId: Guid, body: CloseSessionRequest): Promise<PosSessionDto> =>
    post<PosSessionDto>(`/pos-sessions/${sessionId}/close`, body),

  xReport: (sessionId: Guid): Promise<SessionReportDto> =>
    get<SessionReportDto>(`/pos-sessions/${sessionId}/x-report`),

  zReport: (sessionId: Guid): Promise<SessionReportDto> =>
    post<SessionReportDto>(`/pos-sessions/${sessionId}/z-report`),

  menuItems: (q = "", activeOnly = true): Promise<MenuItemDto[]> =>
    getList<MenuItemDto>(`/menu/items${query({ q, activeOnly })}`),

  dashboard: (): Promise<PosDashboardDto> =>
    get<PosDashboardDto>("/pos/dashboard"),

  createSale: (body: CreateSaleRequest): Promise<SaleDto> =>
    post<SaleDto>("/sales", body),

  postSaleCogs: (saleId: Guid): Promise<void> =>
    post<void>(`/sales/${saleId}/post-cogs`),

  postBulkCogs: (fromDate?: string, toDate?: string): Promise<BulkPostCogsResultDto> =>
    post<BulkPostCogsResultDto>(
      `/sales/post-cogs/bulk${query({ fromDate, toDate })}`
    ),
    saleInventoryConsumption: (
  saleId: Guid
): Promise<SaleInventoryConsumptionDto[]> =>
  getList<SaleInventoryConsumptionDto>(
    `/sales/${saleId}/inventory-consumption`
  ),
};