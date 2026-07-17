// src/modules/company/api/branchSetupApi.ts

import type { CreateStockLocationDto, StockLocation } from "../types/company.types";
import {
  stockLocationsApi,
  type UpsertBranchInventoryConfigurationDto,
} from "./stockLocationsApi";
import { requireGuid } from "./apiGuards";

function idOf(raw: any): string {
  return String(raw?.id ?? raw?.locationId ?? raw?.stockLocationId ?? "").trim();
}

export const branchSetupApi = {
  async listCompanyStockLocations(companyId: string): Promise<StockLocation[]> {
    return stockLocationsApi.company.list(companyId, {
      activeOnly: true,
      page: 1,
      pageSize: 500,
    });
  },

  async listBranchStockLocations(
    companyId: string,
    branchId: string,
  ): Promise<StockLocation[]> {
    requireGuid(companyId, "companyId");
    requireGuid(branchId, "branchId");

    return stockLocationsApi.branchAssignments.list(companyId, branchId, {
      activeOnly: true,
      page: 1,
      pageSize: 500,
    });
  },

  async createAndAssignStockLocation(
    companyId: string,
    branchId: string,
    payload: CreateStockLocationDto,
  ): Promise<StockLocation> {
    requireGuid(companyId, "companyId");
    requireGuid(branchId, "branchId");

    const created = await stockLocationsApi.company.create(companyId, payload);
    const locationId = idOf(created);

    if (!locationId) {
      throw new Error(
        "Stock location was created, but no id was returned for branch assignment.",
      );
    }

    await stockLocationsApi.branchAssignments.assignOne(companyId, branchId, locationId);

    return created;
  },

  async assignExistingStockLocation(
    companyId: string,
    branchId: string,
    locationId: string,
  ): Promise<void> {
    requireGuid(companyId, "companyId");
    requireGuid(branchId, "branchId");
    requireGuid(locationId, "stockLocationId");

    await stockLocationsApi.branchAssignments.assignOne(companyId, branchId, locationId);
  },

  async assignManyExistingStockLocations(
    companyId: string,
    branchId: string,
    locationIds: string[],
  ): Promise<void> {
    requireGuid(companyId, "companyId");
    requireGuid(branchId, "branchId");

    await stockLocationsApi.branchAssignments.assignMany(companyId, branchId, {
      stockLocationIds: locationIds,
    });
  },

  async unassignStockLocation(
    companyId: string,
    branchId: string,
    locationId: string,
  ): Promise<void> {
    requireGuid(companyId, "companyId");
    requireGuid(branchId, "branchId");
    requireGuid(locationId, "stockLocationId");

    await stockLocationsApi.branchAssignments.unassign(companyId, branchId, locationId);
  },

  async getInventoryConfiguration(companyId: string, branchId: string) {
    requireGuid(companyId, "companyId");
    requireGuid(branchId, "branchId");

    return stockLocationsApi.configuration.get(companyId, branchId);
  },

  async saveInventoryConfiguration(
    companyId: string,
    branchId: string,
    payload: UpsertBranchInventoryConfigurationDto,
  ): Promise<void> {
    requireGuid(companyId, "companyId");
    requireGuid(branchId, "branchId");

    await stockLocationsApi.configuration.save(companyId, branchId, payload);
  },
};