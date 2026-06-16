// src/features/inventoryMaster/items/types.ts
//
// Single source of truth for all inventory item domain types.
// Rules:
//   • API shapes (DTOs) exactly mirror the backend JSON contract.
//   • UI view-models are separate types — never reuse a DTO as a form model.
//   • No Pascal-case property names — the backend serialises camelCase.
//   • Optional fields use `field?: T` only when the backend genuinely omits
//     the key; nullable fields use `field: T | null`.

import type { ItemType } from "./constants/itemTypes";

// =============================================================================
// Primitives
// =============================================================================

/** Branded alias — makes Guid intent explicit at call sites. */
export type Guid = string;

// =============================================================================
// Catalog / lookup DTOs
// =============================================================================

export interface CategoryDto {
  id:          string;
  name:        string;
  description: string | null;
  isActive:    boolean;
}

/**
 * UOM as returned by GET /inventory-master/uoms and embedded in catalogs.
 * `code` is the short symbol (KG, L, PCS). `symbol` is kept for
 * backwards-compatibility with modules that still use the old field name.
 */
export interface UomDto {
  id:       string;
  name:     string;
  code:     string;        // canonical — always present from the refactored API
  symbol?:  string | null; // legacy alias; prefer `code`
  isBase?:  boolean;
  isActive: boolean;
}

export interface ItemTypeCatalogDto {
  code: ItemType;
  name: string;
}

export interface CostingMethodDto {
  code: string;
  name: string;
}

/**
 * Shape returned by GET /inventory-master/catalogs.
 * Used by ItemUpsertPage to populate all dropdowns in a single request.
 */
export interface InventoryCatalogs {
  itemTypes:      ItemTypeCatalogDto[];
  categories:     CategoryDto[];
  uoms:           UomDto[];
  costingMethods: CostingMethodDto[];
}

// =============================================================================
// Item UOM / conversion rule DTO
// =============================================================================

/**
 * A single allowed-UOM row for an item.
 * Mirrors the backend ItemUomDto record exactly.
 */
export interface ItemUomDto {
  uomId:        string;
  code:         string;
  name:         string;
  toBaseFactor: number | null; // null only while a new row has not been filled in
  isBase:       boolean;
  isPurchase:   boolean;
  isIssue:      boolean;
  isRecipe:     boolean;
  isConsume:    boolean;
  isCount:      boolean;
  isActive:     boolean;
}

// =============================================================================
// Item DTOs  (API request / response shapes)
// =============================================================================

/**
 * Full item detail returned by GET /items and GET /items/:id.
 * Also used as the edit seed — every field the form needs is present here.
 */
export interface InventoryItemDto {
  id:             string;
  companyId:      string;
  name:           string;
  localName:      string | null;
  sku:            string | null;
  barcode:        string | null;
  categoryId:     string | null;
  baseUomId:      string;
  issueUomId:     string | null;
  type:           ItemType;
  trackInventory: boolean;
  reorderLevel:   number;
  costingMethod:  string | null;
  defaultCost:    number | null;
  defaultPrice:   number | null;
  allowedUoms:    ItemUomDto[];  // always an array — backend normalises null → []
  isActive:       boolean;
}

/**
 * Lightweight projection returned by the list endpoint.
 * Does NOT include allowedUoms — avoids loading conversion grids for
 * every row in the register table.
 */
export interface InventoryItemListDto {
  id:             string;
  companyId:      string;
  name:           string;
  localName:      string | null;
  sku:            string | null;
  barcode:        string | null;
  categoryId:     string | null;
  baseUomId:      string;
  issueUomId:     string | null;
  type:           ItemType;
  trackInventory: boolean;
  reorderLevel:   number;
  defaultCost:    number | null;
  defaultPrice:   number | null;
  allowedUoms:    ItemUomDto[];
  isActive:       boolean;
}

/**
 * POST /items request body.
 * `isActive` is always true on create — the backend enforces this.
 * `companyId` comes from the route, not the body.
 */
export interface CreateInventoryItemRequest {
  name:           string;
  localName:      string | null;
  sku:            string | null;
  barcode:        string | null;
  categoryId:     string | null;
  baseUomId:      string;
  type:           ItemType;
  allowedUoms:    ItemUomDto[];
  trackInventory: boolean;
  reorderLevel:   number;
  costingMethod:  string | null;
  defaultCost:    number | null;
  defaultPrice:   number | null;
}

/** POST /items response — the server-assigned ID. */
export interface CreateInventoryItemResponse {
  id: string;
}

/**
 * PUT /items/:id request body.
 * Includes `isActive` because editing an existing item can change its status.
 * `id` and `companyId` come from the route — excluded from the body.
 */
export interface UpdateInventoryItemRequest
  extends CreateInventoryItemRequest {
  isActive: boolean;
}

// =============================================================================
// Search / lightweight lookup DTO
// =============================================================================

/**
 * Used in pick-lists and typeaheads where only identity + UOM info is needed.
 * Returned by search / autocomplete endpoints.
 */
export interface InventorySearchItemDto {
  id:           Guid;
  name:         string;
  sku:          string | null;
  barcode:      string | null;
  baseUomId:    Guid | null;
  baseUomCode:  string | null;
  isActive:     boolean;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Normalises a raw ItemUomDto array before submission:
 *   • Replaces null toBaseFactor with 0 (backend validates > 0, so this
 *     surfaces a validation error rather than silently sending null).
 *   • Coerces boolean flags from truthy values.
 *   • Filters out rows with no uomId (incomplete rows the user did not fill in).
 */
export function mapAllowedUomsToDto(
  rows: ItemUomDto[] | null | undefined,
): ItemUomDto[] {
  return (rows ?? [])
    .filter(r => !!r.uomId)
    .map(r => ({
      uomId:        r.uomId,
      code:         r.code  ?? "",
      name:         r.name  ?? "",
      toBaseFactor: r.toBaseFactor ?? 0,
      isBase:       Boolean(r.isBase),
      isPurchase:   Boolean(r.isPurchase),
      isIssue:      Boolean(r.isIssue),
      isRecipe:     Boolean(r.isRecipe),
      isConsume:    Boolean(r.isConsume),
      isCount:      r.isCount !== false, // default true
      isActive:     r.isActive !== false,
    }));
}