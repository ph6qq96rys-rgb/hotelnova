// src/features/inventory/grn/helpers/grn.errors.ts

export interface ApiErrorResponse {
  title?: string;
  detail?: string;
  message?: string;
  error?: string;
  errors?: Record<string, string[] | string>;
}

export interface ApiError {
  response?: {
    data?: string | ApiErrorResponse;
  };
  message?: string;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred."
): string {
  const err = error as ApiError;

  const data = err.response?.data;

  if (typeof data === "string") {
    return data || fallback;
  }

  if (data && typeof data === "object") {
    if (data.errors) {
      const first = Object.values(data.errors)
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .find(Boolean);

      if (first) return first;
    }

    return (
      data.detail ??
      data.message ??
      data.error ??
      data.title ??
      err.message ??
      fallback
    );
  }

  return err.message ?? fallback;
}