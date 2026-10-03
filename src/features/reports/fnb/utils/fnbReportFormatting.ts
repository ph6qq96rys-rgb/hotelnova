import {
  formatAppDate,
  formatAppDateTime,
  todayLocalIsoDate,
} from "../../../../shared/datetime/dateFormat";
import type { FnbReportColumnDto, FnbReportFormat } from "../api/fnbReportsApi";

const DASH = "-";

export { formatAppDate, formatAppDateTime, todayLocalIsoDate };

export function formatReportDate(value?: string | Date | null): string {
  return formatAppDate(value);
}

export function formatReportDateTime(value?: string | Date | null, timeZone?: string | null): string {
  if (value && timeZone) {
    const normalized = typeof value === "string" && value.includes("T") && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
      ? `${value}Z` : value;
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) {
      try {
        return new Intl.DateTimeFormat("en-GB", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit", hour12: false, timeZone,
        }).format(date);
      } catch { /* Fall back to the application's default for invalid legacy settings. */ }
    }
  }
  return formatAppDateTime(value);
}

export function formatReportNumber(
  value?: number | string | null,
  maxFractionDigits = 6,
): string {
  const numeric = toNumber(value);
  if (numeric == null) return DASH;

  return numeric.toLocaleString("en-GB", {
    maximumFractionDigits: maxFractionDigits,
  });
}

export function formatReportMoney(
  value?: number | string | null,
  currencyCode = "ETB",
): string {
  const numeric = toNumber(value);
  if (numeric == null) return DASH;

  return `${currencyCode || "ETB"} ${numeric.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatReportValue(
  value: unknown,
  format?: FnbReportFormat | string,
  currencyCode = "ETB",
): string {
  if (value == null || value === "") return DASH;

  switch (format) {
    case "currency":
      return formatReportMoney(String(value), currencyCode);

    case "percent": {
      const numeric = toNumber(String(value));
      return numeric == null
        ? DASH
        : `${numeric.toLocaleString("en-GB", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}%`;
    }

    case "number":
      return formatReportNumber(String(value));

    case "date":
      return formatReportDate(value as string | Date);

    case "datetime":
      return formatReportDateTime(value as string | Date);

    default:
      return String(value);
  }
}

export function reportPeriodLabel(
  result:
    | {
        from?: string | null;
        to?: string | null;
        asOfDate?: string | null;
      }
    | null
    | undefined,
  fallback: { from: string; to: string; asOfDate: string },
  supportsAsOfDate?: boolean,
): string {
  if (supportsAsOfDate) {
    return `As of ${formatReportDate(result?.asOfDate ?? fallback.asOfDate)}`;
  }

  return `${formatReportDate(result?.from ?? fallback.from)} - ${formatReportDate(
    result?.to ?? fallback.to,
  )}`;
}

export function visibleReportColumns(columns: FnbReportColumnDto[]) {
  return columns.filter((x) => x.isVisible !== false);
}

function toNumber(value?: number | string | null): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
