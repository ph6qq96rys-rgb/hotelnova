// src/features/production/api/menuCategoriesApi.ts

import { http } from "../../../api/http";
import type { MenuCategoryDto } from "../types";

export type BranchStockLocationDto = {
  /**
   * BranchStockLocation.Id
   * Use this value for defaultConsumptionBranchStockLocationId.
   */
  id: string;

  /**
   * Global StockLocation.Id
   * Display/debug only. Do not submit this as the category default.
   */
  stockLocationId: string;

  name: string;
  code?: string | null;
  isActive?: boolean;
  isDefaultIssue?: boolean;
};

export interface UpsertMenuCategoryRequest {
  name: string;
  code?: string | null;
  isActive: boolean;
  defaultConsumptionBranchStockLocationId?: string | null;
}

export const menuCategoriesApi = {
  list(companyId: string, branchId: string) {
    return http
      .get<MenuCategoryDto[]>(
        `/companies/${companyId}/branches/${branchId}/menu-categories`
      )
      .then((r) => r.data);
  },

  get(companyId: string, branchId: string, categoryId: string) {
    return http
      .get<MenuCategoryDto>(
        `/companies/${companyId}/branches/${branchId}/menu-categories/${categoryId}`
      )
      .then((r) => r.data);
  },

  create(
    companyId: string,
    branchId: string,
    payload: UpsertMenuCategoryRequest
  ) {
    return http
      .post<MenuCategoryDto>(
        `/companies/${companyId}/branches/${branchId}/menu-categories`,
        payload
      )
      .then((r) => r.data);
  },

  update(
    companyId: string,
    branchId: string,
    categoryId: string,
    payload: UpsertMenuCategoryRequest
  ) {
    return http
      .put<MenuCategoryDto>(
        `/companies/${companyId}/branches/${branchId}/menu-categories/${categoryId}`,
        payload
      )
      .then((r) => r.data);
  },

  /**
   * Correct endpoint:
   * returns branch stock-location assignments.
   *
   * The returned `id` must be BranchStockLocation.Id.
   */
  listBranchStockLocations(companyId: string, branchId: string) {
    return http
      .get<BranchStockLocationDto[]>(
        `/companies/${companyId}/branches/${branchId}/stock-locations`,
        {
          params: {
            activeOnly: true,
            pageSize: 100,
          },
        }
      )
      .then((r) => r.data);
  },

  /**
   * Backward-compatible alias.
   * Keep this so existing pages calling listStockLocations do not crash.
   */
  listStockLocations(companyId: string, branchId: string) {
    return menuCategoriesApi.listBranchStockLocations(companyId, branchId);
  },
};