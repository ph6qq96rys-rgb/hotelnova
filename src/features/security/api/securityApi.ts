import { http } from "../../../api/http";

export type RoleDto = {
  id: string;
  name: string;
  description?: string | null;
  userCount?: number;
  isSystem?: boolean;
};

export type PermissionDto = {
  key: string;
  group: string;
  description?: string;
};

export type UserLiteDto = {
  id: string;
  fullName?: string | null;
  email: string;
};

export type RoleDetailDto = {
  role: RoleDto;
  permissionKeys: string[];
  users: UserLiteDto[];
};

// If your axios baseURL already includes "/api", remove "/api" here.
const base = (companyId: string) => `/companies/${companyId}/security`;

export const securityApi = {
  // =========================
  // Permissions
  // =========================
  listPermissions: (companyId: string) =>
    http.get<PermissionDto[]>(`${base(companyId)}/permissions`).then((r) => r.data),

  // =========================
  // Roles
  // =========================
  listRoles: (companyId: string) =>
    http.get<RoleDto[]>(`${base(companyId)}/roles`).then((r) => r.data),

  getRole: (companyId: string, roleId: string) =>
    http.get<RoleDetailDto>(`${base(companyId)}/roles/${roleId}`).then((r) => r.data),

  createRole: (companyId: string, payload: { name: string; description?: string | null }) =>
    http.post<string>(`${base(companyId)}/roles`, payload).then((r) => r.data), // returns Guid

  updateRole: (companyId: string, roleId: string, payload: { name: string; description?: string | null }) =>
    http.put<void>(`${base(companyId)}/roles/${roleId}`, payload).then((r) => r.data),

  deleteRole: (companyId: string, roleId: string) =>
    http.delete<void>(`${base(companyId)}/roles/${roleId}`).then((r) => r.data),

  // =========================
  // Role permissions
  // =========================
  setRolePermissions: (companyId: string, roleId: string, permissionKeys: string[]) =>
    http.put<void>(`${base(companyId)}/roles/${roleId}/permissions`, { permissionKeys }).then((r) => r.data),

  // =========================
  // Users search + membership
  // =========================
  // Backend: [HttpGet("search")] => GET /security/search?q=...
  searchUsers: (companyId: string, q: string) =>
    http.get<UserLiteDto[]>(`${base(companyId)}/search`, { params: { q } }).then((r) => r.data),

  addUserToRole: (companyId: string, roleId: string, userId: string) =>
    http.post<void>(`${base(companyId)}/roles/${roleId}/users`, { userId }).then((r) => r.data),

  removeUserFromRole: (companyId: string, roleId: string, userId: string) =>
    http.delete<void>(`${base(companyId)}/roles/${roleId}/users/${userId}`).then((r) => r.data),

  // =========================
  // Auth actions under /security
  // =========================
  logout: (companyId: string, refreshToken: string) =>
    http.post<void>(`${base(companyId)}/logout`, { refreshToken }).then((r) => r.data),

  refresh: (companyId: string, payload: { refreshToken: string }) =>
    http.post<{ accessToken: string; refreshToken: string }>(`${base(companyId)}/refresh`, payload).then((r) => r.data),
};
