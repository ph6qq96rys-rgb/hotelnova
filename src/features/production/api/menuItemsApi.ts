import { http } from "../../../api/http";
import type {
  MenuCategoryDto,
  MenuItemDto,
  SaveMenuItemRecipeEditorRequest,
  StockLocationDto,
  UpsertMenuItemRequest,
} from "../types";

export const menuItemsApi = {
  list(companyId: string, branchId: string, q?: string, activeOnly = true) {
    return http
      .get<MenuItemDto[]>(
        `/companies/${companyId}/branches/${branchId}/menu/items`,
        { params: { q, activeOnly } }
      )
      .then((r) => r.data);
  },

  get(companyId: string, branchId: string, menuItemId: string) {
    return http
      .get<MenuItemDto>(
        `/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}`
      )
      .then((r) => r.data);
  },

  create(companyId: string, branchId: string, payload: UpsertMenuItemRequest) {
    return http
      .post<MenuItemDto>(
        `/companies/${companyId}/branches/${branchId}/menu/items`,
        payload
      )
      .then((r) => r.data);
  },

  update(companyId: string, branchId: string, menuItemId: string, payload: UpsertMenuItemRequest) {
    return http
      .put<MenuItemDto>(
        `/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}`,
        payload
      )
      .then((r) => r.data);
  },

  listCategories(companyId: string, branchId: string) {
    return http
      .get<MenuCategoryDto[]>(
        `/companies/${companyId}/branches/${branchId}/menu-categories`
      )
      .then((r) => r.data);
  },

  listStockLocations(companyId: string, branchId: string) {
    return http
      .get<StockLocationDto[]>(
        `/companies/${companyId}/branches/${branchId}/stock-locations`,
        { params: { activeOnly: true, pageSize: 100 } }
      )
      .then((r) => r.data);
  },

  getRecipeEditor(companyId: string, branchId: string, menuItemId: string) {
    return http
      .get(
        `/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}/recipe-editor`
      )
      .then((r) => r.data);
  },

  saveRecipeEditor(
    companyId: string,
    branchId: string,
    menuItemId: string,
    payload: SaveMenuItemRecipeEditorRequest
  ) {
    return http
      .put(
        `/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}/recipe-editor`,
        payload
      )
      .then((r) => r.data);
  },
};