export type Guid = string;
export type IsoDateString = string;
export type DateOnlyString = string;
export type DecimalNumber = number;

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
  quantity: DecimalNumber;
  unitCost: DecimalNumber;
  lineAmount?: DecimalNumber | null;
  taxAmount?: DecimalNumber | null;
  totalAmount?: DecimalNumber | null;
  batchNo?: string | null;
  expiryDate?: DateOnlyString | IsoDateString | null;
  expiryDateUtc?: IsoDateString | null;
  notes?: string | null;
}

export interface GrnListDto {
  id: Guid;
  companyId?: Guid | null;
  branchId?: Guid | null;
  branchName?: string | null;
  grnNumber?: string | null;
  grnNo?: string | null;
  supplierName?: string | null;
  status: string;
  receiptDate?: DateOnlyString | IsoDateString | null;
  receivedDate?: DateOnlyString | IsoDateString | null;
  receivedAt?: IsoDateString | null;
  receivedAtUtc?: IsoDateString | null;
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
  totalCost?: DecimalNumber | null;
  totalAmount?: DecimalNumber | null;
  grandTotal?: DecimalNumber | null;
  lineCount?: number | null;
  linesCount?: number | null;
}

export interface GrnDetailDto extends GrnListDto {
  notes?: string | null;
  lines: GrnLineDto[];
  createdAt?: IsoDateString | null;
  createdAtUtc?: IsoDateString | null;
  postedAt?: IsoDateString | null;
  postedAtUtc?: IsoDateString | null;
  postedByName?: string | null;
  createdByName?: string | null;
  reversedAt?: IsoDateString | null;
  reversedAtUtc?: IsoDateString | null;
  reversedByUser?: string | null;
  reverseReason?: string | null;
  reversalReason?: string | null;
}

export interface CreateGrnLineRequest {
  itemId: Guid;
  uomId: Guid;
  quantity: DecimalNumber;
  unitCost: DecimalNumber;
  batchNo?: string | null;
  expiryDate?: DateOnlyString | null;
  notes?: string | null;
}

export interface CreateGrnDraftRequest {
  companyId?: Guid;
  branchId?: Guid;
  receivingBranchId?: Guid;
  receivingLocationId: Guid;
  receivedDate: DateOnlyString;
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
  status?: string | null;
}

export interface GrnLineDraft {
  itemId: Guid;
  uomId: Guid;
  quantity: DecimalNumber;
  unitCost: DecimalNumber;
  batchNo: string;
  expiryDate: DateOnlyString | null;
  notes: string;
}

export interface GrnDraft {
  id?: Guid;
  locationId: Guid;
  receivedDate: DateOnlyString;
  supplierName: string;
  notes: string;
  lines: GrnLineDraft[];
}

export interface ItemVm {
  id: Guid;
  code?: string | null;
  name: string;
  label: string;
  baseUomId: Guid;
  baseUomName?: string | null;
  uoms: SelectOption<Guid>[];
  defaultUomId: Guid;
}
