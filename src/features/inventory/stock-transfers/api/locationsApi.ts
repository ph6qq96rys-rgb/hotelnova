import { http } from "../../../../api/http";
import type {StockLocationDto} from "../types"

export type LocationLiteDto = {
  id: string;
  name: string;
  code?: string | null;
  branchName?: string | null; // optional if you have it
  active?: boolean;
};


export const locationsApi = {
  async list(companyId: string, branchId: string|null): Promise<StockLocationDto[]> {
            const res = await http.get(`/companies/${companyId}/branches/${branchId}/stock-locations`);
            return res.data ?? [];
  }
      
};
