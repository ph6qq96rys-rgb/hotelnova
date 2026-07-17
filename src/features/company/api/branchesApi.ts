// src/modules/company/api/branchesApi.ts
// ERP-grade Branch API. Branches are company-scoped operating units.

import { http } from "../../../api/http";
import type { BranchDto, CreateBranchDto } from "../types/company.types";
import { requireGuid, unwrapArray } from "./apiGuards";

const base = (companyId: string) =>
  `/companies/${requireGuid(companyId, "companyId")}/branches`;

export const branchesApi = {
  list: async (
    companyId: string,
    params: { page?: number; pageSize?: number; activeOnly?: boolean; q?: string | null } = {},
  ): Promise<BranchDto[]> => {
    const res = await http.get<unknown>(base(companyId), {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 100,
        activeOnly: params.activeOnly ?? true,
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
      },
    });

    return unwrapArray<BranchDto>(res.data);
  },

  get: async (companyId: string, branchId: string): Promise<BranchDto> => {
    const branch = requireGuid(branchId, "branchId");

    const res = await http.get<BranchDto>(`${base(companyId)}/${branch}`);
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
    const branch = requireGuid(branchId, "branchId");

    const res = await http.put<BranchDto>(`${base(companyId)}/${branch}`, dto);
    return res.data;
  },

  setStatus: async (
    companyId: string,
    branchId: string,
    isActive: boolean,
  ): Promise<void> => {
    const branch = requireGuid(branchId, "branchId");

    await http.put(`${base(companyId)}/${branch}/status`, { isActive });
  },
};
