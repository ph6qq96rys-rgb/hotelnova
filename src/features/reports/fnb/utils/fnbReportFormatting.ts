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

export function formatReportDateTime(value?: string | Date | null): string {
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
