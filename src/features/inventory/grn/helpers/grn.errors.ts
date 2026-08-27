// src/features/inventory/grn/helpers/grn.errors.ts

import { toUserFriendlyError } from "../../../../shared/errors/errorMessage.utils";

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
  return toUserFriendlyError(error, fallback);
}
