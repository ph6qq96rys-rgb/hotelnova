import { http } from "../../../api/http";
import type {
  MenuCategoryDto,
  MenuItemDto,
  SaveMenuItemRecipeEditorRequest,
  StockLocationDto,
  UpsertMenuItemRequest,
} from "../types";

type MenuItemWire = MenuItemDto & { consumptionBranchStockLocationId?: string|null; categoryConsumptionBranchStockLocationId?: string|null };
const fromWire=(item:MenuItemWire):MenuItemDto=>({...item,consumptionLocationId:item.consumptionBranchStockLocationId??null,categoryConsumptionLocationId:item.categoryConsumptionBranchStockLocationId??null});
const toWire=({consumptionLocationId,...item}:UpsertMenuItemRequest)=>({...item,consumptionBranchStockLocationId:consumptionLocationId||null});

export const menuItemsApi = {
  list(companyId: string, branchId: string, q?: string, activeOnly = true) {
    return http
      .get<MenuItemWire[]>(
        `/companies/${companyId}/branches/${branchId}/menu/items`,
        { params: { q, activeOnly } }
      )
      .then((r) => r.data.map(fromWire));
  },

  get(companyId: string, branchId: string, menuItemId: string) {
    return http
      .get<MenuItemWire>(
        `/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}`
      )
      .then((r) => fromWire(r.data));
  },

  create(companyId: string, branchId: string, payload: UpsertMenuItemRequest) {
    return http
      .post<MenuItemWire>(
        `/companies/${companyId}/branches/${branchId}/menu/items`,
        toWire(payload)
      )
      .then((r) => fromWire(r.data));
  },

  update(companyId: string, branchId: string, menuItemId: string, payload: UpsertMenuItemRequest) {
    return http
      .put<MenuItemWire>(
        `/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}`,
        toWire(payload)
      )
      .then((r) => fromWire(r.data));
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
        `/companies/${companyId}/branches/${branchId}/menu/items/consumption-locations`,
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