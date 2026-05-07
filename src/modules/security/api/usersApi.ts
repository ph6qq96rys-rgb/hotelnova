import { http } from "../../../api/http";
import type { UserDto, CreateUserRequest, UpdateUserRequest, ResetPasswordRequest } from "../../../api/identity/identityTypes";

const base = (companyId: string) => `/companies/${companyId}/identity/users`;

export const usersApi = {
  async getUserById(companyId: string, userId: string, signal?: AbortSignal): Promise<UserDto> {
    const res = await http.get<UserDto>(`${base(companyId)}/${userId}`, { signal });
    return (res as any).data ?? res; // supports both axios-style and fetch-wrapper style
  },

  async listUsers(companyId: string, signal?: AbortSignal): Promise<UserDto[]> {
    const res = await http.get<UserDto[]>(base(companyId), { signal });
    const data = (res as any).data ?? res;

  return Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
    ? data.items
    : [];
  },

  async createUser(companyId: string, body: CreateUserRequest): Promise<UserDto> {
    const res = await http.post<UserDto>(base(companyId), body);
    return (res as any).data ?? res;
  },

  async updateUser(companyId: string, id: string, body: UpdateUserRequest): Promise<UserDto> {
    const res = await http.put<UserDto>(`${base(companyId)}/${id}`, body);
    return (res as any).data ?? res;
  },

  deactivateUser(companyId: string, id: string): Promise<void> {
    return http.delete(`${base(companyId)}/${id}/deactivate`);
  },

  resetUserPassword(companyId: string, id: string, body: ResetPasswordRequest): Promise<void> {
    return http.post(`${base(companyId)}/${id}/reset-password`, body);
  },

  async getUserPermissions(companyId: string, userId: string): Promise<string[]> {
    const res = await http.get<string[]>(`${base(companyId)}/${userId}/permissions`);
    return (res as any).data ?? res;
  },

  setUserPermissions(companyId: string, payload: { userId: string; permissionKeys: string[] }): Promise<void> {
    const { userId, permissionKeys } = payload;
    return http.put(`${base(companyId)}/${userId}/permissions`, { permissionKeys });
  },

  setUserRoles(companyId: string, payload: { userId: string; roleNames: string[] }): Promise<void> {
    const { userId, roleNames } = payload;
    return http.put(`${base(companyId)}/${userId}/roles`, { roleNames });
  },
};
