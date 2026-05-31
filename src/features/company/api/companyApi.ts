// src/modules/company/api/companyApi.ts
//
// ── What was wrong ───────────────────────────────────────────────────────────
// 1. listStores(companyId, branchId?) interpolated branchId into the URL even
//    when it was undefined, producing /branches/undefined/stores. branchId is
//    now required — callers that need a company-wide list should call
//    listBranches first, then listStores per branch.
//
// 2. updateCompany typed its body as `any`. Now uses UpdateCompanyDto.
//
// 3. addBranch returned only the ID string. Now returns the full BranchDto
//    so callers don't need a separate get() call.

import { http } from "../../../api/http";
import type {
  CompanyDto, CompanyListResponse,
  CreateCompanyDto, UpdateCompanyDto,
  BranchDto, CreateBranchDto, BranchVm,
  StoreDto, CreateStoreDto, StoreVm,
  CompanySettingsDto,
  CreateCompanyAdminUserDto,
} from "../types/company.types";

export const companyApi = {

  // ── Companies ──────────────────────────────────────────────────────────────

  listCompanies: async (page = 1, pageSize = 20): Promise<CompanyListResponse> => {
    const res = await http.get<CompanyListResponse>("/companies", { params: { page, pageSize } });
    return res.data;
  },

  getCompany: async (id: string): Promise<CompanyDto> => {
    const res = await http.get<CompanyDto>(`/companies/${id}`);
    return res.data;
  },

  createCompany: async (dto: CreateCompanyDto): Promise<CompanyDto> => {
    const res = await http.post<CompanyDto>("/companies", dto);
    return res.data;
  },

  updateCompany: async (id: string, dto: UpdateCompanyDto): Promise<CompanyDto> => {
    const res = await http.put<CompanyDto>(`/companies/${id}`, dto);
    return res.data;
  },

  activateCompany: async (id: string): Promise<void> => {
    await http.post(`/companies/${id}/activate`);
  },

  // ── Branches ───────────────────────────────────────────────────────────────

  listBranches: async (companyId: string): Promise<BranchVm[]> => {
    const res = await http.get<BranchVm[]>(`/companies/${companyId}/branches`);
    return Array.isArray(res.data) ? res.data : [];
  },

  addBranch: async (companyId: string, dto: CreateBranchDto): Promise<BranchDto> => {
    const res = await http.post<BranchDto>(`/companies/${companyId}/branches`, dto);
    return res.data;
  },

  // ── Stores ─────────────────────────────────────────────────────────────────

  // FIX: branchId is now required — was optional but interpolated into the URL
  // regardless, producing /branches/undefined/stores when omitted.
  listStores: async (companyId: string, branchId: string): Promise<StoreVm[]> => {
    const res = await http.get<StoreVm[]>(`/companies/${companyId}/branches/${branchId}/stores`);
    return Array.isArray(res.data) ? res.data : [];
  },

  addStore: async (companyId: string, dto: CreateStoreDto): Promise<StoreDto> => {
    if (!dto.branchId) throw new Error("addStore: branchId is required");
    const res = await http.post<StoreDto>(
      `/companies/${companyId}/branches/${dto.branchId}/stores`,
      dto
    );
    return res.data;
  },

  // ── Settings ───────────────────────────────────────────────────────────────

  getSettings: async (companyId: string): Promise<CompanySettingsDto> => {
    const res = await http.get<CompanySettingsDto>(`/companies/${companyId}/settings`);
    return res.data;
  },

  updateSettings: async (companyId: string, dto: CompanySettingsDto): Promise<CompanySettingsDto> => {
    const res = await http.put<CompanySettingsDto>(`/companies/${companyId}/settings`, dto);
    return res.data;
  },

  // ── Admin user ─────────────────────────────────────────────────────────────

  createCompanyAdmin: async (companyId: string, dto: CreateCompanyAdminUserDto): Promise<string> => {
    const res = await http.post<{ userId: string }>(`/companies/${companyId}/users/admin`, dto);
    return res.data.userId;
  },
};