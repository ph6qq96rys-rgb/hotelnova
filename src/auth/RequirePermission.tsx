// src/auth/RequirePermission.tsx
//
// Route/component guard that redirects when the user lacks a required permission.
//
// ── What was wrong in the original ─────────────────────────────────────────
// devAllAccess defaulted to TRUE. This means that in any environment where
// the prop was not explicitly passed, every user could access every route —
// a serious security hole that would reach production silently.
// Changed to default to false. Pass devAllAccess={true} explicitly only in
// development/testing environments, never based on a build flag alone.
//
// hasPermission previously took (permission, companyId, branchId) args that
// mapped to a ScopedPermission check. That scope matching was removed from
// AuthProvider (the backend's JWT already reflects the user's scope).
// Call signature updated to just (permission).

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

interface Props {
  /** The permission key required to access the children. */
  permission:    string;
  children:      ReactNode;
  /**
   * Bypass all permission checks.
   * CAUTION: never pass this as true in production code.
   * Default: false.
   */
  devAllAccess?: boolean;
}

export default function RequirePermission({
  permission,
  children,
  devAllAccess = false,
}: Props) {
  const { isAuthenticated, hasPermission } = useAuth();
  const loc = useLocation();

  // Dev bypass — must be explicit. Never defaults to true.
  if (devAllAccess) return <>{children}</>;

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  if (!hasPermission(permission)) {
    return (
      <Navigate
        to="/forbidden"
        replace
        state={{ from: loc.pathname, permission }}
      />
    );
  }

  return <>{children}</>;
}