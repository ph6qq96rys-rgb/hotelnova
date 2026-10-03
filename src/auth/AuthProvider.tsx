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

import { http, refreshAccessToken } from "../api/http";
import {
  hasAllErpPermissions,
  hasAnyErpPermission,
  hasErpPermission,
} from "./erpAccess";
import { authApi } from "./auth.api";
import { clearAuth, loadAuth, saveAuth } from "./auth.storage";
import { safeReturnUrl } from "./returnUrl";
import {
  clearWorkspaceAuth,
  saveWorkspaceAuth,
} from "./workspace-auth.storage";
import { clearPlatformAuth } from "./platform-auth.storage";
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

  login: (input: LoginRequest, remember?: boolean) => Promise<AuthState>;
  register: (input: RegisterRequest, remember?: boolean) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  refreshFromStorage: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_PATHS = [
  "/login",
  "/system-admin-login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

const SYSTEM_ADMIN_ROLES = ["SYSTEMADMIN", "SYSADMIN"];
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_WRITE_THROTTLE_MS = 15 * 1000;
const LAST_ACTIVITY_KEY = "restaurantfnb.auth.lastActivityAt";
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "click",
  "focus",
  "input",
  "change",
  "keydown",
  "mousedown",
  "mousemove",
  "pointerdown",
  "pointermove",
  "scroll",
  "touchstart",
  "wheel",
];

function readLastActivityAt(): number | null {
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY) ?? sessionStorage.getItem(LAST_ACTIVITY_KEY);
  if (!raw) return null;

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function writeLastActivityAt(value = Date.now()): void {
  const serialized = String(value);
  localStorage.setItem(LAST_ACTIVITY_KEY, serialized);
  sessionStorage.setItem(LAST_ACTIVITY_KEY, serialized);
}

function clearLastActivityAt(): void {
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  sessionStorage.removeItem(LAST_ACTIVITY_KEY);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function firstBoolean(...values: unknown[]): boolean {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes"].includes(normalized)) return true;
      if (["false", "0", "no"].includes(normalized)) return false;
    }
  }

  return false;
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
    const nestedExpiresAt = firstString(
      response.token.expiresAt,
      (response.token as any).expiresAtUtc
    );

    if (nestedExpiresAt) return nestedExpiresAt;
  }

  return (
    firstString(response.expiresAt, (response as any).expiresAtUtc) ??
    getExpiresAtFromToken(accessToken)
  );
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

    isCompanyScoped: firstBoolean(
      (response as any).isCompanyScoped,
      (response as any).IsCompanyScoped,
      (responseUser as any)?.isCompanyScoped,
      (responseUser as any)?.IsCompanyScoped,
      claims?.is_company_scoped,
      claims?.company_scoped
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
    preferredLanguage: firstString(
      responseUser?.preferredLanguage,
      (response as any).preferredLanguage,
      claims?.preferred_language
    ),
    defaultLanguage: firstString(
      responseUser?.defaultLanguage,
      (response as any).defaultLanguage,
      claims?.default_language
    ),
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

  const isCompanyScoped = firstBoolean(
    (response as any).isCompanyScoped,
    (response as any).IsCompanyScoped,
    (response.user as any)?.isCompanyScoped,
    (response.user as any)?.IsCompanyScoped,
    user?.isCompanyScoped,
    claims?.is_company_scoped,
    claims?.company_scoped
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
    isCompanyScoped,

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

    preferredLanguage: firstString(
      user?.preferredLanguage,
      (response as any).preferredLanguage,
      claims?.preferred_language
    ),

    defaultLanguage: firstString(
      user?.defaultLanguage,
      (response as any).defaultLanguage,
      claims?.default_language
    ),

    sessionOnly,
  };
}

function getDefaultReturnUrl(current: string): string {
  return safeReturnUrl(current, "/");
}

function readCurrentAppScope(): {
  companyId?: string | null;
  branchId?: string | null;
  branchName?: string | null;
} | null {
  const raw =
    sessionStorage.getItem("rfnb.scope.v3") ??
    localStorage.getItem("rfnb.scope.v3");

  if (!raw) return null;

  try {
    return JSON.parse(raw) as {
      companyId?: string | null;
      branchId?: string | null;
      branchName?: string | null;
    };
  } catch {
    return null;
  }
}

function syncAppScopeFromAuth(auth: AuthState | null): void {
  if (!auth?.accessToken) return;

  if (auth.companyId) {
    localStorage.setItem("companyId", auth.companyId);
  }

  const currentScope = readCurrentAppScope();
  const currentBranchId =
    currentScope?.companyId === auth.companyId
      ? firstString(currentScope.branchId)
      : null;
  const currentBranchName = currentBranchId
    ? firstString(currentScope?.branchName)
    : null;
  const branchId = auth.isCompanyScoped
    ? currentBranchId
    : auth.branchId;
  const branchName = auth.isCompanyScoped
    ? currentBranchName
    : auth.branchName;

  if (branchId) {
    localStorage.setItem("branchId", branchId);
  } else {
    localStorage.removeItem("branchId");
    sessionStorage.removeItem("branchId");
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
      branchId,
      branchName,
      storeId: auth.storeId,
      storeName: null,
      stockLocationId: auth.stockLocationId,
      stockLocationName: null,
    })
  );
}

function syncWorkspaceAuthFromAuth(auth: AuthState | null): void {
  if (!auth?.accessToken || !auth.companyId) {
    clearWorkspaceAuth();
    return;
  }

  const currentScope = readCurrentAppScope();
  const currentBranchId =
    currentScope?.companyId === auth.companyId
      ? firstString(currentScope.branchId)
      : null;
  const currentBranchName = currentBranchId
    ? firstString(currentScope?.branchName)
    : null;

  saveWorkspaceAuth({
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken ?? null,
    expiresAt: auth.expiresAt ?? "",
    companyId: auth.companyId,
    companyName: auth.companyName ?? "",
    tenantSlug: auth.tenantSlug ?? "",
    branchId: auth.isCompanyScoped ? currentBranchId : auth.branchId ?? null,
    branchName: auth.isCompanyScoped ? currentBranchName : auth.branchName ?? null,
    roles: auth.roles ?? [],
    permissions: auth.permissions ?? [],
  });
}

function hasSystemAdminRole(
  roles: string[] | null | undefined,
): boolean {
  return (roles ?? []).some((role) => {
    const normalized = role.trim().toUpperCase();

    return (
      normalized === "SYSTEMADMIN" ||
      normalized === "SYSADMIN"
    );
  });
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

  clearWorkspaceAuth();
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
    delete http.defaults.headers.Authorization;
  }, [auth?.accessToken]);

  const logoutAndRedirect = useCallback((event?: Event) => {
    const scope =
      event instanceof CustomEvent
        ? (event.detail as { scope?: string } | undefined)?.scope
        : null;
    const isPlatformScope = scope === "platform";

    if (isPlatformScope) {
      clearAuth();
      clearWorkspaceAuth();
      clearPlatformAuth();
    } else {
      clearWorkspaceAuth();

      const currentAuth = loadAuth();

      if (
        currentAuth &&
        !hasSystemAdminRole(currentAuth.roles)
      ) {
        clearAuth();
      }
    }

    setAuth(null);

    const current = pathnameRef.current;

    if (AUTH_PATHS.some((path) => current.startsWith(path))) {
      return;
    }

    const returnUrl = encodeURIComponent(getDefaultReturnUrl(current));
    const loginPath = isPlatformScope
      ? "/system-admin-login"
      : "/login";

    navigate(`${loginPath}?returnUrl=${returnUrl}`, {
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

    let timeoutId: number | null = null;
    let lastWriteAt = 0;

    const clearIdleTimer = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const scheduleIdleCheck = () => {
      clearIdleTimer();

      const lastActivityAt = readLastActivityAt() ?? Date.now();
      const remainingMs = IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt);

      if (remainingMs <= 0) {
        logoutAndRedirect();
        return;
      }

      timeoutId = window.setTimeout(scheduleIdleCheck, remainingMs);
    };

    const markActivity = () => {
      const now = Date.now();

      if (now - lastWriteAt < ACTIVITY_WRITE_THROTTLE_MS) {
        return;
      }

      lastWriteAt = now;
      writeLastActivityAt(now);
      scheduleIdleCheck();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleIdleCheck();
      }
    };

    if (!readLastActivityAt()) {
      writeLastActivityAt();
    }

    scheduleIdleCheck();

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, markActivity, { passive: true });
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearIdleTimer();

      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, markActivity);
      }

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isReady, auth?.accessToken, logoutAndRedirect]);

  useEffect(()=>{
    const updated=()=>{const next=loadAuth();if(next)setAuth(next);};
    window.addEventListener("auth:refreshed",updated);
    return()=>window.removeEventListener("auth:refreshed",updated);
  },[]);

  useEffect(() => {
    if(!isReady||!auth?.accessToken||!auth.expiresAt)return;
    let cancelled=false;
    let timer:number|undefined;
    const scope=auth.companyId?"workspace":"platform";
    const refresh=async()=>{
      if(cancelled)return;
      if(!auth.refreshToken){logoutAndRedirect();return;}
      const token=await refreshAccessToken(scope);
      if(cancelled)return;
      if(token){const next=loadAuth();if(next)setAuth(next);}
      else if(loadAuth()?.accessToken){timer=window.setTimeout(()=>void refresh(),15000);}
    };
    const expiry=Date.parse(auth.expiresAt);
    if(!Number.isFinite(expiry))return;
    timer=window.setTimeout(()=>void refresh(),Math.max(0,expiry-Date.now()-60000));
    return()=>{cancelled=true;if(timer!==undefined)window.clearTimeout(timer);};
  },[isReady,auth?.accessToken,auth?.expiresAt,auth?.refreshToken,auth?.companyId,logoutAndRedirect]);

  const login = useCallback(
    async (input: LoginRequest, remember = true) => {
      setIsLoading(true);

      try {
        const response = await authApi.login(input);
        const next = buildAuthState(response, !remember);

        saveAuth(next);
        syncAppScopeFromAuth(next);
        syncWorkspaceAuthFromAuth(next);
        writeLastActivityAt();
        setAuth(next);

        return next;
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
        syncAppScopeFromAuth(next);
        syncWorkspaceAuthFromAuth(next);
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

      isCompanyScoped: firstBoolean(
        (user as any).isCompanyScoped,
        (user as any).IsCompanyScoped,
        auth.isCompanyScoped
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
    syncAppScopeFromAuth(next);
    syncWorkspaceAuthFromAuth(next);
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
    (!isTokenExpired(auth?.accessToken) || Boolean(auth?.refreshToken));

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
        hasErpPermission({ roles, permissions }, permission),

      hasAnyPermission: (required) =>
        hasAnyErpPermission({ roles, permissions }, required),

      hasAllPermissions: (required) =>
        hasAllErpPermissions({ roles, permissions }, required),

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
