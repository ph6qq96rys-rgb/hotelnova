// src/auth/useHasPermission.ts
//
// Reactive permission hooks for use inside React components.
//
// ── What was wrong in the original ─────────────────────────────────────────
// The entire file was commented out. Uncommented, typed, and wired to the
// real useAuth() hook from AuthProvider.

import { useMemo } from "react";
import { useAuth } from "./AuthProvider";

/** Returns all permission keys for the authenticated user. */
export function usePermissions(): string[] {
  const { permissions } = useAuth();
  return useMemo(() => permissions ?? [], [permissions]);
}

/** True if the user has the given permission key. */
export function useHasPermission(permission: string): boolean {
  const { permissions } = useAuth();
  return useMemo(() => permissions.includes(permission), [permissions, permission]);
}

/** True if the user has at least one of the listed permissions. */
export function useHasAnyPermission(perms: string[]): boolean {
  const { permissions } = useAuth();
  return useMemo(
    () => perms.some((p) => permissions.includes(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissions, perms.join(",")]
  );
}

/** True if the user has every listed permission. */
export function useHasAllPermissions(perms: string[]): boolean {
  const { permissions } = useAuth();
  return useMemo(
    () => perms.every((p) => permissions.includes(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissions, perms.join(",")]
  );
}