// src/auth/auth.api.ts

import axios from "axios";

import { http } from "../api/http";
import type {
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ResetPasswordRequest,
} from "./auth.types";

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

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeTenantSlug(value: unknown): string | null {
  return clean(value)?.toLowerCase() ?? null;
}

function getStoredTenantSlug(): string | null {
  return normalizeTenantSlug(
    localStorage.getItem("tenantSlug") ??
      sessionStorage.getItem("tenantSlug")
  );
}

function rememberTenantSlug(tenantSlug: string | null): void {
  const cleanSlug = normalizeTenantSlug(tenantSlug);

  if (!cleanSlug) return;

  localStorage.setItem("tenantSlug", cleanSlug);
  sessionStorage.setItem("tenantSlug", cleanSlug);

  localStorage.removeItem("tenantId");
  sessionStorage.removeItem("tenantId");
}

function clearTenantScope(): void {
  localStorage.removeItem("tenantSlug");
  localStorage.removeItem("tenantId");
  localStorage.removeItem("companyId");
  localStorage.removeItem("branchId");

  sessionStorage.removeItem("tenantSlug");
  sessionStorage.removeItem("tenantId");
  sessionStorage.removeItem("companyId");
  sessionStorage.removeItem("branchId");
}

function tenantHeaders(
  tenantSlug: string | null
): Record<string, string> | undefined {
  return tenantSlug ? { "X-Tenant-Id": tenantSlug } : undefined;
}

function extractValidationErrors(errors: unknown): string | null {
  if (!errors) return null;

  if (Array.isArray(errors)) {
    return errors.map(String).filter(Boolean).join("\n") || null;
  }

  if (typeof errors === "object") {
    return (
      Object.values(errors as Record<string, unknown>)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean)
        .join("\n") || null
    );
  }

  return null;
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;

  const body = data as Record<string, unknown>;

  return (
    clean(body.error) ??
    clean(body.message) ??
    extractValidationErrors(body.errors) ??
    clean(body.detail) ??
    clean(body.title) ??
    fallback
  );
}

function normalizeError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (!axios.isAxiosError(error)) throw error;

  const status = error.response?.status ?? null;
  const data = error.response?.data;

  const fallback = !error.response
    ? "Unable to reach the server. Please check your connection and try again."
    : error.message || "Request failed.";

  throw new ApiError(extractErrorMessage(data, fallback), status, data);
}

function attachTenantSlug(
  response: LoginResponse,
  tenantSlug: string | null
): LoginResponse {
  const responseTenantSlug = normalizeTenantSlug(response.tenantSlug);
  const finalTenantSlug = responseTenantSlug ?? tenantSlug;

  return {
    ...response,
    tenantSlug: finalTenantSlug,
  };
}

export const authApi = {
  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      const tenantSlug = normalizeTenantSlug(request.tenantSlug);
      const email = normalizeEmail(request.email);

      const response = await http.post<LoginResponse>(
        "/auth/login",
        {
          tenantSlug,
          email,
          password: request.password,
        },
        {
          headers: tenantHeaders(tenantSlug),
        }
      );

      if (tenantSlug) {
        rememberTenantSlug(tenantSlug);
      } else {
        clearTenantScope();
      }

      return attachTenantSlug(response.data, tenantSlug);
    } catch (error) {
      normalizeError(error);
    }
  },

  async register(_request: RegisterRequest): Promise<LoginResponse> {
    throw new ApiError(
      "Self-registration is disabled. Please contact your company administrator.",
      403
    );
  },

  async me(): Promise<AuthUser> {
    try {
      const response = await http.get<AuthUser>("/auth/me");
      return response.data;
    } catch (error) {
      normalizeError(error);
    }
  },

  async logout(): Promise<void> {
    try {
      await http.post("/auth/logout", {});
    } catch {
      // Local logout must continue even if server logout fails.
    }
  },

  async forgotPassword(
    request: ForgotPasswordRequest | string
  ): Promise<void> {
    try {
      const tenantSlug =
        typeof request === "string"
          ? getStoredTenantSlug()
          : normalizeTenantSlug(request.tenantSlug) ?? getStoredTenantSlug();

      const email =
        typeof request === "string"
          ? normalizeEmail(request)
          : normalizeEmail(request.email);

      await http.post(
        "/auth/forgot-password",
        {
          tenantSlug,
          email,
        },
        {
          headers: tenantHeaders(tenantSlug),
        }
      );
    } catch (error) {
      normalizeError(error);
    }
  },

  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    try {
      const tenantSlug =
        normalizeTenantSlug(request.tenantSlug) ?? getStoredTenantSlug();

      await http.post(
        "/auth/reset-password",
        {
          tenantSlug,
          email: normalizeEmail(request.email),
          token: request.token,
          newPassword: request.newPassword,
        },
        {
          headers: tenantHeaders(tenantSlug),
        }
      );
    } catch (error) {
      normalizeError(error);
    }
  },
};