import { BrandLogo } from "../components/BrandLogo";
// src/pages/ChangePasswordPage.tsx
//
// Shown when the account still uses a password someone else set (the initial company administrator
// password, or one set by an administrator). The API refuses everything else until it is changed.

import { useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../auth/auth.api";
import { useAuth } from "../auth/AuthProvider";
import { safeReturnUrl } from "../auth/returnUrl";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import "../styles/modules.identity.css";

const MIN_LENGTH = 8;

function IconAlert() {
  return (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isReady, isAuthenticated, mustChangePassword, changePassword, logout, auth } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = useMemo(() => {
    if (!newPassword) return null;
    if (newPassword.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`;
    if (newPassword === currentPassword) return "The new password must be different from the current password.";
    if (confirmPassword && confirmPassword !== newPassword) return "The two new passwords do not match.";
    return null;
  }, [newPassword, confirmPassword, currentPassword]);

  const canSubmit =
    !busy &&
    currentPassword.length > 0 &&
    newPassword.length >= MIN_LENGTH &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  if (!isReady) return null;
  if (!isAuthenticated) return <Navigate replace to="/login" />;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    try {
      const signedIn = await changePassword(currentPassword, newPassword);

      if (!signedIn) {
        navigate("/login?passwordChanged=1", { replace: true });
        return;
      }

      const fallback = auth?.companyId ? `/companies/${auth.companyId}/dashboard` : "/";
      navigate(safeReturnUrl(searchParams.get("returnUrl"), fallback), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The password could not be changed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <BrandLogo />
        </div>

        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-card__title">Choose your password</h1>
            <p className="auth-card__sub">
              {mustChangePassword
                ? "Your account was given a temporary password. Choose your own to continue."
                : "Change the password you use to sign in."}
            </p>
          </div>

          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="currentPassword">Current password</label>
              <div className="auth-input-wrap">
                <Input
                  id="currentPassword" type="password" className="auth-input"
                  value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password" required disabled={busy}
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="newPassword">New password</label>
              <div className="auth-input-wrap">
                <Input
                  id="newPassword" type="password" className="auth-input"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={`At least ${MIN_LENGTH} characters`}
                  autoComplete="new-password" required minLength={MIN_LENGTH} disabled={busy}
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="confirmPassword">Confirm new password</label>
              <div className="auth-input-wrap">
                <Input
                  id="confirmPassword" type="password" className="auth-input"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password" required disabled={busy}
                />
              </div>
              {problem && <span className="auth-hint">{problem}</span>}
            </div>

            {error && (
              <div className="auth-error" role="alert" aria-live="polite">
                <IconAlert />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="auth-btn" disabled={!canSubmit} aria-busy={busy}>
              {busy ? <><span className="auth-spinner" aria-hidden="true" />Saving...</> : "Save password"}
            </Button>
          </form>
        </div>

        <div className="auth-footer-row">
          <Button type="button" variant="link" onClick={logout}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}
