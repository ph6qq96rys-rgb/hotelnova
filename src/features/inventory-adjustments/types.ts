export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type CreateInventoryAdjustmentDto = {
  companyId: string|null;
  branchId: string|null;
  type: "COUNT" | "WASTE" | "DAMAGE" | "VARIANCE";
  reason: string;
  lines: InventoryAdjustmentLineDto[];
};

export type InventoryAdjustmentLineDto = {
  inventoryItemId: string;
  locationId: string;
  quantity: number;
  unit: string; // "pcs", "kg", "g", "l", "ml"
  note?: string;
};

export type InventoryAdjustmentListDto = {
  id: string;
  number: string;
  type: string;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  createdAtUtc: string;
};

export type InventoryAdjustmentDetailDto = InventoryAdjustmentListDto & {
  reason: string;
  lines: InventoryAdjustmentLineDto[];
};
