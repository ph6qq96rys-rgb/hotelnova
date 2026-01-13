export type InventoryMovementType =
  | "GRN"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT"
  | "CONSUMPTION";

// src/features/inventory/ledger/types.ts

export interface InventoryLedgerDto {
  id: string;
  createdAtUtc: string;
  itemId: string;
  itemName?: string;
  locationId: string;
  locationName?: string;
  movementType: string;
  quantity: number;
  unitCost: number;
}

export type InventoryLotDto = {
  id: string;
  itemId: string;
  itemName?: string;
  locationId: string;
  remainingQty: number;
  unitCost: number;
  receivedAtUtc: string;
};

export type InventoryLedgerFilter = {
  companyId: string;
  locationId?: string | null;
  itemId?: string | null;
  from?: string | null;
  to?: string | null;
};
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface InventoryLedgerLineDto {
  postedAt: string;          // ISO date string
  itemId?: string;
  itemName: string;
  locationId?: string;
  locationName: string;
  referenceNo?: string;
  sourceType?: string;
  qty: number;
  uom: string;
  balanceQty?: number;       // if your dto includes it
  unitCost?: number;
  value?: number;
}

export type InventoryLedgerQuery = {
  fromUtc?: string;      // ISO string
  toUtc?: string;        // ISO string
  itemId?: string|null;
  locationId?: string|null;
  item?: string;
  location?: string;
  referenceNo?: string;
  page?: number;
  pageSize?: number;
};


