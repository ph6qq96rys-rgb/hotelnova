import { http } from "../../../api/http";

/**
 * Procure-to-pay API client (suppliers, purchase orders, supplier invoices, purchase returns,
 * settings and reports). Contract: RestaurantFNB docs/procure-to-pay-api.md.
 * Every state change on a document sends the document's `version`; a 409 means it was changed
 * by someone else and must be reloaded.
 */

export type PagedResult<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages?: number;
};

const base = (companyId: string) => `/companies/${companyId}/procurement`;

function clean<T extends Record<string, unknown>>(params: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

// ── Suppliers ─────────────────────────────────────────────────────────────────

export const SUPPLIER_STATUSES = ["PendingReview", "Approved", "Suspended", "Inactive", "Active", "OnHold", "Blocked"] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export type SupplierInput = {
  code?: string | null;
  name: string;
  legalName?: string | null;
  category?: string | null;
  taxId?: string | null;
  vatRegistrationNo?: string | null;
  isVatRegistered: boolean;
  isWithholdingExempt: boolean;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  paymentTermDays: number;
  currencyCode?: string | null;
  leadTimeDays: number;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNo?: string | null;
  notes?: string | null;
};

export type Supplier = Required<Omit<SupplierInput, "code">> & {
  id: string;
  companyId: string;
  code: string;
  status: SupplierStatus | string;
  statusReason?: string | null;
  version: string;
  createdAt: string;
  updatedAt?: string | null;
};

export type SupplierLookup = {
  id: string;
  code: string;
  name: string;
  status: string;
  currencyCode: string;
  paymentTermDays: number;
};

export type SupplierItem = {
  id: string;
  supplierId: string;
  supplierName?: string | null;
  inventoryItemId: string;
  itemName?: string | null;
  uomId: string;
  uomName?: string | null;
  supplierItemCode?: string | null;
  agreedPrice: number;
  lastPrice: number;
  lastPurchaseAtUtc?: string | null;
  minOrderQty: number;
  leadTimeDays?: number | null;
  isPreferred: boolean;
  isActive: boolean;
};

export type SupplierItemInput = {
  supplierId: string;
  inventoryItemId: string;
  uomId: string;
  supplierItemCode?: string | null;
  agreedPrice: number;
  minOrderQty: number;
  leadTimeDays?: number | null;
  isPreferred: boolean;
  isActive: boolean;
};

export const suppliersApi = {
  async list(
    companyId: string,
    params: { search?: string; status?: string; category?: string; page?: number; pageSize?: number } = {},
  ): Promise<PagedResult<Supplier>> {
    const r = await http.get<PagedResult<Supplier>>(`${base(companyId)}/suppliers`, { params: clean(params) });
    return r.data;
  },
  async lookup(companyId: string, search?: string, includeOnHold = false): Promise<SupplierLookup[]> {
    const r = await http.get<SupplierLookup[]>(`${base(companyId)}/suppliers/lookup`, {
      params: clean({ search, includeOnHold }),
    });
    return r.data;
  },
  async get(companyId: string, id: string): Promise<Supplier> {
    const r = await http.get<Supplier>(`${base(companyId)}/suppliers/${id}`);
    return r.data;
  },
  async create(companyId: string, supplier: SupplierInput): Promise<Supplier> {
    const r = await http.post<Supplier>(`${base(companyId)}/suppliers`, supplier);
    return r.data;
  },
  async update(companyId: string, id: string, version: string, supplier: SupplierInput): Promise<Supplier> {
    const r = await http.put<Supplier>(`${base(companyId)}/suppliers/${id}`, { version, supplier });
    return r.data;
  },
  async changeStatus(companyId: string, id: string, version: string, status: string, reason?: string): Promise<Supplier> {
    const r = await http.post<Supplier>(`${base(companyId)}/suppliers/${id}/status`, { version, status, reason });
    return r.data;
  },
  async remove(companyId: string, id: string): Promise<void> {
    await http.delete(`${base(companyId)}/suppliers/${id}`);
  },
  async items(companyId: string, params: { supplierId?: string; inventoryItemId?: string }): Promise<SupplierItem[]> {
    const r = await http.get<SupplierItem[]>(`${base(companyId)}/suppliers/items`, { params: clean(params) });
    return r.data;
  },
  async upsertItem(companyId: string, body: SupplierItemInput): Promise<SupplierItem> {
    const r = await http.put<SupplierItem>(`${base(companyId)}/suppliers/items`, body);
    return r.data;
  },
};

// ── Purchase orders ───────────────────────────────────────────────────────────

export const PO_STATUSES = [
  "Draft",
  "PendingApproval",
  "PendingFinanceApproval",
  "Approved",
  "Sent",
  "PartiallyReceived",
  "Received",
  "Closed",
  "Cancelled",
] as const;

export const PO_LINE_TYPES = ["InventoryItem", "NonInventoryGood", "Service", "Expense", "FixedAsset"] as const;

export type PurchaseOrderLine = {
  id: string;
  lineNo: number;
  lineType: string;
  inventoryItemId?: string | null;
  itemName: string;
  uomId?: string | null;
  uomName: string;
  orderedQty: number;
  toBaseFactor?:number|null;
  orderedBaseQty?:number|null;
  netBaseUnitPrice?:number|null;
  cancelledQty?:number;
  unitPrice: number;
  discountPercent: number;
  taxRatePercent: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  lineTotal: number;
  netUnitPrice: number;
  receivedQty: number;
  outstandingQty: number;
  invoicedQty: number;
  requisitionId?: string | null;
  requisitionLineId?: string | null;
  notes?: string | null;
};

export type PurchaseOrderEvent = {
  id: string;
  revision: number;
  action: string;
  fromStatus?: string | null;
  toStatus: string;
  userId?: string | null;
  userName?: string | null;
  comment?: string | null;
  atUtc: string;
};

export type PurchaseOrderLinkedDocument = {
  id: string;
  type: string;
  number: string;
  status: string;
  date: string;
  amount: number;
};

export type PurchaseOrder = {
  id: string;
  companyId: string;
  branchId?: string | null;
  branchName?: string | null;
  deliveryLocationId: string;
  deliveryLocationName?: string | null;
  supplierId: string;
  supplierCode?: string | null;
  supplierName?: string | null;
  poNo: string;
  revision: number;
  status: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  currencyCode: string;
  exchangeRate: number;
  paymentTermDays: number;
  supplierReference?: string | null;
  notes?: string | null;
  terms?: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  requiresFinanceApproval: boolean;
  preparedByUserId: string;
  preparedByName?: string | null;
  submittedAtUtc?: string | null;
  approvedAtUtc?: string | null;
  financeApprovedAtUtc?: string | null;
  sentAtUtc?: string | null;
  acknowledgedAtUtc?:string|null;
  acknowledgementReference?:string|null;
  closedAtUtc?: string | null;
  closeReason?: string | null;
  cancelledAtUtc?: string | null;
  cancelReason?: string | null;
  receivedPercent: number;
  lineCount: number;
  version: string;
  createdAt: string;
  lines: PurchaseOrderLine[];
  history: PurchaseOrderEvent[];
  linkedDocuments: PurchaseOrderLinkedDocument[];
  allowedActions: string[];
};

export type PurchaseOrderLineInput = {
  lineType: string;
  inventoryItemId?: string | null;
  itemName?: string | null;
  uomId?: string | null;
  quantity: number;
  unitPrice?: number | null;
  discountPercent: number;
  taxRatePercent?: number | null;
  requisitionLineId?: string | null;
  notes?: string | null;
};

export type PurchaseOrderInput = {
  supplierId: string;
  branchId?: string | null;
  deliveryLocationId: string;
  orderDate?: string | null;
  expectedDeliveryDate?: string | null;
  currencyCode?: string | null;
  exchangeRate: number;
  paymentTermDays?: number | null;
  supplierReference?: string | null;
  notes?: string | null;
  terms?: string | null;
  lines: PurchaseOrderLineInput[];
};

export type PurchaseOrderActionName =
  | "submit"
  | "approve"
  | "finance-approve"
  | "return"
  | "send"
  | "acknowledge"
  | "amend"
  | "cancel"
  | "close";

export type PurchaseOrderReceiptInput = {
  receivingLocationId?: string | null;
  receivedDate?: string | null;
  notes?: string | null;
  lines?: Array<{
    purchaseOrderLineId: string;
    quantity: number;
    batchNo?: string | null;
    expiryDate?: string | null;
    notes?: string | null;
  }>;
};

export type PurchaseOrderReceiptResult = { grnId: string; grnNo: string; status: string; lineCount: number };

export type RequisitionConversionInput = {
  defaultSupplierId?: string | null;
  deliveryLocationId?: string | null;
  expectedDeliveryDate?: string | null;
  lines?: Array<{
    requisitionLineId: string;
    supplierId?: string | null;
    quantity?: number | null;
    unitPrice?: number | null;
    taxRatePercent?: number | null;
  }>;
};

export const purchaseOrdersApi = {
  async list(
    companyId: string,
    params: {
      branchId?: string;
      supplierId?: string;
      status?: string;
      search?: string;
      from?: string;
      to?: string;
      openOnly?: boolean;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<PagedResult<PurchaseOrder>> {
    const r = await http.get<PagedResult<PurchaseOrder>>(`${base(companyId)}/purchase-orders`, { params: clean(params) });
    return r.data;
  },
  async get(companyId: string, id: string): Promise<PurchaseOrder> {
    const r = await http.get<PurchaseOrder>(`${base(companyId)}/purchase-orders/${id}`);
    return r.data;
  },
  async create(companyId: string, order: PurchaseOrderInput, submit = false): Promise<PurchaseOrder> {
    const r = await http.post<PurchaseOrder>(`${base(companyId)}/purchase-orders`, order, { params: { submit } });
    return r.data;
  },
  async update(companyId: string, id: string, version: string, order: PurchaseOrderInput): Promise<PurchaseOrder> {
    const r = await http.put<PurchaseOrder>(`${base(companyId)}/purchase-orders/${id}`, { version, order });
    return r.data;
  },
  async action(
    companyId: string,
    id: string,
    action: PurchaseOrderActionName,
    version: string,
    comment?: string,
  ): Promise<PurchaseOrder> {
    const r = await http.post<PurchaseOrder>(`${base(companyId)}/purchase-orders/${id}/${action}`, { version, comment });
    return r.data;
  },
  async receive(companyId: string, id: string, body: PurchaseOrderReceiptInput): Promise<PurchaseOrderReceiptResult> {
    const r = await http.post<PurchaseOrderReceiptResult>(`${base(companyId)}/purchase-orders/${id}/receipts`, body);
    return r.data;
  },
  async resync(companyId: string, id: string): Promise<PurchaseOrder> {
    const r = await http.post<PurchaseOrder>(`${base(companyId)}/purchase-orders/${id}/resync`, {});
    return r.data;
  },
};

// ── Supplier invoices ─────────────────────────────────────────────────────────

export const INVOICE_STATUSES = ["Draft", "Matched", "OnHold", "Approved", "Cancelled"] as const;
export const PAYMENT_STATUSES = ["Unpaid", "PartiallyPaid", "Paid"] as const;

export type SupplierInvoiceLine = {
  id: string;
  lineNo: number;
  purchaseOrderLineId?: string | null;
  inventoryItemId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRatePercent: number;
  netAmount: number;
  taxAmount: number;
  lineTotal: number;
  matchStatus: string;
  matchNote?: string | null;
  poOrderedQty?: number | null;
  poReceivedQty?: number | null;
  poNetUnitPrice?: number | null;
};

export type SupplierInvoicePayment = {
  id: string;
  amount: number;
  paidOn: string;
  method?: string | null;
  reference?: string | null;
  recordedByUserId: string;
  recordedAtUtc: string;
};

export type SupplierInvoice = {
  id: string;
  companyId: string;
  branchId?: string | null;
  supplierId: string;
  supplierName?: string | null;
  supplierTaxId?: string | null;
  purchaseOrderId?: string | null;
  poNo?: string | null;
  internalNo: string;
  supplierInvoiceNo: string;
  fiscalReference?: string | null;
  invoiceDate: string;
  dueDate: string;
  currencyCode: string;
  exchangeRate: number;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  withholdingAmount: number;
  payableAmount: number;
  paidAmount: number;
  creditedAmount: number;
  refundedAmount: number;
  supplierCreditBalance: number;
  outstandingAmount: number;
  status: string;
  paymentStatus: string;
  holdReason?: string | null;
  varianceOverridden: boolean;
  isOverdue: boolean;
  notes?: string | null;
  matchedAtUtc?: string | null;
  approvedAtUtc?: string | null;
  approvalComment?: string | null;
  cancelReason?: string | null;
  version: string;
  createdAt: string;
  lines: SupplierInvoiceLine[];
  payments: SupplierInvoicePayment[];
};

export type SupplierInvoiceLineInput = {
  purchaseOrderLineId?: string | null;
  inventoryItemId?: string | null;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  taxRatePercent?: number | null;
};

export type SupplierInvoiceInput = {
  supplierId: string;
  branchId?: string | null;
  purchaseOrderId?: string | null;
  supplierInvoiceNo: string;
  fiscalReference?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  currencyCode?: string | null;
  exchangeRate: number;
  notes?: string | null;
  prefillFromPurchaseOrder: boolean;
  lines: SupplierInvoiceLineInput[];
};

export const supplierInvoicesApi = {
  async list(
    companyId: string,
    params: {
      supplierId?: string;
      purchaseOrderId?: string;
      status?: string;
      paymentStatus?: string;
      overdueOnly?: boolean;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<PagedResult<SupplierInvoice>> {
    const r = await http.get<PagedResult<SupplierInvoice>>(`${base(companyId)}/supplier-invoices`, { params: clean(params) });
    return r.data;
  },
  async get(companyId: string, id: string): Promise<SupplierInvoice> {
    const r = await http.get<SupplierInvoice>(`${base(companyId)}/supplier-invoices/${id}`);
    return r.data;
  },
  async create(companyId: string, invoice: SupplierInvoiceInput, match = true): Promise<SupplierInvoice> {
    const r = await http.post<SupplierInvoice>(`${base(companyId)}/supplier-invoices`, invoice, { params: { match } });
    return r.data;
  },
  async update(companyId: string, id: string, version: string, invoice: SupplierInvoiceInput): Promise<SupplierInvoice> {
    const r = await http.put<SupplierInvoice>(`${base(companyId)}/supplier-invoices/${id}`, { version, invoice });
    return r.data;
  },
  async match(companyId: string, id: string, version: string): Promise<SupplierInvoice> {
    const r = await http.post<SupplierInvoice>(`${base(companyId)}/supplier-invoices/${id}/match`, { version });
    return r.data;
  },
  async approve(
    companyId: string,
    id: string,
    version: string,
    overrideVariance: boolean,
    comment?: string,
  ): Promise<SupplierInvoice> {
    const r = await http.post<SupplierInvoice>(`${base(companyId)}/supplier-invoices/${id}/approve`, {
      version,
      overrideVariance,
      comment,
    });
    return r.data;
  },
  async cancel(companyId: string, id: string, version: string, reason: string): Promise<SupplierInvoice> {
    const r = await http.post<SupplierInvoice>(`${base(companyId)}/supplier-invoices/${id}/cancel`, { version, reason });
    return r.data;
  },
  async recordPayment(
    companyId: string,
    id: string,
    body: { version: string; amount: number; paidOn: string; method?: string | null; reference?: string | null },
  ): Promise<SupplierInvoice> {
    const r = await http.post<SupplierInvoice>(`${base(companyId)}/supplier-invoices/${id}/payments`, body);
    return r.data;
  },
};

// ── Purchase returns ──────────────────────────────────────────────────────────

export type PurchaseReturnLine = {
  id: string;
  lineNo: number;
  grnLineId: string;
  purchaseOrderLineId?: string | null;
  itemId: string;
  itemName?: string | null;
  uomId: string;
  uomName?: string | null;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  notes?: string | null;
};

export type PurchaseReturn = {
  id: string;
  companyId: string;
  branchId: string;
  locationId: string;
  locationName?: string | null;
  supplierId: string;
  supplierName?: string | null;
  grnId: string;
  grnNo?: string | null;
  purchaseOrderId?: string | null;
  poNo?: string | null;
  returnNo: string;
  returnDate: string;
  reason: string;
  notes?: string | null;
  status: string;
  totalAmount: number;
  postedAtUtc?: string | null;
  version: string;
  createdAt: string;
  lines: PurchaseReturnLine[];
};

export type PurchaseReturnInput = {
  grnId: string;
  returnDate?: string | null;
  reason: string;
  notes?: string | null;
  lines: Array<{ grnLineId: string; quantity: number; notes?: string | null }>;
};

export const purchaseReturnsApi = {
  async list(
    companyId: string,
    params: { supplierId?: string; grnId?: string; purchaseOrderId?: string; status?: string; page?: number; pageSize?: number } = {},
  ): Promise<PagedResult<PurchaseReturn>> {
    const r = await http.get<PagedResult<PurchaseReturn>>(`${base(companyId)}/purchase-returns`, { params: clean(params) });
    return r.data;
  },
  async get(companyId: string, id: string): Promise<PurchaseReturn> {
    const r = await http.get<PurchaseReturn>(`${base(companyId)}/purchase-returns/${id}`);
    return r.data;
  },
  async create(companyId: string, body: PurchaseReturnInput): Promise<PurchaseReturn> {
    const r = await http.post<PurchaseReturn>(`${base(companyId)}/purchase-returns`, body);
    return r.data;
  },
  async post(companyId: string, id: string, version: string): Promise<PurchaseReturn> {
    const r = await http.post<PurchaseReturn>(`${base(companyId)}/purchase-returns/${id}/post`, { version });
    return r.data;
  },
  async cancel(companyId: string, id: string, version: string): Promise<PurchaseReturn> {
    const r = await http.post<PurchaseReturn>(`${base(companyId)}/purchase-returns/${id}/cancel`, { version });
    return r.data;
  },
};

// ── Settings & reports ────────────────────────────────────────────────────────

export type PurchasingSettings = {
  companyId: string;
  isDefault: boolean;
  poFinanceApprovalThreshold: number;
  requisitionFinanceApprovalThreshold: number;
  requireRequisitionForPo: boolean;
  receiptOverTolerancePercent: number;
  invoiceQtyTolerancePercent: number;
  invoicePriceTolerancePercent: number;
  defaultVatRatePercent: number;
  defaultCurrencyCode: string;
  withholdingEnabled: boolean;
  withholdingRatePercent: number;
  withholdingGoodsThreshold: number;
  version?: string | null;
  updatedAtUtc?: string | null;
};

export type PurchasingDashboard = {
  requisitionsPendingApproval: number;
  requisitionsReadyToOrder: number;
  ordersPendingApproval: number;
  ordersAwaitingDelivery: number;
  ordersOverdue: number;
  invoicesOnHold: number;
  invoicesAwaitingApproval: number;
  payablesDue7Days: number;
  payablesOverdue: number;
  openCommitmentValue: number;
};

export type OutstandingDelivery = {
  purchaseOrderId: string;
  poNo: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  daysOverdue: number;
  lineId: string;
  lineNo: number;
  itemName: string;
  uomName: string;
  orderedQty: number;
  receivedQty: number;
  outstandingQty: number;
  outstandingValue: number;
};

export type SupplierSpend = {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  orderCount: number;
  orderedValue: number;
  receivedValue: number;
  invoicedValue: number;
  paidValue: number;
  outstandingPayable: number;
  onTimeDeliveryPercent: number;
  fillRatePercent: number;
};

export const purchasingSetupApi = {
  async getSettings(companyId: string): Promise<PurchasingSettings> {
    const r = await http.get<PurchasingSettings>(`${base(companyId)}/settings`);
    return r.data;
  },
  async updateSettings(companyId: string, body: Omit<PurchasingSettings, "companyId" | "isDefault" | "updatedAtUtc">): Promise<PurchasingSettings> {
    const r = await http.put<PurchasingSettings>(`${base(companyId)}/settings`, body);
    return r.data;
  },
  async dashboard(companyId: string): Promise<PurchasingDashboard> {
    const r = await http.get<PurchasingDashboard>(`${base(companyId)}/reports/dashboard`);
    return r.data;
  },
  async outstandingDeliveries(companyId: string, params: { supplierId?: string; overdueOnly?: boolean } = {}): Promise<OutstandingDelivery[]> {
    const r = await http.get<OutstandingDelivery[]>(`${base(companyId)}/reports/outstanding-deliveries`, { params: clean(params) });
    return r.data;
  },
  async supplierSpend(companyId: string, from: string, to: string): Promise<SupplierSpend[]> {
    const r = await http.get<SupplierSpend[]>(`${base(companyId)}/reports/supplier-spend`, { params: { from, to } });
    return r.data;
  },
};
