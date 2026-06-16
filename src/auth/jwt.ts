// src/auth/jwt.ts
// JWT decoding helpers. No JSX. Keep this file as .ts, not .tsx.

import { jwtDecode } from "jwt-decode";
import { AUTH_CLAIMS } from "./auth.claims";
import { normalizePermissions } from "./permission.utils";

export interface JwtClaims extends Record<string, unknown> {
  exp?: number;
  sub?: string;
  user_id?: string;
  employee_id?: string;
  company_id?: string;
  branch_id?: string;
  department_id?: string;
  stock_location_id?: string;
  store_id?: string;
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  permission?: string | string[];
  permissions?: string | string[];
  role?: string | string[];
  roles?: string | string[];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [String(value)].filter(Boolean);
}

export function decodeJwt(token: string | null | undefined): JwtClaims | null {
  if (!token) return null;
  try {
    return jwtDecode<JwtClaims>(token);
  } catch {
    return null;
  }
}

export function getClaim(claims: JwtClaims | null, key: keyof typeof AUTH_CLAIMS | string): string | null {
  if (!claims) return null;
  return asString(claims[key]);
}

export function getExpiresAtFromToken(token: string | null | undefined): string | null {
  const claims = decodeJwt(token);
  if (!claims?.exp) return null;
  const ms = claims.exp * 1000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function isTokenExpired(token: string | null | undefined, skewSeconds = 30): boolean {
  const claims = decodeJwt(token);
  if (!claims?.exp) return true;
  return Date.now() >= (claims.exp - skewSeconds) * 1000;
}

export function getPermissionsFromToken(token: string | null | undefined): string[] {
  const claims = decodeJwt(token);
  return normalizePermissions([
    ...asStringArray(claims?.permission),
    ...asStringArray(claims?.permissions),
  ]);
}

export function getRolesFromToken(token: string | null | undefined): string[] {
  const claims = decodeJwt(token);
  return normalizePermissions([
    ...asStringArray(claims?.role),
    ...asStringArray(claims?.roles),
  ]);
}
