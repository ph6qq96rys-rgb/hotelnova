// =============================================================================
// Production / Inventory shared types
// Aligned to C# DTOs in RestaurantFNB.Application.Production.Recipes.Dtos
// =============================================================================

export type Guid = string;
export type MenuPriceBreakdown = {
  vatRate: number;
  serviceChargeRate: number;
  contingencyRate: number;
  pricesIncludeVat: boolean;
  netPrice: number;
  vatAmount: number;
  serviceChargeAmount: number;
  customerTotal: number;
  recipeCost: number;
  contingencyAmount: number;
  costWithContingency: number;
};

//  Catalog lookups 
//
//  Used by RecipeEditorPage, MenuItemDetailPage, and lookup fetchers.

export type CatalogUom = {
  id: Guid;
  code: string;
  name: string;
  isActive: boolean;
};

export type CatalogItem = {
  id: Guid;
  name: string;
  sku?: string | null;
  baseUomId?: Guid | null;
  isActive: boolean;
};

export type CatalogMenuItem = {
  id: Guid;
  name: string;
  code?: string | null;
  isActive: boolean;
};

//  Menu items 
//
//  MenuItemLite - used in dropdowns (ProductionBatchPage, RecipeEditorPage).
//  CreateMenuItemRequest - payload for menuItemsApi.create.

export type MenuItemLite = {
  id: Guid;
  name: string;
  code?: string | null;
  isActive: boolean;
};

export type CreateMenuItemRequest = {
  name: string;
  code?: string | null;
  categoryId?: string | null;
  outputUomId?: string | null;
  isActive: boolean;
};

//  Stock locations 

export type LocationLite = {
  id: Guid;
  name: string;
  isActive: boolean;
};

//  Recipe 
//
//  RecipeLineDto - shape returned by GET /production/recipes/by-menu-item/:id
//  RecipeDto     - full recipe envelope returned by the same endpoint
//
//  NOTE: the line field is `qty` on the wire (RecipeLineDto.qty) but the
//  upsert request uses `qtyPerMenuUnit` to match the C# UpsertRecipeLineRequest
//  record. These are intentionally different - one is a read DTO, the other
//  is a write request.

export type RecipeLineDto = {
  id: Guid;
  itemId: Guid;
  itemName: string;
  uomId: Guid;
  uomName: string;
  qty: number;
  wastePct?: number | null;
  isActive: boolean;
  notes?: string | null;
  sortOrder?: number | null;
};

export type UpsertRecipeLineRequest = {
  id?: Guid | null;
  itemId: Guid;
  uomId: Guid;
  qtyPerMenuUnit: number;   // matches C# QtyPerMenuUnit - NOT "qty"
  wastePct?: number | null;
  isActive?: boolean;
  notes?: string | null;
};



//  Recipe editor (branch-scoped get/save via recipeEditorApi) 
//
//  Used by RecipeEditorPage and recipeEditorApi.

export type RecipeEditorLineDto = {
  id: Guid;
  itemId: Guid;
  itemName: string;
  uomId: Guid;
  uomName: string;
  qty: number;
  wastePct?: number | null;
  isActive: boolean;
  notes?: string | null;
};

export type MenuItemRecipeEditorDto = {
  id: Guid;
  name: string;
  code?: string | null;
  outputItemId?: Guid | null;
  outputUomId?: Guid | null;
  lines: RecipeEditorLineDto[];
};

export type SaveMenuItemRecipeEditorRequest = {
  outputItemId?: Guid | null;
  outputUomId?: Guid | null;
  lines: {
    id?: Guid | null;
    itemId: Guid;
    uomId: Guid;
    qty: number;
    wastePct?: number | null;
    isActive?: boolean;
    notes?: string | null;
  }[];
};

//  Production batch 
//
//  Used by ProductionBatchPage and productionBatchesApi.

// C# ProductionBatchStatus enum: Draft=2, Approved=3, Posted=4, Reversed=5.
// Typed as number - use normaliseStatus() in components for display labels.
export type ProductionStatus = 2 | 3 | 4 | 5;

export type ProductionLineVm = {
  id?: string;
  lineNo: number;
  itemId: string;
  itemName: string;
  uomId?: string | null;
  uomName?: string | null;
  qty: number | string;   // string in UI state for decimal editing; number on the wire
  qtyBase?: number | null;
  source?: "manual" | "recipe" | number;   // API may return numeric enum
  recipeLineId?: string | null;
};

export type CreateProductionBatchRequest = {
  menuItemId: Guid;
  plannedQty: number;
  issueLocationId: Guid;
  outputLocationId: Guid;
  producedAtUtc: string;   // ISO datetime - C# DateTime ProducedAtUtc
  notes?: string | null;
};

export type UpdateProductionLinesRequest = {
  inputs: {
    id?: Guid | null;
    lineNo?: number | null;
    itemId: Guid;
    uomId: Guid;
    qty: number;
    batchNo?: string | null;
    expiryDate?: string | null;
    notes?: string | null;
  }[];
  outputs: {
    id?: Guid | null;
    lineNo?: number | null;
    itemId: Guid;
    uomId: Guid;
    qty: number;
    batchNo?: string | null;
    expiryDate?: string | null;
    notes?: string | null;
  }[];
};

export type ApplyRecipeRequest = {
  recipeId: Guid;
  outputQty: number;
  replaceExistingInputs: boolean;
};

export type RecipeMode = "directSale" | "production";
export type RecipeModeWire = RecipeMode | "DirectSale" | "Production" | 1 | 2;

export type UpsertRecipeRequest = {
  menuItemId: string;
  mode: RecipeModeWire;
  notes?: string | null;
  isActive: boolean;
  outputItemId?: string | null;
  outputUomId?: string | null;
  outputQuantity?: number | null;
  lines: {
    id?: string | null;
    itemId: string;
    uomId: string;
    qtyPerMenuUnit: number;
    wastePct: number;
    isActive: boolean;
    notes?: string | null;
  }[];
};

export type RecipeDto = {
  id: string;
  menuItemId: string;
  mode: RecipeModeWire;
  outputItemId?: string | null;
  outputUomId?: string | null;
  outputQuantity?: number | null;
  notes?: string | null;
  isActive: boolean;
  lines: any[];
};
export type MenuItemType = number;

export interface MenuCategoryDto {
  id: string;
  companyId: string;
  branchId: string;
  name: string;
  localName?: string | null;
  code?: string | null;
  isActive?: boolean;
  defaultConsumptionBranchStockLocationId?: string | null;
  defaultConsumptionLocationName?: string | null;
  itemCount: number;
}

export interface StockLocationDto {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
  canIssue?: boolean;
  canReceive?: boolean;
  canSell?: boolean;
  canProduce?: boolean;
  canReceiveGrn?: boolean;
  isMainWarehouse?: boolean;
  isProductionCenter?: boolean;
  isConsumptionLocation?: boolean;
}


export interface MenuItemDto {
  vatRateOverride?: number | null;
  serviceChargeRateOverride?: number | null;
  contingencyRateOverride?: number | null;
  pricing?: MenuPriceBreakdown | null;
  id: string;
  companyId: string;
  branchId: string;
  name: string;
  localName?: string | null;
  code: string;
  externalCode?: string | null;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string | null;
  subCategoryName?: string | null;
  itemType: MenuItemType;
  cost: number;
  sellingPrice: number;
  isActive: boolean;
  isAvailableForSale: boolean;
  showOnQrMenu?: boolean;
  consumptionLocationId?: string | null;
  consumptionLocationName?: string | null;
  categoryConsumptionLocationId?: string | null;
  categoryConsumptionLocationName?: string | null;
  outputItemId?: string | null;
  outputItemName?: string | null;
  outputUomId?: string | null;
  outputUomName?: string | null;
  hasRecipe: boolean;
  hasConsumptionLocation: boolean;
  unitsSold: number;
  createdAt: string;
  updatedAt?: string | null;
}

export interface UpsertMenuItemRequest {
  vatRateOverride?: number | null;
  serviceChargeRateOverride?: number | null;
  contingencyRateOverride?: number | null;
  name: string;
  localName?: string | null;
  code?: string | null;
  externalCode?: string | null;
  categoryId: string;
  subCategoryId?: string | null;
  itemType: MenuItemType;
  sellingPrice: number;
  isActive: boolean;
  isAvailableForSale: boolean;
  showOnQrMenu?: boolean;
  consumptionLocationId?: string | null;
  outputItemId?: string | null;
  outputUomId?: string | null;
}
