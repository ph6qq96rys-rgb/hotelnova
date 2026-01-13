// auth/returnUrl.ts
const BLOCKED_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password"];

export function safeReturnUrl(
  raw: string | null | undefined,
  fallback = "/dashboard"
) {
  if (!raw) return fallback;

  // decode once (handles %2Fdashboard)
  let url = raw;
  try {
    url = decodeURIComponent(raw);
  } catch {
    // ignore decode errors; treat as raw
  }

  url = url.trim();

  // must be a relative app path
  if (!url.startsWith("/")) return fallback;
  if (url.startsWith("//")) return fallback; // protocol-relative

  // block obvious scheme injections
  const lowered = url.toLowerCase();
  if (lowered.startsWith("/\\") || lowered.includes("javascript:")) return fallback;

  // prevent auth-loop return urls
  for (const p of BLOCKED_PREFIXES) {
    if (lowered === p || lowered.startsWith(p + "?")) return fallback;
  }

  // optional: length guard
  if (url.length > 2048) return fallback;

  return url;
}
