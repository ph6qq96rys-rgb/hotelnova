import { http } from "../../../api/http";
import type { CreateStockLocationRequest } from "../types";

export type StockLocationDto = { id: string; name: string; code?: string | null; branchId: string };

export const stockLocationsApi = {
  async list(companyId: string, branchId: string): Promise<StockLocationDto[]> {
    const res = await http.get(`/companies/${companyId}/branches/${branchId}/stock-locations`);
    return res.data ?? [];
  },

  async create(
    companyId: string,
    branchId: string,
    body: CreateStockLocationRequest
  ): Promise<StockLocationDto> {
    const res = await http.post(`/companies/${companyId}/branches/${branchId}/stock-locations`, body);
    return res.data;
  },
};
