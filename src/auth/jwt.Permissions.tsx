// src/auth/jwt.permissions.ts
import { jwtDecode } from "jwt-decode";

type JwtPayload = {
  exp?: number;
  permission?: string[] | string;
  permissions?: string[] | string;
};

function normalizePerms(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  return [String(v)];
}

export function getPermissionsFromToken(token?: string | null): string[] {
  if (!token) return [];

  try {
    const payload = jwtDecode<JwtPayload>(token);
    const a = normalizePerms(payload.permission);
    const b = normalizePerms(payload.permissions);
    return Array.from(new Set([...a, ...b]));
  } catch {
    return [];
  }
}
