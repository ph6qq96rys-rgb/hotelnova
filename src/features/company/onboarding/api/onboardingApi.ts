// src/modules/company/onboarding/api/onboardingApi.ts

import { http } from "../../../../api/http";
import type { EmployeeRegistrationLookupsDto } from "../../../hr/api/hrApi";

import { branchesApi } from "../../api/branchesApi";
import { companyApi } from "../../api/companyApi";
import { stockLocationsApi } from "../../api/stockLocationsApi";
import { storesApi } from "../../api/storesApi";

import type {
  BranchDto,
  CompanyDto,
  CompanySettingsDto,
  CreateBranchDto,
  CreateCompanyDto,
  CreateStockLocationDto,
  OnboardingReadinessDto,
  StockLocation,
  StoreDto,
  UpdateCompanyDto,
} from "../../types/company.types";

export interface CompanyUserDto {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  email: string;
  userName: string;
  phoneNumber?: string | null;
  companyId: string;
  defaultBranchId?: string | null;
  defaultStockLocationId?: string | null;
  roles: string[];
  isActive: boolean;
}

export interface UserBranchAssignmentInput {
  branchId: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UserStockLocationAssignmentInput {
  stockLocationId: string;
  isDefault?: boolean;
  isActive?: boolean;
  canReceive?: boolean;
  canIssue?: boolean;
  canTransfer?: boolean;
  canSell?: boolean;
  canAdjust?: boolean;
}

export interface CreateCompanyUserRequest {
  employeeId: string;
  email: string | null;
  userName: string;
  password: string;
  phoneNumber?: string | null;
  roles: string[];
  branches: UserBranchAssignmentInput[];
  stockLocations: UserStockLocationAssignmentInput[];
}

export interface UpdateCompanyUserRequest {
  email?: string | null;
  phoneNumber?: string | null;
}

export interface OnboardingSnapshotDto {
  company: CompanyDto | null;
  settings: CompanySettingsDto | null;
  branches: BranchDto[];
  activeBranch: BranchDto | null;
  stockLocations: StockLocation[];
  stores: StoreDto[];
  users: CompanyUserDto[];
  readiness: OnboardingReadinessDto;
}

export function cleanParams<T extends Record<string, unknown>>(
  params?: T,
): T | undefined {
  if (!params) return undefined;

  const cleaned = Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  ) as T;

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export function itemsOf<T>(payload: unknown): T[] {
  const data = payload as any;

  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.items)) return data.items as T[];
  if (Array.isArray(data?.data)) return data.data as T[];
  if (Array.isArray(data?.results)) return data.results as T[];
  if (Array.isArray(data?.value)) return data.value as T[];
  if (Array.isArray(data?.records)) return data.records as T[];
  if (Array.isArray(data?.rows)) return data.rows as T[];

  return [];
}

function firstOf<T>(payload: unknown): T | null {
  const items = itemsOf<T>(payload);
  return items.length > 0 ? items[0] : null;
}

function normalizeRoles(raw: any): string[] {
  if (Array.isArray(raw?.roles)) return raw.roles.map(String).filter(Boolean);

  if (typeof raw?.roles === "string") {
    return raw.roles
      .split(",")
      .map((x: string) => x.trim())
      .filter(Boolean);
  }

  return [raw?.role, raw?.roleName, raw?.primaryRole]
    .filter(Boolean)
    .map(String);
}

function normalizeUser(raw: any): CompanyUserDto {
  return {
    id: String(raw?.id ?? raw?.userId ?? ""),
    employeeId: raw?.employeeId ?? null,
    employeeName:
      raw?.employeeName ??
      raw?.employeeFullName ??
      raw?.fullName ??
      raw?.employee?.fullName ??
      null,
    employeeCode: raw?.employeeCode ?? raw?.employee?.employeeCode ?? null,
    email: String(raw?.email ?? ""),
    userName: String(raw?.userName ?? raw?.username ?? ""),
    phoneNumber: raw?.phoneNumber ?? null,
    companyId: String(raw?.companyId ?? ""),
    defaultBranchId: raw?.defaultBranchId ?? raw?.branchId ?? null,
    defaultStockLocationId:
      raw?.defaultStockLocationId ?? raw?.stockLocationId ?? null,
    roles: normalizeRoles(raw),
    isActive: raw?.isActive !== false,
  };
}

function normalizeUserList(raw: unknown): CompanyUserDto[] {
  return itemsOf<any>(raw)
    .map(normalizeUser)
    .filter((x) => x.id);
}

function idFromCreateResponse(raw: unknown): string {
  const data = raw as any;

  if (typeof data === "string") return data;
  if (data?.id) return String(data.id);
  if (data?.userId) return String(data.userId);
  if (data?.value) return String(data.value);

  return "";
}

function normalizeSnapshot(raw: unknown): OnboardingSnapshotDto {
  const data = raw as any;

  const branches = itemsOf<BranchDto>(data?.branches);
  const activeBranch =
    data?.activeBranch ?? data?.branch ?? firstOf<BranchDto>(branches);

  return {
    company: data?.company ?? null,
    settings: data?.settings ?? null,
    branches,
    activeBranch,
    stockLocations: itemsOf<StockLocation>(
      data?.stockLocations ?? data?.locations ?? data?.stockLocationItems,
    ),
    stores: itemsOf<StoreDto>(data?.stores ?? data?.storeItems),
    users: normalizeUserList(data?.users ?? data?.members ?? data?.branchUsers),
    readiness: data?.readiness ?? ({} as OnboardingReadinessDto),
  };
}

function normalizeEmployeeLookups(
  raw: unknown,
): EmployeeRegistrationLookupsDto {
  const data = raw as any;

  return {
    employees: itemsOf(data?.employees ?? data),
    branches: itemsOf(data?.branches),
    departments: itemsOf(data?.departments),
    positions: itemsOf(data?.positions),
    managers: itemsOf(data?.managers),
    statuses: itemsOf<string>(data?.statuses),
  } as EmployeeRegistrationLookupsDto;
}

function mapBranchAssignments(branchIds: string[]): UserBranchAssignmentInput[] {
  return branchIds
    .filter(Boolean)
    .map((branchId, index) => ({
      branchId,
      isDefault: index === 0,
      isActive: true,
    }));
}

function mapStockLocationAssignments(
  stockLocationIds: string[],
): UserStockLocationAssignmentInput[] {
  return stockLocationIds
    .filter(Boolean)
    .map((stockLocationId, index) => ({
      stockLocationId,
      isDefault: index === 0,
      isActive: true,
      canReceive: true,
      canIssue: true,
      canTransfer: true,
      canSell: true,
      canAdjust: true,
    }));
}

export const onboardingApi = {
  async getSnapshot(
    companyId: string,
    branchId?: string | null,
  ): Promise<OnboardingSnapshotDto> {
    const res = await http.get<unknown>(
      `/companies/${companyId}/onboarding/snapshot`,
      {
        params: cleanParams({ branchId }),
      },
    );

    return normalizeSnapshot(res.data);
  },

  async getReadiness(companyId: string): Promise<OnboardingReadinessDto> {
    const res = await http.get<OnboardingReadinessDto>(
      `/companies/${companyId}/readiness`,
    );

    return res.data;
  },

  async activateCompany(companyId: string): Promise<void> {
    await http.post(`/companies/${companyId}/activate`, {});
  },

  async complete(companyId: string, branchId?: string | null): Promise<void> {
    await this.activateCompany(companyId);

    if (!branchId) return;

    try {
      await http.post(
        `/companies/${companyId}/branches/${branchId}/onboarding/complete`,
        {},
      );
    } catch {
      // Legacy endpoint. Safe to ignore until backend endpoint exists.
    }
  },

  async listCompanies(): Promise<CompanyDto[]> {
    try {
      const res = await http.get<unknown>("/companies", {
        params: { page: 1, pageSize: 100 },
      });

      return itemsOf<CompanyDto>(res.data);
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

  async updateCompany(
    companyId: string,
    payload: Partial<UpdateCompanyDto>,
  ): Promise<CompanyDto> {
    return companyApi.updateCompany(companyId, payload as UpdateCompanyDto);
  },

  async getCompanySettings(
    companyId: string,
  ): Promise<CompanySettingsDto | null> {
    try {
      const res = await http.get<CompanySettingsDto>(
        `/companies/${companyId}/settings`,
      );

      return res.data;
    } catch {
      return null;
    }
  },

  async upsertCompanySettings(
    companyId: string,
    payload: CompanySettingsDto,
  ): Promise<CompanySettingsDto> {
    try {
      return await companyApi.updateSettings(companyId, payload);
    } catch {
      const res = await http.put<CompanySettingsDto>(
        `/companies/${companyId}/settings`,
        payload,
      );

      return res.data;
    }
  },

  async listBranches(companyId: string): Promise<BranchDto[]> {
    return branchesApi.list(companyId);
  },

  async getBranch(companyId: string, branchId: string): Promise<BranchDto> {
    return branchesApi.get(companyId, branchId);
  },

  async createBranch(
    companyId: string,
    payload: CreateBranchDto,
  ): Promise<BranchDto> {
    return branchesApi.create(companyId, payload);
  },

  async updateBranch(
    companyId: string,
    branchId: string,
    payload: Partial<CreateBranchDto>,
  ): Promise<BranchDto> {
    await branchesApi.update(companyId, branchId, payload);
    return branchesApi.get(companyId, branchId);
  },

  async listStockLocations(
    companyId: string,
    branchId: string,
  ): Promise<StockLocation[]> {
    return stockLocationsApi.listByBranch(companyId, branchId, {
      page: 1,
      pageSize: 500,
      activeOnly: false,
    });
  },

  async listCompanyStockLocations(
    companyId: string,
  ): Promise<StockLocation[]> {
    return stockLocationsApi.list(companyId, {
      page: 1,
      pageSize: 500,
      activeOnly: false,
    });
  },

  async createStockLocation(
    companyId: string,
    branchId: string,
    payload: CreateStockLocationDto,
  ): Promise<StockLocation> {
    return stockLocationsApi.create(companyId, payload, branchId);
  },

  async updateStockLocation(
    companyId: string,
    branchId: string,
    locationId: string,
    payload: Partial<CreateStockLocationDto> & {
      branchId?: string | null;
      isActive?: boolean | null;
      isDefault?: boolean | null;
      isDefaultReceiving?: boolean | null;
      isDefaultIssue?: boolean | null;
      canReceive?: boolean | null;
      canIssue?: boolean | null;
      canSell?: boolean | null;
      canProduce?: boolean | null;
    },
  ): Promise<StockLocation> {
    await stockLocationsApi.update(companyId, locationId, {
      ...payload,
      branchId: payload.branchId ?? branchId,
    });

    return stockLocationsApi.get(companyId, locationId);
  },

  async assignStockLocationToBranch(
    companyId: string,
    branchId: string,
    locationId: string,
  ): Promise<void> {
    await stockLocationsApi.assignToBranch(companyId, locationId, branchId);
  },

  async unassignStockLocationFromBranch(
    companyId: string,
    locationId: string,
  ): Promise<void> {
    await stockLocationsApi.assignToBranch(companyId, locationId, null);
  },

  async setDefaultReceiving(
    companyId: string,
    branchId: string,
    locationId: string,
  ): Promise<void> {
    await stockLocationsApi.setDefaultReceiving(companyId, locationId, branchId);
  },

  async setDefaultIssue(
    companyId: string,
    branchId: string,
    locationId: string,
  ): Promise<void> {
    await stockLocationsApi.setDefaultIssue(companyId, locationId, branchId);
  },

  async listStores(companyId: string, branchId: string): Promise<StoreDto[]> {
    try {
      const data = await storesApi.list(companyId, branchId);
      const items = itemsOf<StoreDto>(data);

      if (items.length > 0 || Array.isArray(data)) return items;
    } catch {
      // Fallback to canonical branch-scoped endpoint.
    }

    const res = await http.get<unknown>(
      `/companies/${companyId}/branches/${branchId}/stores`,
      {
        params: { page: 1, pageSize: 500, activeOnly: false },
      },
    );

    return itemsOf<StoreDto>(res.data);
  },

  async createStore(
    companyId: string,
    branchId: string,
    payload: {
      name: string;
      code?: string | null;
      locationType?: string | number;
      storeType?: string | number;
      addressLine?: string | null;
      isActive?: boolean;
    },
  ): Promise<StoreDto> {
    return storesApi.create(companyId, branchId, payload as any);
  },

  async updateStore(
    companyId: string,
    branchId: string,
    storeId: string,
    payload: {
      name?: string;
      code?: string | null;
      locationType?: string | number;
      storeType?: string | number;
      addressLine?: string | null;
      isActive?: boolean;
    },
  ): Promise<StoreDto> {
    const res = await http.put<StoreDto>(
      `/companies/${companyId}/branches/${branchId}/stores/${storeId}`,
      payload,
    );

    return res.data;
  },

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

  async listCompanyUsers(companyId: string): Promise<CompanyUserDto[]> {
    const res = await http.get<unknown>(`/companies/${companyId}/users`, {
      params: { page: 1, pageSize: 500 },
    });

    return normalizeUserList(res.data);
  },

  async listBranchUsers(
    companyId: string,
    branchId: string,
  ): Promise<CompanyUserDto[]> {
    const res = await http.get<unknown>(
      `/companies/${companyId}/branches/${branchId}/users`,
      {
        params: { page: 1, pageSize: 500 },
      },
    );

    return normalizeUserList(res.data);
  },

  async getUser(companyId: string, userId: string): Promise<CompanyUserDto> {
    const res = await http.get<unknown>(
      `/companies/${companyId}/users/${userId}`,
    );

    return normalizeUser(res.data);
  },

  async createUser(
    companyId: string,
    body: CreateCompanyUserRequest,
  ): Promise<{ id: string }> {
    const payload = {
      employeeId: body.employeeId,
      email: body.email,
      userName: body.userName,
      password: body.password,
      phoneNumber: body.phoneNumber ?? null,
      roles: body.roles ?? [],
      branches: body.branches ?? [],
      stockLocations: body.stockLocations ?? [],
    };

    const res = await http.post<unknown>(
      `/companies/${companyId}/users`,
      payload,
    );

    return { id: idFromCreateResponse(res.data) };
  },

  async createCompanyAdminUser(
    companyId: string,
    body: CreateCompanyUserRequest,
  ): Promise<{ id: string }> {
    const payload = {
      employeeId: body.employeeId,
      email: body.email,
      userName: body.userName,
      password: body.password,
      phoneNumber: body.phoneNumber ?? null,
      roles: body.roles?.length ? body.roles : ["CompanyAdmin"],
      branches: body.branches ?? [],
      stockLocations: body.stockLocations ?? [],
    };

    const res = await http.post<unknown>(
      `/companies/${companyId}/users/company-admin`,
      payload,
    );

    return { id: idFromCreateResponse(res.data) };
  },

  async updateUser(
    companyId: string,
    userId: string,
    payload: UpdateCompanyUserRequest,
  ): Promise<CompanyUserDto> {
    const res = await http.put<unknown>(
      `/companies/${companyId}/users/${userId}`,
      payload,
    );

    return normalizeUser(res.data);
  },

  async assignRoles(
    companyId: string,
    userId: string,
    roles: string[],
  ): Promise<void> {
    await http.put(`/companies/${companyId}/users/${userId}/roles`, roles);
  },

  async assignUserBranches(
    companyId: string,
    userId: string,
    branchIds: string[],
  ): Promise<void> {
    await http.put(`/companies/${companyId}/users/${userId}/branches`, {
      branches: mapBranchAssignments(branchIds),
    });
  },

  async assignUserStockLocations(
    companyId: string,
    userId: string,
    stockLocationIds: string[],
  ): Promise<void> {
    await http.put(
      `/companies/${companyId}/users/${userId}/stock-locations`,
      {
        stockLocations: mapStockLocationAssignments(stockLocationIds),
      },
    );
  },

  async setUserActiveStatus(
    companyId: string,
    userId: string,
    isActive: boolean,
  ): Promise<void> {
    await http.patch(
      `/companies/${companyId}/users/${userId}/active-status`,
      {
        isActive,
      },
    );
  },

  async resetUserPassword(
    companyId: string,
    userId: string,
    newPassword: string,
  ): Promise<void> {
    await http.post(`/companies/${companyId}/users/${userId}/reset-password`, {
      newPassword,
    });
  },

  async listAvailableEmployees(
    companyId: string,
    branchId?: string | null,
    search?: string,
  ): Promise<EmployeeRegistrationLookupsDto> {
    const res = await http.get<unknown>(
      `/companies/${companyId}/hr/employees/available-for-user`,
      {
        params: cleanParams({
          branchId,
          q: search,
          page: 1,
          pageSize: 500,
        }),
      },
    );

    return normalizeEmployeeLookups(res.data);
  },
};