import { http } from "../../../../api/http";

export interface PostOpeningStockRequest {
  companyId: string;
  itemId: string;
  locationId: string;
  qty: number;
  uomId: string;
  unitCost?: number | null;
  asOfDate: string; // ISO
  note?: string | null;
}

export const openingStockApi = {
  post: (payload: PostOpeningStockRequest) =>
    http.post("/api/inventory/opening-stocks", payload),
};
