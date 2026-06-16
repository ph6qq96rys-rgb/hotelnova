// src/auth/usePermissions.ts

import { useMemo } from "react";
import { useAuth } from "./AuthProvider";

export function usePermissions(): string[] {
  return useAuth().permissions;
}

export function useHasPermission(permission: string): boolean {
  const { hasPermission } = useAuth();
  return useMemo(() => hasPermission(permission), [hasPermission, permission]);
}

export function useHasAnyPermission(permissions: string[]): boolean {
  const { hasAnyPermission } = useAuth();
  return useMemo(() => hasAnyPermission(permissions), [hasAnyPermission, permissions.join("|")]);
}

export function useHasAllPermissions(permissions: string[]): boolean {
  const { hasAllPermissions } = useAuth();
  return useMemo(() => hasAllPermissions(permissions), [hasAllPermissions, permissions.join("|")]);
}
