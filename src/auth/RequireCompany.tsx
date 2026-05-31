// src/auth/RequireCompany.tsx
//
// Guards routes that require a company context to be selected.
// Place this inside <RequireAuth> in your route tree:
//
//   <RequireAuth>
//     <RequireCompany>
//       <AppLayout />
//     </RequireCompany>
//   </RequireAuth>
//
// ── What was wrong in the original ─────────────────────────────────────────
// 1. `useAppScope() as any` cast was used because the hook's TypeScript type
//    didn't include `isReady`. Typed properly; falls back to true if the hook
//    doesn't provide it.
//
// 2. Same stale `redirected` ref bug as RequireAuth — removed.

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useAppScope } from "../app/useAppScope";
import { safeReturnUrl } from "./returnUrl";

const AUTH_PATHS     = ["/login", "/register", "/forgot-password", "/reset-password"];
const DEFAULT_ALLOW  = (p: string) => p.startsWith("/setup") || p.startsWith("/onboarding");

interface Props {
  children:   ReactNode;
  /** Return true for paths that don't require a company (e.g. /setup). */
  allow?:     (pathname: string) => boolean;
  /** Where to send the user if no company is selected (default: /setup/company). */
  setupPath?: string;
  /** Shown while auth or scope is hydrating. */
  fallback?:  ReactNode;
}

export default function RequireCompany({
  children,
  allow,
  setupPath = "/setup/company",
  fallback  = null,
}: Props) {
  const { isReady: authReady, isAuthenticated } = useAuth();
  const scope    = useAppScope();
  const companyId = scope?.companyId ?? null;
  // If the scope hook doesn't surface `isReady`, treat it as always ready.
  const scopeReady: boolean = (scope as any)?.isReady ?? true;

  const nav = useNavigate();
  const loc = useLocation();

  const isAuthPage  = AUTH_PATHS.some((p) => loc.pathname.startsWith(p));
  const isAllowed   = (allow ?? DEFAULT_ALLOW)(loc.pathname);
  const bothReady   = authReady && scopeReady;

  useEffect(() => {
    if (!bothReady)       return;
    if (isAuthPage)       return;
    if (!isAuthenticated) return; // RequireAuth handles unauthenticated redirect
    if (isAllowed)        return;
    if (companyId)        return;

    const returnTo = safeReturnUrl(loc.pathname + loc.search, "/dashboard");
    nav(`${setupPath}?returnUrl=${encodeURIComponent(returnTo)}`, { replace: true });
  }, [bothReady, isAuthenticated, companyId, isAllowed, isAuthPage, nav, setupPath, loc.pathname, loc.search]);

  if (!bothReady)                              return <>{fallback}</>;
  if (!isAuthenticated)                        return null; // RequireAuth will redirect
  if (!companyId && !isAllowed && !isAuthPage) return null; // redirect pending

  return <>{children}</>;
}