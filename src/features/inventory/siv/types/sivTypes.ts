// src/features/inventory/siv/types/sivTypes.ts

export type DocStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "RequestedChanges"
  | "Rejected"
  | "Posted"
  | "Reversed"
  | "Cancelled";

/**
 * Match these numeric values to your C# enum exactly.
 * Recommended backend enum:
 * Draft = 10
 * Submitted = 20
 * RequestedChanges = 25
 * Approved = 30
 * Rejected = 40
 * Posted = 50
 * Reversed = 60
 * Cancelled = 70
 */
export function docStatusLabel(v: number): DocStatus {
  switch (v) {
    case 10:
      return "Draft";
    case 20:
      return "Submitted";
    case 25:
      return "RequestedChanges";
    case 30:
      return "Approved";
    case 40:
      return "Rejected";
    case 50:
      return "Posted";
    case 60:
      return "Reversed";
    case 70:
      return "Cancelled";
    default:
      return "Draft";
  }
}

export function canEdit(status: DocStatus): boolean {
  return status === "Draft" || status === "RequestedChanges";
}

export function canSubmit(status: DocStatus): boolean {
  return status === "Draft" || status === "RequestedChanges";
}

export function canApprove(status: DocStatus): boolean {
  return status === "Submitted";
}

export function canReject(status: DocStatus): boolean {
  return status === "Submitted";
}

export function canRequestChanges(status: DocStatus): boolean {
  return status === "Submitted";
}

export function canPost(status: DocStatus): boolean {
  return status === "Approved";
}

export function canReverse(status: DocStatus): boolean {
  return status === "Posted";
}

export type LocationDto = {
  id: string;
  name: string;
  code?: string | null;
  branchId?: string | null;
  canIssue?: boolean;
  canReceive?: boolean;
};

export type LookupDepartment = {
  value: string;
  text: string;
  code?: string | null;
};

export type LookupItem = {
  id: string;
  name: string;
  code?: string | null;
  baseUomId?: string | null;
  baseUomCode?: string | null;
};

export type LookupUom = {
  id: string;
  code: string;
  name?: string | null;
};

export type ItemDto = {
  id: string;
  name: string;
  sku?: string | null;
  code?: string | null;
  baseUomId?: string | null;
  baseUomCode?: string | null;
};

export type AvailabilityDto = {
  companyId?: string;
  branchId?: string;
  locationId: string;
  itemId: string;
  availableQty?: number;
  availableBaseQty: number;
  uomId?: string | null;
  uomCode?: string | null;
};

export type FifoIssueCandidateDto = {
  fifoLayerId?: string;
  sourceType?: string;
  sourceId?: string;
  sourceNumber?: string | null;
  receivedDate?: string | null;
  itemId: string;
  itemName?: string | null;
  uomId: string;
  uomCode?: string | null;
  availableQty: number;
  batchNo?: string | null;
  expiryDate?: string | null;
};

export type SivLineDto = {
  id: string;
  lineNo: number;
  itemId: string;
  itemCode?: string | null;
  itemName?: string | null;
  uomId: string;
  uomCode?: string | null;
  qty: number;
  remarks?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  issuedBaseQty?: number;
};

export type SivAuditDto = {
  requestedByUserId?: string;
  submittedByUserId?: string | null;
  approvedByUserId?: string | null;
  postedByUserId?: string | null;
  reversedByUserId?: string | null;
  submittedAtUtc?: string | null;
  approvedAtUtc?: string | null;
  postedAtUtc?: string | null;
  reversedAtUtc?: string | null;
};

export type SivDto = {
  id: string;
  companyId: string;
  branchId: string;
  number: string;
  docStatus: number; // backend int enum
  issueDate: string; // ISO
  departmentId: string;
  departmentName?: string | null;
  fromLocationId: string;
  fromLocationName?: string | null;
  toLocationId?: string | null;
  toLocationName?: string | null;
  remarks?: string | null;
  rowVersion?: string;
  lines: SivLineDto[];
  audit?: SivAuditDto;
};

export type SivListItemDto = {
  id: string;
  number: string;
  issueDate: string;
  branchId: string;
  branchName?: string | null;
  departmentId: string;
  departmentName?: string | null;
  fromLocationId: string;
  fromLocationName?: string | null;
  toLocationId?: string | null;
  toLocationName?: string | null;
  docStatus: number;
  totalLines: number;
  totalQuantity: number;
  requestedByName?: string | null;
};

export type SivDetailDto = {
  id: string;
  companyId: string;
  branchId: string;
  number: string;
  docStatus: number;
  issueDate: string;
  departmentId: string;
  departmentName?: string | null;
  fromLocationId: string;
  fromLocationName?: string | null;
  toLocationId?: string | null;
  toLocationName?: string | null;
  remarks?: string | null;
  rowVersion: string;
  lines: SivLineDto[];
  audit?: SivAuditDto;
};

export type SivDraftRowDto = {
  id: string;
  number?: string;
  updatedAt: string;
  rowVersion?: string;
};

export type CreateSivDraftLineRequest = {
  itemId: string;
  uomId: string;
  qty: number;
  remarks?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null; // ISO
};

export interface CreateSivDraftRequest {
  companyId: string;
  branchId: string;
  departmentId: string | null;
  fromLocationId: string;
  toLocationId?: string | null;
  issueDate: string; // ISO
  remarks?: string | null;
  lines: CreateSivDraftLineRequest[];
}

export type UpdateSivLineRequest = {
  id?: string | null;
  itemId: string;
  uomId: string;
  qty: number;
  remarks?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
};

export type UpdateSivRequest = {
  id: string;
  companyId: string;
  branchId: string;
  departmentId: string | null;
  fromLocationId: string;
  toLocationId?: string | null;
  issueDate: string; // ISO
  remarks?: string | null;
  rowVersion: string;
  lines: UpdateSivLineRequest[];
};

export type UpdateSivHeaderRequest = {
  branchId: string;
  departmentId: string | null;
  fromLocationId: string;
  toLocationId?: string | null;
  issueDate: string; // ISO or YYYY-MM-DD
  remarks?: string | null;
  rowVersion: string|null;
};

export type SivWorkflowActionRequest = {
  companyId: string;
  rowVersion: string;
  remarks?: string | null;
};

export type ReverseSivRequest = {
  companyId: string;
  rowVersion: string;
  reason: string;
};

export type SivActionResultDto = {
  id: string;
  number: string;
  docStatus: number;
  message: string;
};

export type SivPostConsumptionDto = {
  fifoLayerId: string;
  sourceType: string;
  sourceId: string;
  sourceNumber?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  consumedQty: number;
  unitCost: number;
  totalCost: number;
};

export type SivPostAllocationDto = {
  sivLineId: string;
  itemId: string;
  locationId: string;
  consumptions: SivPostConsumptionDto[];
};

export type PostSivResultDto = {
  id: string;
  number: string;
  docStatus: number;
  postedAtUtc: string;
  totalCost: number;
  allocations: SivPostAllocationDto[];
  message: string;
};

/**
 * UI form model for create/edit screen
 */
export type SivLineForm = {
  id: string;
  lineNo?: number;
  itemId: string;
  itemCode?: string | null;
  itemName: string;
  uomId: string;
  uomCode?: string | null;
  qty: number | "";
  availableBaseQty?: number;
  remarks?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  fifoCandidates?: FifoIssueCandidateDto[];
  selectedFifoKey?: string | null;
};

export type SivForm = {
  id?: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  fromLocationId: string;
  toLocationId?: string | null;
  issueDate: string;
  remarks?: string | null;
  rowVersion?: string;
  lines: SivLineForm[];
};
export type SivCreateScreenProps = {
  companyId: string;
  branchId: string;
  departmentId?: string | null;
  currentLocationId?: string | null;
};
export type ValidationErrors = {
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  issueDate?: string;
  remarks?: string;
  lines?: string;
  lineErrors?: Record<
    string,
    Partial<
      Record<
        | "itemId"
        | "uomId"
        | "qty"
        | "remarks"
        | "batchNo"
        | "expiryDate",
        string
      >
    >
  >;
};