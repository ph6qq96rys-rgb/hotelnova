// src/modules/company/onboarding/api/onboardingApi.ts

import { http } from "../../../../api/http";
import type { EmployeeRegistrationLookupsDto } from "../../../hr/api/hrApi";

import { branchesApi } from "../../api/branchesApi";
import { companyApi } from "../../api/companyApi";
import {
  stockLocationsApi,
  type BranchInventoryConfigurationDto,
  type SavePosInventoryMappingsDto,
  type UpsertBranchInventoryConfigurationDto,
} from "../../api/stockLocationsApi";
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
  branchId?: string;
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
  branches: Array<string | UserBranchAssignmentInput>;
  stockLocations: Array<string | UserStockLocationAssignmentInput>;
}

export interface UpdateCompanyUserRequest {
  email?: string | null;
  phoneNumber?: string | null;
  isActive?: boolean;
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
  if (Array.isArray(data?.result)) return data.result as T[];
  if (Array.isArray(data?.value)) return data.value as T[];
  if (Array.isArray(data?.records)) return data.records as T[];
  if (Array.isArray(data?.rows)) return data.rows as T[];
  if (Array.isArray(data?.stores)) return data.stores as T[];
  if (Array.isArray(data?.users)) return data.users as T[];
  if (Array.isArray(data?.stockLocations)) return data.stockLocations as T[];

  return [];
}

function firstOf<T>(payload: unknown): T | null {
  const items = itemsOf<T>(payload);
  return items.length > 0 ? items[0] : null;
}

function cleanId(value: unknown): string {
  return String(value ?? "").trim();
}

function idOf(raw: any): string {
  return cleanId(
    raw?.id ??
      raw?.Id ??
      raw?.userId ??
      raw?.storeId ??
      raw?.locationId ??
      raw?.stockLocationId,
  );
}

function branchIdOf(raw: any): string {
  return cleanId(
    raw?.branchId ??
      raw?.defaultBranchId ??
      raw?.branch?.id ??
      raw?.BranchId,
  );
}

function activeOf(raw: any): boolean {
  return raw?.isActive !== false && raw?.active !== false;
}

function belongsToBranch(raw: any, branchId: string): boolean {
  const rowBranchId = branchIdOf(raw);
  if (!rowBranchId) return true;
  return rowBranchId.toLowerCase() === branchId.toLowerCase();
}

function normalizeRoles(raw: any): string[] {
  if (Array.isArray(raw?.roles)) return raw.roles.map(String).filter(Boolean);
  if (Array.isArray(raw?.roleNames)) return raw.roleNames.map(String).filter(Boolean);

  if (typeof raw?.roles === "string") {
    return raw.roles
      .split(",")
      .map((x: string) => x.trim())
      .filter(Boolean);
  }

  return [raw?.role, raw?.roleName, raw?.primaryRole].filter(Boolean).map(String);
}

function normalizeUser(raw: any): CompanyUserDto {
  return {
    id: cleanId(raw?.id ?? raw?.userId),
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
    companyId: cleanId(raw?.companyId),
    defaultBranchId: raw?.defaultBranchId ?? raw?.branchId ?? null,
    defaultStockLocationId:
      raw?.defaultStockLocationId ??
      raw?.stockLocationId ??
      raw?.issueStockLocationId ??
      null,
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
  if (data?.Id) return String(data.Id);
  if (data?.userId) return String(data.userId);
  if (data?.value) return String(data.value);

  return "";
}

function normalizeSnapshot(raw: unknown): OnboardingSnapshotDto {
  const data = raw as any;

  const branches = itemsOf<BranchDto>(data?.branches);
  const activeBranch = data?.activeBranch ?? data?.branch ?? firstOf<BranchDto>(branches);

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

function normalizeEmployeeLookups(raw: unknown): EmployeeRegistrationLookupsDto {
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

function normalizeBranchAssignments(
  branches: Array<string | UserBranchAssignmentInput>,
): UserBranchAssignmentInput[] {
  return branches
    .filter(Boolean)
    .map((value, index) => {
      if (typeof value === "string") {
        return {
          branchId: value,
          isDefault: index === 0,
          isActive: true,
        };
      }

      return {
        branchId: cleanId(value.branchId),
        isDefault: value.isDefault ?? index === 0,
        isActive: value.isActive ?? true,
      };
    })
    .filter((x) => x.branchId);
}

function normalizeStockLocationAssignments(
  locations: Array<string | UserStockLocationAssignmentInput>,
): UserStockLocationAssignmentInput[] {
  return locations
    .filter(Boolean)
    .map((value, index) => {
      if (typeof value === "string") {
        return {
          stockLocationId: value,
          isDefault: index === 0,
          isActive: true,
          canReceive: true,
          canIssue: true,
          canTransfer: true,
          canSell: true,
          canAdjust: false,
        };
      }

      return {
        stockLocationId: cleanId(value.stockLocationId),
        isDefault: value.isDefault ?? index === 0,
        isActive: value.isActive ?? true,
        canReceive: value.canReceive ?? false,
        canIssue: value.canIssue ?? false,
        canTransfer: value.canTransfer ?? false,
        canSell: value.canSell ?? false,
        canAdjust: value.canAdjust ?? false,
      };
    })
    .filter((x) => x.stockLocationId);
}

function normalizeCreateUserPayload(body: CreateCompanyUserRequest) {
  return {
    employeeId: body.employeeId,
    email: body.email,
    userName: body.userName,
    password: body.password,
    phoneNumber: body.phoneNumber ?? null,
    roles: body.roles ?? [],
    branches: normalizeBranchAssignments(body.branches ?? []),
    stockLocations: normalizeStockLocationAssignments(body.stockLocations ?? []),
  };
}

function filterStoresForBranch(stores: StoreDto[], branchId: string): StoreDto[] {
  return stores
    .filter((store: any) => activeOf(store) && belongsToBranch(store, branchId))
    .sort((a: any, b: any) =>
      String(a?.name ?? a?.storeName ?? "").localeCompare(
        String(b?.name ?? b?.storeName ?? ""),
      ),
    );
}

export const onboardingApi = {
  async getSnapshot(
    companyId: string,
    branchId?: string | null,
  ): Promise<OnboardingSnapshotDto> {
    const res = await http.get<unknown>(`/companies/${companyId}/onboarding/snapshot`, {
      params: cleanParams({ branchId }),
    });

    return normalizeSnapshot(res.data);
  },

  async getReadiness(companyId: string): Promise<OnboardingReadinessDto> {
    const res = await http.get<OnboardingReadinessDto>(`/companies/${companyId}/readiness`);
    return res.data;
  },

  async activateCompany(companyId: string): Promise<void> {
    await http.post(`/companies/${companyId}/activate`, {});
  },

  async complete(companyId: string, branchId?: string | null): Promise<void> {
    if (branchId) {
      try {
        await http.post(`/companies/${companyId}/branches/${branchId}/onboarding/complete`, {});
      } catch (err) {
        const status = (err as any)?.response?.status ?? (err as any)?.status;
        if (status !== 404) throw err;
      }
    }

    await this.activateCompany(companyId);
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

  async getCompanySettings(companyId: string): Promise<CompanySettingsDto | null> {
    try {
      const res = await http.get<CompanySettingsDto>(`/companies/${companyId}/settings`);
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

  async createBranch(companyId: string, payload: CreateBranchDto): Promise<BranchDto> {
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

  async listStockLocations(companyId: string, branchId: string): Promise<StockLocation[]> {
    return stockLocationsApi.branchAssignments.list(companyId, branchId, {
      page: 1,
      pageSize: 500,
      activeOnly: false,
    });
  },

  async listCompanyStockLocations(companyId: string): Promise<StockLocation[]> {
    return stockLocationsApi.company.list(companyId, {
      page: 1,
      pageSize: 500,
      activeOnly: false,
    });
  },

  async createStockLocation(
    companyId: string,
    payload: CreateStockLocationDto,
  ): Promise<StockLocation> {
    return stockLocationsApi.company.create(companyId, payload);
  },

  async updateStockLocation(
    companyId: string,
    locationId: string,
    payload: Partial<CreateStockLocationDto> & {
      isActive?: boolean | null;
    },
  ): Promise<StockLocation> {
    await stockLocationsApi.company.update(companyId, locationId, payload);
    return stockLocationsApi.company.get(companyId, locationId);
  },

  async assignStockLocationToBranch(
    companyId: string,
    branchId: string,
    locationId: string,
  ): Promise<void> {
    await stockLocationsApi.branchAssignments.assignOne(companyId, branchId, locationId);
  },

  async unassignStockLocationFromBranch(
    companyId: string,
    branchId: string,
    locationId: string,
  ): Promise<void> {
    await stockLocationsApi.branchAssignments.unassign(companyId, branchId, locationId);
  },

  async assignManyStockLocationsToBranch(
    companyId: string,
    branchId: string,
    stockLocationIds: string[],
  ): Promise<void> {
    await stockLocationsApi.branchAssignments.assignMany(companyId, branchId, {
      stockLocationIds,
    });
  },

  async getBranchInventoryConfiguration(
    companyId: string,
    branchId: string,
  ): Promise<BranchInventoryConfigurationDto> {
    return stockLocationsApi.configuration.get(companyId, branchId);
  },

  async saveBranchInventoryConfiguration(
    companyId: string,
    branchId: string,
    payload: UpsertBranchInventoryConfigurationDto,
  ): Promise<void> {
    await stockLocationsApi.configuration.save(companyId, branchId, payload);
  },

  async listPosInventoryMappings(companyId: string, branchId: string) {
    return stockLocationsApi.pos.listMappings(companyId, branchId);
  },

  async savePosInventoryMappings(
    companyId: string,
    branchId: string,
    payload: SavePosInventoryMappingsDto,
  ): Promise<void> {
    await stockLocationsApi.pos.saveMappings(companyId, branchId, payload);
  },

  async listStores(companyId: string, branchId: string): Promise<StoreDto[]> {
    if (!companyId || !branchId) return [];

    const res = await http.get<unknown>(
      `/companies/${companyId}/branches/${branchId}/stores`,
      {
        params: { page: 1, pageSize: 500, activeOnly: false },
      },
    );

    return filterStoresForBranch(itemsOf<StoreDto>(res.data), branchId);
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
    defaultIssueBranchStockLocationId?: string | null;
    branchStockLocationId?: string | null;
  },
): Promise<StoreDto> {
  return storesApi.create(companyId, branchId, {
    ...payload,
    branchId,
  } as any);
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
    defaultIssueBranchStockLocationId?: string | null;
    branchStockLocationId?: string | null;
  },
): Promise<StoreDto> {
  return storesApi.update(companyId, branchId, storeId, {
    ...payload,
    branchId,
  } as any);
},

async mapStoreIssueLocation(
  companyId: string,
  branchId: string,
  storeId: string,
  branchStockLocationId: string,
): Promise<void> {
  await http.put(
    `/companies/${companyId}/branches/${branchId}/stores/${storeId}/issue-location`,
    {
      stockLocationId: branchStockLocationId,
    },
  );
},

  async listCompanyUsers(companyId: string): Promise<CompanyUserDto[]> {
    const res = await http.get<unknown>(`/companies/${companyId}/users`, {
      params: { page: 1, pageSize: 500 },
    });

    return normalizeUserList(res.data);
  },

  async listBranchUsers(companyId: string, branchId: string): Promise<CompanyUserDto[]> {
    const res = await http.get<unknown>(
      `/companies/${companyId}/branches/${branchId}/users`,
      {
        params: { page: 1, pageSize: 500 },
      },
    );

    return normalizeUserList(res.data);
  },

  async getUser(companyId: string, userId: string): Promise<CompanyUserDto> {
    const res = await http.get<unknown>(`/companies/${companyId}/users/${userId}`);
    return normalizeUser(res.data);
  },

  async createUser(companyId: string, body: CreateCompanyUserRequest): Promise<{ id: string }> {
    const res = await http.post<unknown>(
      `/companies/${companyId}/users`,
      normalizeCreateUserPayload(body),
    );

    return { id: idFromCreateResponse(res.data) };
  },

  async createCompanyAdminUser(
    companyId: string,
    body: CreateCompanyUserRequest,
  ): Promise<{ id: string }> {
    const payload = normalizeCreateUserPayload({
      ...body,
      roles: body.roles?.length ? body.roles : ["CompanyAdmin"],
    });

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
    const res = await http.put<unknown>(`/companies/${companyId}/users/${userId}`, payload);
    return normalizeUser(res.data);
  },

  async assignRoles(companyId: string, userId: string, roles: string[]): Promise<void> {
    await http.put(`/companies/${companyId}/users/${userId}/roles`, roles);
  },

  async assignUserBranches(
    companyId: string,
    userId: string,
    branches: Array<string | UserBranchAssignmentInput>,
  ): Promise<void> {
    await http.put(`/companies/${companyId}/users/${userId}/branches`, {
      branches: normalizeBranchAssignments(branches),
    });
  },

  async assignUserStockLocations(
    companyId: string,
    userId: string,
    locations: Array<string | UserStockLocationAssignmentInput>,
  ): Promise<void> {
    await http.put(`/companies/${companyId}/users/${userId}/stock-locations`, {
      stockLocations: normalizeStockLocationAssignments(locations),
    });
  },

  async setUserActiveStatus(
    companyId: string,
    userId: string,
    isActive: boolean,
  ): Promise<void> {
    await http.patch(`/companies/${companyId}/users/${userId}/active-status`, {
      isActive,
    });
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

  async listRoles(companyId: string): Promise<any[]> {
    const res = await http.get<any[]>(`/companies/${companyId}/security/roles`);
    return Array.isArray(res.data) ? res.data : [];
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
