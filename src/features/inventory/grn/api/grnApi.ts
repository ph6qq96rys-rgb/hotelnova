import type {
  CreateGrnBody,
  CreateGrnDraftRequest,
  GrnDto,
  GrnListDto,
  GrnDetailDto,
} from "../types/grn";
import { http } from "../../../../api/http";
import type { ItemUomDto } from "../../../inventoryMaster/items/types";

export type ApiResult<T> = {
  items?: T;
  data?: T;
  result?: T;
};

function unwrap<T>(resData: any): T {
  if (resData?.data !== undefined) return resData.data as T;
  if (resData?.result !== undefined) return resData.result as T;
  if (resData?.items !== undefined) return resData.items as T;
  return resData as T;
}

function toIso(d: Date | string) {
  return typeof d === "string" ? d : d.toISOString();
}

export const grnApi = {
  // ===================== DRAFTS =====================

  // POST /companies/{companyId}/grns/drafts
  async createDraft(companyId: string, body: CreateGrnDraftRequest): Promise<GrnDto> {
    const res = await http.post(`/companies/${companyId}/grns`, body);
    return unwrap<GrnDto>(res.data);
  },

  // GET /companies/{companyId}/grns/drafts/{draftId}
  async getDraftById(companyId: string, draftId: string): Promise<GrnDto> {
    const res = await http.get(`/companies/${companyId}/grns/${draftId}`);
    return unwrap<GrnDto>(res.data);
  },

   updateDraft: (companyId: string, draftId: string, body: CreateGrnDraftRequest) =>
    http.put(`/companies/${companyId}/grns/drafts/${draftId}`, body).then((r) => r.data),

  // POST /companies/{companyId}/grns/drafts/{draftId}/post
  async postDraft(companyId: string, draftId: string): Promise<GrnDto> {
    const res = await http.post(`/companies/${companyId}/grns/${draftId}/post`, {});
    return unwrap<GrnDto>(res.data);
  },

  // ===================== POSTED / FINAL =====================

  // POST /companies/{companyId}/grns  (create+post immediately)
  async post(companyId: string, body: CreateGrnBody): Promise<GrnDto> {
    const res = await http.post(`/companies/${companyId}/grns`, body);
    return unwrap<GrnDto>(res.data);
  },

  // GET /companies/{companyId}/grns/{grnId}
  async getById(companyId: string, grnId: string): Promise<GrnDetailDto> {
    const res = await http.get(`/companies/${companyId}/grns/${grnId}`);
    return unwrap<GrnDetailDto>(res.data);
  },

  // GET /companies/{companyId}/grns
  async list(
    companyId: string,
    params?: { page?: number; pageSize?: number; status?: string; q?: string; from?: string; to?: string }
  ): Promise<GrnListDto[]> {
    const res = await http.get(`/companies/${companyId}/grns`, { params });
    return unwrap<GrnListDto[]>(res.data);
  },

  async listByDateRange(companyId: string, from: Date | string, to: Date | string, docstatus?: string) {
    const res = await http.get<GrnDto[]>(`/companies/${companyId}/grns`, {
      params: { from: toIso(from), to: toIso(to), docstatus },
    });
    return unwrap<GrnDto[]>(res.data);
  },

  // ===================== REVERSALS =====================

  async reverseByNumber(companyId: string, grnNumber: string, body: { reason: string | null }) {
    const res = await http.post(
      `/companies/${companyId}/grns/${encodeURIComponent(grnNumber)}/reverse`,
      body
    );
    return unwrap<GrnDto>(res.data);
  },

  async reverseByBatch(companyId: string, batchNo: string, body: { reason: string }) {
    const res = await http.post(
      `/companies/${companyId}/grns/reverse-by-batch/${encodeURIComponent(batchNo)}`,
      body
    );
    return unwrap<GrnDto>(res.data);
  },

  // ===================== ITEM UOMS =====================

  async getItemUoms(companyId: string, itemId: string) {
    const res = await http.get<ItemUomDto[]>(
      `/companies/${companyId}/inventory-master/items/${itemId}/uoms`
    );
    return unwrap<ItemUomDto[]>(res.data);
  },
};
