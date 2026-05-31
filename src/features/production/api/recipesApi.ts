// src/features/production/api/recipesApi.ts
//
// Three distinct recipe endpoint groups, kept in one file because they share types:
//
//   recipesApi          — legacy /companies/{id}/recipes (activate flow)
//   productionRecipesApi— /companies/{id}/production/recipes (get/upsert by menu item)
//   recipeEditorApi     — /companies/{id}/branches/{id}/menu/items/{id}/recipe-editor

import { http } from "../../../api/http";
import type {
  RecipeDto,
  UpsertRecipeRequest,
  MenuItemRecipeEditorDto,
  SaveMenuItemRecipeEditorRequest,
} from "../types";

// ── Legacy recipe endpoints ───────────────────────────────────────────────────

export const recipesApi = {
  getActive(companyId: string, menuItemId: string): Promise<RecipeDto> {
    return http
      .get<RecipeDto>(`/companies/${companyId}/recipes`, { params: { menuItemId } })
      .then((r) => r.data);
  },

  create(companyId: string, req: UpsertRecipeRequest): Promise<string> {
    return http
      .post<string>(`/companies/${companyId}/recipes`, req)
      .then((r) => r.data);
  },

  update(companyId: string, recipeId: string, req: UpsertRecipeRequest): Promise<void> {
    return http
      .put(`/companies/${companyId}/recipes/${recipeId}`, req)
      .then(() => undefined);
  },

  /** No request body — omit it so ASP.NET Core doesn't require Content-Type. */
  activate(companyId: string, recipeId: string): Promise<void> {
    return http
      .post(`/companies/${companyId}/recipes/${recipeId}/activate`)
      .then(() => undefined);
  },
};

// ── Production recipe endpoints ───────────────────────────────────────────────

export const productionRecipesApi = {
  getByMenuItem(companyId: string, menuItemId: string): Promise<RecipeDto> {
    return http
      .get<RecipeDto>(`/companies/${companyId}/production/recipes/by-menu-item/${menuItemId}`)
      .then((r) => r.data);
  },

  upsertByMenuItem(companyId: string, menuItemId: string, body: UpsertRecipeRequest): Promise<RecipeDto> {
    return http
      .put<RecipeDto>(`/companies/${companyId}/production/recipes/by-menu-item/${menuItemId}`, body)
      .then((r) => r.data);
  },
};

// ── Recipe editor endpoints (branch-scoped) ───────────────────────────────────

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