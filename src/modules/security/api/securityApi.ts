// src/modules/security/api/securityApi.ts
// Company-scoped security endpoints. Base: /companies/{companyId}/security
// All methods return AxiosResponse<T> — callers use .data.

import { http } from "../../../api/http";
import type {
  RoleDto, RoleDetailDto, PermissionCatalogItem, UserLiteDto,
  CreateRoleRequest, UpdateRoleRequest,
} from "../types/security.types";

export type { RoleDto, RoleDetailDto, PermissionCatalogItem, UserLiteDto };

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message); this.name = "ApiError"; this.status = status; this.body = body;
  }
}

const base = (cid: string) => `/companies/${cid}/security`;

export const securityApi = {

  listRoles: (cid: string, signal?: AbortSignal) =>
    http.get<RoleDto[]>(`${base(cid)}/roles`, { signal }),

  getRole: (cid: string, roleId: string, signal?: AbortSignal) =>
    http.get<RoleDetailDto>(`${base(cid)}/roles/${encodeURIComponent(roleId)}`, { signal }),

  createRole: (cid: string, payload: CreateRoleRequest, signal?: AbortSignal) =>
    http.post<string>(`${base(cid)}/roles`, { ...payload, companyId: cid }, { signal }),

  updateRole: (cid: string, roleId: string, payload: UpdateRoleRequest, signal?: AbortSignal) =>
    http.put<void>(`${base(cid)}/roles/${encodeURIComponent(roleId)}`, { ...payload, companyId: cid }, { signal }),

  deleteRole: (cid: string, roleId: string, signal?: AbortSignal) =>
    http.delete<void>(`${base(cid)}/roles/${encodeURIComponent(roleId)}`, { signal }),

  listPermissions: (cid: string, signal?: AbortSignal) =>
    http.get<PermissionCatalogItem[]>(`${base(cid)}/permissions`, { signal }),

  setRolePermissions: (cid: string, roleId: string, permissionKeys: string[], signal?: AbortSignal) =>
    http.put<void>(`${base(cid)}/roles/${encodeURIComponent(roleId)}/permissions`, { permissionKeys }, { signal }),

  searchUsers: (cid: string, q: string, signal?: AbortSignal) => {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    return http.get<UserLiteDto[]>(`${base(cid)}/users/search${qs}`, { signal });
  },

  addUserToRole: (cid: string, roleId: string, userId: string, signal?: AbortSignal) =>
    http.post<void>(`${base(cid)}/roles/${encodeURIComponent(roleId)}/users`, { userId }, { signal }),

  removeUserFromRole: (cid: string, roleId: string, userId: string, signal?: AbortSignal) =>
    http.delete<void>(`${base(cid)}/roles/${encodeURIComponent(roleId)}/users/${encodeURIComponent(userId)}`, { signal }),
};