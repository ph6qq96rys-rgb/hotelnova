import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  PackageSearch,
  Receipt,
  Settings,
  Users,
  Utensils,
} from "lucide-react";

import type {
  CateringExperienceDto,
  CateringMenuCatalogDto,
  CateringOperationalSnapshot,
  EventDashboardDto,
  EventInquiryDto,
  EventQuotationSummaryDto,
} from "../../api/cateringManagementApi";

export type RoleKey = "coordinator" | "manager" | "chef" | "controller" | "storekeeper" | "finance";
export type DeviceMode = "desktop" | "tablet" | "mobile";
export type ScreenKey =
  | "dashboard"
  | "inquiry"
  | "events"
  | "calendar"
  | "customers"
  | "venues"
  | "workspace"
  | "builders"
  | "quotations"
  | "operations"
  | "inventory"
  | "billing"
  | "reports"
  | "configuration"
  | "live"
  | "reconciliation"
  | "portal";

export type Tone = "critical" | "warning" | "success" | "info";

export type CateringApiState = {
  loading: boolean;
  commandLoading: boolean;
  error: string | null;
  dashboard: EventDashboardDto | null;
  experience: CateringExperienceDto | null;
  inquiries: EventInquiryDto[];
  quotations: EventQuotationSummaryDto[];
  snapshot: CateringOperationalSnapshot | null;
  catalog: CateringMenuCatalogDto;
};

export type QueueRow = {
  ref: string;
  customer: string;
  venue: string;
  status: string;
  due: string;
  priority: string;
  lifecycle: string;
  readiness: number;
  blocker: string;
  nextAction: string;
};

export type MenuBuilderLine = {
  name: string;
  course: string;
  category: string;
  description: string;
  servingFactor: number;
  portion: number;
  expectedYield: number;
  unit: string;
  price: number;
  cost: number;
  recipe: string;
  dietary: string;
  allergens: string;
  equipment: string;
  location: string;
  exception?: string | null;
  menuItemId?: string | null;
};

export const roles: Record<
  RoleKey,
  {
    label: string;
    summary: string;
    screens: ScreenKey[];
    cards: Array<[string, string, string, Tone]>;
    permissions: string[];
    landingQueue: ScreenKey;
  }
> = {
  coordinator: {
    label: "Sales Representative",
    summary: "Leads, customers, quotations, follow-ups, and draft event creation.",
    screens: ["dashboard", "inquiry", "events", "calendar", "customers", "venues", "workspace", "builders", "quotations", "portal"],
    permissions: ["catering.dashboard.view", "catering.inquiries.view", "catering.events.view", "catering.calendar.view", "catering.customers.view", "catering.venues.view", "catering.packages.view", "catering.quotations.view"],
    landingQueue: "inquiry",
    cards: [
      ["Service requests", "7", "3 overdue follow-ups", "warning"],
      ["Service plans", "5", "2 awaiting completion", "critical"],
      ["Approved orders", "18", "4 ready for operations", "info"],
      ["Customer actions", "3", "acceptance or deposit pending", "warning"],
    ],
  },
  manager: {
    label: "Catering Manager",
    summary: "Complete event coordination across leads, quotes, planning, readiness, execution, and close-out.",
    screens: ["dashboard", "inquiry", "events", "calendar", "customers", "venues", "workspace", "builders", "quotations", "operations", "inventory", "billing", "reports", "configuration", "live", "reconciliation", "portal"],
    permissions: ["catering.dashboard.view", "catering.inquiries.view", "catering.events.view", "catering.calendar.view", "catering.customers.view", "catering.venues.view", "catering.packages.view", "catering.quotations.view", "catering.operations.view", "catering.inventory.view", "catering.billing.view", "catering.reports.view", "catering.configuration.view"],
    landingQueue: "operations",
    cards: [
      ["Readiness", "6", "service orders verified this week", "success"],
      ["Operational risks", "4", "inventory, production, and staffing", "warning"],
      ["Approvals", "9", "service plans and change orders", "critical"],
      ["Profitability", "34%", "authorized margin view", "info"],
    ],
  },
  chef: {
    label: "Executive Chef",
    summary: "Menus, guest counts, dietary alerts, recipe quantities, kitchen production, and ingredient requirements.",
    screens: ["dashboard", "events", "calendar", "workspace", "builders", "operations", "inventory", "live"],
    permissions: ["catering.dashboard.view", "catering.events.view", "catering.calendar.view", "catering.packages.view", "catering.operations.view", "catering.inventory.view"],
    landingQueue: "operations",
    cards: [
      ["Menus", "6", "2 with allergen alerts", "warning"],
      ["Production schedules", "11", "prep lists due in 48 hours", "critical"],
      ["Dietary requirements", "4", "religious or medical notes", "warning"],
      ["Shortages", "8", "ingredient availability risks", "critical"],
    ],
  },
  controller: {
    label: "F&B Controller",
    summary: "Approvals, inventory controls, planned vs actual consumption, variances, and reconciliation.",
    screens: ["dashboard", "events", "calendar", "workspace", "operations", "inventory", "reports", "live", "reconciliation"],
    permissions: ["catering.dashboard.view", "catering.events.view", "catering.calendar.view", "catering.operations.view", "catering.inventory.view", "catering.reports.view"],
    landingQueue: "inventory",
    cards: [
      ["Consumption plans", "12", "guest-count recalculation pending", "warning"],
      ["SIV approvals", "8", "awaiting review", "warning"],
      ["Variances", "5", "above tolerance", "critical"],
      ["Reconciliation", "7", "events to close", "info"],
    ],
  },
  storekeeper: {
    label: "Storekeeper",
    summary: "Reservations, SIVs, stock issue, dispatch support, returns, and warehouse exceptions.",
    screens: ["dashboard", "events", "calendar", "workspace", "operations", "inventory", "live", "reconciliation"],
    permissions: ["catering.dashboard.view", "catering.events.view", "catering.calendar.view", "catering.operations.view", "catering.inventory.view"],
    landingQueue: "inventory",
    cards: [
      ["Picking lists", "10", "3 required before noon", "critical"],
      ["Issuance", "8", "approved SIVs ready", "warning"],
      ["Returns", "6", "draft returns to post", "warning"],
      ["Equipment moves", "5", "custody confirmation pending", "info"],
    ],
  },
  finance: {
    label: "Finance",
    summary: "Quotations, deposits, invoices, balances, settlement, and customer financial follow-up.",
    screens: ["dashboard", "events", "customers", "workspace", "quotations", "billing", "reports", "reconciliation", "portal"],
    permissions: ["catering.dashboard.view", "catering.events.view", "catering.customers.view", "catering.quotations.view", "catering.billing.view", "catering.reports.view"],
    landingQueue: "billing",
    cards: [
      ["Deposits", "6", "ETB 18,430 due", "critical"],
      ["Invoices", "13", "5 overdue", "warning"],
      ["Payments", "ETB 12,450", "posted today", "success"],
      ["Outstanding balances", "ETB 41,880", "credit follow-up required", "warning"],
    ],
  },
};

export const navItems: Array<{
  key: ScreenKey;
  label: string;
  icon: ReactNode;
  counter: number;
  permission: string;
}> = [
  { key: "dashboard", label: "Overview", icon: <LayoutDashboard size={17} />, counter: 18, permission: "catering.dashboard.view" },
  { key: "events", label: "Events", icon: <ClipboardCheck size={17} />, counter: 18, permission: "catering.events.view" },
  { key: "inquiry", label: "Leads & Inquiries", icon: <Users size={17} />, counter: 7, permission: "catering.inquiries.view" },
  { key: "calendar", label: "Calendar", icon: <CalendarDays size={17} />, counter: 2, permission: "catering.calendar.view" },
  { key: "builders", label: "Menus & Packages", icon: <Utensils size={17} />, counter: 6, permission: "catering.packages.view" },
  { key: "operations", label: "Operations", icon: <Settings size={17} />, counter: 13, permission: "catering.operations.view" },
  { key: "billing", label: "Finance", icon: <Receipt size={17} />, counter: 6, permission: "catering.billing.view" },
  { key: "reports", label: "Reports", icon: <FileText size={17} />, counter: 4, permission: "catering.reports.view" },
  { key: "workspace", label: "Event Workspace", icon: <PackageSearch size={17} />, counter: 1, permission: "catering.events.view" },
  { key: "portal", label: "Customer Portal", icon: <Receipt size={17} />, counter: 3, permission: "catering.customers.view" },
];

export const statusSteps = [
  "Inquiry",
  "Quoted",
  "Confirmed",
  "Planning",
  "Preparation",
  "Ready",
  "In Progress",
  "Reconciliation",
  "Completed",
];

export const alternateStatuses = ["Draft", "Waiting on customer", "Waiting for payment", "Operationally blocked", "Ready", "In progress", "Completed", "Cancelled"];

export const queues = [
  ["New service requests", "7", "Open service request queue", "warning"],
  ["Service plan approvals", "5", "Review scope, price, discount, tax, and margin warnings", "critical"],
  ["Deposits awaiting completion", "3", "Send payment reminder or verify receipt", "warning"],
  ["Location and resource conflicts", "2", "Resolve setup, delivery, and vehicle assignment", "critical"],
  ["Guest-count deadlines", "4", "Confirm final count and trigger consumption recalculation", "warning"],
  ["Consumption shortages", "14", "Review shortages, reservations, and procurement actions", "critical"],
  ["Unresolved reconciliation variances", "5", "Investigate usage, waste, and returns", "warning"],
] as const;

export const upcomingEvents = [
  ["EVT-0918", "Meklit Foundation dinner", "Grand Ballroom", "Sep 18 - 180 guests", "Confirmed"],
  ["EVT-0921", "Aster Tech launch", "Garden Terrace", "Sep 21 - 120 guests", "Planning"],
  ["EVT-0924", "Board retreat lunch", "Summit Room", "Sep 24 - 42 guests", "Ready"],
  ["EVT-1002", "Diaspora gala", "Grand Ballroom", "Oct 2 - 260 guests", "Quotation"],
] as const;

export const queueRows = [
  { ref: "EVT-0918", customer: "Meklit Foundation dinner", venue: "Grand Ballroom", status: "Confirmed", lifecycle: "Preparation", readiness: 82, blocker: "Procurement shortage", nextAction: "Create purchase requirement", due: "Sep 18 - 180 guests", priority: "Critical" },
  { ref: "EVT-0921", customer: "Aster Tech launch", venue: "Garden Terrace", status: "Planning", lifecycle: "Planning", readiness: 64, blocker: "2 staff positions unassigned", nextAction: "Assign service staff", due: "Sep 21 - 120 guests", priority: "High" },
  { ref: "EVT-0924", customer: "Board retreat lunch", venue: "Summit Room", status: "Ready", lifecycle: "Ready", readiness: 96, blocker: "None", nextAction: "Confirm dispatch time", due: "Sep 24 - 42 guests", priority: "Normal" },
  { ref: "EVT-1002", customer: "Diaspora gala", venue: "Grand Ballroom", status: "Quotation", lifecycle: "Quoted", readiness: 38, blocker: "Waiting for customer", nextAction: "Follow up quotation", due: "Oct 2 - 260 guests", priority: "High" },
  { ref: "EVT-1008", customer: "Airport opening reception", venue: "Atrium", status: "Pending", lifecycle: "Inquiry", readiness: 22, blocker: "Venue not confirmed", nextAction: "Qualify lead", due: "Oct 8 - 320 guests", priority: "Critical" },
  { ref: "INV-2042", customer: "Corporate training invoice", venue: "Finance queue", status: "Overdue", lifecycle: "Reconciliation", readiness: 88, blocker: "Outstanding payment", nextAction: "Post settlement", due: "Due today", priority: "Critical" },
] as const;

export const roleDashboardTasks: Record<
  RoleKey,
  Array<{
    title: string;
    detail: string;
    status: string;
    deadline: string;
    tone: Tone;
    target: ScreenKey;
  }>
> = {
  coordinator: [
    { title: "Qualify Meklit inquiry", detail: "Customer called twice; venue preference captured.", status: "Overdue", deadline: "Due today 11:00", tone: "critical", target: "inquiry" },
    { title: "Prepare revised quotation", detail: "Discount approval needed before customer send.", status: "Pending", deadline: "Due today 15:00", tone: "warning", target: "quotations" },
    { title: "Collect deposit confirmation", detail: "Accepted quotation awaiting 30% deposit.", status: "Waiting", deadline: "Due Aug 22", tone: "warning", target: "billing" },
  ],
  manager: [
    { title: "Resolve event readiness risk", detail: "Vehicle assignment and water shortage still open.", status: "At risk", deadline: "Due today 16:00", tone: "critical", target: "operations" },
    { title: "Approve change order", detail: "Stage extension changes BEO and quotation margin.", status: "Approval", deadline: "Due tomorrow", tone: "warning", target: "quotations" },
    { title: "Review staffing coverage", detail: "Two supervisors are double-booked.", status: "Attention", deadline: "Due Aug 21", tone: "warning", target: "operations" },
  ],
  chef: [
    { title: "Approve plated dinner menu", detail: "Nut-free alternate and vegetarian yield need review.", status: "Food safety", deadline: "Due today 13:00", tone: "critical", target: "builders" },
    { title: "Release production list", detail: "Guest count changed from 160 to 180.", status: "Recalc", deadline: "Due today 17:00", tone: "warning", target: "operations" },
    { title: "Review ingredient shortage", detail: "Sparkling water and dairy cream below ATP.", status: "Shortage", deadline: "Due tomorrow", tone: "warning", target: "inventory" },
  ],
  controller: [
    { title: "Approve SIV batch", detail: "8 vouchers awaiting F&B control review.", status: "Approval", deadline: "Due today 12:00", tone: "warning", target: "inventory" },
    { title: "Investigate variance", detail: "Beverage usage is 5.5% above plan.", status: "Critical", deadline: "Due today", tone: "critical", target: "reconciliation" },
    { title: "Recalculate consumption plan", detail: "Final guest count accepted by coordinator.", status: "Pending", deadline: "Due tomorrow", tone: "warning", target: "inventory" },
  ],
  storekeeper: [
    { title: "Pick approved SIV", detail: "Grand Ballroom dinner issue required before noon.", status: "Critical", deadline: "Due today 12:00", tone: "critical", target: "inventory" },
    { title: "Post equipment movement", detail: "Projector and linen custody confirmation pending.", status: "Pending", deadline: "Due today 14:00", tone: "warning", target: "operations" },
    { title: "Receive usable returns", detail: "Draft returns from Garden Terrace need posting.", status: "Waiting", deadline: "Due tomorrow", tone: "warning", target: "reconciliation" },
  ],
  finance: [
    { title: "Post deposit payment", detail: "Bank receipt uploaded by customer portal.", status: "Pending", deadline: "Due today", tone: "critical", target: "billing" },
    { title: "Issue final invoice", detail: "Change order approved; final billing ready.", status: "Ready", deadline: "Due Aug 23", tone: "warning", target: "billing" },
    { title: "Review adjustment request", detail: "Cancellation charge waiver requires approval.", status: "Approval", deadline: "Due tomorrow", tone: "warning", target: "reports" },
  ],
};

export const screenTitles: Record<ScreenKey, string> = {
  dashboard: "Overview",
  inquiry: "Leads & Inquiries",
  events: "Events",
  calendar: "Calendar",
  customers: "Customers",
  venues: "Venues",
  workspace: "Event Workspace",
  builders: "Menus & Packages",
  quotations: "Quotations",
  operations: "Operations",
  inventory: "Inventory",
  billing: "Finance",
  reports: "Reports",
  configuration: "Configuration",
  live: "Event Execution",
  reconciliation: "Reconciliation",
  portal: "Customer Portal",
};

export const screenHeaders: Record<ScreenKey, { eyebrow: string; title: string; subtitle: string }> = {
  dashboard: { eyebrow: "Event command center", title: "Catering & Event Management", subtitle: "Start with what needs attention today, then move through Lead, Quote, Confirm, Plan, Prepare, Execute, Reconcile, and Close." },
  inquiry: { eyebrow: "Lead intake", title: "Leads & inquiries", subtitle: "Capture customer needs, event date, venue, guest count, package interest, and follow-up ownership." },
  events: { eyebrow: "Lifecycle pipeline", title: "Events", subtitle: "All company and branch-scoped events with searchable lifecycle status, readiness, blockers, and next action." },
  calendar: { eyebrow: "Event calendar", title: "Calendar", subtitle: "Day, week, and month planning for event time, setup, production, venue, and dispatch conflicts." },
  customers: { eyebrow: "Customer management", title: "Customers", subtitle: "Customer records, contacts, communication status, and pending actions." },
  venues: { eyebrow: "Venues", title: "Venues and service spaces", subtitle: "Venues, layouts, capacity, availability, and conflict indicators." },
  workspace: { eyebrow: "Central event record", title: "Event Workspace", subtitle: "One persistent event workspace for customer, menu, operations, inventory, staff, equipment, logistics, finance, reconciliation, and activity." },
  builders: { eyebrow: "Menus and packages", title: "Menus & Packages", subtitle: "Bronze, Gold, Premium, and custom packages that drive portions, requirements, staffing, equipment, cost, and selling price." },
  quotations: { eyebrow: "Quotation control", title: "Quotations", subtitle: "Drafts, approvals, revisions, customer acceptances, deposits, and version history." },
  operations: { eyebrow: "Operations command center", title: "Operations", subtitle: "Production, inventory, staffing, equipment, logistics, dispatch, readiness, and operational blockers." },
  inventory: { eyebrow: "Inventory", title: "Inventory requirements", subtitle: "Required, available, reserved, short, issued, returned, wasted, and variance lines backed by existing ERP controls." },
  billing: { eyebrow: "Finance", title: "Finance", subtitle: "Quotations, deposits, invoices, payments, settlement, outstanding balances, and finance approvals." },
  reports: { eyebrow: "Reports", title: "Reports", subtitle: "Operational, financial, profitability, readiness, and exception analytics." },
  configuration: { eyebrow: "Standards", title: "Configuration and design standards", subtitle: "Shared form behavior, states, accessibility, and reusable components." },
  live: { eyebrow: "Execution", title: "Event execution", subtitle: "Approved plan, production, dispatch, event progress, incidents, and escalations." },
  reconciliation: { eyebrow: "Close-out", title: "Reconciliation", subtitle: "Issued inventory, returns, waste, actual consumption, variance review, and closure readiness." },
  portal: { eyebrow: "Customer experience", title: "Customer portal", subtitle: "Secure customer-facing inquiry, approval, payment, document, and feedback workspace." },
};

export const lifecycleScreens: ScreenKey[] = ["workspace"];
