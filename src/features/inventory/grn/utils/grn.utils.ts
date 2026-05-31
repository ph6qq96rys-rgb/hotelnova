// ─── GRN Utility Functions ────────────────────────────────────────────────────
// Pure helpers. No React. No side effects. Fully testable.

import type { GrnListDto, GrnDetailDto, GrnLineDraft, GrnDraft, ItemVm, ItemUomVm } from "../types/grn.types";
import type { InventoryItemDto } from "../../../inventoryMaster/items/types";

// ── String/Formatting ─────────────────────────────────────────────────────────

export const trim = (s?: string | null): string => (s ?? "").trim();

export const normalize = (v: unknown): string => String(v ?? "").trim().toUpperCase();

export const shortId = (id?: string | null, n = 8): string => {
  const s = trim(id);
  return !s ? "" : s.length <= n ? s : s.slice(-n);
};

export const money = (n: number): string =>
  Number.isFinite(n) ? n.toFixed(2) : "0.00";

export const moneyInt = (n: number): string =>
  Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

// ── Date Formatting ───────────────────────────────────────────────────────────

export const todayDateOnly = (): string => new Date().toISOString().slice(0, 10);

export const dateOnlyToUtcIso = (dateOnly: string): string => {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
};

export const utcIsoToDateOnly = (iso: string | null | undefined): string =>
  (iso ?? "").toString().slice(0, 10) || todayDateOnly();

export const fmtDateTime = (v?: string | null): string => {
  const s = trim(v);
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const fmtDateOnly = (v?: string | null): string => {
  const s = trim(v);
  if (!s) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
};

export const toNullable = (s: string | null | undefined): string | null => {
  const t = trim(s);
  return t || null;
};

// ── GRN Status Logic ──────────────────────────────────────────────────────────

export const getGrnStatus = (r: GrnListDto): string => normalize((r as any).status);

export const isDraft = (r: GrnListDto): boolean => getGrnStatus(r) === "DRAFT";

export const isPosted = (r: GrnListDto): boolean => getGrnStatus(r) === "POSTED";

export const isCancelled = (r: GrnListDto): boolean => getGrnStatus(r) === "CANCELLED";

export const isReversed = (r: GrnListDto): boolean => getGrnStatus(r) === "REVERSED";

export const hasIssuedFromPostedGrn = (r: GrnListDto | GrnDetailDto): boolean => {
  const anyR = r as any;
  const issueStatus = normalize(anyR?.issueStatus);
  return Boolean(anyR?.issued || anyR?.hasIssue || anyR?.issuedAtUtc || issueStatus === "ISSUED");
};

export const canReverseGrn = (r: GrnListDto): boolean =>
  isPosted(r) && !hasIssuedFromPostedGrn(r);

// ── GRN Received Date (multi-field fallback) ─────────────────────────────────

export const getReceivedDate = (r: GrnListDto): string | null =>
  (r as any).receiptDate ?? r.receivedDate ?? r.receivedAtUtc ?? null;

// ── Item View Model ───────────────────────────────────────────────────────────

export const pickId = (obj: any, ...paths: string[]): string => {
  for (const p of paths) {
    const v = obj?.[p];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

export const pickDateOnly = (obj: any, ...paths: string[]): string => {
  for (const p of paths) {
    const v = obj?.[p];
    if (typeof v === "string" && v.trim()) return utcIsoToDateOnly(v.trim());
  }
  return todayDateOnly();
};

export function toItemVm(dto: InventoryItemDto): ItemVm {
  const d: any = dto;
  const id = trim(d.id);
  const name = trim(d.name);
  const code = trim(d.code) || trim(d.sku) || undefined;

  const baseUomId = trim(d.baseUomId);
  const baseUomName =
    trim(d.baseUomCode) || trim(d.baseUomName) || trim(d.baseUom?.code) || trim(d.baseUom?.name) || undefined;

  const uomsRaw: any[] = Array.isArray(d.uoms) ? d.uoms : Array.isArray(d.itemUoms) ? d.itemUoms : [];

  const uoms: ItemUomVm[] = uomsRaw
    .map((u: any) => ({
      uomId: trim(u.uomId ?? u.id),
      uomName: trim(u.uomName ?? u.name ?? u.code ?? "UOM"),
      isDefaultPurchase: !!(u.isDefaultPurchase || u.isBase),
    }))
    .filter((x) => !!x.uomId);

  if (!uoms.length && baseUomId) {
    uoms.push({ uomId: baseUomId, uomName: baseUomName ?? "Base UOM", isDefaultPurchase: true });
  }

  const defaultUomId = uoms.find((x) => x.isDefaultPurchase)?.uomId ?? baseUomId ?? uoms[0]?.uomId ?? "";
  const friendlyMain = code ? `${code} — ${name}` : name;
  const sid = shortId(id, 8);
  const label = sid ? `${friendlyMain}  ·  #${sid}` : friendlyMain;

  return { id, code, name, label, baseUomId, baseUomName, uoms, defaultUomId };
}

// ── DTO → Draft Normalization ─────────────────────────────────────────────────

export function normalizeGrnLineDto(l: any): GrnLineDraft {
  return {
    itemId:
      pickId(l, "inventoryItemId", "InventoryItemId", "itemId", "ItemId") ||
      pickId(l?.inventoryItem, "id", "Id") ||
      pickId(l?.item, "id", "Id"),
    uomId:
      pickId(l, "uomId", "UomId", "unitId", "UnitId") ||
      pickId(l?.uom, "id", "Id") ||
      pickId(l?.unitOfMeasure, "id", "Id"),
    quantity: Number(l?.quantity ?? l?.Quantity ?? 0),
    unitCost: Number(l?.unitCost ?? l?.UnitCost ?? 0),
    expiryDate: (() => {
      const raw = l?.expiryDateUtc ?? l?.ExpiryDateUtc ?? l?.expiryDate ?? l?.ExpiryDate;
      return typeof raw === "string" ? utcIsoToDateOnly(raw.trim()) : null;
    })(),
    notes: trim(l?.notes ?? l?.Notes ?? l?.note ?? ""),
  };
}

export function normalizeDraftDto(dto: any): GrnDraft {
  return {
    id: trim(dto?.id ?? dto?.Id ?? ""),
    locationId: pickId(dto, "locationId", "LocationId", "warehouseId", "WarehouseId"),
    receivedDate: pickDateOnly(dto, "receivedDateUtc", "ReceivedDateUtc", "receiptDate", "ReceiptDate", "receivedDate"),
    supplierName: trim(dto?.supplierName ?? dto?.SupplierName ?? ""),
    notes: trim(dto?.notes ?? dto?.Notes ?? ""),
    lines: (Array.isArray(dto?.lines) ? dto.lines : []).map(normalizeGrnLineDto),
  };
}

// ── Label Caches ──────────────────────────────────────────────────────────────

export function buildItemLabelCache(items: ItemVm[]): Record<string, string> {
  return Object.fromEntries(items.map((item) => [item.id, item.label]));
}

export function buildUomLabelCache(items: ItemVm[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of items) {
    for (const uom of item.uoms) {
      result[uom.uomId] = uom.uomName;
    }
  }
  return result;
}

// ── Error Messages ────────────────────────────────────────────────────────────

export function extractApiError(e: unknown, fallback = "An error occurred"): string {
  const anyE = e as any;
  return (
    anyE?.response?.data?.message ??
    anyE?.response?.data?.title ??
    anyE?.message ??
    fallback
  );
}

// ── GRN Draft Validation ──────────────────────────────────────────────────────

import type { GrnFieldErrors } from "../types/grn.types";

export function validateGrnDraft(form: GrnDraft): GrnFieldErrors {
  const errors: GrnFieldErrors = {};

  if (!trim(form.locationId)) errors.locationId = "Warehouse is required";
  if (!trim(form.receivedDate)) errors.receivedDate = "Received date is required";

  if (form.lines.length === 0) {
    errors.lines = "At least one line is required";
  }

  const lineErrors: GrnFieldErrors["lineErrors"] = {};
  form.lines.forEach((l, i) => {
    const le: Record<string, string> = {};
    if (!trim(l.itemId)) le.inventoryItemId = "Select an item";
    if (!trim(l.uomId)) le.uomId = "Select a unit";
    if (!(Number(l.quantity) > 0)) le.quantity = "Qty must be > 0";
    if (Number(l.unitCost) < 0) le.unitCost = "Cost cannot be negative";
    if (Object.keys(le).length > 0) lineErrors[i] = le;
  });

  if (Object.keys(lineErrors).length > 0) errors.lineErrors = lineErrors;

  return errors;
}

export const hasErrors = (errors: GrnFieldErrors): boolean =>
  Object.keys(errors).length > 0;