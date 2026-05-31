// ─── Sales Domain Types ───────────────────────────────────────────────────────

// ── Enums ─────────────────────────────────────────────────────────────────────

export const SALE_STATUS: Record<number, { label: string; color: string }> = {
  1: { label: "Draft",     color: "#f59e0b" },
  2: { label: "Confirmed", color: "#10b981" },
  3: { label: "Cancelled", color: "#ef4444" },
};

export const PAYMENT_STATUS: Record<number, { label: string; color: string }> = {
  0: { label: "Unpaid",         color: "#ef4444" },
  1: { label: "Partial",        color: "#f59e0b" },
  2: { label: "Paid",           color: "#10b981" },
  3: { label: "Overpaid",       color: "#6366f1" },
  4: { label: "Refunded",       color: "#6b7280" },
};

export const PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER", "MOBILE", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// ── DTOs (API response shapes) ────────────────────────────────────────────────

export interface SaleLineDto {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  lineCogs: number;
}

export interface PaymentDto {
  id: string;
  method: string;
  amount: number;
  referenceCode?: string;
  paidAt: string;
}

export interface SaleDto {
  id: string;
  saleNo: string;
  companyId: string;
  branchId: string;
  locationId: string;
  soldAtUtc: string;
  status: number;
  paymentStatus: number;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  totalCogs: number;
  grossProfit: number;
  isInventoryPosted: boolean;
  saleItems: SaleLineDto[];
  payments: PaymentDto[];
}

export interface SaleListItemDto {
  id: string;
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

// ── Request shapes ────────────────────────────────────────────────────────────

export interface CreateSaleLineRequest {
  menuItemId: string;
  quantity: number;
  unitPrice?: number;
}

export interface CreatePaymentRequest {
  method: string;
  amount: number;
  referenceCode?: string;
}

export interface CreateSaleRequest {
  companyId: string;
  branchId: string;
  locationId: string;
  lines: CreateSaleLineRequest[];
  discountAmount?: number;
  taxAmount?: number;
  payment?: CreatePaymentRequest | null;
}

export interface SaleListParams {
  page?: number;
  pageSize?: number;
  status?: number;
  fromDate?: string;
  toDate?: string;
  q?: string;
}

export interface BulkPostCogsResult {
  posted: number;
  skipped: number;
  failed: number;
}

export interface ImportResult {
  imported: number;
  failed: number;
  errors: string[];
}

// ── POS types ─────────────────────────────────────────────────────────────────

export interface MenuCategoryDto {
  id: string;
  name: string;
  code?: string;
  itemCount: number;
}

export interface MenuItemPosDto {
  id: string;
  name: string;
  code?: string;
  sellingPrice: number;
  cost: number;
  categoryName: string;
}

export interface PosSessionDto {
  id: string;
  cashierName: string;
  terminal: string;
  openingFloat: number;
  closingFloat: number;
  openedAtUtc: string;
  closedAtUtc?: string;
  status: number; // 1 = Open, 2 = Closed
  isZReported: boolean;
  locationId?: string;
}

export interface PaymentBreakdown {
  method: string;
  total: number;
  count: number;
}

export interface SessionReportDto {
  sessionId: string;
  terminal: string;
  cashierName: string;
  openedAtUtc: string;
  closedAtUtc?: string;
  openingFloat: number;
  closingFloat: number;
  isZReported: boolean;
  totalSales: number;
  grossSales: number;
  totalCogs: number;
  grossProfit: number;
  totalDiscount: number;
  totalTax: number;
  paymentBreakdown: PaymentBreakdown[];
}

// ── POS cart types ────────────────────────────────────────────────────────────

export interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
}

export interface SplitPayment {
  method: string;
  amount: string;
}

// ── Back-office sale form types ───────────────────────────────────────────────

export interface SaleLineRow {
  _uid: string;
  menuItemId: string;
  menuItemName: string;
  quantity: string;
  unitPrice: string;
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export interface LocationLite {
  id: string;
  name: string;
  isActive?: boolean;
}

export interface MenuItemLite {
  id: string;
  name: string;
  sellingPrice?: number;
  cost?: number;
}