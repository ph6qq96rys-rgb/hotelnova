export type Guid = string;
export type IsoDateString = string;
export type DateOnlyString = string;
export type DecimalNumber = number;

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

export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface GrnLineDto {
  id: Guid;
  grnId: Guid;
  lineNo: number;
  itemId: Guid;
  inventoryItemId?: Guid | null;
  itemName?: string | null;
  itemCode?: string | null;
  uomId: Guid;
  uomName?: string | null;
  uomCode?: string | null;
  quantity: number;
  unitCost: number;
  lineAmount?: number | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  expiryDateUtc?: string | null;
  notes?: string | null;
}

export interface GrnListDto {
  id: Guid;
  grnNumber?: string | null;
  grnNo?: string | null;
  supplierName?: string | null;
  status: GrnStatus;
  receiptDate?: string | null;
  receivedDate?: string | null;
  receivedAt?: string | null;
  receivedAtUtc?: string | null;
  receivingLocationId?: Guid | null;
  locationId?: Guid | null;
  warehouseId?: Guid | null;
  receivingLocationName?: string | null;
  locationName?: string | null;
  warehouseName?: string | null;
  issued?: boolean | null;
  hasIssue?: boolean | null;
  hasIssues?: boolean | null;
  hasIssued?: boolean | null;
  hasIssuedLines?: boolean | null;
  isIssued?: boolean | null;
  totalCost?: number | null;
  totalAmount?: number | null;
  grandTotal?: number | null;
  lineCount?: number | null;
  linesCount?: number | null;
}

export interface GrnDetailDto extends GrnListDto {
  companyId?: Guid | null;
  branchId?: Guid | null;
  notes?: string | null;
  lines: GrnLineDto[];
  createdAt?: string | null;
  createdAtUtc?: string | null;
  postedAt?: string | null;
  postedAtUtc?: string | null;
  reversedAt?: string | null;
  reversedAtUtc?: string | null;
  reversedByUser?: string | null;
  reverseReason?: string | null;
}

export interface CreateGrnLineRequest {
  itemId: Guid;
  uomId: Guid;
  quantity: number;
  unitCost: number;
  batchNo?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
}

export interface CreateGrnDraftRequest {
  companyId?: Guid;
  receivingLocationId: Guid;
  receivedDate: string;
  supplierName?: string | null;
  notes?: string | null;
  lines: CreateGrnLineRequest[];
}

export type UpdateGrnDraftRequest = CreateGrnDraftRequest;

export interface ReverseGrnRequest {
  reason: string;
}

export interface GrnActionResultDto {
  id?: Guid;
  grnId?: Guid;
  draftId?: Guid;
  grnNumber?: string | null;
  status?: GrnStatus;
}

export interface GrnLineDraft {
  itemId: Guid;
  uomId: Guid;
  quantity: number;
  unitCost: number;
  batchNo: string;
  expiryDate: string | null;
  notes: string;
}

export interface GrnDraft {
  id?: Guid;
  locationId: Guid;
  receivedDate: string;
  supplierName: string;
  notes: string;
  lines: GrnLineDraft[];
}

export const createEmptyGrnLine = (): GrnLineDraft => ({
  itemId: "",
  uomId: "",
  quantity: 1,
  unitCost: 0,
  batchNo: "",
  expiryDate: null,
  notes: "",
});

export const createEmptyGrnDraft = (): GrnDraft => ({
  id: undefined,
  locationId: "",
  receivedDate: new Date().toISOString().slice(0, 10),
  supplierName: "",
  notes: "",
  lines: [createEmptyGrnLine()],
});

export interface ItemVm {
  id: Guid;
  code?: string | null;
  name: string;
  label: string;
  baseUomId: Guid;
  baseUomName?: string | null;
  uoms: SelectOption<string>[];
  defaultUomId: Guid;
}

export type GrnLineFieldKey =
  | keyof GrnLineDraft
  | "inventoryItemId"
  | "duplicate";

export type GrnLineFieldErrors = Partial<Record<GrnLineFieldKey, string>>;

export interface GrnFieldErrors {
  locationId?: string;
  receivingLocationId?: string;
  receivedDate?: string;
  supplierName?: string;
  notes?: string;
  lines?: string;
  lineErrors?: Record<number, GrnLineFieldErrors>;
}

export interface GrnValidationResult {
  isValid: boolean;
  errors: GrnFieldErrors;
}
