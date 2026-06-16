// src/modules/security/types/security.types.ts
//
// Single source of truth for all security module types.
// No side effects. Safe to import anywhere.

// ── Shared ────────────────────────────────────────────────────────────────────

export type UserStatus = "Active" | "Pending" | "Suspended" | "Disabled" | "Inactive";

export type Nullable<T> = T | null;

// ── Paging ────────────────────────────────────────────────────────────────────

export interface PagedResult<T> {
  items: T[];
  total: number;
  totalCount?: number;
  page: number;
  pageNumber?: number;
  pageSize: number;
}

// ── Role DTOs ─────────────────────────────────────────────────────────────────

export interface RoleDto {
  id: string;
  name: string;
  displayName?: string | null;
  description?: string | null;
  userCount?: number;
  isSystem?: boolean;
  isActive?: boolean;
  createdAtUtc?: string | null;
  updatedAtUtc?: string | null;
}

export interface RoleDetailDto {
  role: RoleDto;
  permissionKeys: string[];
  permissions?: PermissionCatalogItem[];
  users: UserLiteDto[];
}

// ── Permission DTOs ───────────────────────────────────────────────────────────

export interface PermissionCatalogItem {
  key: string;
  name?: string | null;
  group?: string | null;
  category?: string | null;
  description?: string | null;
  isDangerous?: boolean;
}

// ── User DTOs ─────────────────────────────────────────────────────────────────

export interface UserLiteDto {
  id: string;
  email?: string | null;
  fullName?: string | null;
  userName?: string | null;
  roles?: string[];
  roleNames?: string[];
  isActive?: boolean;
}

export interface UserRowDto {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
}

export interface UserAssignmentDto {
  id: string;
  roleId: string;
  roleName: string;
  branchId: string | null;
  branchName: string | null;
  permissionCount: number;
}

export interface UserDetailDto {
  id: string;
  email: string;
  fullName: string;
  userName?: string | null;
  status: UserStatus;
  isActive?: boolean;
  roles?: string[];
  roleNames?: string[];
  assignments: UserAssignmentDto[];
}

// ── Branch / Operational Context DTOs ─────────────────────────────────────────

export interface BranchLite {
  id: string;
  name: string;
}

export interface EmployeeOption {
  id: string;
  employeeCode?: string | null;
  fullName: string;
  email?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  departmentName?: string | null;
  positionName?: string | null;
}

export interface StockLocationOption {
  id: string;
  name: string;
  code?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  locationType?: string | null;
  isActive?: boolean;
}

// ── Request shapes: Roles ─────────────────────────────────────────────────────

export interface CreateRoleRequest {
  name: string;
  displayName?: string | null;
  description?: string | null;
}

export interface UpdateRoleRequest {
  name: string;
  displayName?: string | null;
  description?: string | null;
}

// ── Request shapes: Assignments ───────────────────────────────────────────────

export interface AddAssignmentRequest {
  userId: string;
  roleId: string;
  branchId?: string | null;
}

export interface RemoveAssignmentRequest {
  userId: string;
  assignmentId: string;
}

export interface SetPermissionsRequest {
  userId: string;
  permissionKeys: string[];
}

export interface SetRolesRequest {
  userId: string;
  roleNames: string[];
}

// ── Request shapes: Queries ───────────────────────────────────────────────────

export interface UserQuery {
  q?: string;
  search?: string;
  page?: number;
  pageNumber?: number;
  pageSize?: number;
  branchId?: string | null;
  isActive?: boolean | null;
}

export interface EmployeeSearchQuery {
  branchId?: string | null;
  q?: string;
  search?: string;
  unlinkedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface StockLocationQuery {
  branchId?: string | null;
  isActive?: boolean | null;
  page?: number;
  pageSize?: number;
}

// ── Hook state shapes ─────────────────────────────────────────────────────────

export interface RoleAssignment {
  roleId: string;
  branchId?: string | null;
}

export type EffectivePermissionsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; rolePermissionKeys: string[] }
  | { status: "error"; message: string };