// src/auth/Can.tsx

import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";

type PermissionMode = "all" | "any";

interface CanProps {
  permission?: string;
  permissions?: string[];
  mode?: PermissionMode;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ permission, permissions, mode = "all", children, fallback = null }: CanProps) {
  const { isAuthenticated, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  if (!isAuthenticated) return <>{fallback}</>;

  const required = permissions ?? (permission ? [permission] : []);
  if (required.length === 0) return <>{children}</>;

  const allowed = mode === "any" ? hasAnyPermission(required) : hasAllPermissions(required);
  return allowed ? <>{children}</> : <>{fallback}</>;
}
