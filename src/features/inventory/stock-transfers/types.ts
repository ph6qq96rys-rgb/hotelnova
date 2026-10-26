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
// ── Stock transfers between stock locations ────────────────────────────────
// From a location of this branch to any receiving location: in this branch (posted in one step) or in
// another branch (dispatched into transit, then received there). The destination location decides which.
// A store issuing to a consumption location of its own branch is an SIV, not a stock transfer.

export const STOCK_TRANSFER_TYPE = {
  InterDepartment: "InterDepartment",
  InterBranch: "InterBranch",
} as const;

export type StockTransferType =
  (typeof STOCK_TRANSFER_TYPE)[keyof typeof STOCK_TRANSFER_TYPE];

export type StockTransferDirection = "outgoing" | "incoming" | "all";

export type StockTransferAction =
  | "edit"
  | "submit"
  | "approve"
  | "reject"
  | "post"
  | "dispatch"
  | "receive"
  | "recall"
  | "reverse"
  | "cancel";

export type StockTransferListRowDto = StockTransferListDto & {
  transferType: StockTransferType | number;
  direction: "outgoing" | "incoming";
  branchId: string;
  toBranchId: string;
  fromBranchName?: string | null;
  toBranchName?: string | null;
  fromDepartmentName?: string | null;
  toDepartmentName?: string | null;
  lineCount: number;
  hasShortage: boolean;
  dispatchedAtUtc?: string | null;
  postedAtUtc?: string | null;
};

export type StockTransferDetailLineDto = {
  id: string;
  itemId: string;
  quantity: number;
  uomId: string;
  lineNo: number;
  itemCode?: string | null;
  itemName?: string | null;
  uomCode?: string | null;
  uomName?: string | null;
  avgUnitCost?: number | null;
  lineValue?: number | null;
  notes?: string | null;
  receivedQty?: number | null;
  shortQty: number;
  availableBaseQty?: number | null;
  baseUomCode?: string | null;
};

export type StockTransferDocumentDto = {
  id: string;
  companyId: string;
  transferNumber: string;
  transferDateUtc?: string | null;
  reference?: string | null;
  status: StockTransferStatus | number;
  transferType: StockTransferType | number;
  direction: "outgoing" | "incoming";
  branchId: string;
  toBranchId: string;
  fromBranchName?: string | null;
  toBranchName?: string | null;
  fromDepartmentId?: string | null;
  toDepartmentId?: string | null;
  fromDepartmentName?: string | null;
  toDepartmentName?: string | null;
  fromLocationId: string;
  toLocationId: string;
  fromLocationName?: string | null;
  toLocationName?: string | null;
  transitLocationName?: string | null;
  items: StockTransferDetailLineDto[];
  createdAtUtc?: string | null;
  submittedAtUtc?: string | null;
  approvedAtUtc?: string | null;
  dispatchedAtUtc?: string | null;
  postedAtUtc?: string | null;
  rejectedAtUtc?: string | null;
  rejectionReason?: string | null;
  receiptNotes?: string | null;
  cancelledAtUtc?: string | null;
  cancellationReason?: string | null;
  reversedAtUtc?: string | null;
  reversalReason?: string | null;
  totalValue?: number | null;
  shortValue?: number | null;
  allowedActions: StockTransferAction[];
};

export type StockTransferBranchOption = { id: string; code: string; name: string };
export type StockTransferDepartmentOption = { id: string; branchId: string; code: string; name: string };
export type StockTransferLocationOption = {
  id: string;
  code: string;
  name: string;
  locationType: string;
  isStore: boolean;
  isDepartment: boolean;
};

/** A receiving location with the branch it receives for (a shared location appears once per branch). */
export type StockTransferDestinationOption = {
  id: string;
  code: string;
  name: string;
  locationType: string;
  isStore: boolean;
  branchId: string;
  branchName: string;
  sameBranch: boolean;
};

/** An item with stock at the sending location, in its base unit. */
export type StockTransferAvailableItemDto = {
  itemId: string;
  itemCode?: string | null;
  itemName: string;
  baseUomId: string;
  baseUomCode?: string | null;
  availableBaseQty: number;
};

export type StockTransferLookupsDto = {
  destinationBranches: StockTransferBranchOption[];
  fromDepartments: StockTransferDepartmentOption[];
  toDepartments: StockTransferDepartmentOption[];
  fromLocations: StockTransferLocationOption[];
  toLocations: StockTransferLocationOption[];
  /** Receiving locations across all active branches, this branch first. */
  destinations?: StockTransferDestinationOption[];
};

/** Body of create (lines) and update (items) – the API names differ, the form does not. */
export type StockTransferFormLine = {
  itemId: string;
  unitId: string;
  quantity: number;
  notes: string;
};

export type StockTransferFormValues = {
  transferType: StockTransferType;
  toBranchId: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  fromLocationId: string;
  toLocationId: string;
  transferDate: string;
  notes: string;
  lines: StockTransferFormLine[];
};

export type ReceiveStockTransferRequest = {
  notes?: string | null;
  lines: Array<{ lineId: string; receivedQty: number }>;
};
