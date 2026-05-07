import { http } from "../../../api/http";
import type { CreateStockLocationPayload } from "../types";

export type StockLocationDto = { id: string; name: string; code?: string | null; branchId: string };

export const stockLocationsApi = {
  async list(companyId: string, branchId: string): Promise<StockLocationDto[]> {
    const res = await http.get(`/companies/${companyId}/branches/${branchId}/stock-locations`);
    return res.data ?? [];
  },

  async create(
    companyId: string,
    branchId: string,
    body: CreateStockLocationPayload
  ): Promise<StockLocationDto> {
    const res = await http.post(`/companies/${companyId}/branches/${branchId}/stock-locations`, body);
    return res.data;
  },
  async setStoreIssueLocation(companyId: string, branchId: string, stockLocationId: string) {
    const res = await http.post(
      `/companies/${companyId}/branches/${branchId}/stock-locations/${stockLocationId}/set-issue-location`,
      {}
    );
    return res.data;
  },
};
