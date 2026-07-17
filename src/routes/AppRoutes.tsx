// src/routes/AppRoutes.tsx

import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";

import RequireCompany from "../auth/RequireCompany";
import { loadAuth } from "../auth/auth.storage";
import { loadPlatformAuth } from "../auth/platform-auth.storage";
import { loadWorkspaceAuth } from "../auth/workspace-auth.storage";


import AppShell from "../layouts/AppShell";

import LoginPage from "../pages/LoginPage";
import SystemAdminLoginPage from "../pages/system-admin/SystemAdminLoginPage";
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

import type { AppRouteLike } from "./routeDefConfig";
import TelegramMiniAppDashboard from "../features/telegram-miniapp/TelegramMiniAppDashboard";

const COMPANY_ONBOARDING_PATH = "companies/onboarding";
const USER_LOGIN_PATH = "/login";
const SYSTEM_ADMIN_LOGIN_PATH = "/system-admin-login";
const PLATFORM_HOME_PATH = "/platform/tenants";

type AuthLike = {
  accessToken?: string | null;
  companyId?: string | null;
  roles?: string[] | null;
  permissions?: string[] | null;
};

export default function AppRoutes() {
  const grnRoutes = useGrnRoutes();
  const salesRoutes = useSalesRoutes();
  const hrRoutes = getHrRoutes();
  const posRoutes = getPostRoutes();

  const protectedCompanyRoutes = (companyRoutes as AppRouteLike[]).filter(
    (route) => {
      const path = normalizeRoutePath(route.path ?? "");
      return path !== COMPANY_ONBOARDING_PATH && path !== "onboarding";
    }
  );

  const allCompanyRoutes = dedupeRoutes([
    ...(routeConfig as AppRouteLike[]),
    ...(inventoryMasterRoutes as AppRouteLike[]),
    ...protectedCompanyRoutes,
    ...(organizationRoutes as AppRouteLike[]),
    ...(grnRoutes as AppRouteLike[]),
    ...(salesRoutes as AppRouteLike[]),
    ...(hrRoutes as AppRouteLike[]),
    ...(posRoutes as AppRouteLike[]),
  ]);

  return (
    <Routes>
      <Route path={USER_LOGIN_PATH} element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/telegram-miniapp" element={<TelegramMiniAppDashboard />} />
      <Route path={SYSTEM_ADMIN_LOGIN_PATH} element={<SystemAdminLoginPage />} />
      <Route path="/telegram" element={<Navigate to="/telegram-miniapp" replace />} />

      <Route
        path="/platform"
        element={
          <RequirePlatformAdmin>
            <AppShell />
          </RequirePlatformAdmin>
        }
      >
        <Route index element={<Navigate to={PLATFORM_HOME_PATH} replace />} />
        <Route path="tenants" element={<PlatformTenantsPage />} />
      </Route>

      <Route
        path="/system-admin"
        element={
          <RequirePlatformAdmin>
            <AppShell />
          </RequirePlatformAdmin>
        }
      >
        <Route
          index
          element={<Navigate to="/system-admin/companies" replace />}
        />
        <Route path="companies" element={<SystemAdminCompaniesPage />} />
      </Route>

      <Route
        path="/companies/onboarding"
        element={
          <RequireWorkspaceAuth>
            <AppShell />
          </RequireWorkspaceAuth>
        }
      >
        <Route index element={<CompanyOnboardingModule />} />
      </Route>

      <Route
        path="/companies/:companyId/onboarding"
        element={
          <RequireWorkspaceAuth>
            <AppShell />
          </RequireWorkspaceAuth>
        }
      >
        <Route index element={<CompanyOnboardingModule />} />
      </Route>

      <Route
        path="/companies/:companyId/branches/:branchId/onboarding"
        element={
          <RequireWorkspaceAuth>
            <AppShell />
          </RequireWorkspaceAuth>
        }
      >
        <Route index element={<CompanyOnboardingModule />} />
      </Route>

      <Route
        path="/companies/:companyId"
        element={
          <RequireWorkspaceAuth>
            <RequireCompany>
              <AppShell />
            </RequireCompany>
          </RequireWorkspaceAuth>
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

function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const auth = getPlatformAuth();

  if (!auth?.accessToken || !hasSystemAdminRole(auth.roles)) {
    const returnUrl = `${location.pathname}${location.search}${location.hash}`;

    return (
      <Navigate
        to={`${SYSTEM_ADMIN_LOGIN_PATH}?returnUrl=${encodeURIComponent(returnUrl)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}

function RequireWorkspaceAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const auth = getWorkspaceAuth();

  if (!auth?.accessToken) {
    const returnUrl = `${location.pathname}${location.search}${location.hash}`;

    return (
      <Navigate
        to={`${USER_LOGIN_PATH}?returnUrl=${encodeURIComponent(returnUrl)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}

function CompanyDashboardRedirect() {
  const { companyId } = useParams();

  if (!companyId) {
    return <Navigate to={USER_LOGIN_PATH} replace />;
  }

  return <Navigate to={`/companies/${companyId}/dashboard`} replace />;
}

function GlobalRedirect() {
  const platformAuth = getPlatformAuth();

  if (platformAuth?.accessToken && hasSystemAdminRole(platformAuth.roles)) {
    return <Navigate to={PLATFORM_HOME_PATH} replace />;
  }

  const workspaceAuth = getWorkspaceAuth();

  if (workspaceAuth?.accessToken && workspaceAuth.companyId) {
    return (
      <Navigate
        to={`/companies/${workspaceAuth.companyId}/dashboard`}
        replace
      />
    );
  }

  return <Navigate to={USER_LOGIN_PATH} replace />;
}

function RouteGuard({
  route,
  children,
}: {
  route: AppRouteLike;
  children: ReactNode;
}) {
  const auth = getWorkspaceAuth();
  const roles = auth?.roles ?? [];
  const permissions = auth?.permissions ?? [];

  if (!route.permissions?.length && !route.roles?.length) {
    return <>{children}</>;
  }

  // A delegated tenant session may intentionally contain the system-admin role.
  // Keep this behavior for backward compatibility with the existing route model.
  if (hasSystemAdminRole(roles)) {
    return <>{children}</>;
  }

  if (hasCompanyAdminRole(roles) && isSecurityRoute(route)) {
    return <>{children}</>;
  }

  if (route.roles?.length) {
    const allowedByRole = route.roles.some((role) => hasRole(roles, role));

    if (!allowedByRole) {
      return <AccessDenied />;
    }
  }

  if (route.permissions?.length) {
    const allowedByPermission = route.permissions.some((permission) =>
      hasPermission(permissions, permission)
    );

    if (!allowedByPermission) {
      return <AccessDenied />;
    }
  }

  return <>{children}</>;
}

function isSecurityRoute(route: AppRouteLike): boolean {
  const section = String(route.section ?? route.menu?.section ?? "").toLowerCase();
  const path = String(route.path ?? "").toLowerCase();

  return section === "security" || path === "users" || path.startsWith("security/");
}

function AccessDenied() {
  const { companyId } = useParams();

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>Access denied</h2>
      <p style={{ marginTop: 8, color: "#64748b" }}>
        You do not have permission to access this page.
      </p>

      {companyId ? (
        <a href={`/companies/${companyId}/dashboard`}>Go to dashboard</a>
      ) : (
        <a href={USER_LOGIN_PATH}>Go to login</a>
      )}
    </div>
  );
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
        <a href={USER_LOGIN_PATH}>Go to login</a>
      )}
    </div>
  );
}

function GlobalRouteNotFound() {
  const platformAuth = getPlatformAuth();
  const workspaceAuth = getWorkspaceAuth();

  const fallback =
    platformAuth?.accessToken && hasSystemAdminRole(platformAuth.roles)
      ? PLATFORM_HOME_PATH
      : workspaceAuth?.companyId
        ? `/companies/${workspaceAuth.companyId}/dashboard`
        : USER_LOGIN_PATH;

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

function getPlatformAuth(): AuthLike | null {
  const platformAuth = loadPlatformAuth();

  if (platformAuth?.accessToken) {
    return platformAuth;
  }

  // Migration fallback: keep existing system-admin sessions working until the
  // system-admin login has fully moved to platform-auth.storage.
  const legacyAuth = loadAuth();

  if (legacyAuth?.accessToken && hasSystemAdminRole(legacyAuth.roles)) {
    return legacyAuth;
  }

  return null;
}

function getWorkspaceAuth(): AuthLike | null {
  const workspaceAuth = loadWorkspaceAuth();

  if (workspaceAuth?.accessToken) {
    return workspaceAuth;
  }

  // Migration fallback: preserve the existing user-login flow while it still
  // writes to auth.storage. Never expose a legacy system-admin session here.
  const legacyAuth = loadAuth();

  if (legacyAuth?.accessToken && !hasSystemAdminRole(legacyAuth.roles)) {
    return legacyAuth;
  }

  return null;
}

function renderRoutes(
  routes: readonly AppRouteLike[],
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
          element={
            <RouteGuard route={route}>
              {route.element as ReactNode}
            </RouteGuard>
          }
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
        element={
          <RouteGuard route={route}>
            {route.element as ReactNode}
          </RouteGuard>
        }
      >
        {Array.isArray(route.children)
          ? renderRoutes(
              route.children as AppRouteLike[],
              namespace,
              path,
              depth + 1
            )
          : null}
      </Route>
    );
  });
}

function dedupeRoutes(routes: readonly AppRouteLike[]): AppRouteLike[] {
  const seen = new Set<string>();
  const result: AppRouteLike[] = [];

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
  route: AppRouteLike,
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

function hasCompanyAdminRole(roles?: string[] | null): boolean {
  return (roles ?? []).some((role) => {
    const normalized = role.trim().toUpperCase();
    return normalized === "COMPANYADMIN";
  });
}

function hasRole(
  roles: string[] | null | undefined,
  requiredRole: string
): boolean {
  const required = requiredRole.trim().toUpperCase();

  return (roles ?? []).some(
    (role) => role.trim().toUpperCase() === required
  );
}

function hasPermission(
  permissions: string[] | null | undefined,
  requiredPermission: string
): boolean {
  const required = requiredPermission.trim().toLowerCase();

  return (permissions ?? []).some(
    (permission) => permission.trim().toLowerCase() === required
  );
}
