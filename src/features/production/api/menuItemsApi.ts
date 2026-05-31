// src/features/production/api/menuItemsApi.ts
//
// Branch-scoped menu item CRUD and recipe-editor endpoints.
// Base path: /companies/{companyId}/branches/{branchId}/menu

import { http } from "../../../api/http";
import type { CreateMenuItemRequest, SaveMenuItemRecipeEditorRequest } from "../types";

// ── API ───────────────────────────────────────────────────────────────────────

export const menuItemsApi = {
  list(companyId: string, branchId: string, q?: string, activeOnly = true) {
    return http
      .get(`/companies/${companyId}/branches/${branchId}/menu/items`, { params: { q, activeOnly } })
      .then((r) => r.data);
  },

  create(companyId: string, branchId: string, payload: CreateMenuItemRequest) {
    return http
      .post(`/companies/${companyId}/branches/${branchId}/menu/items`, payload)
      .then((r) => r.data);
  },

  listCategories(companyId: string, branchId: string) {
    return http
      .get(`/companies/${companyId}/branches/${branchId}/menu-categories`)
      .then((r) => r.data);
  },

  getRecipeEditor(companyId: string, branchId: string, menuItemId: string) {
    return http
      .get(`/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}/recipe-editor`)
      .then((r) => r.data);
  },

  saveRecipeEditor(companyId: string, branchId: string, menuItemId: string, payload: SaveMenuItemRecipeEditorRequest) {
    return http
      .put(`/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}/recipe-editor`, payload)
      .then((r) => r.data);
  },

  updatePrice(companyId: string, branchId: string, menuItemId: string, sellingPrice: number) {
    return http
      .patch(`/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}/price`, { sellingPrice })
      .then((r) => r.data);
  },
};