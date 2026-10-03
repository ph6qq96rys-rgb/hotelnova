// src/shared/errors/errorMessage.utils.ts

export function toUserFriendlyError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw = extractRawError(error);
  const status = getHttpStatus(error);

  if (!raw) return statusMessage(status, fallback);

  return sanitizeErrorMessage(raw, fallback, status);
}

function getHttpStatus(error: any): number | null {
  const status = error?.response?.status ?? error?.status;
  return typeof status === "number" ? status : null;
}

function extractRawError(error: any): string | null {
  const data = error?.response?.data;

  if (typeof data === "string") return data;

  for (const value of [data?.detail, data?.message, data?.error]) {
    if (typeof value === "string" && value.trim()) return value;
  }

  if (Array.isArray(data?.errors)) {
    return data.errors.filter(Boolean).join(" ");
  }

  if (data?.errors && typeof data.errors === "object") {
    return Object.values(data.errors)
      .flat()
      .filter(Boolean)
      .join(" ");
  }

  if (typeof data?.title === "string" && data.title.trim()) return data.title;

  if (typeof error?.message === "string") return error.message;

  return null;
}

function sanitizeErrorMessage(message: string, fallback: string, status: number | null): string {
  const value = message.trim();

  if (!value) return statusMessage(status, fallback);

  const lower = value.toLowerCase();

  if (looksLikeHtmlError(value)) {
    return statusMessage(status, fallback);
  }

  if (lower.includes("duplicate entry") && lower.includes("aspnetusers.primary")) {
    return "This employee already has a login account.";
  }

  if (lower.includes("duplicate entry") && lower.includes("usernameindex")) {
    return "This username is already used.";
  }

  if (lower.includes("duplicate entry") && lower.includes("emailindex")) {
    return "This email address is already used.";
  }

  if (lower.includes("duplicate entry")) {
    return "This record already exists.";
  }

  if (lower.includes("foreign key constraint fails")) {
    return "This record depends on another setup item that is missing or invalid.";
  }

  if (lower.includes("cannot add or update a child row")) {
    return "One of the selected references is invalid. Please refresh and try again.";
  }

  if (lower.includes("cannot delete or update a parent row")) {
    return "This record is already being used and cannot be removed.";
  }

  if (lower.includes("access denied")) {
    return "You do not have permission to perform this action.";
  }

  if (status === 401 || lower.includes("unauthorized") || lower.includes("401")) {
    return "Your session has expired. Please sign in again.";
  }

  if (status === 403 || lower.includes("forbidden") || lower.includes("403")) {
    return "You do not have permission to view or change this area. Ask your Company Administrator to update your role or branch assignment.";
  }

  if (status === 404 || lower.includes("404")) {
    return "The requested record was not found. Refresh the page and try again.";
  }

  if (lower.includes("timeout")) {
    return "The request took too long. Please try again.";
  }

  if (lower.includes("network error") || lower.includes("failed to fetch")) {
    return "Cannot reach the server. Check your connection and try again.";
  }

  if (isTechnicalError(value)) {
    return statusMessage(status, fallback);
  }

  return cleanupMessage(value);
}

function statusMessage(status: number | null, fallback: string): string {
  switch (status) {
    case 400:
      return "Some information is missing or invalid. Please review the form and try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to view or change this area. Ask your Company Administrator to update your role or branch assignment.";
    case 404:
      return "The requested record was not found. Refresh the page and try again.";
    case 409:
      return "This action conflicts with existing data. Refresh the page and try again.";
    case 422:
      return "Some information is missing or invalid. Please review the form and try again.";
    default:
      if (status && status >= 500) {
        return "The server could not complete the request. Please try again or contact support if it continues.";
      }
      return fallback;
  }
}

function isTechnicalError(value: string): boolean {
  const lower = value.toLowerCase();

  return (
    value.length > 500 ||
    lower.includes("stacktrace") ||
    lower.includes("microsoft.entityframeworkcore") ||
    lower.includes("mysqlconnector") ||
    lower.includes("dbupdateexception") ||
    lower.includes("request failed with status code") ||
    lower.includes("system.invalidoperationexception") ||
    lower.includes("system.exception") ||
    // Stack frames contain a method call, not ordinary phrases such as
    // "available stock at the source location".
    /(?:^|\n)\s*at\s+(?:async\s+)?[\w.$<>+`]+\s*\([^\n]*\)/i.test(value) ||
    lower.includes(" in c:\\") ||
    lower.includes("/_/src/")
  );
}

function looksLikeHtmlError(value: string): boolean {
  const lower = value.toLowerCase();

  return (
    lower.startsWith("<!doctype html") ||
    lower.startsWith("<html") ||
    lower.includes("<body") ||
    lower.includes("<title>") ||
    lower.includes("</html>")
  );
}

function cleanupMessage(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/--to.*$/g, "")
    .trim()
    .replace(/\.$/, "") + ".";
}
