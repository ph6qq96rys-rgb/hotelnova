import { http } from "../../../api/http";
import type {CreateMenuItemRequest,MenuItemLite}from "../types"

export const menuItemsApi = {
  async list(companyId: string, branchId: string, q = "", activeOnly = true) {
    const r = await http.get<MenuItemLite[]>(
      `/companies/${companyId}/branches/${branchId}/menu/items`,
      { params: { q, activeOnly } }
    );
    return r.data;
  },

  async create(companyId: string, branchId: string, body: CreateMenuItemRequest) {
    const r = await http.post<{ id: string }>(
      `/companies/${companyId}/branches/${branchId}/menu/items`,
      body
    );
    return r.data;
  },
};
