export type ItemType =
  | "RawMaterial"
  | "Packaging"
  | "SemiFinished"
  | "FinishedGood"
  | "Service"
  | "NonStock"
  |"Ingredient" 
  | "StockItem";

export const ITEM_TYPES: { value: ItemType; label: string; help: string }[] = [
  { value: "RawMaterial",  label: "Raw Material",  help: "Consumed in production / recipes" },
  { value: "Packaging",    label: "Packaging",     help: "Bottles, labels, cartons" },
  { value: "SemiFinished", label: "Semi-Finished", help: "Intermediate output used later" },
  { value: "FinishedGood", label: "Finished Good", help: "Sellable item / final product" },
  { value: "Service",      label: "Service",       help: "No stock, no FIFO" },
  { value: "NonStock",     label: "Non-Stock",     help: "Master only, no FIFO" },
];
export function itemTypeLabel(type: ItemType): string {
  return ITEM_TYPES.find(t => t.value === type)?.label ?? "—";
}