import { http } from "../../../api/http";

const root = (c: string) => `/companies/${c}/procurement/payables`;

export type PendingPayment = {
  paymentId: string; invoiceId: string; invoiceVersion: string; internalNo: string; supplierInvoiceNo: string; supplier: string;
  supplierBankStatus: string; amount: number; currencyCode: string; exchangeRate: number; paidOn: string; method?: string | null;
  reference?: string | null; paymentRunId?: string | null; recordedBy?: string | null; recordedAtUtc: string; canDecide: boolean;
};
export type PaymentCandidate = {
  invoiceId: string; version: string; internalNo: string; supplierInvoiceNo: string; supplierId: string; supplier: string;
  supplierBankStatus: string; dueDate: string; currencyCode: string; exchangeRate: number; outstandingAmount: number;
  pendingPaymentAmount: number; availableToPay: number;
};
export type PaymentRun = {
  id: string; runNo: string; paymentDate: string; method?: string | null; reference?: string | null; status: string; paymentCount: number;
  totalBaseAmount: number; version: string; preparedBy?: string | null; preparedAtUtc: string; decidedBy?: string | null;
  decidedAtUtc?: string | null; decisionNote?: string | null; canDecide: boolean;
};
export type SupplierAdvance = {
  id: string; advanceNo: string; supplierId: string; supplier?: string | null; branchId?: string | null; purchaseOrderId?: string | null;
  amount: number; appliedAmount: number; unapplied: number; currencyCode: string; exchangeRate: number; paidOn: string;
  method?: string | null; reference?: string | null; reason: string; status: string; version: string; recordedBy?: string | null;
  recordedAtUtc: string; approvedAtUtc?: string | null; reversalReason?: string | null; canDecide: boolean;
};
export type SupplierCreditNote = {
  id: string; internalNo: string; supplierCreditNo: string; invoiceId: string; supplierId: string; supplier?: string | null; creditDate: string;
  category: string; netAmount: number; taxAmount: number; withholdingAmount: number; creditAmount: number; currencyCode: string;
  reason: string; status: string; version: string; preparedBy?: string | null; preparedAtUtc: string; approvedAtUtc?: string | null;
  reversalReason?: string | null; canDecide: boolean;
};
export type ApOpenItem = {
  invoiceId: string; internalNo: string; supplierInvoiceNo: string; supplierId: string; supplier: string; invoiceDate: string; dueDate: string;
  currencyCode: string; exchangeRate: number; outstanding: number; outstandingBase: number; daysOverdue: number; bucket: string;
};
export type ApAgingSupplier = {
  supplierId: string; supplier: string; current: number; days1To30: number; days31To60: number; days61To90: number; over90: number;
  total: number; unappliedAdvances: number; invoices: number;
};
export type ApAgingReport = { asOf: string; currency: string; suppliers: ApAgingSupplier[]; items: ApOpenItem[]; total: number; unappliedAdvances: number };
export type StatementLine = { date: string; type: string; reference: string; description?: string | null; charges: number; credits: number; balance: number; baseAmount: number };
export type SupplierStatement = { supplierId: string; supplier: string; from: string; to: string; currencyCode: string; opening: number; lines: StatementLine[]; closing: number };
export type GrniLine = {
  purchaseOrderId: string; poNo: string; purchaseOrderLineId: string; item: string; supplier: string; receivedQty: number; returnedQty: number;
  invoicedQty: number; uninvoicedQty: number; unitCostBase: number; value: number; lastReceipt?: string | null;
};
export type GrniReport = { asOf: string; lines: GrniLine[]; total: number };
export type ReconciliationLine = { area: string; postingKey: string; subledger: number; ledger: number; difference: number; note: string };
export type ApReconciliation = { asOf: string; lines: ReconciliationLine[]; unpostedDocuments: number; currency: string };
export type FxRevaluationLine = { currency: string; rate: number; openAmount: number; bookedBase: number; revaluedBase: number; difference: number };
export type FxRevaluation = { id: string; asOf: string; netDifference: number; linesJson: string; createdAtUtc: string };

type Decision = { version: string; reason?: string | null };

async function download(url: string, params: Record<string, string | undefined>, fallbackName: string) {
  const r = await http.get<Blob>(url, { params: { ...params, format: "csv" }, responseType: "blob" });
  const disposition = String((r.headers as unknown as Record<string, unknown>)["content-disposition"] ?? "");
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = href; a.download = name; a.click();
  URL.revokeObjectURL(href);
}

export const payablesApi = {
  pendingPayments: async (c: string) => (await http.get<PendingPayment[]>(`${root(c)}/payments/pending`)).data,
  approvePayment: (c: string, invoiceId: string, paymentId: string, d: Decision) => http.post(`${root(c)}/invoices/${invoiceId}/payments/${paymentId}/approve`, d),
  rejectPayment: (c: string, invoiceId: string, paymentId: string, d: Decision) => http.post(`${root(c)}/invoices/${invoiceId}/payments/${paymentId}/reject`, d),
  reversePayment: (c: string, invoiceId: string, paymentId: string, d: Decision) => http.post(`${root(c)}/invoices/${invoiceId}/payments/${paymentId}/reverse`, d),

  proposal: async (c: string, dueBy: string, supplierId?: string) =>
    (await http.get<PaymentCandidate[]>(`${root(c)}/payment-proposal`, { params: { dueBy, supplierId } })).data,
  runs: async (c: string) => (await http.get<PaymentRun[]>(`${root(c)}/payment-runs`)).data,
  createRun: async (c: string, body: { paymentDate: string; method?: string | null; reference?: string | null; items: { invoiceId: string; version: string; amount: number; exchangeRate: number }[] }) =>
    (await http.post<{ id: string }>(`${root(c)}/payment-runs`, body)).data,
  decideRun: (c: string, id: string, body: { version: string; approve: boolean; note?: string | null }) => http.post(`${root(c)}/payment-runs/${id}/decision`, body),

  advances: async (c: string, supplierId?: string) => (await http.get<SupplierAdvance[]>(`${root(c)}/advances`, { params: { supplierId } })).data,
  recordAdvance: async (c: string, body: { branchId?: string | null; supplierId: string; purchaseOrderId?: string | null; amount: number; currencyCode?: string | null;
    exchangeRate: number; paidOn: string; method?: string | null; reference?: string | null; reason: string }) => (await http.post<{ id: string }>(`${root(c)}/advances`, body)).data,
  approveAdvance: (c: string, id: string, d: Decision) => http.post(`${root(c)}/advances/${id}/approve`, d),
  rejectAdvance: (c: string, id: string, d: Decision) => http.post(`${root(c)}/advances/${id}/reject`, d),
  reverseAdvance: (c: string, id: string, d: Decision) => http.post(`${root(c)}/advances/${id}/reverse`, d),
  applyAdvance: (c: string, id: string, body: { invoiceId: string; invoiceVersion: string; amount: number; appliedOn?: string | null }) => http.post(`${root(c)}/advances/${id}/apply`, body),

  creditNotes: async (c: string, invoiceId?: string) => (await http.get<SupplierCreditNote[]>(`${root(c)}/credit-notes`, { params: { invoiceId } })).data,
  prepareCreditNote: async (c: string, body: { invoiceId: string; supplierCreditNo: string; creditDate: string; category: string; netAmount: number; taxAmount: number;
    withholdingAmount: number; reason: string }) => (await http.post<{ id: string }>(`${root(c)}/credit-notes`, body)).data,
  approveCreditNote: (c: string, id: string, d: Decision) => http.post(`${root(c)}/credit-notes/${id}/approve`, d),
  rejectCreditNote: (c: string, id: string, d: Decision) => http.post(`${root(c)}/credit-notes/${id}/reject`, d),
  reverseCreditNote: (c: string, id: string, d: Decision) => http.post(`${root(c)}/credit-notes/${id}/reverse`, d),

  verifyBank: (c: string, supplierId: string, version: string) => http.post(`${root(c)}/suppliers/${supplierId}/verify-bank`, { version }),

  revaluations: async (c: string) => (await http.get<FxRevaluation[]>(`${root(c)}/revaluations`)).data,
  previewRevaluation: async (c: string, body: { asOf: string; rates: { currencyCode: string; rate: number }[] }) =>
    (await http.post<FxRevaluationLine[]>(`${root(c)}/revaluations/preview`, body)).data,
  revalue: async (c: string, body: { asOf: string; rates: { currencyCode: string; rate: number }[] }) => (await http.post<{ id: string }>(`${root(c)}/revaluations`, body)).data,

  aging: async (c: string, asOf: string, supplierId?: string) => (await http.get<ApAgingReport>(`${root(c)}/reports/aging`, { params: { asOf, supplierId } })).data,
  agingCsv: (c: string, asOf: string) => download(`${root(c)}/reports/aging`, { asOf }, `ap-aging-${asOf}.csv`),
  statement: async (c: string, supplierId: string, from: string, to: string) =>
    (await http.get<SupplierStatement>(`${root(c)}/reports/statement`, { params: { supplierId, from, to } })).data,
  statementCsv: (c: string, supplierId: string, from: string, to: string) => download(`${root(c)}/reports/statement`, { supplierId, from, to }, `supplier-statement-${from}-${to}.csv`),
  grni: async (c: string, asOf: string) => (await http.get<GrniReport>(`${root(c)}/reports/grni`, { params: { asOf } })).data,
  grniCsv: (c: string, asOf: string) => download(`${root(c)}/reports/grni`, { asOf }, `grni-${asOf}.csv`),
  reconciliation: async (c: string, asOf: string) => (await http.get<ApReconciliation>(`${root(c)}/reports/reconciliation`, { params: { asOf } })).data,
};
