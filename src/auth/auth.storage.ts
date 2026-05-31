// src/auth/auth.storage.ts
//
// Read / write auth state to localStorage or sessionStorage.
//
// When sessionOnly = true (remember me unchecked), the state is stored in
// sessionStorage and is automatically cleared when the browser tab closes.
// When sessionOnly = false (remember me checked), the state is stored in
// localStorage and persists across sessions.
//
// Subsidiary keys (companyId, branchId, etc.) are always written to both
// storages so that non-auth code that reads them directly still works.

import type { AuthState } from "./auth.types";

const STATE_KEY        = "auth_state_v1";
const SESSION_KEY      = "auth_session_v1";   // sessionStorage mirror

const COMPANY_ID_KEY   = "companyId";
const COMPANY_NAME_KEY = "companyName";
const BRANCH_ID_KEY    = "branchId";
const BRANCH_NAME_KEY  = "branchName";

// ── Utilities ─────────────────────────────────────────────────────────────────

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; }
  catch { return null; }
}

function safeStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function normPerms(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter(s => s.trim()) : [];
}

function writeOrRemove(storage: Storage, key: string, value: string | null) {
  const s = safeStr(value);
  s ? storage.setItem(key, s) : storage.removeItem(key);
}

// ── Load ──────────────────────────────────────────────────────────────────────

export function loadAuth(): AuthState | null {
  // Session-only check: if the session store has a value, use it.
  // Otherwise fall back to localStorage (persistent).
  const sessionRaw = safeParse<Record<string, unknown>>(
    sessionStorage.getItem(SESSION_KEY)
  );

  const raw = sessionRaw
    ?? safeParse<Record<string, unknown>>(localStorage.getItem(STATE_KEY));

  if (!raw) return null;

  // If the stored state is session-only but sessionStorage had nothing,
  // the tab was closed and reopened — honour the intent and discard.
  if (!sessionRaw && raw.sessionOnly === true) {
    clearAuth();
    return null;
  }

  return {
    user:              (raw.user as AuthState["user"]) ?? null,
    accessToken:       safeStr(raw.accessToken),
    refreshToken:      safeStr(raw.refreshToken),
    expiresAt:         safeStr(raw.expiresAt),
    permissions:       normPerms(raw.permissions),
    companyId:         safeStr(raw.companyId)   ?? safeStr(localStorage.getItem(COMPANY_ID_KEY)),
    companyName:       safeStr(raw.companyName) ?? safeStr(localStorage.getItem(COMPANY_NAME_KEY)),
    branchId:          safeStr(raw.branchId)    ?? safeStr(localStorage.getItem(BRANCH_ID_KEY)),
    branchName:        safeStr(raw.branchName)  ?? safeStr(localStorage.getItem(BRANCH_NAME_KEY)),
    departmentId:      safeStr(raw.departmentId),
    currentLocationId: safeStr(raw.currentLocationId),
    sessionOnly:       raw.sessionOnly === true,
  };
}

// ── Save ──────────────────────────────────────────────────────────────────────

export function saveAuth(next: AuthState): void {
  const normalized: AuthState = {
    user:              next.user ?? null,
    accessToken:       safeStr(next.accessToken),
    refreshToken:      safeStr(next.refreshToken),
    expiresAt:         safeStr(next.expiresAt),
    permissions:       normPerms(next.permissions),
    companyId:         safeStr(next.companyId),
    companyName:       safeStr(next.companyName),
    branchId:          safeStr(next.branchId),
    branchName:        safeStr(next.branchName),
    departmentId:      safeStr(next.departmentId),
    currentLocationId: safeStr(next.currentLocationId),
    sessionOnly:       next.sessionOnly ?? false,
  };

  const serialized = JSON.stringify(normalized);

  if (normalized.sessionOnly) {
    // Session-only: write to sessionStorage, clear from localStorage.
    sessionStorage.setItem(SESSION_KEY, serialized);
    localStorage.removeItem(STATE_KEY);
  } else {
    // Persistent: write to localStorage, clear sessionStorage.
    localStorage.setItem(STATE_KEY, serialized);
    sessionStorage.removeItem(SESSION_KEY);
  }

  // Subsidiary keys — written to localStorage so non-auth code can read them
  // regardless of session mode.
  writeOrRemove(localStorage, COMPANY_ID_KEY,   normalized.companyId);
  writeOrRemove(localStorage, COMPANY_NAME_KEY, normalized.companyName);
  writeOrRemove(localStorage, BRANCH_ID_KEY,    normalized.branchId);
  writeOrRemove(localStorage, BRANCH_NAME_KEY,  normalized.branchName);
}

// ── Clear ─────────────────────────────────────────────────────────────────────

export function clearAuth(): void {
  localStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(COMPANY_ID_KEY);
  localStorage.removeItem(COMPANY_NAME_KEY);
  localStorage.removeItem(BRANCH_ID_KEY);
  localStorage.removeItem(BRANCH_NAME_KEY);
}

// ── Convenience getters ───────────────────────────────────────────────────────

export const getAccessToken  = (): string | null => loadAuth()?.accessToken  ?? null;
export const getRefreshToken = (): string | null => loadAuth()?.refreshToken ?? null;
export const getCompanyId    = (): string | null =>
  loadAuth()?.companyId ?? safeStr(localStorage.getItem(COMPANY_ID_KEY));
export const getBranchId     = (): string | null =>
  loadAuth()?.branchId  ?? safeStr(localStorage.getItem(BRANCH_ID_KEY));
export const getCompanyName  = (): string | null =>
  loadAuth()?.companyName ?? safeStr(localStorage.getItem(COMPANY_NAME_KEY));
export const getBranchName   = (): string | null =>
  loadAuth()?.branchName  ?? safeStr(localStorage.getItem(BRANCH_NAME_KEY));

// ── Scope update ──────────────────────────────────────────────────────────────

export function setScope(
  companyId:   string | null,
  companyName: string | null,
  branchId:    string | null,
  branchName:  string | null,
): void {
  const curr = loadAuth();
  saveAuth({
    user:              curr?.user              ?? null,
    accessToken:       curr?.accessToken       ?? null,
    refreshToken:      curr?.refreshToken      ?? null,
    expiresAt:         curr?.expiresAt         ?? null,
    permissions:       curr?.permissions       ?? [],
    departmentId:      curr?.departmentId      ?? null,
    currentLocationId: curr?.currentLocationId ?? null,
    sessionOnly:       curr?.sessionOnly       ?? false,
    companyId:   safeStr(companyId),
    companyName: safeStr(companyName),
    branchId:    safeStr(branchId),
    branchName:  safeStr(branchName),
  });
}