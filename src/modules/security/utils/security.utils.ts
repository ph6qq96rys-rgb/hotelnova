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
  return [...new Set(list.filter(Boolean).map(String))]
    .sort((a, b) => a.localeCompare(b));
}

export function userDisplayName(
  user?: {
    fullName?: string | null;
    userName?: string | null;
    email?: string | null;
    id?: string | null;
  } | null
): string {
  return (
    user?.fullName?.trim() ||
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
  } | null
): string {
  const value =
    user?.fullName?.trim() ||
    user?.userName?.trim() ||
    user?.email?.trim() ||
    "";

  const parts = value
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2);

  return (
    ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? ""))
      .toUpperCase()
  );
}

export function groupPermissions<TPermission extends PermissionCatalogItem>(
  permissions: TPermission[]
): PermissionGroup<TPermission>[] {
  const map = new Map<string, TPermission[]>();

  for (const permission of permissions) {
    const group = groupLabel(
      permission.group ||
        (permission as any).category ||
        "General"
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

  return {
    id: String(source?.id ?? ""),
    email: String(source?.email ?? ""),
    fullName: String(source?.fullName ?? source?.userName ?? ""),
    status: (source?.status ?? "Active") as UserRowDto["status"],
  };
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
          branchId: assignment?.branchId
            ? String(assignment.branchId)
            : null,
          branchName: assignment?.branchName
            ? String(assignment.branchName)
            : null,
          permissionCount: Number(assignment?.permissionCount ?? 0),
        };
      })
    : [];

  return {
    id: String(source?.id ?? ""),
    email: String(source?.email ?? ""),
    fullName: String(source?.fullName ?? source?.userName ?? ""),
    status: (source?.status ?? "Active") as UserDetailDto["status"],
    assignments,
  };
}

export function extractSecurityError(
  error: unknown,
  fallback = "An unexpected error occurred."
): string {
  const err = error as any;

  return (
    err?.response?.data?.message ??
    err?.response?.data?.title ??
    err?.response?.data?.error ??
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