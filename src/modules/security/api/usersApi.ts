import { http } from "../../../api/http";
import type {
  PagedResult,
  UserDto,
  UsersQuery,
  CreateUserRequest,
  UpdateUserRequest,
  ResetPasswordRequest,
} from "../../../api/identity/identityTypes";

/**
 * Backend routes (exactly as Swagger)
 * GET    /api/identity/Users
 * POST   /api/identity/Users
 * GET    /api/identity/Users/{id}
 * PUT    /api/identity/Users/{id}
 * DELETE /api/identity/Users/{id}/deactivate
 * POST   /api/identity/Users/{id}/reset-password
 */
const BASE = "/identity/Users";

export function getUsers(
  query: UsersQuery
): Promise<PagedResult<UserDto>> {
  return http.get(BASE, { params: query });
}

export function createUser(
  body: CreateUserRequest
): Promise<UserDto> {
  return http.post(BASE, body);
}

export function getUserById(
  id: string
): Promise<UserDto> {
  return http.get(`${BASE}/${id}`);
}

export function updateUser(
  id: string,
  body: UpdateUserRequest
): Promise<UserDto> {
  return http.put(`${BASE}/${id}`, body);
}

export function deactivateUser(
  id: string
): Promise<void> {
  return http.delete(`${BASE}/${id}/deactivate`);
}

export function resetUserPassword(
  id: string,
  body: ResetPasswordRequest
): Promise<void> {
  return http.post(`${BASE}/${id}/reset-password`, body);
}
