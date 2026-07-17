// src/modules/company/api/companyApi.ts
// ERP-grade Company API.
// Keep this file company-focused only. Branches, stores, and stock locations
// have dedicated APIs to avoid route ambiguity during onboarding.

import { http } from "../../../api/http";
import type {
  CompanyDto,
  CompanyListResponse,
  CompanySettingsDto,
  CreateCompanyAdminUserDto,
  CreateCompanyDto,
  UpdateCompanyDto,
} from "../types/company.types";
import { requireGuid } from "./apiGuards";

export const companyApi = {
  listCompanies: async (page = 1, pageSize = 50): Promise<CompanyListResponse> => {
    const res = await http.get<CompanyListResponse>("/companies", {
      params: { page, pageSize },
    });

    return res.data;
  },

  getCompany: async (companyId: string): Promise<CompanyDto> => {
    const id = requireGuid(companyId, "companyId");

    const res = await http.get<CompanyDto>(`/companies/${id}`);
    return res.data;
  },

  createCompany: async (dto: CreateCompanyDto): Promise<CompanyDto> => {
    const res = await http.post<CompanyDto>("/companies", dto);
    return res.data;
  },

  updateCompany: async (
    companyId: string,
    dto: UpdateCompanyDto,
  ): Promise<CompanyDto> => {
    const id = requireGuid(companyId, "companyId");

    const res = await http.put<CompanyDto>(`/companies/${id}`, dto);
    return res.data;
  },

  activateCompany: async (companyId: string): Promise<void> => {
    const id = requireGuid(companyId, "companyId");

    await http.post(`/companies/${id}/activate`);
  },

  getSettings: async (companyId: string): Promise<CompanySettingsDto> => {
    const id = requireGuid(companyId, "companyId");

    const res = await http.get<CompanySettingsDto>(`/companies/${id}/settings`);
    return res.data;
  },

  updateSettings: async (
    companyId: string,
    dto: CompanySettingsDto,
  ): Promise<CompanySettingsDto> => {
    const id = requireGuid(companyId, "companyId");

    const res = await http.put<CompanySettingsDto>(`/companies/${id}/settings`, dto);
    return res.data;
  },

  createCompanyAdmin: async (
    companyId: string,
    dto: CreateCompanyAdminUserDto,
  ): Promise<string> => {
    const id = requireGuid(companyId, "companyId");

    const res = await http.post<{ userId: string }>(`/companies/${id}/users/admin`, dto);
    return res.data.userId;
  },
};
