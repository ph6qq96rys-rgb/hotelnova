// src/routes/AppRoutes.tsx

import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import RequireAuth from "../auth/RequireAuth";
import RequireCompany from "../auth/RequireCompany";
import AppShell from "../layouts/AppShell";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";

import CompanyOnboardingModule from "../features/company/onboarding/CompanyOnboardingModule";
import SystemAdminCompaniesPage from "../features/company/onboarding/SystemAdmin/pages/SystemAdminCompaniesPage";
import PlatformTenantsPage from "../pages/platform/PlatformTenantsPage";

import { routeConfig } from "./routeConfig";
import { companyRoutes } from "./companyRoutes";
import { useGrnRoutes } from "./grnroutes";
import { useSalesRoutes } from "./sales-cogsroute";
import { getHrRoutes } from "./hrRoutes";
import { getPostRoutes } from "./posRoutes";

import type { AppRoute } from "./sales-cogsroute";

const COMPANY_ONBOARDING_PATH = "companies/onboarding";

export default function AppRoutes() {
  const grnRoutes = useGrnRoutes();
  const salesRoutes = useSalesRoutes();
  const hrRoutes = getHrRoutes();
  const posRoutes = getPostRoutes();

  const protectedCompanyRoutes = companyRoutes.filter(
    (route) =>
      normalizeRoutePath(route.path ?? "") !== COMPANY_ONBOARDING_PATH
  ) as AppRoute[];

  return (
    <Routes>
      {/* Public auth routes — must stay before protected wildcard */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Platform routes — authenticated, but not company-scoped */}
      <Route
        path="/platform"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="tenants" replace />} />
        <Route path="tenants" element={<PlatformTenantsPage />} />
      </Route>

      {/* System-admin routes — authenticated, but not company-scoped */}
      <Route
        path="/system-admin"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="companies" replace />} />
        <Route path="companies" element={<SystemAdminCompaniesPage />} />
      </Route>

      {/* Company onboarding — authenticated, but company may not exist yet */}
      <Route
        path="/companies/onboarding"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<CompanyOnboardingModule />} />
      </Route>

      {/* Main ERP workspace — authenticated and company-scoped */}
      <Route
        path="/*"
        element={
          <RequireAuth>
            <RequireCompany>
              <AppShell />
            </RequireCompany>
          </RequireAuth>
        }
      >
        {renderRoutes(routeConfig as AppRoute[], "routeConfig")}
        {renderRoutes(protectedCompanyRoutes, "companyRoutes")}
        {renderRoutes(grnRoutes, "grnRoutes")}
        {renderRoutes(salesRoutes, "salesRoutes")}
        {renderRoutes(hrRoutes as AppRoute[], "hrRoutes")}
        {renderRoutes(posRoutes as AppRoute[], "posRoutes")}

        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function renderRoutes(
  routes: AppRoute[],
  namespace: string,
  parentPath = "",
  depth = 0
): ReactNode {
  return routes.map((route, index) => {
    const routeKey = buildRouteKey(
      route,
      namespace,
      parentPath,
      depth,
      index
    );

    if (route.index === true) {
      return (
        <Route
          key={routeKey}
          index
          element={route.element as ReactNode}
        />
      );
    }

    if (!route.path) return null;

    const path = normalizeRoutePath(route.path);

    return (
      <Route
        key={routeKey}
        path={path}
        element={route.element as ReactNode}
      >
        {Array.isArray(route.children)
          ? renderRoutes(route.children, namespace, path, depth + 1)
          : null}
      </Route>
    );
  });
}

function normalizeRoutePath(path: string): string {
  return path.replace(/^\/+/, "");
}

function buildRouteKey(
  route: AppRoute,
  namespace: string,
  parentPath: string,
  depth: number,
  index: number
): string {
  const segment = route.path ?? (route.index ? "index" : "slot");

  return [
    namespace,
    parentPath || "root",
    segment,
    `d${depth}`,
    `i${index}`,
  ].join("__");
}