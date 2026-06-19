// src/auth/auth.storage.ts
// Auth persistence only. No permission business logic belongs here.

import type { AuthState } from "./auth.types";
import { normalizePermissions } from "./permission.utils";

const STATE_KEY = "restaurantfnb.auth.v2";
const SESSION_KEY = "restaurantfnb.auth.session.v2";

const LEGACY_KEYS = [
  "auth_state_v1",
  "auth_session_v1",
  "companyId",
  "companyName",
  "branchId",
  "branchName",
];

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeState(raw: Partial<AuthState> | null): AuthState | null {
  if (!raw) return null;

  return {
    user: raw.user ?? null,
    accessToken: safeStr(raw.accessToken),
    refreshToken: safeStr(raw.refreshToken),
    expiresAt: safeStr(raw.expiresAt),
    permissions: normalizePermissions(raw.permissions),
    roles: normalizePermissions(raw.roles),
    companyId: safeStr(raw.companyId),
    tenantSlug: safeStr((raw as any).tenantSlug),
    companyName: safeStr(raw.companyName),
    branchId: safeStr(raw.branchId),
    branchName: safeStr(raw.branchName),
    departmentId: safeStr(raw.departmentId),
    stockLocationId: safeStr(raw.stockLocationId),
    storeId: safeStr(raw.storeId),
    sessionOnly: raw.sessionOnly === true,
  };
}

export function loadAuth(): AuthState | null {
  const sessionState = normalizeState(safeParse<Partial<AuthState>>(sessionStorage.getItem(SESSION_KEY)));
  if (sessionState) return sessionState;

  const localState = normalizeState(safeParse<Partial<AuthState>>(localStorage.getItem(STATE_KEY)));
  if (!localState) return null;

  if (localState.sessionOnly) {
    clearAuth();
    return null;
  }

  return localState;
}

export function saveAuth(next: AuthState): void {
  const normalized = normalizeState(next);
  if (!normalized) return;

  const serialized = JSON.stringify(normalized);

  if (normalized.sessionOnly) {
    sessionStorage.setItem(SESSION_KEY, serialized);
    localStorage.removeItem(STATE_KEY);
  } else {
    localStorage.setItem(STATE_KEY, serialized);
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export function clearAuth(): void {
  localStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(SESSION_KEY);

  // Remove old implementation keys so stale scope does not leak into the app.
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

export function getAccessToken(): string | null {
  return loadAuth()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return loadAuth()?.refreshToken ?? null;
}

export function getAuthScope() {
  const auth = loadAuth();
  return {
    companyId: auth?.companyId ?? null,
    branchId: auth?.branchId ?? null,
    departmentId: auth?.departmentId ?? null,
    stockLocationId: auth?.stockLocationId ?? null,
    storeId: auth?.storeId ?? null,
  };
}
