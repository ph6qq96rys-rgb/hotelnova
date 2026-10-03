export type PublicMenuItem = {
  recipeDetails?: { description?: string | null; ingredients: string[]; allergenInformation?: string | null } | null;
  subCategoryId?: string | null; subCategoryName?: string | null;
  id: string; categoryId: string; categoryName: string; categoryLocalName?: string | null;
  name: string; localName?: string | null; price: number; isAvailable: boolean;
  description?: string | null; localDescription?: string | null; imageUrl?: string | null;
};
export type PublicMenu = { branchName: string; restaurantName: string; logoUrl?: string | null; currency: string; items: PublicMenuItem[] };
export type MenuSettings = { branchName: string; isEnabled: boolean; showUnavailableItems: boolean; logoUrl?: string | null; publicUrl?: string | null; items: PublicMenuItem[] };
