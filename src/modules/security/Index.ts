// src/modules/security/index.ts
//
// Public API for the security module.
// Import from here, not from individual files.
//
//   import { securityApi, useRoles, useUsers } from "@/modules/security";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  RoleDto, RoleDetailDto, PermissionCatalogItem, UserLiteDto,
  UserRowDto, UserDetailDto, UserAssignmentDto, BranchLite,
  UserStatus, RoleAssignment, EffectivePermissionsState,
  AddAssignmentRequest, RemoveAssignmentRequest,
  CreateRoleRequest, UpdateRoleRequest,
  SetPermissionsRequest, SetRolesRequest,
} from "./types/security.types";

// ── APIs ──────────────────────────────────────────────────────────────────────
export { securityApi, ApiError } from "./api/securityApi";
export { usersApi }              from "./api/usersApi";
export { addUserRoleAssignment, removeUserRoleAssignment } from "./api/userAssignmentsApi";

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useAbortable }                from "./hooks/useAbortable";
export { useBranches }                 from "./hooks/useBranches";
export { useRoles }                    from "./hooks/useRoles";
export { useUsers, useUser }           from "./hooks/useUsers";
export { useUserSearch }               from "./hooks/useUserSearch";
export { useEffectivePermissions }     from "./hooks/useEffectivePermissions";
export { useCompanyIdFromRoute }       from "./hooks/useCompanyIdFromRoute";

// ── Utils ─────────────────────────────────────────────────────────────────────
export {
  normalize, toTitleCase, groupLabel, uniqSorted,
  userDisplayName, userInitials,
  toUserRow, toUserDetail,
  extractSecurityError, isCancelled,
} from "./utils/security.utils";