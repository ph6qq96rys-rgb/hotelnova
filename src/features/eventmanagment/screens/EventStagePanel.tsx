import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, CircleDashed, MinusCircle } from "lucide-react";
import { Button } from "../../../components/ui/button";
import type { CateringEventDto, CateringEventJourney, CateringWorkflowStep } from "../api/cateringManagementApi";
import { EventDocuments, type EventDocumentKind } from "./EventDocuments";
import { EventLifecycleCard, EventProfitabilityCard, EventStockWorkspace, type EventStockSection } from "./EventStock";
import { CateringAccountingPanel } from "./CateringAccountingPanel";

export type StageTab = "plan" | "deliver" | "closeout";
export type Area = "event" | "kitchen" | "inventory" | "finance";

/** Journey stage key → the event page that holds its steps. */
export const STAGE_TAB: Record<string, StageTab | "overview"> = {
  deposit: "overview", planning: "plan", delivery: "deliver", closeout: "closeout", done: "closeout", cancelled: "closeout",
};

/** What each checklist step opens, and which team does it. */
type Tool =
  | { kind: "stock"; only: EventStockSection[]; area: Area }
  | { kind: "documents"; only: EventDocumentKind[]; mode: "event" | "kitchen" | "finance"; area: Area }
  | { kind: "lifecycle"; area: Area }
  | { kind: "overview"; area: Area };

const TOOLS: Record<string, Tool> = {
  "reserve-stock": { kind: "stock", only: ["requirements", "reservations"], area: "inventory" },
  "production-plan": { kind: "documents", only: ["production-plans"], mode: "kitchen", area: "kitchen" },
  "staffing-plan": { kind: "documents", only: ["staffing-plans"], mode: "event", area: "event" },
  "equipment-plan": { kind: "documents", only: ["equipment-plans"], mode: "event", area: "event" },
  "issue-stock": { kind: "stock", only: ["requirements"], area: "inventory" },
  dispatch: { kind: "documents", only: ["dispatches"], mode: "event", area: "event" },
  start: { kind: "lifecycle", area: "event" },
  "dispatch-closed": { kind: "documents", only: ["dispatches"], mode: "event", area: "event" },
  returns: { kind: "stock", only: ["returns"], area: "inventory" },
  waste: { kind: "stock", only: ["waste"], area: "inventory" },
  reconcile: { kind: "stock", only: ["reconciliation"], area: "inventory" },
  "final-bill": { kind: "documents", only: ["final-bills"], mode: "finance", area: "finance" },
  payment: { kind: "overview", area: "finance" },
  complete: { kind: "lifecycle", area: "event" },
};

const TEAM: Record<Area, string> = { event: "event operations", kitchen: "the kitchen", inventory: "the stores", finance: "finance" };
const STAGE_KEY: Record<StageTab, string> = { plan: "planning", deliver: "delivery", closeout: "closeout" };
const INTRO: Record<StageTab, string> = {
  plan: "Before the event day: set aside the stock, plan what the kitchen makes, and book the people and equipment.",
  deliver: "On the event day: issue the stock to the event, send the food and equipment, and start the event on site.",
  closeout: "After the event: count what came back, settle the stock, bill the customer, collect the balance and close the event.",
};
const STATE: Record<CateringWorkflowStep["state"], { text: string; icon: ReactNode }> = {
  done: { text: "Done", icon: <CheckCircle2 size={18} aria-hidden="true" /> },
  todo: { text: "To do", icon: <Circle size={18} aria-hidden="true" /> },
  optional: { text: "Optional", icon: <CircleDashed size={18} aria-hidden="true" /> },
  missed: { text: "Skipped", icon: <MinusCircle size={18} aria-hidden="true" /> },
};

/**
 * One stage of an event as a numbered checklist. Each step shows whether it is done and opens the tool that does it,
 * right here, one at a time; the first open step is expanded. Status comes from the server's event journey.
 */
export function EventStagePanel({
  event, journey, stage, openStep, onOpenStep, canOpen, overviewHref, onChanged,
}: {
  event: CateringEventDto;
  journey: CateringEventJourney | null;
  stage: StageTab;
  /** The expanded step: a step key, "" for none, or null for the first open one. */
  openStep: string | null;
  onOpenStep: (key: string) => void;
  canOpen: (area: Area) => boolean;
  overviewHref: string;
  onChanged: () => void;
}) {
  if (!journey || journey.eventId !== event.id) return <section className="co-card"><p className="co-empty">Loading the checklist…</p></section>;
  const steps = journey.steps.filter((s) => s.stage === STAGE_KEY[stage]);
  const firstOpen = steps.find((s) => s.state === "todo") ?? steps.find((s) => s.state === "optional");
  const expanded = openStep === null ? firstOpen?.key ?? "" : openStep;
  const doneCount = steps.filter((s) => s.state === "done").length;
  const cancelled = journey.stage === "cancelled";

  return (
    <section className="ew-stage">
      <header className="ew-stage-head">
        <p>{INTRO[stage]}</p>
        <span className="co-pill">{doneCount} of {steps.length} done</span>
      </header>
      {cancelled && <p className="co-notice">This event is cancelled; nothing more needs doing here.</p>}
      <ol className="ew-stepcards">
        {steps.map((step, i) => {
          const tool = TOOLS[step.key];
          const isOpen = expanded === step.key;
          const allowed = !tool || canOpen(tool.area);
          return (
            <li key={step.key} className={`ew-stepcard ew-stepcard--${step.state}${isOpen ? " is-open" : ""}`}>
              <div className="ew-stepcard-head">
                <span className="ew-stepcard-no" aria-hidden="true">{step.state === "done" ? STATE.done.icon : i + 1}</span>
                <div className="ew-stepcard-text">
                  <strong>{step.label}</strong>
                  <small>
                    {STATE[step.state].text}
                    {step.state !== "done" && step.detail ? ` · ${step.detail}` : ""}
                    {tool && !allowed ? ` · done by ${TEAM[tool.area]}` : ""}
                  </small>
                </div>
                {tool?.kind === "overview" ? (
                  <Link className={step.state === "todo" ? "co-primary" : "ew-link-button"} to={overviewHref}>{step.action ?? "Open payments"}</Link>
                ) : tool && allowed ? (
                  <Button variant={step.state === "todo" && !isOpen ? "default" : "outline"} aria-expanded={isOpen}
                    onClick={() => onOpenStep(isOpen ? "" : step.key)}>
                    {isOpen ? "Hide" : step.state === "done" ? "View" : step.action ?? "Open"}
                  </Button>
                ) : null}
              </div>
              {isOpen && tool && allowed && (
                <div className="ew-stepcard-body">
                  {tool.kind === "stock" && <EventStockWorkspace key={step.key + event.id} event={event} onChanged={onChanged} only={tool.only} />}
                  {tool.kind === "documents" && <EventDocuments key={step.key + event.id} event={event} mode={tool.mode} only={tool.only} onChanged={onChanged} />}
                  {tool.kind === "lifecycle" && <EventLifecycleCard key={step.key + event.id} event={event} onChanged={onChanged} />}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {stage === "closeout" && canOpen("finance") && (
        <details className="ew-stage-more">
          <summary>Profitability and accounting</summary>
          <EventProfitabilityCard key={"profit" + event.id} event={event} />
          <CateringAccountingPanel key={"accounting" + event.id} companyId={event.companyId} eventId={event.id} />
        </details>
      )}
    </section>
  );
}
