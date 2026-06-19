// src/api/http.ts
//
// Central Axios instance for RestaurantFNB / Hotelnova.
//
// ERP-grade behavior:
// - Uses VITE_API_BASE_URL when provided.
// - Defaults to "/api" for Docker/Nginx reverse proxy.
// - NEVER falls back to localhost.
// - Sends X-Tenant-Id as tenant SLUG, not companyId.
// - Sends company/branch headers only after login.
// - Attaches Bearer token for protected requests.
// - Handles 401 with single-flight refresh and retry.

import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

import { clearAuth, loadAuth, saveAuth } from "../auth/auth.storage";

// ─────────────────────────────────────────────────────────────────────────────
// API Base URL
// ─────────────────────────────────────────────────────────────────────────────

function cleanBaseUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed || trimmed === "/") return "/api";

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

// ─────────────────────────────────────────────────────────────────────────────
// Tenant / Company / Branch Resolution
// ─────────────────────────────────────────────────────────────────────────────

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

export function resolveTenantSlug(): string | null {
  const auth = loadAuth();

  const stored =
    auth?.tenantSlug ??
    localStorage.getItem("tenantSlug") ??
    sessionStorage.getItem("tenantSlug") ??
    null;

  return clean(stored)?.toLowerCase() ?? null;
}

export function resolveCompanyId(): string | null {
  return clean(loadAuth()?.companyId);
}

export function resolveBranchId(): string | null {
  return clean(loadAuth()?.branchId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Axios Instance
// ─────────────────────────────────────────────────────────────────────────────

export const http = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getUrlPath(url?: string): string {
  if (!url) return "";

  try {
    if (url.startsWith("http")) {
      return new URL(url).pathname;
    }
  } catch {
    // keep original URL below
  }

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

    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/auth/logout",
    "/auth/forgot-password",
    "/auth/reset-password",
  ].some((endpoint) => path.startsWith(endpoint));
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractToken(
  data: unknown,
  field: "accessToken" | "refreshToken"
): string | null {
  if (!data || typeof data !== "object") return null;

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
  if (!data || typeof data !== "object") return null;

  const root = data as Record<string, unknown>;

  if (typeof root.expiresAt === "string" && root.expiresAt.trim()) {
    return root.expiresAt.trim();
  }

  const nestedToken = root.token;

  if (nestedToken && typeof nestedToken === "object") {
    const value = (nestedToken as Record<string, unknown>).expiresAt;

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const innerData = root.data;

  if (innerData && typeof innerData === "object") {
    const value = (innerData as Record<string, unknown>).expiresAt;

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Event
// ─────────────────────────────────────────────────────────────────────────────

export function dispatchUnauthenticated(): void {
  window.dispatchEvent(new CustomEvent("auth:unauthenticated"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Header Helpers
// ─────────────────────────────────────────────────────────────────────────────

function attachTenantHeaders(
  headers: Record<string, string>,
  includeScopeHeaders = true
): void {
  const tenantSlug = resolveTenantSlug();

  if (tenantSlug) {
    headers["X-Tenant-Id"] = tenantSlug;
  }

  if (!includeScopeHeaders) return;

  const companyId = resolveCompanyId();
  const branchId = resolveBranchId();

  if (companyId) {
    headers["X-Company-Id"] = companyId;
  }

  if (branchId) {
    headers["X-Branch-Id"] = branchId;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Refresh Token Flow
// ─────────────────────────────────────────────────────────────────────────────

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
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      attachTenantHeaders(headers, true);

      const response = await axios.post(
        `${API_BASE}/auth/refresh`,
        {
          refreshToken: auth.refreshToken,
        },
        {
          headers,
          withCredentials: false,
        }
      );

      const accessToken = extractToken(response.data, "accessToken");
      const refreshToken =
        extractToken(response.data, "refreshToken") ?? auth.refreshToken;
      const expiresAt = extractExpiresAt(response.data) ?? auth.expiresAt;

      if (!accessToken) {
        clearAuth();
        dispatchUnauthenticated();
        return null;
      }

      saveAuth({
        ...auth,
        accessToken,
        refreshToken,
        expiresAt,
      });

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

// ─────────────────────────────────────────────────────────────────────────────
// Request Interceptor
// ─────────────────────────────────────────────────────────────────────────────

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers ??= {} as typeof config.headers;

    const headers = config.headers as unknown as Record<string, string>;

    attachTenantHeaders(headers, true);

    if (!isAuthEndpoint(config.url)) {
      const accessToken = loadAuth()?.accessToken;

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─────────────────────────────────────────────────────────────────────────────
// Response Interceptor: 401 → Refresh → Retry
// ─────────────────────────────────────────────────────────────────────────────

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;

    if (!original) return Promise.reject(error);
    if (error.response?.status !== 401) return Promise.reject(error);
    if (original._retry) return Promise.reject(error);
    if (isAuthEndpoint(original.url)) return Promise.reject(error);

    original._retry = true;

    const accessToken = await refreshAccessToken();

    if (!accessToken) {
      return Promise.reject(error);
    }

    original.headers ??= {} as typeof original.headers;

    const headers = original.headers as unknown as Record<string, string>;
    headers.Authorization = `Bearer ${accessToken}`;

    return http.request(original);
  }
);