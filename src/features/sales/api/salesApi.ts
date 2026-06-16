// src/features/sales/api/salesApi.ts

import { http } from "../../../api/http";
import type {
  BulkPostCogsResultDto,
  CreateSaleDto,
  Guid,
  ImportExternalSalesResultDto,
  MenuItemLookupDto,
  PosSessionDto,
  SaleDto,
  SaleListResponse,
  SessionReportDto,
  StockLocationDto,
} from "./salesTypes";

type ListEnvelope<T> = T[] | { items?: T[]; data?: T[]; results?: T[] };

function requireGuid(label: string, value?: Guid | null): Guid {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(`${label} is missing. Please select company and branch again.`);
  }

  return text as Guid;
}

function branchBase(companyId: Guid, branchId: Guid): string {
  return `/companies/${requireGuid("Company ID", companyId)}/branches/${requireGuid(
    "Branch ID",
    branchId
  )}`;
}

function companyBase(companyId: Guid): string {
  return `/companies/${requireGuid("Company ID", companyId)}`;
}

function query(params?: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      search.set(key, String(value));
    }
  }

  const text = search.toString();
  return text ? `?${text}` : "";
}

function unwrapResponse<T>(response: { data?: T } | T): T {
  return (response as { data?: T })?.data ?? (response as T);
}

function unwrapList<T>(value: ListEnvelope<T> | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.results)) return value.results;
  return [];
}

export const salesApi = {
  currentSession(companyId: Guid, branchId: Guid) {
    return http.get<PosSessionDto | null>(
      `${branchBase(companyId, branchId)}/pos-sessions/current`
    );
  },

  openSession(
    companyId: Guid,
    branchId: Guid,
    payload: {
      cashierName: string;
      openingFloat: number;
      terminal?: string;
    }
  ) {
    return http.post<PosSessionDto>(
      `${branchBase(companyId, branchId)}/pos-sessions/open`,
      payload
    );
  },

  closeSession(
    companyId: Guid,
    branchId: Guid,
    sessionId: Guid,
    payload: {
      closingFloat: number;
    }
  ) {
    requireGuid("Session ID", sessionId);

    return http.post<PosSessionDto>(
      `${branchBase(companyId, branchId)}/pos-sessions/${sessionId}/close`,
      payload
    );
  },

  xReport(companyId: Guid, branchId: Guid, sessionId: Guid) {
    requireGuid("Session ID", sessionId);

    return http.get<SessionReportDto>(
      `${branchBase(companyId, branchId)}/pos-sessions/${sessionId}/x-report`
    );
  },

  zReport(companyId: Guid, branchId: Guid, sessionId: Guid) {
    requireGuid("Session ID", sessionId);

    return http.post<SessionReportDto>(
      `${branchBase(companyId, branchId)}/pos-sessions/${sessionId}/z-report`,
      {}
    );
  },

  list(
    companyId: Guid,
    branchId: Guid,
    params?: {
      page?: number;
      pageSize?: number;
      status?: number;
      q?: string;
      fromDate?: string;
      toDate?: string;
    }
  ) {
    return http.get<SaleListResponse>(
      `${branchBase(companyId, branchId)}/sales${query(params)}`
    );
  },

  get(companyId: Guid, branchId: Guid, saleId: Guid) {
    requireGuid("Sale ID", saleId);

    return http.get<SaleDto>(
      `${branchBase(companyId, branchId)}/sales/${saleId}`
    );
  },

  createSale(payload: CreateSaleDto) {
    return http.post<SaleDto>(
      `${branchBase(payload.companyId, payload.branchId)}/sales`,
      payload
    );
  },

  create(companyId: Guid, branchId: Guid, payload: CreateSaleDto) {
    return http.post<SaleDto>(
      `${branchBase(companyId, branchId)}/sales`,
      {
        ...payload,
        companyId,
        branchId,
      }
    );
  },

  confirm(companyId: Guid, branchId: Guid, saleId: Guid) {
    requireGuid("Sale ID", saleId);

    return http.post<SaleDto>(
      `${branchBase(companyId, branchId)}/sales/${saleId}/confirm`,
      {}
    );
  },

  cancel(companyId: Guid, branchId: Guid, saleId: Guid, reason?: string) {
    requireGuid("Sale ID", saleId);

    return http.post(
      `${branchBase(companyId, branchId)}/sales/${saleId}/cancel`,
      {
        reason: reason?.trim() || null,
      }
    );
  },

  postCogs(companyId: Guid, branchId: Guid, saleId: Guid) {
    requireGuid("Sale ID", saleId);

    return http.post(
      `${branchBase(companyId, branchId)}/sales/${saleId}/post-cogs`,
      {}
    );
  },

  postBulkCogs(
    companyId: Guid,
    branchId: Guid,
    params?: {
      fromDate?: string;
      toDate?: string;
    }
  ) {
    return http.post<BulkPostCogsResultDto>(
      `${branchBase(companyId, branchId)}/sales/post-cogs/bulk${query(params)}`,
      {}
    );
  },

  postCogsBulk(
    companyId: Guid,
    branchId: Guid,
    params?: {
      fromDate?: string;
      toDate?: string;
    }
  ) {
    return salesApi.postBulkCogs(companyId, branchId, params);
  },

  importExternalSales(
    companyId: Guid,
    branchId: Guid,
    payload: {
      locationId: Guid;
      salesDate: string;
      sourcePlatform: string;
      file: File;
      replaceExisting: boolean;
    }
  ) {
    requireGuid("Location ID", payload.locationId);

    const form = new FormData();
    form.append("locationId", payload.locationId);
    form.append("salesDate", payload.salesDate);
    form.append("sourcePlatform", payload.sourcePlatform);
    form.append("file", payload.file);
    form.append("replaceExisting", String(payload.replaceExisting));

    return http.post<ImportExternalSalesResultDto>(
      `${branchBase(companyId, branchId)}/external-sales/import`,
      form,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
  },

  searchMenuItems(companyId: Guid, branchId: Guid, search = "") {
    return http.get<MenuItemLookupDto[]>(
      `${branchBase(companyId, branchId)}/menu/items/lookup${query({
        q: search,
      })}`
    );
  },

  /**
   * ERP rule:
   * Stock locations are company-scoped.
   *
   * Correct route:
   * GET /companies/{companyId}/stock-locations
   *
   * Do not call:
   * GET /companies/{companyId}/branches/{branchId}/stock-locations
   */
  stockLocations(
    companyId: Guid,
    params?: {
      branchId?: Guid | null;
      activeOnly?: boolean;
      page?: number;
      pageSize?: number;
      q?: string;
      locationType?: number | string | null;
    }
  ) {
    return http.get<ListEnvelope<StockLocationDto>>(
      `${companyBase(companyId)}/stock-locations${query({
        branchId: params?.branchId,
        activeOnly: params?.activeOnly ?? true,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 100,
        q: params?.q,
        locationType: params?.locationType,
      })}`
    );
  },

  async listMenuItems(
    companyId: Guid,
    branchId: Guid,
    search = ""
  ): Promise<MenuItemLookupDto[]> {
    const response = await salesApi.searchMenuItems(companyId, branchId, search);
    return unwrapList<MenuItemLookupDto>(unwrapResponse(response));
  },

  async listStockLocations(
    companyId: Guid,
    params?: {
      branchId?: Guid | null;
      activeOnly?: boolean;
      page?: number;
      pageSize?: number;
      q?: string;
      locationType?: number | string | null;
    }
  ): Promise<StockLocationDto[]> {
    const response = await salesApi.stockLocations(companyId, params);
    return unwrapList<StockLocationDto>(unwrapResponse(response));
  },
};

export const posApi = salesApi;