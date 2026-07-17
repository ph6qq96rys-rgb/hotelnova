// src/features/inventory/stockTransfers/api/locationsApi.ts

import { http } from "../../../../api/http";
import type { StockLocationDto } from "../types";
import { normalizeLocation, type NormalizedStockLocation } from "../mapping/stockTransferMappers";
import { toQuery, unwrapArray } from "../utils/apiUtils";

export type LocationCapability =
  | "TransferFrom"
  | "TransferTo"
  | "Adjust"
  | "Any";

export type ListLocationsRequest = {
  companyId: string;
  branchId: string;
  activeOnly?: boolean;
  capability?: LocationCapability;
  signal?: AbortSignal;
};

function branchStockLocationsUrl(companyId: string, branchId: string): string {
  return `/companies/${companyId}/branches/${branchId}/stock-locations`;
}

function matchesCapability(
  location: NormalizedStockLocation,
  capability: LocationCapability
): boolean {
  if (capability === "TransferFrom") return location.canTransferFrom;
  if (capability === "TransferTo") return location.canTransferTo;
  if (capability === "Adjust") return location.canAdjust;
  return true;
}

export const locationsApi = {
  async list(request: ListLocationsRequest): Promise<NormalizedStockLocation[]> {
    const { companyId, branchId, activeOnly = true, capability = "Any", signal } = request;

    const response = await http.get(
      `${branchStockLocationsUrl(companyId, branchId)}${toQuery({ activeOnly })}`,
      { signal }
    );

    return unwrapArray<StockLocationDto>(response)
      .map(normalizeLocation)
      .filter((row): row is NormalizedStockLocation => Boolean(row))
      .filter((row) => (activeOnly ? row.isActive !== false : true))
      .filter((row) => matchesCapability(row, capability));
  },

  /**
   * Compatibility wrapper for existing pages.
   */
  async listLocations(
    companyId: string,
    branchId: string,
    signal?: AbortSignal
  ): Promise<NormalizedStockLocation[]> {
    return this.list({ companyId, branchId, activeOnly: true, signal });
  },

  /**
   * Compatibility wrapper for existing pages.
   */
  async getStockLocations(
    companyId: string,
    branchId: string,
    signal?: AbortSignal
  ): Promise<NormalizedStockLocation[]> {
    return this.list({ companyId, branchId, activeOnly: true, signal });
  },
};
