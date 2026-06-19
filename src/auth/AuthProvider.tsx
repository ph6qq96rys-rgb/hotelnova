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
import type {
  AuthState,
  AuthUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
} from "./auth.types";
import {
  decodeJwt,
  getExpiresAtFromToken,
  getPermissionsFromToken,
  getRolesFromToken,
  isTokenExpired,
} from "./jwt";
import {
  createPermissionSet,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  normalizePermissions,
} from "./permission.utils";

export interface AuthContextValue {
  auth: AuthState | null;
  user: AuthUser | null;

  isAuthenticated: boolean;
  isReady: boolean;
  isLoading: boolean;

  permissions: string[];
  roles: string[];
  permissionSet: ReadonlySet<string>;

  tenantSlug: string | null;
  companyId: string | null;
  branchId: string | null;
  departmentId: string | null;
  stockLocationId: string | null;
  storeId: string | null;

  isSystemAdmin: boolean;
  isTenantUser: boolean;

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

const AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

const SYSTEM_ADMIN_ROLES = ["SYSTEMADMIN", "SYSADMIN"];

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getNestedString(obj: unknown, path: string): string | null {
  let value: unknown = obj;

  for (const key of path.split(".")) {
    if (!value || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[key];
  }

  return firstString(value);
}

function isSystemAdminRole(role: string): boolean {
  return SYSTEM_ADMIN_ROLES.includes(role.trim().toUpperCase());
}

function extractAccessToken(response: LoginResponse): string | null {
  if (typeof response.accessToken === "string" && response.accessToken.trim()) {
    return response.accessToken.trim();
  }

  if (typeof response.token === "string" && response.token.trim()) {
    return response.token.trim();
  }

  if (response.token && typeof response.token === "object") {
    return firstString(response.token.accessToken, response.token.token);
  }

  return null;
}

function extractRefreshToken(response: LoginResponse): string | null {
  if (response.token && typeof response.token === "object") {
    return firstString(response.token.refreshToken);
  }

  return firstString(response.refreshToken);
}

function extractExpiresAt(
  response: LoginResponse,
  accessToken: string
): string | null {
  if (response.token && typeof response.token === "object") {
    const nestedExpiresAt = firstString(response.token.expiresAt);

    if (nestedExpiresAt) return nestedExpiresAt;
  }

  return firstString(response.expiresAt) ?? getExpiresAtFromToken(accessToken);
}

function buildAuthUser(
  response: LoginResponse,
  responseUser: Partial<AuthUser> | null | undefined,
  accessToken: string
): AuthUser | null {
  const claims = decodeJwt(accessToken);

  const id = firstString(
    responseUser?.id,
    (response as any).userId,
    claims?.user_id,
    claims?.sub
  );

  const email = firstString(
    responseUser?.email,
    (response as any).email,
    claims?.email
  );

  if (!id || !email) {
    return null;
  }

  const firstName = firstString(
    responseUser?.firstName,
    claims?.first_name
  );

  const lastName = firstString(
    responseUser?.lastName,
    claims?.last_name
  );

  const fullName = firstString(
    responseUser?.fullName,
    claims?.name,
    [firstName, lastName].filter(Boolean).join(" ")
  );

  const roles = normalizePermissions([
    ...normalizePermissions((response as any).roles),
    ...normalizePermissions(responseUser?.roles),
    ...getRolesFromToken(accessToken),
  ]);

  const permissions = normalizePermissions([
    ...normalizePermissions((response as any).permissions),
    ...normalizePermissions(responseUser?.permissions),
    ...getPermissionsFromToken(accessToken),
  ]);

  return {
    id,
    email,
    fullName,

    firstName,
    lastName,

    employeeId: firstString(
      responseUser?.employeeId,
      (response as any).employeeId,
      claims?.employee_id
    ),

    companyId: firstString(
      response.companyId,
      responseUser?.companyId,
      claims?.company_id,
      claims?.tenant_id
    ),

    branchId: firstString(
      response.branchId,
      responseUser?.branchId,
      claims?.branch_id
    ),

    departmentId: firstString(
      responseUser?.departmentId,
      (response as any).departmentId,
      claims?.department_id
    ),

    stockLocationId: firstString(
      responseUser?.stockLocationId,
      (response as any).stockLocationId,
      claims?.stock_location_id
    ),

    storeId: firstString(
      responseUser?.storeId,
      (response as any).storeId,
      claims?.store_id
    ),

    roles,
    permissions,

    isActive: responseUser?.isActive,
  };
}

function buildAuthState(
  response: LoginResponse,
  sessionOnly: boolean
): AuthState {
  const accessToken = extractAccessToken(response);

  if (!accessToken) {
    throw new Error("Login succeeded but no access token was returned.");
  }

  const tokenUser =
    response.token && typeof response.token === "object"
      ? response.token.user
      : null;

  const claims = decodeJwt(accessToken);

  const user = buildAuthUser(
    response,
    response.user ?? tokenUser ?? null,
    accessToken
  );

  const roles = normalizePermissions([
    ...normalizePermissions((response as any).roles),
    ...normalizePermissions(user?.roles),
    ...getRolesFromToken(accessToken),
  ]);

  const permissions = normalizePermissions([
    ...normalizePermissions((response as any).permissions),
    ...normalizePermissions(user?.permissions),
    ...getPermissionsFromToken(accessToken),
  ]);

  const companyId = firstString(
    response.companyId,
    user?.companyId,
    claims?.company_id,
    claims?.tenant_id
  );

  const branchId = firstString(
    response.branchId,
    user?.branchId,
    claims?.branch_id
  );

  return {
    user,
    accessToken,
    refreshToken: extractRefreshToken(response),
    expiresAt: extractExpiresAt(response, accessToken),

    permissions,
    roles,

    tenantSlug: firstString(
      response.tenantSlug,
      claims?.tenant_slug
    ),

    companyId,

    companyName: firstString(
      response.companyName,
      getNestedString(response, "company.name"),
      getNestedString(response, "tenant.name")
    ),

    branchId,

    branchName: firstString(
      response.branchName,
      getNestedString(response, "branch.name"),
      getNestedString(response, "outlet.name")
    ),

    departmentId: firstString(
      user?.departmentId,
      (response as any).departmentId,
      claims?.department_id
    ),

    stockLocationId: firstString(
      user?.stockLocationId,
      (response as any).stockLocationId,
      claims?.stock_location_id
    ),

    storeId: firstString(
      user?.storeId,
      (response as any).storeId,
      claims?.store_id
    ),

    sessionOnly,
  };
}

function getDefaultReturnUrl(current: string): string {
  return safeReturnUrl(current, "/");
}
function syncAppScopeFromAuth(auth: AuthState | null): void {
  if (!auth?.accessToken) return;

  if (auth.companyId) {
    localStorage.setItem("companyId", auth.companyId);
  }

  if (auth.branchId) {
    localStorage.setItem("branchId", auth.branchId);
  }

  if (auth.tenantSlug) {
    localStorage.setItem("tenantSlug", auth.tenantSlug);
  }

  localStorage.setItem("roles", JSON.stringify(auth.roles ?? []));
  localStorage.setItem("permissions", JSON.stringify(auth.permissions ?? []));

  localStorage.setItem(
    "rfnb.scope.v3",
    JSON.stringify({
      mode: auth.companyId ? "tenant" : "platform",
      companyId: auth.companyId,
      companyName: auth.companyName,
      tenantSlug: auth.tenantSlug,
      branchId: auth.branchId,
      branchName: auth.branchName,
      storeId: auth.storeId,
      storeName: null,
      stockLocationId: auth.stockLocationId,
      stockLocationName: null,
    })
  );
}

function clearAppScopeCompat(): void {
  for (const key of [
    "companyId",
    "branchId",
    "tenantSlug",
    "roles",
    "permissions",
    "rfnb.scope.v3",
  ]) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const pathnameRef = useRef(
    window.location.pathname + window.location.search
  );

  useEffect(() => {
    pathnameRef.current =
      window.location.pathname + window.location.search;
  });

  useEffect(() => {
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (auth?.accessToken) {
      http.defaults.headers.Authorization = `Bearer ${auth.accessToken}`;
    } else {
      delete http.defaults.headers.Authorization;
    }
  }, [auth?.accessToken]);

  const logoutAndRedirect = useCallback(() => {
    clearAuth();
    setAuth(null);

    const current = pathnameRef.current;

    if (AUTH_PATHS.some((path) => current.startsWith(path))) {
      return;
    }

    const returnUrl = encodeURIComponent(getDefaultReturnUrl(current));

    navigate(`/login?returnUrl=${returnUrl}`, {
      replace: true,
    });
  }, [navigate]);

  useEffect(() => {
    window.addEventListener("auth:unauthenticated", logoutAndRedirect);

    return () => {
      window.removeEventListener("auth:unauthenticated", logoutAndRedirect);
    };
  }, [logoutAndRedirect]);

  useEffect(() => {
    if (!isReady || !auth?.accessToken) return;

    if (isTokenExpired(auth.accessToken)) {
      logoutAndRedirect();
    }
  }, [isReady, auth?.accessToken, logoutAndRedirect]);

  useEffect(() => {
    if (!isReady || !auth?.accessToken || !auth.expiresAt) return;

    const expiresAtMs = Date.parse(auth.expiresAt);

    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      logoutAndRedirect();
      return;
    }

    const timeout = window.setTimeout(
      logoutAndRedirect,
      Math.max(expiresAtMs - Date.now(), 0)
    );

    return () => window.clearTimeout(timeout);
  }, [
    isReady,
    auth?.accessToken,
    auth?.expiresAt,
    logoutAndRedirect,
  ]);

  const login = useCallback(
    async (input: LoginRequest, remember = true) => {
      setIsLoading(true);

      try {
        const response = await authApi.login(input);
        const next = buildAuthState(response, !remember);

        saveAuth(next);
        syncAppScopeFromAuth(next);
        setAuth(next);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const register = useCallback(
    async (input: RegisterRequest, remember = true) => {
      setIsLoading(true);

      try {
        const response = await authApi.register(input);
        const next = buildAuthState(response, !remember);

        saveAuth(next);
        setAuth(next);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    void authApi.logout();

    clearAuth();
    clearAppScopeCompat();
    setAuth(null);

    navigate("/login", {
      replace: true,
    });
  }, [navigate]);

  const refreshMe = useCallback(async () => {
    if (!auth?.accessToken) return;

    const user = await authApi.me();

    const next: AuthState = {
      ...auth,
      user,
      permissions: normalizePermissions(user.permissions),
      roles: normalizePermissions(user.roles),

      companyId: firstString(
        user.companyId,
        auth.companyId
      ),

      branchId: firstString(
        user.branchId,
        auth.branchId
      ),

      departmentId: firstString(
        user.departmentId,
        auth.departmentId
      ),

      stockLocationId: firstString(
        user.stockLocationId,
        auth.stockLocationId
      ),

      storeId: firstString(
        user.storeId,
        auth.storeId
      ),
    };

    saveAuth(next);
    setAuth(next);
  }, [auth]);

  const refreshFromStorage = useCallback(() => {
    setAuth(loadAuth());
  }, []);

  const permissions = useMemo(
    () => auth?.permissions ?? [],
    [auth?.permissions]
  );

  const roles = useMemo(
    () => auth?.roles ?? [],
    [auth?.roles]
  );

  const permissionSet = useMemo(
    () => createPermissionSet(permissions),
    [permissions]
  );

  const isAuthenticated =
    Boolean(auth?.accessToken) &&
    !isTokenExpired(auth?.accessToken);

  const isSystemAdmin = useMemo(
    () => roles.some(isSystemAdminRole),
    [roles]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      user: auth?.user ?? null,

      isAuthenticated,
      isReady,
      isLoading,

      permissions,
      roles,
      permissionSet,

      tenantSlug: auth?.tenantSlug ?? null,
      companyId: auth?.companyId ?? null,
      branchId: auth?.branchId ?? null,
      departmentId: auth?.departmentId ?? null,
      stockLocationId: auth?.stockLocationId ?? null,
      storeId: auth?.storeId ?? null,

      isSystemAdmin,
      isTenantUser: Boolean(auth?.companyId) && !isSystemAdmin,

      hasPermission: (permission) =>
        hasPermission(permissions, permission),

      hasAnyPermission: (required) =>
        hasAnyPermission(permissions, required),

      hasAllPermissions: (required) =>
        hasAllPermissions(permissions, required),

      login,
      register,
      logout,
      refreshMe,
      refreshFromStorage,
    }),
    [
      auth,
      isAuthenticated,
      isReady,
      isLoading,
      permissions,
      roles,
      permissionSet,
      isSystemAdmin,
      login,
      register,
      logout,
      refreshMe,
      refreshFromStorage,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }

  return context;
}