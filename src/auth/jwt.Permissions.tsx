// src/auth/jwt.permissions.ts   ← renamed from .tsx (no JSX used)

import { jwtDecode } from "jwt-decode";

interface JwtClaims {
  exp?:         number;
  company_id?:  string;
  branch_id?:   string;
  permissions?: string | string[];
  permission?:  string | string[];
}

function asStringArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  return [String(v)];
}

function decodeSafe(token: string): JwtClaims | null {
  try { return jwtDecode<JwtClaims>(token); }
  catch { return null; }
}

export function getExpiresAtFromToken(token: string): string | null {
  const p = decodeSafe(token);
  if (!p?.exp) return null;
  const ms = p.exp * 1000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function getCompanyIdFromToken(token: string): string | null {
  return decodeSafe(token)?.company_id ?? null;
}

export function getBranchIdFromToken(token: string): string | null {
  return decodeSafe(token)?.branch_id ?? null;
}

export function getPermissionsFromToken(token: string | null | undefined): string[] {
  if (!token) return [];
  const p = decodeSafe(token);
  if (!p) return [];
  const merged = [...asStringArray(p.permission), ...asStringArray(p.permissions)];
  return [...new Set(merged.map(x => x.trim()).filter(Boolean))].sort();
}

export function isTokenExpired(token: string): boolean {
  const p = decodeSafe(token);
  if (!p?.exp) return false;
  return Date.now() >= p.exp * 1000;
}