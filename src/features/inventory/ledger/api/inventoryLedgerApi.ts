import { http } from "../../../../api/http";
import type { InventoryLedgerDto, PagedResult } from "../types";

export type InventoryLedgerMovementType =
  | "GRN"
  | "SALE_COGS"
  | "SIV_TRANSFER_OUT"
  | "SIV_TRANSFER_IN"
  | "STOCK_TRANSFER_OUT"
  | "STOCK_TRANSFER_IN"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "PRODUCTION_INPUT"
  | "PRODUCTION_OUTPUT"
  | string;

export type InventoryLedgerQuery = {
  fromUtc?: string | null;
  toUtc?: string | null;
  itemId?: string | null;
  locationId?: string | null;
  item?: string | null;
  location?: string | null;
  referenceNo?: string | null;
  movementType?: InventoryLedgerMovementType | null;
  batchNo?: string | null;
  page?: number;
  pageSize?: number;
};

type QueryValue = string | number | boolean | null | undefined;

function clean(params: Record<string, QueryValue>) {
  const output: Record<string, QueryValue> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    output[key] = typeof value === "string" ? value.trim() : value;
  }
  return output;
}

export const inventoryLedgerApi = {
  list: async (
    companyId: string,
    branchId: string,
    query: InventoryLedgerQuery,
    signal?: AbortSignal,
  ): Promise<PagedResult<InventoryLedgerDto>> => {
    if (!companyId.trim()) throw new Error("Company is required.");
    if (!branchId.trim()) throw new Error("Branch is required.");

    const response = await http.get<PagedResult<InventoryLedgerDto>>(
      `/companies/${companyId}/branches/${branchId}/inventory-ledger`,
      {
        params: clean({
          ...query,
          page: query.page ?? 1,
          pageSize: query.pageSize ?? 50,
        }),
        signal,
      },
    );

    return response.data;
  },
};
