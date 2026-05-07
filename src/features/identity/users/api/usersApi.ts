import { http } from "../../../../api/http";
import type {
  CreateUserDto,
  PagedResult,
  UpdateUserDto,
  UserDto,
  UserFilter,
} from "../types";

/** Build query string from filter (excluding companyId since it's in the path) */
function qs(filter: Omit<UserFilter, "companyId">) {
  const p = new URLSearchParams();

  if (filter.q) p.set("q", filter.q);
  if (filter.page) p.set("page", String(filter.page));
  if (filter.pageSize) p.set("pageSize", String(filter.pageSize));
  if (filter.role) p.set("role", filter.role);
  if (filter.isActive !== undefined) p.set("isActive", String(filter.isActive));
  if (filter.branchId) p.set("branchId", filter.branchId);
  if (filter.storeId) p.set("storeId", filter.storeId);

  const s = p.toString();
  return s ? `?${s}` : "";
}

const base = (companyId: string) => `/companies/${companyId}/identity/users`;

export const usersApi = {
  /** List users with filters */
  list: (companyId: string, filter: Omit<UserFilter, "companyId">) =>
    http<PagedResult<UserDto>>(`${base(companyId)}${qs(filter)}`, {
      method: "GET",
    }),

  /** Get single user */
  get: (companyId: string, id: string) =>
    http<UserDto>(`${base(companyId)}/${id}`, { method: "GET" }),

  /** Create user */
  create: (companyId: string, dto: CreateUserDto) =>
    http<UserDto>(`${base(companyId)}`, {
      method: "POST",
      data: dto,
    }),

  /** Update user */
  update: (companyId: string, id: string, dto: UpdateUserDto) =>
    http<UserDto>(`${base(companyId)}/${id}`, {
      method: "PUT",
      data: dto,
    }),

  /** Activate / Deactivate user */
  setActive: (companyId: string, id: string, isActive: boolean) =>
    http<void>(`${base(companyId)}/${id}/active`, {
      method: "PUT",
      data: { isActive }, // safer than sending raw boolean
    }),

  /** Reset user password */
  resetPassword: (companyId: string, id: string, newPassword: string) =>
    http<void>(`${base(companyId)}/${id}/password`, {
      method: "PUT",
      data: { newPassword },
    }),

  addToBranch: (companyId: string, branchId: string, userId: string) =>
    http<void>(`/companies/${companyId}/branches/${branchId}/users`, {
      method: "POST",
      data: { userId },
    }),

  listBranchUsers: (companyId: string, branchId: string) =>
    http<UserDto[]>(`/companies/${companyId}/branches/${branchId}/users`, {
      method: "GET",
    }),
};
