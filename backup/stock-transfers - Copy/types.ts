export const STOCK_TRANSFER_STATUS = {
  Draft: "Draft",
  Submitted: "Submitted",
  Approved: "Approved",
  Rejected: "Rejected",
  Posted: "Posted",
  Reversed: "Reversed",
  Cancelled: "Cancelled",
  Failed: "Failed",
  Issued: "Issued",
  ChangesRequested: "ChangesRequested"
} as const;

export type StockTransferStatus =
  (typeof STOCK_TRANSFER_STATUS)[keyof typeof STOCK_TRANSFER_STATUS];

export type StockLocationDto = {
  id: string;
  companyId: string;
  branchId: string;

  code?: string | null;
  name: string;
  type?: string | null;

  address?: string | null;
  phone?: string | null;

  isActive: boolean;
};

export type BranchOptionDto = {
  id: string;
  code?: string | null;
  name: string;
  label?: string | null;
};

export type UomOptionDto = {
  id: string;
  code: string;
  name?: string | null;
};

export type ItemOptionDto = {
  id: string;
  itemId: string;

  code: string;
  name: string;
  label: string;

  defaultUomId?: string | null;

  baseUom: {
    id: string;
    code: string;
    name?: string | null;
  };
};

export type StockTransferListDto = {
  id: string;
  transferNumber: string;
  transferDateUtc: string;
  status: StockTransferStatus;

  reference?: string | null;
  notes?: string | null;

  fromLocationId?: string | null;
  fromLocationName: string;

  toLocationId?: string | null;
  toLocationName: string;

  totalQuantity: number;
  totalValue?: number | null;
};

export type StockTransferLineDto = {
  id: string;

  itemId?: string | null;
  itemCode: string;
  itemName: string;

  uomId?: string | null;
  uom: string;

  quantity: number;

  avgUnitCost?: number | null;
  lineValue?: number | null;

  notes?: string | null;
};

export type StockTransferDetailDto = {
  id: string;

  transferNumber: string;
  transferDateUtc: string;
  status: StockTransferStatus;

  reference?: string | null;
  notes?: string | null;

  fromLocationId: string;
  fromLocationName: string;

  toLocationId: string;
  toLocationName: string;

  totalQuantity: number;
  totalValue?: number | null;

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

export type CreateStockTransferLineRequest = {
  itemId: string;
  unitId: string;
  quantity: number;
  notes?: string | null;
};

export type CreateStockTransferRequest = {
  fromLocationId: string;
  toLocationId: string;
  requestedAtUtc?: string | null;
  notes?: string | null;
  lines: CreateStockTransferLineRequest[];
};

export type UpdateStockTransferLineRequest = {
  itemId: string;
  unitId: string;
  quantity: number;
  notes?: string | null;
};

export type UpdateStockTransferRequest = {
  fromLocationId: string;
  toLocationId: string;
  requestedAtUtc?: string | null;
  notes?: string | null;
  lines: UpdateStockTransferLineRequest[];
};

export type RejectStockTransferRequest = {
  reason: string;
};

export type CancelStockTransferRequest = {
  reason?: string | null;
};

export type StockLocationFilter = {
  companyId: string;
  branchId: string;
  q?: string | null;
  activeOnly?: boolean;
};