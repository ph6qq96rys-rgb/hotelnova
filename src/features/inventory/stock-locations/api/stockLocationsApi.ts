import { http } from "../../../../api/http";
import type {
  StockLocationDto,
  CreateStockLocationDto,
  UpdateStockLocationDto
} from "../types";


//const base = import.meta.env.VITE_API_BASE_URL ?? "";

  export const stockLocationsApi = {
    async list(companyId: string, branchId: string): Promise<StockLocationDto[]> {
      const res = await http.get(`/companies/${companyId}/branches/${branchId}/stock-locations`);
      return res.data ?? [];
},
listForBranch: (companyId: string, branchId: string, kind?: string) =>
    http
      .get<StockLocationDto[]>(
        `/companies/${companyId}/branches/${branchId}/stock-locations`,
        { params: { kind: kind ?? undefined } }
      )
      .then(r => r.data),
  create: async (dto: CreateStockLocationDto): Promise<StockLocationDto> => {
    const res = await http.post<StockLocationDto>(
      `/inventory/stock-locations`, dto);
    return res.data;
  },

  update: async (id: string, dto: UpdateStockLocationDto): Promise<StockLocationDto> => {
    const res = await http.put<StockLocationDto>(
      `/inventory/stock-locations/${id}`,
      dto
    );
    return res.data;
  },

  setActive: async (id: string, isActive: boolean): Promise<void> => {
    await http.put(
      `/inventory/stock-locations/${id}/active`,
      { isActive }
    );
  },
};
