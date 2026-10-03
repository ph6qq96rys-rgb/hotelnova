import type { AppRouteLike } from "../routes/routeDefConfig";

const SYSTEM_ADMIN_ROLES = new Set(["SYSTEMADMIN", "SYSADMIN"]);
const COMPANY_ADMIN_ROLES = new Set([
  "COMPANYADMIN",
  "COMPANYADMINISTRATOR",
]);

const COMPANY_ADMIN_RESTRICTED_PERMISSIONS = new Set(
  [
    "companies.delete",
    "hr.attendance.corrections.request",
    "hr.attendance.corrections.approve",
    "grn.post",
    "siv.post",
    "inventory.adjustments.post",
    "stockcounts.post",
    "stocktransfers.post",
    "production.post",
    "pos.sell",
    "pos.void",
    "pos.close",
    "sales.import",
  ].map(normalizePermission)
);

// The API only grants CompanyAdmin its setup permissions (PermissionCatalog.CompanyAdminPermissions);
// procurement and payables require explicitly assigned roles, so the UI must not assume them either.
const COMPANY_ADMIN_RESTRICTED_PREFIXES = ["purchasing.", "suppliers.", "fixedassets.", "finance.payables."];

export type AccessIdentity = {
  roles?: string[] | null;
  permissions?: string[] | null;
};

export function normalizeRole(role: string): string {
  return role.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizePermission(permission: string): string {
  return permission.trim().toLowerCase();
}

export function hasSystemAdminRole(roles?: string[] | null): boolean {
  return (roles ?? []).some((role) =>
    SYSTEM_ADMIN_ROLES.has(normalizeRole(role))
  );
}

export function hasCompanyAdminRole(roles?: string[] | null): boolean {
  return (roles ?? []).some((role) =>
    COMPANY_ADMIN_ROLES.has(normalizeRole(role))
  );
}

export function hasErpPermission(
  identity: AccessIdentity,
  permission: string
): boolean {
  const required = normalizePermission(permission);

  if (!required) return false;
  if (hasSystemAdminRole(identity.roles)) return true;

  const hasAssignedPermission = (identity.permissions ?? []).some(
    (candidate) => normalizePermission(candidate) === required
  );

  if (hasAssignedPermission) return true;

  if (hasCompanyAdminRole(identity.roles)) {
    return !COMPANY_ADMIN_RESTRICTED_PERMISSIONS.has(required)
      && !COMPANY_ADMIN_RESTRICTED_PREFIXES.some((prefix) => required.startsWith(prefix));
  }

  return false;
}

export function hasAnyErpPermission(
  identity: AccessIdentity,
  permissions?: string[] | null
): boolean {
  const required = permissions ?? [];

  if (required.length === 0) return true;

  return required.some((permission) =>
    hasErpPermission(identity, permission)
  );
}

export function hasAllErpPermissions(
  identity: AccessIdentity,
  permissions?: string[] | null
): boolean {
  const required = permissions ?? [];

  if (required.length === 0) return true;

  return required.every((permission) =>
    hasErpPermission(identity, permission)
  );
}

export function hasAnyErpRole(
  identity: AccessIdentity,
  roles?: string[] | null
): boolean {
  const required = roles ?? [];

  if (required.length === 0) return true;
  if (hasSystemAdminRole(identity.roles)) return true;
  if (
    required.some((role) => COMPANY_ADMIN_ROLES.has(normalizeRole(role))) &&
    hasCompanyAdminRole(identity.roles)
  ) {
    return true;
  }

  const actual = new Set((identity.roles ?? []).map(normalizeRole));

  return required.some((role) => actual.has(normalizeRole(role)));
}

export function canAccessRoute(
  identity: AccessIdentity,
  route: Pick<AppRouteLike, "roles" | "permissions">
): boolean {
  if (hasSystemAdminRole(identity.roles)) return true;

  const requiresRole = (route.roles ?? []).length > 0;
  const requiresPermission = (route.permissions ?? []).length > 0;

  if (!requiresRole && !requiresPermission) return true;

  const roleAllowed = requiresRole && hasAnyErpRole(identity, route.roles);
  const permissionAllowed =
    requiresPermission && hasAnyErpPermission(identity, route.permissions);

  return roleAllowed || permissionAllowed;
}
