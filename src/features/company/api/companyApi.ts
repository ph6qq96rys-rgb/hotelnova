// src/modules/company/api/companyApi.ts

import { http } from "../../../api/http";

import type {
  CompanyDto,
  CompanyListResponse,
  CreateCompanyDto,
  UpdateCompanyDto,
  BranchDto,
  CreateBranchDto,
  BranchVm,
  StoreDto,
  CreateStoreDto,
  StoreVm,
  CompanySettingsDto,
  CreateCompanyAdminUserDto,
} from "../types/company.types";

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

function cleanGuid(value: string | null | undefined): string {
  if (!value) return "";

  const match = value.trim().match(GUID_REGEX);

  return match?.[0] ?? "";
}

function requireGuid(value: string | null | undefined, name: string): string {
  const id = cleanGuid(value);

  if (!id) {
    throw new Error(`${name} is required and must be a valid GUID.`);
  }

  return id;
}

export const companyApi = {
  // ── Companies ──────────────────────────────────────────────────────────────

  listCompanies: async (
    page = 1,
    pageSize = 20
  ): Promise<CompanyListResponse> => {
    const res = await http.get<CompanyListResponse>("/companies", {
      params: { page, pageSize },
    });

    return res.data;
  },

  getCompany: async (id: string): Promise<CompanyDto> => {
    const companyId = requireGuid(id, "companyId");

    const res = await http.get<CompanyDto>(`/companies/${companyId}`);

    return res.data;
  },

  createCompany: async (dto: CreateCompanyDto): Promise<CompanyDto> => {
    const res = await http.post<CompanyDto>("/companies", dto);

    return res.data;
  },

  updateCompany: async (
    id: string,
    dto: UpdateCompanyDto
  ): Promise<CompanyDto> => {
    const companyId = requireGuid(id, "companyId");

    const res = await http.put<CompanyDto>(`/companies/${companyId}`, dto);

    return res.data;
  },

  activateCompany: async (id: string): Promise<void> => {
    const companyId = requireGuid(id, "companyId");

    await http.post(`/companies/${companyId}/activate`);
  },

  // ── Branches ───────────────────────────────────────────────────────────────

  listBranches: async (companyId: string): Promise<BranchVm[]> => {
    const id = requireGuid(companyId, "companyId");

    const res = await http.get<BranchVm[]>(`/companies/${id}/branches`);

    return Array.isArray(res.data) ? res.data : [];
  },

  addBranch: async (
    companyId: string,
    dto: CreateBranchDto
  ): Promise<BranchDto> => {
    const id = requireGuid(companyId, "companyId");

    const res = await http.post<BranchDto>(`/companies/${id}/branches`, dto);

    return res.data;
  },

  // ── Stores ─────────────────────────────────────────────────────────────────

  listStores: async (
    companyId: string,
    branchId: string
  ): Promise<StoreVm[]> => {
    const id = requireGuid(companyId, "companyId");
    const branch = requireGuid(branchId, "branchId");

    const res = await http.get<StoreVm[]>(
      `/companies/${id}/branches/${branch}/stores`
    );

    return Array.isArray(res.data) ? res.data : [];
  },

  addStore: async (
    companyId: string,
    dto: CreateStoreDto
  ): Promise<StoreDto> => {
    const id = requireGuid(companyId, "companyId");
    const branch = requireGuid(dto.branchId, "branchId");

    const res = await http.post<StoreDto>(
      `/companies/${id}/branches/${branch}/stores`,
      dto
    );

    return res.data;
  },

  // ── Settings ───────────────────────────────────────────────────────────────

  getSettings: async (companyId: string): Promise<CompanySettingsDto> => {
    const id = requireGuid(companyId, "companyId");

    const res = await http.get<CompanySettingsDto>(
      `/companies/${id}/settings`
    );

    return res.data;
  },

  updateSettings: async (
    companyId: string,
    dto: CompanySettingsDto
  ): Promise<CompanySettingsDto> => {
    const id = requireGuid(companyId, "companyId");

    const res = await http.put<CompanySettingsDto>(
      `/companies/${id}/settings`,
      dto
    );

    return res.data;
  },

  // ── Admin user ─────────────────────────────────────────────────────────────

  createCompanyAdmin: async (
    companyId: string,
    dto: CreateCompanyAdminUserDto
  ): Promise<string> => {
    const id = requireGuid(companyId, "companyId");

    const res = await http.post<{ userId: string }>(
      `/companies/${id}/users/admin`,
      dto
    );

    return res.data.userId;
  },
};