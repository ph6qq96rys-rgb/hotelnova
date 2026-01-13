import { http } from "../../../api/http";
import type { RecipeDto, UpsertRecipeRequest, MenuItemRecipeEditorDto, SaveMenuItemRecipeEditorRequest} from "../types";

export const recipesApi = {
  getActive: (companyId: string, menuItemId: string) =>
    http
      .get<RecipeDto>(`/companies/${companyId}/recipes`, { params: { menuItemId } })
      .then((r) => r.data),

  create: (companyId: string, req: UpsertRecipeRequest) =>
    http.post<string>(`/companies/${companyId}/recipes`, req).then((r) => r.data),

  update: (companyId: string, recipeId: string, req: UpsertRecipeRequest) =>
    http.put<void>(`/companies/${companyId}/recipes/${recipeId}`, req).then((r) => r.data),

  activate: (companyId: string, recipeId: string) =>
    http.post<void>(`/companies/${companyId}/recipes/${recipeId}/activate`, {}).then((r) => r.data),
   async getByMenuItem(companyId: string, menuItemId: string) {
    const r = await http.get<RecipeDto>(
      `/companies/${companyId}/production/recipes/by-menu-item/${menuItemId}`
    );
    return r.data;
  },

  async upsertByMenuItem(companyId: string, menuItemId: string, body: UpsertRecipeRequest) {
    const r = await http.put<RecipeDto>(
      `/companies/${companyId}/production/recipes/by-menu-item/${menuItemId}`,
      body
    );
    return r.data;
  },
  async get(companyId: string, branchId: string, menuItemId: string) {
    const r = await http.get<MenuItemRecipeEditorDto>(
      `/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}/recipe-editor`
    );
    return r.data;
},
 async save(companyId: string, branchId: string, menuItemId: string, body: SaveMenuItemRecipeEditorRequest) {
    const r = await http.put<MenuItemRecipeEditorDto>(
      `/companies/${companyId}/branches/${branchId}/menu/items/${menuItemId}/recipe-editor`,
      body
    );
    return r.data;
  },
}

