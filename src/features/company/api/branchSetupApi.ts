// branchSetupApi.ts
import type { OnboardingStatus, StockLocation, Store, CreateStockLocationPayload,CreateStockLocationResponse } from "../types";
import { http } from "../../../api/http";

function asJson<T>(data: any): T {
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed) as T;
      } catch {
        // fall through
      }
    }
  }
  return data as T;
}

function unwrapArray<T>(data: any): T[] {
  const parsed = asJson<any>(data);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const items = parsed.items ?? parsed.data ?? parsed.results;
    if (Array.isArray(items)) return items;
  }
  return [];
}

export const branchSetupApi = {
  async status(companyId: string, branchId: string): Promise<OnboardingStatus> {
    const res = await http.get(`/companies/${companyId}/branches/${branchId}/onboarding/status`);
    return asJson<OnboardingStatus>(res.data);
  },

  async listStores(companyId: string, branchId: string): Promise<Store[]> {
    const res = await http.get(`/companies/${companyId}/branches/${branchId}/stores`);
    return unwrapArray<Store>(res.data);
  },

  async listStockLocations(companyId: string, branchId: string): Promise<StockLocation[]> {
    const res = await http.get(`/companies/${companyId}/branches/${branchId}/stock-locations`);
    return unwrapArray<StockLocation>(res.data);
  },

 async createStockLocation(
  companyId: string,
  branchId: string,
  payload: CreateStockLocationPayload
): Promise<string> {
  // sanitize (backend validates Code + Name)
  const body: CreateStockLocationPayload = {
    ...payload,
    name: payload.name?.trim(),
    code: payload.code?.trim()?.toUpperCase(),
  };

  // ✅ IMPORTANT: pick ONE of these depending on your http baseURL
  // If http baseURL already includes "/api", use this:
  const url = `/companies/${companyId}/branches/${branchId}/stock-locations`;

  // If http baseURL does NOT include "/api", use this instead:
  // const url = `/api/companies/${companyId}/branches/${branchId}/stock-locations`;

  const res = await http.post<CreateStockLocationResponse>(url, body);

  const d = res.data;

  // support every common backend shape
  const id =
    d?.id ??
    d?.Id ??
    d?.locationId ??
    d?.LocationId ??
    d?.data?.id ??
    d?.data?.Id ??
    "";

  return id;
},

  async setDefaultReceiving(companyId: string, branchId: string, id: string): Promise<void> {
    await http.post(`/companies/${companyId}/branches/${branchId}/stock-locations/${id}/set-default-receiving`);
  },

  async setDefaultIssue(companyId: string, branchId: string, id: string): Promise<void> {
    await http.post(`/companies/${companyId}/branches/${branchId}/stock-locations/${id}/set-default-issue`);
  },
};