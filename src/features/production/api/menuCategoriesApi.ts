// src/features/production/api/menuCategoriesApi.ts

import { http } from "../../../api/http";
import type { MenuCategoryDto, StockLocationDto } from "../types";

export interface UpsertMenuCategoryRequest {
  name: string;
  code?: string | null;
  isActive: boolean;
  defaultConsumptionLocationId?: string | null;
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

  create(companyId: string, branchId: string, payload: UpsertMenuCategoryRequest) {
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

listStockLocations(companyId: string, branchId?: string) {
  return http
    .get(
      `/companies/${companyId}/stock-locations`,
      {
        params: {
          branchId,
          activeOnly: true,
          pageSize: 75,
        },
      }
    )
    .then(r => r.data);
}
};
