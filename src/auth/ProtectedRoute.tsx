// src/auth/ProtectedRoute.tsx
//
// Route wrapper that redirects unauthenticated users to /login.
// Preserves the attempted path as returnUrl.
//
// ── What was wrong in the original ─────────────────────────────────────────
// Checked `isLoading` as the loading gate, but isLoading is only true while
// a login/register call is in flight — not during initial auth hydration.
// The correct gate is `!isReady`, which is false until the stored auth state
// has been read. Fixed.

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute() {
  const { isAuthenticated, isReady } = useAuth();
  const location = useLocation();

  // Wait for auth to hydrate from storage before deciding.
  if (!isReady) return null;

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return (
      <Navigate
        to={`/login?returnUrl=${returnUrl}`}
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
}