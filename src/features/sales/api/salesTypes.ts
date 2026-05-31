export type Guid = string;

export enum PosSessionStatus {
  Open = 1,
  Closed = 2,
}

export enum SaleStatus {
  Draft = 1,
  Confirmed = 2,
  Posted = 3,
  Cancelled = 4,
  Reversed = 5,
}

export enum PaymentStatus {
  Unpaid = 1,
  PartiallyPaid = 2,
  Paid = 3,
  Cancelled = 4,
  Refunded = 5,
}

export interface PosSessionDto {
  id: Guid;
  companyId: Guid;
  branchId: Guid;
  cashierId?: Guid | null;
  cashierName: string;
  terminal?: string | null;
  openingFloat: number;
  closingFloat?: number | null;
  openedAtUtc: string;
  closedAtUtc?: string | null;
  status: PosSessionStatus | number;
  isZReported?: boolean;
  zReportedAtUtc?: string | null;
}

export interface StockLocationDto {
  id: Guid;
  name: string;
  code?: string | null;
  isActive?: boolean;
  isDefaultIssue?: boolean;
  isDefaultReceiving?: boolean;
}

export interface MenuItemLookupDto {
  id: Guid;
  name: string;
  code?: string | null;
  externalCode?: string | null;
  sellingPrice: number;
  itemType?: number;
  categoryName?: string | null;
  subCategoryName?: string | null;
  isActive?: boolean;
}

export interface CartLine {
  menuItemId: Guid;
  name: string;
  unitPrice: number;
  quantity: number;
  categoryName?: string | null;
}

export interface SplitPayment {
  method: string;
  amount: string;
  referenceCode?: string;
}

export interface CreateSaleDto {
  companyId: Guid;
  branchId: Guid;
  locationId: Guid;
  discountAmount: number;
  taxAmount: number;
  serviceChargeAmount: number;
  lines: Array<{
    menuItemId: Guid;
    quantity: number;
    unitPrice: number;
  }>;
  payment?: {
    amount: number;
    method: string;
    referenceCode?: string;
  } | null;
}

export interface SaleLineDto {
  id: Guid;
  menuItemId: Guid;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  lineCogs: number;
}

export interface PaymentLineDto {
  id: Guid;
  method: string;
  amount: number;
  referenceCode?: string | null;
  paidAt: string;
}

export interface SaleDto {
  id: Guid;
  saleNo: string;
  companyId: Guid;
  branchId: Guid;
  locationId: Guid;
  soldAtUtc: string;
  status: number;
  paymentStatus: number;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceChargeAmount?: number;
  totalAmount: number;
  totalCogs: number;
  grossProfit: number;
  isInventoryPosted: boolean;
  saleItems: SaleLineDto[];
  payments: PaymentLineDto[];
}

export interface SaleListItemDto {
  id: Guid;
  saleNo: string;
  soldAtUtc: string;
  status: number;
  paymentStatus: number;
  totalAmount: number;
  totalCogs: number;
  grossProfit: number;
  isInventoryPosted: boolean;
  itemCount: number;
}

export interface SaleListResponse {
  items: SaleListItemDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ImportExternalSalesResultDto {
  succeeded: boolean;
  error?: string | null;
  saleId?: Guid | null;
  saleNo?: string | null;
  importedLines: number;
  skippedLines: number;
  totalQuantity: number;
  totalAmount: number;
  warnings: string[];
}

export interface SessionReportDto {
  sessionId?: Guid;
  saleCount?: number;
  transactionCount?: number;
  grossSales?: number;
  netSales?: number;
  totalSales?: number;
  totalPayments?: number;
  cashSales?: number;
  cardSales?: number;
  openingFloat?: number;
  closingFloat?: number;
  expectedCash?: number;
  cashVariance?: number;
  [key: string]: unknown;
}

export interface BulkPostCogsResultDto {
  posted: number;
  skipped: number;
  failed: number;
  errors?: string[];
}

export const PAYMENT_METHODS = ["CASH", "CARD", "MOBILE", "TRANSFER", "OTHER"];

export const SALE_STATUS: Record<number, { label: string; tone: "gray" | "blue" | "green" | "red" | "amber" }> = {
  1: { label: "Draft", tone: "gray" },
  2: { label: "Confirmed", tone: "blue" },
  3: { label: "Posted", tone: "green" },
  4: { label: "Cancelled", tone: "red" },
  5: { label: "Reversed", tone: "amber" },
};

export const PAYMENT_STATUS: Record<number, { label: string; tone: "gray" | "blue" | "green" | "red" | "amber" }> = {
  1: { label: "Unpaid", tone: "gray" },
  2: { label: "Partial", tone: "amber" },
  3: { label: "Paid", tone: "green" },
  4: { label: "Cancelled", tone: "red" },
  5: { label: "Refunded", tone: "blue" },
};
