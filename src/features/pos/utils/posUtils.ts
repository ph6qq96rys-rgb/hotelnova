import { toUserFriendlyError } from "../../../shared/errors/errorMessage.utils";

export function extractApiError(error: unknown, fallback: string): string {
  return toUserFriendlyError(error, fallback);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
