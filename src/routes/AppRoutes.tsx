import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";

import LoginPage           from "../pages/LoginPage";
import RegisterPage        from "../pages/RegisterPage";
import ForgotPasswordPage  from "../pages/ForgotPasswordPage";
import ResetPasswordPage   from "../pages/ResetPasswordPage";

import RequireAuth    from "../auth/RequireAuth";
import RequireCompany from "../auth/RequireCompany";
import AppShell       from "../layouts/AppShell";

import { routeConfig }            from "./routeConfig";
import { companyRoutes } from "./companyRoutes";
import { useGrnRoutes }     from "./grnroutes";
import { useSalesRoutes }         from "./sales-cogsroute";
import { getHrRoutes } from "./hrRoutes";

// Import AppRoute from the canonical definition so the type is consistent
// everywhere — AppRoute uses Omit<RouteObject, "children"> which allows
// index: true without conflicting with NonIndexRouteObject's index: false.
import type { AppRoute } from "./sales-cogsroute";

import { userManagementRoutes }   from "./userManagementRoutes";
import { authRoutes }             from "./authRoutes";
import { inventoryMasterRoutes }  from "./inventoryMasterRoutes";

export default function AppRoutes() {
  const grnRoutes = useGrnRoutes();
  const salesRoutes     = useSalesRoutes();
  const hrRoute         = getHrRoutes();

  return (
    <Routes>
      {/* ── Public ──────────────────────────────────────────────────────── */}
      <Route path="/login"           element={<LoginPage />} />
      <Route path="/register"        element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />

      {/* ── Protected ───────────────────────────────────────────────────── */}
      <Route
        element={
          <RequireAuth>
            <RequireCompany>
              <AppShell />
            </RequireCompany>
          </RequireAuth>
        }
      >
        {renderRoutes(routeConfig           as AppRoute[])}
        {renderRoutes(companyRoutes         as AppRoute[])}
        {renderRoutes(grnRoutes)}
        {renderRoutes(salesRoutes)}
        {renderRoutes(authRoutes            as AppRoute[])}
        {renderRoutes(inventoryMasterRoutes as AppRoute[])}
        {renderRoutes(userManagementRoutes  as AppRoute[])}
        {renderRoutes(hrRoute)}
      </Route>

      {/* ── Fallback ────────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

// ── renderRoutes ──────────────────────────────────────────────────────────────
// Accepts AppRoute[] (not RouteObject[]) so index: true is valid.
// RouteObject's discriminated union types index as false | undefined on
// NonIndexRouteObject, which conflicts with AppRoute's index?: boolean.

function renderRoutes(routes: AppRoute[]): ReactNode {
  return routes.map((r, i) => {
    const key = r.path ?? `route-${i}`;

    if (r.index === true) {
      return <Route key={key} index element={r.element as ReactNode} />;
    }

    const path = r.path ? stripLeadingSlash(r.path) : undefined;

    return (
      <Route key={key} path={path} element={r.element as ReactNode}>
        {Array.isArray(r.children) ? renderRoutes(r.children) : null}
      </Route>
    );
  });
}

function stripLeadingSlash(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}