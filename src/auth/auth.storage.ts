// src/auth/auth.storage.ts

export type AuthUser = {
  id: string;
  email: string;
  fullName?: string;
  roles?: string[];
  permissions?: string[];
};

export type AuthState = {
  user: AuthUser | null;

  // tokens (flat)
  accessToken: string | null;
  refreshToken: string | null;

  // iso string or null
  expiresAt: string | null;

  // optional app scope
  companyId?: string | null;
  branchId?: string | null;
  permissions?: string[];
};

const KEY = "auth_state_v1";

// ---------- utils ----------
function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

// ---------- public api ----------
export function loadAuth(): AuthState | null {
  const data = safeParse<AuthState>(localStorage.getItem(KEY));
  if (!data) return null;

  // normalize old/invalid shapes
  return {
    user: data.user ?? null,
    accessToken: safeString((data as any).accessToken),
    refreshToken: safeString((data as any).refreshToken),
    expiresAt: safeString((data as any).expiresAt),
    companyId: (data as any).companyId ?? null,
    branchId: (data as any).branchId ?? null,
    permissions: Array.isArray((data as any).permissions) ? (data as any).permissions.map(String)  : [],

  };
}

export function saveAuth(next: AuthState): void {
  // enforce consistent shape + avoid undefined
  const normalized: AuthState = {
    user: next.user ?? null,
    accessToken: safeString(next.accessToken),
    refreshToken: safeString(next.refreshToken),
    expiresAt: safeString(next.expiresAt),
    companyId: next.companyId ?? null,
    branchId: next.branchId ?? null,
    permissions: Array.isArray(next.permissions) ? next.permissions.map(String) : [],

  };

  localStorage.setItem(KEY, JSON.stringify(normalized));
}

export function clearAuth(): void {
  localStorage.removeItem(KEY);
}

// convenience helpers (optional but handy)
export function getAccessToken(): string | null {
  return loadAuth()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return loadAuth()?.refreshToken ?? null;
}

export function setScope(companyId: string | null, branchId: string | null) {
  const curr = loadAuth();
  if (!curr) return;
  saveAuth({ ...curr, companyId, branchId });
}
// auth.storage.ts


/* ------------------ Permission helpers ------------------ */
export function hasPermission(permission: string): boolean {
  const auth = loadAuth();
  return auth?.permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(perms: string[]): boolean {
  const auth = loadAuth();
  const p = auth?.permissions ?? [];
  return perms.some(x => p.includes(x));
}

export function hasAllPermissions(perms: string[]): boolean {
  const auth = loadAuth();
  const p = auth?.permissions ?? [];
  return perms.every(x => p.includes(x));
}
