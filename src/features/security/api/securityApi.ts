import { http } from "../../../api/http";

export type RoleDto = {
  id: string;
  name: string;
  description?: string | null;
  userCount?: number;
  isSystem?: boolean;
};

export type PermissionDto = {
  key: string;            // e.g. "inventory.manage"
  group: string;          // e.g. "Inventory"
  description?: string;   // e.g. "Create/update inventory master data"
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

export const securityApi = {
  // Roles
  listRoles: () => http.get<RoleDto[]>("/security/roles"),
  getRole: (roleId: string) => http.get<RoleDetailDto>(`/api/security/roles/${roleId}`),
  createRole: (payload: { name: string; description?: string | null }) =>
    http.post<string>("/security/roles", payload), // returns roleId
  updateRole: (roleId: string, payload: { name: string; description?: string | null }) =>
    http.put<void>(`/security/roles/${roleId}`, payload),
  deleteRole: (roleId: string) => http.delete<void>(`/security/roles/${roleId}`),

  // Permissions catalog
  listPermissions: () => http.get<PermissionDto[]>("/security/permissions"),

  // Role permissions assignment
  setRolePermissions: (roleId: string, permissionKeys: string[]) =>
    http.put<void>(`/security/roles/${roleId}/permissions`, { permissionKeys }),

  // Users + role membership
  searchUsers: (q: string) =>
    http.get<UserLiteDto[]>(`/security/users/search?q=${encodeURIComponent(q)}`),
  addUserToRole: (roleId: string, userId: string) =>
    http.post<void>(`/security/roles/${roleId}/users`, { userId }),
  removeUserFromRole: (roleId: string, userId: string) =>
    http.delete<void>(`/security/roles/${roleId}/users/${userId}`),
};
