import { http } from "../../../api/http";
import type {
  CompanyDto,
  CompanySettingsDto,
  CreateBranchDto,
  CreateCompanyAdminUserDto,
  CreateCompanyDto,
  CreateStoreDto,
  PagedResult,
  BranchVm,
  StoreVm,
} from "../types";




/**
 * NOTE:
 * - Do NOT add interceptors here.
 * - Token is already attached globally in api/http.ts via authStorage/loadAuth.
 */

export const companyApi = {
  async listCompanies(page = 1, pageSize = 20) {
    const res = await http.get<PagedResult<CompanyDto>>(`/companies`, {
      params: { page, pageSize },
    });
    return res.data;
  },

  async createCompany(dto: CreateCompanyDto) {
    const res = await http.post<CompanyDto>(`/companies`, dto);
    return res.data;
  },

  async getCompany(id: string) {
    const res = await http.get<CompanyDto>(`/companies/${id}`);
    return res.data;
  },

  async activateCompany(id: string) {
    await http.post(`/companies/${id}/activate`);
  },

  async listBranches(companyId: string) {
    const res = await http.get<BranchVm[]>(`/companies/${companyId}/branches`);
    return res.data;
  },

  async addBranch(companyId: string, dto: CreateBranchDto) {
    const res = await http.post<{ id: string }>(
      `/companies/${companyId}/branches`,
      dto
    );
    return res.data.id;
  },

  async listStores(companyId: string, branchId?: string) {
    // ✅ baseURL already includes "/api"
    const res = await http.get<StoreVm[]>(`/companies/${companyId}/stores`, {
      params: branchId ? { branchId } : undefined,
    });
    return res.data;
  },

  async addStore(companyId: string, dto: CreateStoreDto) {
    const res = await http.post<{ id: string }>(
      `/companies/${companyId}/stores`,
      dto
    );
    return res.data.id;
  },

  async getSettings(companyId: string):Promise<CompanySettingsDto> {
    const res = await http.get(`/companies/${companyId}/settings`);
    return res.data;
  },

  async updateSettings(companyId: string, dto: CompanySettingsDto):Promise<CompanySettingsDto>  {
    const res= http.put(`/companies/${companyId}/settings`, dto);
    return (await res).data;
  },

  async createCompanyAdmin(companyId: string, dto: CreateCompanyAdminUserDto) {
    const res = await http.post<{ userId: string }>(
      `/companies/${companyId}/users/admin`,
      dto
    );
    return res.data.userId;
  },
  async updateCompany(companyId: string, body: any) {
  const res = await http.put(`/companies/${companyId}`, body);
  return res.data;
}

};
