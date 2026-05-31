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

const base = (companyId: Guid, branchId: Guid) =>
  `/companies/${companyId}/branches/${branchId}`;

const unwrap = <T>(response: any): T => response?.data ?? response;

export const salesApi = {
  currentSession(companyId: Guid, branchId: Guid) {
    return http.get<PosSessionDto | null>(`${base(companyId, branchId)}/pos-sessions/current`);
  },

  openSession(
    companyId: Guid,
    branchId: Guid,
    payload: { cashierName: string; openingFloat: number; terminal?: string }
  ) {
    return http.post<PosSessionDto>(`${base(companyId, branchId)}/pos-sessions/open`, payload);
  },

  closeSession(
    companyId: Guid,
    branchId: Guid,
    sessionId: Guid,
    payload: { closingFloat: number }
  ) {
    return http.post<PosSessionDto>(
      `${base(companyId, branchId)}/pos-sessions/${sessionId}/close`,
      payload
    );
  },

  xReport(companyId: Guid, branchId: Guid, sessionId: Guid) {
    return http.get<SessionReportDto>(`${base(companyId, branchId)}/pos-sessions/${sessionId}/x-report`);
  },

  zReport(companyId: Guid, branchId: Guid, sessionId: Guid) {
    return http.post<SessionReportDto>(`${base(companyId, branchId)}/pos-sessions/${sessionId}/z-report`, {});
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
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.pageSize) q.set("pageSize", String(params.pageSize));
    if (params?.status) q.set("status", String(params.status));
    if (params?.q) q.set("q", params.q);
    if (params?.fromDate) q.set("fromDate", params.fromDate);
    if (params?.toDate) q.set("toDate", params.toDate);

    return http.get<SaleListResponse>(`${base(companyId, branchId)}/sales${q.toString() ? `?${q}` : ""}`);
  },

  get(companyId: Guid, branchId: Guid, saleId: Guid) {
    return http.get<SaleDto>(`${base(companyId, branchId)}/sales/${saleId}`);
  },

  createSale(payload: CreateSaleDto) {
    return http.post<SaleDto>(`${base(payload.companyId, payload.branchId)}/sales`, payload);
  },

  create(companyId: Guid, branchId: Guid, payload: CreateSaleDto) {
    return http.post<SaleDto>(`${base(companyId, branchId)}/sales`, payload);
  },

  confirm(companyId: Guid, branchId: Guid, saleId: Guid) {
    return http.post<SaleDto>(`${base(companyId, branchId)}/sales/${saleId}/confirm`, {});
  },

  cancel(companyId: Guid, branchId: Guid, saleId: Guid, reason?: string) {
    return http.post(`${base(companyId, branchId)}/sales/${saleId}/cancel`, { reason });
  },

  postCogs(companyId: Guid, branchId: Guid, saleId: Guid) {
    return http.post(`${base(companyId, branchId)}/sales/${saleId}/post-cogs`, {});
  },

  postBulkCogs(companyId: Guid, branchId: Guid, params?: { fromDate?: string; toDate?: string }) {
    const q = new URLSearchParams();
    if (params?.fromDate) q.set("fromDate", params.fromDate);
    if (params?.toDate) q.set("toDate", params.toDate);
    return http.post<BulkPostCogsResultDto>(
      `${base(companyId, branchId)}/sales/post-cogs/bulk${q.toString() ? `?${q}` : ""}`,
      {}
    );
  },

  postCogsBulk(companyId: Guid, branchId: Guid, params?: { fromDate?: string; toDate?: string }) {
    return this.postBulkCogs(companyId, branchId, params);
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
    const form = new FormData();
    form.append("locationId", payload.locationId);
    form.append("salesDate", payload.salesDate);
    form.append("sourcePlatform", payload.sourcePlatform);
    form.append("file", payload.file);
    form.append("replaceExisting", String(payload.replaceExisting));

    return http.post<ImportExternalSalesResultDto>(
      `${base(companyId, branchId)}/external-sales/import`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  searchMenuItems(companyId: Guid, branchId: Guid, search: string) {
    return http.get<MenuItemLookupDto[]>(
      `${base(companyId, branchId)}/menu/items/lookup?q=${encodeURIComponent(search)}`
    );
  },

  stockLocations(companyId: Guid, branchId: Guid) {
    return http.get<StockLocationDto[]>(`${base(companyId, branchId)}/stock-locations`);
  },

  async listMenuItems(companyId: Guid, branchId: Guid, search = ""): Promise<MenuItemLookupDto[]> {
    const response = await this.searchMenuItems(companyId, branchId, search);
    const raw = unwrap<MenuItemLookupDto[] | { items?: MenuItemLookupDto[]; data?: MenuItemLookupDto[] }>(response);
    if (Array.isArray(raw)) return raw;
    return raw.items ?? raw.data ?? [];
  },

  async listStockLocations(companyId: Guid, branchId: Guid): Promise<StockLocationDto[]> {
    const response = await this.stockLocations(companyId, branchId);
    const raw = unwrap<StockLocationDto[] | { items?: StockLocationDto[]; data?: StockLocationDto[] }>(response);
    if (Array.isArray(raw)) return raw;
    return raw.items ?? raw.data ?? [];
  },
};

export const posApi = salesApi;
