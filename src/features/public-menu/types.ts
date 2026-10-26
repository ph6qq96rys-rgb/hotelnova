export type PublicMenuItem = {
  /** What guests see under the dish: the written ingredient list, or the recipe's ingredient names (names only). */
  recipeDetails?: {
    description?: string | null;
    ingredients: string[];
    localIngredients?: string[] | null;
    allergenInformation?: string | null;
    dietaryInformation?: string | null;
  } | null;
  subCategoryId?: string | null; subCategoryName?: string | null;
  id: string; categoryId: string; categoryName: string; categoryLocalName?: string | null;
  name: string; localName?: string | null; price: number; isAvailable: boolean;
  description?: string | null; localDescription?: string | null; imageUrl?: string | null;
};
/** Charges every menu price already includes (company POS pricing). Rates are percentages. */
export type MenuPricing = { vatRate: number; serviceChargeRate: number; vatOnServiceCharge: boolean; pricesIncludeVat: boolean; exampleFor100: number };
export type PublicMenu = { branchName: string; restaurantName: string; logoUrl?: string | null; currency: string; items: PublicMenuItem[]; pricing?: MenuPricing | null };
/** 0 off, 1 written lists only, 2 written lists or else the recipe's ingredient names. */
export type IngredientSource = 0 | 1 | 2 | "Off" | "AuthoredOnly" | "AuthoredThenRecipe";
export type MenuSettings = { branchName: string; isEnabled: boolean; showUnavailableItems: boolean; logoUrl?: string | null; publicUrl?: string | null; ingredientSource?: IngredientSource; items: PublicMenuItem[];
  pricing?: MenuPricing | null;
  itemsWithOwnRates?: Array<{ id: string; name: string; vatRate?: number | null; serviceChargeRate?: number | null }> };
