// src/features/inventory/items/api/inventoryItemsApi.ts
//
// Single canonical API client for inventory item master data.
// Replaces the parallel itemsApi.ts — that file is removed.
// Base path: /companies/{companyId}/inventory-master

import { http } from "../../../../api/http";
import type {
  InventoryCatalogs,
  InventoryItemDto,
  CategoryDto,
  UomDto,
  ItemUomDto,
} from "../types";

// ── Request types ─────────────────────────────────────────────────────────────

export interface CreateItemBody {
  companyId:      string;
  name:           string;
  localName:      string | null;
  sku:            string | null;
  barcode:        string | null;
  categoryId:     string | null;
  baseUomId:      string;
  type:           string;
  allowedUoms:    ItemUomDto[];
  trackInventory: boolean;
  defaultCost:    number | null;
  defaultPrice:   number | null;
  reorderLevel:   number;
  isActive:       true;
}

export interface UpdateItemBody extends Omit<CreateItemBody, "isActive"> {
  id:       string;
  isActive: boolean;
}

export interface CreateUomBody {
  name:   string;
  symbol: string | null;
  isBase: boolean;
}

export interface CreateCategoryBody {
  name:         string;
  description?: string | null;
}

// ── URL factory ───────────────────────────────────────────────────────────────

function masterUrl(companyId: string, path = ""): string {
  return `/companies/${companyId}/inventory-master${path}`;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const inventoryItemsApi = {
  // ── Catalogs ───────────────────────────────────────────────────────────────

  /** Load all reference data (categories, UOMs, costing methods) in one call. */
  loadCatalogs(companyId: string): Promise<InventoryCatalogs> {
    return http
      .get<InventoryCatalogs>(masterUrl(companyId, "/catalogs"), { params: { activeOnly: true } })
      .then((r) => r.data);
  },

  // ── Items ──────────────────────────────────────────────────────────────────

  list(companyId: string, q?: string): Promise<InventoryItemDto[]> {
    return http
      .get<InventoryItemDto[]>(masterUrl(companyId, "/items"), { params: q ? { q } : undefined })
      .then((r) => r.data);
  },

  get(companyId: string, id: string): Promise<InventoryItemDto> {
    return http
      .get<InventoryItemDto>(masterUrl(companyId, `/items/${id}`))
      .then((r) => r.data);
  },

  create(companyId: string, body: CreateItemBody): Promise<{ id: string }> {
    return http
      .post<{ id: string }>(masterUrl(companyId, "/items"), body)
      .then((r) => r.data);
  },

  update(companyId: string, id: string, body: UpdateItemBody): Promise<void> {
    return http
      .put<void>(masterUrl(companyId, `/items/${id}`), body)
      .then(() => undefined);
  },

  setActive(companyId: string, id: string, isActive: boolean): Promise<void> {
    return http
      .patch<void>(masterUrl(companyId, `/items/${id}/active`), { isActive })
      .then(() => undefined);
  },

  // ── Categories ─────────────────────────────────────────────────────────────

  getCategories(companyId: string): Promise<CategoryDto[]> {
    return http
      .get<CategoryDto[]>(masterUrl(companyId, "/categories"))
      .then((r) => r.data);
  },

  createCategory(companyId: string, body: CreateCategoryBody): Promise<{ id: string }> {
    return http
      .post<{ id: string }>(masterUrl(companyId, "/categories"), body)
      .then((r) => r.data);
  },

  // ── UOMs ───────────────────────────────────────────────────────────────────

  getUoms(companyId: string): Promise<UomDto[]> {
    return http
      .get<UomDto[]>(masterUrl(companyId, "/uoms"))
      .then((r) => r.data);
  },

  createUom(companyId: string, body: CreateUomBody): Promise<{ id: string }> {
    return http
      .post<{ id: string }>(masterUrl(companyId, "/uoms"), body)
      .then((r) => r.data);
  },

  getUomConversionFactor(
    companyId: string,
    baseUomId: string,
    uomId:     string
  ): Promise<{ toBaseFactor: number } | null> {
    return http
      .get<{ toBaseFactor: number } | null>(masterUrl(companyId, "/uom-conversions"), {
        params: { baseUomId, uomId },
      })
      .then((r) => r.data);
  },
};