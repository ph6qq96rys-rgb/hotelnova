export type Guid = string;

export enum PosSessionStatus {
  Open = 1,
  Closed = 2,
}

export type PaymentMethod = "CASH" | "CARD" | "MOBILE" | "TRANSFER";

export interface PosSessionDto {
  id: Guid;
  companyId: Guid;
  branchId: Guid;
  cashierId?: Guid | null;
  cashierName?: string | null;
  terminal?: string | null;
  openingFloat: number;
  closingFloat?: number | null;
  openedAtUtc: string;
  closedAtUtc?: string | null;
  status: PosSessionStatus | "Open" | "Closed";
  isZReported: boolean;
  zReportedAtUtc?: string | null;
}

export interface OpenSessionRequest {
  cashierName: string;
  openingFloat: number;
  terminal?: string | null;
}

export interface CloseSessionRequest {
  closingFloat: number;
}

export interface PaymentBreakdownDto {
  method: string;
  count: number;
  total: number;
}

export interface SessionReportDto {
  sessionId: Guid;
  saleCount: number;
  transactionCount: number;
  grossSales: number;
  totalCogs: number;
  grossProfit: number;
  totalDiscount: number;
  totalTax: number;
  netSales: number;
  totalSales: number;
  totalPayments: number;
  cashSales: number;
  cardSales: number;
  openingFloat: number;
  closingFloat?: number | null;
  expectedCash: number;
  cashVariance?: number | null;
  paymentBreakdown: PaymentBreakdownDto[];
}

export interface MenuItemDto {
  id: Guid;
  name: string;
  code?: string | null;
  externalCode?: string | null;
  categoryName?: string | null;
  subCategoryName?: string | null;
  itemType?: number | null;
  cost: number;
  sellingPrice: number;
  isActive: boolean;
  isAvailableForSale: boolean;
  hasRecipe: boolean;
  hasConsumptionLocation: boolean;
  consumptionLocationName?: string | null;
  unitsSold: number;
}

export interface SaleLineRequest {
  menuItemId: Guid;
  quantity: number;
  unitPrice: number;
}

export interface SalePaymentRequest {
  method: PaymentMethod;
  amount: number;
  referenceCode?: string | null;
}

export interface CreateSaleRequest {
  companyId: Guid;
  branchId: Guid;
  discountAmount: number;
  taxAmount: number;
  serviceChargeAmount: number;
  lines: SaleLineRequest[];
  payment?: SalePaymentRequest | null;
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
  saleNo?: string;
  companyId: Guid;
  branchId: Guid;
  posSessionId?: Guid | null;
  soldAtUtc?: string;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceChargeAmount: number;
  totalAmount: number;
  totalCogs: number;
  grossProfit?: number;
  isInventoryPosted: boolean;
  saleItems?: SaleLineDto[];
  payments?: PaymentLineDto[];
}

export interface BulkPostCogsResultDto {
  posted: number;
  skipped: number;
  failed: number;
  errors?: string[];
  warnings?: string[];
}

export interface CartItem {
  id: Guid;
  name: string;
  categoryName?: string | null;
  price: number;
  qty: number;
  lineTotal: number;
  hasRecipe?: boolean;
  hasConsumptionLocation?: boolean;
  isAvailableForSale?: boolean;
  code?: string | null;
}
export interface SaleInventoryConsumptionDto {
  id: Guid;

  saleId: Guid;
  saleNo: string;

  saleItemId: Guid;
  menuItemId: Guid;
  menuItemName: string;

  inventoryItemId: Guid;
  inventoryItemName: string;

  stockLocationId: Guid;
  stockLocationName: string;

  baseUomId: Guid;
  baseUomName: string;

  quantityBase: number;
  unitCost: number;
  totalCost: number;

  batchNo?: string | null;
  expiryDate?: string | null;

  postedAtUtc: string;
}