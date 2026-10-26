import { http } from "../../../api/http";

/**
 * Purchase workflow: a requisition and every document raised from it (purchase orders, goods
 * receipts, supplier invoices) as one case moving through request → approval → purchase order →
 * goods receipt → completed. The server decides which actions the signed-in user may take.
 */

export type WorkflowStage = "request" | "approval" | "ordering" | "receiving" | "completed" | "stopped";
export type CaseKind = "requisition" | "order";

export const WORKFLOW_STAGES: WorkflowStage[] = ["request", "approval", "ordering", "receiving", "completed"];

export type WorkflowStageCount = { key: WorkflowStage; label: string; count: number; actionCount: number };

export type ProcurementCaseSummary = {
  kind: CaseKind;
  id: string;
  reference: string;
  title: string;
  stage: WorkflowStage;
  status: string;
  branchId?: string | null;
  branchName?: string | null;
  requesterName?: string | null;
  supplierName?: string | null;
  amount: number;
  currencyCode?: string | null;
  priority: string;
  requiredByUtc?: string | null;
  overdue: boolean;
  sinceUtc: string;
  orderedPercent: number;
  receivedPercent: number;
  orderCount: number;
  receiptCount: number;
  nextStep: string;
  waitingOn?: string | null;
  myAction: boolean;
  raisedByMe: boolean;
};

export type ProcurementWorkflowBoard = {
  generatedAtUtc: string;
  stages: WorkflowStageCount[];
  cases: ProcurementCaseSummary[];
  totalCount: number;
  truncated: boolean;
};

export type WorkflowStep = {
  key: WorkflowStage;
  label: string;
  state: "done" | "current" | "upcoming" | "stopped";
  atUtc?: string | null;
  detail?: string | null;
};

export type CaseLine = {
  lineNo: number;
  itemName: string;
  uomName: string;
  requested: number;
  approved: number;
  ordered: number;
  received: number;
  outstandingToOrder: number;
  outstandingToReceive: number;
  unitPrice: number;
};

export type CaseOrder = {
  id: string;
  poNo: string;
  revision: number;
  status: string;
  supplierName: string;
  grandTotal: number;
  currencyCode: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  receivedPercent: number;
  version: string;
};

export type CaseReceipt = {
  id: string;
  grnNo: string;
  status: string;
  receivedAtUtc: string;
  purchaseOrderId?: string | null;
  poNo?: string | null;
  locationName?: string | null;
  lineCount: number;
  value: number;
};

export type CaseInvoice = {
  id: string;
  internalNo: string;
  supplierInvoiceNo: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  purchaseOrderId?: string | null;
};

export type CaseEvent = { atUtc: string; title: string; actor?: string | null; detail?: string | null; document: string };

export type CaseAction = {
  key: string;
  label: string;
  tone: "primary" | "secondary" | "danger";
  targetKind: CaseKind;
  targetId: string;
  targetReference?: string | null;
  version?: string | null;
  commentRequired: boolean;
  commentLabel?: string | null;
  confirm?: string | null;
  needsSupplier: boolean;
  /** Opens an existing editor instead of running a command. Company-relative path. */
  link?: string | null;
};

export type CaseRequisition = {
  id: string;
  requisitionNo: string;
  status: string;
  category: string;
  justification: string;
  requesterName?: string | null;
  requestDateUtc: string;
  requiredByUtc: string;
  deliveryLocationName?: string | null;
  suggestedSupplierName?: string | null;
  estimatedTotal: number;
  approvalMode: "route" | "standard";
  approvalStage?: string | null;
  approvers: string[];
  approvalDueUtc?: string | null;
  version: string;
};

export type ProcurementCase = {
  summary: ProcurementCaseSummary;
  steps: WorkflowStep[];
  requisition?: CaseRequisition | null;
  lines: CaseLine[];
  orders: CaseOrder[];
  receipts: CaseReceipt[];
  invoices: CaseInvoice[];
  timeline: CaseEvent[];
  actions: CaseAction[];
  committedTotal: number;
  receivedValue: number;
  invoicedTotal: number;
};

export type WorkflowActionResult = {
  message: string;
  caseKind: CaseKind;
  caseId: string;
  receiptId?: string | null;
  orderIds?: string[] | null;
};

export type WorkflowBoardFilter = { stage?: string; search?: string; branchId?: string; mine?: boolean };

const base = (companyId: string) => `/companies/${companyId}/procurement/workflow`;

export const procurementWorkflowApi = {
  async board(companyId: string, filter: WorkflowBoardFilter, signal?: AbortSignal): Promise<ProcurementWorkflowBoard> {
    const params: Record<string, string | boolean> = {};
    if (filter.stage) params.stage = filter.stage;
    if (filter.search?.trim()) params.search = filter.search.trim();
    if (filter.branchId) params.branchId = filter.branchId;
    if (filter.mine) params.mine = true;
    return (await http.get<ProcurementWorkflowBoard>(base(companyId), { params, signal })).data;
  },
  async get(companyId: string, kind: string, id: string, signal?: AbortSignal): Promise<ProcurementCase> {
    return (await http.get<ProcurementCase>(`${base(companyId)}/${kind}/${id}`, { signal })).data;
  },
  async resolve(companyId: string, documentKind: "requisition" | "order" | "grn", id: string): Promise<{ kind: CaseKind; id: string }> {
    return (await http.get<{ kind: CaseKind; id: string }>(`${base(companyId)}/resolve/${documentKind}/${id}`)).data;
  },
  async act(
    companyId: string,
    action: CaseAction,
    options: { comment?: string; supplierId?: string; receivingBranchId?: string } = {},
  ): Promise<WorkflowActionResult> {
    return (
      await http.post<WorkflowActionResult>(`${base(companyId)}/actions`, {
        targetKind: action.targetKind,
        targetId: action.targetId,
        action: action.key,
        version: action.version ?? null,
        comment: options.comment?.trim() || null,
        supplierId: options.supplierId || null,
        receivingBranchId: options.receivingBranchId || null,
      })
    ).data;
  },
};
