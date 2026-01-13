// src/auth/AuthProvider.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

import { http } from "../api/http";
import {
  loadAuth,
  saveAuth,
  clearAuth,
  type AuthState,
} from "./auth.storage";
import { safeReturnUrl } from "./returnUrl";

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

type LoginInput = { email: string; password: string };
type RegisterInput = { email: string; password: string; fullName?: string };

export type ScopedPermission = {
  key: string;
  companyId?: string | null;
  branchId?: string | null;
};

type JwtPayload = {
  exp?: number;
  company_id?: string;
  branch_id?: string;
  permissions?: string[];
  permission?: string | string[];
};

export type AuthContextValue = {
  user: AuthState["user"];
  isAuthenticated: boolean;
  isReady: boolean;
  isLoading: boolean;

  permissions: string[];

  hasPermission: (
    permission: string,
    companyId?: string | null,
    branchId?: string | null
  ) => boolean;

  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): void;
  refreshFromStorage(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/* ------------------------------------------------------------------ */
/* JWT helpers */
/* ------------------------------------------------------------------ */

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];

function getExpiresAtIso(token: string): string | null {
  try {
    const p = jwtDecode<JwtPayload>(token);
    return p.exp ? new Date(p.exp * 1000).toISOString() : null;
  } catch {
    return null;
  }
}

function getCompanyId(token: string): string | null {
  try {
    return jwtDecode<JwtPayload>(token).company_id ?? null;
  } catch {
    return null;
  }
}

function getBranchId(token: string): string | null {
  try {
    return jwtDecode<JwtPayload>(token).branch_id ?? null;
  } catch {
    return null;
  }
}

function getPermissions(token: string): string[] {
  try {
    const p = jwtDecode<JwtPayload>(token);
    const raw = Array.isArray(p.permissions)
      ? p.permissions
      : asArray(p.permission);
    return Array.from(new Set(raw.map(x => x.trim()).filter(Boolean)));
  } catch {
    return [];
  }
}

function normalizeToScoped(perms: string[]): ScopedPermission[] {
  return perms.map(key => ({ key }));
}

/* ------------------------------------------------------------------ */
/* Provider */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();

  // Load once from storage
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Mark initialized after first render
  useEffect(() => {
    setIsReady(true);
  }, []);

  const isAuthenticated = !!auth && !!auth.accessToken;

  /* ---------------- HTTP Authorization ---------------- */

  useEffect(() => {
    if (auth?.accessToken) {
      http.defaults.headers.Authorization = `Bearer ${auth.accessToken}`;
    } else {
      delete http.defaults.headers.Authorization;
    }
  }, [auth?.accessToken]);

  /* ---------------- Permissions ---------------- */

  const permissions = useMemo(
    () => auth?.permissions ?? [],
    [auth?.permissions]
  );

  const scopedPermissions = useMemo(
    () => normalizeToScoped(permissions),
    [permissions]
  );

  const hasPermission = useCallback(
    (permission: string, companyId?: string | null, branchId?: string | null) =>
      scopedPermissions.some(p => {
        if (p.key !== permission) return false;

        if (!p.companyId && !p.branchId) return true;
        if (p.companyId && companyId && p.companyId !== companyId) return false;
        if (p.branchId == null) return true;
        return !!branchId && p.branchId === branchId;
      }),
    [scopedPermissions]
  );

  /* ---------------- Logout ---------------- */

  const logout = useCallback(() => {
    clearAuth();
    setAuth(null);
  }, []);

const logoutAndRedirect = useCallback(() => {
  clearAuth();
  setAuth(null);

  // ✅ Don't redirect if we are already on auth pages
  if (
    loc.pathname.startsWith("/login") ||
    loc.pathname.startsWith("/register") ||
    loc.pathname.startsWith("/forgot-password") ||
    loc.pathname.startsWith("/reset-password")
  ) {
    return;
  }

  const current = loc.pathname + loc.search;
  const desired = safeReturnUrl(current, "/dashboard");

  nav(`/login?returnUrl=${encodeURIComponent(desired)}`, { replace: true });
}, [nav, loc.pathname, loc.search]);


  /* ---------------- Token Expiry ---------------- */

  const getExpiryMs = useCallback(() => {
    if (!auth?.accessToken) return null;
    const iso = auth.expiresAt ?? getExpiresAtIso(auth.accessToken);
    if (!iso) return null;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }, [auth?.accessToken, auth?.expiresAt]);

  // Timeout-based expiry
  useEffect(() => {
    if (!isReady || !auth?.accessToken) return;
    

    const expiryMs = getExpiryMs();
    if (!expiryMs) return;

    const delay = expiryMs - Date.now();
    if (delay <= 0) {
      logoutAndRedirect();
      return;
    }

    const timer = window.setTimeout(logoutAndRedirect, delay);
    return () => window.clearTimeout(timer);
  }, [isReady, auth?.accessToken, getExpiryMs, logoutAndRedirect]);

  // Interval safety net (sleep / hibernation)
  useEffect(() => {
    if (!isReady || !auth?.accessToken) return;

    const id = window.setInterval(() => {
      const expiryMs = getExpiryMs();
      if (expiryMs && Date.now() >= expiryMs) {
        logoutAndRedirect();
      }
    }, 15_000);

    return () => window.clearInterval(id);
  }, [isReady, auth?.accessToken, getExpiryMs, logoutAndRedirect]);

  /* ---------------- Auth Actions ---------------- */

  const login = useCallback(async ({ email, password }: LoginInput) => {
    setIsLoading(true);
    try {
      const res = (await http.post("/auth/login", { email, password }))?.data;

      const accessToken =
        res?.token?.accessToken ??
        res?.token?.token ??
        res?.accessToken ??
        res?.token;

      if (!accessToken) {
        throw new Error("Login succeeded but no access token returned.");
      }

      const next: AuthState = {
        user: res?.token?.user ?? res?.user ?? null,
        accessToken,
        refreshToken:
          res?.token?.refreshToken ?? res?.refreshToken ?? null,
        expiresAt:
          res?.token?.expiresAt ??
          res?.expiresAt ??
          getExpiresAtIso(accessToken),
        permissions: getPermissions(accessToken),
        companyId: getCompanyId(accessToken),
        branchId: getBranchId(accessToken),
      };

      saveAuth(next);
      setAuth(next);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async ({ email, password, fullName }: RegisterInput) => {
      setIsLoading(true);
      try {
        const res = (await http.post("/auth/register", {
          email,
          password,
          fullName,
        }))?.data;

        const accessToken =
          res?.token?.accessToken ?? res?.accessToken ?? res?.token;

        if (!accessToken) return;

        const next: AuthState = {
          user: res?.token?.user ?? res?.user ?? null,
          accessToken,
          refreshToken:
            res?.token?.refreshToken ?? res?.refreshToken ?? null,
          expiresAt:
            res?.token?.expiresAt ??
            res?.expiresAt ??
            getExpiresAtIso(accessToken),
          permissions: getPermissions(accessToken),
          companyId: getCompanyId(accessToken),
          branchId: getBranchId(accessToken),
        };

        saveAuth(next);
        setAuth(next);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const refreshFromStorage = useCallback(() => {
    setAuth(loadAuth());
  }, []);

  /* ---------------- Context Value ---------------- */

  const value = useMemo<AuthContextValue>(
    () => ({
      user: auth?.user ?? null,
      isAuthenticated,
      isReady,
      isLoading,
      permissions,
      hasPermission,
      login,
      register,
      logout,
      refreshFromStorage,
    }),
    [
      auth?.user,
      isAuthenticated,
      isReady,
      isLoading,
      permissions,
      hasPermission,
      login,
      register,
      logout,
      refreshFromStorage,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ------------------------------------------------------------------ */
/* Hook */
/* ------------------------------------------------------------------ */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
