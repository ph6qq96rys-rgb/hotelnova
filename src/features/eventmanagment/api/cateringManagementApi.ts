// src/features/eventmanagment/api/cateringManagementApi.ts
//
// Catering event list and KPI dashboard. Event-scoped operations live in eventStockApi.ts and the
// sales workbench (salesApi.ts); the quotation-scoped operational endpoints were retired (410 Gone).

import { http } from "../../../api/http";

function cateringBase(companyId: string): string {
  return `/companies/${companyId}/catering`;
}

function withBranch(params?: { branchId?: string | null }) {
  return params?.branchId ? { branchId: params.branchId } : undefined;
}

export type CateringEventDto = {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  inquiryId: string;
  inquiryNo: string;
  customerId: string;
  customerName: string;
  acceptedQuotationId: string;
  eventNo: string;
  status: string | number;
  eventType: string | number;
  serviceStyle: string | number;
  eventDateUtc: string;
  venueName: string;
  venueAddress?: string | null;
  guestCount: number;
  packageNameSnapshot?: string | null;
  quoteNoSnapshot: string;
  contractValue: number;
  requiredDepositAmount: number;
  depositReceivedAmount: number;
  paymentReceivedAmount: number;
  remainingBalance: number;
  confirmedAtUtc: string;
  notes?: string | null;
  refundAmount?: number;
  additionalChargesAmount?: number;
  payments: Array<{
    id: string;
    amount: number;
    receivedAtUtc: string;
    referenceNo?: string | null;
    notes?: string | null;
  }>;
};

export type CateringKpiMetricDto = {
  key: string;
  label: string;
  value: number;
  unit: "money" | "percent" | "count" | string;
  helpText?: string | null;
};
export type CateringKpiPackageDto = {
  packageName: string;
  eventCount: number;
  guestCount: number;
  revenue: number;
  averageRevenuePerEvent: number;
};
export type CateringKpiEventDto = {
  eventId: string;
  eventNo: string;
  eventType: string;
  eventDateUtc: string;
  venueName: string;
  packageName?: string | null;
  guestCount: number;
  revenue: number;
  contributionMargin: number;
  contributionMarginPercent: number;
};
export type CateringKpiDashboardDto = {
  generatedAtUtc: string;
  fromUtc: string;
  toUtc: string;
  companyId: string;
  branchId?: string | null;
  currencyCode: string;
  metrics: CateringKpiMetricDto[];
  topPackages: CateringKpiPackageDto[];
  mostProfitableEvents: CateringKpiEventDto[];
};

/** Catering KPIs (GET /catering/dashboard/kpis, permission catering.dashboard.view). */
export async function getCateringKpis(
  companyId: string,
  params?: { branchId?: string | null; fromUtc?: string; toUtc?: string; signal?: AbortSignal },
): Promise<CateringKpiDashboardDto> {
  const { data } = await http.get<CateringKpiDashboardDto>(`${cateringBase(companyId)}/dashboard/kpis`, {
    params: { ...withBranch(params), fromUtc: params?.fromUtc, toUtc: params?.toUtc },
    signal: params?.signal,
  });
  return data;
}

export async function listCateringEvents(
  companyId: string,
  params?: { branchId?: string | null; status?: string | number | null; signal?: AbortSignal },
): Promise<CateringEventDto[]> {
  const { data } = await http.get<CateringEventDto[]>(`${cateringBase(companyId)}/events`, {
    params: { branchId: params?.branchId || undefined, status: params?.status ?? undefined },
    signal: params?.signal,
  });
  return data;
}
