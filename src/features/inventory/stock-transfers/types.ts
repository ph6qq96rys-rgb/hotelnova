
export const STOCK_TRANSFER_STATUS = {
  Draft: "Draft",
  Submitted: "Submitted",
  Approved: "Approved",
  Rejected: "Rejected",
  Posted: "Posted",
  Reversed: "Reversed",
  Cancelled: "Cancelled",
} as const;

export type StockTransferStatus =
  typeof STOCK_TRANSFER_STATUS[keyof typeof STOCK_TRANSFER_STATUS];


export type StockLocationDto = {
  id: string;
  companyId: string;
  branchId?: string | null;

  name: string;
  code?: string | null;
  type: string|null;

  address?: string | null;
  phone?: string | null;

  isActive: boolean;
};

export type StockTransferListDto = {
  id: string; // internal, not shown in UI
  transferNumber: string;
  transferDateUtc: string;
  status: StockTransferStatus;
  reference?: string | null;

  fromLocationName: string;
  toLocationName: string;

  totalQuantity: number;
  totalValue?: number | null;
};

export type StockTransferLineDto = {
  id: string; // internal, not shown
  itemCode: string; // SKU/Code
  itemName: string;
  uom: string;
  quantity: number;

  avgUnitCost?: number | null;
  lineValue?: number | null;
};

export type StockTransferDetailDto = {
  id: string; // internal, not shown

  transferNumber: string;
  transferDateUtc: string;
  status: StockTransferStatus;
  reference?: string | null;

  fromLocationName: string;
  toLocationName: string;
  fromLocationId:string,
  toLocationId:string,

  totalQuantity: number;
  totalValue?: number | null;

  // audit
  submittedBy?: string | null;
  submittedAtUtc?: string | null;

  approvedBy?: string | null;
  approvedAtUtc?: string | null;

  postedBy?: string | null;
  postedAtUtc?: string | null;

  rejectedBy?: string | null;
  rejectedAtUtc?: string | null;
  rejectionReason?: string | null;

  items: StockTransferLineDto[];
};

export type BranchOptionDto = {
  code: string;
  name: string;
};

export type ItemOptionDto = {
  code: string;
  name: string;
  baseUom: string;
};

export type CreateStockTransferRequest = {
  companyId: string;
  fromLocationCode?: string; // default "HQ"
  toLocationCode: string;
  reference?: string | null;
  transferDateUtc?: string | null;
  items: { itemCode: string; quantity: number }[];
};
export type UpdateStockTransferRequest = {
  companyId: string;
  fromLocationCode?: string; // default "HQ"
  toLocationCode: string;
  reference?: string | null;
  transferDate?: string | null;
  items: { 
    inventoryItemId: string;
    quantity: number;
    unitId: string;
    notes?: string | null; }[];
};
export type StockLocationFilter = {
  companyId: string;
  branchId: string;          // required for "only selected branch"
  q?: string | null;         // optional search
  activeOnly?: boolean;      // default true
};
export type CreateStockTransferRequestDto = {
  companyId: string;
  fromLocationId: string;
  toLocationId: string;
  requestedAtUtc?: string | null; // string, not Date
  notes?: string | null;
  lines: Array<{
    inventoryItemId: string;
    quantity: number;
    unitId: string;
    notes?: string | null;
  }>;
};
