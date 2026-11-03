// src/features/inventory/adjustments/types.ts

export type Guid = string;

export type AdjustmentType =
  | "StockCount"
  | "Variance"
  | "Correction"
  | "Waste"
  | "Spoilage"
  | "Expiry"
  | "Damage"
  | "Other";

export type AdjustmentStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Posted"
  | "Reversed"
  | "Rejected"
  | "Cancelled";

/** Adjustment type and the general-ledger posting key it uses (from lookups/types). */
export type AdjustmentTypeOption = {
  value: AdjustmentType;
  label: string;
  description: string;
  glPostingKey: string;
  isWriteOff: boolean;
};

//  Read DTOs

export type InventoryAdjustmentLineDto = {
  id?: string;
  lineNo: number;

  itemId: string;
  itemName?: string;
  itemCode?: string;

  uomId: string;
  uomName?: string;
  uomCode?: string;
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

  /** Per base unit. */
  unitCost: number;
  /** Per counting unit. */
  unitCostDisplay: number;
  /** Signed value; once posted, the value the stock ledger posted. */
  lineAmount: number;

  /** Missing when the item is counted as a whole at the location. */
  fifoLotId?: string | null;
  batchNo?: string;
  expiryDate?: string;

  variancePercent: number;
  isHighVariance: boolean;
  requiresApproval?: boolean;
  /** Stock on hand now (base unit) while the document is open. */
  currentQtyBase?: number | null;
  notes?: string;
};

export type GlStatus = "NotPosted" | "Waiting" | "Posted" | "Failed" | "Skipped";

export type InventoryAdjustmentDto = {
  id: string;
  companyId: string;
  branchId: string;

  /** The real StockLocation.Id, not BranchStockLocation.Id. */
  locationId?: string;
  locationName?: string;
  stockCountSessionId?: string | null;
  /** Send back with every change; the server refuses changes made on an older copy. */
  version: string;

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
  cancelledAt?: string;

  createdByName?: string;
  submittedByName?: string;
  approvedByName?: string;
  postedByName?: string;
  rejectedByName?: string;
  cancelledByName?: string;
  reversedByName?: string;

  autoApproved?: boolean;
  approvalNote?: string;
  rejectionNote?: string;
  cancelReason?: string;
  reverseReason?: string;

  glStatus?: GlStatus | string;
  glJournalNo?: string;
  glMessage?: string;
  reversalGlJournalNo?: string;

  lines: InventoryAdjustmentLineDto[];
};

//  Candidates (lots, or whole items for found stock)

export type AdjustmentCandidateDto = {
  itemId: string;
  itemName: string;
  itemCode?: string;
  sku?: string;

  /** Real StockLocation.Id. */
  locationId: string;
  locationName: string;

  /** The unit the item is counted in. */
  uomId: string;
  uomName: string;
  uomCode?: string;
  systemQty: number;
  systemQtyBase: number;
  availableQty: number;

  unitCost: number;
  unitCostDisplay: number;

  baseUomId: string;
  baseUomName: string;
  baseUomCode?: string;

  conversionFactor: number;
  toBaseFactor?: number;

  /** Missing for an item counted as a whole. */
  fifoLotId?: string | null;
  isItemLevel?: boolean;
  openLotCount?: number;
  batchNo?: string;
  expiryDate?: string;
  receivedAt?: string;
};

//  Stock locations

export type StockLocationOption = {
  /** UI-safe value. After normalization, this should be the real StockLocation.Id. */
  id: string;
  /** Real StockLocation.Id expected by backend adjustment validation. */
  stockLocationId?: string;
  /** Branch assignment id from BranchStockLocation / BranchLocation. Never send this as locationId. */
  branchLocationId?: string;
  /** Legacy alias. */
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

//  Write commands

/**
 * One counted line. The server reads the book quantity, cost, units, batch and expiry from the stock
 * ledger; only what was counted and why is sent.
 */
export type AdjustmentLineInput = {
  fifoLotId?: string | null;
  itemId: string;
  uomId?: string;
  countedQty: number;
  reason?: string;
};

export type CreateAdjustmentDraftCommand = {
  /** Must be the real StockLocation.Id. */
  locationId: string;
  adjustmentDate?: string;
  adjustmentType: AdjustmentType | string;
  referenceNo?: string;
  reason?: string;
  remarks?: string;
  lines: AdjustmentLineInput[];
};

export type UpdateAdjustmentDraftCommand = CreateAdjustmentDraftCommand & {
  version?: string;
};

//  Legacy lookup DTO (lookups/fifo-items)

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
