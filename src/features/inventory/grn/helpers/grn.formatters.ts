import type { GrnDetailDto, GrnLineDto, GrnListDto } from "../types/grn.types";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatMoney(value?: number | null, currency = "USD"): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value ?? 0));
}

export function formatQty(value?: number | null): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(Number(value ?? 0));
}

export function getGrnNumber(grn: Pick<GrnListDto, "id" | "grnNumber" | "grnNo">): string {
  return cleanText(grn.grnNumber) || cleanText(grn.grnNo) || grn.id;
}

export function getGrnReceiptDate(
  grn: Pick<GrnListDto, "receiptDate" | "receivedDate" | "receivedAt" | "receivedAtUtc">
): string | null {
  return grn.receiptDate || grn.receivedDate || grn.receivedAt || grn.receivedAtUtc || null;
}

export function getGrnLocationName(
  grn: Pick<GrnListDto, "receivingLocationName" | "locationName" | "warehouseName">
): string {
  return cleanText(grn.receivingLocationName) || cleanText(grn.locationName) || cleanText(grn.warehouseName);
}

export function getGrnBranchWarehouse(grn: Pick<GrnListDto, "branchName" | "receivingLocationName" | "locationName" | "warehouseName">): string {
  const warehouse = getGrnLocationName(grn) || "Warehouse not set";
  return grn.branchName ? `${grn.branchName} • ${warehouse}` : warehouse;
}

export function getGrnLineAmount(line: Pick<GrnLineDto, "quantity" | "unitCost" | "lineAmount">): number {
  return line.lineAmount ?? safeNumber(line.quantity) * safeNumber(line.unitCost);
}

export function getGrnLineTax(line: Pick<GrnLineDto, "taxAmount">): number {
  return safeNumber(line.taxAmount);
}

export function getGrnLineTotal(
  line: Pick<GrnLineDto, "quantity" | "unitCost" | "lineAmount" | "taxAmount" | "totalAmount">
): number {
  return line.totalAmount ?? getGrnLineAmount(line) + getGrnLineTax(line);
}

export function getGrnTotal(grn: GrnListDto | GrnDetailDto): number {
  const dtoTotal = grn.grandTotal ?? grn.totalAmount ?? grn.totalCost;
  if (dtoTotal != null) return safeNumber(dtoTotal);
  if ("lines" in grn && Array.isArray(grn.lines)) return grn.lines.reduce((sum, line) => sum + getGrnLineTotal(line), 0);
  return 0;
}

export function getGrnLineCount(grn: GrnListDto | GrnDetailDto): number {
  const dtoCount = grn.lineCount ?? grn.linesCount;
  if (dtoCount != null) return safeNumber(dtoCount);
  if ("lines" in grn && Array.isArray(grn.lines)) return grn.lines.length;
  return 0;
}
