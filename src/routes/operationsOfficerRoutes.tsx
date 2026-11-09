import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import { BadgeCheck, Boxes, Bot, ShoppingCart, CalendarCheck, ClipboardCheck, ListChecks, ListTodo, MessageCircleQuestion, ScrollText, ShieldCheck } from "lucide-react";

import OfficerBriefingPage from "../features/operations-officer/pages/OfficerBriefingPage";
import OfficerFindingsPage from "../features/operations-officer/pages/OfficerFindingsPage";
import OfficerTargetsPage from "../features/operations-officer/pages/OfficerTargetsPage";
import OfficerActionsPage from "../features/operations-officer/pages/OfficerActionsPage";
import OfficerSetupPage from "../features/operations-officer/pages/OfficerSetupPage";
import OfficerSubscriptionPage from "../features/operations-officer/pages/OfficerSubscriptionPage";
import OfficerInstructionsPage from "../features/operations-officer/pages/OfficerInstructionsPage";
import OfficerPlansPage from "../features/operations-officer/pages/OfficerPlansPage";
import OfficerAskPage from "../features/operations-officer/pages/OfficerAskPage";
import OfficerStockPage from "../features/operations-officer/pages/OfficerStockPage";
import OfficerPurchasingPage from "../features/operations-officer/pages/OfficerPurchasingPage";

export type AppRoute = RouteObject & {
  label?: string;
  icon?: ReactNode;
  nav?: boolean;
  section?: string;
  order?: number;
  permissions?: string[];
};

const SECTION = "Operations";

/** AI Operations Officer: briefing, instructions, plans, questions, findings, targets, actions and set-up. */
export const operationsOfficerRoutes: AppRoute[] = [
  { path: "operations-officer", label: "Operations Officer", element: <OfficerBriefingPage />, icon: <Bot size={18} />, nav: true, section: SECTION, order: 1, permissions: ["aiops.view"] },
  // Anyone can open the instructions assigned to them; the team view needs aiops.view.
  { path: "operations-officer/instructions", label: "My Instructions", element: <OfficerInstructionsPage />, icon: <ListTodo size={18} />, nav: true, section: SECTION, order: 1.1 },
  { path: "operations-officer/plans", label: "Officer Plans", element: <OfficerPlansPage />, icon: <CalendarCheck size={18} />, nav: true, section: SECTION, order: 1.2, permissions: ["aiops.view"] },
  { path: "operations-officer/stock", label: "Officer Stock", element: <OfficerStockPage />, icon: <Boxes size={18} />, nav: true, section: SECTION, order: 1.25, permissions: ["aiops.view"] },
  { path: "operations-officer/purchasing", label: "Officer Purchasing", element: <OfficerPurchasingPage />, icon: <ShoppingCart size={18} />, nav: true, section: SECTION, order: 1.27, permissions: ["aiops.view"] },
  { path: "operations-officer/ask", label: "Ask the Officer", element: <OfficerAskPage />, icon: <MessageCircleQuestion size={18} />, nav: true, section: SECTION, order: 1.3, permissions: ["aiops.view"] },
  { path: "operations-officer/findings", label: "Officer Findings", element: <OfficerFindingsPage />, icon: <ListChecks size={18} />, nav: true, section: SECTION, order: 2, permissions: ["aiops.view"] },
  { path: "operations-officer/targets", label: "Officer Targets", element: <OfficerTargetsPage />, icon: <ClipboardCheck size={18} />, nav: true, section: SECTION, order: 3, permissions: ["aiops.view"] },
  { path: "operations-officer/actions", label: "Officer Actions", element: <OfficerActionsPage />, icon: <ScrollText size={18} />, nav: true, section: SECTION, order: 4, permissions: ["aiops.view"] },
  { path: "operations-officer/setup", label: "Officer Setup", element: <OfficerSetupPage />, icon: <ShieldCheck size={18} />, nav: true, section: SECTION, order: 5, permissions: ["aiops.view"] },
  { path: "operations-officer/subscription", label: "AI COO Subscription", element: <OfficerSubscriptionPage />, icon: <BadgeCheck size={18} />, nav: true, section: SECTION, order: 6, permissions: ["aiops.view"] },
];
