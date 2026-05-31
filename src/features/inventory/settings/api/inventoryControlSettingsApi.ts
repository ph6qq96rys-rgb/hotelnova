import { http } from "../../../../api/http";

export type InventoryControlSettingsDto = {
  id: string;
  companyId: string;
  branchId?: string | null;
  locationId?: string | null;
  warningVariancePercent: number;
  highVariancePercent: number;
  criticalVariancePercent: number;
  requireApprovalForHighVariance: boolean;
  blockPostingOnCriticalVariance: boolean;
  lockInventoryDuringCount: boolean;
  requireReasonOnVariance: boolean;
  allowNegativeInventory: boolean;
  updatedAtUtc: string;
};

export type UpsertInventoryControlSettingsRequest = {
  branchId?: string | null;
  locationId?: string | null;
  warningVariancePercent: number;
  highVariancePercent: number;
  criticalVariancePercent: number;
  requireApprovalForHighVariance: boolean;
  blockPostingOnCriticalVariance: boolean;
  lockInventoryDuringCount: boolean;
  requireReasonOnVariance: boolean;
  allowNegativeInventory: boolean;
};

export const inventoryControlSettingsApi = {
  getEffective: (
    companyId: string,
    params?: { branchId?: string | null; locationId?: string | null }
  ) =>
    http
      .get<InventoryControlSettingsDto>(
        `/companies/${companyId}/inventory-control-settings/effective`,
        { params }
      )
      .then((r) => r.data),

  upsert: (companyId: string, body: UpsertInventoryControlSettingsRequest) =>
    http
      .put<InventoryControlSettingsDto>(
        `/companies/${companyId}/inventory-control-settings`,
        body
      )
      .then((r) => r.data),
};