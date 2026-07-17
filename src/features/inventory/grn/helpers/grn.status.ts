import type { GrnListDto } from "../types/grn.types";

export const GRN_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "POSTED",
  "REVERSED",
  "CANCELLED",
] as const;

export type GrnStatus = (typeof GRN_STATUSES)[number];
export type GrnStatusFilter = GrnStatus | "ALL";

export const GRN_STATUS_OPTIONS: ReadonlyArray<{ value: GrnStatusFilter; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "POSTED", label: "Posted" },
  { value: "REVERSED", label: "Reversed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeGrnStatus(value: unknown): GrnStatus {
  const raw = cleanText(value).toUpperCase();
  return GRN_STATUSES.includes(raw as GrnStatus) ? (raw as GrnStatus) : "DRAFT";
}

export function formatGrnStatusLabel(status: GrnStatus): string {
  switch (status) {
    case "DRAFT": return "Draft";
    case "SUBMITTED": return "Submitted";
    case "APPROVED": return "Approved";
    case "POSTED": return "Posted";
    case "REVERSED": return "Reversed";
    case "CANCELLED": return "Cancelled";
    default: return status;
  }
}

export function grnHasIssuedStock(
  grn: Pick<GrnListDto, "issued" | "hasIssue" | "hasIssues" | "hasIssued" | "hasIssuedLines" | "isIssued">
): boolean {
  return Boolean(grn.issued || grn.hasIssue || grn.hasIssues || grn.hasIssued || grn.hasIssuedLines || grn.isIssued);
}

export function isDraftGrn(grn: Pick<GrnListDto, "status">): boolean {
  return normalizeGrnStatus(grn.status) === "DRAFT";
}

export function isPostedGrn(grn: Pick<GrnListDto, "status">): boolean {
  return normalizeGrnStatus(grn.status) === "POSTED";
}

export function isReversedGrn(grn: Pick<GrnListDto, "status">): boolean {
  return normalizeGrnStatus(grn.status) === "REVERSED";
}

export function canReverseGrn(grn: Pick<GrnListDto, "status"> & Parameters<typeof grnHasIssuedStock>[0]): boolean {
  return isPostedGrn(grn) && !grnHasIssuedStock(grn);
}

export function getGrnWorkflowText(row: GrnListDto): string {
  const status = normalizeGrnStatus(row.status);
  if (status === "DRAFT") return "Ready to edit";
  if (status === "POSTED" && canReverseGrn(row)) return "Available for reversal";
  if (status === "POSTED" && grnHasIssuedStock(row)) return "Inventory consumed";
  if (status === "REVERSED") return "Receipt reversed";
  if (status === "CANCELLED") return "Cancelled";
  return formatGrnStatusLabel(status);
}
