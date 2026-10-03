// src/features/eventmanagment/workspace/lifecycle.ts
//
// Derives the operational stage of a catering event from the data already
// returned by getCateringEventScopedSnapshot. The old UI offered twelve
// workflow buttons in a flat row with no indication of which step was due;
// this turns the same backend state into an ordered pipeline so the operator
// can see where the event actually is.

import type {
  CateringEventScopedSnapshot,
  CateringOperationalSnapshot,
} from "../api/cateringManagementApi";
import { activeRows } from "./record";

export type StageState = "done" | "current" | "blocked" | "pending";

export type LifecycleStage = {
  key: string;
  label: string;
  caption: string;
  state: StageState;
  /** Route module that owns this stage, used to jump the operator there. */
  module: string;
};

type StageSeed = {
  key: string;
  label: string;
  caption: string;
  module: string;
  done: boolean;
  blocked?: boolean;
};

export function buildLifecycle(
  eventWorkspace: CateringEventScopedSnapshot | null,
  quotationSnapshot: CateringOperationalSnapshot | null,
): LifecycleStage[] {
  const event = eventWorkspace?.event ?? null;
  const menuStatus = quotationSnapshot?.menuPlan?.status ?? null;
  const reservationStatus = quotationSnapshot?.inventoryReservation?.status ?? null;
  const closure = quotationSnapshot?.closureReadiness ?? null;

  const seeds: StageSeed[] = [
    {
      key: "event",
      label: "Event confirmed",
      caption: event ? `Event ${event.eventNo}` : "Confirm the accepted quotation",
      module: "event",
      done: Boolean(event),
    },
    {
      key: "requirements",
      label: "Requirements",
      caption: "Operational requirement checklist",
      module: "event",
      done: Boolean(eventWorkspace?.requirements),
    },
    {
      key: "menu",
      label: "Menu approved",
      caption: menuStatus ? `Menu plan ${menuStatus}` : "No menu plan yet",
      module: "kitchen",
      done: menuStatus === "Approved",
      blocked: Boolean(menuStatus) && menuStatus !== "Approved",
    },
    {
      key: "forecast",
      label: "Consumption forecast",
      caption: "Portion, loss and wastage projection",
      module: "kitchen",
      done: Boolean(quotationSnapshot?.consumptionForecast),
    },
    {
      key: "reservation",
      label: "Stock reserved",
      caption: reservationStatus ? `Reservation ${reservationStatus}` : "Stock not reserved",
      module: "inventory",
      done:
        reservationStatus === "Reserved" ||
        activeRows(eventWorkspace?.reservations).length > 0,
    },
    {
      key: "production",
      label: "Production plan",
      caption: `${activeRows(eventWorkspace?.productionPlans).length} plan(s)`,
      module: "kitchen",
      done: activeRows(eventWorkspace?.productionPlans).length > 0,
    },
    {
      key: "resourcing",
      label: "Staffing & equipment",
      caption: `${activeRows(eventWorkspace?.staffingPlans).length} staffing / ${activeRows(eventWorkspace?.equipmentPlans).length} equipment`,
      module: "event",
      done:
        activeRows(eventWorkspace?.staffingPlans).length > 0 &&
        activeRows(eventWorkspace?.equipmentPlans).length > 0,
    },
    {
      key: "dispatch",
      label: "Dispatch",
      caption: `${activeRows(eventWorkspace?.dispatches).length} dispatch note(s)`,
      module: "inventory",
      done: activeRows(eventWorkspace?.dispatches).length > 0,
    },
    {
      key: "returns",
      label: "Returns & waste",
      caption: `${activeRows(eventWorkspace?.returns).length} return(s) / ${activeRows(eventWorkspace?.waste).length} waste record(s)`,
      module: "inventory",
      done:
        activeRows(eventWorkspace?.returns).length > 0 ||
        activeRows(eventWorkspace?.waste).length > 0,
    },
    {
      key: "reconciliation",
      label: "Reconciliation",
      caption: `${activeRows(eventWorkspace?.reconciliations).length} reconciliation(s)`,
      module: "finance",
      done: activeRows(eventWorkspace?.reconciliations).length > 0,
    },
    {
      key: "final-bill",
      label: "Final bill",
      caption: `${activeRows(eventWorkspace?.finalBills).length} bill(s)`,
      module: "finance",
      done: activeRows(eventWorkspace?.finalBills).length > 0,
    },
    {
      key: "closure",
      label: "Closure",
      caption: closure
        ? closure.canClose
          ? "All gates cleared"
          : `${closure.outstandingActions.length} blocker(s)`
        : "Closure readiness not evaluated",
      module: "finance",
      done: closure?.canClose === true,
      blocked: closure ? closure.canClose === false : false,
    },
  ];

  // The first not-done stage is what the operator should work on next;
  // everything after it stays pending so the pipeline reads left to right.
  const currentIndex = seeds.findIndex((seed) => !seed.done);

  return seeds.map((seed, index) => {
    let state: StageState = "pending";
    if (seed.done) state = "done";
    else if (index === currentIndex) state = seed.blocked ? "blocked" : "current";
    return { key: seed.key, label: seed.label, caption: seed.caption, module: seed.module, state };
  });
}

export function lifecycleProgress(stages: LifecycleStage[]): {
  done: number;
  total: number;
  percent: number;
  current: LifecycleStage | null;
} {
  const done = stages.filter((stage) => stage.state === "done").length;
  const current = stages.find((stage) => stage.state === "current" || stage.state === "blocked") ?? null;
  return {
    done,
    total: stages.length,
    percent: stages.length ? Math.round((done / stages.length) * 100) : 0,
    current,
  };
}
