export function extractApiError(error: unknown, fallback: string): string {
  const candidate = error as {
    response?: { data?: Record<string, unknown> };
    message?: unknown;
  };
  const data = candidate.response?.data;
  for (const key of ["message", "detail", "title", "error"] as const) {
    const value = data?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message.trim();
  }
  return fallback;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
