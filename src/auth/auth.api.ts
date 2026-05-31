// src/auth/auth.api.ts
//
// HTTP client for auth endpoints.
// All headers (X-Tenant-Id, X-Company-Id, X-Branch-Id, Authorization) are
// injected by the http.ts interceptor — no manual header passing here.

import axios from "axios";
import { http } from "../api/http";
import type {
  LoginRequest, LoginResponse,
  RegisterRequest, ResetPasswordRequest, AuthUser,
} from "./auth.types";

// ── Error normalisation ───────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function extractValidationErrors(errors: unknown): string | null {
  if (!errors) return null;
  if (Array.isArray(errors))
    return errors.filter(Boolean).join("\n") || null;
  if (typeof errors === "object") {
    const msgs = Object.values(errors as Record<string, unknown>)
      .flatMap(v => Array.isArray(v) ? v : [v])
      .filter((v): v is string => typeof v === "string");
    return msgs.join("\n") || null;
  }
  return null;
}

function normalizeError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? null;
    const data   = err.response?.data as Record<string, unknown> | undefined;
    const message =
      (typeof data?.error   === "string" ? data.error   : null) ??
      (typeof data?.message === "string" ? data.message : null) ??
      extractValidationErrors(data?.errors)                      ??
      (typeof data?.detail  === "string" ? data.detail  : null) ??
      (typeof data?.title   === "string" ? data.title   : null) ??
      err.message ?? "Request failed.";
    throw new ApiError(message, status, data);
  }
  throw err;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const authApi = {
  async login(req: LoginRequest): Promise<LoginResponse> {
    try {
      const res = await http.post<LoginResponse>("/auth/login", {
        email:    req.email.trim().toLowerCase(),
        password: req.password,
      });
      return res.data;
    } catch (err) { normalizeError(err); }
  },

  async register(req: RegisterRequest): Promise<LoginResponse> {
    try {
      const res = await http.post<LoginResponse>("/auth/register", {
        ...req,
        email: req.email.trim().toLowerCase(),
      });
      return res.data;
    } catch (err) { normalizeError(err); }
  },

  async me(): Promise<AuthUser> {
    try {
      return (await http.get<AuthUser>("/auth/me")).data;
    } catch (err) { normalizeError(err); }
  },

  /** Fire-and-forget — client always clears state regardless of response. */
  async logout(): Promise<void> {
    try { await http.post("/auth/logout", {}); }
    catch { /* intentional no-op */ }
  },

  async forgotPassword(email: string): Promise<void> {
    try {
      await http.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
    } catch (err) { normalizeError(err); }
  },

  async resetPassword(req: ResetPasswordRequest): Promise<void> {
    try { await http.post("/auth/reset-password", req); }
    catch (err) { normalizeError(err); }
  },
};