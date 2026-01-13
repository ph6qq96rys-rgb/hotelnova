import { http } from "../../api/http";
import type { InventoryCatalogsDto } from "./types";

export const inventoryCatalogsApi = {
  getCatalogs: async (
    companyId: string,
    activeOnly: boolean = true
  ): Promise<InventoryCatalogsDto> => {
    const res = await http.get<InventoryCatalogsDto>(
      `/companies/${companyId}/inventory-master/catalogs`,
      { params: { activeOnly } }
    );
    return res.data;
  },
};
