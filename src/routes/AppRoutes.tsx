import { Routes, Route, Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import type { ReactNode } from "react";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";

import RequireAuth from "../auth/RequireAuth";
import RequireCompany from "../auth/RequireCompany";
import AppShell from "../layouts/AppShell";

import { routeConfig } from "./routeConfig";
import { companyRoutes, BranchRoutes } from "./companyRoutes";
import { grnRoutes } from "./grnroutes";



export default function AppRoutes() {
  return (
    <Routes>
      {/* ================= PUBLIC ================= */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ================= PROTECTED ================= */}
      <Route
        element={
          <RequireAuth>
            <RequireCompany>
              <AppShell />
            </RequireCompany>
          </RequireAuth>
        }
      >
        {renderRoutes(routeConfig)}
        {renderRoutes(companyRoutes)}
        {renderRoutes(BranchRoutes)}
        {renderRoutes(grnRoutes)}
      </Route>

      {/* ================= FALLBACK ================= */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** ✅ Render RouteObject / AppRoute trees (supports children + index routes) */
function renderRoutes(routes: Array<RouteObject & { path?: string; element?: ReactNode }>) {
  return routes.map((r, i) => {
    const key = r.path ?? `index-${i}`;

    // index route
    if ((r as any).index) {
      return (
        <Route
          key={key}
          index
          element={r.element as ReactNode}
        />
      );
    }

    // normal route (path required for non-index)
    const path = r.path ? stripLeadingSlash(r.path) : undefined;

    return (
      <Route
        key={key}
        path={path}
        element={r.element as ReactNode}
      >
        {Array.isArray((r as any).children) ? renderRoutes((r as any).children) : null}
      </Route>
    );
  });
}

function stripLeadingSlash(path: string) {
  return path.startsWith("/") ? path.slice(1) : path;
}
