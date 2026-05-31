// src/modules/security/api/rolesApi.ts
// Legacy re-export shim — keeps old imports working.
// All new code should import from securityApi.ts directly.

export { securityApi, ApiError } from "./securityApi";
export type { RoleDto, RoleDetailDto, PermissionCatalogItem } from "../types/security.types";