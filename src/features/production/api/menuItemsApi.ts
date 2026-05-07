import { http } from "../../../api/http";
import type {CreateMenuItemRequest, SaveMenuItemRecipeEditorRequest}from "../types"
export const menuItemsApi = {
  list: async (
    companyId: string,
    branchId: string,
    q?: string,
    activeOnly = true
  ) => {
    const res = await http.get(
      `/companies/${companyId}/branches/${branchId}/menu/items`,
      {
        params: { q, activeOnly },
      }
    );
    return res.data;
  },

  create: async (
    companyId: string,
    branchId: string,
    payload: CreateMenuItemRequest
  ) => {
    const res = await http.post(
      `/companies/${companyId}/branches/${branchId}/menu/items`,
      payload
    );

    return res.data;
  },

  getRecipeEditor: async (
    companyId: string,
    branchId: string,
    menuItemId: string
  ) => {
    const res = await http.get(
      `/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}/recipe-editor`
    );

    return res.data;
  },
listCategories: async (companyId: string, branchId: string) => {
  const res = await http.get(
    `/companies/${companyId}/branches/${branchId}/menu/categories`,
    {
      params: {
        activeOnly: true,
      },
    }
  );

  return res.data;
},
  saveRecipeEditor: async (
    companyId: string,
    branchId: string,
    menuItemId: string,
    payload: SaveMenuItemRecipeEditorRequest
  ) => {
    const res = await http.put(
      `/companies/${companyId}/branche/${branchId}/menu/items/${menuItemId}/recipe-editor`,
      payload
    );

    return res.data;
  },
};