// src/modules/company/api/branchSetupApi.ts

import type { StockLocation, CreateStockLocationDto } from "../types/company.types";
import { stockLocationsApi } from "./stockLocationsApi";

/**
 * Branch setup facade.
 *
 * Stock locations are now company-owned resources:
 *   /companies/{companyId}/stock-locations
 *
 * branchId is passed as an optional filter or payload field instead of being
 * forced into the route.
 */
export const branchSetupApi = {
  listStockLocations: async (
    companyId: string,
    branchId: string,
  ): Promise<StockLocation[]> => {
    return stockLocationsApi.listByBranch(companyId, branchId);
  },

  createStockLocation: async (
    companyId: string,
    branchId: string,
    payload: CreateStockLocationDto,
  ): Promise<StockLocation> => {
    return stockLocationsApi.create(companyId, payload, branchId);
  },

  setDefaultReceiving: async (
    companyId: string,
    branchId: string,
    locationId: string,
  ): Promise<void> => {
    await stockLocationsApi.setDefaultReceiving(companyId, locationId, branchId);
  },

  setDefaultIssue: async (
    companyId: string,
    branchId: string,
    locationId: string,
  ): Promise<void> => {
    await stockLocationsApi.setDefaultIssue(companyId, locationId, branchId);
  },
};
