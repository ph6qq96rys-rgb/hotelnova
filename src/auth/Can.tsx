// src/auth/Can.tsx
//
// Declarative permission gate for JSX.
// Renders children when the authenticated user has the required permission.
//
// Usage:
//   <Can permission="users.manage">
//     <InviteButton />
//   </Can>
//
//   <Can permission="reports.view" fallback={<p>No access.</p>}>
//     <ReportsPage />
//   </Can>

import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";

interface CanProps {
  /** The permission key to check. */
  permission:  string;
  /** Rendered when the user has the permission. */
  children:    ReactNode;
  /** Rendered when the user lacks the permission (default: nothing). */
  fallback?:   ReactNode;
}

export function Can({ permission, children, fallback = null }: CanProps) {
  const { isAuthenticated, hasPermission } = useAuth();

  if (!isAuthenticated)            return <>{fallback}</>;
  if (!hasPermission(permission))  return <>{fallback}</>;

  return <>{children}</>;
}