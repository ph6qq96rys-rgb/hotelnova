export type GrnItemDto = {
  itemId: string;
  quantity: number;
  unitCost: number;
};

export type CreateGrnDto = {
  companyId: string;
  warehouseId: string;
  reference?: string | null;
  items: GrnItemDto[];
};

export type GrnDto = {
  id: string;
  grnNumber: string;
  status: "Draft" | "Posted" | "Reversed" | string;
  receiptDate: string;
  locationId: string;
  supplierId?: string | null;
  supplierName?: string | null;
  referenceNo?: string | null;
  notes?: string | null;
  total?: number;
  lines: {
    inventoryItemId: string;
    unitId: string;
    quantity: number;
    unitCost: number;
    batchNo?: string | null;
    expiryDateUtc?: string | null;
    notes?: string | null;
  }[];
};
export type GrnLineDraft = {
  inventoryItemId: string;
  uomId: string; // selectable from item.uoms
  quantity: number;
  unitCost: number;
  expiryDate: string | null; // YYYY-MM-DD
  notes: string; // UI -> nullable in payload
};

export type GrnDraft = {
  locationId: string; // warehouse/stock location
  receivedDate: string; // YYYY-MM-DD
  supplierName: string;
  notes: string;
  lines: GrnLineDraft[];
};

export type CreateGrnBody = {
    locationId: string;
    receivedAtUtc: string;
    supplierName: string;
    notes: string | null;
    lines: {
      inventoryItemId: string;
      quantity: number;
      unitId: string;
      unitCost: number;
      expiryDateUtc: string | null;
      notes: string | null;
    }[];
  };
export type InventoryItemDto = {
  id: string;
  name: string;
  code?: string;
  baseUomId: string;
  baseUomName?: string;

  uoms: {
    uomId: string;
    uomName: string;
    factorToBase: number;
    isDefaultPurchase?: boolean;
  }[];
};

// Shared type for dropdown options
export type SelectOption<T = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};
export type ItemUomDto = {
  uomId: string;
  uomName: string;
  factorToBase: number;
  isDefaultPurchase?: boolean;
};
export function toOptions<T>(
  rows: T[],
  getValue: (x: T) => string,
  getLabel: (x: T) => string
): SelectOption<string>[] {
  return rows.map((x) => ({
    value: getValue(x),
    label: getLabel(x),
  }));
};

export type GrnDraftLine = {
  tempId: string; // frontend only
  inventoryItemId: string | null;
  unitId: string | null; // UOM Id
  quantity: number;
  unitCost: number;
  batchNo?: string | null;
  expiryDateUtc?: string | null;
  notes?: string | null;
};

export type CreateGrnDraftRequest = {
  locationId: string | null; // warehouse/stock location
  receivedDate: string;     // ISO
  supplierName: string|null|undefined;
  reference?: string | null;
  notes?: string | null;
  lines: {
    inventoryItemId: string;
    unitId: string;
    quantity: number;
    unitCost: number;
    batchNo?: string | null;
    expiryDate?: string | null;
    notes?: string | null;
  }[];
};

export type UpdateGrnDraftRequest = CreateGrnDraftRequest;

export type GrnDraftListDto = {
  id: string;
  grnNumber?: string | null;
  supplierName: string;
  receivedDate: string;
  status: string; // Draft
};

export type GrnDraftDto = CreateGrnDraftRequest & {
  id: string;
  status: string;
};

export type GrnListDto = {
  id: string;
  grnNumber: string;
  receiptDate: string;
  warehouseId?: string|null;
  supplierName?: string|null;
  receivedDate: string;
  status?: string|null;
  notes?: string | null;
};

export type GrnDetailDto = GrnListDto & {
  lines: {
    itemId: string;
    itemName: string;
    uomId: string;
    uomName: string;
    quantity: number;
    unitCost: number;
    batchNo?: string | null;
    expiryDate?: string | null;
  }[];
};


export type ReverseGrnRequest = {
  grnNumber?: string | null;
  batchNo?: string | null;
  reason?: string | null;
};


