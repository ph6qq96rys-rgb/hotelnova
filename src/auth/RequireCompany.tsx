// src/auth/RequireCompany.tsx

import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { loadWorkspaceAuth } from "./workspace-auth.storage";
import { safeReturnUrl } from "./returnUrl";

interface RequireCompanyProps {
  children?: ReactNode;
  setupPath?: string;
  platformPath?: string;
  allow?: (pathname: string) => boolean;
  fallback?: ReactNode;
}

const SYSTEM_ADMIN_ROLES = ["SystemAdmin", "SysAdmin"];

const DEFAULT_ALLOW = (path: string) =>
  path.startsWith("/setup") ||
  path.startsWith("/onboarding") ||
  path.startsWith("/companies/onboarding") ||
  path.startsWith("/platform") ||
  path.startsWith("/system-admin");

function hasSystemAdminRole(roles?: string[]): boolean {
  return (roles ?? []).some((role) =>
    SYSTEM_ADMIN_ROLES.some(
      (adminRole) => adminRole.toLowerCase() === role.toLowerCase()
    )
  );
}

export default function RequireCompany({
  children,
  setupPath = "/companies/onboarding",
  platformPath = "/platform/tenants",
  allow = DEFAULT_ALLOW,
  fallback = null,
}: RequireCompanyProps) {
  const { isReady, isAuthenticated, companyId, user, roles } = useAuth();
  const location = useLocation();
  const workspaceAuth = loadWorkspaceAuth();
  const effectiveCompanyId = companyId ?? workspaceAuth?.companyId ?? null;
  const effectiveRoles = [
    ...(roles ?? []),
    ...(user?.roles ?? []),
    ...(workspaceAuth?.roles ?? []),
  ];

  if (!isReady) return <>{fallback}</>;

  if (!isAuthenticated && !workspaceAuth?.accessToken) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  const pathname = location.pathname;
  const isSystemAdmin = hasSystemAdminRole(effectiveRoles);

  if (allow(pathname)) {
    return children ? <>{children}</> : <Outlet />;
  }

  if (effectiveCompanyId) {
    return children ? <>{children}</> : <Outlet />;
  }
  

  if (isSystemAdmin) {
    const returnUrl = encodeURIComponent(
      safeReturnUrl(pathname + location.search, "/dashboard")
    );

    return (
      <Navigate
        to={`${platformPath}?returnUrl=${returnUrl}`}
        replace
      />
    );
  }

  const returnUrl = encodeURIComponent(
    safeReturnUrl(pathname + location.search, "/dashboard")
  );

  return <Navigate to={`${setupPath}?returnUrl=${returnUrl}`} replace />;
}
