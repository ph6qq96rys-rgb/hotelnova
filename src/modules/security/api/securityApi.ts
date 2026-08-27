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
  search?: string;
  page?: number;
  pageSize?: number;
  branchId?: string | null;
  storeId?: string | null;
  stockLocationId?: string | null;
  role?: string | null;
  isActive?: boolean | null;
};

export type EmployeeOption = {
  id: string;
  employeeCode?: string | null;
  employeeNo?: string | null;
  fullName: string;
  email?: string | null;
  workEmail?: string | null;
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

export type StoreOption = {
  id: string;
  name: string;
  code?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  storeType?: string | null;
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

export type StoreQuery = {
  branchId?: string | null;
  isActive?: boolean | null;
  page?: number;
  pageSize?: number;
};

export type CreateSecurityUserRequest = CreateUserRequest & {
  companyEmployeeId?: string | null;
  employeeId?: string | null;
  branchId?: string | null;
  branchIds?: string[];
  storeId?: string | null;
  stockLocationId?: string | null;
  stockLocationIds?: string[];
  allowedStockLocationIds?: string[];

  // Canonical command payload.
  // These must contain normalized backend values only, e.g. COMPANYADMIN.
  roles?: string[];

  // Compatibility only because current backend SecurityController.SetUserRoles
  // still accepts { roleNames: [...] }.
  roleNames?: string[];

  isActive?: boolean;
  canSubmitWarehouseRequests?: boolean;
  canApproveWarehouseRequests?: boolean;
  canIssueStock?: boolean;
};

export type UpdateSecurityUserRequest = UpdateUserRequest &
  Partial<CreateSecurityUserRequest>;

// IMPORTANT:
// If your http wrapper already prefixes /api, keep this empty.
// If your http wrapper does NOT prefix /api, change this to "/api".
const apiBase = "";

const securityBase = (companyId: string) =>
  `${apiBase}/companies/${encodeURIComponent(companyId)}/security`;

const usersBase = (companyId: string) =>
  `${apiBase}/companies/${encodeURIComponent(companyId)}/identity/users`;

const hrEmployeesBase = (companyId: string) =>
  `${apiBase}/companies/${encodeURIComponent(companyId)}/hr/employees`;

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
  if (Array.isArray(obj?.data?.items)) return obj.data.items as T[];
  if (Array.isArray(obj?.employees)) return obj.employees as T[];
  if (Array.isArray(obj?.employeeOptions)) return obj.employeeOptions as T[];

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

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

function isGuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    clean(value)
  );
}

function normalizeGuid(value: unknown): string | null {
  const id = clean(value);
  if (!id || id.toLowerCase() === EMPTY_GUID || !isGuid(id)) return null;
  return id;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter(Boolean).map(String))];
}

function normalizeGuidList(values: unknown[]): string[] {
  return unique(values.flatMap((value) => {
    if (Array.isArray(value)) return value.map(normalizeGuid);
    return [normalizeGuid(value)];
  }));
}

function normalizeStockLocationIdsFromBody(
  body: Partial<CreateSecurityUserRequest>
): string[] {
  return normalizeGuidList([
    body.allowedStockLocationIds,
    body.stockLocationIds,
    body.stockLocationId,
  ]);
}

function normalizeDefaultId(
  preferredId: unknown,
  candidates: string[]
): string | null {
  const preferred = normalizeGuid(preferredId);
  if (preferred && candidates.includes(preferred)) return preferred;
  return candidates[0] ?? null;
}

function stripEmptyAccessFields<T extends Record<string, any>>(payload: T): T {
  const next = { ...payload };

  if (Array.isArray(next.stockLocationIds) && next.stockLocationIds.length === 0) {
    delete next.stockLocationIds;
  }

  if (Array.isArray(next.allowedStockLocationIds) && next.allowedStockLocationIds.length === 0) {
    delete next.allowedStockLocationIds;
  }

  if (!next.stockLocationId) delete next.stockLocationId;
  if (!next.storeId) delete next.storeId;

  return next;
}

function normalizeUserWritePayload<T extends CreateSecurityUserRequest | UpdateSecurityUserRequest>(
  body: T,
  roles?: string[]
): T {
  const stockLocationIds = normalizeStockLocationIdsFromBody(body);
  const defaultStockLocationId = normalizeDefaultId(
    body.stockLocationId,
    stockLocationIds
  );

  return stripEmptyAccessFields({
    ...body,
    ...(roles ? { roles } : {}),
    storeId: normalizeGuid((body as any).storeId),
    stockLocationIds,
    allowedStockLocationIds: stockLocationIds,
    stockLocationId: defaultStockLocationId,
  }) as T;
}


function normalizeStoreOption(value: any): StoreOption | null {
  // Endpoints may return POS stores under different keys. Prefer the real store id.
  const id = normalizeGuid(
    value?.storeId ??
      value?.StoreId ??
      value?.posId ??
      value?.PosId ??
      value?.outletId ??
      value?.OutletId ??
      value?.id ??
      value?.Id
  );

  if (!id) return null;

  const name =
    clean(
      value?.storeName ??
        value?.StoreName ??
        value?.posName ??
        value?.PosName ??
        value?.outletName ??
        value?.OutletName ??
        value?.name ??
        value?.Name
    ) || "Unnamed Store / POS";

  return {
    id,
    name,
    code:
      clean(
        value?.storeCode ??
          value?.StoreCode ??
          value?.posCode ??
          value?.PosCode ??
          value?.outletCode ??
          value?.OutletCode ??
          value?.code ??
          value?.Code
      ) || null,
    branchId: normalizeGuid(value?.branchId ?? value?.BranchId),
    branchName: clean(value?.branchName ?? value?.BranchName) || null,
    storeType:
      clean(value?.storeType ?? value?.StoreType ?? value?.type ?? value?.Type) ||
      null,
    isActive: value?.isActive === false || value?.IsActive === false ? false : true,
  };
}

function normalizeStockLocationOption(value: any): StockLocationOption | null {
  // Branch-scoped endpoints often return both:
  // - id: BranchStockLocation assignment id
  // - stockLocationId/locationId: actual StockLocations.Id expected by UserService
  // Always prefer the actual stock-location id.
  const id = normalizeGuid(
    value?.stockLocationId ??
      value?.StockLocationId ??
      value?.locationId ??
      value?.LocationId ??
      value?.inventoryLocationId ??
      value?.InventoryLocationId ??
      value?.id ??
      value?.Id
  );

  if (!id) return null;

  const name =
    clean(
      value?.stockLocationName ??
        value?.StockLocationName ??
        value?.locationName ??
        value?.LocationName ??
        value?.name ??
        value?.Name
    ) || "Unnamed location";

  return {
    id,
    name,
    code:
      clean(
        value?.stockLocationCode ??
          value?.StockLocationCode ??
          value?.locationCode ??
          value?.LocationCode ??
          value?.code ??
          value?.Code
      ) || null,
    branchId: normalizeGuid(value?.branchId ?? value?.BranchId),
    branchName: clean(value?.branchName ?? value?.BranchName) || null,
    locationType:
      clean(value?.locationType ?? value?.LocationType ?? value?.type ?? value?.Type) ||
      null,
    isActive: value?.isActive === false || value?.IsActive === false ? false : true,
  };
}

function normalizeRoleValue(value: unknown): string {
  return clean(value).toUpperCase();
}

function normalizeRoleNames(value?: string[] | null): string[] {
  return [
    ...new Set(
      (value ?? [])
        .filter(Boolean)
        .map(normalizeRoleValue)
        .filter(Boolean)
    ),
  ];
}

/**
 * Role display contract:
 * - displayName is for label only.
 * - value/normalizedName is for payload only.
 * - name is a technical name and can be shown as fallback label.
 *
 * DO NOT derive value from displayName.
 */
function normalizeRoleDto<T extends RoleDto | RoleDetailDto>(role: T): T {
  const r = role as any;

  const normalizedName = clean(r.normalizedName);
  const value = clean(r.value ?? r.normalizedName);
  const name = clean(r.name);
  const displayName = clean(r.displayName ?? r.name ?? value);

  return {
    ...r,
    name,
    normalizedName: normalizedName || undefined,
    value: value || undefined,
    displayName,
  } as T;
}

function roleNameFromRole(role: RoleDto | RoleDetailDto | string): string {
  if (typeof role === "string") return normalizeRoleValue(role);

  const r = role as any;

  return normalizeRoleValue(r.value ?? r.normalizedName ?? "");
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

    // Do not filter roles out here. Rendering should show labels even if backend
    // temporarily forgets value/normalizedName. Submit validation belongs in form.
    return normalizeArray<RoleDto>(res.data).map(normalizeRoleDto);
  },

  getRole: async (
    companyId: string,
    roleId: string,
    signal?: AbortSignal
  ): Promise<RoleDetailDto> => {
    const res = await http.get<RoleDetailDto>(
      `${securityBase(companyId)}/roles/${encodeURIComponent(roleId)}`,
      { signal }
    );

    return normalizeRoleDto(res.data);
  },

  createRole: async (
    companyId: string,
    payload: CreateRoleRequest,
    signal?: AbortSignal
  ): Promise<RoleDto> => {
    const res = await http.post<RoleDto>(
      `${securityBase(companyId)}/roles`,
      { ...payload, companyId },
      { signal }
    );

    return normalizeRoleDto(res.data);
  },

  updateRole: async (
    companyId: string,
    roleId: string,
    payload: UpdateRoleRequest,
    signal?: AbortSignal
  ): Promise<RoleDto> => {
    const res = await http.put<RoleDto>(
      `${securityBase(companyId)}/roles/${encodeURIComponent(roleId)}`,
      { ...payload, companyId },
      { signal }
    );

    return normalizeRoleDto(res.data);
  },

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
        permissionKeys,
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
        search: query.search ?? query.q,
        page,
        pageSize,
        branchId: query.branchId,
        storeId: query.storeId,
        stockLocationId: query.stockLocationId,
        role: query.role ? normalizeRoleValue(query.role) : undefined,
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
    body: CreateSecurityUserRequest,
    signal?: AbortSignal
  ): Promise<UserDto> => {
    const roles = normalizeRoleNames(body.roles ?? body.roleNames);
    const payload = normalizeUserWritePayload(body, roles);

    return http
      .post<UserDto>(usersBase(companyId), payload, { signal })
      .then(unwrap);
  },

  updateUser: (
    companyId: string,
    userId: string,
    body: UpdateSecurityUserRequest,
    signal?: AbortSignal
  ): Promise<UserDto> => {
    const hasRolePayload =
      body.roles !== undefined || body.roleNames !== undefined;

    const roles = hasRolePayload
      ? normalizeRoleNames(body.roles ?? body.roleNames)
      : undefined;

    const payload = hasRolePayload
      ? normalizeUserWritePayload(body, roles)
      : normalizeUserWritePayload(body);

    return http
      .put<UserDto>(
        `${usersBase(companyId)}/${encodeURIComponent(userId)}`,
        payload,
        { signal }
      )
      .then(unwrap);
  },

  setUserActive: (
    companyId: string,
    userId: string,
    isActive: boolean,
    signal?: AbortSignal
  ): Promise<void> =>
    http
      .patch<void>(
        `${usersBase(companyId)}/${encodeURIComponent(userId)}/active`,
        { isActive },
        { signal }
      )
      .then(() => undefined),

  activateUser: (
    companyId: string,
    userId: string,
    signal?: AbortSignal
  ): Promise<void> =>
    http
      .post<void>(
        `${usersBase(companyId)}/${encodeURIComponent(userId)}/activate`,
        {},
        { signal }
      )
      .then(() => undefined),

  deactivateUser: (
    companyId: string,
    userId: string,
    signal?: AbortSignal
  ): Promise<void> =>
    http
      .post<void>(
        `${usersBase(companyId)}/${encodeURIComponent(userId)}/deactivate`,
        {},
        { signal }
      )
      .then(() => undefined),

  resetUserPassword: (
    companyId: string,
    userId: string,
    body: ResetPasswordRequest | string,
    signal?: AbortSignal
  ): Promise<void> => {
    const payload = typeof body === "string" ? { newPassword: body } : body;

    return http
      .post<void>(
        `${usersBase(companyId)}/${encodeURIComponent(userId)}/reset-password`,
        payload,
        { signal }
      )
      .then(() => undefined);
  },

  setUserRoles: (
    companyId: string,
    payload: SetRolesRequest,
    signal?: AbortSignal
  ): Promise<void> => {
    const roleValues = normalizeRoleNames(
      (payload as any).roles ?? payload.roleNames
    );

    return http
      .put<void>(
        `${securityBase(companyId)}/users/${encodeURIComponent(
          payload.userId
        )}/roles`,
        {
          roleNames: roleValues,
        },
        { signal }
      )
      .then(() => undefined);
  },

  getUserRoles: async (
    companyId: string,
    userId: string,
    signal?: AbortSignal
  ): Promise<string[]> => {
    const res = await http.get<string[]>(
      `${securityBase(companyId)}/users/${encodeURIComponent(userId)}/roles`,
      { signal }
    );

    return normalizeArray<string>(res.data).map(normalizeRoleValue);
  },

  assignUserBranches: (
    companyId: string,
    userId: string,
    body: {
      branchIds: string[];
      defaultBranchId?: string | null;
    },
    signal?: AbortSignal
  ): Promise<void> =>
    http
      .put<void>(
        `${usersBase(companyId)}/${encodeURIComponent(userId)}/branches`,
        body,
        { signal }
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
    },
    signal?: AbortSignal
  ): Promise<void> => {
    const stockLocationIds = normalizeGuidList([body.stockLocationIds]);
    const defaultStockLocationId = normalizeDefaultId(
      body.defaultStockLocationId,
      stockLocationIds
    );

    return http
      .put<void>(
        `${usersBase(companyId)}/${encodeURIComponent(
          userId
        )}/stock-locations`,
        {
          ...body,
          stockLocationIds,
          defaultStockLocationId,
        },
        { signal }
      )
      .then(() => undefined);
  },

  linkUserEmployee: (
    companyId: string,
    userId: string,
    employeeId: string | null,
    signal?: AbortSignal
  ): Promise<UserDto> =>
    http
      .put<UserDto>(
        `${usersBase(companyId)}/${encodeURIComponent(userId)}/employee`,
        { employeeId: normalizeGuid(employeeId) },
        { signal }
      )
      .then(unwrap),

  // ---------------------------------------------------------------------------
  // Role membership / assignments under SecurityController
  // ---------------------------------------------------------------------------

  addUserToRole: async (
    companyId: string,
    roleIdOrName: string,
    userId: string,
    _branchId?: string | null,
    signal?: AbortSignal
  ): Promise<void> => {
    const role =
      roleIdOrName.includes("-")
        ? await securityApi.getRole(companyId, roleIdOrName, signal)
        : roleIdOrName;

    return http
      .post<void>(
        `${securityBase(companyId)}/roles/assign-user`,
        {
          userId,
          role: roleNameFromRole(role),
        },
        { signal }
      )
      .then(() => undefined);
  },

  removeUserFromRole: async (
    companyId: string,
    roleIdOrName: string,
    userId: string,
    signal?: AbortSignal
  ): Promise<void> => {
    const role =
      roleIdOrName.includes("-")
        ? await securityApi.getRole(companyId, roleIdOrName, signal)
        : roleIdOrName;

    return http
      .post<void>(
        `${securityBase(companyId)}/roles/remove-user`,
        {
          userId,
          role: roleNameFromRole(role),
        },
        { signal }
      )
      .then(() => undefined);
  },

  addUserRoleAssignment: (
    companyId: string,
    body: AddAssignmentRequest,
    signal?: AbortSignal
  ): Promise<void> =>
    securityApi.addUserToRole(
      companyId,
      body.roleId,
      body.userId,
      body.branchId,
      signal
    ),

  removeUserRoleAssignment: (
    companyId: string,
    body: RemoveAssignmentRequest,
    signal?: AbortSignal
  ): Promise<void> =>
    securityApi.removeUserFromRole(
      companyId,
      body.roleId ?? body.assignmentId,
      body.userId,
      signal
    ),

  assignUserToRole: (
    companyId: string,
    userId: string,
    roleNameOrId: string,
    signal?: AbortSignal
  ): Promise<void> =>
    securityApi.addUserToRole(companyId, roleNameOrId, userId, null, signal),

  removeAssignedUserFromRole: (
    companyId: string,
    userId: string,
    roleNameOrId: string,
    signal?: AbortSignal
  ): Promise<void> =>
    securityApi.removeUserFromRole(companyId, roleNameOrId, userId, signal),

  // ---------------------------------------------------------------------------
  // Optional compatibility methods
  // ---------------------------------------------------------------------------

  getUserPermissions: async (): Promise<string[]> => {
    return [];
  },

  setUserPermissions: async (
    _companyId: string,
    _payload: SetPermissionsRequest
  ): Promise<void> => {
    return;
  },

  searchUsers: async (
    companyId: string,
    q: string,
    signal?: AbortSignal
  ): Promise<UserLiteDto[]> => {
    const result = await securityApi.listUsersPage(
      companyId,
      { q, page: 1, pageSize: 25 },
      signal
    );

    return result.items.map((user) => ({
      id: user.id,
      fullName: (user as any).fullName ?? user.userName ?? user.email,
      email: user.email,
      roles: (user as any).roles ?? [],
      isActive: user.isActive,
    })) as UserLiteDto[];
  },

  // ---------------------------------------------------------------------------
  // Employee support for ERP user onboarding
  // ---------------------------------------------------------------------------

  searchEmployees: async (
    companyId: string,
    query: EmployeeSearchQuery = {},
    signal?: AbortSignal
  ): Promise<EmployeeOption[]> => {
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize, 100);

    if (!companyId) return [];

    const res = await http.get<any>(
      `${hrEmployeesBase(companyId)}/available-for-user${qs({
        branchId: query.branchId,
        q: query.q,
        page,
        pageSize,
      })}`,
      { signal }
    );

    return normalizeArray<any>(res.data)
      .filter((x) => x?.id || x?.employeeId)
      .map((x) => ({
        id: String(x.id ?? x.employeeId),
        employeeCode: x.employeeCode ?? x.employeeNo ?? x.code ?? null,
        employeeNo: x.employeeNo ?? x.employeeCode ?? x.code ?? null,
        fullName:
          x.fullName ??
          x.name ??
          x.displayName ??
          `${x.firstName ?? ""} ${x.lastName ?? ""}`.trim() ??
          "Unnamed employee",
        email: x.email ?? x.workEmail ?? null,
        workEmail: x.workEmail ?? x.email ?? null,
        branchId: x.branchId ?? null,
        branchName: x.branchName ?? null,
        departmentName: x.departmentName ?? null,
        positionName: x.positionName ?? null,
      }));
  },

  // ---------------------------------------------------------------------------
  // Store / POS support for ERP user onboarding
  // ---------------------------------------------------------------------------

  listStores: async (
    companyId: string,
    query: StoreQuery = {},
    signal?: AbortSignal
  ): Promise<StoreOption[]> => {
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize, 100);

    if (!companyId) return [];

    const companyPath = `${apiBase}/companies/${encodeURIComponent(companyId)}`;
    const paths = unique([
      query.branchId
        ? `${companyPath}/branches/${encodeURIComponent(query.branchId)}/stores`
        : null,
      `${companyPath}/stores`,
      `${companyPath}/pos/stores`,
    ]);

    let lastError: unknown = null;

    for (const path of paths) {
      try {
        const res = await http.get<StoreOption[] | PagedResult<StoreOption>>(
          `${path}${qs({
            branchId: query.branchId,
            activeOnly: query.isActive ?? true,
            isActive: query.isActive ?? true,
            page,
            pageSize,
          })}`,
          { signal }
        );

        return normalizeArray<any>(res.data)
          .map(normalizeStoreOption)
          .filter((x): x is StoreOption => Boolean(x));
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
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
      ? `${apiBase}/companies/${encodeURIComponent(companyId)}/branches/${encodeURIComponent(
          query.branchId
        )}/stock-locations`
      : `${apiBase}/companies/${encodeURIComponent(companyId)}/stock-locations`;

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

    return normalizeArray<any>(res.data)
      .map(normalizeStockLocationOption)
      .filter((x): x is StockLocationOption => Boolean(x));
  },

}