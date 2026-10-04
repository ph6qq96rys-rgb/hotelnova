import { getApiError } from "../../../../api/getApiError";

/** True for an aborted fetch or a cancelled axios request. */
export function isAbortError(error: unknown): boolean {
  const name = typeof error === "object" && error !== null ? (error as { name?: unknown }).name : undefined;
  return name === "AbortError" || name === "CanceledError";
}

/**
 * The server's explanation of a failed report request (validation detail,
 * access denial), falling back to a generic message instead of axios text
 * such as "Request failed with status code 400".
 */
export function requestErrorMessage(error: unknown, fallback: string): string {
  return getApiError(error, fallback);
}
