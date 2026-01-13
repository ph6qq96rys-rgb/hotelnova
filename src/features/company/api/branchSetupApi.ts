import type {OnboardingStatus,StockLocation,Store} from "../types"

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body?.error ?? "Request failed"), { status: res.status, body });
  }
  return res.json();
}

export const branchSetupApi = {
  status(companyId: string, branchId: string) {
    return http<OnboardingStatus>(`onboarding/companies/${companyId}/branches/${branchId}/onboarding/status`);
  },

  listStockLocations(companyId: string, branchId: string) {
    return http<StockLocation[]>(`onboarding/companies/${companyId}/branches/${branchId}/stock-locations`);
  },
  createStockLocation(companyId: string, branchId: string, payload: { name: string; type: string }) {
    return http<string>(`onboarding/companies/${companyId}/branches/${branchId}/stock-locations`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  setDefaultReceiving(companyId: string, branchId: string, id: string) {
    return http<void>(`onboarding/companies/${companyId}/branches/${branchId}/stock-locations/${id}/set-default-receiving`, {
      method: "POST",
    });
  },
  setDefaultIssue(companyId: string, branchId: string, id: string) {
    return http<void>(`onboarding/companies/${companyId}/branches/${branchId}/stock-locations/${id}/set-default-issue`, {
      method: "POST",
    });
  },

  listStores(companyId: string, branchId: string) {
    return http<Store[]>(`onboarding/companies/${companyId}/branches/${branchId}/stores`);
  },
  createStore(companyId: string, branchId: string, payload: { name: string; storeType: string }) {
    return http<string>(`onboarding/companies/${companyId}/branches/${branchId}/stores`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  setStoreIssueLocation(companyId: string, branchId: string, storeId: string, stockLocationId: string) {
    return http<void>(`onboarding/companies/${companyId}/branches/${branchId}/stores/${storeId}/set-default-issue-location`, {
      method: "POST",
      body: JSON.stringify({ stockLocationId }),
    });
  },
};
