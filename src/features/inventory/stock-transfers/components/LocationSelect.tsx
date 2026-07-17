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

export function getApiError(error: unknown, fallback = "Request failed."): string {
  const err = error as any;
  const data = err?.response?.data;

  if (typeof data === "string") return data;

  if (data && typeof data === "object") {
    const title = data.title || data.error || data.message || fallback;
    const detail = data.detail && data.detail !== title ? ` — ${data.detail}` : "";
    const traceId = data.traceId ? ` (traceId: ${data.traceId})` : "";

    const validation =
      data.errors && typeof data.errors === "object"
        ? " " +
          Object.entries(data.errors)
            .map(([key, value]) =>
              `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
            )
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
