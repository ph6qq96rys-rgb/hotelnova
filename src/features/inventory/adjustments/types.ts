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

export type AdjustmentStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Posted"
  | "Reversed"
  | "Rejected";

// ── Read DTOs ────────────────────────────────────────────────────────────────

export type InventoryAdjustmentLineDto = {
  id?: string;
  lineNo: number;

  itemId: string;
  itemName?: string;
  stockLocationId?: string;
  stockLocationName?: string;

  uomId: string;
  uomName?: string;
  systemQty: number;
  countedQty: number;
  adjustmentQty: number;

  baseUomId: string;
  baseUomName?: string;
  conversionFactor: number;
  isBaseUnit: boolean;
  systemQtyBase: number;
  countedQtyBase: number;
  adjustmentQtyBase: number;

  unitCost: number;
  unitCostDisplay: number;
  lineAmount: number;

  fifoLotId: string;
  batchNo?: string;
  expiryDate?: string;

  variancePercent: number;
  isHighVariance: boolean;
  notes?: string;
};

export type InventoryAdjustmentDto = {
  id: string;
  companyId: string;
  branchId: string;

  /**
   * Must be the real StockLocation.Id, not BranchStockLocation.Id.
   */
  locationId?: string;

  locationName?: string;
  stockLocationName?: string;

  adjustmentNo: string;
  adjustmentDate: string;
  adjustmentType: AdjustmentType | string;
  docStatus: AdjustmentStatus | string;
  referenceNo?: string;
  reason?: string;
  remarks?: string;

  totalSystemQty: number;
  totalCountedQty: number;
  totalAdjustmentQty: number;
  totalAdjustmentValue?: number;
  hasHighVariance: boolean;
  highestVariancePercent: number;

  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  postedAt?: string;
  reversedAt?: string;
  rejectedAt?: string;
  rejectionNote?: string;
  reverseReason?: string;

  lines: InventoryAdjustmentLineDto[];
};

// ── Candidates ───────────────────────────────────────────────────────────────

export type AdjustmentCandidateDto = {
  itemId: string;
  itemName: string;
  itemCode?: string;
  sku?: string;

  /**
   * Real StockLocation.Id.
   */
  locationId: string;

  locationName: string;

  uomId: string;
  uomName: string;
  systemQty: number;
  systemQtyBase: number;
  availableQty: number;

  unitCost: number;
  unitCostDisplay: number;

  baseUomId: string;
  baseUomName: string;

  toBaseFactor: number;
  conversionFactor: number;

  fifoLotId: string;
  batchNo?: string;
  expiryDate?: string;
  receivedAt: string;

  isBaseUnit?: boolean;
};

// ── Stock locations ──────────────────────────────────────────────────────────

export type StockLocationOption = {
  /**
   * UI-safe value. After normalization, this should be the real StockLocation.Id.
   */
  id: string;

  /**
   * Real StockLocation.Id expected by backend adjustment validation.
   */
  stockLocationId?: string;

  /**
   * Branch assignment id from BranchStockLocation / BranchLocation.
   * Never send this as adjustment locationId.
   */
  branchLocationId?: string;

  /**
   * Legacy alias.
   */
  locationId?: string;

  name: string;
  stockLocationName?: string;
  locationName?: string;
  code?: string | null;

  branchId?: string;
  isActive?: boolean;
  canAdjust?: boolean;

  canConsumeFrom?: boolean;
  canReceiveTo?: boolean;
  canTransferFrom?: boolean;
  canTransferTo?: boolean;

  isDefaultReceiving?: boolean;
  isDefaultIssue?: boolean;
};

// ── Write commands ───────────────────────────────────────────────────────────

export type AdjustmentLineDraftItem = {
  fifoLotId: string;
  itemId: string;
  uomId: string;
  systemQty: number;
  countedQty: number;
  unitCost: number;
  notes?: string;
};

export type CreateAdjustmentDraftCommand = {
  /**
   * Must be real StockLocation.Id.
   */
  locationId?: string;

  adjustmentDate?: string;
  adjustmentType: AdjustmentType | string;
  referenceNo?: string;
  reason?: string;
  remarks?: string;
  lines: AdjustmentLineDraftItem[];
};

export type CreateAdjustmentCommand = CreateAdjustmentDraftCommand;

export type UpdateAdjustmentDraftCommand = {
  /**
   * Must be real StockLocation.Id.
   */
  locationId?: string;

  referenceNo?: string;
  reason?: string;
  remarks?: string;
  adjustmentType?: AdjustmentType | string;
  adjustmentDate?: string | null;
  highVarianceThresholdPercent?: number;
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

// ── Legacy DTOs ──────────────────────────────────────────────────────────────

export type CreateInventoryAdjustmentDto = {
  adjustmentDate: string;
  branchId: Guid;

  /**
   * Must be real StockLocation.Id.
   */
  locationId: Guid;

  adjustmentType: AdjustmentType;
  reason?: string | null;
  remarks?: string | null;
  lines: InventoryAdjustmentLineDto[];
};

export interface CreateAdjustmentFromSivDto {
  adjustmentDate: string;
  remarks?: string;
  lines: {
    sivLineId: string;
    countedQty: number;
  }[];
}

export interface UpdateAdjustmentCountDto {
  adjustmentDate: string;
  remarks?: string;
  lines: {
    lineId: string;
    countedQty: number;
    notes?: string;
  }[];
}

export interface AdjustmentActionDto {
  note: string;
}

export type ManualAdjustmentCreateDto = {
  branchId: string;

  /**
   * Must be real StockLocation.Id.
   */
  locationId: string;

  adjustmentDate: string;
  remarks?: string;
  lines: {
    fifoLotId: string;
    itemId: string;
    uomId: string;
    batchNo?: string | null;
    expiryDate?: string | null;
    systemQty: number;
    countedQty: number;
    adjustmentQty: number;
    unitCost: number;
    notes?: string | null;
  }[];
};

// ── Legacy lookup DTOs ───────────────────────────────────────────────────────

export type AdjustmentFifoItemDto = {
  fifoLotId: string;
  id: string;
  itemId: string;
  name: string;
  itemName: string;
  code?: string;
  sku?: string;
  defaultUomId: string;
  baseUomId: string;
  defaultUomName: string;
  baseUomName: string;
  defaultUomCode?: string;
  availableQty: number;
  unitCost: number;
  batchNo?: string;
  expiryDate?: string;
};

export type InventoryItemOption = {
  id: string;
  code?: string | null;
  name: string;
  sku: string | null;
  itemName: string | null;
  fifoLotId: string;
  defaultUomId: string;
  defaultUomCode: string;
  defaultUomName: string;
  batchNo?: string | null;
  expiryDate?: string | null;
  availableQty: number;
  unitCost: number;
};