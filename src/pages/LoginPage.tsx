// src/pages/auth/LoginPage.tsx

import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError } from "../auth/auth.api";
import { safeReturnUrl } from "../auth/returnUrl";
import "../styles/modules.identity.css"

interface LocationState {
  from?: string | { pathname: string };
}

type LoginMode = "workspace" | "platform";

const SYSTEM_ADMIN_EMAIL = "systemadmin@restaurantfnb.local";
const PLATFORM_TENANTS_PATH = "/platform/tenants";

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

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeTenantSlug(value: string): string {
  return value.trim().toLowerCase();
}

function clearTenantStorage(): void {
  localStorage.removeItem("tenantSlug");
  localStorage.removeItem("tenantId");
  sessionStorage.removeItem("tenantSlug");
  sessionStorage.removeItem("tenantId");
}

function getInitialTenantSlug(search: string): string {
  const sp = new URLSearchParams(search);

  return (
    sp.get("tenantSlug") ||
    sp.get("tenant") ||
    localStorage.getItem("tenantSlug") ||
    import.meta.env.VITE_TENANT_SLUG ||
    ""
  )
    .trim()
    .toLowerCase();
}

function getInitialLoginMode(): LoginMode {
  const lastEmail = localStorage.getItem("lastLoginEmail");

  return lastEmail?.toLowerCase() === SYSTEM_ADMIN_EMAIL
    ? "platform"
    : "workspace";
}

export default function LoginPage() {
  const { login, isAuthenticated, isReady } = useAuth();

  const nav = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<LoginMode>(() => getInitialLoginMode());
  const [tenantSlug, setTenantSlug] = useState(() =>
    getInitialLoginMode() === "platform" ? "" : getInitialTenantSlug(location.search)
  );

  const [email, setEmail] = useState(() =>
    localStorage.getItem("lastLoginEmail") ?? ""
  );

  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const raw = sp.get("returnUrl");

    const state = location.state as LocationState | null;
    const from = state?.from;
    const fromPath = typeof from === "string" ? from : from?.pathname;

    return safeReturnUrl(raw ?? fromPath, PLATFORM_TENANTS_PATH);
  }, [location.search, location.state]);

  function switchMode(nextMode: LoginMode) {
    if (busy) return;

    setMode(nextMode);
    setError(null);

    if (nextMode === "platform") {
      setTenantSlug("");
      clearTenantStorage();
      return;
    }

    setTenantSlug(getInitialTenantSlug(location.search));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (busy) return;

    const normalizedEmail = normalizeEmail(email);
    const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);

    if (!normalizedEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    if (mode === "workspace" && !normalizedTenantSlug) {
      setError("Workspace / tenant is required.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      localStorage.setItem("lastLoginEmail", normalizedEmail);

      if (mode === "workspace") {
        localStorage.setItem("tenantSlug", normalizedTenantSlug);
        localStorage.removeItem("tenantId");
      } else {
        clearTenantStorage();
      }

      await login(
        {
          tenantSlug: mode === "workspace" ? normalizedTenantSlug : null,
          email: normalizedEmail,
          password,
        },
        remember
      );

      const target =
        mode === "platform"
          ? PLATFORM_TENANTS_PATH
          : redirectTo;

      nav(target, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed.");
      setBusy(false);
    }
  }

  if (!isReady) return null;

  if (isAuthenticated) {
    return (
      <div className="auth-page">
        <p className="auth-redirecting">Redirecting…</p>
      </div>
    );
  }

  const canSubmit =
    Boolean(email.trim()) &&
    Boolean(password) &&
    (mode === "platform" || Boolean(normalizeTenantSlug(tenantSlug))) &&
    !busy;

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <div className="auth-logo__icon" aria-hidden="true">
            <IconGrid />
          </div>
          <span className="auth-logo__name">RestaurantFNB</span>
        </div>

        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-card__title">Sign in</h1>
            <p className="auth-card__sub">
              {mode === "workspace"
                ? "Enter your workspace credentials."
                : "Enter your platform administrator credentials."}
            </p>
          </div>

          <div className="auth-mode-switch" role="tablist" aria-label="Login mode">
            <button
              type="button"
              className={`auth-mode-switch__btn ${mode === "workspace" ? "is-active" : ""}`}
              onClick={() => switchMode("workspace")}
              disabled={busy}
            >
              Workspace Login
            </button>

            <button
              type="button"
              className={`auth-mode-switch__btn ${mode === "platform" ? "is-active" : ""}`}
              onClick={() => switchMode("platform")}
              disabled={busy}
            >
              Platform Admin
            </button>
          </div>

          <form className="auth-form" onSubmit={onSubmit} noValidate>
            {mode === "workspace" && (
              <div className="auth-field">
                <label className="auth-label" htmlFor="tenantSlug">
                  Workspace / Tenant
                </label>

                <div className="auth-input-wrap">
                  <input
                    id="tenantSlug"
                    name="tenantSlug"
                    type="text"
                    className="auth-input"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    onBlur={(e) => setTenantSlug(normalizeTenantSlug(e.target.value))}
                    placeholder="ambassador"
                    autoComplete="organization"
                    required
                    disabled={busy}
                  />
                </div>

                <small className="auth-help">
                  Example: ambassador, dako, kizen
                </small>
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label" htmlFor="email">
                Email address
              </label>

              <div className="auth-input-wrap">
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    mode === "platform"
                      ? SYSTEM_ADMIN_EMAIL
                      : "you@restaurant.com"
                  }
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
                  Password
                </label>

                <Link
                  to="/forgot-password"
                  className="auth-link"
                  tabIndex={busy ? -1 : 0}
                >
                  Forgot password?
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
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                />

                <button
                  type="button"
                  className="auth-input__toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
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
                Remember me for 30 days
              </label>
            </div>

            {error && (
              <div className="auth-error" role="alert" aria-live="polite">
                <IconAlert />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="auth-btn"
              disabled={!canSubmit}
              aria-busy={busy}
            >
              {busy ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="auth-divider" style={{ margin: "20px 0 16px" }} />

          <p className="auth-security-note">
            {mode === "workspace" ? (
              <>
                Protected by tenant-scoped authentication.
                <br />
                Your session is isolated to your workspace.
              </>
            ) : (
              <>
                Protected by platform administrator authentication.
                <br />
                Platform access is isolated from tenant workspaces.
              </>
            )}
          </p>
        </div>

        <p className="auth-footer">
          {mode === "workspace"
            ? "Need access? Contact your company administrator."
            : "Platform access is restricted to authorized system administrators."}
        </p>

        <div className="auth-trust">
          <span className="auth-trust__item">Encrypted</span>
          <span className="auth-trust__sep" />
          <span className="auth-trust__item">Secure session</span>
          <span className="auth-trust__sep" />
          <span className="auth-trust__item">Isolated data</span>
        </div>
      </div>
    </div>
  );
}