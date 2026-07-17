// src/api/getApiError.ts

type ApiErrorPayload = {
  error?: string;
  Error?: string;
  message?: string;
  title?: string;
  detail?: string;
  errors?: Record<string, string[] | string>;
};

function flattenValidationErrors(errors: Record<string, string[] | string>): string {
  return Object.values(errors)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join("\n");
}

export function getApiError(error: unknown, fallback: string): string {
  const maybeAxiosError = error as {
    response?: { data?: string | ApiErrorPayload };
    message?: string;
  };

  const data = maybeAxiosError.response?.data;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data && typeof data === "object") {
    if (data.errors && Object.keys(data.errors).length > 0) {
      const validationMessage = flattenValidationErrors(data.errors);

      if (validationMessage) {
        return validationMessage;
      }
    }

    return (
      data.error ||
      data.Error ||
      data.detail ||
      data.message ||
      data.title ||
      maybeAxiosError.message ||
      fallback
    );
  }

  return maybeAxiosError.message || fallback;
}
