// src/api/http.ts
//
// Central Axios instance.
//
// Request interceptor attaches:
//   X-Tenant-Id   — database routing (TenantMiddleware)
//   X-Company-Id  — business-entity scoping (AuthController, service layer)
//   X-Branch-Id   — branch scoping (optional, omitted when absent)
//   Authorization — Bearer token on non-auth requests
//
// Response interceptor handles 401 → silent refresh → retry (single-flight).

import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { loadAuth, saveAuth, clearAuth, getCompanyId, getBranchId } from "../auth/auth.storage";

// ── Base URL ──────────────────────────────────────────────────────────────────

const base =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:5009";

export const API_BASE = `${base}/api`;

// ── Tenant / company resolution ───────────────────────────────────────────────

/** Tenant ID used by TenantMiddleware to select the database.
 *
 * Resolution order:
 *   1. localStorage "tenantId"   — explicit tenant key (multi-tenant picker)
 *   2. localStorage "companyId"  — for systems where tenant === company (most common)
 *   3. VITE_TENANT_ID env var    — dev/staging convenience default
 *
 * In most RestaurantFNB deployments each company IS the tenant (one DB per
 * company), so companyId doubles as the tenant identifier. If your deployment
 * uses a separate tenant slug, store it under "tenantId" after login.
 */
export function resolveTenantId(): string | null {
  return (
    localStorage.getItem("tenantId")  ??
    localStorage.getItem("companyId") ??
    (import.meta.env.VITE_TENANT_ID as string | undefined) ??
    null
  );
}

/** Company GUID used by the service layer for business-entity scoping. */
export function resolveCompanyId(): string | null {
  return getCompanyId() ?? (import.meta.env.VITE_COMPANY_ID as string | undefined) ?? null;
}

/** Branch GUID — optional, omitted from headers when absent. */
export function resolveBranchId(): string | null {
  return getBranchId() ?? null;
}

// ── Axios instance ────────────────────────────────────────────────────────────

export const http = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUrlPath(url?: string): string {
  if (!url) return "";
  try { if (url.startsWith("http")) return new URL(url).pathname; }
  catch { /* fall through */ }
  return url;
}

function isAuthEndpoint(url?: string): boolean {
  const path = getUrlPath(url).toLowerCase();
  return [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
    "/api/auth/logout",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
  ].some(p => path.startsWith(p));
}

// ── Token extraction (handles multiple backend shapes) ────────────────────────

function extractToken(data: unknown, field: "accessToken" | "refreshToken"): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const nested = d.token;
  if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    const v = n[field] ?? (field === "accessToken" ? n.token : null);
    if (typeof v === "string" && v) return v;
  }
  const flat = d[field];
  if (typeof flat === "string" && flat) return flat;
  const inner = d.data;
  if (inner && typeof inner === "object") {
    const iv = (inner as Record<string, unknown>)[field];
    if (typeof iv === "string" && iv) return iv;
  }
  if (field === "accessToken" && typeof d.token === "string" && d.token) return d.token;
  return null;
}

function extractExpiresAt(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.expiresAt === "string") return d.expiresAt;
  const nested = d.token;
  if (nested && typeof nested === "object") {
    const v = (nested as Record<string, unknown>).expiresAt;
    if (typeof v === "string") return v;
  }
  return null;
}

// ── Session invalidation event ────────────────────────────────────────────────
//
// AuthProvider listens for this to redirect to /login without a circular import.
//
//   useEffect(() => {
//     const handler = () => logoutAndRedirect();
//     window.addEventListener("auth:unauthenticated", handler);
//     return () => window.removeEventListener("auth:unauthenticated", handler);
//   }, [logoutAndRedirect]);

export function dispatchUnauthenticated(): void {
  window.dispatchEvent(new CustomEvent("auth:unauthenticated"));
}

// ── Refresh (single-flight) ───────────────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<string | null> => {
    const auth = loadAuth();
    if (!auth?.refreshToken) {
      clearAuth();
      dispatchUnauthenticated();
      return null;
    }

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const tenantId  = resolveTenantId();
      const companyId = resolveCompanyId();
      const branchId  = resolveBranchId();
      if (tenantId)  headers["X-Tenant-Id"]  = tenantId;
      if (companyId) headers["X-Company-Id"] = companyId;
      if (branchId)  headers["X-Branch-Id"]  = branchId;

      const res = await axios.post(
        `${API_BASE}/auth/refresh`,
        { refreshToken: auth.refreshToken },
        { headers, withCredentials: false }
      );

      const accessToken  = extractToken(res.data, "accessToken");
      const refreshToken = extractToken(res.data, "refreshToken") ?? auth.refreshToken;
      const expiresAt    = extractExpiresAt(res.data) ?? auth.expiresAt;

      if (!accessToken) {
        clearAuth();
        dispatchUnauthenticated();
        return null;
      }

      saveAuth({ ...auth, accessToken, refreshToken, expiresAt });
      return accessToken;
    } catch {
      clearAuth();
      dispatchUnauthenticated();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── Request interceptor ───────────────────────────────────────────────────────

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers ??= {} as typeof config.headers;

    const tenantId  = resolveTenantId();
    const companyId = resolveCompanyId();
    const branchId  = resolveBranchId();

    if (tenantId)  config.headers["X-Tenant-Id"]  = tenantId;
    if (companyId) config.headers["X-Company-Id"] = companyId;
    if (branchId)  config.headers["X-Branch-Id"]  = branchId;

    if (!isAuthEndpoint(config.url)) {
      const token = loadAuth()?.accessToken;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  err => Promise.reject(err)
);

// ── Response interceptor: 401 → refresh → retry ───────────────────────────────

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

http.interceptors.response.use(
  res => res,
  async (err: AxiosError) => {
    const original = err.config as RetryConfig | undefined;
    if (!original)                    return Promise.reject(err);
    if (err.response?.status !== 401) return Promise.reject(err);
    if (original._retry)              return Promise.reject(err);
    if (isAuthEndpoint(original.url)) return Promise.reject(err);

    original._retry = true;
    const token = await refreshAccessToken();
    if (!token) return Promise.reject(err);

    original.headers ??= {} as typeof original.headers;
    original.headers.Authorization = `Bearer ${token}`;
    return http.request(original);
  }
);