import { http } from "../../../../api/http";
import type {
  ItemDesDto,
  ItemListDto,
  CreateItemRequest,
  UpdateItemRequest,
  InventoryCatalogs
} from "../types";
export const itemsApi = {
  load: (companyId: string) =>
    http
      .get<InventoryCatalogs>(`/companies/${companyId}/inventory-master/catalogs`, {
        params: { activeOnly: true },
      })
      .then(r => r.data),

  list: (companyId: string, q?: string) =>
    http.get<ItemListDto[]>(`/companies/${companyId}/inventory/items`, {
      params: { companyId, q }
    }).then(r => r.data),

  get: (companyId:string,id: string) =>
    http.get<ItemDesDto>(`/companies/${companyId}/inventory/items/${id}`)
      .then(r => r.data),

  create: (payload: CreateItemRequest) =>
    http.post(`/companies/${payload.companyId}/inventory/items`, payload),

  update: (id: string, payload: UpdateItemRequest) =>
    http.put(`/companies/${payload.companyId}/inventory/items/${id}`, payload)
};
