// src/features/production/api/recipesApi.ts
//
// Active recipe endpoint groups share their request and response types:
//
//   productionRecipesApi- /companies/{id}/production/recipes (get/upsert by menu item)
//   recipeEditorApi     - /companies/{id}/branches/{id}/menu/items/{id}/recipe-editor

import { http } from "../../../api/http";
import type {
  RecipeDto,
  UpsertRecipeRequest,
  MenuItemRecipeEditorDto,
  SaveMenuItemRecipeEditorRequest,
} from "../types";

//  Production recipe endpoints 

export const productionRecipesApi = {
  getByMenuItem(
    companyId: string,
    menuItemId: string,
    params?: { mode?: "directSale" | "production" | "DirectSale" | "Production" }
  ): Promise<RecipeDto> {
    return http
      .get<RecipeDto>(`/companies/${companyId}/production/recipes/by-menu-item/${menuItemId}`, { params })
      .then((r) => r.data);
  },

  upsertByMenuItem(companyId: string, menuItemId: string, body: UpsertRecipeRequest): Promise<RecipeDto> {
    return http
      .put<RecipeDto>(`/companies/${companyId}/production/recipes/by-menu-item/${menuItemId}`, body)
      .then((r) => r.data);
  },

  getByOutputItem(
    companyId: string,
    branchId: string,
    outputItemId: string,
    params?: { mode?: "production" | "Production" }
  ): Promise<RecipeDto> {
    return http
      .get<RecipeDto>(`/companies/${companyId}/production/recipes/by-output-item/${outputItemId}`, {
        params: { ...params, branchId },
      })
      .then((r) => r.data);
  },

  upsertByOutputItem(
    companyId: string,
    branchId: string,
    outputItemId: string,
    body: UpsertRecipeRequest
  ): Promise<RecipeDto> {
    return http
      .put<RecipeDto>(`/companies/${companyId}/production/recipes/by-output-item/${outputItemId}`, body, {
        params: { branchId },
      })
      .then((r) => r.data);
  },
};

//  Recipe editor endpoints (branch-scoped) 

export const recipeEditorApi = {
  get(companyId: string, branchId: string, menuItemId: string): Promise<MenuItemRecipeEditorDto> {
    return http
      .get<MenuItemRecipeEditorDto>(`/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}/recipe-editor`)
      .then((r) => r.data);
  },

  save(companyId: string, branchId: string, menuItemId: string, body: SaveMenuItemRecipeEditorRequest): Promise<MenuItemRecipeEditorDto> {
    return http
      .put<MenuItemRecipeEditorDto>(`/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}/recipe-editor`, body)
      .then((r) => r.data);
  },
};


