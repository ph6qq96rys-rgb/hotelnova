// src/auth/permissions.ts
import { loadAuth } from "./auth.storage";

export function hasPermission(permission: string): boolean {
  const auth = loadAuth();
  return auth?.permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(perms: string[]): boolean {
  const auth = loadAuth();
  const p = auth?.permissions ?? [];
  return perms.some(x => p.includes(x));
}

export function hasAllPermissions(perms: string[]): boolean {
  const auth = loadAuth();
  const p = auth?.permissions ?? [];
  return perms.every(x => p.includes(x));
}
