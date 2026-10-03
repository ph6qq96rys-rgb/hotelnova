import { http } from "../../../api/http";

export type ButcheryBatchStatus = string | number;
export type ButcheryCutClassification = string | number;
export type ButcheryCostAllocationMethod = string | number;

export type ButcheryProcessingOutputDto = {
  id: string;
  meatCutTemplateLineId: string;
  outputItemId: string;
  outputItemName: string;
  lineNo: number;
  expectedYieldPercent: number;
  expectedWeightBase: number;
  actualWeightBase: number;
  classification: ButcheryCutClassification;
  costAllocationMethod: ButcheryCostAllocationMethod;
  wasteReason?: string | null;
  notes?: string | null;
};

export type ButcheryProcessingBatchDto = {
  id: string;
  companyId: string;
  branchId: string;
  butcheryOperationId: string;
  butcheryOperationName: string;
  meatCutTemplateId: string;
  meatCutTemplateName: string;
  batchNo: string;
  processingDateUtc: string;
  sourceBranchStockLocationId: string;
  sourceStockLocationId: string;
  sourceStockLocationName: string;
  sourceItemId: string;
  sourceItemName: string;
  fifoLotId: string;
  fifoLotBatchNo?: string | null;
  startingWeightBase: number;
  butcherEmployeeId?: string | null;
  butcherName?: string | null;
  supervisorEmployeeId?: string | null;
  supervisorName?: string | null;
  status: ButcheryBatchStatus;
  standardYieldPercent: number;
  actualYieldPercent: number;
  yieldVariancePercent: number;
  wastePercent: number;
  finishedCutsWeightBase: number;
  byProductWeightBase: number;
  wasteWeightBase: number;
  accountedWeightBase: number;
  approvedVarianceWeightBase: number;
  unaccountedVarianceWeightBase: number;
  toleranceWeightBase: number;
  isVarianceWithinTolerance: boolean;
  outputs: ButcheryProcessingOutputDto[];
};

export type UpdateButcheryActualOutputsDto = {
  outputs: Array<{
    meatCutTemplateLineId: string;
    actualWeightBase: number;
    wasteReason?: string | null;
    notes?: string | null;
  }>;
};

export type ApproveButcheryVarianceDto = {
  approvedVarianceWeightBase: number;
  reason: string;
};


export type ButcheryOperationDto = {
  id: string;
  companyId: string;
  branchId: string;
  code: string;
  name: string;
  isEnabled: boolean;
  yieldVarianceTolerancePercent: number;
  locations: Array<{
    id: string;
    branchStockLocationId: string;
    stockLocationId: string;
    stockLocationCode: string;
    stockLocationName: string;
    role: string | number;
    isActive: boolean;
  }>;
};

export type MeatCutTemplateDto = {
  id: string;
  companyId: string;
  sourceItemId: string;
  sourceItemName: string;
  sourceItemSku?: string | null;
  code: string;
  name: string;
  localName?: string | null;
  isActive: boolean;
  totalExpectedYieldPercent: number;
  lines: Array<{
    id: string;
    outputItemId: string;
    outputItemName: string;
    outputItemSku?: string | null;
    localName?: string | null;
    expectedYieldPercent: number;
    costAllocationMethod: string | number;
    classification: string | number;
    relativeValueWeight?: number | null;
    standardCostPerBaseUom?: number | null;
    sortOrder: number;
  }>;
};
export type CreateButcheryBatchFromGrnDto = {
  branchId?: string | null;
  grnLineId?: string | null;
  butcheryOperationId?: string | null;
  meatCutTemplateId?: string | null;
  processingDateUtc?: string | null;
  startingWeightBase?: number | null;
  butcherEmployeeId?: string | null;
  supervisorEmployeeId?: string | null;
  notes?: string | null;
};

export type ButcheryTraceSourceLotDto = {
  fifoLotId: string;
  itemId: string;
  itemName: string;
  locationId: string;
  locationName: string;
  batchNo?: string | null;
  supplierLotNo?: string | null;
  expiryDate?: string | null;
  qtyReceivedBase: number;
  qtyRemainingBase: number;
  unitCostBase: number;
  totalCost: number;
};

export type ButcheryBatchTraceDto = {
  batch: ButcheryProcessingBatchDto;
  sourceLot: ButcheryTraceSourceLotDto;
  ledgerBatchId?: string | null;
  reversalLedgerBatchId?: string | null;
  postedAtUtc?: string | null;
  hasReversal: boolean;
  outputs: Array<{
    outputId: string;
    outputItemId: string;
    outputItemName: string;
    classification: ButcheryCutClassification;
    actualWeightBase: number;
    producedFifoLotId?: string | null;
    producedBatchNo?: string | null;
    producedQtyRemainingBase?: number | null;
    ledgerLineId?: string | null;
  }>;
  ledgerLines: Array<{
    id: string;
    movementCode: string;
    direction: string;
    itemName: string;
    locationName: string;
    baseQuantity: number;
    signedBaseQuantity: number;
    unitCost: number;
    lineValue: number;
    signedLineValue: number;
    batchNo?: string | null;
    expiryDate?: string | null;
    postedAtUtc: string;
    isReversal: boolean;
    memo?: string | null;
  }>;
};

function companyPath(companyId: string) {
  return `/companies/${encodeURIComponent(companyId)}/butchery/batches`;
}

export const butcheryManagementApi = {
  async searchBatches(companyId:string, params:{branchId?:string|null;q?:string;page?:number;pageSize?:number;from?:string;to?:string},signal?:AbortSignal){const {data}=await http.get<{items:ButcheryProcessingBatchDto[];total:number;openCount:number}>(companyPath(companyId)+"/search",{params:{...params,branchId:params.branchId||undefined},signal});return data;},
  async listOperations(companyId: string, branchId?: string | null) {
    const { data } = await http.get<ButcheryOperationDto[]>(`/companies/${encodeURIComponent(companyId)}/butchery/operations`, { params: { branchId: branchId || undefined } });
    return data;
  },
  async listCutTemplates(companyId: string, activeOnly = true) {
    const { data } = await http.get<MeatCutTemplateDto[]>(`/companies/${encodeURIComponent(companyId)}/butchery/cut-templates`, { params: { activeOnly } });
    return data;
  },
  async listBatches(companyId: string, branchId?: string | null) {
    const { data } = await http.get<ButcheryProcessingBatchDto[]>(companyPath(companyId), { params: { branchId: branchId || undefined } });
    return data;
  },
  async getBatch(companyId: string, batchId: string) {
    const { data } = await http.get<ButcheryProcessingBatchDto>(`${companyPath(companyId)}/${encodeURIComponent(batchId)}`);
    return data;
  },
  async createBatchFromGrn(companyId: string, grnId: string, dto: CreateButcheryBatchFromGrnDto) {
    const { data } = await http.post<ButcheryProcessingBatchDto>(`${companyPath(companyId)}/from-grn/${encodeURIComponent(grnId)}`, dto);
    return data;
  },
  async updateOutputs(companyId: string, batchId: string, dto: UpdateButcheryActualOutputsDto) {
    const { data } = await http.put<ButcheryProcessingBatchDto>(`${companyPath(companyId)}/${encodeURIComponent(batchId)}/outputs`, dto);
    return data;
  },
  async start(companyId: string, batchId: string) {
    const { data } = await http.post<ButcheryProcessingBatchDto>(`${companyPath(companyId)}/${encodeURIComponent(batchId)}/start`);
    return data;
  },
  async submit(companyId: string, batchId: string) {
    const { data } = await http.post<ButcheryProcessingBatchDto>(`${companyPath(companyId)}/${encodeURIComponent(batchId)}/submit`);
    return data;
  },
  async approveVariance(companyId: string, batchId: string, dto: ApproveButcheryVarianceDto) {
    const { data } = await http.post<ButcheryProcessingBatchDto>(`${companyPath(companyId)}/${encodeURIComponent(batchId)}/approve-variance`, dto);
    return data;
  },
  async complete(companyId: string, batchId: string) {
    const { data } = await http.post<ButcheryProcessingBatchDto>(`${companyPath(companyId)}/${encodeURIComponent(batchId)}/complete`);
    return data;
  },
  async post(companyId: string, batchId: string) {
    const { data } = await http.post<ButcheryProcessingBatchDto>(`${companyPath(companyId)}/${encodeURIComponent(batchId)}/post`);
    return data;
  },
  async trace(companyId: string, batchId: string) {
    const { data } = await http.get<ButcheryBatchTraceDto>(`${companyPath(companyId)}/${encodeURIComponent(batchId)}/trace`);
    return data;
  },
};

