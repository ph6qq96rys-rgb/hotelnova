// src/modules/company/api/inventoryConfigurationApi.ts

import { http } from "../../../api/http";
import { optionalGuid, requireGuid } from "./apiGuards";

export type BranchStockLocationLookupDto = {
  branchStockLocationId: string;
  stockLocationId: string;
  stockLocationName: string;
  locationType: string;
};

export type BranchInventoryConfigurationDto = {
  branchId: string;
  companyId: string;

  defaultReceivingBranchStockLocationId?: string | null;
  defaultIssueBranchStockLocationId?: string | null;
  productionBranchStockLocationId?: string | null;
  consumptionBranchStockLocationId?: string | null;

  defaultReceivingLocation?: BranchStockLocationLookupDto | null;
  defaultIssueLocation?: BranchStockLocationLookupDto | null;
  productionLocation?: BranchStockLocationLookupDto | null;
  consumptionLocation?: BranchStockLocationLookupDto | null;

  updatedAtUtc: string;
};

export type UpsertBranchInventoryConfigurationDto = {
  defaultReceivingBranchStockLocationId?: string | null;
  defaultIssueBranchStockLocationId?: string | null;
  productionBranchStockLocationId?: string | null;
  consumptionBranchStockLocationId?: string | null;
};

const base = (companyId: string, branchId: string) =>
  `/companies/${requireGuid(companyId, "companyId")}/branches/${requireGuid(
    branchId,
    "branchId",
  )}/inventory-configuration`;

function normalizeLookup(raw: any): BranchStockLocationLookupDto | null {
  if (!raw) return null;

  const branchStockLocationId = optionalGuid(
    raw.branchStockLocationId ?? raw.id,
    "branchStockLocationId",
  );

  const stockLocationId = optionalGuid(raw.stockLocationId, "stockLocationId");

  if (!branchStockLocationId || !stockLocationId) return null;

  return {
    branchStockLocationId,
    stockLocationId,
    stockLocationName: String(raw.stockLocationName ?? raw.name ?? ""),
    locationType: String(raw.locationType ?? ""),
  };
}

function normalizeResponse(raw: any, companyId: string, branchId: string) {
  return {
    branchId: optionalGuid(raw?.branchId, "branchId") ?? branchId,
    companyId: optionalGuid(raw?.companyId, "companyId") ?? companyId,

    defaultReceivingBranchStockLocationId: optionalGuid(
      raw?.defaultReceivingBranchStockLocationId,
      "defaultReceivingBranchStockLocationId",
    ),
    defaultIssueBranchStockLocationId: optionalGuid(
      raw?.defaultIssueBranchStockLocationId,
      "defaultIssueBranchStockLocationId",
    ),
    productionBranchStockLocationId: optionalGuid(
      raw?.productionBranchStockLocationId,
      "productionBranchStockLocationId",
    ),
    consumptionBranchStockLocationId: optionalGuid(
      raw?.consumptionBranchStockLocationId,
      "consumptionBranchStockLocationId",
    ),

    defaultReceivingLocation: normalizeLookup(raw?.defaultReceivingLocation),
    defaultIssueLocation: normalizeLookup(raw?.defaultIssueLocation),
    productionLocation: normalizeLookup(raw?.productionLocation),
    consumptionLocation: normalizeLookup(raw?.consumptionLocation),

    updatedAtUtc: String(raw?.updatedAtUtc ?? ""),
  } satisfies BranchInventoryConfigurationDto;
}

function normalizeSavePayload(
  dto: UpsertBranchInventoryConfigurationDto,
): UpsertBranchInventoryConfigurationDto {
  return {
    defaultReceivingBranchStockLocationId: optionalGuid(
      dto.defaultReceivingBranchStockLocationId,
      "defaultReceivingBranchStockLocationId",
    ),
    defaultIssueBranchStockLocationId: optionalGuid(
      dto.defaultIssueBranchStockLocationId,
      "defaultIssueBranchStockLocationId",
    ),
    productionBranchStockLocationId: optionalGuid(
      dto.productionBranchStockLocationId,
      "productionBranchStockLocationId",
    ),
    consumptionBranchStockLocationId: optionalGuid(
      dto.consumptionBranchStockLocationId,
      "consumptionBranchStockLocationId",
    ),
  };
}

export const inventoryConfigurationApi = {
  async get(companyId: string, branchId: string): Promise<BranchInventoryConfigurationDto> {
    const res = await http.get<unknown>(base(companyId, branchId));
    return normalizeResponse(res.data, companyId, branchId);
  },

  async save(
    companyId: string,
    branchId: string,
    dto: UpsertBranchInventoryConfigurationDto,
  ): Promise<void> {
    await http.put(base(companyId, branchId), normalizeSavePayload(dto));
  },
};