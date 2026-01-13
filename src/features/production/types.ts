export type Guid = string;

export type CatalogUom = { id: Guid; code: string; name: string; isActive: boolean };
export type CatalogItem = {
  id: Guid;
  name: string;
  sku?: string | null;
  itemType?: number | null;
  baseUomId?: Guid | null;
  isActive: boolean;
};

export type CatalogMenuItem = { id: Guid; name: string; code?: string | null; isActive: boolean };

// If you already have MenuItems endpoint, use that.
// Otherwise you can reuse your own menu module list DTO.

export type InventoryCatalogsDto = {
  uoms: CatalogUom[];
  items: CatalogItem[];
  // optional: itemTypes, costingMethods...
};

export type UpsertRecipeLineRequest = {
  inventoryItemId: Guid;
  uomId: Guid;
  qtyPerMenuUnit: number;
  wastePct: number;
  sortOrder: number;
};



export type ProductionStatus = "Draft" | "Posted" | "Reversed";

export type ProductionInputDto = {
  id: Guid;
  itemId: Guid;
  uomId: Guid;
  qty: number;
  source: number; // Manual=1, FromRecipe=2
  recipeLineId?: Guid | null;
};

export type ProductionOutputDto = {
  id: Guid;
  menuItemId: Guid;
  outputItemId: Guid;
  uomId: Guid;
  qty: number;
};

export type MenuItemLite = {
  id: string;
  name: string;
  code?: string | null;
  isActive: boolean;
};
export type LocationLite = {
  id: string;
  name: string;
  isActive: boolean;
};

export type ProductionLineVm = {
  id?: string; // optional for UI row identity
  lineNo: number;
  itemId: string;
  itemName: string;
  uomId?: string | null;
  uomName?: string | null;
  qty: number;
  qtyBase?: number | null;
  source?: "manual" | "recipe";
  recipeLineId?: string | null;
};

export type ProductionBatchDto = {
  id: string;
  batchNo?: string | null;
  status?: string | null;

  menuItemId?: string | null;
  menuItemName?: string | null;

  plannedQty?: number | null;

  issueLocationId?: string | null;
  outputLocationId?: string | null;

  // for display
  createdAt?: string | null;

  inputs?: ProductionLineVm[];
  outputs?: { itemId: string; itemName: string; qtyBase: number }[];
};

export type CreateProductionBatchRequest = {
  menuItemId: string;
  plannedQty: number;
  issueLocationId: string;
  outputLocationId: string;
};

export type UpdateProductionLinesRequest = {
  inputs: Array<{
    lineNo: number;
    itemId: string;
    qty: number;
    uomId?: string | null;
    source?: string | null;
    recipeLineId?: string | null;
  }>;
};

export type ApplyRecipeRequest = {
  menuItemId: string;
  plannedQty: number;
};
export type CreateMenuItemRequest = {
  name: string;
  code?: string | null;
  categoryId?: string | null;
  outputUomId?: string | null;
  isActive: boolean;
};
export type RecipeLineDto = {
  id: string;
  itemId: string;
  itemName: string;
  uomId: string;
  uomName: string;
  qty: number;
  wastePct?: number | null;
  isActive: boolean;
  notes?: string | null;
  sortOrder?:string|null;
};

export type RecipeDto = {
  id: string;
  companyId: string;
  menuItemId: string;
  version: number;
  isActive: boolean;
  notes?: string | null;
  lines: RecipeLineDto[];
};

export type UpsertRecipeRequest = {
  notes?: string | null;
  isActive?: boolean;
  lines: {
    id?: string | null;
    itemId: string;
    uomId: string;
    qty: number;
    wastePct?: number | null;
    isActive?: boolean;
    notes?: string | null;
  }[];};
export type EditLine = {
  id?: string | null;
  itemId: string;
  uomId: string;
  qty: number;
  wastePct?: number | null;
  isActive: boolean;
  notes?: string | null;
};
export type MenuItemForRecipeDto = {
  id: string;
  name: string;
  code?: string | null;
  outputItemId?: string | null;
  outputUomId?: string | null;
  lines: EditLine[];
};


export type SaveRecipeEditorRequest = {
  outputItemId?: string | null;
  outputUomId?: string | null;
  lines: {
    id?: string | null;
    itemId: string;
    uomId: string;
    qty: number;
    wastePct?: number | null;
    isActive?: boolean;
    notes?: string | null;
  }[];
};
export type SaveMenuItemRecipeEditorRequest = {
  outputItemId?: string | null;
  outputUomId?: string | null;
  lines: {
    id?: string | null;
    itemId: string;
    uomId: string;
    qty: number;
    wastePct?: number | null;
    isActive?: boolean;
    notes?: string | null;
  }[];
};
export type RecipeEditorLineDto = {
  id: string;
  itemId: string;
  itemName: string;
  uomId: string;
  uomName: string;
  qty: number;
  wastePct?: number | null;
  isActive: boolean;
  notes?: string | null;
};

export type MenuItemRecipeEditorDto = {
  id: string;
  name: string;
  code?: string | null;
  outputItemId?: string | null;
  outputUomId?: string | null;
  lines: RecipeEditorLineDto[];
};