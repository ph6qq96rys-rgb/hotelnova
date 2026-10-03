// src/features/eventmanagment/workspace/eventActions.ts
//
// Guided replacements for the old "Workflow commands" bar.
//
// That bar fired twelve stateful backend operations from a single click each,
// with parameters invented in the click handler and no confirmation — including
// "Reserve stock", which sent replaceExistingReservation: true and silently
// discarded an existing reservation, and "Close event", which closed on one
// click with a canned remark.
//
// Every action is now declared with the parameters the endpoint actually
// accepts, so the operator sets them and can see what will be sent. Anything
// that destroys or finalises state is marked destructive and requires an
// explicit typed confirmation.
//
// Field defaults match the values the old bar hardcoded, so existing behaviour
// is reachable in one step — it is just no longer the only option.

import {
  approveEventMenuPlan,
  calculateEventConsumptionForecast,
  cateringEventApi,
  closeEvent,
  reopenEvent,
  reserveEventInventory,
  runEventConsumptionReconciliation,
  saveEventMenuPlan,
} from "../api/cateringManagementApi";

export type ActionField =
  | {
      kind: "number";
      name: string;
      label: string;
      help?: string;
      min?: number;
      max?: number;
      step?: number;
      defaultValue: number;
    }
  | {
      kind: "text";
      name: string;
      label: string;
      help?: string;
      defaultValue?: string;
      multiline?: boolean;
      required?: boolean;
    }
  | {
      kind: "toggle";
      name: string;
      label: string;
      help?: string;
      defaultValue: boolean;
    };

export type ActionValues = Record<string, string | number | boolean>;

export type ActionContext = {
  companyId: string;
  quotationId: string;
  /** Resolves (creating if needed) the catering event for the quotation. */
  ensureEventId: () => Promise<string>;
};

export type ActionSpec = {
  key: string;
  title: string;
  description: string;
  submitLabel: string;
  /** Route module this action belongs to, used to group it on each screen. */
  module: "event" | "kitchen" | "inventory" | "finance" | "butchery";
  /** Destructive actions require the operator to type the confirmation word. */
  destructive?: boolean;
  confirmWord?: string;
  fields: ActionField[];
  run: (context: ActionContext, values: ActionValues) => Promise<unknown>;
};

function num(values: ActionValues, name: string, fallback = 0): number {
  const value = values[name];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function str(values: ActionValues, name: string): string {
  const value = values[name];
  return typeof value === "string" ? value.trim() : "";
}

function optionalStr(values: ActionValues, name: string): string | null {
  return str(values, name) || null;
}

function bool(values: ActionValues, name: string): boolean {
  return values[name] === true;
}

const notesField = (label = "Notes"): ActionField => ({
  kind: "text",
  name: "notes",
  label,
  help: "Recorded against the document for audit.",
  multiline: true,
  defaultValue: "",
});

export const eventActions: ActionSpec[] = [
  // --- Kitchen -------------------------------------------------------------
  {
    key: "menu-plan",
    title: "Create or update menu plan",
    description:
      "Builds the event menu plan. Including the accepted quotation menu seeds the plan from what the customer signed off.",
    submitLabel: "Save menu plan",
    module: "kitchen",
    fields: [
      {
        kind: "toggle",
        name: "includeAcceptedQuotationMenu",
        label: "Seed from accepted quotation menu",
        help: "Copies the signed-off menu lines into the plan.",
        defaultValue: true,
      },
      {
        kind: "text",
        name: "serviceStandards",
        label: "Service standards",
        defaultValue: "Standard catering service controls",
      },
      notesField(),
    ],
    run: (context, values) =>
      saveEventMenuPlan(context.companyId, context.quotationId, {
        includeAcceptedQuotationMenu: bool(values, "includeAcceptedQuotationMenu"),
        packageVersionIds: null,
        lines: null,
        requirements: null,
        serviceStandards: optionalStr(values, "serviceStandards"),
        notes: optionalStr(values, "notes"),
      }),
  },
  {
    key: "menu-approve",
    title: "Approve menu plan",
    description:
      "Approving locks the menu for production and inventory. Reserve stock and production planning read the approved plan.",
    submitLabel: "Approve menu",
    module: "kitchen",
    destructive: true,
    confirmWord: "APPROVE",
    fields: [
      {
        kind: "text",
        name: "comments",
        label: "Approval comments",
        multiline: true,
        defaultValue: "",
      },
    ],
    run: (context, values) =>
      approveEventMenuPlan(context.companyId, context.quotationId, {
        comments: optionalStr(values, "comments"),
      }),
  },
  {
    key: "forecast",
    title: "Calculate consumption forecast",
    description:
      "Projects required quantities from the menu plan. Loss and wastage percentages materially change what gets reserved and purchased, so set them for this event.",
    submitLabel: "Calculate forecast",
    module: "kitchen",
    fields: [
      {
        kind: "number",
        name: "preparationLossPercent",
        label: "Preparation loss %",
        help: "Trim, peel and cooking loss.",
        min: 0,
        max: 100,
        step: 0.5,
        defaultValue: 5,
      },
      {
        kind: "number",
        name: "wastageAllowancePercent",
        label: "Wastage allowance %",
        help: "Service and plate waste buffer.",
        min: 0,
        max: 100,
        step: 0.5,
        defaultValue: 3,
      },
      {
        kind: "toggle",
        name: "includeStaffMeals",
        label: "Include staff meals",
        defaultValue: false,
      },
      {
        kind: "number",
        name: "staffMealCount",
        label: "Staff meal count",
        min: 0,
        step: 1,
        defaultValue: 0,
      },
      {
        kind: "toggle",
        name: "includeComplimentaryItems",
        label: "Include complimentary items",
        defaultValue: false,
      },
      {
        kind: "number",
        name: "complimentaryGuestCount",
        label: "Complimentary guest count",
        min: 0,
        step: 1,
        defaultValue: 0,
      },
      { kind: "toggle", name: "includeBeverages", label: "Include beverages", defaultValue: true },
      { kind: "toggle", name: "includePackaging", label: "Include packaging", defaultValue: true },
      { kind: "toggle", name: "includeDisposables", label: "Include disposables", defaultValue: true },
    ],
    run: (context, values) =>
      calculateEventConsumptionForecast(context.companyId, context.quotationId, {
        preparationLossPercent: num(values, "preparationLossPercent", 5),
        wastageAllowancePercent: num(values, "wastageAllowancePercent", 3),
        includeStaffMeals: bool(values, "includeStaffMeals"),
        staffMealCount: num(values, "staffMealCount"),
        includeComplimentaryItems: bool(values, "includeComplimentaryItems"),
        complimentaryGuestCount: num(values, "complimentaryGuestCount"),
        includeBeverages: bool(values, "includeBeverages"),
        includePackaging: bool(values, "includePackaging"),
        includeDisposables: bool(values, "includeDisposables"),
      }),
  },
  {
    key: "production-plan",
    title: "Generate production plan",
    description:
      "Creates kitchen production lines from the approved menu. Activating publishes the plan to the kitchen immediately.",
    submitLabel: "Generate plan",
    module: "kitchen",
    fields: [
      {
        kind: "number",
        name: "overProductionPercent",
        label: "Over-production %",
        help: "Extra production above forecast.",
        min: 0,
        max: 100,
        step: 0.5,
        defaultValue: 5,
      },
      {
        kind: "toggle",
        name: "activate",
        label: "Activate immediately",
        help: "Leave off to review the plan before the kitchen sees it.",
        defaultValue: false,
      },
      notesField(),
    ],
    run: async (context, values) =>
      cateringEventApi.generateProductionPlan(context.companyId, await context.ensureEventId(), {
        defaultProductionDueAtUtc: null,
        overProductionPercent: num(values, "overProductionPercent", 5),
        activate: bool(values, "activate"),
        notes: optionalStr(values, "notes"),
      }),
  },

  // --- Butchery ------------------------------------------------------------
  {
    key: "butchery-demand",
    title: "Generate butchery demand",
    description: "Raises carcass and cut demand for this event from the menu plan.",
    submitLabel: "Generate demand",
    module: "butchery",
    fields: [notesField()],
    run: async (context, values) =>
      cateringEventApi.generateButcheryDemand(context.companyId, await context.ensureEventId(), {
        notes: optionalStr(values, "notes"),
      }),
  },

  // --- Inventory -----------------------------------------------------------
  {
    key: "reserve-stock",
    title: "Reserve stock against forecast",
    description:
      "Holds forecast quantities so other documents cannot consume them. Replacing an existing reservation releases the current holds first and rebuilds them from the latest forecast.",
    submitLabel: "Reserve stock",
    module: "inventory",
    destructive: true,
    confirmWord: "RESERVE",
    fields: [
      {
        kind: "toggle",
        name: "replaceExistingReservation",
        label: "Replace existing reservation",
        help: "Off keeps current holds. On discards and rebuilds them — quantities already reserved are released.",
        defaultValue: false,
      },
      notesField(),
    ],
    run: (context, values) =>
      reserveEventInventory(context.companyId, context.quotationId, {
        replaceExistingReservation: bool(values, "replaceExistingReservation"),
        notes: optionalStr(values, "notes"),
      }),
  },
  {
    key: "event-reservation",
    title: "Create event reservation record",
    description: "Records an event-scoped inventory reservation document.",
    submitLabel: "Create reservation",
    module: "inventory",
    fields: [notesField()],
    run: async (context, values) =>
      cateringEventApi.createReservation(context.companyId, await context.ensureEventId(), {
        notes: optionalStr(values, "notes"),
      }),
  },
  {
    key: "procurement-requisition",
    title: "Raise procurement requisition",
    description: "Creates a purchase requisition for forecast quantities that stock cannot cover.",
    submitLabel: "Raise requisition",
    module: "inventory",
    fields: [notesField()],
    run: async (context, values) =>
      cateringEventApi.procurementRequisition(context.companyId, await context.ensureEventId(), {
        notes: optionalStr(values, "notes"),
      }),
  },

  // --- Event operations ----------------------------------------------------
  {
    key: "equipment-plan",
    title: "Generate equipment plan",
    description: "Builds the equipment requirement list for the event.",
    submitLabel: "Generate plan",
    module: "event",
    fields: [
      {
        kind: "toggle",
        name: "activate",
        label: "Activate immediately",
        defaultValue: false,
      },
      notesField(),
    ],
    run: async (context, values) =>
      cateringEventApi.generateEquipmentPlan(context.companyId, await context.ensureEventId(), {
        activate: bool(values, "activate"),
        notes: optionalStr(values, "notes"),
        lines: [],
      }),
  },
  {
    key: "staffing-plan",
    title: "Generate staffing plan",
    description: "Builds the staffing requirement list for the event.",
    submitLabel: "Generate plan",
    module: "event",
    fields: [
      {
        kind: "toggle",
        name: "activate",
        label: "Activate immediately",
        defaultValue: false,
      },
      notesField(),
    ],
    run: async (context, values) =>
      cateringEventApi.generateStaffingPlan(context.companyId, await context.ensureEventId(), {
        activate: bool(values, "activate"),
        notes: optionalStr(values, "notes"),
        lines: [],
      }),
  },

  // --- Finance -------------------------------------------------------------
  {
    key: "reconciliation",
    title: "Run consumption reconciliation",
    description:
      "Compares issued against returned and wasted quantities. The tolerance decides which variances are flagged for review.",
    submitLabel: "Run reconciliation",
    module: "finance",
    fields: [
      {
        kind: "number",
        name: "quantityTolerancePercent",
        label: "Quantity tolerance %",
        help: "Variances within this band are accepted without a flag.",
        min: 0,
        max: 100,
        step: 0.5,
        defaultValue: 5,
      },
      notesField(),
    ],
    run: (context, values) =>
      runEventConsumptionReconciliation(context.companyId, context.quotationId, {
        quantityTolerancePercent: num(values, "quantityTolerancePercent", 5),
        notes: optionalStr(values, "notes"),
      }),
  },
  {
    key: "final-bill-preview",
    title: "Preview final bill",
    description: "Calculates the final bill without committing it.",
    submitLabel: "Preview bill",
    module: "finance",
    fields: [],
    run: async (context) =>
      cateringEventApi.previewFinalBill(context.companyId, await context.ensureEventId(), {}),
  },
  {
    key: "profitability-preview",
    title: "Preview profitability",
    description: "Calculates revenue against direct cost for the event without committing the analysis.",
    submitLabel: "Preview profitability",
    module: "finance",
    fields: [],
    run: async (context) =>
      cateringEventApi.previewProfitability(context.companyId, await context.ensureEventId(), {}),
  },
  {
    key: "close-event",
    title: "Close event",
    description:
      "Closing finalises the event. Reconciliation, returns and billing must be settled first — closure gates are shown on the lifecycle rail.",
    submitLabel: "Close event",
    module: "finance",
    destructive: true,
    confirmWord: "CLOSE",
    fields: [
      {
        kind: "text",
        name: "remarks",
        label: "Closure remarks",
        help: "Required. Explains why the event is being closed now.",
        multiline: true,
        required: true,
        defaultValue: "",
      },
    ],
    run: (context, values) =>
      closeEvent(context.companyId, context.quotationId, {
        remarks: str(values, "remarks"),
      }),
  },
  {
    key: "reopen-event",
    title: "Reopen event",
    description: "Reverses a closure so post-event corrections can be made.",
    submitLabel: "Reopen event",
    module: "finance",
    destructive: true,
    confirmWord: "REOPEN",
    fields: [
      {
        kind: "text",
        name: "reason",
        label: "Reason for reopening",
        help: "Required.",
        multiline: true,
        required: true,
        defaultValue: "",
      },
    ],
    run: (context, values) =>
      reopenEvent(context.companyId, context.quotationId, {
        reason: str(values, "reason"),
      }),
  },
];

export function actionsForModule(module: ActionSpec["module"]): ActionSpec[] {
  return eventActions.filter((action) => action.module === module);
}

export function initialValues(action: ActionSpec): ActionValues {
  const values: ActionValues = {};
  for (const field of action.fields) {
    if (field.kind === "number") values[field.name] = field.defaultValue;
    else if (field.kind === "toggle") values[field.name] = field.defaultValue;
    else values[field.name] = field.defaultValue ?? "";
  }
  return values;
}
