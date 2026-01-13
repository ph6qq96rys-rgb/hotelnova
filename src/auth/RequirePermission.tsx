import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useAppScope } from "../app/useAppScope";

type Props = {
  permission: string;
  children: ReactNode;
  /** Optional: keep for development; default false in prod */
  devAllAccess?: boolean;
};

export default function RequirePermission({
  permission,
  children,
  devAllAccess = true
}: Props) {
  const { isAuthenticated, hasPermission } = useAuth();
  const { companyId, branchId } = useAppScope();
  const loc = useLocation();

  // ✅ DEV MODE: show everything (use sparingly)
  if (devAllAccess) return <>{children}</>;

  // Not logged in → go login (preserve returnUrl)
  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  // Logged in but not allowed → forbidden
  const ok = hasPermission(permission, companyId, branchId);
  if (!ok) {
    return <Navigate to="/forbidden" replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}
