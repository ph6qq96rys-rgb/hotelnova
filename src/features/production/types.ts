// =============================================================================
// Production / Inventory shared types
// Aligned to C# DTOs in RestaurantFNB.Application.Production.Recipes.Dtos
// =============================================================================

export type Guid = string;

// ── Catalog lookups ───────────────────────────────────────────────────────────
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

// ── Menu items ────────────────────────────────────────────────────────────────
//
//  MenuItemLite — used in dropdowns (ProductionBatchPage, RecipeEditorPage).
//  CreateMenuItemRequest — payload for menuItemsApi.create.

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

// ── Stock locations ───────────────────────────────────────────────────────────

export type LocationLite = {
  id: Guid;
  name: string;
  isActive: boolean;
};

// ── Recipe ────────────────────────────────────────────────────────────────────
//
//  RecipeLineDto — shape returned by GET /production/recipes/by-menu-item/:id
//  RecipeDto     — full recipe envelope returned by the same endpoint
//
//  NOTE: the line field is `qty` on the wire (RecipeLineDto.qty) but the
//  upsert request uses `qtyPerMenuUnit` to match the C# UpsertRecipeLineRequest
//  record. These are intentionally different — one is a read DTO, the other
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
  qtyPerMenuUnit: number;   // matches C# QtyPerMenuUnit — NOT "qty"
  wastePct?: number | null;
  isActive?: boolean;
  notes?: string | null;
};



// ── Recipe editor (branch-scoped get/save via recipeEditorApi) ────────────────
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

// ── Production batch ──────────────────────────────────────────────────────────
//
//  Used by ProductionBatchPage and productionBatchesApi.

// C# ProductionBatchStatus enum: Draft=2, Approved=3, Posted=4, Reversed=5.
// Typed as number — use normaliseStatus() in components for display labels.
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
  producedAtUtc: string;   // ISO datetime — C# DateTime ProducedAtUtc
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

export type UpsertRecipeRequest = {
  menuItemId: string;
  mode: RecipeMode;
  notes?: string | null;
  isActive: boolean;
  outputItemId?: string | null;
  outputUomId?: string | null;
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
  mode: RecipeMode;
  outputItemId?: string | null;
  outputUomId?: string | null;
  notes?: string | null;
  isActive: boolean;
  lines: any[];
};