// src/features/hr/api/hrWorkflowApi.ts
// Overtime, payroll control and performance workflow endpoints (HR ERP grade, Nov 2026).

import { http } from '../../../api/http';

const base = (companyId: string): string => `/companies/${companyId}/hr`;

const clean = <T extends Record<string, unknown>>(params: T): T =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')) as T;

export interface CommandResult {
  success: boolean;
  id?: string | null;
  error?: string | null;
  data?: unknown;
}

//  Overtime

export type OvertimeStatus =
  | 'Draft' | 'Pending' | 'PendingPreApproval' | 'PreApproved' | 'WorkCompleted' | 'PendingKpiVerification'
  | 'Approved' | 'PartiallyApproved' | 'Rejected' | 'Processed' | 'Cancelled';

export interface OvertimeRequestRow {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  date: string;
  status: OvertimeStatus;
  category: 'Workday' | 'RestDay' | 'PublicHoliday';
  requestedHours: number;
  actualHours?: number | null;
  nightHours?: number | null;
  clockedOvertimeHours?: number | null;
  approvedHours?: number | null;
  paidHours?: number | null;
  paidAmount?: number | null;
  reason: string;
  workAssignment?: string | null;
  kpiDescription?: string | null;
  kpiTarget?: string | null;
  kpiMeasurementMethod?: string | null;
  requiredEvidence?: string | null;
  kpiResult?: string | null;
  kpiAchieved?: boolean | null;
  evidenceNote?: string | null;
  plannedStartUtc?: string | null;
  plannedEndUtc?: string | null;
  actualStartUtc?: string | null;
  actualEndUtc?: string | null;
  preApprovalNote?: string | null;
  approverNote?: string | null;
  rejectionReason?: string | null;
  submissionChannel: string;
  createdAt: string;
  canDecide: boolean;
  canComplete: boolean;
}

export interface OvertimeRequestInput {
  date: string;
  hours: number;
  reason: string;
  workAssignment: string;
  kpiDescription: string;
  kpiTarget: string;
  kpiMeasurementMethod: string;
  requiredEvidence?: string;
  plannedStartUtc?: string;
  plannedEndUtc?: string;
}

export const overtimeApi = {
  list: (companyId: string, params: { status?: string; employeeId?: string; from?: string; to?: string } = {}) =>
    http.get<OvertimeRequestRow[]>(`${base(companyId)}/overtime`, { params: clean(params) }).then((r) => r.data ?? []),
  mine: (companyId: string, status?: string) =>
    http.get<OvertimeRequestRow[]>(`${base(companyId)}/overtime/mine`, { params: clean({ status }) }).then((r) => r.data ?? []),
  submit: (companyId: string, body: OvertimeRequestInput) =>
    http.post<CommandResult>(`${base(companyId)}/overtime`, body).then((r) => r.data),
  preApprove: (companyId: string, id: string, note?: string) =>
    http.post<CommandResult>(`${base(companyId)}/overtime/${id}/pre-approve`, { approvedHours: null, note }).then((r) => r.data),
  complete: (companyId: string, id: string, body: {
    actualStartUtc: string; actualEndUtc: string; kpiResult: string; kpiAchieved: boolean; evidenceNote?: string;
  }) => http.post<CommandResult>(`${base(companyId)}/overtime/${id}/complete`, body).then((r) => r.data),
  verify: (companyId: string, id: string, approvedHours: number, note?: string) =>
    http.post<CommandResult>(`${base(companyId)}/overtime/${id}/verify`, { approvedHours, note }).then((r) => r.data),
  reject: (companyId: string, id: string, reason: string) =>
    http.post<CommandResult>(`${base(companyId)}/overtime/${id}/reject`, { reason }).then((r) => r.data),
  cancel: (companyId: string, id: string, reason: string) =>
    http.post<CommandResult>(`${base(companyId)}/overtime/${id}/cancel`, { reason }).then((r) => r.data),
};

//  Payroll controls

export interface PayrollTaxCorrectionRow {
  paySlipId: string;
  payrollRunId: string;
  periodName: string;
  periodEnd: string;
  runStatus: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  taxId?: string | null;
  grossPay: number;
  taxableIncome: number;
  taxableIncomeEstimated: boolean;
  taxWithheld: number;
  taxDue: number;
  overWithheld: number;
  taxTableUsed: string;
  taxTableDue: string;
}

export interface PayrollTaxCorrectionReport {
  from: string;
  to: string;
  paySlips: number;
  totalWithheld: number;
  totalDue: number;
  totalOverWithheld: number;
  rows: PayrollTaxCorrectionRow[];
}

export interface PendingBankVerification {
  id: string;
  employeeNo: string;
  name: string;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountNo?: string | null;
  bankChangedAtUtc?: string | null;
  canVerify: boolean;
}

export const payrollControlApi = {
  cancelRun: (companyId: string, runId: string, reason: string) =>
    http.post<CommandResult>(`${base(companyId)}/payroll/runs/${runId}/cancel`, { reason }).then((r) => r.data),
  taxCorrections: (companyId: string, from?: string, to?: string) =>
    http.get<PayrollTaxCorrectionReport>(`${base(companyId)}/payroll/tax-corrections`, { params: clean({ from, to }) })
      .then((r) => r.data),
  taxCorrectionsCsv: (companyId: string, from?: string, to?: string) =>
    http.get<Blob>(`${base(companyId)}/payroll/tax-corrections`, {
      params: clean({ from, to, format: 'csv' }),
      responseType: 'blob',
    }).then((r) => r.data),
  pendingBankVerifications: (companyId: string) =>
    http.get<PendingBankVerification[]>(`${base(companyId)}/payroll/bank-verifications`).then((r) => r.data ?? []),
  verifyBank: (companyId: string, employeeId: string) =>
    http.post<CommandResult>(`${base(companyId)}/payroll/employees/${employeeId}/bank/verify`, {}).then((r) => r.data),
};

//  Performance

export interface PerformanceReviewRow {
  id: string;
  cycleId: string;
  cycleName: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  reviewerId: string;
  reviewerName?: string | null;
  status: 'NotStarted' | 'SelfReview' | 'ManagerReview' | 'Calibration' | 'Completed';
  selfRating?: number | null;
  managerRating?: number | null;
  goalScore?: number | null;
  competencyScore?: number | null;
  calculatedRating?: number | null;
  finalRating?: number | null;
  ratingLabel?: string | null;
  goalsApproved: boolean;
  goalWeightTotal: number;
  goalCount: number;
  acknowledged: boolean;
}

export interface GoalCheckInRow { id: string; asOfDate: string; value: number; comment?: string | null; createdAtUtc: string }

export interface GoalRow {
  id: string;
  employeeId: string;
  cycleId?: string | null;
  kpiDefinitionId?: string | null;
  title: string;
  description?: string | null;
  category: string;
  direction: 'HigherIsBetter' | 'LowerIsBetter';
  weight: number;
  targetValue: number;
  actualValue?: number | null;
  unit?: string | null;
  achievementPercent?: number | null;
  dueDate: string;
  status: string;
  checkIns: GoalCheckInRow[];
}

export interface KpiDefinition {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  direction: 'HigherIsBetter' | 'LowerIsBetter';
  measurementMethod?: string | null;
  defaultCategory: 'Individual' | 'Team' | 'Department' | 'Company';
  defaultTarget?: number | null;
  isActive: boolean;
}

export type KpiDefinitionInput = Omit<KpiDefinition, 'id'>;

export const performanceWorkflowApi = {
  launchCycle: (companyId: string, cycleId: string, body: { branchId?: string | null; departmentId?: string | null } = {}) =>
    http.post<CommandResult>(`${base(companyId)}/performance/cycles/${cycleId}/launch`, body).then((r) => r.data),
  closeCycle: (companyId: string, cycleId: string) =>
    http.post<CommandResult>(`${base(companyId)}/performance/cycles/${cycleId}/close`, {}).then((r) => r.data),
  cycleReviews: (companyId: string, cycleId: string) =>
    http.get<PerformanceReviewRow[]>(`${base(companyId)}/performance/cycles/${cycleId}/reviews`).then((r) => r.data ?? []),
  myReviews: (companyId: string) =>
    http.get<PerformanceReviewRow[]>(`${base(companyId)}/performance/reviews/mine`).then((r) => r.data ?? []),
  teamReviews: (companyId: string) =>
    http.get<PerformanceReviewRow[]>(`${base(companyId)}/performance/reviews/team`).then((r) => r.data ?? []),
  approveGoals: (companyId: string, reviewId: string) =>
    http.post<CommandResult>(`${base(companyId)}/performance/reviews/${reviewId}/approve-goals`, {}).then((r) => r.data),
  calibrate: (companyId: string, reviewId: string, rating: number | null, reason?: string) =>
    http.post<CommandResult>(`${base(companyId)}/performance/reviews/${reviewId}/calibrate`, { rating, reason }).then((r) => r.data),
  acknowledge: (companyId: string, reviewId: string, comment?: string) =>
    http.post<CommandResult>(`${base(companyId)}/performance/reviews/${reviewId}/acknowledge`, { comment }).then((r) => r.data),
  goals: (companyId: string, params: { employeeId?: string; cycleId?: string } = {}) =>
    http.get<GoalRow[]>(`${base(companyId)}/performance/goals`, { params: clean(params) }).then((r) => r.data ?? []),
  createGoal: (companyId: string, body: Record<string, unknown>) =>
    http.post<CommandResult>(`${base(companyId)}/performance/goals`, body).then((r) => r.data),
  checkIn: (companyId: string, goalId: string, value: number, comment?: string, asOfDate?: string) =>
    http.post<CommandResult>(`${base(companyId)}/performance/goals/${goalId}/check-ins`, { value, comment, asOfDate }).then((r) => r.data),
  kpis: (companyId: string, includeInactive = false) =>
    http.get<KpiDefinition[]>(`${base(companyId)}/performance/kpis`, { params: { includeInactive } }).then((r) => r.data ?? []),
  createKpi: (companyId: string, body: KpiDefinitionInput) =>
    http.post<CommandResult>(`${base(companyId)}/performance/kpis`, body).then((r) => r.data),
  updateKpi: (companyId: string, id: string, body: KpiDefinitionInput) =>
    http.put<CommandResult>(`${base(companyId)}/performance/kpis/${id}`, body).then((r) => r.data),
};

export const OVERTIME_STATUS_LABEL: Record<string, string> = {
  Pending: 'Waiting for pre-approval',
  PendingPreApproval: 'Waiting for pre-approval',
  PreApproved: 'Pre-approved: record the work',
  PendingKpiVerification: 'Waiting for verification',
  Approved: 'Approved for payroll',
  PartiallyApproved: 'Partly approved for payroll',
  Processed: 'Paid',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled',
  Draft: 'Draft',
  WorkCompleted: 'Work completed',
};

export const OVERTIME_CATEGORY_LABEL: Record<string, string> = {
  Workday: 'Workday',
  RestDay: 'Weekly rest day',
  PublicHoliday: 'Public holiday',
};

export function badgeVariantForOvertime(status: string): 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' {
  if (status === 'Approved' || status === 'Processed') return 'success';
  if (status === 'PartiallyApproved' || status === 'PreApproved') return 'secondary';
  if (status === 'Rejected') return 'destructive';
  if (status === 'Cancelled') return 'outline';
  return 'warning';
}

export function resultError(result: CommandResult | undefined, fallback: string): string | null {
  if (!result) return fallback;
  return result.success ? null : result.error ?? fallback;
}
