// src/modules/company/onboarding/api/onboardingApi.ts
//
// Single API surface for the onboarding wizard.
// Every method delegates to a domain-specific API module so that URL
// construction is never duplicated here. The only exception is operations
// that span multiple modules (e.g. upsertCompanySettings) or that hit
// endpoints not yet covered by a domain module.

import { http } from "../../../../api/http";
import { branchesApi } from "../../api/branchesApi";
import { branchSetupApi } from "../../api/branchSetupApi";
import { companyApi } from "../../api/companyApi";
import { stockLocationsApi } from "../../api/stockLocationsApi";
import { storesApi } from "../../api/storesApi";
import type {
  BranchRole,
  BranchUserDto,
  CompanyDto,
  CompanySettingsDto,
  CreateBranchDto,
  CreateCompanyDto,
  StockLocation,
  StoreDto,
  UpdateCompanyDto,
} from "../../types/company.types";

export const onboardingApi = {

  // ── Company ───────────────────────────────────────────────────────────────

  /** Load all companies — used by the Company step to populate the selector list. */
 async listCompanies(): Promise<CompanyDto[]> {
  try {
    const res = await http.get<unknown>("/companies", {
      params: { page: 1, pageSize: 100 },  // ← reduce from 200
    });
      const d = res.data as any;
      if (Array.isArray(d))          return d as CompanyDto[];
      if (Array.isArray(d?.items))   return d.items  as CompanyDto[];
      if (Array.isArray(d?.data))    return d.data   as CompanyDto[];
      if (Array.isArray(d?.results)) return d.results as CompanyDto[];
      return [];
    } catch {
      return [];
    }
  },

  async createCompany(payload: CreateCompanyDto): Promise<CompanyDto> {
    const res = await http.post<CompanyDto>("/companies", payload);
    return res.data;
  },

  async getCompany(companyId: string): Promise<CompanyDto> {
    return companyApi.getCompany(companyId);
  },

  async updateCompany(companyId: string, payload: Partial<UpdateCompanyDto>): Promise<CompanyDto> {
    return companyApi.updateCompany(companyId, payload as UpdateCompanyDto);
  },

  /** Try PUT first; fall back to POST for backends that haven't added PATCH yet. */
  async upsertCompanySettings(companyId: string, payload: CompanySettingsDto): Promise<CompanySettingsDto> {
    try {
      return await companyApi.updateSettings(companyId, payload);
    } catch {
      const res = await http.post<CompanySettingsDto>(`/companies/${companyId}/settings`, payload);
      return res.data;
    }
  },

  // ── Branches ──────────────────────────────────────────────────────────────
  // All branches for a company are loaded up-front so the Branch step can
  // display a selectable list rather than requiring the user to create one.

  async listBranches(companyId: string) {
    return branchesApi.list(companyId);
  },

  async getBranch(companyId: string, branchId: string) {
    return branchesApi.get(companyId, branchId);
  },

  async createBranch(companyId: string, payload: CreateBranchDto) {
    return branchesApi.create(companyId, payload);
  },

  async updateBranch(companyId: string, branchId: string, payload: Partial<CreateBranchDto>) {
    return branchesApi.update(companyId, branchId, payload);
  },

  // ── Stock locations ───────────────────────────────────────────────────────
  // Listed per-branch so the Stock Locations step can render existing rows
  // as selectable / editable cards before showing the add form.

  async listStockLocations(companyId: string, branchId: string): Promise<StockLocation[]> {
    // branchSetupApi and stockLocationsApi hit the same endpoint; use
    // stockLocationsApi consistently — it has the full CRUD surface.
    const data = await stockLocationsApi.list(companyId, branchId);
    return Array.isArray(data) ? data : [];
  },

  async createStockLocation(
    companyId: string,
    branchId: string,
    payload: { name: string; code: string; locationType: string | number },
  ): Promise<StockLocation> {
    return stockLocationsApi.create(companyId, branchId, payload as any);
  },

  async updateStockLocation(
    companyId: string,
    branchId: string,
    locationId: string,
    payload: { name?: string; code?: string; locationType?: string },
  ): Promise<StockLocation> {
    const res = await http.put<StockLocation>(
      `/companies/${companyId}/branches/${branchId}/stock-locations/${locationId}`,
      payload,
    );
    return res.data;
  },

  async setDefaultReceiving(companyId: string, branchId: string, locationId: string): Promise<void> {
    return stockLocationsApi.setDefaultReceiving(companyId, branchId, locationId);
  },

  async setDefaultIssue(companyId: string, branchId: string, locationId: string): Promise<void> {
    return stockLocationsApi.setDefaultIssue(companyId, branchId, locationId);
  },

  // ── Stores ────────────────────────────────────────────────────────────────
  // Listed per-branch so the Stores step can render existing rows as
  // selectable / editable cards with issue-location mapping inline.

  async listStores(companyId: string, branchId: string): Promise<StoreDto[]> {
    const data = await storesApi.list(companyId, branchId);
    return Array.isArray(data) ? data : [];
  },

  async createStore(
    companyId: string,
    branchId: string,
    payload: { name: string; code?: string | null; locationType?: string | number },
  ): Promise<StoreDto> {
    return storesApi.create(companyId, branchId, payload as any);
  },

  async updateStore(
    companyId: string,
    branchId: string,
    storeId: string,
    payload: { name?: string; code?: string | null; locationType?: string },
  ): Promise<StoreDto> {
    const res = await http.put<StoreDto>(
      `/companies/${companyId}/branches/${branchId}/stores/${storeId}`,
      payload,
    );
    return res.data;
  },

  /**
   * Maps a store's issue stock location.
   * PUT /stores/{storeId}/issue-location is the canonical endpoint.
   * FIX: the previous fallback called setStoreIssueLocation without storeId,
   * so the backend had no way to know which store to update.
   */
  async mapStoreIssueLocation(
    companyId: string,
    branchId: string,
    storeId: string,
    stockLocationId: string,
  ): Promise<void> {
    await http.put(
      `/companies/${companyId}/branches/${branchId}/stores/${storeId}/issue-location`,
      { stockLocationId },
    );
  },

  // ── Branch users ──────────────────────────────────────────────────────────
  // Listed so the Users step can render existing members as configurable rows.

  async listBranchUsers(companyId: string, branchId: string): Promise<BranchUserDto[]> {
    try {
      const res = await http.get<BranchUserDto[]>(
        `/companies/${companyId}/branches/${branchId}/users`,
      );
      return res.data ?? [];
    } catch {
      // Fallback: company-level users endpoint filtered client-side.
      // Remove once the branch-scoped endpoint is available on the backend.
      const res = await http.get<BranchUserDto[]>(`/companies/${companyId}/users`, {
        params: { branchId },
      });
      return (res.data ?? []).filter((u: any) => u.branchId === branchId);
    }
  },

  async createUser(
    companyId: string,
    body: {
      userName: string;
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      branchId: string | null;
      storeId: string | null;
    },
  ): Promise<{ id: string }> {
    const res = await http.post<{ id: string }>(`/companies/${companyId}/users/admin`, body);
    return res.data;
  },

  async updateUser(
    companyId: string,
    userId: string,
    payload: { firstName?: string; lastName?: string; email?: string },
  ): Promise<{ id: string }> {
    const res = await http.put<{ id: string }>(`/companies/${companyId}/users/${userId}`, payload);
    return res.data;
  },

  async assignBranchUser(
    companyId: string,
    branchId: string,
    userId: string,
    role: BranchRole,
  ): Promise<void> {
    await http.post(`/companies/${companyId}/branches/${branchId}/users`, { userId, role });
  },

  async updateBranchUserRole(
    companyId: string,
    branchId: string,
    userId: string,
    role: BranchRole,
  ): Promise<void> {
    await http.put(
      `/companies/${companyId}/branches/${branchId}/users/${userId}/role`,
      { role },
    );
  },

  async removeBranchUser(companyId: string, branchId: string, userId: string): Promise<void> {
    await http.delete(`/companies/${companyId}/branches/${branchId}/users/${userId}`);
  },

  // ── Finalise ──────────────────────────────────────────────────────────────

  /** Optional endpoint — backend can implement later to mark onboarding done. */
  async complete(companyId: string, branchId: string): Promise<void> {
    try {
      await http.post(`/companies/${companyId}/branches/${branchId}/onboarding/complete`, {});
    } catch {
      // Silently ignored until the backend adds this endpoint.
    }
  },
};