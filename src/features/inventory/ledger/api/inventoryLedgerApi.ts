import { http } from "../../../../api/http";
import type { PagedResult, InventoryLedgerDto } from "../types";

export type InventoryLedgerQuery = {
  fromUtc?: string;                 // ISO string recommended
  toUtc?: string;                   // ISO string recommended
  itemId?: string | null;
  locationId?: string | null;
  item?: string;
  location?: string;
  referenceNo?: string;
  page?: number;
  pageSize?: number;
};

function clean(params: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

export const inventoryLedgerApi = {
  list: async (
    companyId: string,
    query: InventoryLedgerQuery
  ): Promise<PagedResult<InventoryLedgerDto>> => {
    const params = clean({
      ...query,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 50,
    });

    const res = await http.get<PagedResult<InventoryLedgerDto>>(
      `/companies/${companyId}/inventory/ledger`,
      { params }
    );

    return res.data;
  },
};
