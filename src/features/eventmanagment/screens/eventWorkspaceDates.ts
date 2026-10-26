import { APP_TIME_ZONE } from "../../../shared/datetime/dateFormat";

/**
 * Calendar maths in the business time zone (APP_TIME_ZONE), not the viewer's browser, so every
 * user sees an event on the same day wherever they are.
 */
function parts(date: Date, timeZone = APP_TIME_ZONE) {
  const map: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date))
    map[p.type] = p.value;
  return map;
}

/** yyyy-mm-dd of the instant in the business time zone. */
export function appDayKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** yyyy-mm of today in the business time zone. */
export function appMonthKey(value: Date = new Date()): string {
  return appDayKey(value).slice(0, 7);
}

/** The UTC instant of midnight at the start of a business-time-zone day. */
export function appMidnightUtc(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day);
  const p = parts(new Date(guess));
  const asIfUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return new Date(guess - (asIfUtc - guess));
}

/** Start and end (exclusive) of a business-time-zone month, as UTC instants. */
export function appMonthRange(monthKey: string): { from: Date; to: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  const next = month === 12 ? [year + 1, 1] : [year, month + 1];
  return { from: appMidnightUtc(year, month, 1), to: appMidnightUtc(next[0], next[1], 1) };
}

/** Short weekday names in the page language, Monday first (ISO 8601). */
export function weekdayNames(locale?: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2024, 0, 1 + i))));
}
