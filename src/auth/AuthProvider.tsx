// src/auth/AuthProvider.tsx

import {
  createContext, useCallback, useContext,
  useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import { authApi } from "./auth.api";
import { loadAuth, saveAuth, clearAuth } from "./auth.storage";
import { safeReturnUrl } from "./returnUrl";
import { http } from "../api/http";
import type { LoginRequest, RegisterRequest, AuthUser, LoginResponse, AuthState } from "./auth.types";
import {
  getExpiresAtFromToken, getCompanyIdFromToken,
  getBranchIdFromToken, getPermissionsFromToken, isTokenExpired,
} from "./jwt.permissions";

// ── Context type ──────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user:               AuthUser | null;
  isAuthenticated:    boolean;
  isReady:            boolean;
  isLoading:          boolean;
  permissions:        string[];
  hasPermission:      (permission: string) => boolean;
  login:              (input: LoginRequest, remember?: boolean) => Promise<void>;
  register:           (input: RegisterRequest, remember?: boolean) => Promise<void>;
  logout:             () => void;
  refreshFromStorage: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Response normalisation ────────────────────────────────────────────────────

function extractAccessToken(res: LoginResponse): string | null {
  if (typeof res.accessToken === "string") return res.accessToken || null;
  if (res.token && typeof res.token === "object")
    return res.token.accessToken ?? res.token.token ?? null;
  return null;
}

function extractRefreshToken(res: LoginResponse): string | null {
  if (res.token && typeof res.token === "object")
    return res.token.refreshToken ?? null;
  return res.refreshToken ?? null;
}

function extractExpiresAt(res: LoginResponse, accessToken: string): string | null {
  if (res.token && typeof res.token === "object" && res.token.expiresAt)
    return res.token.expiresAt;
  return res.expiresAt ?? getExpiresAtFromToken(accessToken);
}

function extractUser(res: LoginResponse): AuthUser | null {
  if (res.token && typeof res.token === "object")
    return (res.token.user as AuthUser | null | undefined) ?? null;
  return res.user ?? null;
}

function extractStringField(res: LoginResponse, ...keys: string[]): string | null {
  const obj = res as unknown as Record<string, unknown>;
  for (const key of keys) {
    const chain = key.split(".");
    let v: unknown = obj;
    for (const k of chain) {
      v = (v as Record<string, unknown>)?.[k];
    }
    if (typeof v === "string" && v) return v;
  }
  return null;
}

function buildAuthState(res: LoginResponse, sessionOnly: boolean): AuthState | null {
  const accessToken = extractAccessToken(res);
  if (!accessToken) return null;
  return {
    user:              extractUser(res),
    accessToken,
    refreshToken:      extractRefreshToken(res),
    expiresAt:         extractExpiresAt(res, accessToken),
    permissions:       getPermissionsFromToken(accessToken),
    companyId:         getCompanyIdFromToken(accessToken),
    companyName:       extractStringField(res, "companyName", "company.name", "tenant.name"),
    branchId:          getBranchIdFromToken(accessToken),
    branchName:        extractStringField(res, "branchName", "branch.name", "outlet.name"),
    departmentId:      null,
    currentLocationId: null,
    sessionOnly,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const nav = useNavigate();

  const [auth,      setAuth]      = useState<AuthState | null>(() => loadAuth());
  const [isReady,   setIsReady]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const pathnameRef = useRef(window.location.pathname);
  useEffect(() => { pathnameRef.current = window.location.pathname; });

  useEffect(() => { setIsReady(true); }, []);

  // ── Sync Authorization header ─────────────────────────────────────────────

  useEffect(() => {
    if (auth?.accessToken) {
      http.defaults.headers.Authorization = `Bearer ${auth.accessToken}`;
    } else {
      delete http.defaults.headers.Authorization;
    }
  }, [auth?.accessToken]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const isAuthenticated = !!auth?.accessToken;
  const permissions     = useMemo(() => auth?.permissions ?? [], [auth?.permissions]);
  const hasPermission   = useCallback(
    (p: string) => permissions.includes(p),
    [permissions]
  );

  // ── Logout / redirect ─────────────────────────────────────────────────────

  const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

  const logoutAndRedirect = useCallback(() => {
    clearAuth();
    setAuth(null);
    const current = pathnameRef.current;
    if (AUTH_PATHS.some(p => current.startsWith(p))) return;
    const returnUrl = encodeURIComponent(safeReturnUrl(current, "/dashboard"));
    nav(`/login?returnUrl=${returnUrl}`, { replace: true });
  }, [nav]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen for http.ts refresh failures ──────────────────────────────────

  useEffect(() => {
    window.addEventListener("auth:unauthenticated", logoutAndRedirect);
    return () => window.removeEventListener("auth:unauthenticated", logoutAndRedirect);
  }, [logoutAndRedirect]);

  // ── Token expiry guards ───────────────────────────────────────────────────

  useEffect(() => {
    if (!isReady || !auth?.accessToken) return;
    if (isTokenExpired(auth.accessToken)) logoutAndRedirect();
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isReady || !auth?.accessToken || !auth.expiresAt) return;
    const delay = Date.parse(auth.expiresAt) - Date.now();
    if (delay <= 0) { logoutAndRedirect(); return; }
    const t = window.setTimeout(logoutAndRedirect, delay);
    return () => window.clearTimeout(t);
  }, [isReady, auth?.accessToken, auth?.expiresAt, logoutAndRedirect]);

  useEffect(() => {
    if (!isReady || !auth?.accessToken) return;
    const id = window.setInterval(() => {
      if (auth.expiresAt && Date.now() >= Date.parse(auth.expiresAt))
        logoutAndRedirect();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [isReady, auth?.accessToken, auth?.expiresAt, logoutAndRedirect]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const login = useCallback(async (input: LoginRequest, remember = true) => {
    setIsLoading(true);
    try {
      const res   = await authApi.login(input);
      const state = buildAuthState(res, !remember);
      if (!state) throw new Error("Login succeeded but no access token was returned.");
      saveAuth(state);
      setAuth(state);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (input: RegisterRequest, remember = true) => {
    setIsLoading(true);
    try {
      const res   = await authApi.register(input);
      const state = buildAuthState(res, !remember);
      if (state) { saveAuth(state); setAuth(state); }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    clearAuth();
    setAuth(null);
    nav("/login", { replace: true });
  }, [nav]);

  const refreshFromStorage = useCallback(() => setAuth(loadAuth()), []);

  // ── Context value ─────────────────────────────────────────────────────────

  const value = useMemo<AuthContextValue>(() => ({
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
  }), [
    auth?.user, isAuthenticated, isReady, isLoading,
    permissions, hasPermission, login, register, logout, refreshFromStorage,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}