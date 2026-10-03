import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { LanguageSelector } from "../components/LanguageSelector";
import { useI18n } from "../i18n";
import { ApiError } from "../auth/auth.api";
import type { AuthState } from "../auth/auth.types";
import { canAccessRoute, hasSystemAdminRole } from "../auth/erpAccess";
import { safeReturnUrl } from "../auth/returnUrl";
import { companyRoutes } from "../routes/companyRoutes";
import { useGrnRoutes } from "../routes/grnroutes";
import { getHrRoutes } from "../routes/hrRoutes";
import { inventoryMasterRoutes } from "../routes/inventoryMasterRoutes";
import { organizationRoutes } from "../routes/organizationRoutes";
import { getPostRoutes } from "../routes/posRoutes";
import { procurementRoutes } from "../routes/procurementRoutes";
import { routeConfig } from "../routes/routeConfig";
import { useSalesRoutes } from "../routes/sales-cogsroute";
import type { AppRouteLike } from "../routes/routeDefConfig";

import "../styles/modules.identity.css";

interface LocationState {
  from?: string | { pathname: string };
}

type RouteAccessCandidate = Pick<AppRouteLike, "path" | "roles" | "permissions">;

const PLATFORM_TENANTS_PATH = "/platform/tenants";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function clearTenantStorage(): void {
  localStorage.removeItem("tenantSlug");
  localStorage.removeItem("tenantId");
  localStorage.removeItem("companyId");
  localStorage.removeItem("branchId");

  sessionStorage.removeItem("tenantSlug");
  sessionStorage.removeItem("tenantId");
  sessionStorage.removeItem("companyId");
  sessionStorage.removeItem("branchId");
}

function getCompanyDashboardPath(auth: AuthState | null): string {
  return auth?.companyId ? `/companies/${auth.companyId}/dashboard` : "/";
}

function getPostLoginTarget(
  auth: AuthState | null,
  redirectTo: string,
  routes: readonly RouteAccessCandidate[]
): string {
  if (hasSystemAdminRole(auth?.roles)) {
    return PLATFORM_TENANTS_PATH;
  }

  const dashboardPath = getCompanyDashboardPath(auth);
  const safeRedirect = safeReturnUrl(redirectTo, dashboardPath);

  if (isAuthorizedCompanyRedirect(auth, safeRedirect, routes)) {
    return safeRedirect;
  }

  return dashboardPath;
}

function isAuthorizedCompanyRedirect(
  auth: AuthState | null,
  redirectTo: string,
  routes: readonly RouteAccessCandidate[]
): boolean {
  if (!auth?.companyId) return false;

  const companyRoot = `/companies/${auth.companyId}`;

  if (redirectTo === companyRoot || redirectTo === `${companyRoot}/dashboard`) {
    return true;
  }

  if (!redirectTo.startsWith(`${companyRoot}/`)) {
    return false;
  }

  const urlPath = redirectTo.split(/[?#]/, 1)[0] ?? redirectTo;
  const childPath = normalizeCompanyChildPath(urlPath, auth.companyId);

  if (!childPath || childPath === "dashboard") {
    return true;
  }

  const matchedRoute = routes.find((route) => routeMatchesPath(route.path, childPath));

  if (!matchedRoute) {
    return false;
  }

  return canAccessRoute(
    { roles: auth.roles ?? [], permissions: auth.permissions ?? [] },
    matchedRoute
  );
}

function normalizeCompanyChildPath(path: string, companyId: string): string {
  return path
    .replace(new RegExp(`^/companies/${escapeRegExp(companyId)}/?`), "")
    .replace(/^\/+|\/+$/g, "");
}

function routeMatchesPath(routePath: string | undefined, actualPath: string): boolean {
  if (!routePath) return false;

  const cleanRoute = routePath
    .replace(/^\/+|\/+$/g, "")
    .replace(/^companies\/:[^/]+\/?/, "")
    .replace(/^companies\/[^/]+\/?/, "");

  if (!cleanRoute) return !actualPath;

  const routeParts = cleanRoute.split("/");
  const actualParts = actualPath.split("/");

  if (routeParts.length !== actualParts.length) return false;

  return routeParts.every((part, index) => part.startsWith(":") || part === actualParts[index]);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function IconGrid() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18M3 9h18M3 15h18M9 15v6M15 15v6" />
    </svg>
  );
}

function IconEye({ off }: { off?: boolean }) {
  return off ? (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

export default function LoginPage() {
  const { auth, login, isAuthenticated, isReady } = useAuth();
  const { t } = useI18n();
  const grnRoutes = useGrnRoutes();
  const salesRoutes = useSalesRoutes();
  const hrRoutes = getHrRoutes();
  const posRoutes = getPostRoutes();

  const nav = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(() => localStorage.getItem("lastLoginEmail") ?? "");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const routeAccessCandidates = useMemo<RouteAccessCandidate[]>(
    () => [
      ...(routeConfig as AppRouteLike[]),
      ...(companyRoutes as AppRouteLike[]),
      ...(inventoryMasterRoutes as AppRouteLike[]),
      ...(organizationRoutes as AppRouteLike[]),
      ...(procurementRoutes as AppRouteLike[]),
      ...(grnRoutes as AppRouteLike[]),
      ...(salesRoutes as AppRouteLike[]),
      ...(hrRoutes as AppRouteLike[]),
      ...(posRoutes as AppRouteLike[]),
    ],
    [grnRoutes, salesRoutes, hrRoutes, posRoutes]
  );

  const redirectTo = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const raw = sp.get("returnUrl");

    const state = location.state as LocationState | null;
    const from = state?.from;
    const fromPath = typeof from === "string" ? from : from?.pathname;

    return safeReturnUrl(raw ?? fromPath, "/");
  }, [location.search, location.state]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;

    nav(getPostLoginTarget(auth, redirectTo, routeAccessCandidates), {
      replace: true,
    });
  }, [auth, isAuthenticated, isReady, nav, redirectTo, routeAccessCandidates]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (busy) return;

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      setError(t("login.required"));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      clearTenantStorage();
      localStorage.setItem("lastLoginEmail", normalizedEmail);

      const nextAuth = await login(
        {
          email: normalizedEmail,
          password,
        },
        remember
      );

      nav(getPostLoginTarget(nextAuth, redirectTo, routeAccessCandidates), {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("login.failed"));
      setBusy(false);
    }
  }

  if (!isReady) return null;

  if (isAuthenticated) {
    return (
      <div className="auth-page">
        <p className="auth-redirecting">{t("login.redirecting")}</p>
      </div>
    );
  }

  const canSubmit = Boolean(email.trim()) && Boolean(password) && !busy;

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo-row">
          <div className="auth-logo">
            <div className="auth-logo__icon" aria-hidden="true">
              <IconGrid />
            </div>
            <span className="auth-logo__name">{t("app.name")}</span>
          </div>
          <LanguageSelector />
        </div>

        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-card__title">{t("login.title")}</h1>
            <p className="auth-card__sub">
              {t("login.subtitle")}
            </p>
          </div>

          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="email">
                {t("login.email")}
              </label>

              <div className="auth-input-wrap">
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@restaurant.com"
                  autoComplete="email"
                  autoFocus
                  required
                  disabled={busy}
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-field__row">
                <label className="auth-label" htmlFor="password">
                  {t("login.password")}
                </label>

                <Link to="/forgot-password" className="auth-link" tabIndex={busy ? -1 : 0}>
                  {t("login.forgotPassword")}
                </Link>
              </div>

              <div className="auth-input-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPwd ? "text" : "password"}
                  className="auth-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("login.passwordPlaceholder")}
                  autoComplete="current-password"
                  required
                  disabled={busy}
                />

                <button
                  type="button"
                  className="auth-input__toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? t("login.hidePassword") : t("login.showPassword")}
                  tabIndex={-1}
                  disabled={busy}
                >
                  <IconEye off={showPwd} />
                </button>
              </div>
            </div>

            <div className="auth-remember">
              <input
                type="checkbox"
                id="remember"
                className="auth-checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={busy}
              />

              <label htmlFor="remember" className="auth-remember__label">
                {t("login.remember")}
              </label>
            </div>

            {error && (
              <div className="auth-error" role="alert" aria-live="polite">
                <IconAlert />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="auth-btn" disabled={!canSubmit} aria-busy={busy}>
              {busy ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  {t("login.signingIn")}
                </>
              ) : (
                t("login.submit")
              )}
            </button>
          </form>

          <div className="auth-divider" style={{ margin: "20px 0 16px" }} />

          <p className="auth-security-note">
            {t("login.protected")}
            <br />
            {t("login.workspaceAfterSignIn")}
          </p>
        </div>

        <p className="auth-footer">{t("login.needAccess")}</p>

        <div className="auth-trust">
          <span className="auth-trust__item">{t("login.encrypted")}</span>
          <span className="auth-trust__sep" />
          <span className="auth-trust__item">{t("login.secureSession")}</span>
          <span className="auth-trust__sep" />
          <span className="auth-trust__item">{t("login.isolatedData")}</span>
        </div>
      </div>
    </div>
  );
}