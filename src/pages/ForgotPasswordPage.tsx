// src/pages/auth/ForgotPasswordPage.tsx

import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi, ApiError } from "../auth/auth.api";
import "../styles/modules.identity.css";

function IconAlert() {
  return (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [sent,  setSent]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed. Please try again.");
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <span className="auth-logo__name">RestaurantFNB</span>
        </div>

        <div className="auth-card">
          {sent ? (
            <div className="auth-success">
              <div className="auth-success__icon">
                <IconCheckCircle />
              </div>
              <p className="auth-success__title">Check your inbox</p>
              <p className="auth-success__sub">
                If <strong style={{ color: "var(--a-text)" }}>{email}</strong> is
                registered, a password reset link is on its way. Check your spam
                folder if it doesn't arrive within a few minutes.
              </p>
              <button
                className="auth-success__action"
                onClick={() => { setSent(false); setEmail(""); }}
              >
                Try a different email
              </button>
            </div>
          ) : (
            <>
              <div className="auth-card__head">
                <h1 className="auth-card__title">Forgot password?</h1>
                <p className="auth-card__sub">
                  Enter your email and we'll send you a reset link.
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
                      autoComplete="email" autoFocus required disabled={busy}
                    />
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
                  disabled={busy || !email}
                  aria-busy={busy}
                >
                  {busy ? <><span className="auth-spinner" aria-hidden="true" />Sending…</> : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="auth-footer">
          Remembered it? <Link to="/login">Back to sign in</Link>
        </p>

      </div>
    </div>
  );
}