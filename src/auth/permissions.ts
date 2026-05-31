// src/auth/permissions.ts
//
// Stateless permission helpers that read from the persisted auth state.
// Use these in non-React code (API interceptors, utility functions, etc.).
// Inside React components use the useAuth() / Can / RequirePermission APIs.
//
// ── What was wrong in the original ─────────────────────────────────────────
// These three functions (hasPermission, hasAnyPermission, hasAllPermissions)
// were defined identically in BOTH this file AND auth.storage.ts.
// auth.storage.ts is responsible for the read/write contract, not business
// logic. The storage version is removed; this file is the canonical location.

import { loadAuth } from "./auth.storage";

/** True if the currently authenticated user has the given permission key. */
export function hasPermission(permission: string): boolean {
  const perms = loadAuth()?.permissions ?? [];
  return perms.includes(permission);
}

/** True if the user has at least one of the listed permissions. */
export function hasAnyPermission(permissions: string[]): boolean {
  const perms = loadAuth()?.permissions ?? [];
  return permissions.some((p) => perms.includes(p));
}

/** True if the user has every listed permission. */
export function hasAllPermissions(permissions: string[]): boolean {
  const perms = loadAuth()?.permissions ?? [];
  return permissions.every((p) => perms.includes(p));
}