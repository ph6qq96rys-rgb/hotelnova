// src/routes/hrRoutes.tsx

import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import {
  Users,
  UserCheck,
  CreditCard,
  CalendarOff,
  Clock,
  Briefcase,
  Star,
  School,
} from "lucide-react";

import HRDashboardPage from "../features/hr/pages/HRDashboardPage";
import EmployeeDetailPage from "../features/hr/pages/Employees/EmployeeDetailPage";
import AttendancePage from "../features/hr/pages/attendance/AttendancePage";
import EmployeeListPage from "../features/hr/pages/Employees/EmployeeListPage";
import LeaveListPage from "../features/hr/pages/leave/Leavelistpage ";
import PayrollListPage from "../features/hr/pages/payroll/PayrollListPage";
import PerformancePage from "../features/hr/pages/performance/PerformancePage";
import TrainingPage from "../features/hr/pages/training/TrainingPage";
import EmployeeFormPage from "../features/hr/pages/Employees/Employeeformpage";
import EmployeeConfirmPage from "../features/hr/pages/Employees/EmployeeConfirmPage";
import EmployeeTerminatePage from "../features/hr/pages/Employees/Employeeterminatepage";
import JobPostingFormPage from "../features/hr/pages/recruitment/JobPostingFormPage";
import JobPostingDetailPage from "../features/hr/pages/recruitment/Jobpostingdetailpage";
import JobApplicationDetailPage from "../features/hr/pages/recruitment/Jobapplicationdetailpage";
import LeaveRequestFormPage from "../features/hr/pages/leave/LeaveRequestFormPage";
import LeaveBalancePage from "../features/hr/pages/leave/LeaveBalancePage";
import PayrollRunFormPage from "../features/hr/pages/payroll/PayrollRunFormPage";
import PayrollRunDetailPage from "../features/hr/pages/payroll/Payrollrundetailpage";
import PaySlipDetailPage from "../features/hr/pages/payroll/Payslipdetailpage";
import PerformanceCycleFormPage from "../features/hr/pages/performance/PerformanceCycleFormPage";
import PerformanceReviewPage from "../features/hr/pages/performance/Performancereviewpage";
import TrainingProgramFormPage from "../features/hr/pages/training/Trainingprogramformpage";
import TrainingProgramDetailPage from "../features/hr/pages/training/Trainingprogramdetailpage";
import RecruitmentPage from "../features/hr/pages/RecruitmentPage";

export type AppRoute = RouteObject & {
  path?: string;
  label?: string;
  element?: ReactNode;
  icon?: ReactNode;
  nav?: boolean;
  section?: string;
  roles?: string[];
  menu?: {
    label: string;
    icon?: ReactNode;
    section?: string;
  };
};

export type CompanyRouteScope = {
  companyId: string;
};

export const hrPaths = {
  root: "/companies/:companyId/hr",

  employees: "/companies/:companyId/hr/employees",
  employeeNew: "/companies/:companyId/hr/employees/new",
  employeeDetail: "/companies/:companyId/hr/employees/:employeeId",
  employeeEdit: "/companies/:companyId/hr/employees/:employeeId/edit",
  employeeConfirm: "/companies/:companyId/hr/employees/:employeeId/confirm",
  employeeTerminate: "/companies/:companyId/hr/employees/:employeeId/terminate",

  payroll: "/companies/:companyId/hr/payroll",
  payrollNew: "/companies/:companyId/hr/payroll/new",
  payrollRunDetail: "/companies/:companyId/hr/payroll/runs/:runId",
  paySlipDetail: "/companies/:companyId/hr/payroll/payslips/:paySlipId",

  leave: "/companies/:companyId/hr/leave",
  leaveNew: "/companies/:companyId/hr/leave/new",
  leaveBalance: "/companies/:companyId/hr/leave/balances/:employeeId",

  attendance: "/companies/:companyId/hr/attendance",

  recruitment: "/companies/:companyId/hr/recruitment",
  recruitmentNew: "/companies/:companyId/hr/recruitment/new",
  jobPostingDetail: "/companies/:companyId/hr/recruitment/:postingId",
  jobApplicationDetail:
    "/companies/:companyId/hr/recruitment/:postingId/applications/:applicationId",

  performance: "/companies/:companyId/hr/performance",
  performanceCycleNew: "/companies/:companyId/hr/performance/cycles/new",
  performanceCycleDetail:
    "/companies/:companyId/hr/performance/cycles/:cycleId",
  performanceReviewDetail:
    "/companies/:companyId/hr/performance/reviews/:reviewId",

  training: "/companies/:companyId/hr/training",
  trainingProgramNew: "/companies/:companyId/hr/training/programs/new",
  trainingProgramDetail:
    "/companies/:companyId/hr/training/programs/:programId",
};

const companyRoot = (companyId: string) => `/companies/${companyId}`;
const hrRoot = (companyId: string) => `${companyRoot(companyId)}/hr`;

export const hrLinks = {
  root: (companyId: string) => hrRoot(companyId),

  employees: (companyId: string) => `${hrRoot(companyId)}/employees`,

  employeeNew: (companyId: string) =>
    `${hrRoot(companyId)}/employees/new`,

  employeeDetail: (companyId: string, employeeId: string) =>
    `${hrRoot(companyId)}/employees/${employeeId}`,

  employeeEdit: (companyId: string, employeeId: string) =>
    `${hrRoot(companyId)}/employees/${employeeId}/edit`,

  employeeConfirm: (companyId: string, employeeId: string) =>
    `${hrRoot(companyId)}/employees/${employeeId}/confirm`,

  employeeTerminate: (companyId: string, employeeId: string) =>
    `${hrRoot(companyId)}/employees/${employeeId}/terminate`,

  attendance: (companyId: string) => `${hrRoot(companyId)}/attendance`,

  leave: (companyId: string) => `${hrRoot(companyId)}/leave`,

  leaveNew: (companyId: string) => `${hrRoot(companyId)}/leave/new`,

  leaveBalance: (companyId: string, employeeId: string) =>
    `${hrRoot(companyId)}/leave/balances/${employeeId}`,

  payroll: (companyId: string) => `${hrRoot(companyId)}/payroll`,

  payrollNew: (companyId: string) => `${hrRoot(companyId)}/payroll/new`,

  payrollRunDetail: (companyId: string, runId: string) =>
    `${hrRoot(companyId)}/payroll/runs/${runId}`,

  paySlipDetail: (companyId: string, paySlipId: string) =>
    `${hrRoot(companyId)}/payroll/payslips/${paySlipId}`,

  recruitment: (companyId: string) => `${hrRoot(companyId)}/recruitment`,

  recruitmentNew: (companyId: string) =>
    `${hrRoot(companyId)}/recruitment/new`,

  jobPostingDetail: (companyId: string, postingId: string) =>
    `${hrRoot(companyId)}/recruitment/${postingId}`,

  jobApplicationDetail: (
    companyId: string,
    postingId: string,
    applicationId: string
  ) =>
    `${hrRoot(companyId)}/recruitment/${postingId}/applications/${applicationId}`,

  performance: (companyId: string) => `${hrRoot(companyId)}/performance`,

  performanceCycleNew: (companyId: string) =>
    `${hrRoot(companyId)}/performance/cycles/new`,

  performanceCycleDetail: (companyId: string, cycleId: string) =>
    `${hrRoot(companyId)}/performance/cycles/${cycleId}`,

  performanceReviewDetail: (companyId: string, reviewId: string) =>
    `${hrRoot(companyId)}/performance/reviews/${reviewId}`,

  training: (companyId: string) => `${hrRoot(companyId)}/training`,

  trainingProgramNew: (companyId: string) =>
    `${hrRoot(companyId)}/training/programs/new`,

  trainingProgramDetail: (companyId: string, programId: string) =>
    `${hrRoot(companyId)}/training/programs/${programId}`,
};

export function getHrRoutes(): AppRoute[] {
  return [
    {
      path: hrPaths.root,
      label: "HR",
      element: <HRDashboardPage />,
      icon: <Users size={18} />,
      nav: true,
      section: "Human Resources",
    },
    {
      path: hrPaths.employees,
      label: "Employees",
      element: <EmployeeListPage />,
      icon: <UserCheck size={18} />,
      nav: true,
      section: "Human Resources",
    },
    {
      path: hrPaths.employeeNew,
      element: <EmployeeFormPage />,
      nav: false,
    },
    {
      path: hrPaths.employeeDetail,
      element: <EmployeeDetailPage />,
      nav: false,
    },
    {
      path: hrPaths.employeeEdit,
      element: <EmployeeFormPage />,
      nav: false,
    },
    {
      path: hrPaths.employeeConfirm,
      element: <EmployeeConfirmPage />,
      nav: false,
    },
    {
      path: hrPaths.employeeTerminate,
      element: <EmployeeTerminatePage />,
      nav: false,
    },

    {
      path: hrPaths.payroll,
      label: "Payroll",
      element: <PayrollListPage />,
      icon: <CreditCard size={18} />,
      nav: true,
      section: "Human Resources",
    },
    {
      path: hrPaths.payrollNew,
      element: <PayrollRunFormPage />,
      nav: false,
    },
    {
      path: hrPaths.payrollRunDetail,
      element: <PayrollRunDetailPage />,
      nav: false,
    },
    {
      path: hrPaths.paySlipDetail,
      element: <PaySlipDetailPage />,
      nav: false,
    },

    {
      path: hrPaths.leave,
      label: "Leave",
      element: <LeaveListPage />,
      icon: <CalendarOff size={18} />,
      nav: true,
      section: "Human Resources",
    },
    {
      path: hrPaths.leaveNew,
      element: <LeaveRequestFormPage />,
      nav: false,
    },
    {
      path: hrPaths.leaveBalance,
      element: <LeaveBalancePage />,
      nav: false,
    },

    {
      path: hrPaths.attendance,
      label: "Attendance",
      element: <AttendancePage />,
      icon: <Clock size={18} />,
      nav: true,
      section: "Human Resources",
    },

    {
      path: hrPaths.recruitment,
      label: "Recruitment",
      element: <RecruitmentPage />,
      icon: <Briefcase size={18} />,
      nav: true,
      section: "Human Resources",
    },
    {
      path: hrPaths.recruitmentNew,
      element: <JobPostingFormPage />,
      nav: false,
    },
    {
      path: hrPaths.jobPostingDetail,
      element: <JobPostingDetailPage />,
      nav: false,
    },
    {
      path: hrPaths.jobApplicationDetail,
      element: <JobApplicationDetailPage />,
      nav: false,
    },

    {
      path: hrPaths.performance,
      label: "Performance",
      element: <PerformancePage />,
      icon: <Star size={18} />,
      nav: true,
      section: "Human Resources",
    },
    {
      path: hrPaths.performanceCycleNew,
      element: <PerformanceCycleFormPage />,
      nav: false,
    },
    {
      path: hrPaths.performanceCycleDetail,
      element: <PerformanceCycleFormPage />,
      nav: false,
    },
    {
      path: hrPaths.performanceReviewDetail,
      element: <PerformanceReviewPage />,
      nav: false,
    },

    {
      path: hrPaths.training,
      label: "Training",
      element: <TrainingPage />,
      icon: <School size={18} />,
      nav: true,
      section: "Human Resources",
    },
    {
      path: hrPaths.trainingProgramNew,
      element: <TrainingProgramFormPage />,
      nav: false,
    },
    {
      path: hrPaths.trainingProgramDetail,
      element: <TrainingProgramDetailPage />,
      nav: false,
    },
  ];
}