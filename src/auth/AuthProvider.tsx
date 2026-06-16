// src/auth/AuthProvider.tsx

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import { http } from "../api/http";
import { authApi } from "./auth.api";
import { clearAuth, loadAuth, saveAuth } from "./auth.storage";
import { safeReturnUrl } from "./returnUrl";
import type { AuthState, AuthUser, LoginRequest, LoginResponse, RegisterRequest } from "./auth.types";
import { decodeJwt, getExpiresAtFromToken, getPermissionsFromToken, getRolesFromToken, isTokenExpired } from "./jwt";
import { createPermissionSet, hasAllPermissions, hasAnyPermission, hasPermission, normalizePermissions } from "./permission.utils";

export interface AuthContextValue {
  auth: AuthState | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  isLoading: boolean;
  permissions: string[];
  roles: string[];
  permissionSet: ReadonlySet<string>;
  companyId: string | null;
  branchId: string | null;
  departmentId: string | null;
  stockLocationId: string | null;
  storeId: string | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  login: (input: LoginRequest, remember?: boolean) => Promise<void>;
  register: (input: RegisterRequest, remember?: boolean) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  refreshFromStorage: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractAccessToken(response: LoginResponse): string | null {
  if (typeof response.accessToken === "string") return response.accessToken || null;
  if (typeof response.token === "string") return response.token || null;
  if (response.token && typeof response.token === "object") {
    return response.token.accessToken ?? response.token.token ?? null;
  }
  return null;
}

function extractRefreshToken(response: LoginResponse): string | null {
  if (response.token && typeof response.token === "object") return response.token.refreshToken ?? null;
  return response.refreshToken ?? null;
}

function extractExpiresAt(response: LoginResponse, accessToken: string): string | null {
  if (response.token && typeof response.token === "object" && response.token.expiresAt) {
    return response.token.expiresAt;
  }
  return response.expiresAt ?? getExpiresAtFromToken(accessToken);
}

function getNestedString(obj: unknown, path: string): string | null {
  let value: unknown = obj;
  for (const key of path.split(".")) value = (value as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildAuthUser(responseUser: Partial<AuthUser> | null | undefined, accessToken: string): AuthUser | null {
  const claims = decodeJwt(accessToken);
  const id = firstString(responseUser?.id, claims?.user_id, claims?.sub);
  const email = firstString(responseUser?.email, claims?.email);

  if (!id || !email) return null;

  const firstName = firstString(responseUser?.firstName, claims?.first_name);
  const lastName = firstString(responseUser?.lastName, claims?.last_name);
  const fullName = firstString(responseUser?.fullName, claims?.name, [firstName, lastName].filter(Boolean).join(" "));

  return {
    id,
    email,
    fullName,
    firstName,
    lastName,
    employeeId: firstString(responseUser?.employeeId, claims?.employee_id),
    companyId: firstString(responseUser?.companyId, claims?.company_id),
    branchId: firstString(responseUser?.branchId, claims?.branch_id),
    departmentId: firstString(responseUser?.departmentId, claims?.department_id),
    stockLocationId: firstString(responseUser?.stockLocationId, claims?.stock_location_id),
    storeId: firstString(responseUser?.storeId, claims?.store_id),
    roles: normalizePermissions(responseUser?.roles?.length ? responseUser.roles : getRolesFromToken(accessToken)),
    permissions: normalizePermissions(responseUser?.permissions?.length ? responseUser.permissions : getPermissionsFromToken(accessToken)),
    isActive: responseUser?.isActive,
  };
}

function buildAuthState(response: LoginResponse, sessionOnly: boolean): AuthState {
  const accessToken = extractAccessToken(response);
  if (!accessToken) throw new Error("Login succeeded but no access token was returned.");

  const tokenUser = response.token && typeof response.token === "object" ? response.token.user : null;
  const user = buildAuthUser(response.user ?? tokenUser ?? null, accessToken);
  const claims = decodeJwt(accessToken);
  const permissions = normalizePermissions(user?.permissions?.length ? user.permissions : getPermissionsFromToken(accessToken));
  const roles = normalizePermissions(user?.roles?.length ? user.roles : getRolesFromToken(accessToken));

  return {
    user,
    accessToken,
    refreshToken: extractRefreshToken(response),
    expiresAt: extractExpiresAt(response, accessToken),
    permissions,
    roles,
    companyId: firstString(user?.companyId, claims?.company_id),
    companyName: firstString(response.companyName, getNestedString(response, "company.name"), getNestedString(response, "tenant.name")),
    branchId: firstString(user?.branchId, claims?.branch_id),
    branchName: firstString(response.branchName, getNestedString(response, "branch.name"), getNestedString(response, "outlet.name")),
    departmentId: firstString(user?.departmentId, claims?.department_id),
    stockLocationId: firstString(user?.stockLocationId, claims?.stock_location_id),
    storeId: firstString(user?.storeId, claims?.store_id),
    sessionOnly,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pathnameRef = useRef(window.location.pathname + window.location.search);

  useEffect(() => {
    pathnameRef.current = window.location.pathname + window.location.search;
  });

  useEffect(() => setIsReady(true), []);

  useEffect(() => {
    if (auth?.accessToken) http.defaults.headers.Authorization = `Bearer ${auth.accessToken}`;
    else delete http.defaults.headers.Authorization;
  }, [auth?.accessToken]);

  const logoutAndRedirect = useCallback(() => {
    clearAuth();
    setAuth(null);

    const current = pathnameRef.current;
    if (AUTH_PATHS.some((path) => current.startsWith(path))) return;

    const returnUrl = encodeURIComponent(safeReturnUrl(current, "/dashboard"));
    navigate(`/login?returnUrl=${returnUrl}`, { replace: true });
  }, [navigate]);

  useEffect(() => {
    window.addEventListener("auth:unauthenticated", logoutAndRedirect);
    return () => window.removeEventListener("auth:unauthenticated", logoutAndRedirect);
  }, [logoutAndRedirect]);

  useEffect(() => {
    if (!isReady || !auth?.accessToken) return;
    if (isTokenExpired(auth.accessToken)) logoutAndRedirect();
  }, [isReady, auth?.accessToken, logoutAndRedirect]);

  useEffect(() => {
    if (!isReady || !auth?.accessToken || !auth.expiresAt) return;

    const expiresAt = Date.parse(auth.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      logoutAndRedirect();
      return;
    }

    const timeout = window.setTimeout(logoutAndRedirect, Math.max(expiresAt - Date.now(), 0));
    return () => window.clearTimeout(timeout);
  }, [isReady, auth?.accessToken, auth?.expiresAt, logoutAndRedirect]);

  const login = useCallback(async (input: LoginRequest, remember = true) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(input);
      const state = buildAuthState(response, !remember);
      saveAuth(state);
      setAuth(state);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (input: RegisterRequest, remember = true) => {
    setIsLoading(true);
    try {
      const response = await authApi.register(input);
      const state = buildAuthState(response, !remember);
      saveAuth(state);
      setAuth(state);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    void authApi.logout();
    clearAuth();
    setAuth(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const refreshMe = useCallback(async () => {
    if (!auth?.accessToken) return;
    const user = await authApi.me();
    const next: AuthState = {
      ...auth,
      user,
      permissions: normalizePermissions(user.permissions),
      roles: normalizePermissions(user.roles),
      companyId: user.companyId ?? auth.companyId,
      branchId: user.branchId ?? auth.branchId,
      departmentId: user.departmentId ?? auth.departmentId,
      stockLocationId: user.stockLocationId ?? auth.stockLocationId,
      storeId: user.storeId ?? auth.storeId,
    };
    saveAuth(next);
    setAuth(next);
  }, [auth]);

  const refreshFromStorage = useCallback(() => setAuth(loadAuth()), []);

  const permissions = useMemo(() => auth?.permissions ?? [], [auth?.permissions]);
  const roles = useMemo(() => auth?.roles ?? [], [auth?.roles]);
  const permissionSet = useMemo(() => createPermissionSet(permissions), [permissions]);

  const value = useMemo<AuthContextValue>(() => ({
    auth,
    user: auth?.user ?? null,
    isAuthenticated: !!auth?.accessToken && !isTokenExpired(auth.accessToken),
    isReady,
    isLoading,
    permissions,
    roles,
    permissionSet,
    companyId: auth?.companyId ?? null,
    branchId: auth?.branchId ?? null,
    departmentId: auth?.departmentId ?? null,
    stockLocationId: auth?.stockLocationId ?? null,
    storeId: auth?.storeId ?? null,
    hasPermission: (permission) => hasPermission(permissions, permission),
    hasAnyPermission: (required) => hasAnyPermission(permissions, required),
    hasAllPermissions: (required) => hasAllPermissions(permissions, required),
    login,
    register,
    logout,
    refreshMe,
    refreshFromStorage,
  }), [auth, isReady, isLoading, permissions, roles, permissionSet, login, register, logout, refreshMe, refreshFromStorage]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
