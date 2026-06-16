// src/modules/security/api/securityApi.ts

import { http } from "../../../api/http";

import type {
  RoleDto,
  RoleDetailDto,
  PermissionCatalogItem,
  UserLiteDto,
  CreateRoleRequest,
  UpdateRoleRequest,
  AddAssignmentRequest,
  RemoveAssignmentRequest,
  SetPermissionsRequest,
  SetRolesRequest,
} from "../types/security.types";

import type {
  UserDto,
  CreateUserRequest,
  UpdateUserRequest,
  ResetPasswordRequest,
} from "../../../api/identity/identityTypes";

export type {
  RoleDto,
  RoleDetailDto,
  PermissionCatalogItem,
  UserLiteDto,
  UserDto,
  CreateUserRequest,
  UpdateUserRequest,
  ResetPasswordRequest,
};

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type UserQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
  branchId?: string | null;
  isActive?: boolean | null;
};

export type EmployeeOption = {
  id: string;
  employeeCode?: string | null;
  fullName: string;
  email?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  departmentName?: string | null;
  positionName?: string | null;
};

export type StockLocationOption = {
  id: string;
  name: string;
  code?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  locationType?: string | null;
  isActive?: boolean;
};

export type EmployeeSearchQuery = {
  branchId?: string | null;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type StockLocationQuery = {
  branchId?: string | null;
  isActive?: boolean | null;
  page?: number;
  pageSize?: number;
};

export type CreateSecurityUserRequest = CreateUserRequest & {
  employeeId?: string | null;
  branchId?: string | null;
  branchIds?: string[];
  stockLocationId?: string | null;
  allowedStockLocationIds?: string[];
  roles?: string[];
  roleNames?: string[];
  isActive?: boolean;
  canSubmitWarehouseRequests?: boolean;
  canApproveWarehouseRequests?: boolean;
  canIssueStock?: boolean;
};

export type UpdateSecurityUserRequest = UpdateUserRequest &
  Partial<CreateSecurityUserRequest>;

const securityBase = (companyId: string) => `/companies/${companyId}/security`;
const usersBase = (companyId: string) => `/companies/${companyId}/users`;
const hrEmployeesBase = (companyId: string) =>
  `/companies/${companyId}/hr/employees`;

const unwrap = <T>(res: { data: T }): T => res.data;

const emptyPaged = <T>(page = 1, pageSize = 10): PagedResult<T> => ({
  items: [],
  total: 0,
  page,
  pageSize,
});

function clampPage(page?: number): number {
  return Math.max(1, page ?? 1);
}

function clampPageSize(pageSize?: number, fallback = 30): number {
  return Math.min(100, Math.max(1, pageSize ?? fallback));
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }

  const query = sp.toString();
  return query ? `?${query}` : "";
}

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  const obj = value as any;

  if (Array.isArray(obj?.items)) return obj.items as T[];
  if (Array.isArray(obj?.data)) return obj.data as T[];
  if (Array.isArray(obj?.results)) return obj.results as T[];

  return [];
}

function normalizePaged<T>(
  value: unknown,
  page: number,
  pageSize: number
): PagedResult<T> {
  if (Array.isArray(value)) {
    return {
      items: value as T[],
      total: value.length,
      page,
      pageSize,
    };
  }

  const obj = (value ?? {}) as any;
  const items = normalizeArray<T>(obj);

  return {
    items,
    total: Number(obj.total ?? obj.totalCount ?? obj.count ?? items.length),
    page: Number(obj.page ?? obj.pageNumber ?? page),
    pageSize: Number(obj.pageSize ?? obj.take ?? pageSize),
  };
}

function normalizeRoleNames(value?: string[] | null): string[] {
  return [
    ...new Set(
      (value ?? [])
        .filter(Boolean)
        .map((role) => role.trim())
        .filter(Boolean)
    ),
  ];
}

export const securityApi = {
  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------

  listRoles: async (
    companyId: string,
    signal?: AbortSignal
  ): Promise<RoleDto[]> => {
    const res = await http.get<RoleDto[]>(`${securityBase(companyId)}/roles`, {
      signal,
    });

    return normalizeArray<RoleDto>(res.data);
  },

  getRole: (
    companyId: string,
    roleId: string,
    signal?: AbortSignal
  ): Promise<RoleDetailDto> =>
    http
      .get<RoleDetailDto>(
        `${securityBase(companyId)}/roles/${encodeURIComponent(roleId)}`,
        { signal }
      )
      .then(unwrap),

  createRole: (
    companyId: string,
    payload: CreateRoleRequest,
    signal?: AbortSignal
  ): Promise<string> =>
    http
      .post<string>(
        `${securityBase(companyId)}/roles`,
        { ...payload, companyId },
        { signal }
      )
      .then(unwrap),

  updateRole: (
    companyId: string,
    roleId: string,
    payload: UpdateRoleRequest,
    signal?: AbortSignal
  ): Promise<void> =>
    http
      .put<void>(
        `${securityBase(companyId)}/roles/${encodeURIComponent(roleId)}`,
        { ...payload, companyId },
        { signal }
      )
      .then(() => undefined),

  deleteRole: (
    companyId: string,
    roleId: string,
    signal?: AbortSignal
  ): Promise<void> =>
    http
      .delete<void>(
        `${securityBase(companyId)}/roles/${encodeURIComponent(roleId)}`,
        { signal }
      )
      .then(() => undefined),

  getRolePermissions: async (
    companyId: string,
    roleId: string,
    signal?: AbortSignal
  ): Promise<PermissionCatalogItem[]> => {
    const res = await http.get<PermissionCatalogItem[]>(
      `${securityBase(companyId)}/roles/${encodeURIComponent(
        roleId
      )}/permissions`,
      { signal }
    );

    return normalizeArray<PermissionCatalogItem>(res.data);
  },

  setRolePermissions: (
    companyId: string,
    roleId: string,
    permissionKeys: string[],
    signal?: AbortSignal
  ): Promise<void> =>
    http
      .put<void>(
        `${securityBase(companyId)}/roles/${encodeURIComponent(
          roleId
        )}/permissions`,
        { permissionKeys },
        { signal }
      )
      .then(() => undefined),

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  listPermissions: async (
    companyId: string,
    signal?: AbortSignal
  ): Promise<PermissionCatalogItem[]> => {
    const res = await http.get<PermissionCatalogItem[]>(
      `${securityBase(companyId)}/permissions`,
      { signal }
    );

    return normalizeArray<PermissionCatalogItem>(res.data);
  },

  // ---------------------------------------------------------------------------
  // Company Users
  // Backend route:
  // /api/companies/{companyId}/users
  // ---------------------------------------------------------------------------

  listUsersPage: async (
    companyId: string,
    query: UserQuery = {},
    signal?: AbortSignal
  ): Promise<PagedResult<UserDto>> => {
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize, 20);

    if (!companyId) return emptyPaged<UserDto>(page, pageSize);

    const res = await http.get<UserDto[] | PagedResult<UserDto>>(
      `${usersBase(companyId)}${qs({
        q: query.q,
        page,
        pageSize,
        branchId: query.branchId,
        isActive: query.isActive,
      })}`,
      { signal }
    );

    return normalizePaged<UserDto>(res.data, page, pageSize);
  },

  listUsers: async (
    companyId: string,
    signal?: AbortSignal
  ): Promise<UserDto[]> => {
    const result = await securityApi.listUsersPage(
      companyId,
      { page: 1, pageSize: 100 },
      signal
    );

    return result.items;
  },

  getUserById: (
    companyId: string,
    userId: string,
    signal?: AbortSignal
  ): Promise<UserDto> =>
    http
      .get<UserDto>(`${usersBase(companyId)}/${encodeURIComponent(userId)}`, {
        signal,
      })
      .then(unwrap),

  createUser: (
    companyId: string,
    body: CreateSecurityUserRequest
  ): Promise<UserDto> =>
    http.post<UserDto>(usersBase(companyId), body).then(unwrap),

  updateUser: (
    companyId: string,
    userId: string,
    body: UpdateSecurityUserRequest
  ): Promise<UserDto> =>
    http
      .put<UserDto>(`${usersBase(companyId)}/${encodeURIComponent(userId)}`, body)
      .then(unwrap),

  setUserActive: (
    companyId: string,
    userId: string,
    isActive: boolean
  ): Promise<void> =>
    http
      .patch<void>(
        `${usersBase(companyId)}/${encodeURIComponent(userId)}/active-status`,
        { isActive }
      )
      .then(() => undefined),

  deactivateUser: (companyId: string, userId: string): Promise<void> =>
    securityApi.setUserActive(companyId, userId, false),

  resetUserPassword: (
    companyId: string,
    userId: string,
    body: ResetPasswordRequest | string
  ): Promise<void> => {
    const payload =
      typeof body === "string"
        ? { newPassword: body }
        : body;

    return http
      .post<void>(
        `${usersBase(companyId)}/${encodeURIComponent(userId)}/reset-password`,
        payload
      )
      .then(() => undefined);
  },

  setUserRoles: (
    companyId: string,
    payload: SetRolesRequest
  ): Promise<void> =>
    http
      .put<void>(
        `${usersBase(companyId)}/${encodeURIComponent(payload.userId)}/roles`,
        normalizeRoleNames(payload.roleNames)
      )
      .then(() => undefined),

  assignUserBranches: (
    companyId: string,
    userId: string,
    body: {
      branchIds: string[];
      defaultBranchId?: string | null;
    }
  ): Promise<void> =>
    http
      .put<void>(
        `${usersBase(companyId)}/${encodeURIComponent(userId)}/branches`,
        body
      )
      .then(() => undefined),

  assignUserStockLocations: (
    companyId: string,
    userId: string,
    body: {
      stockLocationIds: string[];
      defaultStockLocationId?: string | null;
      canReceive?: boolean;
      canIssue?: boolean;
      canTransfer?: boolean;
      canSell?: boolean;
      canAdjust?: boolean;
    }
  ): Promise<void> =>
    http
      .put<void>(
        `${usersBase(companyId)}/${encodeURIComponent(
          userId
        )}/stock-locations`,
        body
      )
      .then(() => undefined),

  // Kept for backward compatibility. Your current CompanyUsersController
  // does not expose /employee. Prefer employee linking through updateUser,
  // branches, and stock-location assignment flows.
  linkUserEmployee: (
    companyId: string,
    userId: string,
    employeeId: string | null
  ): Promise<UserDto> =>
    http
      .put<UserDto>(
        `${usersBase(companyId)}/${encodeURIComponent(userId)}`,
        { employeeId }
      )
      .then(unwrap),

  // Kept only if your backend still has this endpoint elsewhere.
  getUserPermissions: async (
    companyId: string,
    userId: string
  ): Promise<string[]> => {
    const res = await http.get<string[]>(
      `${securityBase(companyId)}/users/${encodeURIComponent(
        userId
      )}/permissions`
    );

    return normalizeArray<string>(res.data);
  },

  setUserPermissions: (
    companyId: string,
    payload: SetPermissionsRequest
  ): Promise<void> =>
    http
      .put<void>(
        `${securityBase(companyId)}/users/${encodeURIComponent(
          payload.userId
        )}/permissions`,
        { permissionKeys: payload.permissionKeys }
      )
      .then(() => undefined),

  // ---------------------------------------------------------------------------
  // Role membership / assignments under SecurityController
  // ---------------------------------------------------------------------------

  searchUsers: (
    companyId: string,
    q: string,
    signal?: AbortSignal
  ): Promise<UserLiteDto[]> =>
    http
      .get<UserLiteDto[]>(
        `${securityBase(companyId)}/users/search${qs({ q: q.trim() })}`,
        { signal }
      )
      .then((res) => normalizeArray<UserLiteDto>(res.data)),

  addUserToRole: (
    companyId: string,
    roleId: string,
    userId: string,
    branchId?: string | null,
    signal?: AbortSignal
  ): Promise<void> =>
    http
      .post<void>(
        `${securityBase(companyId)}/roles/${encodeURIComponent(roleId)}/users`,
        { userId, branchId: branchId ?? null },
        { signal }
      )
      .then(() => undefined),

  removeUserFromRole: (
    companyId: string,
    roleId: string,
    userId: string,
    signal?: AbortSignal
  ): Promise<void> =>
    http
      .delete<void>(
        `${securityBase(companyId)}/roles/${encodeURIComponent(
          roleId
        )}/users/${encodeURIComponent(userId)}`,
        { signal }
      )
      .then(() => undefined),

  addUserRoleAssignment: (
    companyId: string,
    body: AddAssignmentRequest
  ): Promise<void> =>
    securityApi.addUserToRole(companyId, body.roleId, body.userId, body.branchId),

  removeUserRoleAssignment: (
    companyId: string,
    body: RemoveAssignmentRequest
  ): Promise<void> =>
    http
      .delete<void>(
        `${securityBase(companyId)}/users/${encodeURIComponent(
          body.userId
        )}/assignments/${encodeURIComponent(body.assignmentId)}`
      )
      .then(() => undefined),

  assignUserToRole: (
    companyId: string,
    userId: string,
    roleNameOrId: string
  ): Promise<void> =>
    securityApi.addUserToRole(companyId, roleNameOrId, userId),

  removeAssignedUserFromRole: (
    companyId: string,
    userId: string,
    roleNameOrId: string
  ): Promise<void> =>
    securityApi.removeUserFromRole(companyId, roleNameOrId, userId),

  // ---------------------------------------------------------------------------
  // Employee support for ERP user onboarding
  // Backend route:
  // GET /api/companies/{companyId}/hr/employees/available-for-user
  // ---------------------------------------------------------------------------

  searchEmployees: async (
    companyId: string,
    query: EmployeeSearchQuery = {},
    signal?: AbortSignal
  ): Promise<EmployeeOption[]> => {
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize, 30);

    const res = await http.get<EmployeeOption[] | PagedResult<EmployeeOption>>(
      `${hrEmployeesBase(companyId)}/available-for-user${qs({
        branchId: query.branchId,
        q: query.q,
        page,
        pageSize,
      })}`,
      { signal }
    );

    return normalizeArray<EmployeeOption>(res.data);
  },

  // ---------------------------------------------------------------------------
  // Stock-location support for ERP user onboarding
  // ---------------------------------------------------------------------------

  listStockLocations: async (
    companyId: string,
    query: StockLocationQuery = {},
    signal?: AbortSignal
  ): Promise<StockLocationOption[]> => {
    const pageNumber = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize, 100);

    const path = query.branchId
      ? `/companies/${companyId}/branches/${query.branchId}/stock-locations`
      : `/companies/${companyId}/stock-locations`;

    const res = await http.get<
      StockLocationOption[] | PagedResult<StockLocationOption>
    >(
      `${path}${qs({
        activeOnly: query.isActive ?? true,
        pageNumber,
        pageSize,
      })}`,
      { signal }
    );

    return normalizeArray<StockLocationOption>(res.data);
  },
};