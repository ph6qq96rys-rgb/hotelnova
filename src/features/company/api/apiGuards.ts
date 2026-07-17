// src/modules/company/api/apiGuards.ts
// Shared API guards for ERP-grade company onboarding modules.

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

export type ApiListEnvelope<T> = {
  items?: T[];
  data?: T[];
  result?: T[];
  results?: T[];
};

export function cleanGuid(value: string | null | undefined): string {
  if (!value) return "";

  const match = value.trim().match(GUID_REGEX);
  return match?.[0] ?? "";
}

export function requireGuid(
  value: string | null | undefined,
  name: string,
): string {
  const id = cleanGuid(value);

  if (!id) {
    throw new Error(`${name} is required and must be a valid GUID.`);
  }

  return id;
}

export function optionalGuid(
  value: string | null | undefined,
  name: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;

  return requireGuid(value, name);
}

export function unwrapArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];

  const envelope = raw as ApiListEnvelope<T>;

  if (Array.isArray(envelope.items)) return envelope.items;
  if (Array.isArray(envelope.data)) return envelope.data;
  if (Array.isArray(envelope.result)) return envelope.result;
  if (Array.isArray(envelope.results)) return envelope.results;

  return [];
}

export function optionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function optionalUpperCode(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export function idOf(value: unknown): string {
  const row = value as any;

  return cleanGuid(
    row?.id ??
      row?.Id ??
      row?.locationId ??
      row?.stockLocationId ??
      row?.storeId ??
      row?.branchId ??
      row?.companyId ??
      row?.stockLocation?.id,
  );
}
