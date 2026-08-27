import type { TelegramMiniAppAuthResult } from "./telegramMiniApp.types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE.trim().replace(/\/+$/, "");

  if (!base) return `/api${normalizedPath}`;
  if (base.endsWith("/api")) return `${base}${normalizedPath}`;

  return `${base}/api${normalizedPath}`;
}

function normalizeTenantKey(value?: string | null): string | null {
  const tenantKey = value?.trim();
  return tenantKey ? tenantKey : null;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text);
  }
}

export async function authenticateTelegramMiniApp(args: {
  initData: string;
  tenantKey?: string | null;
  signal?: AbortSignal;
}): Promise<TelegramMiniAppAuthResult> {
  const tenantKey = normalizeTenantKey(args.tenantKey);

  if (!tenantKey) {
    throw new Error(
      "Tenant context is missing. Open the Mini App from the tenant bot link with startapp=<tenantKey>.",
    );
  }

  const response = await fetch(apiUrl("/telegram/miniapp/auth"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      initData: args.initData,
      tenantKey,
      startParam: tenantKey,
    }),
    signal: args.signal,
  });

  const result = await parseJson<TelegramMiniAppAuthResult>(response);

  if (!response.ok) {
    throw new Error(formatTelegramApiError(
      response,
      result,
      "Telegram authentication failed.",
    ));
  }

  return normalizeAuthResult(result);
}

export async function linkTelegramEmployee(args: {
  initData: string;
  linkToken: string;
  consentAccepted: boolean;
  tenantKey?: string | null;
  signal?: AbortSignal;
}): Promise<TelegramMiniAppAuthResult> {
  const tenantKey = normalizeTenantKey(args.tenantKey);

  if (!tenantKey) {
    throw new Error(
      "Tenant context is missing. Open the Mini App from the tenant bot link with startapp=<tenantKey>.",
    );
  }

  const response = await fetch(apiUrl("/telegram/miniapp/link-employee"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      initData: args.initData,
      tenantKey,
      startParam: tenantKey,
      linkToken: args.linkToken,
      consentAccepted: args.consentAccepted,
    }),
    signal: args.signal,
  });

  const result = await parseJson<TelegramMiniAppAuthResult>(response);

  if (!response.ok || result.success === false) {
    throw new Error(formatTelegramApiError(
      response,
      result,
      "Unable to link Telegram account.",
    ));
  }

  return normalizeAuthResult(result);
}

export type TelegramMiniAppScope = {
  initData: string;
  tenantKey?: string | null;
  companyId?: string | null;
};

export type TelegramLeaveTypeDto = {
  id: string;
  code: string;
  name: string;
  requiresDocument: boolean;
  allowNegativeBalance: boolean;
};

export type TelegramLeaveBalanceDto = {
  leaveTypeId: string;
  leaveTypeName: string;
  entitlement: number;
  used: number;
  pending: number;
  available: number;
};

export type TelegramLeaveRequestDto = {
  id: string;
  requestNo: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  status: string;
  reason: string;
  createdAt: string;
};

export async function getTelegramLeaveTypes(
  scope: TelegramMiniAppScope,
): Promise<TelegramLeaveTypeDto[]> {
  return telegramPost<TelegramLeaveTypeDto[]>("/telegram/miniapp/leave/types", scope);
}

export async function getTelegramLeaveBalances(
  scope: TelegramMiniAppScope,
  year: number,
): Promise<TelegramLeaveBalanceDto[]> {
  return telegramPost<TelegramLeaveBalanceDto[]>("/telegram/miniapp/leave/balances", {
    ...scope,
    year,
  });
}

export async function getTelegramLeaveRequests(
  scope: TelegramMiniAppScope,
  year?: number,
): Promise<TelegramLeaveRequestDto[]> {
  return telegramPost<TelegramLeaveRequestDto[]>("/telegram/miniapp/leave/requests/list", {
    ...scope,
    year,
  });
}

export async function submitTelegramLeaveRequest(
  scope: TelegramMiniAppScope,
  body: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    isHalfDay: boolean;
    halfDayPeriod?: "Morning" | "Afternoon" | null;
    reason: string;
    documentUrl?: string | null;
  },
): Promise<{ success: boolean; id?: string; message?: string }> {
  return telegramPost("/telegram/miniapp/leave/requests", {
    ...scope,
    ...body,
  });
}

export async function submitTelegramOvertimeRequest(
  scope: TelegramMiniAppScope,
  body: {
    date: string;
    plannedStartUtc?: string | null;
    plannedEndUtc?: string | null;
    hours: number;
    businessReason: string;
    workAssignment: string;
    kpiDescription: string;
    kpiTarget: string;
    kpiMeasurementMethod: string;
    requiredEvidence?: string | null;
    completionDeadlineUtc?: string | null;
    relatedActivity?: string | null;
  },
): Promise<{ success: boolean; id?: string; message?: string }> {
  return telegramPost("/telegram/miniapp/overtime/requests", {
    ...scope,
    ...body,
  });
}

function normalizeAuthResult(
  result: TelegramMiniAppAuthResult,
): TelegramMiniAppAuthResult {
  return {
    ...result,
    success: Boolean(result.success),
    requiresEmployeeLink: Boolean(result.requiresEmployeeLink),
  };
}

async function telegramPost<T>(
  path: string,
  body: TelegramMiniAppScope & Record<string, unknown>,
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      tenantKey: normalizeTenantKey(body.tenantKey as string | null | undefined),
      startParam: normalizeTenantKey(body.tenantKey as string | null | undefined),
    }),
  });

  const result = await parseJson<T & { success?: boolean; message?: string }>(response);

  if (!response.ok || result.success === false) {
    const message =
      typeof result.message === "string" && result.message.trim()
        ? result.message
        : `Telegram request failed. (HTTP ${response.status})`;
    throw new Error(message);
  }

  return result;
}

function formatTelegramApiError(
  response: Response,
  result: Partial<TelegramMiniAppAuthResult>,
  fallback: string,
): string {
  const message = result.message?.trim();
  if (message) return message;

  const code = result.errorCode?.trim();
  if (code) return `${fallback} (${code})`;

  return `${fallback} (HTTP ${response.status})`;
}
