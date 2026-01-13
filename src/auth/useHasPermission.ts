/*import { useMemo } from "react";
import { useAuth } from "./useAuth";

/**
 * Returns all permissions for the current user
 */
/*export function usePermissions(): string[] {
  const { permissions } = useAuth();
  return useMemo(() => permissions ?? [], [permissions]);
}

/**
 * Checks if the user has a specific permission
 */
/*export function useHasPermission(permission: string): boolean {
  const { permissions } = useAuth();

  return useMemo(
    () => permissions?.includes(permission) ?? false,
    [permissions, permission]
  );
}
export function useHasAnyPermission(perms: string[]): boolean {
  const { permissions } = useAuth();
  return useMemo(
    () => perms.some(p => permissions?.includes(p)),
    [perms, permissions]
  );
}

export function useHasAllPermissions(perms: string[]): boolean {
  const { permissions } = useAuth();
  return useMemo(
    () => perms.every(p => permissions?.includes(p)),
    [perms, permissions]
  );
}
*/