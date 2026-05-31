// src/features/hr/api/hrApi.ts

import { http } from '../../../api/http';

import type {
  EmployeeListDto,
  EmployeeDetailDto,
  OrgChartNodeDto,
  PayrollRunDto,
  PaySlipDetailDto,
  PaySlipSummaryDto,
  LeaveRequestDto,
  LeaveBalanceDto,
  LeaveCalendarEntryDto,
  AttendanceReportDto,
  AttendanceRecordDto,
  JobPostingDto,
  JobApplicationDto,
  RecruitmentPipelineDto,
  PerformanceCycleDto,
  PerformanceReviewDetailDto,
  TrainingProgramDto,
  MyTrainingDto,
  TrainingComplianceDto,
  HRDashboardDto,
  EmploymentStatus,
  PayrollRunStatus,
  LeaveRequestStatus,
  ApplicationStatus,
  CycleStatus,
  TrainingCategory,
  EnrollmentStatus,
  DepartmentDto,
  PositionDto,
} from '../types/index';

const base = (companyId: string): string => `/companies/${companyId}/hr`;

const cleanParams = <T extends Record<string, unknown>>(params?: T): T | undefined => {
  if (!params) return undefined;

  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ) as T;

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
};

// ── Employees ─────────────────────────────────────────────────────────────────

export const employeeApi = {
  list: (
    companyId: string,
    params?: {
      branchId?: string;
      departmentId?: string;
      status?: EmploymentStatus;
      search?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<EmployeeListDto[]> =>
    http
      .get<EmployeeListDto[]>(`${base(companyId)}/employees`, {
        params: cleanParams(params),
      })
      .then((r) => r.data),

  get: (companyId: string, id: string): Promise<EmployeeDetailDto> =>
    http.get<EmployeeDetailDto>(`${base(companyId)}/employees/${id}`).then((r) => r.data),

  orgChart: (companyId: string, rootId?: string): Promise<OrgChartNodeDto[]> =>
    http
      .get<OrgChartNodeDto[]>(`${base(companyId)}/employees/org-chart`, {
        params: cleanParams({ rootId }),
      })
      .then((r) => r.data),

  create: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/employees`, body).then((r) => r.data),

  updatePersonalInfo: (companyId: string, id: string, body: Record<string, unknown>) =>
    http.put(`${base(companyId)}/employees/${id}/personal-info`, body).then((r) => r.data),

  updateEmployment: (companyId: string, id: string, body: Record<string, unknown>) =>
    http.put(`${base(companyId)}/employees/${id}/employment`, body).then((r) => r.data),

  updateCompensation: (companyId: string, id: string, body: Record<string, unknown>) =>
    http.put(`${base(companyId)}/employees/${id}/compensation`, body).then((r) => r.data),

  confirm: (companyId: string, id: string, confirmationDate: string) =>
    http.post(`${base(companyId)}/employees/${id}/confirm`, { confirmationDate }).then((r) => r.data),

  terminate: (
    companyId: string,
    id: string,
    body: {
      terminationDate: string;
      reason: string;
    }
  ) => http.post(`${base(companyId)}/employees/${id}/terminate`, body).then((r) => r.data),
};

// ── Payroll ───────────────────────────────────────────────────────────────────

export const payrollApi = {
  listRuns: (companyId: string, year: number, status?: PayrollRunStatus): Promise<PayrollRunDto[]> =>
    http
      .get<PayrollRunDto[]>(`${base(companyId)}/payroll/runs`, {
        params: cleanParams({ year, status }),
      })
      .then((r) => r.data),

  createRun: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/payroll/runs`, body).then((r) => r.data),

  processRun: (companyId: string, id: string, processedBy: string) =>
    http.post(`${base(companyId)}/payroll/runs/${id}/process`, { processedBy }).then((r) => r.data),

  approveRun: (companyId: string, id: string, approvedBy: string) =>
    http.post(`${base(companyId)}/payroll/runs/${id}/approve`, { approvedBy }).then((r) => r.data),

  markPaid: (companyId: string, id: string, paidBy: string) =>
    http.post(`${base(companyId)}/payroll/runs/${id}/pay`, { paidBy }).then((r) => r.data),

  getPaySlip: (companyId: string, paySlipId: string): Promise<PaySlipDetailDto> =>
    http.get<PaySlipDetailDto>(`${base(companyId)}/payroll/payslips/${paySlipId}`).then((r) => r.data),

  getEmployeePaySlips: (
    companyId: string,
    employeeId: string,
    year?: number
  ): Promise<PaySlipSummaryDto[]> =>
    http
      .get<PaySlipSummaryDto[]>(`${base(companyId)}/payroll/employees/${employeeId}/payslips`, {
        params: cleanParams({ year }),
      })
      .then((r) => r.data),
};

// ── Leave ─────────────────────────────────────────────────────────────────────

export const leaveApi = {
  listRequests: (
    companyId: string,
    params?: {
      employeeId?: string;
      status?: LeaveRequestStatus;
      year?: number;
    }
  ): Promise<LeaveRequestDto[]> =>
    http
      .get<LeaveRequestDto[]>(`${base(companyId)}/leave/requests`, {
        params: cleanParams(params),
      })
      .then((r) => r.data),

  submit: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/leave/requests`, body).then((r) => r.data),

  approve: (companyId: string, id: string, approverId: string, note?: string) =>
    http
      .post(`${base(companyId)}/leave/requests/${id}/approve`, cleanParams({ approverId, note }))
      .then((r) => r.data),

  reject: (companyId: string, id: string, approverId: string, reason: string) =>
    http.post(`${base(companyId)}/leave/requests/${id}/reject`, { approverId, reason }).then((r) => r.data),

  cancel: (companyId: string, id: string, requestedBy: string, reason: string) =>
    http.post(`${base(companyId)}/leave/requests/${id}/cancel`, { requestedBy, reason }).then((r) => r.data),

  getBalances: (companyId: string, employeeId: string, year: number): Promise<LeaveBalanceDto[]> =>
    http
      .get<LeaveBalanceDto[]>(`${base(companyId)}/leave/balances/${employeeId}`, {
        params: { year },
      })
      .then((r) => r.data),

  teamCalendar: (
    companyId: string,
    managerId: string,
    from: string,
    to: string
  ): Promise<LeaveCalendarEntryDto[]> =>
    http
      .get<LeaveCalendarEntryDto[]>(`${base(companyId)}/leave/team-calendar`, {
        params: { managerId, from, to },
      })
      .then((r) => r.data),
};

// ── Attendance ────────────────────────────────────────────────────────────────

export const attendanceApi = {
  clockIn: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/attendance/clock-in`, body).then((r) => r.data),

  clockOut: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/attendance/clock-out`, body).then((r) => r.data),

  manualEntry: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/attendance/manual-entry`, body).then((r) => r.data),

  getReport: (
    companyId: string,
    params: {
      from: string;
      to: string;
      departmentId?: string;
      employeeId?: string;
    }
  ): Promise<AttendanceReportDto> =>
    http
      .get<AttendanceReportDto>(`${base(companyId)}/attendance/report`, {
        params: cleanParams(params),
      })
      .then((r) => r.data),

  getEmployeeAttendance: (
    companyId: string,
    employeeId: string,
    from: string,
    to: string
  ): Promise<AttendanceRecordDto[]> =>
    http
      .get<AttendanceRecordDto[]>(`${base(companyId)}/attendance/employees/${employeeId}`, {
        params: { from, to },
      })
      .then((r) => r.data),

  approveOvertime: (companyId: string, id: string, approverId: string, note?: string) =>
    http
      .post(`${base(companyId)}/attendance/overtime/${id}/approve`, cleanParams({ approverId, note }))
      .then((r) => r.data),
};

// ── Recruitment ───────────────────────────────────────────────────────────────

export const recruitmentApi = {
  listPostings: (
    companyId: string,
    params?: {
      status?: string;
      departmentId?: string;
    }
  ): Promise<JobPostingDto[]> =>
    http
      .get<JobPostingDto[]>(`${base(companyId)}/recruitment/postings`, {
        params: cleanParams(params),
      })
      .then((r) => r.data),

  createPosting: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/recruitment/postings`, body).then((r) => r.data),

  getApplications: (
    companyId: string,
    postingId: string,
    status?: ApplicationStatus
  ): Promise<JobApplicationDto[]> =>
    http
      .get<JobApplicationDto[]>(`${base(companyId)}/recruitment/postings/${postingId}/applications`, {
        params: cleanParams({ status }),
      })
      .then((r) => r.data),

  apply: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/recruitment/applications`, body).then((r) => r.data),

  scheduleInterview: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/recruitment/interviews`, body).then((r) => r.data),

  issueOffer: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/recruitment/offers`, body).then((r) => r.data),

  getPipeline: (companyId: string, postingId: string): Promise<RecruitmentPipelineDto> =>
    http
      .get<RecruitmentPipelineDto>(`${base(companyId)}/recruitment/postings/${postingId}/pipeline`)
      .then((r) => r.data),
};

// ── Performance ───────────────────────────────────────────────────────────────

export const performanceApi = {
  listCycles: (companyId: string, status?: CycleStatus): Promise<PerformanceCycleDto[]> =>
    http
      .get<PerformanceCycleDto[]>(`${base(companyId)}/performance/cycles`, {
        params: cleanParams({ status }),
      })
      .then((r) => r.data),

  createCycle: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/performance/cycles`, body).then((r) => r.data),

  getReview: (companyId: string, reviewId: string): Promise<PerformanceReviewDetailDto> =>
    http
      .get<PerformanceReviewDetailDto>(`${base(companyId)}/performance/reviews/${reviewId}`)
      .then((r) => r.data),

  submitSelfReview: (companyId: string, reviewId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/performance/reviews/${reviewId}/self-review`, body).then((r) => r.data),

  submitManagerReview: (companyId: string, reviewId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/performance/reviews/${reviewId}/manager-review`, body).then((r) => r.data),

  createGoal: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/performance/goals`, body).then((r) => r.data),
};

// ── Training ──────────────────────────────────────────────────────────────────

export const trainingApi = {
  listPrograms: (
    companyId: string,
    params?: {
      category?: TrainingCategory;
      isMandatory?: boolean;
    }
  ): Promise<TrainingProgramDto[]> =>
    http
      .get<TrainingProgramDto[]>(`${base(companyId)}/training/programs`, {
        params: cleanParams(params),
      })
      .then((r) => r.data),

  createProgram: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/training/programs`, body).then((r) => r.data),

  scheduleSession: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/training/sessions`, body).then((r) => r.data),

  enroll: (companyId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/training/enrollments`, body).then((r) => r.data),

  complete: (companyId: string, enrollmentId: string, body: Record<string, unknown>) =>
    http.post(`${base(companyId)}/training/enrollments/${enrollmentId}/complete`, body).then((r) => r.data),

  getMyTrainings: (
    companyId: string,
    employeeId: string,
    status?: EnrollmentStatus
  ): Promise<MyTrainingDto[]> =>
    http
      .get<MyTrainingDto[]>(`${base(companyId)}/training/employees/${employeeId}/my-trainings`, {
        params: cleanParams({ status }),
      })
      .then((r) => r.data),

  getComplianceReport: (
    companyId: string,
    params?: {
      departmentId?: string;
      programId?: string;
    }
  ): Promise<TrainingComplianceDto[]> =>
    http
      .get<TrainingComplianceDto[]>(`${base(companyId)}/training/compliance-report`, {
        params: cleanParams(params),
      })
      .then((r) => r.data),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const hrDashboardApi = {
  get: (companyId: string, branchId?: string): Promise<HRDashboardDto> =>
    http
      .get<HRDashboardDto>(`${base(companyId)}/dashboard`, {
        params: cleanParams({ branchId }),
      })
      .then((r) => r.data),
};
// ── Append these to src/features/hr/api/hrApi.ts ─────────────────────────────




export const orgStructureApi = {
  listDepartments: (
    companyId: string,
    params?: { branchId?: string; activeOnly?: boolean }
  ): Promise<DepartmentDto[]> =>
    http
      .get<DepartmentDto[]>(`${base(companyId)}/departments`, {
        params: cleanParams(params),
      })
      .then(r => r.data),

  listPositions: (
    companyId: string,
    params?: { departmentId?: string; activeOnly?: boolean }
  ): Promise<PositionDto[]> =>
    http
      .get<PositionDto[]>(`${base(companyId)}/positions`, {
        params: cleanParams(params),
      })
      .then(r => r.data),
};