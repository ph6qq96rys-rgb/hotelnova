import { http } from "../../../api/http";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "costOfSales" | "expense";
export type JournalType = "manual" | "automatic" | "reversal" | "adjustment" | "yearEndClose" | "openingBalance";
export type JournalStatus = "draft" | "posted" | "reversed";
export type OutboxStatus = "pending" | "processed" | "skipped" | "failed" | "deadLetter";
export type PeriodStatus = "open" | "closed";

export const ACCOUNT_TYPES: AccountType[] = ["asset", "liability", "equity", "revenue", "costOfSales", "expense"];
export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  asset: "Asset", liability: "Liability", equity: "Equity", revenue: "Revenue", costOfSales: "Cost of sales", expense: "Expense",
};
export const JOURNAL_TYPE_LABEL: Record<JournalType, string> = {
  manual: "Manual", automatic: "Automatic", reversal: "Reversal", adjustment: "Adjustment", yearEndClose: "Year-end close", openingBalance: "Opening balance" };
export const SOURCE_LABEL: Record<string, string> = {
  GRN: "Goods receipt",
  SupplierInvoice: "Supplier invoice",
  SupplierPayment: "Supplier payment",
  PosSession: "POS drawer",
};
export const MODULE_LABEL: Record<string, string> = { Inventory: "Inventory", AP: "Accounts payable", POS: "POS", GL: "General ledger" };
export const ACTION_LABEL: Record<string, string> = {
  Receive: "received", Reverse: "reversed", Approve: "approved", Cancel: "cancelled", Pay: "paid", Settle: "closed",
};
export const STATUS_LABEL: Record<JournalStatus, string> = { draft: "Draft", posted: "Posted", reversed: "Reversed" };

export type GlAccount = {
  id: string; code: string; name: string; type: AccountType; parentId?: string | null; isHeader: boolean; isActive: boolean;
  allowManualPosting: boolean; requiresCostCenter: boolean; description?: string | null; hasPostings: boolean;
  accountCategory?: string | null; normalBalance: "Debit" | "Credit"; isPostingAccount: boolean;
};
export type GlAccountInput = Omit<GlAccount, "id" | "hasPostings" | "normalBalance" | "isPostingAccount">;
export type CostCenter = { id: string; code: string; name: string; branchId?: string | null; isActive: boolean };
export type Period = {
  id: string; fiscalYearId: string; periodNo: number; name: string; startDate: string; endDate: string; status: PeriodStatus;
  closedAtUtc?: string | null; version: string; draftJournals: number; postingExceptions: number;
};
export type FiscalYear = { id: string; name: string; startDate: string; endDate: string; periods: Period[]; status?: PeriodStatus; closedAtUtc?: string | null; closingJournalId?: string | null; version?: string | null };
export type PeriodEvent = { action: string; reason?: string | null; userId: string; userName?: string | null; atUtc: string };
export type RuleVersion = { branchId?: string | null; accountId: string; version: number; effectiveFrom: string; effectiveTo?: string | null };
export type PostingRule = {
  key: string; group: string; label: string; help: string; expectedType: AccountType; accountId?: string | null;
  version?: number | null; effectiveFrom?: string | null;
  branchOverrides: { branchId: string; accountId: string; version: number; effectiveFrom: string }[];
  history: RuleVersion[];
};
export type FinanceSettings = { autoPostingStartDate?: string | null; autoPostingEnabled: boolean; requireIndependentPosting: boolean; roundingTolerance: number };
export type JournalListItem = {
  id: string; entryNo?: string | null; entryDate: string; type: JournalType; status: JournalStatus; description: string; reference?: string | null;
  sourceType?: string | null; sourceId?: string | null; sourceNo?: string | null; totalDebit: number; branchId?: string | null; isReversed: boolean;
  reversesEntryId?: string | null;
};
export type JournalLine = {
  lineNo: number; accountId: string; accountCode: string; accountName: string; debit: number; credit: number; branchId?: string | null;
  costCenterId?: string | null; departmentId?: string | null; projectCode?: string | null; description?: string | null;
  transactionAmount?: number | null; referenceType?: string | null; referenceId?: string | null;
};
export type JournalDetail = Omit<JournalListItem, "isReversed"> & {
  periodName?: string | null; sourceKey?: string | null; totalCredit: number; reversesEntryNo?: string | null; reversedByEntryId?: string | null;
  reversedByEntryNo?: string | null; reversalReason?: string | null; createdBy?: string | null; createdByName?: string | null; createdAt: string;
  postedBy?: string | null; postedByName?: string | null; postedAtUtc?: string | null; version: string; lines: JournalLine[];
  sourceModule?: string | null; currencyCode: string; exchangeRate: number; postingRuleVersion?: number | null;
};
export type JournalLineInput = {
  accountId: string; debit: number; credit: number; branchId?: string | null; costCenterId?: string | null; projectCode?: string | null; description?: string | null;
};
export type JournalDraftInput = {
  entryDate: string; branchId?: string | null; description: string; reference?: string | null; type: "manual" | "adjustment" | "openingBalance";
  lines: JournalLineInput[]; version?: string | null;
};
export type TrialBalanceRow = {
  accountId: string; code: string; name: string; type: AccountType; openingBalance: number; debit: number; credit: number; closingBalance: number;
};
export type TrialBalance = {
  from: string; to: string; branchId?: string | null; rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; closingDebit: number; closingCredit: number;
};
export type LedgerLine = {
  entryId: string; entryNo?: string | null; entryDate: string; description: string; sourceType?: string | null; sourceNo?: string | null;
  debit: number; credit: number; balance: number; branchId?: string | null; lineDescription?: string | null;
};
export type AccountLedger = {
  totalLines: number; page: number; pageSize: number;
  accountId: string; code: string; name: string; type: AccountType; from: string; to: string; openingBalance: number; closingBalance: number; lines: LedgerLine[];
};
export type PostingException = {
  id: string; sourceModule: string; documentType: string; documentId: string; action: string; documentNo?: string | null; documentDate?: string | null;
  status: OutboxStatus; lastError?: string | null; attempts: number; occurredAtUtc: string; nextAttemptAtUtc: string; origin: string;
};
export type AutoPostingResult = { detected: number; posted: number; skipped: number; failed: number; waiting: number };
export type ReconciliationRow = { sourceModule: string; documentType: string; posted: number; waiting: number; failed: number; deadLetter: number; skipped: number };
export type AuditEntry = { id: string; entityType: string; entityId: string; action: string; detailJson?: string | null; userId?: string | null; userName?: string | null; atUtc: string };
export type Branch = { id: string; name: string; code?: string | null };

const base = (companyId: string) => `/companies/${companyId}/finance`;

export const financeApi = {
  accounts: (c: string) => http.get<GlAccount[]>(`${base(c)}/accounts`).then((r) => r.data),
  saveAccount: (c: string, id: string | null, input: GlAccountInput) =>
    (id ? http.put(`${base(c)}/accounts/${id}`, input) : http.post(`${base(c)}/accounts`, input)).then((r) => r.data),
  deleteAccount: (c: string, id: string) => http.delete(`${base(c)}/accounts/${id}`),
  applyTemplate: (c: string) => http.post<{ created: number }>(`${base(c)}/accounts/standard-template`).then((r) => r.data),
  costCenters: (c: string) => http.get<CostCenter[]>(`${base(c)}/cost-centers`).then((r) => r.data),
  saveCostCenter: (c: string, id: string | null, input: Omit<CostCenter, "id">) =>
    (id ? http.put(`${base(c)}/cost-centers/${id}`, input) : http.post(`${base(c)}/cost-centers`, input)).then((r) => r.data),
  fiscalYears: (c: string) => http.get<FiscalYear[]>(`${base(c)}/fiscal-years`).then((r) => r.data),
  createFiscalYear: (c: string, name: string, startDate: string) => http.post(`${base(c)}/fiscal-years`, { name, startDate }),
  closePeriod: (c: string, id: string, version: string, reason?: string) => http.post(`${base(c)}/periods/${id}/close`, { reason, version }),
  reopenPeriod: (c: string, id: string, version: string, reason: string) => http.post(`${base(c)}/periods/${id}/reopen`, { reason, version }),
  closeFiscalYear: (c: string, id: string, version?: string | null, reason?: string) => http.post(`${base(c)}/fiscal-years/${id}/close`, { reason, version }),
  reopenFiscalYear: (c: string, id: string, version: string | null | undefined, reason: string) => http.post(`${base(c)}/fiscal-years/${id}/reopen`, { reason, version }),
  periodEvents: (c: string, id: string) => http.get<PeriodEvent[]>(`${base(c)}/periods/${id}/events`).then((r) => r.data),
  postingRules: (c: string) => http.get<PostingRule[]>(`${base(c)}/posting-rules`).then((r) => r.data),
  savePostingRule: (c: string, key: string, branchId: string | null, accountId: string | null, effectiveFrom?: string | null) =>
    http.put(`${base(c)}/posting-rules`, { key, branchId, accountId, effectiveFrom: effectiveFrom || null }),
  settings: (c: string) => http.get<FinanceSettings>(`${base(c)}/settings`).then((r) => r.data),
  saveSettings: (c: string, s: FinanceSettings) => http.put(`${base(c)}/settings`, s),
  journals: (c: string, q: Record<string, string | number | undefined>) =>
    http.get<{ total: number; items: JournalListItem[] }>(`${base(c)}/journals`, { params: q }).then((r) => r.data),
  journal: (c: string, id: string) => http.get<JournalDetail>(`${base(c)}/journals/${id}`).then((r) => r.data),
  saveJournal: (c: string, id: string | null, input: JournalDraftInput) =>
    (id ? http.put<JournalDetail>(`${base(c)}/journals/${id}`, input) : http.post<JournalDetail>(`${base(c)}/journals`, input)).then((r) => r.data),
  deleteJournal: (c: string, id: string) => http.delete(`${base(c)}/journals/${id}`),
  postJournal: (c: string, id: string, version: string) => http.post<JournalDetail>(`${base(c)}/journals/${id}/post`, { version }).then((r) => r.data),
  reverseJournal: (c: string, id: string, reason: string, date?: string | null) =>
    http.post<JournalDetail>(`${base(c)}/journals/${id}/reverse`, { reason, date: date || null }).then((r) => r.data),
  runAutoPosting: (c: string) => http.post<AutoPostingResult>(`${base(c)}/auto-posting/run`).then((r) => r.data),
  postingExceptions: (c: string) => http.get<PostingException[]>(`${base(c)}/posting-exceptions`).then((r) => r.data),
  retryPosting: (c: string, id: string) => http.post<PostingException>(`${base(c)}/posting-exceptions/${id}/retry`).then((r) => r.data),
  reconciliation: (c: string) => http.get<ReconciliationRow[]>(`${base(c)}/reconciliation`).then((r) => r.data),
  auditLog: (c: string, page = 1, entityType?: string) =>
    http.get<{ total: number; items: AuditEntry[] }>(`${base(c)}/audit-log`, { params: { page, pageSize: 50, entityType: entityType || undefined } }).then((r) => r.data),
  trialBalance: (c: string, from: string, to: string, branchId?: string) =>
    http.get<TrialBalance>(`${base(c)}/reports/trial-balance`, { params: { from, to, branchId: branchId || undefined } }).then((r) => r.data),
  accountLedger: (c: string, accountId: string, from: string, to: string, branchId?: string, page = 1, exportAll = false) =>
    http.get<AccountLedger>(`${base(c)}/reports/account-ledger/${accountId}`, { params: { from, to, branchId: branchId || undefined, page, pageSize: 200, exportAll } }).then((r) => r.data),
  branches: (c: string) => http.get<Branch[]>(`/companies/${c}/branches`).then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => [] as Branch[]),
};
