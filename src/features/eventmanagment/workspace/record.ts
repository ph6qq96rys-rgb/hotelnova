// src/features/eventmanagment/workspace/record.ts
//
// The event sub-resource endpoints (equipment plans, staffing plans,
// dispatches, returns, waste, reconciliations, final bills, profitability) are
// typed as `unknown[]` by the API client, so screens read them through these
// tolerant helpers instead of casting. Every accessor takes a list of candidate
// field names and returns the first one present, which keeps a screen rendering
// even when a backend DTO gains or renames a field.

export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

export function asRecords(value: unknown): UnknownRecord[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((row): row is UnknownRecord => row !== null)
    : [];
}

function firstPresent(row: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

export function readText(row: UnknownRecord, keys: string[]): string | null {
  const value = firstPresent(row, keys);
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

export function readNumber(row: UnknownRecord, keys: string[]): number | null {
  const value = firstPresent(row, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function readCount(row: UnknownRecord, keys: string[]): number {
  return readNumber(row, keys) ?? 0;
}

/**
 * Backend enums serialize as either the camelCase name or the numeric value
 * depending on the endpoint, so status is always read as display text.
 */
export function readStatus(row: UnknownRecord, keys: string[] = ["status"]): string {
  const value = readText(row, keys);
  if (!value) return "Unknown";
  if (/^\d+$/.test(value)) return `Status ${value}`;
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function readId(row: UnknownRecord, index: number): string {
  return readText(row, ["id", "Id"]) ?? `row-${index}`;
}

export function readDate(row: UnknownRecord, keys: string[]): string | null {
  return readText(row, keys);
}

/** True when the row carries a cancellation timestamp or a cancelled status. */
export function isCancelled(row: UnknownRecord): boolean {
  if (readText(row, ["cancelledAtUtc", "CancelledAtUtc"])) return true;
  return readStatus(row).toLowerCase().includes("cancel");
}

/** Rows that still count as live work, i.e. everything not cancelled. */
export function activeRows(rows: unknown): UnknownRecord[] {
  return asRecords(rows).filter((row) => !isCancelled(row));
}
