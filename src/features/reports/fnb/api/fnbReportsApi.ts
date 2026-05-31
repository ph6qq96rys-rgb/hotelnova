import { http } from "../../../../api/http";

export type FnbReportKey =
  | "kitchen-consumption"
  | "bar-consumption"
  | "cogs"
  | "inventory-valuation"
  | "theoretical-vs-actual"
  | "variance"
  | "fast-moving-items"
  | "dead-stock"
  | "negative-inventory"
  | "fifo-aging"
  | "stock-turnover"
  | "production-yield";

export type FnbReportRow = {
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryName?: string | null;
  uomName?: string | null;
  locationId?: string | null;
  locationName?: string | null;

  qty: number;
  value: number;
  unitCost: number;

  openingQty: number;
  inQty: number;
  outQty: number;
  closingQty: number;

  theoreticalQty: number;
  actualQty: number;
  varianceQty: number;

  daysSinceLastMovement: number;
  bucket?: string | null;
};

export type FnbReportDto = {
  reportName: string;
  from: string;
  to: string;
  summary: {
    totalQty: number;
    totalValue: number;
    itemCount: number;
  };
  rows: FnbReportRow[];
};

export async function getFnbReport(params: {
  companyId: string;
  branchId: string;
  report: FnbReportKey;
  from: string;
  to: string;
  locationId?: string | null;
  itemId?: string | null;
  categoryId?: string | null;
  days?: number | null;
}) {
  const { companyId, branchId, report, ...query } = params;

  const res = await http.get<FnbReportDto>(
    `/companies/${companyId}/branches/${branchId}/reports/fnb/${report}`,
    { params: query }
  );

  return res.data;
}