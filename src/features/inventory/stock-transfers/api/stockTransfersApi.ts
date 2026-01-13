import { http } from "../../../../api/http";
import type {
  StockTransferListDto,
  StockTransferDetailDto,
  StockTransferStatus,
  UpdateStockTransferRequest,
  CreateStockTransferRequestDto,
} from "../types";

export const stockTransfersApi = {
  list: (companyId: string, status?: StockTransferStatus | null) =>
    http
      .get<StockTransferListDto[]>(`/companies/${companyId}/stock-transfers`, {
        params: { status: status ?? undefined }, // ✅ don't repeat companyId
      })
      .then((r) => r.data),

  get: (companyId: string, id: string) =>
    http
      .get<StockTransferDetailDto>(`/companies/${companyId}/stock-transfers/${id}`)
      .then((r) => r.data),

  create: (companyId: string, body: CreateStockTransferRequestDto) =>
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
