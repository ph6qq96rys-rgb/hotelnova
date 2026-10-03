import { http } from "../../../../api/http";

export type FnbReportKey = string;

export type FnbReportFormat =
  | "text"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "datetime";

export type FnbReportCatalogItemDto = {
  key: string;
  name: string;
  category: string;
  supportsDateRange: boolean;
  supportsAsOfDate: boolean;
  supportsLocation: boolean;
  supportsItem: boolean;
  supportsCategory: boolean;
  supportsDays: boolean;
  supportsCostCenter?: boolean;
  description: string;
};

export type FnbReportCatalogDto = {
  reports: FnbReportCatalogItemDto[];
  timeZone: string;
  defaultDate: string;
};

export type FnbReportQuery = {
  companyId: string;
  branchId: string;
  reportKey: string;
  from: string;
  to: string;
  asOfDate?: string | null;
  locationId?: string | null;
  itemId?: string | null;
  categoryId?: string | null;
  costCenterId?: string | null;
  supplierId?: string | null;
  days?: number | null;
  consumptionType?: string | null;
};

export type FnbReportKpiDto = {
  key: string;
  label: string;
  value: string | number | null;
  format: FnbReportFormat;
};

export type FnbReportColumnDto = {
  key: string;
  label: string;
  format: FnbReportFormat;
  isDrillable?: boolean;
  isSortable?: boolean;
  isVisible?: boolean;
};

export type FnbReportRow = Record<string, unknown> & {
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  locationId?: string | null;
  consumptionType?: string;
};

export type FnbReportSummaryDto = {
  totalQty?: number | null;
  totalValue?: number | null;
  itemCount?: number | null;
};

export type FnbReportDto = {
  reportKey: string;
  reportName: string;
  generatedAtUtc: string;
  generatedBy?: string | null;
  from: string;
  to: string;
  asOfDate?: string | null;
  companyName?: string | null;
  branchName?: string | null;
  timeZone?: string | null;
  filterSummary?: string | null;
  currencyCode: string;
  costingMethod: string;
  periodStatus: string;
  methodology?: string | null;
  reconciliation?: {
    inventoryValue: number;
    ledgerValue: number;
    difference: number;
    isReconciled: boolean;
  } | null;
  kpis: FnbReportKpiDto[];
  columns: FnbReportColumnDto[];
  warnings: Array<{
    code: string;
    message: string;
    severity: string;
  }>;
  rows: FnbReportRow[];
  summary: FnbReportSummaryDto;
};

export type FnbReportDrilldownDto = {
  reportKey: string;
  generatedAtUtc?: string;
  itemId?: string | null;
  itemCode?: string | null;
  itemName?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  uomName?: string | null;
  ledger: Array<Record<string, unknown>>;
  summary: FnbReportSummaryDto;
  pagination: { page: number; pageSize: number; totalRows: number };
};

function reportParams(query: FnbReportQuery) {
  return {
    from: query.from || undefined,
    to: query.to || undefined,
    asOfDate: query.asOfDate || undefined,
    locationId: query.locationId || undefined,
    itemId: query.itemId || undefined,
    categoryId: query.categoryId || undefined,
    costCenterId: query.costCenterId || undefined,
    supplierId: query.supplierId || undefined,
    days: query.days ?? undefined,
    consumptionType: query.consumptionType || undefined,
  };
}

export async function getFnbReportCatalog(
  companyId: string,
  branchId: string,
  signal?: AbortSignal,
): Promise<FnbReportCatalogDto> {
  const res = await http.get<FnbReportCatalogDto>(
    `/companies/${companyId}/branches/${branchId}/reports/fnb/catalog`,
    { signal },
  );

  return res.data;
}

export async function getFnbReport(
  query: FnbReportQuery,
  signal?: AbortSignal,
): Promise<FnbReportDto> {
  const res = await http.get<FnbReportDto>(
    `/companies/${query.companyId}/branches/${query.branchId}/reports/fnb/${query.reportKey}`,
    {
      params: reportParams(query),
      signal,
    },
  );

  return res.data;
}

export async function getFnbReportDrilldown(
  query: FnbReportQuery & {
    sourceId?: string | null;
    sourceType?: string | null;
    bucket?: string | null;
    page?: number;
    pageSize?: number;
    uomName?: string | null;
  },
  signal?: AbortSignal,
): Promise<FnbReportDrilldownDto> {
  const res = await http.get<FnbReportDrilldownDto>(
    `/companies/${query.companyId}/branches/${query.branchId}/reports/fnb/${query.reportKey}/drilldown`,
    {
      params: {
        ...reportParams(query),
        sourceId: query.sourceId || undefined,
        sourceType: query.sourceType || undefined,
        bucket: query.bucket || undefined,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 100,
        uomName: query.uomName || undefined,
      },
      signal,
    },
  );

  return res.data;
}
