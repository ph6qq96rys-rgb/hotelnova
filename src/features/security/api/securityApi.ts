// ─── Security API ─────────────────────────────────────────────────────────────
// Role-based access control endpoints.

import { http } from "../../../api/http";

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface RoleDto {
  id: string;
  name: string;
  description?: string | null;
  userCount?: number;
  isSystem?: boolean;
}

export interface PermissionDto {
  key: string;
  group: string;
  description?: string;
}

export interface UserLiteDto {
  id: string;
  fullName?: string | null;
  email: string;
}

export interface RoleDetailDto {
  role: RoleDto;
  permissionKeys: string[];
  users: UserLiteDto[];
}

// ── Request shapes ────────────────────────────────────────────────────────────

export interface CreateRoleRequest {
  name: string;
  description?: string | null;
}

export interface UpdateRoleRequest {
  name: string;
  description?: string | null;
}

export interface SetPermissionsRequest {
  permissionKeys: string[];
}

// ── URL helper ────────────────────────────────────────────────────────────────

const base = (companyId: string) => `/companies/${companyId}/security`;
const d = <T>(res: { data: T }) => res.data;

// ── API ───────────────────────────────────────────────────────────────────────

export const securityApi = {
  // ── Permissions ────────────────────────────────────────────────────────────

  listPermissions: (companyId: string): Promise<PermissionDto[]> =>
    http.get<PermissionDto[]>(`${base(companyId)}/permissions`).then(d),

  // ── Roles ──────────────────────────────────────────────────────────────────

  listRoles: (companyId: string): Promise<RoleDto[]> =>
    http.get<RoleDto[]>(`${base(companyId)}/roles`).then(d),

  getRole: (companyId: string, roleId: string): Promise<RoleDetailDto> =>
    http.get<RoleDetailDto>(`${base(companyId)}/roles/${roleId}`).then(d),

  createRole: (companyId: string, payload: CreateRoleRequest): Promise<string> =>
    http.post<string>(`${base(companyId)}/roles`, payload).then(d),

  updateRole: (companyId: string, roleId: string, payload: UpdateRoleRequest): Promise<void> =>
    http.put<void>(`${base(companyId)}/roles/${roleId}`, payload).then(d),

  deleteRole: (companyId: string, roleId: string): Promise<void> =>
    http.delete<void>(`${base(companyId)}/roles/${roleId}`).then(d),

  // ── Role permissions ───────────────────────────────────────────────────────

  setRolePermissions: (companyId: string, roleId: string, permissionKeys: string[]): Promise<void> =>
    http.put<void>(`${base(companyId)}/roles/${roleId}/permissions`, { permissionKeys }).then(d),

  // ── User membership ────────────────────────────────────────────────────────

  searchUsers: (companyId: string, q: string): Promise<UserLiteDto[]> =>
    http.get<UserLiteDto[]>(`${base(companyId)}/search`, { params: { q } }).then(d),

  addUserToRole: (companyId: string, roleId: string, userId: string): Promise<void> =>
    http.post<void>(`${base(companyId)}/roles/${roleId}/users`, { userId }).then(d),

  removeUserFromRole: (companyId: string, roleId: string, userId: string): Promise<void> =>
    http.delete<void>(`${base(companyId)}/roles/${roleId}/users/${userId}`).then(d),
};