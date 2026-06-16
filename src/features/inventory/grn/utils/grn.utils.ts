import type {
  GrnDetailDto,
  GrnDraft,
  GrnFieldErrors,
  GrnLineDraft,
  GrnListDto,
  ItemVm,
  SelectOption,
} from "../types/grn.types";

import type { InventoryItemDto } from "../../../inventoryMaster/items/types";

// -----------------------------------------------------------------------------
// Core String Helpers
// -----------------------------------------------------------------------------

export function trim(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalize(value: unknown): string {
  return trim(value).toUpperCase();
}

export function toNullable(value: unknown): string | null {
  const cleaned = trim(value);
  return cleaned.length > 0 ? cleaned : null;
}

export function shortId(id?: string | null, length = 8): string {
  const value = trim(id);
  return value.length <= length ? value : value.slice(-length);
}

export function isGuidLike(value?: string | null): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    trim(value)
  );
}

// -----------------------------------------------------------------------------
// Number / Money Helpers
// -----------------------------------------------------------------------------

export function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function money(value: unknown): string {
  return roundMoney(toNumber(value)).toFixed(2);
}

export function moneyInt(value: unknown, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundMoney(toNumber(value)));
}

// -----------------------------------------------------------------------------
// Date Helpers
// -----------------------------------------------------------------------------

export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isDateOnly(value?: string | null): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(trim(value));
}

export function dateOnlyToUtcIso(dateOnly: string): string {
  if (!isDateOnly(dateOnly)) {
    throw new Error(`Invalid date-only value: ${dateOnly}`);
  }

  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

export function utcIsoToDateOnly(value?: string | null): string {
  const raw = trim(value);

  if (!raw) return todayDateOnly();

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const date = new Date(raw);

  return Number.isNaN(date.getTime())
    ? todayDateOnly()
    : date.toISOString().slice(0, 10);
}

export function fmtDateOnly(value?: string | null): string {
  const raw = trim(value);

  if (!raw) return "—";

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString().slice(0, 10);
}

export function fmtDateTime(value?: string | null, locale = "en-US"): string {
  const raw = trim(value);

  if (!raw) return "—";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// -----------------------------------------------------------------------------
// GRN Status
// -----------------------------------------------------------------------------

export enum GrnStatusKind {
  Draft = "DRAFT",
  Submitted = "SUBMITTED",
  Approved = "APPROVED",
  Posted = "POSTED",
  Cancelled = "CANCELLED",
  Reversed = "REVERSED",
}

export function getGrnStatus(record: Pick<GrnListDto, "status">): string {
  return normalize(record.status);
}

export function isDraft(record: Pick<GrnListDto, "status">): boolean {
  return getGrnStatus(record) === GrnStatusKind.Draft;
}

export function isPosted(record: Pick<GrnListDto, "status">): boolean {
  return getGrnStatus(record) === GrnStatusKind.Posted;
}

export function isCancelled(record: Pick<GrnListDto, "status">): boolean {
  return getGrnStatus(record) === GrnStatusKind.Cancelled;
}

export function isReversed(record: Pick<GrnListDto, "status">): boolean {
  return getGrnStatus(record) === GrnStatusKind.Reversed;
}

type GrnIssueState = {
  issued?: boolean | null;
  hasIssue?: boolean | null;
  hasIssues?: boolean | null;
  hasIssued?: boolean | null;
  hasIssuedLines?: boolean | null;
  isIssued?: boolean | null;
  issuedAtUtc?: string | null;
  issueStatus?: string | null;
};

export function hasIssuedFromPostedGrn(
  record: GrnListDto | GrnDetailDto
): boolean {
  const state = record as GrnIssueState;

  return Boolean(
    state.issued ||
      state.hasIssue ||
      state.hasIssues ||
      state.hasIssued ||
      state.hasIssuedLines ||
      state.isIssued ||
      state.issuedAtUtc ||
      normalize(state.issueStatus) === "ISSUED"
  );
}

export function canReverseGrn(record: GrnListDto | GrnDetailDto): boolean {
  return isPosted(record) && !hasIssuedFromPostedGrn(record);
}

// -----------------------------------------------------------------------------
// Generic Safe Pickers
// -----------------------------------------------------------------------------

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord {
  return value && typeof value === "object" ? (value as LooseRecord) : {};
}

export function pickString(source: unknown, ...keys: string[]): string {
  const obj = asRecord(source);

  for (const key of keys) {
    const value = obj[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export function pickNestedString(
  source: unknown,
  objectKey: string,
  ...keys: string[]
): string {
  const obj = asRecord(source);
  return pickString(obj[objectKey], ...keys);
}

export function pickDateOnly(source: unknown, ...keys: string[]): string {
  const raw = pickString(source, ...keys);
  return raw ? utcIsoToDateOnly(raw) : todayDateOnly();
}

// -----------------------------------------------------------------------------
// GRN Received Date
// -----------------------------------------------------------------------------

export function getReceivedDate(record: GrnListDto): string | null {
  return (
    pickString(
      record,
      "receiptDate",
      "receivedDate",
      "receivedAtUtc",
      "receivedAt"
    ) || null
  );
}

// -----------------------------------------------------------------------------
// Inventory Item Mapping
// -----------------------------------------------------------------------------

type InventoryItemLoose = InventoryItemDto & {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  sku?: string | null;
  baseUomId?: string | null;
  baseUomCode?: string | null;
  baseUomName?: string | null;
  baseUom?: {
    id?: string | null;
    code?: string | null;
    name?: string | null;
  } | null;
  uoms?: Array<{
    id?: string | null;
    uomId?: string | null;
    name?: string | null;
    code?: string | null;
    uomName?: string | null;
    isBase?: boolean | null;
    isDefaultPurchase?: boolean | null;
  }> | null;
  itemUoms?: Array<{
    id?: string | null;
    uomId?: string | null;
    name?: string | null;
    code?: string | null;
    uomName?: string | null;
    isBase?: boolean | null;
    isDefaultPurchase?: boolean | null;
  }> | null;
};

export function toItemVm(dto: InventoryItemDto): ItemVm {
  const item = dto as InventoryItemLoose;

  const id = trim(item.id);
  const name = trim(item.name) || "Unnamed item";
  const code = trim(item.code) || trim(item.sku) || undefined;

  const baseUomId = trim(item.baseUomId);
  const baseUomName =
    trim(item.baseUomCode) ||
    trim(item.baseUomName) ||
    trim(item.baseUom?.code) ||
    trim(item.baseUom?.name) ||
    undefined;

  const rawUoms = Array.isArray(item.uoms)
    ? item.uoms
    : Array.isArray(item.itemUoms)
      ? item.itemUoms
      : [];

  const mappedUoms = rawUoms
    .map((uom) => {
      const value = trim(uom.uomId ?? uom.id);
      const label =
        trim(uom.uomName) ||
        trim(uom.name) ||
        trim(uom.code) ||
        "UOM";

      return value
        ? {
            value,
            label,
            isDefaultPurchase: Boolean(uom.isDefaultPurchase || uom.isBase),
          }
        : null;
    })
    .filter(Boolean) as Array<SelectOption<string> & { isDefaultPurchase?: boolean }>;

  if (mappedUoms.length === 0 && baseUomId) {
    mappedUoms.push({
      value: baseUomId,
      label: baseUomName ?? "Base UOM",
      isDefaultPurchase: true,
    });
  }

  const defaultUomId =
    mappedUoms.find((x) => x.isDefaultPurchase)?.value ||
    baseUomId ||
    mappedUoms[0]?.value ||
    "";

  const uoms: SelectOption<string>[] = mappedUoms.map((uom) => ({
    value: uom.value,
    label: uom.label,
    disabled: uom.disabled,
  }));

  const friendlyName = code ? `${code} — ${name}` : name;
  const suffix = shortId(id, 8);
  const label = suffix ? `${friendlyName} · #${suffix}` : friendlyName;

  return {
    id,
    code,
    name,
    label,
    baseUomId,
    baseUomName,
    uoms,
    defaultUomId,
  };
}

// -----------------------------------------------------------------------------
// DTO → Draft Normalization
// -----------------------------------------------------------------------------

export type GrnLineDtoLike = {
  inventoryItemId?: string | null;
  InventoryItemId?: string | null;
  itemId?: string | null;
  ItemId?: string | null;
  inventoryItem?: { id?: string | null; Id?: string | null } | null;
  item?: { id?: string | null; Id?: string | null } | null;

  uomId?: string | null;
  UomId?: string | null;
  unitId?: string | null;
  UnitId?: string | null;
  uom?: { id?: string | null; Id?: string | null } | null;
  unitOfMeasure?: { id?: string | null; Id?: string | null } | null;

  quantity?: number | string | null;
  Quantity?: number | string | null;
  qty?: number | string | null;
  Qty?: number | string | null;

  unitCost?: number | string | null;
  UnitCost?: number | string | null;

  expiryDateUtc?: string | null;
  ExpiryDateUtc?: string | null;
  expiryDate?: string | null;
  ExpiryDate?: string | null;

  batchNo?: string | null;
  BatchNo?: string | null;

  notes?: string | null;
  Notes?: string | null;
  note?: string | null;
};

export type GrnDraftDtoLike = {
  id?: string | null;
  Id?: string | null;

  locationId?: string | null;
  LocationId?: string | null;

  receivingLocationId?: string | null;
  ReceivingLocationId?: string | null;

  warehouseId?: string | null;
  WarehouseId?: string | null;

  receivedDateUtc?: string | null;
  ReceivedDateUtc?: string | null;

  receivedAtUtc?: string | null;
  ReceivedAtUtc?: string | null;

  receivedAt?: string | null;
  ReceivedAt?: string | null;

  receiptDate?: string | null;
  ReceiptDate?: string | null;

  receivedDate?: string | null;
  ReceivedDate?: string | null;

  supplierName?: string | null;
  SupplierName?: string | null;

  notes?: string | null;
  Notes?: string | null;

  lines?: GrnLineDtoLike[] | null;
};

export function normalizeGrnLineDto(line: GrnLineDtoLike): GrnLineDraft {
  const expiryRaw =
    line.expiryDateUtc ??
    line.ExpiryDateUtc ??
    line.expiryDate ??
    line.ExpiryDate ??
    null;

  return {
    itemId:
      pickString(line, "inventoryItemId", "InventoryItemId", "itemId", "ItemId") ||
      pickNestedString(line, "inventoryItem", "id", "Id") ||
      pickNestedString(line, "item", "id", "Id"),

    uomId:
      pickString(line, "uomId", "UomId", "unitId", "UnitId") ||
      pickNestedString(line, "uom", "id", "Id") ||
      pickNestedString(line, "unitOfMeasure", "id", "Id"),

    quantity: toNumber(line.quantity ?? line.Quantity ?? line.qty ?? line.Qty),
    unitCost: toNumber(line.unitCost ?? line.UnitCost),

    expiryDate:
      typeof expiryRaw === "string" && expiryRaw.trim()
        ? utcIsoToDateOnly(expiryRaw)
        : null,

    batchNo: trim(line.batchNo ?? line.BatchNo ?? ""),
    notes: trim(line.notes ?? line.Notes ?? line.note),
  };
}

export function normalizeDraftDto(dto: GrnDraftDtoLike): GrnDraft {
  return {
    id: trim(dto.id ?? dto.Id) || undefined,

    locationId: pickString(
      dto,
      "receivingLocationId",
      "ReceivingLocationId",
      "locationId",
      "LocationId",
      "warehouseId",
      "WarehouseId"
    ),

    receivedDate: pickDateOnly(
      dto,
      "receivedDateUtc",
      "ReceivedDateUtc",
      "receivedAtUtc",
      "ReceivedAtUtc",
      "receivedAt",
      "ReceivedAt",
      "receiptDate",
      "ReceiptDate",
      "receivedDate",
      "ReceivedDate"
    ),

    supplierName: trim(dto.supplierName ?? dto.SupplierName),
    notes: trim(dto.notes ?? dto.Notes),

    lines: Array.isArray(dto.lines)
      ? dto.lines.map(normalizeGrnLineDto)
      : [],
  };
}

// -----------------------------------------------------------------------------
// Label Caches
// -----------------------------------------------------------------------------

export function buildItemLabelCache(items: ItemVm[]): Record<string, string> {
  return Object.fromEntries(
    items
      .filter((item) => trim(item.id))
      .map((item) => [item.id, item.label])
  );
}

export function buildUomLabelCache(items: ItemVm[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const item of items) {
    for (const uom of item.uoms) {
      if (trim(uom.value)) {
        result[uom.value] = uom.label;
      }
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// API Error Extraction
// -----------------------------------------------------------------------------

type ApiErrorShape = {
  response?: {
    data?: {
      message?: string;
      title?: string;
      detail?: string;
      errors?: Record<string, string[]>;
    };
  };
  message?: string;
};

export function extractApiError(
  error: unknown,
  fallback = "An error occurred"
): string {
  const e = error as ApiErrorShape;
  const data = e.response?.data;

  if (data?.message) return data.message;
  if (data?.title) return data.title;
  if (data?.detail) return data.detail;

  if (data?.errors) {
    const firstError = Object.values(data.errors).flat()[0];
    if (firstError) return firstError;
  }

  if (e.message) return e.message;

  return fallback;
}

// -----------------------------------------------------------------------------
// GRN Draft Validation
// -----------------------------------------------------------------------------

export type GrnValidationContext = {
  items?: ItemVm[];
  requireSupplier?: boolean;
  requireExpiryForPerishable?: boolean;
};

export function validateGrnDraft(
  form: GrnDraft,
  context: GrnValidationContext = {}
): GrnFieldErrors {
  const errors: GrnFieldErrors = {};
  const lineErrors: NonNullable<GrnFieldErrors["lineErrors"]> = {};

  const itemMap = new Map((context.items ?? []).map((item) => [item.id, item]));

  if (!trim(form.locationId)) {
    errors.locationId = "Receiving location is required.";
  }

  if (!trim(form.receivedDate)) {
    errors.receivedDate = "Received date is required.";
  } else if (!isDateOnly(form.receivedDate)) {
    errors.receivedDate = "Received date must be a valid date.";
  }

  if (context.requireSupplier && !trim(form.supplierName)) {
    errors.supplierName = "Supplier is required.";
  }

  if (!Array.isArray(form.lines) || form.lines.length === 0) {
    errors.lines = "At least one GRN line is required.";
    return errors;
  }

  const duplicateTracker = new Map<string, number>();

  form.lines.forEach((line, index) => {
    const currentErrors: Record<string, string> = {};

    const itemId = trim(line.itemId);
    const uomId = trim(line.uomId);
    const batchNo = normalize(line.batchNo);
    const expiryDate = trim(line.expiryDate);

    if (!itemId) {
      currentErrors.inventoryItemId = "Select an item.";
    }

    if (!uomId) {
      currentErrors.uomId = "Select a unit.";
    }

    const quantity = toNumber(line.quantity);
    const unitCost = toNumber(line.unitCost);

    if (!(quantity > 0)) {
      currentErrors.quantity = "Quantity must be greater than zero.";
    }

    if (unitCost < 0) {
      currentErrors.unitCost = "Unit cost cannot be negative.";
    }

    if (expiryDate && !isDateOnly(expiryDate)) {
      currentErrors.expiryDate = "Expiry date must be a valid date.";
    }

    const item = itemId ? itemMap.get(itemId) : undefined;

    if (item && uomId) {
      const uomBelongsToItem =
        item.baseUomId === uomId || item.uoms.some((uom) => uom.value === uomId);

      if (!uomBelongsToItem) {
        currentErrors.uomId = "Selected unit is not valid for this item.";
      }
    }

    const duplicateKey = [
      itemId,
      uomId,
      batchNo || "NO_BATCH",
      expiryDate || "NO_EXPIRY",
    ].join("|");

    if (itemId && uomId) {
      const firstIndex = duplicateTracker.get(duplicateKey);

      if (firstIndex !== undefined) {
        currentErrors.duplicate = `Duplicate line. Same item, UOM, batch, and expiry already exists on line ${
          firstIndex + 1
        }.`;
      } else {
        duplicateTracker.set(duplicateKey, index);
      }
    }

    if (Object.keys(currentErrors).length > 0) {
      lineErrors[index] = currentErrors;
    }
  });

  if (Object.keys(lineErrors).length > 0) {
    errors.lineErrors = lineErrors;
  }

  return errors;
}

export function hasErrors(errors: GrnFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}