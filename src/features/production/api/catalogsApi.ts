import { http } from "../../../api/http";
import type { InventoryCatalogsDto } from "../types";

export const catalogsApi = {
  get: (companyId: string, activeOnly = true) =>
    http
      .get<InventoryCatalogsDto>(`/companies/${companyId}/inventory-master/catalogs`, {
        params: { activeOnly },
      })
      .then((r) => r.data),
};
