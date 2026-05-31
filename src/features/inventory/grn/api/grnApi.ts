import type {
  CreateGrnDraftRequest,
  GrnListDto,
  GrnDetailDto,
  ReverseGrnRequest,
} from "../types/grn.types";
import { http } from "../../../../api/http";
import type { ItemUomDto } from "../../../inventoryMaster/items/types";

function unwrap<T>(resData: unknown): T {
  const d = resData as Record<string, unknown>;
  if (d?.data   !== undefined) return d.data   as T;
  if (d?.result !== undefined) return d.result as T;
  if (d?.items  !== undefined) return d.items  as T;
  return resData as T;
}

const toIso = (d: Date | string): string =>
  typeof d === "string" ? d : d.toISOString();

const cleanParams = (params: Record<string, string | undefined>) => {
  const query: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value?.trim()) query[key] = value;
  });
  return query;
};

export interface GrnListParams {
  status?: string;
  from?: string;
  to?: string;
}

export interface GrnDateRangeParams {
  from: Date | string;
  to: Date | string;
  status?: string;
}

const base = (companyId: string) => `/companies/${companyId}/grns`;

export const grnApi = {
  createDraft(companyId: string, body: CreateGrnDraftRequest): Promise<GrnDetailDto> {
    return http.post(base(companyId), body).then((r) => unwrap<GrnDetailDto>(r.data));
  },

  // FIX: getDraftById was byte-for-byte identical to getById — removed.
  // Use getById for both draft and posted GRNs; the backend route is the same.
  getById(companyId: string, grnId: string): Promise<GrnDetailDto> {
    return http.get(`${base(companyId)}/${grnId}`).then((r) => unwrap<GrnDetailDto>(r.data));
  },

  updateDraft(companyId: string, draftId: string, body: CreateGrnDraftRequest): Promise<GrnDetailDto> {
    return http.put(`${base(companyId)}/${draftId}`, body).then((r) => unwrap<GrnDetailDto>(r.data));
  },

  postDraft(companyId: string, draftId: string): Promise<void> {
    return http.post(`${base(companyId)}/${draftId}/post`, {}).then(() => undefined);
  },

  list(companyId: string, params?: GrnListParams): Promise<GrnListDto[]> {
    return http
      .get(base(companyId), { params: cleanParams({ status: params?.status, from: params?.from, to: params?.to }) })
      .then((r) => unwrap<GrnListDto[]>(r.data));
  },

  listByDateRange(companyId: string, { from, to, status }: GrnDateRangeParams): Promise<GrnDetailDto[]> {
    return http
      .get(base(companyId), { params: cleanParams({ from: toIso(from), to: toIso(to), status }) })
      .then((r) => unwrap<GrnDetailDto[]>(r.data));
  },

  reverse(companyId: string, grnId: string, body: ReverseGrnRequest): Promise<void> {
    return http.post(`${base(companyId)}/${grnId}/reverse`, body).then(() => undefined);
  },

  // FIX: renamed from reverseByNumber. The original JSDoc explicitly stated
  // the parameter is a GUID, not a GRN number — the name was misleading.
  reverseById(companyId: string, grnId: string, body: ReverseGrnRequest): Promise<void> {
    return grnApi.reverse(companyId, grnId, body);
  },

  reverseByBatch(companyId: string, batchNo: string, body: ReverseGrnRequest): Promise<void> {
    return http
      .post(`${base(companyId)}/reverse-by-batch/${encodeURIComponent(batchNo)}`, body)
      .then(() => undefined);
  },

  getItemUoms(companyId: string, itemId: string): Promise<ItemUomDto[]> {
    return http
      .get(`/companies/${companyId}/inventory-master/items/${itemId}/uoms`)
      .then((r) => unwrap<ItemUomDto[]>(r.data));
  },
};