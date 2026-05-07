import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { loadAuth, saveAuth, clearAuth } from "../auth/auth.storage";

const base =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:5009";
export const API_BASE = `${base}/api`;

export const http = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  withCredentials: false, // set true if using HttpOnly refresh cookies
});

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

// Normalize to a pathname-ish string for matching
function getUrlPath(url?: string) {
  if (!url) return "";
  try {
    if (url.startsWith("http")) return new URL(url).pathname;
  } catch {}
  return url; // relative path
}

// Match auth endpoints reliably (whether "/api/auth/login" or "/auth/login")
function isAuthEndpoint(url?: string) {
  const p = getUrlPath(url).toLowerCase();
  return (
    p.includes("/auth/login") ||
    p.includes("/auth/register") ||
    p.includes("/auth/refresh")
  );
}

function setAuthHeader(config: InternalAxiosRequestConfig, token: string) {
  config.headers = config.headers ?? {};
  config.headers.Authorization = `Bearer ${token}`;
}

/* ------------------------------------------------------------------ */
/* Refresh handling (single flight + queue) */
/* ------------------------------------------------------------------ */

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const auth = loadAuth();
    const refreshToken = auth?.refreshToken;

    // If you require refreshToken but don't have it -> fail
    if (!refreshToken) {
      clearAuth();
      return null;
    }

    try {
      // IMPORTANT: call refresh endpoint with a "bare" axios instance
      // so the interceptor doesn't recurse.
      const res = await axios.post(
        `${API_BASE}/auth/refresh`,
        { refreshToken },
        { headers: { "Content-Type": "application/json" }, withCredentials: false }
      );

      const accessToken: string | undefined =
        res.data?.token?.accessToken ??
        res.data?.accessToken ??
        res.data?.token;

      const newRefreshToken: string | undefined =
        res.data?.token?.refreshToken ?? res.data?.refreshToken;

      const expiresAt: string | undefined =
        res.data?.token?.expiresAt ?? res.data?.expiresAt;

      if (!accessToken) {
        clearAuth();
        return null;
      }

      saveAuth({
        user: auth?.user ?? null,
        accessToken,
        refreshToken: newRefreshToken ?? refreshToken ?? null,
        expiresAt: expiresAt ?? auth?.expiresAt ?? null,
      });

      return accessToken;
    } catch {
      clearAuth();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/* ------------------------------------------------------------------ */
/* Request interceptor: attach access token */
/* ------------------------------------------------------------------ */

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (isAuthEndpoint(config.url)) return config;

    const auth = loadAuth();
    const token = auth?.accessToken;

    if (token) setAuthHeader(config, token);

    return config;
  },
  (error) => Promise.reject(error)
);

/* ------------------------------------------------------------------ */
/* Response interceptor: 401 -> refresh -> retry once */
/* ------------------------------------------------------------------ */

http.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const status = err.response?.status;

    const original =
      err.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (!original) return Promise.reject(err);

    // Never refresh for auth endpoints
    if (status === 401 && !original._retry && !isAuthEndpoint(original.url)) {
      original._retry = true;

      const nextToken = await refreshAccessToken();
      if (!nextToken) {
        // IMPORTANT:
        // Do NOT hard-redirect here. Just reject.
        // Guards/AuthProvider will detect missing auth and route to /login.
        return Promise.reject(err);
      }

      setAuthHeader(original, nextToken);
      return http.request(original);
    }

    return Promise.reject(err);
  }
);

/* ------------------------------------------------------------------ */
/* OPTIONAL: If you really need fetch wrapper, make it safe */
/* ------------------------------------------------------------------ */

export async function apiFetch(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);

  // ❌ DO NOT redirect here.
  // This causes loops and fights your router/guards.
  // Let your app handle 401 centrally (RequireAuth/AuthProvider).
  return res;
}
