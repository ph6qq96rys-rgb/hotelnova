// src/routes/hrRoutes.tsx

import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import {
  Briefcase,
  CalendarOff,
  Clock,
  CreditCard,
  School,
  Star,
  UserCheck,
  Users,
} from "lucide-react";

import HRDashboardPage from "../features/hr/pages/HRDashboardPage";

import EmployeeListPage from "../features/hr/pages/Employees/EmployeeListPage";
import EmployeeDetailPage from "../features/hr/pages/Employees/EmployeeDetailPage";
import EmployeeFormPage from "../features/hr/pages/Employees/Employeeformpage";
import EmployeeConfirmPage from "../features/hr/pages/Employees/EmployeeConfirmPage";
import EmployeeTerminatePage from "../features/hr/pages/Employees/Employeeterminatepage";

import AttendancePage from "../features/hr/pages/attendance/AttendancePage";

import LeaveRequestFormPage from "../features/hr/pages/leave/LeaveRequestFormPage";
import LeaveBalancePage from "../features/hr/pages/leave/LeaveBalancePage";
import LeaveListPage from "../features/hr/pages/leave/Leavelistpage";

import PayrollListPage from "../features/hr/pages/payroll/PayrollListPage";
import PayrollRunFormPage from "../features/hr/pages/payroll/PayrollRunFormPage";
import PayrollRunDetailPage from "../features/hr/pages/payroll/Payrollrundetailpage";
import PaySlipDetailPage from "../features/hr/pages/payroll/Payslipdetailpage";

import RecruitmentPage from "../features/hr/pages/RecruitmentPage";
import JobPostingFormPage from "../features/hr/pages/recruitment/JobPostingFormPage";
import JobPostingDetailPage from "../features/hr/pages/recruitment/Jobpostingdetailpage";
import JobApplicationDetailPage from "../features/hr/pages/recruitment/Jobapplicationdetailpage";

import PerformancePage from "../features/hr/pages/performance/PerformancePage";
import PerformanceCycleFormPage from "../features/hr/pages/performance/PerformanceCycleFormPage";
import PerformanceReviewPage from "../features/hr/pages/performance/Performancereviewpage";

import TrainingPage from "../features/hr/pages/training/TrainingPage";
import TrainingProgramFormPage from "../features/hr/pages/training/Trainingprogramformpage";
import TrainingProgramDetailPage from "../features/hr/pages/training/Trainingprogramdetailpage";

export type AppRoute = RouteObject & {
  label?: string;
  icon?: ReactNode;
  nav?: boolean;
  section?: string;
  roles?: string[];

  /**
   * Sidebar-safe URL resolver.
   * Use this for Link/NavLink/navigate.
   */
  getHref?: (companyId: string) => string;
};

const HR_SECTION = "Human Resources";

const COMPANY_PATTERN = "/companies/:companyId";
const HR_PATTERN = `${COMPANY_PATTERN}/hr`;

const companyUrl = (companyId: string) => `/companies/${companyId}`;
const hrUrl = (companyId: string) => `${companyUrl(companyId)}/hr`;

/**
 * Route patterns are ONLY for React Router route definitions.
 * Never use these directly for Sidebar links, Link, NavLink, navigate, or redirects.
 */
export const HR_ROUTE_PATTERNS = {
  root: HR_PATTERN,

  employees: `${HR_PATTERN}/employees`,
  employeeNew: `${HR_PATTERN}/employees/new`,
  employeeDetail: `${HR_PATTERN}/employees/:employeeId`,
  employeeEdit: `${HR_PATTERN}/employees/:employeeId/edit`,
  employeeConfirm: `${HR_PATTERN}/employees/:employeeId/confirm`,
  employeeTerminate: `${HR_PATTERN}/employees/:employeeId/terminate`,

  attendance: `${HR_PATTERN}/attendance`,

  leave: `${HR_PATTERN}/leave`,
  leaveNew: `${HR_PATTERN}/leave/new`,
  leaveBalance: `${HR_PATTERN}/leave/balances/:employeeId`,

  payroll: `${HR_PATTERN}/payroll`,
  payrollNew: `${HR_PATTERN}/payroll/new`,
  payrollRunDetail: `${HR_PATTERN}/payroll/runs/:runId`,
  paySlipDetail: `${HR_PATTERN}/payroll/payslips/:paySlipId`,

  recruitment: `${HR_PATTERN}/recruitment`,
  recruitmentNew: `${HR_PATTERN}/recruitment/new`,
  jobPostingDetail: `${HR_PATTERN}/recruitment/:postingId`,
  jobApplicationDetail: `${HR_PATTERN}/recruitment/:postingId/applications/:applicationId`,

  performance: `${HR_PATTERN}/performance`,
  performanceCycleNew: `${HR_PATTERN}/performance/cycles/new`,
  performanceCycleDetail: `${HR_PATTERN}/performance/cycles/:cycleId`,
  performanceReviewDetail: `${HR_PATTERN}/performance/reviews/:reviewId`,

  training: `${HR_PATTERN}/training`,
  trainingProgramNew: `${HR_PATTERN}/training/programs/new`,
  trainingProgramDetail: `${HR_PATTERN}/training/programs/:programId`,
} as const;

/**
 * URL builders are ONLY for real links, buttons, breadcrumbs, navigate(), redirects, Sidebar.
 */
export const HR_URLS = {
  root: (companyId: string) => hrUrl(companyId),

  employees: (companyId: string) => `${hrUrl(companyId)}/employees`,
  employeeNew: (companyId: string) => `${hrUrl(companyId)}/employees/new`,
  employeeDetail: (companyId: string, employeeId: string) =>
    `${hrUrl(companyId)}/employees/${employeeId}`,
  employeeEdit: (companyId: string, employeeId: string) =>
    `${hrUrl(companyId)}/employees/${employeeId}/edit`,
  employeeConfirm: (companyId: string, employeeId: string) =>
    `${hrUrl(companyId)}/employees/${employeeId}/confirm`,
  employeeTerminate: (companyId: string, employeeId: string) =>
    `${hrUrl(companyId)}/employees/${employeeId}/terminate`,

  attendance: (companyId: string) => `${hrUrl(companyId)}/attendance`,

  leave: (companyId: string) => `${hrUrl(companyId)}/leave`,
  leaveNew: (companyId: string) => `${hrUrl(companyId)}/leave/new`,
  leaveBalance: (companyId: string, employeeId: string) =>
    `${hrUrl(companyId)}/leave/balances/${employeeId}`,

  payroll: (companyId: string) => `${hrUrl(companyId)}/payroll`,
  payrollNew: (companyId: string) => `${hrUrl(companyId)}/payroll/new`,
  payrollRunDetail: (companyId: string, runId: string) =>
    `${hrUrl(companyId)}/payroll/runs/${runId}`,
  paySlipDetail: (companyId: string, paySlipId: string) =>
    `${hrUrl(companyId)}/payroll/payslips/${paySlipId}`,

  recruitment: (companyId: string) => `${hrUrl(companyId)}/recruitment`,
  recruitmentNew: (companyId: string) => `${hrUrl(companyId)}/recruitment/new`,
  jobPostingDetail: (companyId: string, postingId: string) =>
    `${hrUrl(companyId)}/recruitment/${postingId}`,
  jobApplicationDetail: (
    companyId: string,
    postingId: string,
    applicationId: string
  ) => `${hrUrl(companyId)}/recruitment/${postingId}/applications/${applicationId}`,

  performance: (companyId: string) => `${hrUrl(companyId)}/performance`,
  performanceCycleNew: (companyId: string) =>
    `${hrUrl(companyId)}/performance/cycles/new`,
  performanceCycleDetail: (companyId: string, cycleId: string) =>
    `${hrUrl(companyId)}/performance/cycles/${cycleId}`,
  performanceReviewDetail: (companyId: string, reviewId: string) =>
    `${hrUrl(companyId)}/performance/reviews/${reviewId}`,

  training: (companyId: string) => `${hrUrl(companyId)}/training`,
  trainingProgramNew: (companyId: string) =>
    `${hrUrl(companyId)}/training/programs/new`,
  trainingProgramDetail: (companyId: string, programId: string) =>
    `${hrUrl(companyId)}/training/programs/${programId}`,
} as const;

export const hrPaths = HR_ROUTE_PATTERNS;
export const hrLinks = HR_URLS;

const navRoute = (
  path: string,
  label: string,
  element: ReactNode,
  icon: ReactNode,
  getHref: (companyId: string) => string
): AppRoute => ({
  path,
  label,
  element,
  icon,
  nav: true,
  section: HR_SECTION,
  getHref,
});

const hiddenRoute = (path: string, element: ReactNode): AppRoute => ({
  path,
  element,
  nav: true,
});

export function getHrRoutes(): AppRoute[] {
  return [
    navRoute(
      HR_ROUTE_PATTERNS.root,
      "HR",
      <HRDashboardPage />,
      <Users size={18} />,
      HR_URLS.root
    ),

    navRoute(
      HR_ROUTE_PATTERNS.employees,
      "Employees",
      <EmployeeListPage />,
      <UserCheck size={18} />,
      HR_URLS.employees
    ),
    hiddenRoute(HR_ROUTE_PATTERNS.employeeNew, <EmployeeFormPage />),
    hiddenRoute(HR_ROUTE_PATTERNS.employeeDetail, <EmployeeDetailPage />),
    hiddenRoute(HR_ROUTE_PATTERNS.employeeEdit, <EmployeeFormPage />),
    hiddenRoute(HR_ROUTE_PATTERNS.employeeConfirm, <EmployeeConfirmPage />),
    hiddenRoute(HR_ROUTE_PATTERNS.employeeTerminate, <EmployeeTerminatePage />),

    navRoute(
      HR_ROUTE_PATTERNS.payroll,
      "Payroll",
      <PayrollListPage />,
      <CreditCard size={18} />,
      HR_URLS.payroll
    ),
    hiddenRoute(HR_ROUTE_PATTERNS.payrollNew, <PayrollRunFormPage />),
    hiddenRoute(HR_ROUTE_PATTERNS.payrollRunDetail, <PayrollRunDetailPage />),
    hiddenRoute(HR_ROUTE_PATTERNS.paySlipDetail, <PaySlipDetailPage />),

    navRoute(
      HR_ROUTE_PATTERNS.leave,
      "Leave",
      <LeaveListPage />,
      <CalendarOff size={18} />,
      HR_URLS.leave
    ),
    hiddenRoute(HR_ROUTE_PATTERNS.leaveNew, <LeaveRequestFormPage />),
    hiddenRoute(HR_ROUTE_PATTERNS.leaveBalance, <LeaveBalancePage />),

    navRoute(
      HR_ROUTE_PATTERNS.attendance,
      "Attendance",
      <AttendancePage />,
      <Clock size={18} />,
      HR_URLS.attendance
    ),

    navRoute(
      HR_ROUTE_PATTERNS.recruitment,
      "Recruitment",
      <RecruitmentPage />,
      <Briefcase size={18} />,
      HR_URLS.recruitment
    ),
    hiddenRoute(HR_ROUTE_PATTERNS.recruitmentNew, <JobPostingFormPage />),
    hiddenRoute(HR_ROUTE_PATTERNS.jobPostingDetail, <JobPostingDetailPage />),
    hiddenRoute(HR_ROUTE_PATTERNS.jobApplicationDetail, <JobApplicationDetailPage />),

    navRoute(
      HR_ROUTE_PATTERNS.performance,
      "Performance",
      <PerformancePage />,
      <Star size={18} />,
      HR_URLS.performance
    ),
    hiddenRoute(HR_ROUTE_PATTERNS.performanceCycleNew, <PerformanceCycleFormPage />),
    hiddenRoute(HR_ROUTE_PATTERNS.performanceCycleDetail, <PerformanceCycleFormPage />),
    hiddenRoute(HR_ROUTE_PATTERNS.performanceReviewDetail, <PerformanceReviewPage />),

    navRoute(
      HR_ROUTE_PATTERNS.training,
      "Training",
      <TrainingPage />,
      <School size={18} />,
      HR_URLS.training
    ),
    hiddenRoute(HR_ROUTE_PATTERNS.trainingProgramNew, <TrainingProgramFormPage />),
    hiddenRoute(HR_ROUTE_PATTERNS.trainingProgramDetail, <TrainingProgramDetailPage />),
  ];
}