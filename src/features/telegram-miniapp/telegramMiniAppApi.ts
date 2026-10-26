import type { TelegramMiniAppAuthResult } from "./telegramMiniApp.types";
import { apiUrl, miniAppRequest } from "./telegramMiniAppClient";

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

/*
 * Employee self-service calls. The Mini App session identifies the employee, so the bodies carry only
 * the request itself (see telegramMiniAppClient).
 */
export function getTelegramLeaveTypes(): Promise<TelegramLeaveTypeDto[]> {
  return miniAppRequest<TelegramLeaveTypeDto[]>("/telegram/miniapp/leave/types", { body: {} });
}

export function getTelegramLeaveBalances(year: number): Promise<TelegramLeaveBalanceDto[]> {
  return miniAppRequest<TelegramLeaveBalanceDto[]>("/telegram/miniapp/leave/balances", { body: { year } });
}

export function getTelegramLeaveRequests(year?: number): Promise<TelegramLeaveRequestDto[]> {
  return miniAppRequest<TelegramLeaveRequestDto[]>("/telegram/miniapp/leave/requests/list", { body: { year } });
}

export function submitTelegramLeaveRequest(body: {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod?: "Morning" | "Afternoon" | null;
  reason: string;
  documentUrl?: string | null;
}): Promise<{ success: boolean; id?: string; message?: string }> {
  return miniAppRequest("/telegram/miniapp/leave/requests", { body });
}

export function submitTelegramOvertimeRequest(body: {
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
}): Promise<{ success: boolean; id?: string; message?: string }> {
  return miniAppRequest("/telegram/miniapp/overtime/requests", { body });
}

/* Stock issue requests (SIVs). */
export type TelegramSivLineSummaryDto = {
  itemName: string;
  requestedQty: number;
  approvedQty?: number | null;
  issuedQty?: number | null;
  uomCode?: string | null;
};

export type TelegramSivSummaryDto = {
  id: string;
  sivNo: string;
  status: string;
  createdOrIssueDateUtc: string;
  submittedAtUtc?: string | null;
  decidedAtUtc?: string | null;
  fromLocationName?: string | null;
  toLocationName?: string | null;
  requesterName?: string | null;
  remarks?: string | null;
  lineCount: number;
  lines: TelegramSivLineSummaryDto[];
};

export function getMyTelegramSivs(days = 60, signal?: AbortSignal): Promise<TelegramSivSummaryDto[]> {
  return miniAppRequest<TelegramSivSummaryDto[]>("/telegram/miniapp/siv/mine", { query: { days }, signal });
}

export function getTelegramSivApprovals(signal?: AbortSignal): Promise<TelegramSivSummaryDto[]> {
  return miniAppRequest<TelegramSivSummaryDto[]>("/telegram/miniapp/siv/approvals", { signal });
}

export function approveTelegramSiv(sivId: string, body: { remarks?: string | null; overrideReason?: string | null }) {
  return miniAppRequest<{ success?: boolean; message?: string }>(
    `/telegram/miniapp/siv/approvals/${encodeURIComponent(sivId)}/approve`, { body });
}

export function rejectTelegramSiv(sivId: string, remarks: string) {
  return miniAppRequest<{ success?: boolean; message?: string }>(
    `/telegram/miniapp/siv/approvals/${encodeURIComponent(sivId)}/reject`, { body: { remarks } });
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
