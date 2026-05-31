// src/pages/auth/LoginPage.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError } from "../auth/auth.api";
import { safeReturnUrl } from "../auth/returnUrl";
import "./security.css";

interface LocationState {
  from?: string | { pathname: string };
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
  const { login, isAuthenticated, isReady } = useAuth();
  const nav      = useNavigate();
  const location = useLocation();
  const [tenantId, setTenantId] = useState(localStorage.getItem("tenantId") ?? "");

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    const sp      = new URLSearchParams(location.search);
    const raw     = sp.get("returnUrl");
    const state   = location.state as LocationState | null;
    const from    = state?.from;
    const fromPath = typeof from === "string" ? from : from?.pathname;
    return safeReturnUrl(raw ?? fromPath, "/dashboard");
  }, [location.search, location.state]);

  const redirected = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    if (isAuthenticated && !redirected.current) {
      redirected.current = true;
      nav(redirectTo, { replace: true });
    }
  }, [isReady, isAuthenticated, nav, redirectTo]);

async function onSubmit(e: React.FormEvent) {
  e.preventDefault();

  if (busy) return;

  setBusy(true);
  setError(null);

  try {
    localStorage.setItem(
      "tenantId",
      tenantId.trim().toLowerCase()
    );

    await login(
      {
        email,
        password,
      },
      remember
    );
  } catch (err) {
    setError(
      err instanceof ApiError
        ? err.message
        : "Sign in failed."
    );

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

  return (
    <div className="auth-page">
      <div className="auth-box">

        <div className="auth-logo">
          <div className="auth-logo__icon" aria-hidden="true"><IconGrid /></div>
          <span className="auth-logo__name">RestaurantFNB</span>
        </div>

        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-card__title">Sign in</h1>
            <p className="auth-card__sub">Enter your credentials to access your workspace.</p>
          </div>

          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="tenant">
                Workspace / Tenant
              </label>

              <div className="auth-input-wrap">
                <input
                  id="tenant"
                  type="text"
                  className="auth-input"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="dako"
                  autoComplete="organization"
                  required
                  disabled={busy}
                />
              </div>

              <small className="auth-help">
                Example: dako, ambassador, kizen
              </small>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="email">Email address</label>
              <div className="auth-input-wrap">
                <input
                  id="email" type="email" className="auth-input"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@restaurant.com"
                  autoComplete="email" autoFocus required disabled={busy}
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-field__row">
                <label className="auth-label" htmlFor="password">Password</label>
                <Link to="/forgot-password" className="auth-link" tabIndex={busy ? -1 : 0}>
                  Forgot password?
                </Link>
              </div>
              <div className="auth-input-wrap">
                <input
                  id="password" type={showPwd ? "text" : "password"} className="auth-input"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password" required disabled={busy}
                />
                <button
                  type="button" className="auth-input__toggle"
                  onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  <IconEye off={showPwd} />
                </button>
              </div>
            </div>

            <div className="auth-remember">
              <input
                type="checkbox" id="remember" className="auth-checkbox"
                checked={remember} onChange={e => setRemember(e.target.checked)}
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
              type="submit" className="auth-btn"
              disabled={busy || !email || !password}
              aria-busy={busy}
            >
              {busy ? <><span className="auth-spinner" aria-hidden="true" />Signing in…</> : "Sign in"}
            </button>

          </form>

          <div className="auth-divider" style={{ margin: "20px 0 16px" }} />
          <p className="auth-security-note">
            Protected by tenant-scoped authentication.<br />Your session is isolated to your workspace.
          </p>
        </div>

        <p className="auth-footer">
          Don't have an account?{" "}
          <Link to="/register">Request access</Link>
        </p>

        <div className="auth-trust">
          <span className="auth-trust__item">
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            Encrypted
          </span>
          <span className="auth-trust__sep" />
          <span className="auth-trust__item">
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
            Secure session
          </span>
          <span className="auth-trust__sep" />
          <span className="auth-trust__item">
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
            Isolated data
          </span>
        </div>

      </div>
    </div>
  );
}