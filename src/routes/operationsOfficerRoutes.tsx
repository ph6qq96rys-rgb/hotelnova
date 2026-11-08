import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import { Bot, ClipboardCheck, ListChecks, ScrollText, ShieldCheck } from "lucide-react";

import OfficerBriefingPage from "../features/operations-officer/pages/OfficerBriefingPage";
import OfficerFindingsPage from "../features/operations-officer/pages/OfficerFindingsPage";
import OfficerTargetsPage from "../features/operations-officer/pages/OfficerTargetsPage";
import OfficerActionsPage from "../features/operations-officer/pages/OfficerActionsPage";
import OfficerSetupPage from "../features/operations-officer/pages/OfficerSetupPage";

export type AppRoute = RouteObject & {
  label?: string;
  icon?: ReactNode;
  nav?: boolean;
  section?: string;
  order?: number;
  permissions?: string[];
};

const SECTION = "Operations";

/** AI Operations Officer, release 1: briefing, findings, targets, actions and set-up. */
export const operationsOfficerRoutes: AppRoute[] = [
  { path: "operations-officer", label: "Operations Officer", element: <OfficerBriefingPage />, icon: <Bot size={18} />, nav: true, section: SECTION, order: 1, permissions: ["aiops.view"] },
  { path: "operations-officer/findings", label: "Officer Findings", element: <OfficerFindingsPage />, icon: <ListChecks size={18} />, nav: true, section: SECTION, order: 2, permissions: ["aiops.view"] },
  { path: "operations-officer/targets", label: "Officer Targets", element: <OfficerTargetsPage />, icon: <ClipboardCheck size={18} />, nav: true, section: SECTION, order: 3, permissions: ["aiops.view"] },
  { path: "operations-officer/actions", label: "Officer Actions", element: <OfficerActionsPage />, icon: <ScrollText size={18} />, nav: true, section: SECTION, order: 4, permissions: ["aiops.view"] },
  { path: "operations-officer/setup", label: "Officer Setup", element: <OfficerSetupPage />, icon: <ShieldCheck size={18} />, nav: true, section: SECTION, order: 5, permissions: ["aiops.view"] },
];
