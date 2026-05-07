import { http } from "../../../api/http";
export type RoleDto = {
  id: string;
  name: string;
  description?: string | null;
  userCount: number;
  isSystem: boolean;
};

export type UserLiteDto = {
  id: string;
  email: string;
  fullName?: string | null;
};

export type RoleDetailDto = {
  role: RoleDto;
  permissionKeys: string[];
  users: UserLiteDto[];
};

export type PermissionCatalogItem = {
  key: string;
  group: string;
  description: string;
};

/** Use this shape if your backend returns a structured error body. */
type ApiErrorBody =
  | { message?: string; error?: string; errors?: Record<string, string[]> }
  | unknown;

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(message: string, status: number, body: ApiErrorBody) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}



const base = (companyId: string) => `/companies/${companyId}/security`;

export const securityApi = {
  // Roles
  listRoles: (companyId: string, signal?: AbortSignal) =>
    http.get<RoleDto[]>(
      `${base(companyId)}/roles`,
      { signal }
    ),

  getRole: (companyId: string, roleId: string, signal?: AbortSignal) =>
    http.get<RoleDetailDto>(`${base(companyId)}/roles/${roleId}`, { signal }),

  createRole: (
    companyId: string,
    payload: { name: string; description?: string | null },
    signal?: AbortSignal  
  ) =>
    http.post<string>(`${base(companyId)}/roles`, {
      method: "POST",
      body: JSON.stringify({ ...payload, companyId }),
      signal,
    }),

  updateRole: (
    companyId: string,
    roleId: string,
    payload: { name: string; description?: string | null },
    signal?: AbortSignal
  ) =>
    http.put<void>(`${base(companyId)}/roles/${encodeURIComponent(roleId)}`, {
      method: "PUT",
      body: JSON.stringify({ ...payload, companyId }),
      signal,
    }),

  deleteRole: (companyId: string, roleId: string, signal?: AbortSignal) =>
    http.delete<void>(
      `${base(companyId)}/roles/${encodeURIComponent(roleId)}${buildQuery({ companyId })}`,
      { signal }
    ),

  // Permissions catalog
  listPermissions: (companyId: string, signal?: AbortSignal) =>
    http.get<PermissionCatalogItem[]>(`${base(companyId)}/permissions`, { signal }),

  // Role permissions assignment
  setRolePermissions: (companyId: string, roleId: string, permissionKeys: string[], signal?: AbortSignal) =>
    http.put<void>(`${base(companyId)}/roles/${encodeURIComponent(roleId)}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissionKeys }),
      signal,
    }),

  // Users search
  searchUsers: (companyId: string, q: string, signal?: AbortSignal) =>
    http.get<UserLiteDto[]>(
      `${base(companyId)}/users/search${buildQuery({ q })}`,
      { signal }
    ),

  // Role membership
  addUserToRole: (companyId: string, roleId: string, userId: string, signal?: AbortSignal) =>
    http.post<void>(`${base(companyId)}/roles/${encodeURIComponent(roleId)}/users`, {
      method: "POST",
      body: JSON.stringify({ userId }),
      signal,
    }),

  removeUserFromRole: (companyId: string, roleId: string, userId: string, signal?: AbortSignal) =>
    http.delete<void>(
      `${base(companyId)}/roles/${encodeURIComponent(roleId)}/users/${encodeURIComponent(userId)}`,
      { signal }
    ),
};
