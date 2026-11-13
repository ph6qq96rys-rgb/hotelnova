import type { ReactNode } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { AlertTriangle, BookOpen, CalendarCheck, ListTree, Scale, Workflow } from "lucide-react";

import JournalsPage from "../features/finance/pages/JournalsPage";
import ChartOfAccountsPage from "../features/finance/pages/ChartOfAccountsPage";
import AccountingPeriodsPage from "../features/finance/pages/AccountingPeriodsPage";
import PostingSetupPage from "../features/finance/pages/PostingSetupPage";
import TrialBalancePage from "../features/finance/pages/TrialBalancePage";
import FinancialStatementsPage from "../features/finance/pages/FinancialStatementsPage";
import BankReconciliationPage from "../features/finance/pages/BankReconciliationPage";
import VatReturnPage from "../features/finance/pages/VatReturnPage";
import ReceivablesPage from "../features/finance/pages/ReceivablesPage";

export type AppRoute = RouteObject & {
  label?: string;
  icon?: ReactNode;
  nav?: boolean;
  section?: string;
  order?: number;
  permissions?: string[];
};

const FINANCE_SECTION = "Finance";

/** General ledger (finance phase 1). */
export const financeRoutes: AppRoute[] = [
  { path: "finance/statements", label: "Financial Statements", element: <FinancialStatementsPage />, icon: <Scale size={18} />, nav: true, section: FINANCE_SECTION, order: 21, permissions: ["finance.view"] },
  { path: "finance/bank-reconciliation", label: "Bank Reconciliation", element: <BankReconciliationPage />, icon: <Scale size={18} />, nav: true, section: FINANCE_SECTION, order: 22, permissions: ["finance.view"] },
  { path: "finance/receivables", label: "Accounts Receivable", element: <ReceivablesPage />, icon: <BookOpen size={18} />, nav: true, section: FINANCE_SECTION, order: 15, permissions: ["finance.view"] },
  { path: "finance/vat-return", label: "VAT Return", element: <VatReturnPage />, icon: <Scale size={18} />, nav: true, section: FINANCE_SECTION, order: 23, permissions: ["finance.view"] },
  { path: "finance/journals", label: "General Ledger & Journals", element: <JournalsPage />, icon: <BookOpen size={18} />, nav: true, section: FINANCE_SECTION, order: 10, permissions: ["finance.view"] },
  { path: "finance/trial-balance", label: "Financial Reports", element: <TrialBalancePage />, icon: <Scale size={18} />, nav: true, section: FINANCE_SECTION, order: 20, permissions: ["finance.view"] },
  { path: "finance/accounts", label: "Chart of Accounts", element: <ChartOfAccountsPage />, icon: <ListTree size={18} />, nav: true, section: FINANCE_SECTION, order: 30, permissions: ["finance.view"] },
  { path: "finance/periods", label: "Period Closing", element: <AccountingPeriodsPage />, icon: <CalendarCheck size={18} />, nav: true, section: FINANCE_SECTION, order: 40, permissions: ["finance.view"] },
  { path: "finance/exceptions", label: "Posting Exceptions", element: <Navigate to="../posting?tab=exceptions" relative="path" replace />, icon: <AlertTriangle size={18} />, nav: true, section: FINANCE_SECTION, order: 45, permissions: ["finance.view"] },
  { path: "finance/posting", label: "Finance Configuration", element: <PostingSetupPage />, icon: <Workflow size={18} />, nav: true, section: FINANCE_SECTION, order: 50, permissions: ["finance.view"] },
];
