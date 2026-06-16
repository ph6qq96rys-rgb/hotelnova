// src/auth/RequireAuth.tsx

import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

interface RequireAuthProps {
  children?: ReactNode;
  fallback?: ReactNode;
}

const AUTH_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export default function RequireAuth({
  children,
  fallback = null,
}: RequireAuthProps) {
  const { isReady, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return <>{fallback}</>;
  }

  if (isAuthenticated) {
    return children ? <>{children}</> : <Outlet />;
  }

  const isAuthRoute = AUTH_ROUTES.some((route) =>
    location.pathname.startsWith(route)
  );

  if (isAuthRoute) {
    return children ? <>{children}</> : <Outlet />;
  }

  const returnUrl = encodeURIComponent(
    location.pathname + location.search
  );

  return (
    <Navigate
      replace
      to={`/login?returnUrl=${returnUrl}`}
      state={{ from: location }}
    />
  );
}