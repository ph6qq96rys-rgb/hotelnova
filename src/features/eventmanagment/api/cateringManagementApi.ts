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

// ── Workflow: enquiry → quotation → deposit → planning → delivery → close-out ──────────────────────

export type CateringWorkflowStageKey = "enquiry" | "quotation" | "deposit" | "planning" | "delivery" | "closeout";
/** Event-workspace tab a step is done on. */
export type CateringWorkflowTab = "overview" | "logistics" | "kitchen" | "stock" | "billing" | "close";

export type CateringWorkflowStage = { key: string; label: string; state: "done" | "current" | "upcoming" | "cancelled" };

export type CateringWorkflowStep = {
  key: string;
  stage: string;
  label: string;
  /** done, todo (required and open), optional, or missed (no longer needed). */
  state: "done" | "todo" | "optional" | "missed";
  required: boolean;
  detail?: string | null;
  tab?: CateringWorkflowTab | null;
  action?: string | null;
};

export type CateringEventJourney = {
  eventId: string;
  eventNo: string;
  status: string;
  /** A stage key, or "done" / "cancelled". */
  stage: string;
  stages: CateringWorkflowStage[];
  steps: CateringWorkflowStep[];
  next?: CateringWorkflowStep | null;
  alerts: string[];
};

export type CateringWorkflowCard = {
  kind: "inquiry" | "quotation" | "event";
  id: string;
  branchId: string;
  reference: string;
  customer: string;
  eventDateUtc?: string | null;
  guests: number;
  value: number;
  status: string;
  stage: CateringWorkflowStageKey;
  nextAction: string;
  nextTab?: CateringWorkflowTab | null;
  doneSteps: number;
  totalSteps: number;
  alerts: string[];
};

export type CateringWorkflowBoard = { stages: CateringWorkflowStage[]; cards: CateringWorkflowCard[]; page: number; pageSize: number; totalCount: number };

export async function getCateringWorkflowBoard(
  companyId: string,
  params?: { branchId?: string | null; signal?: AbortSignal; page?: number; pageSize?: number; search?: string },
): Promise<CateringWorkflowBoard> {
  const response = await http.get<CateringWorkflowBoard>(`${cateringBase(companyId)}/workflow`, {
    params: { ...withBranch(params), page: params?.page, pageSize: params?.pageSize, search: params?.search },
    signal: params?.signal,
  });
  return response.data;
}

export async function getCateringEventJourney(companyId: string, eventId: string, signal?: AbortSignal): Promise<CateringEventJourney> {
  const response = await http.get<CateringEventJourney>(`${cateringBase(companyId)}/workflow/events/${encodeURIComponent(eventId)}`, { signal });
  return response.data;
}

/** The event-workspace page (sidebar mode) that owns each tab. */
export const WORKFLOW_TAB_MODE: Record<CateringWorkflowTab, "event" | "kitchen" | "inventory" | "finance"> = {
  overview: "event",
  logistics: "event",
  close: "event",
  kitchen: "kitchen",
  stock: "inventory",
  billing: "finance",
};

/** Link to the place where a workflow step is done. */
export function workflowStepTarget(eventId: string, tab?: CateringWorkflowTab | null): string {
  const t = tab ?? "overview";
  return `${WORKFLOW_TAB_MODE[t]}?event=${encodeURIComponent(eventId)}&tab=${t}`;
}
