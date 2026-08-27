// src/auth/RequireErpRole.tsx

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppContext } from "../app/AppContext";
import { hasAnyErpRole } from "./erpAccess";
import { useAuth } from "./AuthProvider";

type Props = {
  roles: string[];
  children: ReactNode;
  fallbackPath?: string;
};

function collectRoles(app: any): string[] {
  const user =
    app?.user ??
    app?.currentUser ??
    app?.authUser ??
    app?.auth?.user ??
    app?.state?.user ??
    null;

  const sources = [
    app?.roles,
    app?.userRoles,
    app?.auth?.roles,
    app?.claims?.roles,
    user?.roles,
    user?.roleNames,
    user?.role,
    user?.roleName,
    user?.claims,
    localStorage.getItem("roles"),
    localStorage.getItem("userRoles"),
  ];

  const result: string[] = [];

  for (const source of sources) {
    if (!source) continue;

    if (typeof source === "string") {
      try {
        const parsed = JSON.parse(source);
        if (Array.isArray(parsed)) {
          result.push(...parsed.map(String));
        } else {
          result.push(source);
        }
      } catch {
        result.push(source);
      }

      continue;
    }

    if (Array.isArray(source)) {
      for (const item of source) {
        if (typeof item === "string") {
          result.push(item);
        } else if (item && typeof item === "object") {
          result.push(
            String(
              item.name ??
                item.roleName ??
                item.role ??
                item.value ??
                item.type ??
                "",
            ),
          );
        }
      }
    }
  }

  return result.map((x) => x.trim()).filter(Boolean);
}

export default function RequireErpRole({
  roles,
  children,
  fallbackPath = "/companies",
}: Props) {
  const app = useAppContext() as any;
  const auth = useAuth();
  const location = useLocation();

  const userRoles = [
    ...collectRoles(app),
    ...(auth.roles ?? []),
    ...(auth.user?.roles ?? []),
  ];

  const hasRole = hasAnyErpRole({ roles: userRoles }, roles);

  if (!hasRole) {
    console.warn("RequireErpRole denied", {
      required: roles,
      actual: userRoles,
      path: location.pathname,
    });

    return (
      <Navigate
        to={fallbackPath}
        replace
        state={{ from: location }}
      />
    );
  }

  return <>{children}</>;
}
