import { http } from "../../../../api/http";
import type {
  InventoryCatalogs,
  CreateInventoryItemRequest,
  UpdateInventoryItemRequest,
  InventoryItemDto,
} from "../types";

/**
 * UI-friendly payloads (don’t force forms to provide id/companyId).
 * API layer will enrich them to match backend DTOs.
 */
export type CreateInventoryItemBody = Omit<CreateInventoryItemRequest, "id" | "companyId">;
export type UpdateInventoryItemBody = Omit<UpdateInventoryItemRequest, "companyId">;

export type CreateInventoryItemResponse = { id: string };


function withCompanyForCreate(body: CreateInventoryItemBody): CreateInventoryItemRequest {
  return {
    ...body,
  };
}

function withCompanyForUpdate(companyId: string, body: UpdateInventoryItemBody): UpdateInventoryItemRequest {
  return {
    companyId,
    ...body,
  } as UpdateInventoryItemRequest;
}

export const itemsApi = {
  /** Load catalogs (item types, categories, uoms, costing methods) */
  load(companyId: string, activeOnly = true) {
    return http
      .get<InventoryCatalogs>(`/companies/${companyId}/inventory-master/catalogs`, {
        params: { activeOnly },
      })
      .then((r) => r.data);
  },

  /** List items (optional query) */
  list(companyId: string, q?: string) {
    return http
      .get<InventoryItemDto[]>(`/companies/${companyId}/inventory-master/items`, {
        params: q ? { q } : undefined,
      })
      .then((r) => r.data);
  },

  /** Get item details */
  get(companyId: string, id: string) {
    return http
      .get<InventoryItemDto>(`/companies/${companyId}/inventory-master/items/${id}`)
      .then((r) => r.data);
  },

  /** Create item (UI passes body; API adds id/companyId) */
  create(companyId: string, body: CreateInventoryItemBody) {
    const payload = withCompanyForCreate(body);
    return http
      .post<CreateInventoryItemResponse>(`/companies/${companyId}/inventory-master/items`, payload)
      .then((r) => r.data);
  },

  /** Update item (UI passes body; API adds companyId) */
  update(companyId: string, id: string, body: UpdateInventoryItemBody) {
    const payload = withCompanyForUpdate(companyId, body);
    return http
      .put<void>(`/companies/${companyId}/inventory-master/items/${id}`, payload)
      .then((r) => r.data);
  },
};
