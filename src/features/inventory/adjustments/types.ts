// src/features/inventory/adjustments/types.ts

export type Guid = string;

export type AdjustmentType =
  | "StockCount"
  | "Waste"
  | "Damage"
  | "Variance"
  | "Expiry"
  | "Spoilage"
  | "Other";

// Matches backend DocStatus exactly. Unknown/Cancelled removed — they do not
// exist in the server enum and normalizeAdjustmentStatus never returns them.
export type AdjustmentStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Posted"
  | "Reversed"
  | "Rejected";

// ── Read DTOs (from backend) ──────────────────────────────────────────────────

export type InventoryAdjustmentLineDto = {
  variancePercent:   number;
  lineNo:            number;
  isHighVariance:    any;
  id?:               string;
  itemId:            string;
  itemName?:         string;
  stockLocationName?: string;
  stockLocationId?:  string;

  // Counting UOM (user-facing)
  uomId:             string;
  uomName?:          string;
  systemQty:         number;
  countedQty:        number;
  adjustmentQty:     number;

  // Base UOM (FIFO / posting)
  baseUomId:         string;
  baseUomName?:      string;
  conversionFactor:  number;
  isBaseUnit:        boolean;
  systemQtyBase:     number;
  countedQtyBase:    number;
  adjustmentQtyBase: number;

  // Cost
  unitCost:          number;   // per base unit
  unitCostDisplay:   number;   // per counting unit
  lineAmount:        number;

  // FIFO / batch
  fifoLotId:         string;
  batchNo?:          string;
  expiryDate?:       string;
  notes?:            string;
};

export type InventoryAdjustmentDto = {
  id:                     string;
  companyId:              string;
  branchId:               string;
  locationId?:            string;
  adjustmentNo:           string;
  adjustmentDate:         string;
  adjustmentType:         string;
  docStatus:              string;
  referenceNo?:           string;
  reason?:                string;
  remarks?:               string;

  // Totals
  totalSystemQty:         number;
  totalCountedQty:        number;
  totalAdjustmentQty:     number;
  totalAdjustmentValue?:  number;
  hasHighVariance:        boolean;
  highestVariancePercent: number;

  // Workflow timestamps
  createdAt:              string;
  submittedAt?:           string;
  approvedAt?:            string;
  postedAt?:              string;
  reversedAt?:            string;
  rejectedAt?:            string;
  rejectionNote?:         string;
  reverseReason?:         string;

  lines: InventoryAdjustmentLineDto[];
};

// ── Candidates (adjustment line picker) ───────────────────────────────────────

export type AdjustmentCandidateDto = {
  itemId:          string;
  itemName:        string;
  itemCode?:       string;
  sku?:            string;
  locationId:      string;
  locationName:    string;

  // Counting UOM (user-facing)
  uomId:           string;
  uomName:         string;
  systemQty:       number;   // in counting UOM
  systemQtyBase:   number;   // in base UOM
  availableQty:    number;   // raw FIFO remaining (base)
  unitCost:        number;   // per base unit
  unitCostDisplay: number;   // per counting unit

  // Base UOM
  baseUomId:       string;
  baseUomName:     string;

  /**
   * Conversion factor: how many base units make one counting unit.
   * The backend InventoryAdjustmentService returns this as `conversionFactor`.
   * The legacy type called it `toBaseFactor`.
   * Both are present so old and new code compile without changes.
   */
  toBaseFactor:        number;
  conversionFactor:    number;   // alias — same value, new field name

  // FIFO lot
  fifoLotId:       string;
  batchNo?:        string;
  expiryDate?:     string;
  receivedAt:      string;

  /** Derived client-side as uomId === baseUomId. Kept optional for compat. */
  isBaseUnit?:     boolean;
};

// ── FIFO item lookup (legacy lookup endpoint) ─────────────────────────────────

export type AdjustmentFifoItemDto = {
  fifoLotId:        string;
  id:               string;
  itemId:           string;
  name:             string;
  itemName:         string;
  code?:            string;
  sku?:             string;
  defaultUomId:     string;
  baseUomId:        string;
  defaultUomName:   string;
  baseUomName:      string;
  defaultUomCode?:  string;
  availableQty:     number;
  unitCost:         number;
  batchNo?:         string;
  expiryDate?:      string;
};

// ── Write commands (to backend) ───────────────────────────────────────────────

export type AdjustmentLineDraftItem = {
  fifoLotId:  string;
  itemId:     string;
  uomId:      string;
  systemQty:  number;
  countedQty: number;
  unitCost:   number;
  notes?:     string;
};

export type CreateAdjustmentDraftCommand = {
  locationId?:    string;
  adjustmentDate?: string;
  adjustmentType: string;
  referenceNo?:   string;
  reason?:        string;
  remarks?:       string;
  lines:          AdjustmentLineDraftItem[];
};

// Alias so new code using the consolidated command names compiles without
// touching types.ts again.
export type CreateAdjustmentCommand = CreateAdjustmentDraftCommand;

export type UpdateAdjustmentDraftCommand = {
  locationId?:    string;
  referenceNo?:   string;
  reason?:        string;
  remarks?:       string;
  adjustmentType?: string;
  adjustmentDate?: string | null;
  highVarianceThresholdPercent?:    number;
  managerApprovalThresholdPercent?: number;
  lines: AdjustmentLineDraftItem[];
};

export type UpdateAdjustmentCommand = UpdateAdjustmentDraftCommand;

export type AdjustmentActionCommand = {
  note?: string;
};

export type AdjustmentReverseCommand = {
  reason: string;
};

// ── Legacy write DTOs (kept for backward compat) ─────────────────────────────

export type CreateInventoryAdjustmentDto = {
  adjustmentDate: string;
  branchId:       Guid;
  locationId:     Guid;
  adjustmentType: AdjustmentType;
  reason?:        string | null;
  remarks?:       string | null;
  lines:          InventoryAdjustmentLineDto[];
};

export interface CreateAdjustmentFromSivDto {
  adjustmentDate: string;
  remarks?:       string;
  lines: {
    sivLineId:  string;
    countedQty: number;
  }[];
}

export interface UpdateAdjustmentCountDto {
  adjustmentDate: string;
  remarks?:       string;
  lines: {
    lineId:     string;
    countedQty: number;
    notes?:     string;
  }[];
}

export interface AdjustmentActionDto {
  note: string;
}

export type ManualAdjustmentCreateDto = {
  branchId:      string;
  locationId:    string;
  adjustmentDate: string;
  remarks?:      string;
  lines: {
    fifoLotId:     string;
    itemId:        string;
    uomId:         string;
    batchNo?:      string | null;
    expiryDate?:   string | null;
    systemQty:     number;
    countedQty:    number;
    adjustmentQty: number;
    unitCost:      number;
    notes?:        string | null;
  }[];
};

// ── Misc ──────────────────────────────────────────────────────────────────────

export type InventoryItemOption = {
  id:             string;
  code?:          string | null;
  name:           string;
  sku:            string | null;
  itemName:       string | null;
  fifoLotId:      string;
  defaultUomId:   string;
  defaultUomCode: string;
  defaultUomName: string;
  batchNo?:       string | null;
  expiryDate?:    string | null;
  availableQty:   number;
  unitCost:       number;
};

export type StockLocationOption = {
  id:                  string;
  name:                string;
  code?:               string | null;
  isActive?:           boolean;
  isDefaultReceiving?: boolean;
  isDefaultIssue?:     boolean;
};