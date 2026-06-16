// src/auth/RequirePermission.tsx

import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

type PermissionMode = "all" | "any";

interface RequirePermissionProps {
  permission?: string;
  permissions?: string[];
  mode?: PermissionMode;
  children?: ReactNode;
  forbiddenPath?: string;
  allowSystemAdmin?: boolean;
}

const SYSTEM_ADMIN_ROLES = ["SystemAdmin", "SysAdmin"];

function hasSystemAdminRole(roles?: string[]): boolean {
  return (roles ?? []).some((role) =>
    SYSTEM_ADMIN_ROLES.some(
      (adminRole) => adminRole.toLowerCase() === role.toLowerCase()
    )
  );
}

export default function RequirePermission({
  permission,
  permissions,
  mode = "all",
  children,
  forbiddenPath = "/forbidden",
  allowSystemAdmin = true,
}: RequirePermissionProps) {
  const {
    isReady,
    isAuthenticated,
    roles,
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  } = useAuth();

  const location = useLocation();

  if (!isReady) return null;

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(
      location.pathname + location.search
    );

    return (
      <Navigate
        to={`/login?returnUrl=${returnUrl}`}
        replace
      />
    );
  }

  const isSystemAdmin =
    hasSystemAdminRole(user?.roles) ||
    hasSystemAdminRole(roles);

  if (allowSystemAdmin && isSystemAdmin) {
    return children ? <>{children}</> : <Outlet />;
  }

  const required =
    permissions ??
    (permission ? [permission] : []);

  const allowed =
    required.length === 0 ||
    (mode === "any"
      ? hasAnyPermission(required)
      : required.length === 1
        ? hasPermission(required[0])
        : hasAllPermissions(required));

  if (!allowed) {
    return (
      <Navigate
        to={forbiddenPath}
        replace
        state={{
          from: location,
          required,
        }}
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
}