// src/modules/company/api/storesApi.ts

import { http } from "../../../api/http";
import type { StoreDto, CreateStoreDto } from "../types/company.types";
export type { StoreDto };

const base = (companyId: string, branchId: string) =>
  `/companies/${companyId}/branches/${branchId}/stores`;

function unwrap<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.items))   return r.items   as T[];
  if (Array.isArray(r.data))    return r.data     as T[];
  if (Array.isArray(r.results)) return r.results  as T[];
  return [];
}

export const storesApi = {

  list: async (companyId: string, branchId: string): Promise<StoreDto[]> => {
    const res = await http.get<unknown>(base(companyId, branchId));
    return unwrap<StoreDto>(res.data);
  },

  create: async (
    companyId: string,
    branchId: string,
    body: CreateStoreDto,
  ): Promise<StoreDto> => {
    const res = await http.post<StoreDto>(base(companyId, branchId), body);
    return res.data;
  },
};