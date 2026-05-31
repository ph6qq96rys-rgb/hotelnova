// src/features/inventory/items/api/openingStockApi.ts

import { http } from "../../../../api/http";

export interface PostOpeningStockRequest {
  companyId:   string;
  itemId:      string;
  locationId:  string;
  qty:         number;
  uomId:       string;
  asOfDate:    string; // ISO 8601
  unitCost?:   number | null;
  note?:       string | null;
}

export const openingStockApi = {
  post(payload: PostOpeningStockRequest): Promise<void> {
    return http
      .post("/inventory/opening-stocks", payload)
      .then(() => undefined);
  },
};