import { http } from "../../../../api/http";

/** A replenishment rule. Null parameters inherit from a broader rule (or the request default). */
export interface ReplenishmentRuleDto {
  id: string;
  branchId: string | null;
  branchName: string | null;
  stockLocationId: string | null;
  stockLocationName: string | null;
  inventoryItemId: string | null;
  itemName: string | null;
  itemCode: string | null;
  baseUomCode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  /** e.g. "Item · Location" */
  scope: string;
  coverageDays: number | null;
  leadTimeDays: number | null;
  safetyStockQty: number | null;
  safetyStockDays: number | null;
  minStockQty: number | null;
  maxStockQty: number | null;
  excluded: boolean | null;
  notes: string | null;
  isActive: boolean;
  version: number;
  updatedAtUtc: string | null;
}

export interface ReplenishmentRuleInput {
  branchId?: string | null;
  stockLocationId?: string | null;
  inventoryItemId?: string | null;
  categoryId?: string | null;
  coverageDays?: number | null;
  leadTimeDays?: number | null;
  safetyStockQty?: number | null;
  safetyStockDays?: number | null;
  minStockQty?: number | null;
  maxStockQty?: number | null;
  excluded?: boolean | null;
  notes?: string | null;
  version?: number | null;
}

const base = (companyId: string) =>
  `/companies/${encodeURIComponent(companyId)}/inventory/replenishment-rules`;

function unwrap<T>(response: unknown): T {
  return (((response as { data?: unknown })?.data ?? response) as T);
}

async function list(
  companyId: string,
  params: { branchId?: string; includeInactive?: boolean } = {},
): Promise<ReplenishmentRuleDto[]> {
  const response = await http.get<ReplenishmentRuleDto[]>(base(companyId), {
    params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")),
  });
  const data = unwrap<ReplenishmentRuleDto[]>(response);
  return Array.isArray(data) ? data : [];
}

async function create(companyId: string, input: ReplenishmentRuleInput): Promise<ReplenishmentRuleDto> {
  return unwrap<ReplenishmentRuleDto>(await http.post<ReplenishmentRuleDto>(base(companyId), input));
}

async function update(companyId: string, ruleId: string, input: ReplenishmentRuleInput): Promise<ReplenishmentRuleDto> {
  return unwrap<ReplenishmentRuleDto>(
    await http.put<ReplenishmentRuleDto>(`${base(companyId)}/${encodeURIComponent(ruleId)}`, input),
  );
}

async function deactivate(companyId: string, ruleId: string, version: number): Promise<ReplenishmentRuleDto> {
  return unwrap<ReplenishmentRuleDto>(
    await http.post<ReplenishmentRuleDto>(`${base(companyId)}/${encodeURIComponent(ruleId)}/deactivate`, null, {
      params: { version },
    }),
  );
}

export const replenishmentRulesApi = { list, create, update, deactivate };
