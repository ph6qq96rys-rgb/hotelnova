import type { TelegramMiniAppAuthResult } from "./telegramMiniApp.types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

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

  const response = await fetch(`${API_BASE}/api/telegram/miniapp/auth`, {
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
    throw new Error(result.message ?? "Telegram authentication failed.");
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

  const response = await fetch(`${API_BASE}/api/telegram/miniapp/link-employee`, {
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

console.log("LINK RESPONSE", response.status, result);

if (!response.ok || result.success === false) {
    throw new Error(
        result.message ??
        `HTTP ${response.status} - Unable to link Telegram account.`
    );
}

  return normalizeAuthResult(result);
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
