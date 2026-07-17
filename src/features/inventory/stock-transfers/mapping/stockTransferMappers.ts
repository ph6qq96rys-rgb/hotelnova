// src/features/inventory/stockTransfers/mapping/stockTransferMappers.ts

import type {
  BranchOptionDto,
  ItemOptionDto,
  StockLocationDto,
} from "../types";
import type { ItemLookupDto, UomLookupDto } from "../api/stockTransfersApi";
import { clean } from "../utils/apiUtils";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

export type NormalizedStockLocation = StockLocationDto & {
  /**
   * Real StockLocation.Id expected by transfer APIs.
   * This must not be BranchStockLocation.Id.
   */
  stockLocationId: string;

  /**
   * BranchStockLocation assignment id, when present.
   */
  branchStockLocationId?: string | null;

  label: string;
  canTransferFrom: boolean;
  canTransferTo: boolean;
  canAdjust: boolean;
};

export type NormalizedItemOption = ItemOptionDto & {
  itemId: string;
  label: string;
};

export type NormalizedUomOption = {
  id: string;
  code?: string | null;
  name?: string | null;
  label: string;
};

export function normalizeBranch(row: any): BranchOptionDto {
  const id = clean(row.id ?? row.branchId);
  const code = clean(row.code ?? row.branchCode);
  const name = clean(row.name ?? row.branchName);

  return {
    id,
    code: code || null,
    name,
    label: clean(row.label) || `${code} ${name}`.trim() || "Branch",
  };
}

export function normalizeLocation(row: any): NormalizedStockLocation | null {
  const stockLocationId = clean(
    row.stockLocationId ??
      row.locationId ??
      row.stockLocation?.id ??
      row.location?.id ??
      row.id
  );

  if (!stockLocationId) return null;

  const branchStockLocationId = clean(
    row.branchStockLocationId ??
      row.branchLocationId ??
      row.branchLocation?.id ??
      row.id
  );

  const code = clean(
    row.code ??
      row.stockLocationCode ??
      row.locationCode ??
      row.stockLocation?.code ??
      row.location?.code
  );

  const name = clean(
    row.name ??
      row.stockLocationName ??
      row.locationName ??
      row.stockLocation?.name ??
      row.location?.name
  );

  const isActive =
    row.isActive !== false &&
    row.active !== false &&
    row.stockLocation?.isActive !== false &&
    row.location?.isActive !== false;

  const canTransferFrom = Boolean(
    row.canTransferFrom ??
      row.CanTransferFrom ??
      row.canRequestFrom ??
      row.CanRequestFrom ??
      row.canIssue
  );

  const canTransferTo = Boolean(
    row.canTransferTo ??
      row.CanTransferTo ??
      row.canReceiveTo ??
      row.CanReceiveTo ??
      row.canReceive
  );

  const canAdjust = Boolean(
    row.canAdjust ??
      row.CanAdjust ??
      row.stockLocation?.canAdjust ??
      row.location?.canAdjust
  );

  return {
    ...(row as StockLocationDto),
    id: stockLocationId,
    stockLocationId,
    branchStockLocationId: branchStockLocationId || null,
    code: code || null,
    name: name || "Stock location",
    isActive,
    label: code ? `${code} — ${name || "Stock location"}` : name || "Stock location",
    canTransferFrom,
    canTransferTo,
    canAdjust,
  };
}

export function normalizeItem(row: any): NormalizedItemOption | null {
  const itemId = clean(row.id ?? row.itemId ?? row.inventoryItemId);
  if (!itemId) return null;

  const code = clean(row.code ?? row.sku ?? row.itemCode);
  const name = clean(row.name ?? row.itemName);
  const baseUomId = clean(row.defaultUomId ?? row.baseUomId ?? row.uomId ?? row.unitId);

  const baseUom =
    row.baseUom ??
    (baseUomId
      ? {
          id: baseUomId,
          code: clean(row.baseUomCode ?? row.uomCode ?? row.unitCode),
          name: clean(
            row.baseUomName ??
              row.uomName ??
              row.unitName ??
              row.baseUomCode ??
              row.uomCode ??
              row.unitCode
          ),
        }
      : null);

  return {
    ...(row as ItemOptionDto),
    id: itemId,
    itemId,
    code,
    name,
    label: clean(row.label) || `${code} ${name}`.trim() || "Item",
    defaultUomId: baseUomId || null,
    baseUom,
  };
}

export function normalizeItemLookup(row: any): ItemLookupDto | null {
  const id = clean(row.id ?? row.itemId ?? row.inventoryItemId);
  if (!id) return null;

  return {
    id,
    code: clean(row.code ?? row.itemCode) || null,
    sku: clean(row.sku) || null,
    name: clean(row.name ?? row.itemName) || null,
    label:
      clean(row.label) ||
      `${clean(row.code ?? row.sku ?? row.itemCode)} ${clean(row.name ?? row.itemName)}`.trim() ||
      null,
    defaultUomId: clean(row.defaultUomId) || null,
    baseUomId: clean(row.baseUomId ?? row.uomId ?? row.unitId) || null,
    uoms: Array.isArray(row.uoms)
      ? row.uoms
      : Array.isArray(row.itemUoms)
        ? row.itemUoms
        : Array.isArray(row.allowedUoms)
          ? row.allowedUoms
          : [],
  };
}

export function normalizeUom(row: any): NormalizedUomOption | null {
  const id = clean(row.id ?? row.uomId ?? row.unitId);
  if (!id) return null;

  const code = clean(row.code ?? row.uomCode ?? row.unitCode);
  const name = clean(row.name ?? row.uomName ?? row.unitName);

  return {
    id,
    code: code || null,
    name: name || null,
    label: name || code || "UOM",
  };
}

export function toSelectOptions<T extends { id?: string; label?: string; name?: string; code?: string | null }>(
  rows: T[]
): SelectOption[] {
  return rows
    .map((row) => ({
      value: clean(row.id),
      label: clean(row.label) || clean(row.code) || clean(row.name) || "Option",
    }))
    .filter((option) => Boolean(option.value));
}
