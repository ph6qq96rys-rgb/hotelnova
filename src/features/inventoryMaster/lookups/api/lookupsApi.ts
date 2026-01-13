import { http } from "../../../../api/http";
import type { UomDto, CategoryDto } from "../types";

/**
 * Adjust these endpoints to match your backend routes.
 */
export const lookupsApi = {
  uoms: (companyId: string) =>
    http.get<UomDto[]>(`/companies/${companyId}/inventory-master/uoms`),

  categories: (companyId: string) =>
    http.get<CategoryDto[]>(`/companies/${companyId}/inventory-categories`),
};
