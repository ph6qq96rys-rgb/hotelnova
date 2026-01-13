import type { ItemType } from "./constants/itemTypes";

export type InventoryItemDto = {
  id: string;
  companyId: string;

  name: string;
  sku?: string | null;

  categoryId?: string | null;
  baseUomId: string;
  issueUomId?: string | null;

  itemType: ItemType;

  trackInventory: boolean;
  isActive: boolean;
};

export type CreateInventoryItemDto = {
  name: string;
  sku?: string | null;

  categoryId?: string | null;
  baseUomId: string;
  issueUomId?: string | null;

  itemType: ItemType;

  trackInventory: boolean;
};

export type UpdateInventoryItemDto = CreateInventoryItemDto & {
  isActive: boolean;
};

export type ItemDto = {
  id: string;
  name: string;
  sku?: string | null;

  uomId: string;
  categoryId?: string | null;
  itemTypeId?: string | null;

  defaultCost?: number | null;
  defaultPrice?: number | null;
  isActive?: boolean;
};
export type ItemUomDto = {
  uomId: string;
  code: string;
  name: string;
  conversionFactorToBase?: number | null;
  isBase?: boolean;
  isIssue?: boolean;
  isActive?: boolean;
};
export type CategoryDto = {
  id: string;
  name: string;
  description?: string | null;
  isActive?:boolean|null;
};

export type UomDto = {
  id: string;
  name: string;
  symbol?: string | null;
  isBase?: boolean;
};

export type ItemTypeDto = {
  id: string;
  name: string;
  description?: string | null;
};


export interface InventoryCatalogs {
  itemTypes: { code: ItemType; name: string }[];
  categories: { id: string; name: string }[];
  uoms: { id: string; code: string; name: string }[];
  costingMethods: { code: string; name: string }[];
}

export interface ItemListDto {
  id: string;
  name: string;
  type: ItemType;
  category: string;
  baseUom: string;
  active: boolean;
}

export interface ItemDesDto extends ItemListDto {
  description?: string;
  trackStock: boolean;
  costingMethod?: string;
}

export interface CreateItemRequest {
  companyId: string;
  name: string;
  type: ItemType;
  categoryId: string;
  baseUomId: string;
  allowedUoms: { uomId: string; 
  toBaseFactor: number }[];
  trackStock: boolean;
  costingMethod?: string;
}

export type UpdateItemRequest = CreateItemRequest;
