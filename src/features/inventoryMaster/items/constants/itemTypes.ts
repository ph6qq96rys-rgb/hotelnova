// src/features/inventory/items/constants/itemTypes.ts

export type ItemType =
  | "RawMaterial"
  | "Packaging"
  | "SemiFinished"
  | "FinishedGood"
  | "Service"
  | "NonStock"
  | "Ingredient"
  | "StockItem";

export interface ItemTypeOption {
  value: ItemType;
  label: string;
  help:  string;
}

export const ITEM_TYPES: ItemTypeOption[] = [
  { value: "RawMaterial",  label: "Raw Material",  help: "Consumed in production / recipes" },
  { value: "Ingredient",   label: "Ingredient",    help: "Used in recipes, not stocked separately" },
  { value: "Packaging",    label: "Packaging",     help: "Bottles, labels, cartons" },
  { value: "SemiFinished", label: "Semi-Finished", help: "Intermediate output used in further production" },
  { value: "FinishedGood", label: "Finished Good", help: "Sellable item / final product" },
  { value: "StockItem",    label: "Stock Item",    help: "Generic stocked item, not used in production" },
  { value: "NonStock",     label: "Non-Stock",     help: "Master record only, no FIFO tracking" },
  { value: "Service",      label: "Service",       help: "No physical stock, no FIFO" },
];

/** True for item types that carry physical inventory. */
export function isStockType(type: ItemType): boolean {
  return type !== "Service" && type !== "NonStock";
}

/** True for types that should not require a base UOM. */
export function isServiceLikeType(type: ItemType): boolean {
  return type === "Service" || type === "NonStock";
}

export function itemTypeLabel(type: ItemType): string {
  return ITEM_TYPES.find((t) => t.value === type)?.label ?? type;
}