// src/pages/auth/SystemAdminLoginPage.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthProvider";
import { ApiError, authApi } from "../../auth/auth.api";
import type { LoginResponse } from "../../auth/auth.types";
import {
  getExpiresAtFromToken,
  getPermissionsFromToken,
  getRolesFromToken,
} from "../../auth/jwt";
import {
  clearPlatformAuth,
  loadPlatformAuth,
  savePlatformAuth,
} from "../../auth/platform-auth.storage";

import "../../styles/modules.identity.css";

const PLATFORM_TENANTS_PATH = "/platform/tenants";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeList(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function extractAccessToken(response: LoginResponse): string | null {
  if (typeof response.accessToken === "string" && response.accessToken.trim()) {
    return response.accessToken.trim();
  }

  if (typeof response.token === "string" && response.token.trim()) {
    return response.token.trim();
  }

  if (response.token && typeof response.token === "object") {
    const tokenObject = response.token;

    return (
      tokenObject.accessToken?.trim() ??
      tokenObject.token?.trim() ??
      null
    );
  }

  return null;
}

function extractRefreshToken(response: LoginResponse): string | null {
  if (
    typeof response.refreshToken === "string" &&
    response.refreshToken.trim()
  ) {
    return response.refreshToken.trim();
  }

  if (response.token && typeof response.token === "object") {
    return response.token.refreshToken?.trim() ?? null;
  }

  return null;
}

function extractExpiresAt(
  response: LoginResponse,
  accessToken: string,
): string | null {
  if (typeof response.expiresAt === "string" && response.expiresAt.trim()) {
    return response.expiresAt.trim();
  }

  if (
    typeof response.expiresAtUtc === "string" &&
    response.expiresAtUtc.trim()
  ) {
    return response.expiresAtUtc.trim();
  }

  if (response.token && typeof response.token === "object") {
    const tokenObject = response.token;

    return (
      tokenObject.expiresAt?.trim() ??
      tokenObject.expiresAtUtc?.trim() ??
      getExpiresAtFromToken(accessToken)
    );
  }

  return getExpiresAtFromToken(accessToken);
}

function hasSystemAdminRole(
  roles: string[] | null | undefined,
): boolean {
  return (roles ?? []).some((role) => {
    const normalized = role.trim().toUpperCase();

    return (
      normalized === "SYSTEMADMIN" ||
      normalized === "SYSADMIN"
    );
  });
}

function IconGrid() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3h18M3 9h18M3 15h18M9 15v6M15 15v6"
      />
    </svg>
  );
}

function IconEye({ off }: { off?: boolean }) {
  return off ? (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  ) : (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        marginTop: 1,
      }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}

export default function SystemAdminLoginPage() {
  const { isReady } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(
    () => localStorage.getItem("lastSystemAdminEmail") ?? "",
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const platformAuth = loadPlatformAuth();

    if (
      platformAuth?.accessToken &&
      hasSystemAdminRole(platformAuth.roles)
    ) {
      setRedirecting(true);
      navigate(PLATFORM_TENANTS_PATH, {
        replace: true,
      });
    }
  }, [isReady, navigate]);

  async function onSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (busy) {
      return;
    }

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    setBusy(true);
    setError(null);
    clearPlatformAuth();

    try {
      localStorage.setItem(
        "lastSystemAdminEmail",
        normalizedEmail,
      );

      const auth = await authApi.platformLogin({
        email: normalizedEmail,
        password,
      });
      const accessToken = extractAccessToken(auth);

      if (!accessToken) {
        throw new ApiError(
          "Administrator login did not return an access token.",
        );
      }

      const roles = normalizeList([
        ...(auth.roles ?? []),
        ...(auth.user?.roles ?? []),
        ...getRolesFromToken(accessToken),
      ]);
      const permissions = normalizeList([
        ...(auth.permissions ?? []),
        ...(auth.user?.permissions ?? []),
        ...getPermissionsFromToken(accessToken),
      ]);

      if (!hasSystemAdminRole(roles)) {
        clearPlatformAuth();

        throw new ApiError(
          "This account is not authorized as a system administrator.",
          403,
        );
      }

      savePlatformAuth(
        {
          accessToken,
          refreshToken: extractRefreshToken(auth),
          expiresAt: extractExpiresAt(auth, accessToken),
          roles,
          permissions,
        },
        remember,
      );

      setRedirecting(true);

      navigate(PLATFORM_TENANTS_PATH, {
        replace: true,
      });
    } catch (error) {
      clearPlatformAuth();

      setError(
        error instanceof ApiError
          ? error.message
          : "Administrator sign in failed.",
      );

      setBusy(false);
    }
  }

  if (!isReady) {
    return null;
  }

  if (redirecting) {
    return (
      <div className="auth-page">
        <p className="auth-redirecting">
          Redirecting...
        </p>
      </div>
    );
  }

  const canSubmit =
    Boolean(email.trim()) &&
    Boolean(password) &&
    !busy;

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <div
            className="auth-logo__icon"
            aria-hidden="true"
          >
            <IconGrid />
          </div>

          <span className="auth-logo__name">
            Hotel Nova Platform
          </span>
        </div>

        <div className="auth-card">
          <div className="auth-card__head">
            <h1 className="auth-card__title">
              System administrator
            </h1>

            <p className="auth-card__sub">
              Sign in to manage platform tenants and system
              settings.
            </p>
          </div>

          <form
            className="auth-form"
            onSubmit={onSubmit}
            noValidate
          >
            <div className="auth-field">
              <label
                className="auth-label"
                htmlFor="adminEmail"
              >
                Administrator email
              </label>

              <div className="auth-input-wrap">
                <input
                  id="adminEmail"
                  name="email"
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="admin@example.com"
                  autoComplete="username"
                  autoFocus
                  required
                  disabled={busy}
                />
              </div>
            </div>

            <div className="auth-field">
              <label
                className="auth-label"
                htmlFor="adminPassword"
              >
                Password
              </label>

              <div className="auth-input-wrap">
                <input
                  id="adminPassword"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  className="auth-input"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="--------"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                />

                <button
                  type="button"
                  className="auth-input__toggle"
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  tabIndex={-1}
                  disabled={busy}
                >
                  <IconEye off={showPassword} />
                </button>
              </div>
            </div>

            <div className="auth-remember">
              <input
                type="checkbox"
                id="adminRemember"
                className="auth-checkbox"
                checked={remember}
                onChange={(event) =>
                  setRemember(event.target.checked)
                }
                disabled={busy}
              />

              <label
                htmlFor="adminRemember"
                className="auth-remember__label"
              >
                Keep this administrator session signed in
              </label>
            </div>

            {error && (
              <div
                className="auth-error"
                role="alert"
                aria-live="polite"
              >
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
                  <span
                    className="auth-spinner"
                    aria-hidden="true"
                  />
                  Signing in...
                </>
              ) : (
                "Sign in as administrator"
              )}
            </button>
          </form>

          <div
            className="auth-divider"
            style={{
              margin: "20px 0 16px",
            }}
          />

          <p className="auth-security-note">
            Platform authentication is separate from tenant
            access.
            <br />
            Existing workspace sessions remain independent.
          </p>
        </div>

        <p className="auth-footer">
          Restricted to authorized system administrators.
        </p>
      </div>
    </div>
  );
}
