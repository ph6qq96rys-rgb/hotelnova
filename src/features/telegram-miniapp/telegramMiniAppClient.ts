/**
 * One way for every Mini App screen to call the API.
 *
 * After sign-in the server issues a short-lived Mini App session; calls send it as X-Telegram-Session.
 * When it is about to expire (or the server says it has), the client renews it from the signed Telegram
 * login data and retries once. Before a session exists, calls fall back to the signed login data.
 */
import { getTelegramInitData } from "./telegramWebApp";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const RENEW_BEFORE_MS = 60_000;

type MiniAppSession = {
  token: string;
  expiresAt: number;
  tenantKey: string | null;
  companyId: string | null;
};

let session: MiniAppSession | null = null;
let renew: (() => Promise<void>) | null = null;
let renewing: Promise<void> | null = null;

export class MiniAppApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE.trim().replace(/\/+$/, "");
  if (!base) return `/api${normalizedPath}`;
  if (base.endsWith("/api")) return `${base}${normalizedPath}`;
  return `${base}/api${normalizedPath}`;
}

/** Stores the session returned by sign-in. */
export function setMiniAppSession(args: {
  token?: string | null;
  expiresAtUtc?: string | null;
  tenantKey?: string | null;
  companyId?: string | null;
}): void {
  if (!args.token) {
    session = null;
    return;
  }
  const expires = args.expiresAtUtc ? Date.parse(args.expiresAtUtc) : Date.now() + 25 * 60_000;
  session = {
    token: args.token,
    expiresAt: Number.isFinite(expires) ? expires : Date.now() + 25 * 60_000,
    tenantKey: args.tenantKey ?? null,
    companyId: args.companyId ?? null,
  };
}

export function clearMiniAppSession(): void {
  session = null;
}

export function getMiniAppTenantKey(): string | null {
  return session?.tenantKey ?? null;
}

/** Registers how to renew the session (sign in again with the signed Telegram login data). */
export function setMiniAppSessionRenewer(fn: (() => Promise<void>) | null): void {
  renew = fn;
}

async function renewSession(): Promise<void> {
  if (!renew) return;
  renewing ??= renew().finally(() => {
    renewing = null;
  });
  await renewing;
}

function authHeaders(): Record<string, string> {
  if (session) {
    const headers: Record<string, string> = { "X-Telegram-Session": session.token };
    if (session.companyId) headers["X-Company-Id"] = session.companyId;
    return headers;
  }
  const initData = getTelegramInitData();
  return initData ? { "X-Telegram-InitData": initData } : {};
}

export type MiniAppRequest = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  signal?: AbortSignal;
};

/** Calls a Mini App endpoint (path relative to /api, for example "/telegram/miniapp/siv/mine"). */
export async function miniAppRequest<T>(path: string, request: MiniAppRequest = {}, retried = false): Promise<T> {
  if (session && session.expiresAt - Date.now() < RENEW_BEFORE_MS) {
    await renewSession().catch(() => undefined);
  }

  const url = new URL(apiUrl(path), window.location.origin);
  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: request.method ?? (request.body === undefined ? "GET" : "POST"),
    headers: {
      ...(request.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...authHeaders(),
    },
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    signal: request.signal,
  });

  const text = await response.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (response.status === 401 && !retried && renew && errorCode(data) === "telegram_session_expired") {
    session = null;
    await renewSession();
    return miniAppRequest<T>(path, request, true);
  }

  if (!response.ok || (isRecord(data) && data.success === false)) {
    throw new MiniAppApiError(errorMessage(data, response.status), response.status, errorCode(data));
  }

  return data as T;
}

/** A new id for one submission; reuse it when the same submission is retried. */
export function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
  );
}

export function describeError(error: unknown, fallback: string): string {
  if (error instanceof MiniAppApiError || error instanceof Error) return error.message || fallback;
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorCode(data: unknown): string | null {
  return isRecord(data) && typeof data.errorCode === "string" ? data.errorCode : null;
}

function errorMessage(data: unknown, status: number): string {
  if (typeof data === "string" && data.trim() && data.length < 400) return data.trim();
  if (isRecord(data)) {
    // Validation problems: { errors: { field: ["message"] } }
    if (isRecord(data.errors)) {
      const first = Object.values(data.errors).flat().find((x) => typeof x === "string" && x.trim());
      if (typeof first === "string") return first;
    }
    for (const key of ["message", "error", "detail", "title"]) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  if (status === 401) return "Your Telegram session could not be verified. Close and reopen the Mini App.";
  if (status === 403) return "You do not have access to this action.";
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  return `Request failed (HTTP ${status}).`;
}
