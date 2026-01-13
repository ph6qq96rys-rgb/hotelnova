import { http } from "../../../api/http";
import type { CreateStoreRequest } from "../types";

export type StoreDto = {
  id: string;
  name: string;
  code?: string | null;
  branchId: string;
};

export const storesApi = {
  async list(companyId: string, branchId: string): Promise<StoreDto[]> {
    const res = await http.get(`/companies/${companyId}/branches/${branchId}/stores`);
    return res.data ?? [];
  },

  async create(
    companyId: string,
    branchId: string,
    body: CreateStoreRequest
  ): Promise<StoreDto> {
    const res = await http.post(
      `/companies/${companyId}/branches/${branchId}/stores`,
      body
    );
    return res.data;
  },
};
