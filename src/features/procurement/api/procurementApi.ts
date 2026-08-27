import { http } from "../../../api/http";

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
};

export type PurchaseRequisitionDecision = {
  id: string;
  decidedByUserId: string;
  decision: string;
  comment?: string | null;
  decidedAtUtc: string;
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

export async function approvePurchaseRequisitionFnb(
  companyId: string,
  id: string,
  comment?: string,
): Promise<CommandResult> {
  const response = await http.post<CommandResult>(`${root(companyId)}/${id}/fnb-approval`, { comment });
  return response.data;
}

export async function approvePurchaseRequisitionFinance(
  companyId: string,
  id: string,
  comment?: string,
): Promise<CommandResult> {
  const response = await http.post<CommandResult>(`${root(companyId)}/${id}/finance-approval`, { comment });
  return response.data;
}

export async function decidePurchaseRequisition(
  companyId: string,
  id: string,
  decision: "approve" | "reject" | "return" | "cancel",
  comment?: string,
): Promise<CommandResult> {
  const response = await http.post<CommandResult>(`${root(companyId)}/${id}/decision`, {
    decision,
    comment,
  });
  return response.data;
}
