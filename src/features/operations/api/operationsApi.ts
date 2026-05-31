import { http } from "../../../api/http";
import type { CashierShiftDto, EndOfDayReportDto, Guid, SafeDropDto, SalesSummaryDto } from "./operationsTypes";

const base = (companyId: Guid, branchId: Guid) =>
  `/api/companies/${companyId}/branches/${branchId}/operations`;

export const operationsApi = {
  currentOpenShift(companyId: Guid, branchId: Guid) {
    return http.get<CashierShiftDto | null>(`${base(companyId, branchId)}/cashier-shifts/open`);
  },

  openShift(companyId: Guid, branchId: Guid, payload: { cashierName: string; terminal: string; openingFloat: number }) {
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

  generateEndOfDay(companyId: Guid, branchId: Guid, businessDate: string) {
    return http.post<EndOfDayReportDto>(`${base(companyId, branchId)}/end-of-day`, { businessDate });
  },
};
