import {http}from "../../../api/http";

export type InventoryItemLite = { id: string; name: string; isActive: boolean };
export type UomLite = { id: string; code: string; name?: string | null; isActive: boolean };

export async function fetchInventoryItems(companyId: string, q = "") {
  const r = await http.get<InventoryItemLite[]>(`/companies/${companyId}/inventory/items`, { params: { q, activeOnly: true } });
  return r.data;
}
export async function fetchUoms(companyId: string) {
  const r = await http.get<UomLite[]>(`/companies/${companyId}/uoms`, { params: { activeOnly: true } });
  return r.data;
}
