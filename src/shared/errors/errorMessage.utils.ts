// src/shared/errors/errorMessage.utils.ts

export function toUserFriendlyError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw = extractRawError(error);

  if (!raw) return fallback;

  return sanitizeErrorMessage(raw, fallback);
}

function extractRawError(error: any): string | null {
  const data = error?.response?.data;

  if (typeof data === "string") return data;

  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.title === "string") return data.title;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;

  if (Array.isArray(data?.errors)) {
    return data.errors.filter(Boolean).join(" ");
  }

  if (data?.errors && typeof data.errors === "object") {
    return Object.values(data.errors)
      .flat()
      .filter(Boolean)
      .join(" ");
  }

  if (typeof error?.message === "string") return error.message;

  return null;
}

function sanitizeErrorMessage(message: string, fallback: string): string {
  const value = message.trim();

  if (!value) return fallback;

  const lower = value.toLowerCase();

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

  if (lower.includes("unauthorized") || lower.includes("401")) {
    return "Your session has expired. Please sign in again.";
  }

  if (lower.includes("forbidden") || lower.includes("403")) {
    return "You do not have access to this action.";
  }

  if (lower.includes("not found") || lower.includes("404")) {
    return "The requested record was not found.";
  }

  if (lower.includes("timeout")) {
    return "The request took too long. Please try again.";
  }

  if (isTechnicalError(value)) {
    return fallback;
  }

  return cleanupMessage(value);
}

function isTechnicalError(value: string): boolean {
  const lower = value.toLowerCase();

  return (
    value.length > 500 ||
    lower.includes("stacktrace") ||
    lower.includes("microsoft.entityframeworkcore") ||
    lower.includes("mysqlconnector") ||
    lower.includes("dbupdateexception") ||
    lower.includes("system.invalidoperationexception") ||
    lower.includes("system.exception") ||
    lower.includes(" at ") ||
    lower.includes(" in c:\\") ||
    lower.includes("/_/src/")
  );
}

function cleanupMessage(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/--->.*$/g, "")
    .trim()
    .replace(/\.$/, "") + ".";
}