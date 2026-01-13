import {http} from "../../../api/http";
import type { CreateSaleDto } from "../types";

export const salesApi = {
  postSale: async (payload: CreateSaleDto, signal?: AbortSignal): Promise<void> => {
    await http.post("/sales/post", payload, { signal });
  },
};
