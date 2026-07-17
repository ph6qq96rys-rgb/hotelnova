// src/features/inventory/stockTransfers/utils/apiUtils.ts

export type PagedResult<T> = {
  items: T[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
};

export function unwrapData<T>(responseOrData: unknown): T {
  const value = responseOrData as Record<string, unknown>;

  if (value?.data !== undefined) return value.data as T;
  if (value?.result !== undefined) return value.result as T;
  if (value?.items !== undefined) return value.items as T;

  return responseOrData as T;
}

export function unwrapArray<T>(responseOrData: unknown): T[] {
  const raw = unwrapData<PagedResult<T> | T[]>(responseOrData);

  if (Array.isArray(raw)) return raw;

  if (raw && Array.isArray((raw as PagedResult<T>).items)) {
    return (raw as PagedResult<T>).items;
  }

  return [];
}

export function toQuery(params: Record<string, unknown>): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });

  const text = query.toString();
  return text ? `?${text}` : "";
}

export function getApiError(
  error: unknown,
  fallback = "Request failed."
): string {
  const err = error as any;
  const data = err?.response?.data;

  if (typeof data === "string") return data;

  if (data && typeof data === "object") {
    const title = data.title || data.error || data.message || fallback;
    const detail =
      data.detail && data.detail !== title ? ` — ${data.detail}` : "";
    const traceId = data.traceId ? ` (traceId: ${data.traceId})` : "";

    const validation =
      data.errors && typeof data.errors === "object"
        ? " " +
          Object.entries(data.errors)
            .map(([key, value]) => {
              const message = Array.isArray(value)
                ? value.join(", ")
                : String(value);

              return `${key}: ${message}`;
            })
            .join(" | ")
        : "";

    return `${title}${traceId}${detail}${validation}`;
  }

  return err?.message ?? fallback;
}

export function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function hasValue(value: unknown): value is string {
  return clean(value).length > 0;
}

export function safeNum(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function money(value: unknown): string {
  return safeNum(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtDateTime(value?: string | null): string {
  const raw = clean(value);
  if (!raw) return "—";

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString();
}

export function isoToDateOnly(value?: string | null): string {
  const raw = clean(value);
  if (!raw) return "";

  return raw.includes("T") ? raw.slice(0, 10) : raw;
}

export function dateOnlyToUtcIso(dateOnly: string): string | null {
  const [year, month, day] = dateOnly.split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}