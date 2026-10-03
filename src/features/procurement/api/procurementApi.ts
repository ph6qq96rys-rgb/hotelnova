import { http } from "../../../api/http";
import type { PurchaseOrder, RequisitionConversionInput } from "./purchasingApi";

export type PurchaseRequisitionLine = {
  id: string;
  lineNo: number;
  lineType: string;
  inventoryItemId?: string | null;
  itemName: string;
  uomId?: string | null;
  uomName: string;
  quantity: number;
  approvedQuantity: number;
  estimatedUnitPrice: number;
  estimatedLineTotal: number;
  specification?: string | null;
  availableStockNote?: string | null;
  approvedQuantityOverridden?: boolean;
  orderedQuantity?: number;
  receivedQuantity?: number;
  outstandingToOrder?: number;
  outstandingToFulfil?: number;
};

export type PurchaseRequisitionDecision = {
  id: string;
  decidedByUserId: string;
  decision: string;
  comment?: string | null;
  decidedAtUtc: string;
  decidedByName?: string | null;
};

export type PurchaseRequisition = {
  id: string;
  companyId: string;
  branchId?: string | null;
  branchName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  requestedByUserId: string;
  requestedByName?: string | null;
  requestedByEmployeeId?: string | null;
  requiredStockLocationId?: string | null;
  requiredStockLocationName?: string | null;
  deliveryLocationId?: string | null;
  deliveryLocationName?: string | null;
  suggestedSupplierId?: string | null;
  suggestedSupplierName?: string | null;
  requisitionNo: string;
  status: string;
  priority: string;
  purchaseCategory: string;
  businessJustification: string;
  costCenterCode?: string | null;
  relatedReference?: string | null;
  stockAvailabilityNote?: string | null;
  requestDateUtc: string;
  requiredByDateUtc: string;
  submittedAtUtc?: string | null;
  approvedAtUtc?: string | null;
  closedAtUtc?: string | null;
  version?: string | null;
  estimatedTotal: number;
  lineCount: number;
  lines: PurchaseRequisitionLine[];
  decisions: PurchaseRequisitionDecision[];
};

export type PurchaseRequisitionReorderSuggestion = {
  inventoryItemId: string;
  itemName: string;
  uomId: string;
  uomName: string;
  reorderLevelBaseQty: number;
  availableBaseQty: number;
  shortageBaseQty: number;
  suggestedPurchaseQty: number;
  estimatedUnitPrice: number;
  recommendation: string;
};

export type PurchaseRequisitionLineInput = {
  lineType: string;
  inventoryItemId?: string | null;
  itemName: string;
  uomId?: string | null;
  uomName: string;
  quantity: number;
  estimatedUnitPrice: number;
  specification?: string | null;
  availableStockNote?: string | null;
};

export type CreateReorderPurchaseRequisitionPayload = {
  branchId?: string | null;
  stockLocationId?: string | null;
  priority: string;
  purchaseCategory: string;
  businessJustification: string;
  requiredByDateUtc?: string | null;
  submit: boolean;
};

export type CreatePurchaseRequisitionPayload = {
  clientRequestId?: string;
  branchId?: string | null;
  departmentId?: string | null;
  requiredStockLocationId?: string | null;
  deliveryLocationId?: string | null;
  suggestedSupplierId?: string | null;
  priority: string;
  purchaseCategory: string;
  businessJustification: string;
  costCenterCode?: string | null;
  relatedReference?: string | null;
  stockAvailabilityNote?: string | null;
  requiredByDateUtc?: string | null;
  submit: boolean;
  lines: PurchaseRequisitionLineInput[];
};

export type CommandResult = {
  success: boolean;
  id?: string | null;
  no?: string | null;
  error?: string | null;
};

const root = (companyId: string) => `/companies/${companyId}/procurement/requisitions`;

export async function listPurchaseRequisitions(
  companyId: string,
  params: { status?: string; search?: string; branchId?: string | null } = {},
): Promise<PurchaseRequisition[]> {
  const response = await http.get<PurchaseRequisition[]>(root(companyId), { params });
  return response.data;
}

/** Paged list: the endpoint returns the page as an array and the totals in X-Total-Count / X-Page / X-Page-Size. */
export async function listPurchaseRequisitionsPaged(
  companyId: string,
  params: { status?: string; search?: string; branchId?: string | null; page?: number; pageSize?: number } = {},
): Promise<{ items: PurchaseRequisition[]; totalCount: number; page: number; pageSize: number }> {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const response = await http.get<PurchaseRequisition[]>(root(companyId), { params: clean });
  const header = (name: string) => Number(response.headers?.[name] ?? NaN);
  const items = response.data ?? [];
  return {
    items,
    totalCount: Number.isFinite(header("x-total-count")) ? header("x-total-count") : items.length,
    page: Number.isFinite(header("x-page")) ? header("x-page") : params.page ?? 1,
    pageSize: Number.isFinite(header("x-page-size")) ? header("x-page-size") : params.pageSize ?? items.length,
  };
}

export async function getPurchaseRequisition(
  companyId: string,
  id: string,
): Promise<PurchaseRequisition> {
  const response = await http.get<PurchaseRequisition>(`${root(companyId)}/${id}`);
  return response.data;
}

export async function listReorderSuggestions(
  companyId: string,
  params: { branchId?: string | null; stockLocationId?: string | null; pageSize?: number } = {},
): Promise<PurchaseRequisitionReorderSuggestion[]> {
  const response = await http.get<PurchaseRequisitionReorderSuggestion[]>(`${root(companyId)}/reorder-suggestions`, { params });
  return response.data;
}

export async function createReorderPurchaseRequisition(
  companyId: string,
  payload: CreateReorderPurchaseRequisitionPayload,
): Promise<CommandResult> {
  const response = await http.post<CommandResult>(`${root(companyId)}/from-reorder-level`, payload);
  return response.data;
}

export async function createPurchaseRequisition(
  companyId: string,
  payload: CreatePurchaseRequisitionPayload,
): Promise<CommandResult> {
  const response = await http.post<CommandResult>(root(companyId), payload);
  return response.data;
}

export async function submitPurchaseRequisition(
  companyId: string,
  id: string,
): Promise<CommandResult> {
  const response = await http.post<CommandResult>(`${root(companyId)}/${id}/submit`, {});
  return response.data;
}

export type PurchaseRequisitionLineAdjustment = { lineId: string; approvedQuantity: number };

export async function approvePurchaseRequisitionFnb(
  companyId: string,
  id: string,
  comment?: string,
  version?: string | null,
  lineAdjustments: PurchaseRequisitionLineAdjustment[] = [],
): Promise<CommandResult> {
  const response = await http.post<CommandResult>(`${root(companyId)}/${id}/fnb-approval`, { comment, version, lineAdjustments });
  return response.data;
}

export async function approvePurchaseRequisitionFinance(
  companyId: string,
  id: string,
  comment?: string,
  version?: string | null,
  lineAdjustments: PurchaseRequisitionLineAdjustment[] = [],
): Promise<CommandResult> {
  const response = await http.post<CommandResult>(`${root(companyId)}/${id}/finance-approval`, { comment, version, lineAdjustments });
  return response.data;
}

/** Reject / return / cancel only. Approvals use the dedicated F&B and Finance endpoints. */
export async function decidePurchaseRequisition(
  companyId: string,
  id: string,
  decision: "reject" | "return" | "cancel",
  comment?: string,
  version?: string | null,
): Promise<CommandResult> {
  const response = await http.post<CommandResult>(`${root(companyId)}/${id}/decision`, {
    decision,
    comment,
    version,
  });
  return response.data;
}

export type UpdatePurchaseRequisitionPayload = Omit<CreatePurchaseRequisitionPayload, "branchId"> & { version?: string | null };

export async function updatePurchaseRequisition(
  companyId: string,
  id: string,
  payload: UpdatePurchaseRequisitionPayload,
): Promise<CommandResult> {
  const response = await http.put<CommandResult>(`${root(companyId)}/${id}`, payload);
  return response.data;
}

export async function cancelPurchaseRequisition(
  companyId: string,
  id: string,
  reason?: string,
  version?: string | null,
): Promise<CommandResult> {
  const response = await http.post<CommandResult>(`${root(companyId)}/${id}/cancel`, { reason, version });
  return response.data;
}

export async function closePurchaseRequisition(
  companyId: string,
  id: string,
  reason: string,
  version?: string | null,
): Promise<CommandResult> {
  const response = await http.post<CommandResult>(`${root(companyId)}/${id}/close`, { reason, version });
  return response.data;
}

/** Creates one draft purchase order per supplier from the approved, not-yet-ordered quantities. */
export async function convertPurchaseRequisitionToPurchaseOrders(
  companyId: string,
  id: string,
  body: RequisitionConversionInput,
): Promise<PurchaseOrder[]> {
  const response = await http.post<PurchaseOrder[]>(`${root(companyId)}/${id}/convert-to-po`, body);
  return response.data;
}
