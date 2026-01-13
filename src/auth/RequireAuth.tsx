import React, { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { safeReturnUrl } from "./returnUrl";

type Props = {
  children: React.ReactNode;

  /** routes that should NOT be redirected to login (public pages) */
  allow?: (pathname: string) => boolean;

  /** optional: render while auth initializes */
  fallback?: React.ReactNode;
};

function buildLoginUrl(returnTo: string) {
  return `/login?returnUrl=${encodeURIComponent(returnTo)}`;
}

/**
 * RequireAuth
 * - Waits for auth initialization (isReady)
 * - If unauthenticated, redirects to /login?returnUrl=...
 * - Prevents /login nesting and StrictMode double nav
 */
export default function RequireAuth({
  children,
  allow,
  fallback = null,
}: Props) {
  const { isReady, isAuthenticated } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  // Don’t redirect from auth pages themselves (prevents loops)
  const isAuthPage =
    loc.pathname.startsWith("/login") ||
    loc.pathname.startsWith("/register") ||
    loc.pathname.startsWith("/forgot-password") ||
    loc.pathname.startsWith("/reset-password");

  const allowed = allow?.(loc.pathname) ?? false;

  const returnTo = useMemo(() => {
    const current = loc.pathname + loc.search;
    return safeReturnUrl(current, "/dashboard");
  }, [loc.pathname, loc.search]);

  const redirected = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    if (redirected.current) return;

    // Allow public pages + auth pages
    if (allowed || isAuthPage) return;

    if (!isAuthenticated) {
      redirected.current = true;
      nav(buildLoginUrl(returnTo), { replace: true });
    }
  }, [isReady, isAuthenticated, allowed, isAuthPage, nav, returnTo]);

  // While auth initializes
  if (!isReady) return <>{fallback}</>;

  // If not authenticated, we’re redirecting (avoid UI flash)
  if (!isAuthenticated && !allowed && !isAuthPage) return null;

  return <>{children}</>;
}
