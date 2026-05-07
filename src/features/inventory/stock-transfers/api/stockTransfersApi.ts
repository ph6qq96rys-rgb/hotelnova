import { http } from "../../../../api/http";
import type {
  StockTransferListDto,
  StockTransferDetailDto,
  StockTransferStatus,
  UpdateStockTransferRequest,
  CreateStockTransferRequest,
} from "../types";
export type ItemLookupDto = {
  id: string;
  code?: string | null;
  name?: string | null;
  label?: string | null;
  defaultUomId?: string | null;
};

export type UomLookupDto = {
  id: string;
  code?: string | null;
  name?: string | null;
};
export const stockTransfersApi = {
  listItems: (companyId: string) =>
    http
      .get<ItemLookupDto[]>(`/companies/${companyId}/inventory/items`) // <-- change if needed
      .then((r) => r.data ?? []),

  listUoms: (companyId: string) =>
    http
      .get<UomLookupDto[]>(`/companies/${companyId}/inventory/uoms`) // <-- change if needed
      .then((r) => r.data ?? []),
  list: (companyId: string, status?: StockTransferStatus | null) =>
    http
      .get<StockTransferListDto[]>(`/companies/${companyId}/stock-transfers`, {
        params: { status: status ?? undefined }, 
      })
      .then((r) => r.data),

  get: (companyId: string, id: string) =>
    http
      .get<StockTransferDetailDto>(`/companies/${companyId}/stock-transfers/${id}`)
      .then((r) => r.data),

  create: (companyId: string, body: CreateStockTransferRequest) =>
    http
      .post<string>(`/companies/${companyId}/stock-transfers`, body)
      .then((r) => r.data),

  // Workflow actions
  submit: (companyId: string, id: string) =>
    http
      .post<void>(`/companies/${companyId}/stock-transfers/${id}/submit`, {})
      .then((r) => r.data),

  approve: (companyId: string, id: string) =>
    http
      .post<void>(`/companies/${companyId}/stock-transfers/${id}/approve`, {})
      .then((r) => r.data),

  reject: (companyId: string, id: string, reason: string) =>
    http
      .post<void>(`/companies/${companyId}/stock-transfers/${id}/reject`, { reason })
      .then((r) => r.data),

  post: (companyId: string, id: string) =>
    http
      .post<void>(`/companies/${companyId}/stock-transfers/${id}/post`, {})
      .then((r) => r.data),

  update: (companyId: string, id: string, dto: UpdateStockTransferRequest) =>
    http
      .put<void>(`/companies/${companyId}/stock-transfers/${id}`, dto)
      .then((r) => r.data),

  cancel: (companyId: string, id: string, reason?: string) =>
    http
      .post<void>(`/companies/${companyId}/stock-transfers/${id}/cancel`, { reason: reason ?? null })
      .then((r) => r.data),
};
