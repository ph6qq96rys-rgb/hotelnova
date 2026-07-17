// src/modules/company/api/branchStockLocationsApi.ts

import { http } from "../../../api/http";
import type { StockLocation } from "../types/company.types";
import { requireGuid, unwrapArray } from "./apiGuards";
import type { StockLocationListParams } from "./companyStockLocationsApi";

const MAX_PAGE_SIZE = 500;

export type AssignManyStockLocationsPayload = {
  stockLocationIds: string[];
};

const base = (companyId: string, branchId: string) =>
  `/companies/${requireGuid(companyId, "companyId")}/branches/${requireGuid(
    branchId,
    "branchId",
  )}/stock-locations`;

function buildListParams(params: StockLocationListParams = {}) {
  const query: Record<string, string | number | boolean> = {
    activeOnly: params.activeOnly ?? true,
    page: params.page ?? 1,
    pageSize: Math.min(params.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
  };

  if (
    params.locationType !== null &&
    params.locationType !== undefined &&
    params.locationType !== ""
  ) {
    query.locationType = params.locationType;
  }

  if (params.q?.trim()) query.q = params.q.trim();

  return query;
}

function cleanIds(ids: string[]): string[] {
  return Array.from(
    new Set(
      (ids ?? [])
        .map((id) => requireGuid(id, "stockLocationId"))
        .filter(Boolean),
    ),
  );
}

export const branchStockLocationsApi = {
  async list(
    companyId: string,
    branchId: string,
    params: StockLocationListParams = {},
  ): Promise<StockLocation[]> {
    const res = await http.get<unknown>(base(companyId, branchId), {
      params: buildListParams(params),
    });

    return unwrapArray<StockLocation>(res.data);
  },

  async assignMany(
    companyId: string,
    branchId: string,
    payload: AssignManyStockLocationsPayload,
  ): Promise<void> {
    await http.put(base(companyId, branchId), {
      stockLocationIds: cleanIds(payload.stockLocationIds),
    });
  },

  async assignOne(
    companyId: string,
    branchId: string,
    stockLocationId: string,
  ): Promise<void> {
    const loc = requireGuid(stockLocationId, "stockLocationId");
    await http.put(`${base(companyId, branchId)}/${loc}`);
  },

  async unassign(
    companyId: string,
    branchId: string,
    stockLocationId: string,
  ): Promise<void> {
    const loc = requireGuid(stockLocationId, "stockLocationId");
    await http.delete(`${base(companyId, branchId)}/${loc}`);
  },
};