// src/auth/auth.types.ts
//
// Single source of truth for all auth-layer types.
// Previously this file had TWO declarations of AuthUser and AuthState —
// the second was a patch that added companyName/branchName but also
// dropped fullName and permissions from AuthUser. Merged into one.

// ── Request / Response DTOs ───────────────────────────────────────────────────

export interface LoginRequest {
  email:    string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email:    string;
  password: string;
}

export interface ResetPasswordRequest {
  email:       string;
  token:       string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

/** Shape returned by the backend on login / register. AuthProvider normalises.
 *
 * Backends vary — the JWT may arrive as:
 *   { token: "eyJ..." }                      flat string under "token"
 *   { accessToken: "eyJ..." }                flat string under "accessToken"
 *   { token: { accessToken: "eyJ..." } }     nested object
 *   { token: { token: "eyJ..." } }           nested with same key
 *
 * extractAccessToken in AuthProvider handles all four shapes.
 */
export interface LoginResponse {
  // Flat string variants
  token?:        string | TokenObject | null;
  accessToken?:  string | null;
  // Common supplementary fields
  refreshToken?: string | null;
  expiresAt?:    string | null;
  user?:         AuthUser | null;
  companyName?:  string | null;
  branchName?:   string | null;
}

interface TokenObject {
  accessToken?:  string;
  token?:        string;
  refreshToken?: string;
  expiresAt?:    string;
  user?:         AuthUser | null;
}

// ── Domain types ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id:           string;
  email:        string;
  fullName?:    string | null;
  roles?:       string[];
  permissions?: string[];
}

/** Persisted auth state — stored in localStorage or sessionStorage. */
export interface AuthState {
  user:              AuthUser | null;
  accessToken:       string | null;
  refreshToken:      string | null;
  expiresAt:         string | null;
  permissions:       string[];
  // Scope — populated from JWT claims or login response
  companyId:         string | null;
  companyName:       string | null;
  branchId:          string | null;
  branchName:        string | null;
  departmentId:      string | null;
  currentLocationId: string | null;
  // Session behaviour
  sessionOnly:       boolean;        // true = cleared when browser tab closes
}