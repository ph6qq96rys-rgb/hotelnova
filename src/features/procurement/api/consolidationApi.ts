import { http } from "../../../api/http";
export type BranchRequirement = {
  requisitionId: string; requisitionNo: string; branchId: string; branchName?: string;
  suggestedSupplierId?: string; locationId?: string; requiredByDateUtc: string;
  lineId: string; inventoryItemId?: string; itemName: string; uomId?: string;
  uomName: string; quantity: number; estimatedUnitPrice: number;
};
export type ReceivingDestination = { branchId: string; branchName: string; locationId: string; locationName: string; isMainWarehouse: boolean };
export type ConsolidationRequest = {
  clientRequestId: string; supplierId: string; mode: "Direct" | "Central";
  centralBranchId: string | null; centralLocationId: string | null;
  expectedDate: string; reason: string;
  lines: { requisitionLineId: string; quantity: number; unitPrice: number | null; supplierId: string }[];
};
export type ConsolidatedOrder = { id: string; poNo: string };
const base = (company: string) => `/companies/${company}/procurement/consolidation`;
export const consolidationApi = {
  requirements: async (company: string) => (await http.get<BranchRequirement[]>(`${base(company)}/requirements`)).data,
  destinations: async (company: string) => (await http.get<ReceivingDestination[]>(`${base(company)}/destinations`)).data,
  create: async (company: string, body: ConsolidationRequest) => (await http.post<ConsolidatedOrder[]>(base(company), body)).data,
};
// Never combine unlike units or unrelated free-text/service lines.
export function requirementGroupKey(row: BranchRequirement): string {
  return row.inventoryItemId && row.uomId ? `${row.inventoryItemId}:${row.uomId}` : row.lineId;
}
