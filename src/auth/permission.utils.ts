// src/auth/permission.utils.ts
// Single source of truth for permission normalization and checks.

export type PermissionInput = string | null | undefined;

export function normalizePermission(permission: PermissionInput): string {
  return String(permission ?? "").trim().toUpperCase();
}

export function normalizePermissions(permissions: unknown): string[] {
  if (!permissions) return [];

  const raw = Array.isArray(permissions) ? permissions : [permissions];

  return [...new Set(
    raw
      .flatMap((x) => String(x ?? "").split(/[;,]/))
      .map(normalizePermission)
      .filter(Boolean)
  )].sort();
}

export function createPermissionSet(permissions: readonly string[]): ReadonlySet<string> {
  return new Set(permissions.map(normalizePermission).filter(Boolean));
}

export function hasPermission(permissions: readonly string[], permission: PermissionInput): boolean {
  const key = normalizePermission(permission);
  if (!key) return false;
  return createPermissionSet(permissions).has(key);
}

export function hasAnyPermission(permissions: readonly string[], required: readonly string[]): boolean {
  const set = createPermissionSet(permissions);
  return required.map(normalizePermission).some((x) => x && set.has(x));
}

export function hasAllPermissions(permissions: readonly string[], required: readonly string[]): boolean {
  const set = createPermissionSet(permissions);
  return required.map(normalizePermission).every((x) => x && set.has(x));
}
