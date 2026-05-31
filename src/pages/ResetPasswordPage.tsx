// src/pages/auth/ResetPasswordPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi, ApiError } from "../auth/auth.api";
import "./security.css";

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

export default function ResetPasswordPage() {
  const nav  = useNavigate();
  const [sp] = useSearchParams();

  const [email,       setEmail]       = useState("");
  const [token,       setToken]       = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Auto-fill from link: /reset-password?email=...&token=...
  useEffect(() => {
    const qEmail = sp.get("email") ?? "";
    const qToken = sp.get("token") ?? "";
    if (qEmail) setEmail(qEmail);
    if (qToken) setToken(qToken);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = useMemo(
    () => !!email && !!token && newPassword.length >= 6 && !busy,
    [email, token, newPassword, busy]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword({ email, token, newPassword });
      nav("/login?reset=1", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Password reset failed. Please request a new link.");
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
          <span className="auth-logo__name">RestaurantFNB</span>
        </div>

        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-card__title">Set new password</h1>
            <p className="auth-card__sub">
              Enter the details from your reset email.
            </p>
          </div>

          <form className="auth-form" onSubmit={onSubmit} noValidate>

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
              <label className="auth-label" htmlFor="token">Reset token</label>
              <div className="auth-input-wrap">
                <input
                  id="token" type="text" className="auth-input auth-input--mono"
                  value={token} onChange={e => setToken(e.target.value)}
                  placeholder="Paste token from email"
                  autoComplete="off" required disabled={busy}
                  style={{ paddingRight: 14 }}
                />
              </div>
              <span className="auth-hint">
                If you clicked the link in the email, this field was auto-filled.
              </span>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="newPassword">New password</label>
              <div className="auth-input-wrap">
                <input
                  id="newPassword" type={showPwd ? "text" : "password"} className="auth-input"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
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
            </div>

            {error && (
              <div className="auth-error" role="alert" aria-live="polite">
                <IconAlert />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit" className="auth-btn"
              disabled={!canSubmit}
              aria-busy={busy}
            >
              {busy ? <><span className="auth-spinner" aria-hidden="true" />Resetting…</> : "Reset password"}
            </button>

          </form>
        </div>

        <div className="auth-footer-row">
          <Link to="/forgot-password">← Request new link</Link>
          <Link to="/login">Back to sign in</Link>
        </div>

      </div>
    </div>
  );
}