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

export type InventoryLedgerSummaryRowDto = {
  itemName: string;
  locationName: string;
  baseUom: string;
  onHandBase: number;
  avgCost?: number | null;
  stockValue?: number | null;
};

export type InventoryValuationReportDto = {
  companyId: string;
  branchId: string;
  locationId?: string | null;
  itemId?: string | null;
  asOfUtc?: string | null;
  totalOnHandBase: number;
  totalFifoValue: number;
  totalLedgerValue: number;
  totalStockBalanceValue: number;
  outOfBalanceCount: number;
  rows: InventoryValuationRowDto[];
};

export type InventoryValuationRowDto = {
  locationId: string;
  locationName: string;
  itemId: string;
  itemName: string;
  baseUom: string;
  onHandBase: number;
  reservedBase: number;
  availableBase: number;
  fifoValue: number;
  averageFifoCost: number;
  ledgerQty: number;
  ledgerValue: number;
  stockBalanceQty: number;
  stockBalanceValue: number;
  qtyDifferenceLedgerVsFifo: number;
  qtyDifferenceBalanceVsFifo: number;
  valueDifferenceLedgerVsFifo: number;
  valueDifferenceBalanceVsFifo: number;
  activeLotCount: number;
  oldestReceiptAtUtc?: string | null;
  earliestExpiryUtc?: string | null;
  lastMovementAtUtc?: string | null;
  isBalanced: boolean;
};

export type InventoryReconciliationResultDto = {
  isBalanced: boolean;
  companyId: string;
  branchId: string;
  locationId?: string | null;
  itemId?: string | null;
  ledgerQty: number;
  fifoQty: number;
  stockBalanceQty: number;
  ledgerValue: number;
  fifoValue: number;
  stockBalanceValue: number;
  qtyDifferenceLedgerVsFifo: number;
  qtyDifferenceLedgerVsBalance: number;
  valueDifferenceLedgerVsFifo: number;
  valueDifferenceLedgerVsBalance: number;
  warnings: string[];
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

function assertScope(companyId: string, branchId: string) {
  if (!companyId.trim()) throw new Error("Company is required.");
  if (!branchId.trim()) throw new Error("Branch is required.");
}

export const inventoryLedgerApi = {
  list: async (
    companyId: string,
    branchId: string,
    query: InventoryLedgerQuery,
    signal?: AbortSignal,
  ): Promise<PagedResult<InventoryLedgerDto>> => {
    assertScope(companyId, branchId);

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

  summary: async (
    companyId: string,
    branchId: string,
    query: Pick<InventoryLedgerQuery, "locationId" | "item"> = {},
    signal?: AbortSignal,
  ): Promise<InventoryLedgerSummaryRowDto[]> => {
    assertScope(companyId, branchId);

    const response = await http.get<InventoryLedgerSummaryRowDto[]>(
      `/companies/${companyId}/branches/${branchId}/inventory-ledger/summary`,
      { params: clean(query), signal },
    );

    return response.data;
  },

  valuation: async (
    companyId: string,
    branchId: string,
    query: { locationId?: string | null; itemId?: string | null; asOfUtc?: string | null } = {},
    signal?: AbortSignal,
  ): Promise<InventoryValuationReportDto> => {
    assertScope(companyId, branchId);

    const response = await http.get<InventoryValuationReportDto>(
      `/companies/${companyId}/branches/${branchId}/inventory-ledger/valuation`,
      { params: clean(query), signal },
    );

    return response.data;
  },

  reconciliation: async (
    companyId: string,
    branchId: string,
    query: { locationId?: string | null; itemId?: string | null } = {},
    signal?: AbortSignal,
  ): Promise<InventoryReconciliationResultDto> => {
    assertScope(companyId, branchId);

    const response = await http.get<InventoryReconciliationResultDto>(
      `/companies/${companyId}/branches/${branchId}/inventory-ledger/reconciliation`,
      { params: clean(query), signal },
    );

    return response.data;
  },
};
