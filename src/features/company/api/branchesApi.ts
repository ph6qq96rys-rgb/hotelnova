// src/modules/company/api/branchesApi.ts

import { http } from "../../../api/http";
import type { BranchDto, CreateBranchDto } from "../types/company.types";

const base = (companyId: string) => `/companies/${companyId}/branches`;

/** Unwrap any paged-response envelope into a plain array. */
function unwrap<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.items))   return r.items   as T[];
  if (Array.isArray(r.data))    return r.data     as T[];
  if (Array.isArray(r.results)) return r.results  as T[];
  return [];
}

export const branchesApi = {
  list: async (companyId: string): Promise<BranchDto[]> => {
    const res = await http.get<unknown>(base(companyId));
    return unwrap<BranchDto>(res.data);
  },

  get: async (companyId: string, branchId: string): Promise<BranchDto> => {
    const res = await http.get<BranchDto>(`${base(companyId)}/${branchId}`);
    return res.data;
  },

  create: async (companyId: string, dto: CreateBranchDto): Promise<BranchDto> => {
    const res = await http.post<BranchDto>(base(companyId), dto);
    return res.data;
  },

  update: async (
    companyId: string,
    branchId: string,
    dto: Partial<CreateBranchDto>,
  ): Promise<BranchDto> => {
    const res = await http.put<BranchDto>(`${base(companyId)}/${branchId}`, dto);
    return res.data;
  },
};