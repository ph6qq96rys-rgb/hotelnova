// src/routes/AppRoutes.tsx

import type { ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import RequireAuth from "../auth/RequireAuth";
import RequireCompany from "../auth/RequireCompany";
import { loadAuth } from "../auth/auth.storage";

import AppShell from "../layouts/AppShell";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import DashboardPage from "../pages/DashboardPage";

import CompanyOnboardingModule from "../features/company/onboarding/CompanyOnboardingModule";
import SystemAdminCompaniesPage from "../features/company/onboarding/SystemAdmin/pages/SystemAdminCompaniesPage";
import PlatformTenantsPage from "../pages/platform/PlatformTenantsPage";

import { routeConfig } from "./routeConfig";
import { companyRoutes } from "./companyRoutes";
import { inventoryMasterRoutes } from "./inventoryMasterRoutes";
import { useGrnRoutes } from "./grnroutes";
import { useSalesRoutes } from "./sales-cogsroute";
import { getHrRoutes } from "./hrRoutes";
import { getPostRoutes } from "./posRoutes";
import { organizationRoutes } from "./organizationRoutes";

import type { AppRoute } from "./sales-cogsroute";

const COMPANY_ONBOARDING_PATH = "companies/onboarding";

export default function AppRoutes() {
  const grnRoutes = useGrnRoutes();
  const salesRoutes = useSalesRoutes();
  const hrRoutes = getHrRoutes();
  const posRoutes = getPostRoutes();

  const protectedCompanyRoutes = companyRoutes.filter((route) => {
    const path = normalizeRoutePath(route.path ?? "");
    return path !== COMPANY_ONBOARDING_PATH && path !== "onboarding";
  }) as AppRoute[];

  const allCompanyRoutes = dedupeRoutes([
    ...(routeConfig as AppRoute[]),
    ...inventoryMasterRoutes,
    ...protectedCompanyRoutes,
    ...organizationRoutes,
    ...grnRoutes,
    ...salesRoutes,
    ...(hrRoutes as AppRoute[]),
    ...(posRoutes as AppRoute[]),
  ]);

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Platform workspace */}
      <Route
        path="/platform"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/platform/tenants" replace />} />
        <Route path="tenants" element={<PlatformTenantsPage />} />
      </Route>

      {/* System admin workspace */}
      <Route
        path="/system-admin"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/system-admin/companies" replace />} />
        <Route path="companies" element={<SystemAdminCompaniesPage />} />
      </Route>

      {/* Onboarding routes */}
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

      <Route
        path="/companies/:companyId/onboarding"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<CompanyOnboardingModule />} />
      </Route>

      <Route
        path="/companies/:companyId/branches/:branchId/onboarding"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<CompanyOnboardingModule />} />
      </Route>

      {/* Tenant company workspace */}
      <Route
        path="/companies/:companyId"
        element={
          <RequireAuth>
            <RequireCompany>
              <AppShell />
            </RequireCompany>
          </RequireAuth>
        }
      >
        <Route index element={<CompanyDashboardRedirect />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {renderRoutes(allCompanyRoutes, "companyWorkspace")}

        <Route path="*" element={<CompanyRouteNotFound />} />
      </Route>

      <Route path="/" element={<GlobalRedirect />} />
      <Route path="*" element={<GlobalRouteNotFound />} />
    </Routes>
  );
}

function CompanyDashboardRedirect() {
  const { companyId } = useParams();

  if (!companyId) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={`/companies/${companyId}/dashboard`} replace />;
}

function GlobalRedirect() {
  const auth = loadAuth();

  if (!auth?.accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (hasSystemAdminRole(auth.roles)) {
    return <Navigate to="/platform/tenants" replace />;
  }

  if (auth.companyId) {
    return <Navigate to={`/companies/${auth.companyId}/dashboard`} replace />;
  }

  return <Navigate to="/login" replace />;
}

function CompanyRouteNotFound() {
  const { companyId } = useParams();

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>Company route not found</h2>
      <p style={{ marginTop: 8, color: "#64748b" }}>
        This page is not registered under the current company workspace.
      </p>

      {companyId ? (
        <a href={`/companies/${companyId}/dashboard`}>Go to dashboard</a>
      ) : (
        <a href="/login">Go to login</a>
      )}
    </div>
  );
}

function GlobalRouteNotFound() {
  const auth = loadAuth();

  const fallback = auth?.companyId
    ? `/companies/${auth.companyId}/dashboard`
    : "/login";

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>Route not found</h2>
      <p style={{ marginTop: 8, color: "#64748b" }}>
        The requested route is outside the registered ERP workspace.
      </p>

      <a href={fallback}>Go back</a>
    </div>
  );
}

function renderRoutes(
  routes: AppRoute[],
  namespace: string,
  parentPath = "",
  depth = 0
): ReactNode {
  return routes.map((route, index) => {
    const routeKey = buildRouteKey(route, namespace, parentPath, depth, index);

    if (route.index === true) {
      return (
        <Route
          key={routeKey}
          index
          element={route.element as ReactNode}
        />
      );
    }

    const path = normalizeCompanyChildPath(route.path);

    if (!path || path === "dashboard") {
      return null;
    }

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

function dedupeRoutes(routes: AppRoute[]): AppRoute[] {
  const seen = new Set<string>();
  const result: AppRoute[] = [];

  for (const route of routes) {
    const key = route.index
      ? "index"
      : normalizeCompanyChildPath(route.path) ?? "";

    if (!key) {
      result.push(route);
      continue;
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(route);
  }

  return result;
}

function normalizeRoutePath(path: string): string {
  return path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

function normalizeCompanyChildPath(path?: string): string | null {
  if (!path) return null;

  let clean = normalizeRoutePath(path);

  clean = clean.replace(/^companies\/:companyId\/?/, "");
  clean = clean.replace(/^companies\/[^/]+\/?/, "");

  if (!clean || clean === "companies") {
    return null;
  }

  return clean;
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

function hasSystemAdminRole(roles?: string[] | null): boolean {
  return (roles ?? []).some((role) => {
    const normalized = role.trim().toUpperCase();
    return normalized === "SYSTEMADMIN" || normalized === "SYSADMIN";
  });
}