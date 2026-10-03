// src/api/http.ts
//
// Central Axios instance for Hotel Nova.
//
// ERP-grade behavior:
// - Uses VITE_API_BASE_URL when provided.
// - Defaults to "/api" for Docker/Nginx reverse proxy.
// - NEVER falls back to localhost.
// - Uses one Axios client for both platform and workspace requests.
// - Selects the correct token from the request URL.
// - Platform requests never carry tenant/company/branch headers.
// - Tenant identity is resolved by the backend from Host/X-Forwarded-Host.
// - Workspace requests may carry company/branch scope headers only.
// - Handles 401 responses with scope-aware, single-flight refresh and retry.
// - Keeps legacy auth.storage support during the split-auth migration.

import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

import {
  clearAuth,
  loadAuth,
  saveAuth,
} from "../auth/auth.storage";
import {
  clearPlatformAuth,
  loadPlatformAuth,
  savePlatformAuth,
  type PlatformAuth,
} from "../auth/platform-auth.storage";
import {
  clearWorkspaceAuth,
  loadWorkspaceAuth,
  saveWorkspaceAuth,
  type WorkspaceAuth,
} from "../auth/workspace-auth.storage";

// -----------------------------------------------------------------------------
// API Base URL
// -----------------------------------------------------------------------------

function cleanBaseUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed || trimmed === "/") {
    return "/api";
  }

  return trimmed.replace(/\/$/, "");
}

function resolveApiBase(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

  if (typeof envUrl === "string" && envUrl.trim()) {
    return cleanBaseUrl(envUrl);
  }

  return "/api";
}

export const API_BASE = resolveApiBase();

// -----------------------------------------------------------------------------
// Shared Types / Helpers
// -----------------------------------------------------------------------------

type AuthScope = "platform" | "workspace";

type SessionAuth = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  roles?: string[] | null;
  permissions?: string[] | null;
  companyId?: string | null;
  companyName?: string | null;
  tenantSlug?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  isCompanyScoped?: boolean | null;
};

const LAST_ACTIVITY_KEY = "restaurantfnb.auth.lastActivityAt";
const ACTIVITY_WRITE_THROTTLE_MS = 15_000;
let lastActivityWriteAt = 0;

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function markSessionActivity(): void {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastActivityWriteAt < ACTIVITY_WRITE_THROTTLE_MS) {
    return;
  }

  lastActivityWriteAt = now;
  const serialized = String(now);
  localStorage.setItem(LAST_ACTIVITY_KEY, serialized);
  sessionStorage.setItem(LAST_ACTIVITY_KEY, serialized);
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
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

// -----------------------------------------------------------------------------
// Axios Instance
// -----------------------------------------------------------------------------

export const http = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
});

function normalizeAxiosUrl(url?: string): string | undefined {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;

  const basePath = API_BASE.replace(/\/+$/, "").toLowerCase();

  if (basePath.endsWith("/api") && url.toLowerCase().startsWith("/api/")) {
    return url.slice(4);
  }

  return url;
}

// -----------------------------------------------------------------------------
// Endpoint / Scope Helpers
// -----------------------------------------------------------------------------

function getUrlPath(url?: string): string {
  if (!url) {
    return "";
  }

  try {
    if (/^https?:\/\//i.test(url)) {
      return new URL(url).pathname;
    }
  } catch {
    // Use the original URL below.
  }

  const withoutQuery = url.split("?")[0]?.split("#")[0] ?? "";
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
}

function isPlatformEndpoint(url?: string): boolean {
  const path = getUrlPath(url).toLowerCase();

  return (
    path === "/platform" ||
    path.startsWith("/platform/") ||
    path === "/api/platform" ||
    path.startsWith("/api/platform/") ||
    path === "/system-admin" ||
    path.startsWith("/system-admin/") ||
    path === "/api/system-admin" ||
    path.startsWith("/api/system-admin/")
  );
}

function isCompanyRegistryEndpoint(url?: string): boolean {
  const path = getUrlPath(url).toLowerCase();

  return path === "/companies" || path === "/api/companies";
}

function resolveRequestScope(url?: string): AuthScope {
  if (isPlatformEndpoint(url)) {
    return "platform";
  }

  if (isCompanyRegistryEndpoint(url)) {
    const platformAuth = getPlatformAuth();
    const workspaceAuth = getWorkspaceAuth();

    return platformAuth?.accessToken && !workspaceAuth?.accessToken
      ? "platform"
      : "workspace";
  }

  return "workspace";
}

function isLoginEndpoint(url?: string): boolean {
  const path = getUrlPath(url).toLowerCase();

  return (
    path === "/api/auth/login" ||
    path === "/api/auth/platform-login" ||
    path === "/auth/login" ||
    path === "/auth/platform-login"
  );
}

function isAuthEndpoint(url?: string): boolean {
  const path = getUrlPath(url).toLowerCase();

  return [
    "/api/auth/login",
    "/api/auth/platform-login",
    "/api/auth/register",
    "/api/auth/refresh",
    "/api/auth/logout",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",

    "/auth/login",
    "/auth/platform-login",
    "/auth/register",
    "/auth/refresh",
    "/auth/logout",
    "/auth/forgot-password",
    "/auth/reset-password",
  ].some((endpoint) => path.startsWith(endpoint));
}

// -----------------------------------------------------------------------------
// Authentication Resolution
// -----------------------------------------------------------------------------

function getPlatformAuth(): SessionAuth | null {
  const platformAuth = loadPlatformAuth();

  if (clean(platformAuth?.accessToken)) {
    return platformAuth;
  }

  // Temporary compatibility with sessions created before auth was split.
  const legacyAuth = loadAuth();

  if (
    clean(legacyAuth?.accessToken) &&
    hasSystemAdminRole(legacyAuth?.roles)
  ) {
    return legacyAuth;
  }

  return null;
}

function getWorkspaceAuth(): SessionAuth | null {
  const workspaceAuth = loadWorkspaceAuth();
  const legacyAuth = loadAuth();

  /*
   * Direct tenant login currently writes the fresh role/permission claims to
   * auth.storage first. Prefer it when company scoped so old tab-scoped
   * workspaceAuth cannot keep sending an outdated token to protected APIs.
   */
  if (
    clean(legacyAuth?.accessToken) &&
    clean(legacyAuth?.companyId) &&
    !(
      hasSystemAdminRole(legacyAuth?.roles) &&
      !clean(legacyAuth?.tenantSlug)
    )
  ) {
    return legacyAuth;
  }

  if (clean(workspaceAuth?.accessToken)) {
    return workspaceAuth;
  }

  // Temporary compatibility with tenant sessions created before auth was split.
  if (!clean(legacyAuth?.accessToken)) {
    return null;
  }

  // Never treat an unscoped legacy platform token as a workspace session.
  if (
    hasSystemAdminRole(legacyAuth?.roles) &&
    !clean(legacyAuth?.companyId) &&
    !clean(legacyAuth?.tenantSlug)
  ) {
    return null;
  }

  return legacyAuth;
}

// -----------------------------------------------------------------------------
// Tenant / Company / Branch Resolution
// -----------------------------------------------------------------------------

export function resolveTenantSlug(): string | null {
  const workspaceAuth = getWorkspaceAuth();

  const stored =
    workspaceAuth?.tenantSlug ??
    localStorage.getItem("tenantSlug") ??
    sessionStorage.getItem("tenantSlug") ??
    null;

  return clean(stored)?.toLowerCase() ?? null;
}

export function resolveCompanyId(): string | null {
  return clean(getWorkspaceAuth()?.companyId);
}

export function resolveBranchId(): string | null {
  const workspaceAuth = getWorkspaceAuth();
  const appScope = safeParseJson<{ branchId?: string | null }>(
    sessionStorage.getItem("rfnb.scope.v3") ??
    localStorage.getItem("rfnb.scope.v3")
  );

  if (appScope) {
    return clean(appScope.branchId);
  }

  return workspaceAuth?.isCompanyScoped === true
    ? null
    : clean(workspaceAuth?.branchId);
}

// -----------------------------------------------------------------------------
// Token Extraction
// -----------------------------------------------------------------------------

function extractToken(
  data: unknown,
  field: "accessToken" | "refreshToken",
): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const root = data as Record<string, unknown>;
  const nestedToken = root.token;

  if (nestedToken && typeof nestedToken === "object") {
    const tokenObj = nestedToken as Record<string, unknown>;

    const value =
      tokenObj[field] ??
      (field === "accessToken" ? tokenObj.token : null);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const flatValue = root[field];

  if (typeof flatValue === "string" && flatValue.trim()) {
    return flatValue.trim();
  }

  const innerData = root.data;

  if (innerData && typeof innerData === "object") {
    const innerValue = (innerData as Record<string, unknown>)[field];

    if (typeof innerValue === "string" && innerValue.trim()) {
      return innerValue.trim();
    }
  }

  if (
    field === "accessToken" &&
    typeof root.token === "string" &&
    root.token.trim()
  ) {
    return root.token.trim();
  }

  return null;
}

function extractExpiresAt(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const root = data as Record<string, unknown>;

  for (const field of ["expiresAt", "expiresAtUtc"] as const) {
    const value = root[field];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const nestedToken = root.token;

  if (nestedToken && typeof nestedToken === "object") {
    const tokenObject = nestedToken as Record<string, unknown>;

    for (const field of ["expiresAt", "expiresAtUtc"] as const) {
      const value = tokenObject[field];

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  const innerData = root.data;

  if (innerData && typeof innerData === "object") {
    const dataObject = innerData as Record<string, unknown>;

    for (const field of ["expiresAt", "expiresAtUtc"] as const) {
      const value = dataObject[field];

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Auth Event
// -----------------------------------------------------------------------------

export function dispatchUnauthenticated(scope?: AuthScope): void {
  window.dispatchEvent(
    new CustomEvent("auth:unauthenticated", {
      detail: scope ? { scope } : undefined,
    }),
  );
}

// -----------------------------------------------------------------------------
// Header Helpers
// -----------------------------------------------------------------------------

function asHeaders(
  config: InternalAxiosRequestConfig,
): Record<string, string> {
  config.headers ??= {} as typeof config.headers;

  return config.headers as unknown as Record<string, string>;
}

function removeHeader(
  headers: Record<string, string>,
  headerName: string,
): void {
  const expected = headerName.toLowerCase();

  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === expected) {
      delete headers[key];
    }
  }
}

function setAuthorization(
  headers: Record<string, string>,
  accessToken: string | null | undefined,
): void {
  removeHeader(headers, "Authorization");

  const token = clean(accessToken);

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
}

function removeTenantHeaders(
  headers: Record<string, string>,
): void {
  removeHeader(headers, "X-Tenant-Id");
  removeHeader(headers, "X-Tenant-Slug");
  removeHeader(headers, "X-Company-Id");
  removeHeader(headers, "X-Branch-Id");
}

function attachTenantHeaders(
  headers: Record<string, string>,
  includeScopeHeaders = true,
): void {
  // Prevent stale headers from a retried or reused request.
  removeTenantHeaders(headers);

  // Tenant slug stays session metadata. The API resolves tenant identity
  // from Host/X-Forwarded-Host against the platform tenant registry.
  if (!includeScopeHeaders) {
    return;
  }

  const companyId = resolveCompanyId();
  const branchId = resolveBranchId();

  if (companyId) {
    headers["X-Company-Id"] = companyId;
  }

  if (branchId) {
    headers["X-Branch-Id"] = branchId;
  }
}

// -----------------------------------------------------------------------------
// Scope-Specific Persistence
// -----------------------------------------------------------------------------

function clearScopeAuth(scope: AuthScope): void {
  if (scope === "platform") {
    clearPlatformAuth();
    return;
  }

  clearWorkspaceAuth();

  // Preserve legacy behavior for pre-migration workspace sessions.
  const legacyAuth = loadAuth();

  if (
    legacyAuth &&
    !(
      hasSystemAdminRole(legacyAuth.roles) &&
      !clean(legacyAuth.companyId) &&
      !clean(legacyAuth.tenantSlug)
    )
  ) {
    clearAuth();
  }
}

function persistRefreshedAuth(
  scope: AuthScope,
  currentAuth: SessionAuth,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: string,
): void {
  if (scope === "platform") {
    const nextPlatformAuth: PlatformAuth = {
      accessToken,
      refreshToken,
      expiresAt,
      roles: currentAuth.roles ?? [],
      permissions: currentAuth.permissions ?? [],
    };

    // Platform auth is normally a remembered administrator session.
    // Existing login code remains responsible for the initial remember choice.
    savePlatformAuth(nextPlatformAuth, true);
    const legacy=loadAuth();
    if(legacy?.accessToken===currentAuth.accessToken)saveAuth({...legacy,accessToken,refreshToken,expiresAt});
    return;
  }

  const companyId = clean(currentAuth.companyId);
  const companyName = clean(currentAuth.companyName);
  const tenantSlug = clean(currentAuth.tenantSlug);

  if (!companyId) {
    throw new Error(
      "Cannot persist a refreshed workspace token without company scope.",
    );
  }

  const nextWorkspaceAuth: WorkspaceAuth = {
    accessToken,
    refreshToken,
    expiresAt,
    companyId,
    companyName: companyName ?? "",
    tenantSlug: tenantSlug?.toLowerCase() ?? "",
    branchId: clean(currentAuth.branchId),
    branchName: clean(currentAuth.branchName),
    roles: currentAuth.roles ?? [],
    permissions: currentAuth.permissions ?? [],
  };

  saveWorkspaceAuth(nextWorkspaceAuth);

  // Keep old application consumers working while they are migrated.
  const legacyAuth = loadAuth();

  if (
    legacyAuth &&
    !(
      hasSystemAdminRole(legacyAuth.roles) &&
      !clean(legacyAuth.companyId) &&
      !clean(legacyAuth.tenantSlug)
    )
  ) {
    saveAuth({
      ...legacyAuth,
      accessToken,
      refreshToken,
      expiresAt,
    });
  }
}

// -----------------------------------------------------------------------------
// Refresh Token Flow
// -----------------------------------------------------------------------------

const refreshPromises: Record<
  AuthScope,
  Promise<string | null> | null
> = {
  platform: null,
  workspace: null,
};

export async function refreshAccessToken(
  scope: AuthScope,
): Promise<string | null> {
  const existingPromise = refreshPromises[scope];

  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async (): Promise<string | null> => {
    const auth =
      scope === "platform"
        ? getPlatformAuth()
        : getWorkspaceAuth();

    if (!auth?.refreshToken) {
      clearScopeAuth(scope);
      dispatchUnauthenticated(scope);
      return null;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (scope === "workspace") {
        attachTenantHeaders(headers, true);
      }

      const response = await axios.post(
        `${API_BASE}/auth/refresh`,
        {
          refreshToken: auth.refreshToken,
          companyId: scope === "workspace" ? auth.companyId : null,
          branchId: scope === "workspace" && !auth.isCompanyScoped ? auth.branchId : null,
        },
        {
          headers,
          withCredentials: false,
        },
      );

      const accessToken = extractToken(
        response.data,
        "accessToken",
      );

      const refreshToken =
        extractToken(response.data, "refreshToken") ??
        auth.refreshToken;

     const expiresAt =
          extractExpiresAt(response.data) ??
          clean(auth.expiresAt);

        if (!expiresAt) {
          clearScopeAuth(scope);
          dispatchUnauthenticated(scope);
          return null;
        }

      if (!accessToken) {
        clearScopeAuth(scope);
        dispatchUnauthenticated(scope);
        return null;
      }

      const current=scope==="platform"?getPlatformAuth():getWorkspaceAuth();
      if(!current||current.refreshToken!==auth.refreshToken||current.companyId!==auth.companyId)return null;
      persistRefreshedAuth(
        scope,
        current,
        accessToken,
        refreshToken,
        expiresAt,
      );

      window.dispatchEvent(new CustomEvent("auth:refreshed",{detail:{scope}}));
      return accessToken;
    } catch (error) {
      const current=scope==="platform"?getPlatformAuth():getWorkspaceAuth();
      if(!current||current.refreshToken!==auth.refreshToken||current.companyId!==auth.companyId)return null;
      // Network failures and server outages do not prove that the session is invalid.
      if(axios.isAxiosError(error)&&[400,401,403].includes(error.response?.status??0)){
        clearScopeAuth(scope);
        dispatchUnauthenticated(scope);
      }
      return null;
    } finally {
      refreshPromises[scope] = null;
    }
  })();

  refreshPromises[scope] = promise;
  return promise;
}

// -----------------------------------------------------------------------------
// Request Interceptor
// -----------------------------------------------------------------------------

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.url = normalizeAxiosUrl(config.url);

    const headers = asHeaders(config);
    const scope = resolveRequestScope(config.url);

    if (isAuthEndpoint(config.url)) {
      removeTenantHeaders(headers);
      const path = getUrlPath(config.url).toLowerCase();
      if (path === "/auth/logout" || path === "/api/auth/logout") {
        // Logout captures credentials before local session storage is cleared.
        if (!headers.Authorization) {
          setAuthorization(headers, getWorkspaceAuth()?.accessToken ?? getPlatformAuth()?.accessToken);
        }
      } else {
        removeHeader(headers, "Authorization");
      }
      return config;
    }

    if (scope === "platform") {
      // Platform APIs must never receive tenant context.
      removeTenantHeaders(headers);

      if (!isAuthEndpoint(config.url)) {
        markSessionActivity();
        setAuthorization(
          headers,
          getPlatformAuth()?.accessToken,
        );
      }

      return config;
    }

    attachTenantHeaders(headers, true);

    if (!isAuthEndpoint(config.url)) {
      markSessionActivity();
      setAuthorization(
        headers,
        getWorkspaceAuth()?.accessToken,
      );
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;

    if (!original) {
      return Promise.reject(error);
    }

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (original._retry) {
      return Promise.reject(error);
    }

    if (isAuthEndpoint(original.url)) {
      return Promise.reject(error);
    }

    original._retry = true;

    const scope = resolveRequestScope(original.url);
    const accessToken = await refreshAccessToken(scope);

    if (!accessToken) {
      return Promise.reject(error);
    }

    const headers = asHeaders(original);

    setAuthorization(headers, accessToken);

    if (scope === "platform") {
      removeTenantHeaders(headers);
    } else {
      attachTenantHeaders(headers, true);
    }

    return http.request(original);
  },
);
