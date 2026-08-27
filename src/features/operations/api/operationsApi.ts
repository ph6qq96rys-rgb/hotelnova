import { http } from "../../../api/http";
import type { BackOfficeEfficiencySnapshotDto, CashierShiftDto, DailyOperationPlanDto, EndOfDayReportDto, Guid, OperationsPosStoreDto, SafeDropDto, SalesSummaryDto, UpsertDailyOperationPlanDto, WorkflowReasonCodeDto } from "./operationsTypes";

const base = (companyId: Guid, branchId: Guid) =>
  `/api/companies/${companyId}/branches/${branchId}/operations`;

export const operationsApi = {
  stores(companyId: Guid, branchId: Guid) {
    return http.get<OperationsPosStoreDto[]>(`/api/companies/${companyId}/branches/${branchId}/stores`, {
      params: { page: 1, pageSize: 500, activeOnly: true },
    });
  },

  workflowReasons(companyId: Guid, transactionType: string, workflowAction: string, workflowStage?: string | null) {
    return http.get<WorkflowReasonCodeDto[]>(`/api/companies/${companyId}/workflow/reasons/applicable`, {
      params: { transactionType, workflowAction, workflowStage },
    });
  },

  currentOpenShift(companyId: Guid, branchId: Guid) {
    return http.get<CashierShiftDto | null>(`${base(companyId, branchId)}/cashier-shifts/open`);
  },

  openShift(companyId: Guid, branchId: Guid, payload: { storeId?: Guid | null; cashierName: string; terminal: string; openingFloat: number }) {
    return http.post<CashierShiftDto>(`${base(companyId, branchId)}/cashier-shifts/open`, payload);
  },

  closeShift(companyId: Guid, branchId: Guid, shiftId: Guid, payload: { closingCash: number; notes?: string }) {
    return http.post<CashierShiftDto>(`${base(companyId, branchId)}/cashier-shifts/${shiftId}/close`, payload);
  },

  safeDrops(companyId: Guid, branchId: Guid, shiftId?: Guid) {
    const q = new URLSearchParams();
    if (shiftId) q.set("shiftId", shiftId);
    return http.get<SafeDropDto[]>(`${base(companyId, branchId)}/safe-drops?${q}`);
  },

  createSafeDrop(companyId: Guid, branchId: Guid, payload: { cashierShiftId: Guid; amount: number; method: string; referenceNo?: string; notes?: string }) {
    return http.post<SafeDropDto>(`${base(companyId, branchId)}/safe-drops`, payload);
  },

  salesSummary(companyId: Guid, branchId: Guid, fromUtc: string, toUtc: string) {
    const q = new URLSearchParams({ fromUtc, toUtc });
    return http.get<SalesSummaryDto>(`${base(companyId, branchId)}/sales-summary?${q}`);
  },

  backOfficeEfficiency(companyId: Guid, branchId: Guid, businessDate: string) {
    const q = new URLSearchParams({ businessDate });
    return http.get<BackOfficeEfficiencySnapshotDto>(`${base(companyId, branchId)}/back-office-efficiency?${q}`);
  },

  generateEndOfDay(companyId: Guid, branchId: Guid, payload: { businessDate: string; varianceReasonCodeId?: Guid | null; varianceComment?: string | null }) {
    return http.post<EndOfDayReportDto>(`${base(companyId, branchId)}/end-of-day`, payload);
  },

  dailyPlan(companyId: Guid, branchId: Guid, businessDate: string, shiftName = "Day") {
    const q = new URLSearchParams({ businessDate, shiftName });
    return http.get<DailyOperationPlanDto>(`${base(companyId, branchId)}/daily-plan?${q}`);
  },

  saveDailyPlan(companyId: Guid, branchId: Guid, payload: UpsertDailyOperationPlanDto) {
    return http.put<DailyOperationPlanDto>(`${base(companyId, branchId)}/daily-plan`, payload);
  },

  recordBriefing(companyId: Guid, branchId: Guid, planId: Guid, briefingNotes: string) {
    return http.post<DailyOperationPlanDto>(`${base(companyId, branchId)}/daily-plan/${planId}/briefing`, { briefingNotes });
  },

  updateChecklist(companyId: Guid, branchId: Guid, planId: Guid, items: Array<{ id: Guid; isCompleted: boolean; notes?: string | null }>) {
    return http.post<DailyOperationPlanDto>(`${base(companyId, branchId)}/daily-plan/${planId}/checklist`, { items });
  },

  markReady(companyId: Guid, branchId: Guid, planId: Guid, exceptionReason?: string | null, reasonCodeId?: Guid | null) {
    return http.post<DailyOperationPlanDto>(`${base(companyId, branchId)}/daily-plan/${planId}/ready`, { exceptionReason, reasonCodeId });
  },

  acknowledgeBriefing(companyId: Guid, branchId: Guid, planId: Guid, payload: { employeeId: Guid; employeeName: string; channel: string }) {
    return http.post<DailyOperationPlanDto>(`${base(companyId, branchId)}/daily-plan/${planId}/acknowledgements`, payload);
  },
};
