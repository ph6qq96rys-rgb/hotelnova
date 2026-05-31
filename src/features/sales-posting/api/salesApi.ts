// ─── Sales API ────────────────────────────────────────────────────────────────
// All sales and POS endpoints in one file, consistently structured.

import { http } from "../../../api/http";
import type {
  SaleDto, SaleListResponse, SaleListParams, CreateSaleRequest,
  BulkPostCogsResult, ImportResult,
  MenuCategoryDto, MenuItemPosDto, PosSessionDto, SessionReportDto,
} from "../sales.types";

// Re-export all types so pages can import from either salesApi or sales.types.
export type {
  SaleDto, SaleListResponse, SaleListParams, CreateSaleRequest,
  BulkPostCogsResult, ImportResult,
  MenuCategoryDto, MenuItemPosDto, PosSessionDto, SessionReportDto,
};

// ── URL builders ──────────────────────────────────────────────────────────────

const salesBase = (companyId: string, branchId: string) =>
  `/companies/${companyId}/branches/${branchId}/sales`;

const posBase = (companyId: string, branchId: string) =>
  `/companies/${companyId}/branches/${branchId}`;

// ── Helper ────────────────────────────────────────────────────────────────────

const data = <T>(res: { data: T }) => res.data;

// ── Sales API ─────────────────────────────────────────────────────────────────

export const salesApi = {
  list: (companyId: string, branchId: string, params?: SaleListParams) =>
    http.get<SaleListResponse>(salesBase(companyId, branchId), { params }).then(data),

  get: (companyId: string, branchId: string, saleId: string) =>
    http.get<SaleDto>(`${salesBase(companyId, branchId)}/${saleId}`).then(data),

  create: (companyId: string, branchId: string, payload: CreateSaleRequest) =>
    http.post<SaleDto>(salesBase(companyId, branchId), payload).then(data),

  confirm: (companyId: string, branchId: string, saleId: string) =>
    http.post<SaleDto>(`${salesBase(companyId, branchId)}/${saleId}/confirm`).then(data),

  cancel: (companyId: string, branchId: string, saleId: string, reason?: string) =>
    http.post(`${salesBase(companyId, branchId)}/${saleId}/cancel`, { reason }).then(data),

  postCogs: (companyId: string, branchId: string, saleId: string) =>
    http.post(`${salesBase(companyId, branchId)}/${saleId}/post-cogs`).then(data),

  postCogsBulk: (
    companyId: string,
    branchId: string,
    params?: { fromDate?: string; toDate?: string }
  ): Promise<BulkPostCogsResult> =>
    http
      .post(`${salesBase(companyId, branchId)}/post-cogs/bulk`, null, { params })
      .then(data),

  recordPayment: (
    companyId: string,
    branchId: string,
    saleId: string,
    payload: { method: string; amount: number; referenceCode?: string }
  ) =>
    http.post(`${salesBase(companyId, branchId)}/${saleId}/payments`, payload).then(data),

  importFromExcel: (companyId: string, branchId: string, file: File): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file);
    return http
      .post(`${salesBase(companyId, branchId)}/import`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then(data);
  },
};

// ── POS API ───────────────────────────────────────────────────────────────────

export const posApi = {
  // Catalog
  categories: (companyId: string, branchId: string) =>
    http
      .get<MenuCategoryDto[]>(`${posBase(companyId, branchId)}/menu-categories`)
      .then(data),

  categoryItems: (companyId: string, branchId: string, categoryId: string) =>
    http
      .get<MenuItemPosDto[]>(
        `${posBase(companyId, branchId)}/menu-categories/${categoryId}/items`
      )
      .then(data),

  // Session
  currentSession: (companyId: string, branchId: string) =>
    http
      .get<PosSessionDto | null>(`${posBase(companyId, branchId)}/pos-sessions/current`)
      .then(data),

  openSession: (
    companyId: string,
    branchId: string,
    payload: { cashierName: string; openingFloat: number; terminal?: string }
  ) =>
    http
      .post<PosSessionDto>(`${posBase(companyId, branchId)}/pos-sessions/open`, payload)
      .then(data),

  closeSession: (
    companyId: string,
    branchId: string,
    sessionId: string,
    closingFloat: number
  ) =>
    http
      .post<PosSessionDto>(
        `${posBase(companyId, branchId)}/pos-sessions/${sessionId}/close`,
        { closingFloat }
      )
      .then(data),

  xReport: (companyId: string, branchId: string, sessionId: string) =>
    http
      .get<SessionReportDto>(
        `${posBase(companyId, branchId)}/pos-sessions/${sessionId}/x-report`
      )
      .then(data),

  zReport: (companyId: string, branchId: string, sessionId: string) =>
    http
      .post<SessionReportDto>(
        `${posBase(companyId, branchId)}/pos-sessions/${sessionId}/z-report`
      )
      .then(data),
};