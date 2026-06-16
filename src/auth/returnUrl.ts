// src/auth/returnUrl.ts

const BLOCKED_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password"];
const MAX_LENGTH = 2048;

export function safeReturnUrl(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;

  let url = raw;
  try {
    url = decodeURIComponent(raw);
  } catch {
    // keep raw
  }

  url = url.trim();

  if (!url.startsWith("/")) return fallback;
  if (url.startsWith("//")) return fallback;
  if (url.length > MAX_LENGTH) return fallback;

  const lowered = url.toLowerCase();
  if (lowered.includes("javascript:")) return fallback;
  if (lowered.startsWith("/\\")) return fallback;
  if (lowered.includes("/../") || lowered.includes("\\..\\")) return fallback;

  for (const prefix of BLOCKED_PREFIXES) {
    if (lowered === prefix || lowered.startsWith(`${prefix}?`) || lowered.startsWith(`${prefix}/`)) {
      return fallback;
    }
  }

  return url;
}
