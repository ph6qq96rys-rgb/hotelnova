import type { ItemType } from "./constants/itemTypes";

/* =========================
   Catalog / Lookup DTOs
   ========================= */

export type CategoryDto = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean | null;
};

export type UomDto = {
  id: string;
  name: string;
  symbol?: string | null; // ✅ optional so other module's UomDto[] is assignable
  code?: string | null;   // ✅ optional (helps your conversions grid too)
  isBase?: boolean;
  isActive?: boolean | null;
};

export type ItemTypeCatalogDto = {
   code: ItemType;
   name: string;
};
export type ItemDto = {
  Id: string;
  name: string;
};
export type CostingMethodDto = {
  code: string;
  name: string;
};

export interface InventoryCatalogs {
  itemTypes: ItemTypeCatalogDto[];
  categories: { id: string; name: string }[];
  uoms: { id: string; code: string; name: string }[];
  costingMethods: CostingMethodDto[];
}

export type ItemUomDto = {
  uomId: string;
  code: string;
  name: string;
  toBaseFactor: number;
  isBase: boolean;
  isIssue: boolean;
  isActive: boolean;
};

export type CreateInventoryItemRequest = {
  name: string| null;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  baseUomId: string;
  type: ItemType;
  allowedUoms: ItemUomDto[] | null;
  trackInventory: boolean;
  defaultCost: number | null;
  defaultPrice: number | null;
  isActive: boolean | null;
  reorderLevel:number;
  
};

export type CreateInventoryItemResponse = {
  id: string;
};
export type Guid = string;

export type InventorySearchItemDto = {
  id: Guid;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  baseUomId?: Guid | null;
  baseUomCode?: string | null;
  isActive?: boolean;
};

export type InventoryItemDto = {
  id: string;
  companyId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  baseUomId: string;
  issueUomId: string | null;
  type: ItemType;
  allowedUoms: ItemUomDto[]; // when reading, usually normalized to [] instead of null
  trackInventory: boolean;
  costingMethod:string|null;
  defaultCost: number | null;
  defaultPrice: number | null;
  isActive: boolean;
};

/**
 * If your update endpoint uses the same payload as create, keep this.
 * Otherwise define a proper UpdateInventoryItemRequest separately.
 */
export type UpdateInventoryItemRequest = Omit<CreateInventoryItemRequest, "id" | "companyId"> & {
  // if id is in route for update, omit it from payload
  // if companyId is in route, omit it too
};

/* =========================
   List / View Models (UI)
   ========================= */

export interface ItemListDto {
  id: string;
  name: string;
  type: ItemType;
  category: string;
  baseUom: string;
  active: boolean;
}

export interface ItemDetailsDto extends ItemListDto {
  description?: string;
  trackStock: boolean;
  costingMethod?: string;
}

/* =========================
   Helpers
   ========================= */

export function mapAllowedUomsToDto(rows: ItemUomDto[] | null | undefined): ItemUomDto[] {
  const safe = rows ?? [];
  return safe.map((r) => ({
    uomId: r.uomId,
    code: r.code,
    name: r.name,
    toBaseFactor: r.toBaseFactor ?? null,
    isBase: !!r.isBase,
    isIssue: !!r.isIssue,
    isActive: r.isActive !== false,
  }));
}
