// src/modules/security/utils/security.utils.ts
//
// Pure security utility functions.
// No React. No side effects. Fully testable.

import type {
  PermissionCatalogItem,
  UserAssignmentDto,
  UserDetailDto,
  UserRowDto,
} from "../types/security.types";

export type PermissionGroup<TPermission = PermissionCatalogItem> = {
  group: string;
  items: TPermission[];
};

export function normalize(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeRole(value?: string | null): string {
  return (value ?? "").trim().toUpperCase();
}

export function normalizePermission(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

export function toTitleCase(value: string): string {
  return value
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function groupLabel(group?: string | null): string {
  const normalized = normalize(group);
  return normalized ? toTitleCase(normalized) : "General";
}

export function uniqSorted(list: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      list
        .filter(Boolean)
        .map(String)
        .map((x) => x.trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function roleValueFromUnknown(role: unknown): string {
  if (typeof role === "string") {
    return normalizeRole(role);
  }

  const r = role as any;

  return normalizeRole(
    r?.value ??
      r?.normalizedName ??
      r?.name ??
      ""
  );
}

function roleDisplayNameFromUnknown(role: unknown): string {
  if (typeof role === "string") {
    return role;
  }

  const r = role as any;

  return String(
    r?.displayName ??
      r?.name ??
      r?.value ??
      r?.normalizedName ??
      ""
  ).trim();
}

export function getUserRoles(user: unknown): string[] {
  const source = user as any;

  const roles = source?.roles ?? [];
  const roleNames = source?.roleNames ?? [];

  return [
    ...new Set(
      [...(Array.isArray(roles) ? roles : []), ...(Array.isArray(roleNames) ? roleNames : [])]
        .map(roleValueFromUnknown)
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function getUserRoleLabels(user: unknown): string[] {
  const source = user as any;

  const roles = source?.roles ?? [];
  if (!Array.isArray(roles)) return [];

  return [
    ...new Set(
      roles
        .map(roleDisplayNameFromUnknown)
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function hasUserRole(user: unknown, roleName: string): boolean {
  const required = normalizeRole(roleName);

  return getUserRoles(user).some((role) => normalizeRole(role) === required);
}

export function isSystemAdminUser(user: unknown): boolean {
  return hasUserRole(user, "SYSTEMADMIN") || hasUserRole(user, "SYSADMIN");
}

export function isCompanyAdminUser(user: unknown): boolean {
  return hasUserRole(user, "COMPANYADMIN");
}

export function hasAnyPermission(
  permissions: Array<string | null | undefined> | undefined,
  required: string[]
): boolean {
  const set = new Set(
    (permissions ?? [])
      .filter(Boolean)
      .map(String)
      .map(normalizePermission)
  );

  return required.some((permission) => set.has(normalizePermission(permission)));
}

export function userDisplayName(
  user?: {
    fullName?: string | null;
    userName?: string | null;
    email?: string | null;
    id?: string | null;
    employee?: {
      fullName?: string | null;
    } | null;
  } | null
): string {
  return (
    user?.fullName?.trim() ||
    user?.employee?.fullName?.trim() ||
    user?.userName?.trim() ||
    user?.email?.trim() ||
    user?.id?.trim() ||
    "Unknown"
  );
}

export function userInitials(
  user?: {
    fullName?: string | null;
    userName?: string | null;
    email?: string | null;
    employee?: {
      fullName?: string | null;
    } | null;
  } | null
): string {
  const value =
    user?.fullName?.trim() ||
    user?.employee?.fullName?.trim() ||
    user?.userName?.trim() ||
    user?.email?.trim() ||
    "";

  const parts = value
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2);

  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function groupPermissions<TPermission extends PermissionCatalogItem>(
  permissions: TPermission[]
): PermissionGroup<TPermission>[] {
  const map = new Map<string, TPermission[]>();

  for (const permission of permissions) {
    const group = groupLabel(
      permission.group || permission.category || "General"
    );

    map.set(group, [...(map.get(group) ?? []), permission]);
  }

  return [...map.entries()]
    .map(([group, items]) => ({
      group,
      items: [...items].sort((a, b) =>
        (a.name || a.key).localeCompare(b.name || b.key)
      ),
    }))
    .sort((a, b) => a.group.localeCompare(b.group));
}

export function isPermissionsDirty(
  originalKeys: string[],
  stagedKeys: string[]
): boolean {
  const a = uniqSorted(originalKeys);
  const b = uniqSorted(stagedKeys);

  if (a.length !== b.length) return true;

  return a.some((key, index) => key !== b[index]);
}

export function toUserRow(value: unknown): UserRowDto {
  const source = value as Record<string, unknown>;

  const isActive =
    typeof source?.isActive === "boolean"
      ? source.isActive
      : String(source?.status ?? "Active").toLowerCase() === "active";

  return {
    id: String(source?.id ?? ""),
    email: String(source?.email ?? ""),
    fullName: String(
      source?.fullName ??
        source?.userName ??
        (source as any)?.employee?.fullName ??
        ""
    ),
    status: isActive ? "Active" : "Inactive",

    // Keep normalized role values available to tables/actions.
    roles: getUserRoles(source),
    roleNames: getUserRoles(source),
    roleLabels: getUserRoleLabels(source),
  } as UserRowDto;
}

export function toUserDetail(value: unknown): UserDetailDto {
  const source = value as Record<string, unknown>;

  const assignments: UserAssignmentDto[] = Array.isArray(source?.assignments)
    ? source.assignments.map((item: unknown) => {
        const assignment = item as Record<string, unknown>;

        return {
          id: String(assignment?.id ?? ""),
          roleId: String(assignment?.roleId ?? ""),
          roleName: String(assignment?.roleName ?? ""),
          branchId: assignment?.branchId ? String(assignment.branchId) : null,
          branchName: assignment?.branchName
            ? String(assignment.branchName)
            : null,
          permissionCount: Number(assignment?.permissionCount ?? 0),
        };
      })
    : [];

  const isActive =
    typeof source?.isActive === "boolean"
      ? source.isActive
      : String(source?.status ?? "Active").toLowerCase() === "active";

  return {
    id: String(source?.id ?? ""),
    email: String(source?.email ?? ""),
    fullName: String(
      source?.fullName ??
        source?.userName ??
        (source as any)?.employee?.fullName ??
        ""
    ),
    userName: source?.userName ? String(source.userName) : null,
    status: isActive ? "Active" : "Inactive",
    isActive,

    // Important:
    // roles/roleNames are normalized backend values only.
    // Never use displayName here.
    roles: getUserRoles(source),
    roleNames: getUserRoles(source),
    roleLabels: getUserRoleLabels(source),

    assignments,
  } as UserDetailDto;
}

export function extractSecurityError(
  error: unknown,
  fallback = "An unexpected error occurred."
): string {
  const err = error as any;
  const data = err?.response?.data;

  if (typeof data === "string") return data;

  if (Array.isArray(data?.errors)) {
    return data.errors.join("; ");
  }

  if (data?.errors && typeof data.errors === "object") {
    return Object.values(data.errors).flat().join("; ");
  }

  return (
    data?.message ??
    data?.title ??
    data?.error ??
    err?.message ??
    fallback
  );
}

export function isCancelled(error: unknown): boolean {
  const err = error as any;

  return (
    err?.name === "AbortError" ||
    err?.name === "CanceledError" ||
    err?.code === "ERR_CANCELED"
  );
}