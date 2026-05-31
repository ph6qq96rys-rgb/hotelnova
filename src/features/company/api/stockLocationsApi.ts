// src/modules/company/api/stockLocationsApi.ts

import { http } from "../../../api/http";
import type { StockLocation, CreateStockLocationDto } from "../types/company.types";

const base = (companyId: string, branchId: string) =>
  `/companies/${companyId}/branches/${branchId}/stock-locations`;

function unwrap<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.items))   return r.items   as T[];
  if (Array.isArray(r.data))    return r.data     as T[];
  if (Array.isArray(r.results)) return r.results  as T[];
  return [];
}

export const stockLocationsApi = {

  list: async (companyId: string, branchId: string): Promise<StockLocation[]> => {
    const res = await http.get<unknown>(base(companyId, branchId));
    return unwrap<StockLocation>(res.data);
  },

  create: async (
    companyId: string,
    branchId: string,
    body: CreateStockLocationDto,
  ): Promise<StockLocation> => {
    const res = await http.post<StockLocation>(base(companyId, branchId), body);
    return res.data;
  },

  setDefaultReceiving: async (
    companyId: string,
    branchId: string,
    locationId: string,
  ): Promise<void> => {
    await http.post(`${base(companyId, branchId)}/${locationId}/set-default-receiving`);
  },

  setDefaultIssue: async (
    companyId: string,
    branchId: string,
    locationId: string,
  ): Promise<void> => {
    await http.post(`${base(companyId, branchId)}/${locationId}/set-default-issue`);
  },

  setStoreIssueLocation: async (
    companyId: string,
    branchId: string,
    locationId: string,
  ): Promise<void> => {
    await http.post(`${base(companyId, branchId)}/${locationId}/set-issue-location`);
  },
  
};