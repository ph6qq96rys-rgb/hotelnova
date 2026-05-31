// src/modules/security/types/security.types.ts
//
// Single source of truth for all security module types.
// Nothing in this file has side effects — safe to import anywhere.

// ── Enums ─────────────────────────────────────────────────────────────────────

export type UserStatus = "Active" | "Pending" | "Suspended";

// ── Role DTOs ─────────────────────────────────────────────────────────────────

export interface RoleDto {
  id:           string;
  name:         string;
  userCount:    number;
  isSystem:     boolean;
  description?: string | null;
}

export interface RoleDetailDto {
  role:           RoleDto;
  permissionKeys: string[];
  users:          UserLiteDto[];
}

// ── Permission DTOs ───────────────────────────────────────────────────────────

export interface PermissionCatalogItem {
  key:          string;
  group:        string;
  description:  string;
}

// ── User DTOs ─────────────────────────────────────────────────────────────────

export interface UserLiteDto {
  id:       string;
  email:    string;
  fullName?: string | null;
}

export interface UserRowDto {
  id:       string;
  email:    string;
  fullName: string;
  status:   UserStatus;
}

export interface UserAssignmentDto {
  id:              string;
  roleId:          string;
  roleName:        string;
  branchId:        string | null;
  branchName:      string | null;
  permissionCount: number;
}

export interface UserDetailDto {
  id:          string;
  email:       string;
  fullName:    string;
  status:      UserStatus;
  assignments: UserAssignmentDto[];
}

// ── Branch DTOs ───────────────────────────────────────────────────────────────

export interface BranchLite {
  id:   string;
  name: string;
}

// ── Request shapes ────────────────────────────────────────────────────────────

export interface CreateRoleRequest {
  name:         string;
  description?: string | null;
}

export interface UpdateRoleRequest {
  name:         string;
  description?: string | null;
}

export interface AddAssignmentRequest {
  userId:    string;
  roleId:    string;
  branchId?: string | null;
}

export interface RemoveAssignmentRequest {
  userId:       string;
  assignmentId: string;
}

export interface SetPermissionsRequest {
  userId:         string;
  permissionKeys: string[];
}

export interface SetRolesRequest {
  userId:    string;
  roleNames: string[];
}

// ── Hook state shapes ─────────────────────────────────────────────────────────

export interface RoleAssignment {
  roleId:    string;
  branchId?: string | null;
}

export type EffectivePermissionsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; rolePermissionKeys: string[] }
  | { status: "error";  message: string };