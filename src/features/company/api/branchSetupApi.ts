// src/modules/company/api/branchSetupApi.ts
//
// ── What was wrong ───────────────────────────────────────────────────────────
// 1. asJson() and unwrapArray() were parsing backend responses that should
//    never be stringified JSON in the first place. If the backend returns a
//    string instead of JSON, that's a backend bug — not something to work
//    around in the API layer. Removed.
//
// 2. createStockLocation returned only the ID string, requiring callers to
//    reload the full list immediately after. Now returns the full object.
//    PascalCase fallback chains (d?.Id ?? d?.locationId) removed — if the
//    backend sends PascalCase keys, add a response interceptor in http.ts
//    (e.g. camelCase transformer) rather than scattering workarounds here.
//
// 3. Array.isArray guard added to list methods — consistent defensive pattern
//    used across all API files in this codebase.

import { http } from "../../../api/http";
import type {
  StockLocation, CreateStockLocationDto,
} from "../types/company.types";

const base = (companyId: string, branchId: string) =>
  `/companies/${companyId}/branches/${branchId}`;

export const branchSetupApi = {

  listStockLocations: async (companyId: string, branchId: string): Promise<StockLocation[]> => {
    const res = await http.get<StockLocation[]>(`${base(companyId, branchId)}/stock-locations`);
    return Array.isArray(res.data) ? res.data : [];
  },

  createStockLocation: async (
    companyId: string,
    branchId: string,
    payload: CreateStockLocationDto
  ): Promise<StockLocation> => {
    const body: CreateStockLocationDto = {
      ...payload,
      name: payload.name.trim(),
      code: payload.code.trim().toUpperCase(),
    };
    const res = await http.post<StockLocation>(
      `${base(companyId, branchId)}/stock-locations`,
      body
    );
    return res.data;
  },

  setDefaultReceiving: async (companyId: string, branchId: string, locationId: string): Promise<void> => {
    await http.post(`${base(companyId, branchId)}/stock-locations/${locationId}/set-default-receiving`);
  },

  setDefaultIssue: async (companyId: string, branchId: string, locationId: string): Promise<void> => {
    await http.post(`${base(companyId, branchId)}/stock-locations/${locationId}/set-default-issue`);
  },
};