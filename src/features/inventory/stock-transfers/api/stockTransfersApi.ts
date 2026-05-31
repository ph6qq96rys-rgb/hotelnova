import { http } from "../../../../api/http";
import type {
  StockTransferListDto,
  StockTransferDetailDto,
  StockTransferStatus,
  UpdateStockTransferRequest,
  CreateStockTransferRequest,
} from "../types";

export type ItemLookupDto = {
  id:            string;
  code?:         string | null;
  sku?:          string | null;   // API returns sku, not code
  name?:         string | null;
  label?:        string | null;
  defaultUomId?: string | null;
  baseUomId?:    string | null;
  uoms?:         Array<{ uomId: string; code?: string | null; name?: string | null }>;
};

export type UomLookupDto = {
  id:    string;
  code?: string | null;
  name?: string | null;
};

const base = (companyId: string, branchId: string) =>
  `/companies/${companyId}/branches/${branchId}/stock-transfers`;

export const stockTransfersApi = {

  // ── Lookups ───────────────────────────────────────────────────────────────
  // Both endpoints live under /inventory-master (company-scoped, no branchId)

  listItems: (companyId: string) =>
    http
      .get<ItemLookupDto[]>(`/companies/${companyId}/inventory-master/items`)
      .then((r) => r.data ?? []),

  listUoms: (companyId: string) =>
    http
      .get<UomLookupDto[]>(`/companies/${companyId}/inventory-master/uoms`)
      .then((r) => r.data ?? []),

  // ── Stock transfers ───────────────────────────────────────────────────────

  list: (companyId: string, branchId: string, status?: StockTransferStatus | null) =>
    http
      .get<StockTransferListDto[]>(base(companyId, branchId), {
        params: { status: status ?? undefined },
      })
      .then((r) => r.data),

  get: (companyId: string, branchId: string, id: string) =>
    http
      .get<StockTransferDetailDto>(`${base(companyId, branchId)}/${id}`)
      .then((r) => r.data),

  create: (companyId: string, branchId: string, body: CreateStockTransferRequest) =>
    http
      .post<string>(base(companyId, branchId), body)
      .then((r) => r.data),

  update: (companyId: string, branchId: string, id: string, dto: UpdateStockTransferRequest) =>
    http
      .put<void>(`${base(companyId, branchId)}/${id}`, dto)
      .then((r) => r.data),

  submit: (companyId: string, branchId: string, id: string) =>
    http
      .post<void>(`${base(companyId, branchId)}/${id}/submit`, {})
      .then((r) => r.data),

  approve: (companyId: string, branchId: string, id: string) =>
    http
      .post<void>(`${base(companyId, branchId)}/${id}/approve`, {})
      .then((r) => r.data),

  reject: (companyId: string, branchId: string, id: string, reason: string) =>
    http
      .post<void>(`${base(companyId, branchId)}/${id}/reject`, { reason })
      .then((r) => r.data),

  post: (companyId: string, branchId: string, id: string) =>
    http
      .post<void>(`${base(companyId, branchId)}/${id}/post`, {})
      .then((r) => r.data),

  cancel: (companyId: string, branchId: string, id: string, reason?: string) =>
    http
      .post<void>(`${base(companyId, branchId)}/${id}/cancel`, { reason: reason ?? null })
      .then((r) => r.data),
};