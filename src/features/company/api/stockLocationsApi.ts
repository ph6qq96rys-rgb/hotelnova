// src/modules/company/api/stockLocationsApi.ts

import { companyStockLocationsApi } from "../api/companyStockLocationsApi";
import { branchStockLocationsApi } from "./branchStockLocationsApi";
import { inventoryConfigurationApi } from "./inventoryConfigurationApi";
import { posInventoryApi } from "../api/posInventoryApi";
import { optionalGuid } from "./apiGuards";

export type {
  StockLocationListParams,
  UpdateStockLocationDto,
} from "../api/companyStockLocationsApi";

export type {
  AssignManyStockLocationsPayload,
} from "./branchStockLocationsApi";

export type {
  BranchStockLocationLookupDto,
  BranchInventoryConfigurationDto,
  UpsertBranchInventoryConfigurationDto,
} from "./inventoryConfigurationApi";

export type {
  PosInventoryMappingDto,
  SavePosInventoryMappingsDto,
} from "../api/posInventoryApi";

export const stockLocationsApi = {
  company: companyStockLocationsApi,
  branchAssignments: branchStockLocationsApi,
  configuration: inventoryConfigurationApi,
  pos: posInventoryApi,

  // Backward-compatible aliases
  list: companyStockLocationsApi.list,
  get: companyStockLocationsApi.get,
  create: companyStockLocationsApi.create,
  update: companyStockLocationsApi.update,
  setStatus: companyStockLocationsApi.setStatus,

  listByBranch: branchStockLocationsApi.list,
  assignToBranch: companyStockLocationsApi
    ? async (companyId: string, locationId: string, branchId: string) =>
        branchStockLocationsApi.assignOne(companyId, branchId, locationId)
    : branchStockLocationsApi.assignOne,

  assignManyToBranch: branchStockLocationsApi.assignMany,

  unassignFromBranch: async (
    companyId: string,
    locationId: string,
    branchId: string,
  ) => branchStockLocationsApi.unassign(companyId, branchId, locationId),

  getBranchInventoryConfiguration: inventoryConfigurationApi.get,
  saveBranchInventoryConfiguration: inventoryConfigurationApi.save,

  listPosInventoryMappings: posInventoryApi.listMappings,
  savePosInventoryMappings: posInventoryApi.saveMappings,

  normalizeBranchId: (branchId: string | null | undefined) =>
    optionalGuid(branchId, "branchId"),
};