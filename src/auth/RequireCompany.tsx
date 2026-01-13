import React, { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { safeReturnUrl } from "../auth/returnUrl";

// ✅ Adjust this import to match your project
import { useAppScope } from "../app/useAppScope";

type Props = {
  children: React.ReactNode;

  /**
   * Routes allowed even when company is not selected/configured.
   * Example: onboarding/setup pages
   */
  allow?: (pathname: string) => boolean;

  /** where to send user if companyId missing */
  setupPath?: string;

  /** optional: render while app scope initializes */
  fallback?: React.ReactNode;
};

/**
 * RequireCompany
 * - Requires authenticated user
 * - Requires companyId (from AppProvider scope)
 * - Redirects to setupPath if company missing
 * - Preserves safe returnUrl so after setup user can continue
 */
export default function RequireCompany({
  children,
  allow,
  setupPath = "/setup/company",
  fallback = null,
}: Props) {
  const { isReady, isAuthenticated } = useAuth();
  const { companyId, isReady: isAppReady } = useAppScope() as any; // if your hook has no isReady, set isAppReady=true below
  const nav = useNavigate();
  const loc = useLocation();

  const appReady = typeof isAppReady === "boolean" ? isAppReady : true;

  // never redirect from auth pages
  const isAuthPage =
    loc.pathname.startsWith("/login") ||
    loc.pathname.startsWith("/register") ||
    loc.pathname.startsWith("/forgot-password") ||
    loc.pathname.startsWith("/reset-password");

  // allow setup routes (so you can actually create/select company)
  const defaultAllow = (p: string) =>
    p.startsWith("/setup") || p.startsWith("/onboarding");

  const allowed = (allow ?? defaultAllow)(loc.pathname);

  const returnTo = useMemo(() => {
    const current = loc.pathname + loc.search;
    return safeReturnUrl(current, "/dashboard");
  }, [loc.pathname, loc.search]);

  const redirected = useRef(false);

  useEffect(() => {
    if (!isReady || !appReady) return;
    if (redirected.current) return;

    // Guard should not run on auth pages
    if (isAuthPage) return;

    // If not authenticated, let RequireAuth handle it (or route wrapper order)
    if (!isAuthenticated) return;

    // If company missing AND not on allowed pages -> go to setup
    if (!companyId && !allowed) {
      redirected.current = true;
      nav(`${setupPath}?returnUrl=${encodeURIComponent(returnTo)}`, {
        replace: true,
      });
    }
  }, [
    isReady,
    appReady,
    isAuthenticated,
    companyId,
    allowed,
    isAuthPage,
    nav,
    setupPath,
    returnTo,
  ]);

  if (!isReady || !appReady) return <>{fallback}</>;
  if (!isAuthenticated) return null; // RequireAuth will redirect
  if (!companyId && !allowed && !isAuthPage) return null; // redirecting

  return <>{children}</>;
}
