// src/features/inventory/ledger/types.ts

export type InventoryMovementType =
  | "GRN"
  | "SALE_COGS"
  | "SIV_TRANSFER_IN"
  | "SIV_TRANSFER_OUT"
  | "STOCK_TRANSFER_IN"
  | "STOCK_TRANSFER_OUT"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "PRODUCTION_INPUT"
  | "PRODUCTION_OUTPUT"
  | string;

export type LedgerDirection = "IN" | "OUT" | "In" | "Out";

/**
 * Immutable inventory stock-card row returned by:
 *
 * GET /api/companies/{companyId}/branches/{branchId}/inventory-ledger
 */
export interface InventoryLedgerDto {
  id?: string;

  postedAtUtc: string;

  referenceType: string;
  referenceNo: string;

  itemId?: string;
  itemName: string;

  locationId?: string;
  locationName: string;

  uom: string;
  direction: LedgerDirection;

  quantity: number;
  quantityBase: number;

  qtyInBase: number;
  qtyOutBase: number;

  unitCost: number | null;
  valueChange: number | null;

  balanceBase: number;
  balanceValue: number | null;
}

/**
 * Open FIFO layer returned by the inventory-lot endpoint.
 */
export interface InventoryLotDto {
  id: string;

  itemId: string;
  itemName?: string;

  locationId: string;
  locationName?: string;

  remainingQty: number;
  unitCost: number;

  receivedAtUtc: string;

  batchNo?: string | null;
  expiryDateUtc?: string | null;
}

/**
 * Query parameters accepted by the branch-scoped inventory-ledger endpoint.
 *
 * toUtc is an exclusive upper boundary.
 */
export interface InventoryLedgerQuery {
  fromUtc?: string | null;
  toUtc?: string | null;

  itemId?: string | null;
  locationId?: string | null;

  item?: string | null;
  location?: string | null;
  referenceNo?: string | null;

  movementType?: InventoryMovementType | null;
  batchNo?: string | null;

  page?: number;
  pageSize?: number;
}

/**
 * Optional UI filter model.
 *
 * CompanyId and BranchId belong to application scope and should normally not
 * be duplicated inside the ledger query object.
 */
export interface InventoryLedgerFilter {
  itemId?: string | null;
  locationId?: string | null;

  item?: string | null;
  location?: string | null;
  referenceNo?: string | null;

  movementType?: InventoryMovementType | null;
  batchNo?: string | null;

  fromUtc?: string | null;
  toUtc?: string | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
