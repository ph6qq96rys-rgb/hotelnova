import { http } from "../../../api/http";

export type FixedAssetCategory = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string | null;
  depreciationMethod: string;
  usefulLifeMonths: number;
  residualValuePercent: number;
  capitalizationThreshold: number;
  inspectionIntervalDays: number;
  requiresSerialNumber: boolean;
  requiresTagBeforeActivation: boolean;
  requiresCustodianOnActivation: boolean;
  isActive: boolean;
};

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
  status: string;
  condition: string;
  acquisitionDateUtc: string;
  inServiceDateUtc?: string | null;
  nextInspectionDueUtc?: string | null;
  acquisitionCost: number;
  netBookValue: number;
};

export type UpsertFixedAssetCategoryPayload = {
  code: string;
  name: string;
  description?: string | null;
  depreciationMethod: string;
  usefulLifeMonths: number;
  residualValuePercent: number;
  capitalizationThreshold: number;
  inspectionIntervalDays: number;
  requiresSerialNumber: boolean;
  requiresTagBeforeActivation: boolean;
  requiresCustodianOnActivation: boolean;
  isActive: boolean;
};

export type UpsertFixedAssetPayload = {
  purchaseOrderId?:string|null;
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
  condition: string;
  acquisitionMethod: string;
  acquisitionDateUtc: string;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths?: number | null;
};

const root = (companyId: string) => `/companies/${companyId}/fixed-assets`;

export async function listFixedAssetCategories(companyId: string, includeInactive = false) {
  const response = await http.get<FixedAssetCategory[]>(`${root(companyId)}/categories`, { params: { includeInactive } });
  return response.data;
}

export async function createFixedAssetCategory(companyId: string, payload: UpsertFixedAssetCategoryPayload) {
  const response = await http.post<FixedAssetCategory>(`${root(companyId)}/categories`, payload);
  return response.data;
}

export async function listFixedAssets(companyId: string, params: { branchId?: string | null; status?: string; search?: string } = {}) {
  const response = await http.get<FixedAssetListItem[]>(root(companyId), { params });
  return response.data;
}

export async function createFixedAsset(companyId: string, payload: UpsertFixedAssetPayload) {
  const response = await http.post<FixedAssetListItem>(root(companyId), payload);
  return response.data;
}
