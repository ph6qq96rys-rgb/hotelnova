import { http } from "../../../api/http";

export type FixedAssetStatus =
  | "draft" | "active" | "assigned" | "inTransit" | "underInspection" | "underMaintenance"
  | "outOfService" | "missing" | "stolen" | "retired" | "disposed";
export type FixedAssetCondition = "new" | "excellent" | "good" | "fair" | "poor" | "damaged" | "unsafe" | "beyondRepair";
export type AcquisitionMethod = "purchase" | "donation" | "transferIn" | "openingBalance" | "lease";
export type DepreciationMethod = "straightLine" | "reducingBalance" | "unitsOfProduction" | "notDepreciable";
export type AssignmentType = "custody" | "departmentUse" | "locationUse" | "temporaryCheckout" | "transfer";
export type FixedAssetEventType =
  | "inspection" | "maintenanceStarted" | "maintenanceCompleted" | "outOfService" | "returnedToService"
  | "reportedMissing" | "reportedStolen" | "found" | "retired" | "disposed";
export type DisposalMethod = "sale" | "scrap" | "donation" | "writeOff" | "tradeIn";

export const ASSET_STATUSES: FixedAssetStatus[] = [
  "draft", "active", "assigned", "inTransit", "underInspection", "underMaintenance",
  "outOfService", "missing", "stolen", "retired", "disposed",
];
export const CONDITIONS: FixedAssetCondition[] = ["new", "excellent", "good", "fair", "poor", "damaged", "unsafe", "beyondRepair"];
export const ACQUISITION_METHODS: AcquisitionMethod[] = ["purchase", "donation", "transferIn", "openingBalance", "lease"];
export const DEPRECIATION_METHODS: DepreciationMethod[] = ["straightLine", "reducingBalance", "unitsOfProduction", "notDepreciable"];
export const ASSIGNMENT_TYPES: AssignmentType[] = ["custody", "departmentUse", "locationUse", "temporaryCheckout", "transfer"];
export const DISPOSAL_METHODS: DisposalMethod[] = ["sale", "scrap", "donation", "writeOff", "tradeIn"];

export type FixedAssetCategory = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string | null;
  assetAccountCode?: string | null;
  accumulatedDepreciationAccountCode?: string | null;
  depreciationExpenseAccountCode?: string | null;
  depreciationMethod: DepreciationMethod;
  usefulLifeMonths: number;
  residualValuePercent: number;
  capitalizationThreshold: number;
  inspectionIntervalDays: number;
  requiresSerialNumber: boolean;
  requiresTagBeforeActivation: boolean;
  requiresCustodianOnActivation: boolean;
  isActive: boolean;
};

export type UpsertFixedAssetCategoryPayload = Omit<FixedAssetCategory, "id" | "companyId">;

export type FixedAssetListItem = {
  id: string;
  companyId: string;
  categoryId: string;
  categoryName: string;
  currentBranchId?: string | null;
  branchName?: string | null;
  currentLocationId?: string | null;
  locationName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  custodianEmployeeId?: string | null;
  custodianName?: string | null;
  assetNo: string;
  assetTagNumber: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  status: FixedAssetStatus;
  condition: FixedAssetCondition;
  acquisitionDateUtc: string;
  inServiceDateUtc?: string | null;
  nextInspectionDueUtc?: string | null;
  acquisitionCost: number;
  netBookValue: number;
};

export type FixedAssetAssignment = {
  id: string;
  assignmentType: AssignmentType;
  toBranchName?: string | null;
  toLocationName?: string | null;
  toDepartmentName?: string | null;
  toEmployeeName?: string | null;
  assignedAtUtc: string;
  expectedReturnAtUtc?: string | null;
  returnedAtUtc?: string | null;
  isActivePrimary: boolean;
  businessReason?: string | null;
};

export type FixedAssetEvent = {
  id: string;
  type: FixedAssetEventType;
  occurredAtUtc: string;
  recordedByName: string;
  fromStatus: FixedAssetStatus;
  toStatus: FixedAssetStatus;
  condition?: FixedAssetCondition | null;
  notes?: string | null;
  reference?: string | null;
  amount?: number | null;
  bookValue?: number | null;
  gainLoss?: number | null;
  disposalMethod?: DisposalMethod | null;
};

export type FixedAssetDetail = FixedAssetListItem & {
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  grnId?: string | null;
  description?: string | null;
  barcode?: string | null;
  physicalLocation?: string | null;
  costCenterCode?: string | null;
  notes?: string | null;
  acquisitionMethod: AcquisitionMethod;
  depreciationMethod: DepreciationMethod;
  warrantyExpiryDateUtc?: string | null;
  lastInspectionAtUtc?: string | null;
  residualValue: number;
  usefulLifeMonths: number;
  accumulatedDepreciation: number;
  responsibleManagerEmployeeId?: string | null;
  lastDepreciationPeriod?: string | null;
  financialsLocked: boolean;
  disposedAtUtc?: string | null;
  disposalMethod?: DisposalMethod | null;
  disposalProceeds?: number | null;
  disposalGainLoss?: number | null;
  assignments: FixedAssetAssignment[];
  events: FixedAssetEvent[];
};

export type UpsertFixedAssetPayload = {
  supplierId?: string | null;
  grnId?: string | null;
  responsibleManagerEmployeeId?: string | null;
  purchaseOrderId?: string | null;
  categoryId: string;
  currentBranchId?: string | null;
  currentLocationId?: string | null;
  departmentId?: string | null;
  custodianEmployeeId?: string | null;
  assetNo?: string;
  assetTagNumber: string;
  name: string;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  barcode?: string | null;
  physicalLocation?: string | null;
  costCenterCode?: string | null;
  notes?: string | null;
  condition: FixedAssetCondition;
  acquisitionMethod: AcquisitionMethod;
  depreciationMethod?: DepreciationMethod | null;
  acquisitionDateUtc: string;
  warrantyExpiryDateUtc?: string | null;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths?: number | null;
};

export type FixedAssetSummary = {
  total: number;
  draft: number;
  inUse: number;
  underMaintenance: number;
  outOfService: number;
  missingOrStolen: number;
  retired: number;
  disposed: number;
  inspectionDue: number;
  totalCost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  depreciationBehind: number;
  lastRunPeriod?: string | null;
};

export type LookupItem = { id: string; name: string; code?: string | null };
export type FixedAssetLookups = { branches: LookupItem[]; locations: LookupItem[]; departments: LookupItem[]; employees: LookupItem[] };

export type AssignPayload = {
  assignmentType: AssignmentType;
  toBranchId: string;
  toLocationId?: string | null;
  toDepartmentId?: string | null;
  toEmployeeId?: string | null;
  expectedReturnAtUtc?: string | null;
  businessReason?: string | null;
};

export type RecordEventPayload = {
  type: FixedAssetEventType;
  occurredAtUtc?: string | null;
  condition?: FixedAssetCondition | null;
  notes?: string | null;
  reference?: string | null;
  amount?: number | null;
};

export type DepreciationLine = {
  fixedAssetId: string;
  assetNo: string;
  name: string;
  categoryName: string;
  branchName?: string | null;
  method: DepreciationMethod;
  fromPeriod: string;
  toPeriod: string;
  months: number;
  openingBookValue: number;
  amount: number;
  closingBookValue: number;
};

export type DepreciationPreview = {
  period: string;
  assetCount: number;
  entryCount: number;
  totalAmount: number;
  lines: DepreciationLine[];
  skipped: Array<{ fixedAssetId: string; assetNo: string; name: string; reason: string }>;
  runId?: string | null;
};

export type DepreciationRun = {
  id: string;
  period: string;
  runAtUtc: string;
  runByName: string;
  assetCount: number;
  entryCount: number;
  totalAmount: number;
  notes?: string | null;
  isReversed: boolean;
  reversedAtUtc?: string | null;
  reversedByName?: string | null;
  reversalReason?: string | null;
  canReverse: boolean;
};

export type JournalLine = {
  categoryName: string;
  branchName?: string | null;
  expenseAccountCode?: string | null;
  accumulatedAccountCode?: string | null;
  assetCount: number;
  amount: number;
};

export type ScheduleRow = { period: string; openingBookValue: number; amount: number; accumulatedAfter: number; closingBookValue: number; posted: boolean };
export type DepreciationSchedule = { fixedAssetId: string; method: DepreciationMethod; firstPeriod?: string | null; endPeriod?: string | null; note?: string | null; rows: ScheduleRow[] };

const root = (companyId: string) => `/companies/${companyId}/fixed-assets`;
const data = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const fixedAssetsApi = {
  categories: (companyId: string, includeInactive = false) =>
    data(http.get<FixedAssetCategory[]>(`${root(companyId)}/categories`, { params: { includeInactive } })),
  createCategory: (companyId: string, body: UpsertFixedAssetCategoryPayload) =>
    data(http.post<FixedAssetCategory>(`${root(companyId)}/categories`, body)),
  updateCategory: (companyId: string, id: string, body: UpsertFixedAssetCategoryPayload) =>
    data(http.put<FixedAssetCategory>(`${root(companyId)}/categories/${id}`, body)),

  list: (companyId: string, params: { branchId?: string | null; status?: string; search?: string; categoryId?: string; page?: number; pageSize?: number }) =>
    data(http.get<FixedAssetListItem[]>(root(companyId), {
      params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "")),
    })),
  register: (companyId: string, params: { branchId?: string | null; status?: string; search?: string; categoryId?: string; page?: number; pageSize?: number }) =>
    data(http.get<{ items: FixedAssetListItem[]; totalCount: number; page: number; pageSize: number }>(`${root(companyId)}/register`, {
      params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "")),
    })),
  summary: (companyId: string, branchId?: string | null) =>
    data(http.get<FixedAssetSummary>(`${root(companyId)}/summary`, { params: { branchId: branchId || undefined } })),
  lookups: (companyId: string, branchId?: string | null) =>
    data(http.get<FixedAssetLookups>(`${root(companyId)}/lookups`, { params: { branchId: branchId || undefined } })),

  get: (companyId: string, id: string) => data(http.get<FixedAssetDetail>(`${root(companyId)}/${id}`)),
  create: (companyId: string, body: UpsertFixedAssetPayload) => data(http.post<FixedAssetDetail>(root(companyId), body)),
  update: (companyId: string, id: string, body: UpsertFixedAssetPayload) => data(http.put<FixedAssetDetail>(`${root(companyId)}/${id}`, body)),
  deleteDraft: (companyId: string, id: string) => http.delete(`${root(companyId)}/${id}`),
  activate: (companyId: string, id: string) => data(http.post<FixedAssetDetail>(`${root(companyId)}/${id}/activate`, {})),
  assign: (companyId: string, id: string, body: AssignPayload) => data(http.post<FixedAssetDetail>(`${root(companyId)}/${id}/assign`, body)),
  recordEvent: (companyId: string, id: string, body: RecordEventPayload) => data(http.post<FixedAssetDetail>(`${root(companyId)}/${id}/events`, body)),
  retire: (companyId: string, id: string, body: { retiredAtUtc?: string | null; reason: string }) =>
    data(http.post<FixedAssetDetail>(`${root(companyId)}/${id}/retire`, body)),
  dispose: (companyId: string, id: string, body: { disposedAtUtc?: string | null; method: DisposalMethod; proceeds: number; reference?: string | null; reason: string }) =>
    data(http.post<FixedAssetDetail>(`${root(companyId)}/${id}/dispose`, body)),
  schedule: (companyId: string, id: string) => data(http.get<DepreciationSchedule>(`${root(companyId)}/${id}/depreciation-schedule`)),

  previewDepreciation: (companyId: string, period: string) =>
    data(http.get<DepreciationPreview>(`${root(companyId)}/depreciation/preview`, { params: { period } })),
  postDepreciation: (companyId: string, period: string, notes?: string | null) =>
    data(http.post<DepreciationPreview>(`${root(companyId)}/depreciation/runs`, { period, notes: notes || null })),
  runs: (companyId: string) => data(http.get<DepreciationRun[]>(`${root(companyId)}/depreciation/runs`)),
  journal: (companyId: string, runId: string) => data(http.get<JournalLine[]>(`${root(companyId)}/depreciation/runs/${runId}/journal`)),
  reverseRun: (companyId: string, runId: string, reason: string) =>
    data(http.post<DepreciationRun>(`${root(companyId)}/depreciation/runs/${runId}/reverse`, { reason })),
};

/** Kept for other screens that import the original helpers. */
export const listFixedAssetCategories = (companyId: string, includeInactive = false) => fixedAssetsApi.categories(companyId, includeInactive);
export const createFixedAssetCategory = (companyId: string, payload: UpsertFixedAssetCategoryPayload) => fixedAssetsApi.createCategory(companyId, payload);
export const listFixedAssets = (companyId: string, params: { branchId?: string | null; status?: string; search?: string } = {}) => fixedAssetsApi.list(companyId, params);
export const createFixedAsset = (companyId: string, payload: UpsertFixedAssetPayload) => fixedAssetsApi.create(companyId, payload);
