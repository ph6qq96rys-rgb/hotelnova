// src/features/production/api/lookups.ts
//
// Company-scoped lookups for inventory items and units of measure.
// These endpoints live on InventoryMasterController and are NOT branch-scoped.
// The _branchId parameter is kept for call-site compatibility but is not forwarded.

import { http } from "../../../api/http";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InventoryItemLite {
  id:            string;
  name:          string;
  isActive:      boolean;
  sku?:          string | null;
  code?:         string | null;
  itemType?:     string | null;
  baseUomId?:    string | null;
  baseUomName?:  string | null;
  uomId?:        string | null;
  uomName?:      string | null;
}

export interface UomLite {
  id:       string;
  code:     string;
  name?:    string | null;
  isActive: boolean;
}

// ── API ───────────────────────────────────────────────────────────────────────

export async function fetchInventoryItems(
  companyId: string,
  _branchId: string,
  q = ""
): Promise<InventoryItemLite[]> {
  const { data } = await http.get<InventoryItemLite[]>(
    `/companies/${companyId}/inventory-master/items`,
    { params: { q, activeOnly: true } }
  );
  return data;
}

export async function fetchUoms(companyId: string): Promise<UomLite[]> {
  const { data } = await http.get<UomLite[]>(
    `/companies/${companyId}/inventory-master/uoms`,
    { params: { activeOnly: true } }
  );
  return data;
}