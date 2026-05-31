// ─── GRN Domain Types ────────────────────────────────────────────────────────
// Single source of truth for all GRN-related types across the module.

// ── Enums ────────────────────────────────────────────────────────────────────

export type GrnStatus = "DRAFT" | "POSTED" | "CANCELLED" | "REVERSED";

export type GrnStatusFilter = GrnStatus | "ALL";

export const GRN_STATUS_LABELS: Record<GrnStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
  REVERSED: "Reversed",
};

// ── DTO Shapes (what the API returns) ────────────────────────────────────────

export interface GrnLineDto {
  id?: string;
  inventoryItemId?: string;
  itemId?: string;
  itemName?: string | null;
  itemCode?: string | null;
  uomId?: string;
  uomName?: string | null;
  uomCode?: string | null;
  quantity: number;
  unitCost: number;
  batchNo?: string | null;
  expiryDate?: string | null;
  expiryDateUtc?: string | null;
  notes?: string | null;
}

export interface GrnListDto {
  id: string;
  grnNumber: string | null;
  supplierName?: string | null;
  status?: string | null;
  receiptDate?: string | null;
  receivedDate?: string | null;
  receivedAtUtc?: string | null;
  issued?: boolean | null;
  hasIssue?: boolean | null;
  issuedAtUtc?: string | null;
  issueStatus?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  totalCost?: number | null;
  lineCount?: number | null;
}

export interface GrnDetailDto extends GrnListDto {
  lines: GrnLineDto[];
  notes?: string | null;
  branchId?: string | null;
  createdAtUtc?: string | null;
  postedAtUtc?: string | null;
  reversedAtUtc?: string | null;
  reversedByUser?: string | null;
  reverseReason?: string | null;
}

// ── Request Shapes (what we send to the API) ─────────────────────────────────

export interface GrnLineDraft {
  itemId: string;
  uomId: string;
  quantity: number;
  unitCost: number;
  expiryDate: string | null;
  notes: string;
}

export interface GrnDraft {
  id?: string;
  locationId: string;
  receivedDate: string; // yyyy-MM-dd
  supplierName: string;
  notes: string;
  lines: GrnLineDraft[];
}

export interface CreateGrnDraftRequest {
  locationId: string;
  supplierName: string | null;
  receivedDate: string;
  notes: string | null;
  lines: Array<{
    itemId: string;
    uomId: string;
    quantity: number;
    unitCost: number;
    receivedDate?: string | null;
    notes?: string | null;
  }>;
}

export interface ReverseGrnRequest {
  reason: string | null;
}

// ── View Model Helpers ────────────────────────────────────────────────────────

export interface SelectOption<T = string> {
  value: T;
  label: string;
}

export interface ItemUomVm {
  uomId: string;
  uomName: string;
  isDefaultPurchase?: boolean;
}

export interface ItemVm {
  id: string;
  code?: string;
  name: string;
  label: string;
  baseUomId: string;
  baseUomName?: string;
  uoms: ItemUomVm[];
  defaultUomId: string;
}

// ── Form Validation ───────────────────────────────────────────────────────────

export type GrnLineFieldErrors = Partial<Record<keyof GrnLineDraft, string>>;

export interface GrnFieldErrors {
  locationId?: string;
  receivedDate?: string;
  supplierName?: string;
  lines?: string;
  lineErrors?: Record<number, GrnLineFieldErrors>;
}