export const APP_TIME_ZONE = "Africa/Addis_Ababa";

const DASH = "-";

export function formatAppDate(value?: string | Date | null): string {
  const date = parseAppDate(value);
  if (!date) return DASH;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

export function formatAppDateTime(value?: string | Date | null): string {
  const date = parseAppDate(value);
  if (!date) return DASH;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

export function formatAppTime(value?: string | Date | null): string {
  const date = parseAppDate(value);
  if (!date) return DASH;

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

export function formatAppTimeInTimeZone(
  value?: string | Date | null,
  timeZone = APP_TIME_ZONE,
): string {
  const date = parseAppDate(value);
  if (!date) return DASH;

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

export function todayLocalIsoDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function parseAppDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(asUtcIsoDateTime(trimmed));
  return Number.isNaN(date.getTime()) ? null : date;
}

function asUtcIsoDateTime(value: string): string {
  if (!value.includes("T")) return value;
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
}