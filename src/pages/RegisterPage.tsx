// src/pages/auth/RegisterPage.tsx

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError } from "../auth/auth.api";
import "../styles/modules.identity.css";

function scorePassword(pwd: string): 0 | 1 | 2 | 3 | 4 {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

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

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
const [tenantId, setTenantId] = useState(localStorage.getItem("tenantId") ?? "");
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const strength  = useMemo(() => scorePassword(password), [password]);
  const canSubmit = fullName.trim().length >= 2 && !!email && password.length >= 6;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      localStorage.setItem("tenantId", tenantId.trim().toLowerCase());
      await register({ fullName, email, password });
      nav("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box">

        <div className="auth-logo">
          <div className="auth-logo__icon" aria-hidden="true">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <span className="auth-logo__name">RestaurantFNB</span>
        </div>

        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-card__title">Create account</h1>
            <p className="auth-card__sub">Get started with your workspace.</p>
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
              </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="fullName">Full name</label>
              <div className="auth-input-wrap">
                <input
                  id="fullName" type="text" className="auth-input"
                  value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  autoComplete="name" autoFocus required disabled={busy}
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="email">Email address</label>
              <div className="auth-input-wrap">
                <input
                  id="email" type="email" className="auth-input"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@restaurant.com"
                  autoComplete="email" required disabled={busy}
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="password">Password</label>
              <div className="auth-input-wrap">
                <input
                  id="password" type={showPwd ? "text" : "password"} className="auth-input"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password" required minLength={6} disabled={busy}
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
              {password.length > 0 && (
                <div className="auth-strength">
                  <div className="auth-strength__bars">
                    {[1,2,3,4].map(n => (
                      <div
                        key={n}
                        className={`auth-strength__bar${strength >= n ? ` auth-strength__bar--${strength}` : ""}`}
                      />
                    ))}
                  </div>
                  <span className="auth-strength__label">{STRENGTH_LABELS[strength]}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="auth-error" role="alert" aria-live="polite">
                <IconAlert />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit" className="auth-btn"
              disabled={!canSubmit || busy}
              aria-busy={busy}
            >
              {busy ? <><span className="auth-spinner" aria-hidden="true" />Creating account…</> : "Create account"}
            </button>

          </form>
        </div>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>

      </div>
    </div>
  );
}