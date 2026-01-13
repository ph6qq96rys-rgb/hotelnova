import { http } from "../../../../api/http";
import type {
  CreateUserDto,
  PagedResult,
  UpdateUserDto,
  UserDto,
  UserFilter
} from "../types";
import { Dot } from "lucide-react";

const base = import.meta.env.VITE_API_BASE_URL ?? "";


/** Build query string from filter */
function qs(filter: UserFilter) {
  const p = new URLSearchParams();

  if (filter.q) p.set("q", filter.q);
  if (filter.page) p.set("page", String(filter.page));
  if (filter.pageSize) p.set("pageSize", String(filter.pageSize));
  if (filter.role) p.set("role", filter.role);
  if (filter.isActive !== undefined) p.set("isActive", String(filter.isActive));
  if (filter.companyId) p.set("companyId", filter.companyId);
  if (filter.branchId) p.set("branchId", filter.branchId);
  if (filter.storeId) p.set("storeId", filter.storeId);

  const s = p.toString();
  return s ? `?${s}` : "";
  
}

export const usersApi = {
  /** List users with filters */
  list: (filter: UserFilter) =>
    http<PagedResult<UserDto>>(
      `${base}/api/identity/users/users${qs(filter)}`,{
        method:"get",
        data:Dot
      }
    ),

  /** Get single user */
  get: (id: string) =>
    http<UserDto>(
      `${base}/api/identity/users/${id}`
    ),

  /** Create user */
  create: (dto: CreateUserDto) =>
    http<UserDto>(
      `${base}/api/identity/users`,
      {
        method: "POST",
        data: dto,
      }
    ),

  /** Update user */
  update: (id: string, dto: UpdateUserDto) =>
    http<UserDto>(
      `${base}/api/identity/users/${id}`,
      {
        method: "PUT",
        data:dto,
      }
    ),

  /** Activate / Deactivate user */
  setActive: (id: string, isActive: boolean) =>
    http<void>(
      `${base}/api/identity/users/${id}/active`,
      {
        method: "PUT",
        data:isActive,
      }
    ),

  /** Reset user password */
  resetPassword: (id: string, newPassword: string) =>
    http<void>(
      `${base}/api/identity/users/${id}/password`,
      {
        method: "PUT",
        data:{newPassword},
      }
    ),
    async addToBranch(companyId: string, branchId: string, userId: string) {
    return http.post(
      `/companies/${companyId}/branches/${branchId}/users`,
      { userId }
    );
  },

  async listBranchUsers(companyId: string, branchId: string) {
    return http.get(`/companies/${companyId}/branches/${branchId}/users`);
  },
};
