// src/auth/returnUrl.ts
//
// Validates and sanitises a return URL before using it in a redirect.
// Prevents open-redirect and JavaScript-injection attacks.

const BLOCKED_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

const MAX_LENGTH = 2048;

/**
 * Returns a safe relative URL to redirect to after authentication.
 * Falls back to `fallback` (default: "/dashboard") for anything suspicious.
 */
export function safeReturnUrl(
  raw:      string | null | undefined,
  fallback: string = "/dashboard"
): string {
  if (!raw) return fallback;

  // Decode once — handles %2Fdashboard from query params.
  let url = raw;
  try { url = decodeURIComponent(raw); } catch { /* treat as raw */ }

  url = url.trim();

  // Must be a relative path.
  if (!url.startsWith("/"))   return fallback;
  if (url.startsWith("//"))   return fallback; // protocol-relative URL

  // Length guard.
  if (url.length > MAX_LENGTH) return fallback;

  const lowered = url.toLowerCase();

  // Block scheme injections and path-traversal variants.
  if (lowered.includes("javascript:")) return fallback;
  if (lowered.startsWith("/\\"))        return fallback;
  if (lowered.includes("/../"))         return fallback;

  // Prevent auth-loop return URLs (e.g. returnUrl=/login).
  for (const prefix of BLOCKED_PREFIXES) {
    if (lowered === prefix || lowered.startsWith(prefix + "?") || lowered.startsWith(prefix + "/")) {
      return fallback;
    }
  }

  return url;
}