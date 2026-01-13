import { http } from "../../../../api/http";
import type {
  InventoryItemDto,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  UomDto,
  ItemTypeDto,
  ItemUomDto
} from "../types";

function base(companyId: string) {
  return `/companies/${companyId}/inventory-master`;
}
export function encodeParam(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return encodeURIComponent(String(value));
}
type InventoryItemListParams = {
  q?: string | null;
  page?: number;
  pageSize?: number;
};
export const inventoryItemsApi = {
  // =========================
  // ITEMS
  // =========================
 list(companyId: string, params?: InventoryItemListParams) {
  return http
    .get<InventoryItemDto[]>(`${base(companyId)}/items`, {
      params: {
        q: params?.q ?? undefined,
        page: params?.page ?? undefined,
        pageSize: params?.pageSize ?? undefined,
      },
    })
    .then((r) => r.data);
},


  getById(companyId: string, id: string) {
    return http.get<InventoryItemDto>(`${base(companyId)}/items/${id}`);
  },

  create(companyId: string, dto: CreateInventoryItemDto) {
    return http.post<string>(`${base(companyId)}/items`, dto);
  },

  update(companyId: string, id: string, dto: UpdateInventoryItemDto) {
    return http.put<void>(`${base(companyId)}/items/${id}`, dto);
  },

  // ✅ used by InventoryItemsPage.tsx
  setActive(companyId: string, id: string, isActive: boolean) {
    // Recommended dedicated endpoint:
    return http.put<void>(`/companies/${companyId}/inventory/items/${id}/active`, { isActive });

    // If you don't want a new endpoint, use this instead:
    // return http.put<void>(`${base(companyId)}/items/${id}`, { isActive });
  },
setDeactivate(companyId: string, id: string, isActive: boolean) {
    // Recommended dedicated endpoint:
    return http.put<void>(`/companies/${companyId}/inventory/items/${id}/deactivate`, { isActive });

    // If you don't want a new endpoint, use this instead:
    // return http.put<void>(`${base(companyId)}/items/${id}`, { isActive });
  },

  // =========================
  // CATEGORIES
  // =========================
  getCategories(companyId: string,  params?: InventoryItemListParams) {

    return http.get<InventoryItemDto[]>(`${base(companyId)}/categories`, {
      params: {
        q: params?.q ?? undefined,
      },
    })
    .then((r) => r.data);
  },

  createCategory(companyId: string, dto: { name: string; description?: string | null }) {
    return http.post<string>(`${base(companyId)}/categories`, dto);
  },

  updateCategory(companyId: string, id: string, dto: { name?: string; description?: string | null; isActive?: boolean | null }) {
    return http.put<void>(`${base(companyId)}/categories/${id}`, dto);
  },

  deleteCategory(companyId: string, id: string) {
    return http.delete<void>(`${base(companyId)}/categories/${id}`);
  },

  // =========================
  // UOMS
  // =========================
  getUoms(companyId: string, params?: InventoryItemListParams) {
    return http.get<UomDto[]>(`${base(companyId)}/uoms`, {
      params: {
        q: params?.q ?? undefined,
      },
    }).then((r) => r.data);
  },

  createUom(companyId: string, dto: { name: string; symbol?: string | null; isBase?: boolean }) {
    return http.post<string>(`${base(companyId)}/uoms`, dto);
  },

  updateUom(companyId: string, id: string, dto: { name?: string; symbol?: string | null; isBase?: boolean }) {
    return http.put<void>(`${base(companyId)}/uoms/${id}`, dto);
  },

  deleteUom(companyId: string, id: string) {
    return http.delete<void>(`${base(companyId)}/uoms/${id}`);
  },
  listForItem: (companyId: string, itemId: string) =>
    http.get<ItemUomDto[]>(`/companies/${companyId}/inventory-items/${itemId}/uoms`).then((r) => r.data),

  // =========================
  // ITEM TYPES (optional)
  // =========================
  getItemTypes(companyId: string, q?: string) {
    return http.get<ItemTypeDto[]>(`${base(companyId)}/item-types`, {
      params: {
        q: q ?? undefined,
      },
    }).then((r) => r.data); 
  },

  createItemType(companyId: string, dto: { name: string; description?: string | null }) {
    return http.post<string>(`${base(companyId)}/item-types`, dto);
  },
};