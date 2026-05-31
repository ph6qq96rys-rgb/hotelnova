// src/modules/security/api/usersApi.ts
// Company-scoped user management. Base: /companies/{companyId}/identity/users

import { http } from "../../../api/http";
import type { SetPermissionsRequest, SetRolesRequest } from "../types/security.types";
import type {
  UserDto,
  CreateUserRequest,
  UpdateUserRequest,
  ResetPasswordRequest,
} from "../../../api/identity/identityTypes";

const base = (cid: string) => `/companies/${cid}/identity/users`;
const d = <T>(res: { data: T }) => res.data;

export const usersApi = {

  getUserById: (cid: string, userId: string, signal?: AbortSignal): Promise<UserDto> =>
    http.get<UserDto>(`${base(cid)}/${userId}`, { signal }).then(d),

  listUsers: async (cid: string, signal?: AbortSignal): Promise<UserDto[]> => {
    const res = await http.get<UserDto[] | { items?: UserDto[] }>(base(cid), { signal });
    const data = res.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as any)?.items)) return (data as any).items;
    return [];
  },

  createUser: (cid: string, body: CreateUserRequest): Promise<UserDto> =>
    http.post<UserDto>(base(cid), body).then(d),

  updateUser: (cid: string, id: string, body: UpdateUserRequest): Promise<UserDto> =>
    http.put<UserDto>(`${base(cid)}/${id}`, body).then(d),

  deactivateUser: (cid: string, id: string): Promise<void> =>
    http.delete(`${base(cid)}/${id}/deactivate`).then(() => undefined),

  resetUserPassword: (cid: string, id: string, body: ResetPasswordRequest): Promise<void> =>
    http.post(`${base(cid)}/${id}/reset-password`, body).then(() => undefined),

  getUserPermissions: async (cid: string, userId: string): Promise<string[]> => {
    const res = await http.get<string[]>(`${base(cid)}/${userId}/permissions`);
    return Array.isArray(res.data) ? res.data : [];
  },

  setUserPermissions: (cid: string, payload: SetPermissionsRequest): Promise<void> =>
    http.put(`${base(cid)}/${payload.userId}/permissions`, { permissionKeys: payload.permissionKeys }).then(() => undefined),

  setUserRoles: (cid: string, payload: SetRolesRequest): Promise<void> =>
    http.put(`${base(cid)}/${payload.userId}/roles`, { roleNames: payload.roleNames }).then(() => undefined),
};