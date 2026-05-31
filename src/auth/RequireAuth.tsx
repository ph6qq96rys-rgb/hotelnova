// src/auth/RequireAuth.tsx
//
// Wrapper component that protects subtrees from unauthenticated access.
// Prefer <ProtectedRoute> for route-level guards in React Router v6.
// Use RequireAuth for non-route cases (e.g. conditionally rendering a modal).
//
// ── What was wrong in the original ─────────────────────────────────────────
// 1. Used a `redirected` ref to prevent double navigation in StrictMode, but
//    the ref was never reset when the user navigated away and back. On the
//    second visit to a protected page after logout, the ref was true and the
//    redirect never fired — leaving the user on a blank page. Fixed: removed
//    the ref; React Router's `replace` navigation is idempotent.
//
// 2. The `returnTo` useMemo included `loc.pathname + loc.search` which
//    would re-compute on every render. Simplified to compute inline.

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { safeReturnUrl } from "./returnUrl";

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

interface Props {
  children:  ReactNode;
  /** Return true for paths that are public (no redirect needed). */
  allow?:    (pathname: string) => boolean;
  /** Shown while auth is hydrating. */
  fallback?: ReactNode;
}

export default function RequireAuth({ children, allow, fallback = null }: Props) {
  const { isReady, isAuthenticated } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const isAuthPage = AUTH_PATHS.some((p) => loc.pathname.startsWith(p));
  const isAllowed  = allow?.(loc.pathname) ?? false;
  const needsAuth  = !isAuthPage && !isAllowed;

  useEffect(() => {
    if (!isReady)         return;
    if (!needsAuth)       return;
    if (isAuthenticated)  return;

    const returnTo  = safeReturnUrl(loc.pathname + loc.search, "/dashboard");
    nav(`/login?returnUrl=${encodeURIComponent(returnTo)}`, { replace: true });
  }, [isReady, isAuthenticated, needsAuth, nav, loc.pathname, loc.search]);

  if (!isReady) return <>{fallback}</>;

  // Prevent flash while redirect is pending.
  if (!isAuthenticated && needsAuth) return null;

  return <>{children}</>;
}