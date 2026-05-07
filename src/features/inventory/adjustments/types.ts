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
  | "Rejected"
  | "Cancelled"
  | "Unknown";

export type InventoryAdjustmentDto = {
  id: Guid;
  adjustmentNo: string;
  adjustmentDate: string;
locationName:string;
  companyId: Guid;
  branchId: Guid;
  locationId: Guid;
branchName:string;
  adjustmentType: AdjustmentType | string|undefined;
  docStatus: AdjustmentStatus | string | number;

  reason?: string | null;
  remarks?: string | null;

  lines: InventoryAdjustmentLineDto[];

  
};

export type CreateInventoryAdjustmentDto = {
  adjustmentDate: string;
  branchId: Guid;
  locationId: Guid;
  adjustmentType: AdjustmentType;
  reason?: string | null;
  remarks?: string | null;
  lines: InventoryAdjustmentLineDto[];
};
export type StockLocationOption = {
  id: string;
  name: string;
  code?: string | null;
};



// ===== CREATE FROM SIV =====
export interface CreateAdjustmentFromSivDto {
  adjustmentDate: string;
  remarks?: string;
  lines: {
    sivLineId: string;
    countedQty: number;
  }[];
}

// ===== UPDATE COUNT =====
export interface UpdateAdjustmentCountDto {
  adjustmentDate: string;
  remarks?: string;
  lines: {
    lineId: string;
    countedQty: number;
    notes?: string;
  }[];
}

// ===== REVERSE =====
export interface AdjustmentActionDto {
  note: string;
}
export type InventoryItemOption = {
  id: string;
  code?: string | null;
  name: string;

  fifoLotId: string;

  defaultUomId: string;
  defaultUomCode: string;
  defaultUomName: string;

  batchNo?: string | null;
  expiryDate?: string | null;

  availableQty: number;
  unitCost: number;
};

export type InventoryAdjustmentLineDto = {
  id?: string;

  fifoLotId?: string;

  stockLocationId: string;
  stockLocationName?: string;

  itemId: string;
  itemName?: string;

  uomId: string;
  uomCode?: string;
  uomName?: string;

  batchNo?: string | null;
  expiryDate?: string | null;

  systemQty: number;
  countedQty: number;
  adjustmentQty: number;

  unitCost?: number;

  notes?: string;
  reason?: string;
};



export type ManualAdjustmentCreateDto = {
  branchId: string;
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