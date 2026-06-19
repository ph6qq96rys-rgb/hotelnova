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
  order?: number;
};

const HR_SECTION = "Human Resources";

export function getHrRoutes(): AppRoute[] {
  return [
    {
      path: "hr",
      label: "HR",
      element: <HRDashboardPage />,
      icon: <Users size={18} />,
      nav: true,
      section: HR_SECTION,
      order: 10,
    },

    {
      path: "hr/employees",
      label: "Employees",
      element: <EmployeeListPage />,
      icon: <UserCheck size={18} />,
      nav: true,
      section: HR_SECTION,
      order: 20,
    },

    {
      path: "hr/employees/new",
      element: <EmployeeFormPage />,
      nav: false,
    },

    {
      path: "hr/employees/:employeeId",
      element: <EmployeeDetailPage />,
      nav: false,
    },

    {
      path: "hr/employees/:employeeId/edit",
      element: <EmployeeFormPage />,
      nav: false,
    },

    {
      path: "hr/employees/:employeeId/confirm",
      element: <EmployeeConfirmPage />,
      nav: false,
    },

    {
      path: "hr/employees/:employeeId/terminate",
      element: <EmployeeTerminatePage />,
      nav: false,
    },

    {
      path: "hr/payroll",
      label: "Payroll",
      element: <PayrollListPage />,
      icon: <CreditCard size={18} />,
      nav: true,
      section: HR_SECTION,
      order: 30,
    },

    {
      path: "hr/payroll/new",
      element: <PayrollRunFormPage />,
      nav: false,
    },

    {
      path: "hr/payroll/runs/:runId",
      element: <PayrollRunDetailPage />,
      nav: false,
    },

    {
      path: "hr/payroll/payslips/:paySlipId",
      element: <PaySlipDetailPage />,
      nav: false,
    },

    {
      path: "hr/leave",
      label: "Leave",
      element: <LeaveListPage />,
      icon: <CalendarOff size={18} />,
      nav: true,
      section: HR_SECTION,
      order: 40,
    },

    {
      path: "hr/leave/new",
      element: <LeaveRequestFormPage />,
      nav: false,
    },

    {
      path: "hr/leave/balances/:employeeId",
      element: <LeaveBalancePage />,
      nav: false,
    },

    {
      path: "hr/attendance",
      label: "Attendance",
      element: <AttendancePage />,
      icon: <Clock size={18} />,
      nav: true,
      section: HR_SECTION,
      order: 50,
    },

    {
      path: "hr/recruitment",
      label: "Recruitment",
      element: <RecruitmentPage />,
      icon: <Briefcase size={18} />,
      nav: true,
      section: HR_SECTION,
      order: 60,
    },

    {
      path: "hr/recruitment/new",
      element: <JobPostingFormPage />,
      nav: false,
    },

    {
      path: "hr/recruitment/:postingId",
      element: <JobPostingDetailPage />,
      nav: false,
    },

    {
      path: "hr/recruitment/:postingId/applications/:applicationId",
      element: <JobApplicationDetailPage />,
      nav: false,
    },

    {
      path: "hr/performance",
      label: "Performance",
      element: <PerformancePage />,
      icon: <Star size={18} />,
      nav: true,
      section: HR_SECTION,
      order: 70,
    },

    {
      path: "hr/performance/cycles/new",
      element: <PerformanceCycleFormPage />,
      nav: false,
    },

    {
      path: "hr/performance/cycles/:cycleId",
      element: <PerformanceCycleFormPage />,
      nav: false,
    },

    {
      path: "hr/performance/reviews/:reviewId",
      element: <PerformanceReviewPage />,
      nav: false,
    },

    {
      path: "hr/training",
      label: "Training",
      element: <TrainingPage />,
      icon: <School size={18} />,
      nav: true,
      section: HR_SECTION,
      order: 80,
    },

    {
      path: "hr/training/programs/new",
      element: <TrainingProgramFormPage />,
      nav: false,
    },

    {
      path: "hr/training/programs/:programId",
      element: <TrainingProgramDetailPage />,
      nav: false,
    },
  ];
}