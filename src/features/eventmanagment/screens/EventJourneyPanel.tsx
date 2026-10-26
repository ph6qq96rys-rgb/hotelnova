import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, Circle, CircleDashed, MinusCircle } from "lucide-react";
import { StateMessage } from "../../../components/ui/Feedback";
import {
  getCateringEventJourney,
  workflowStepTarget,
  type CateringEventJourney,
  type CateringWorkflowStep,
} from "../api/cateringManagementApi";
import { cateringPath } from "../components/CateringLayout";
import { readApiError } from "../sales/ui";
import "./workflow-board.css";

const STAGE_LABEL: Record<string, string> = {
  deposit: "Deposit",
  planning: "Planning",
  delivery: "Delivery",
  closeout: "Close-out",
};

function StepIcon({ state }: { state: CateringWorkflowStep["state"] }) {
  if (state === "done") return <CheckCircle2 size={16} aria-hidden="true" />;
  if (state === "missed") return <MinusCircle size={16} aria-hidden="true" />;
  if (state === "optional") return <CircleDashed size={16} aria-hidden="true" />;
  return <Circle size={16} aria-hidden="true" />;
}

const STATE_TEXT: Record<CateringWorkflowStep["state"], string> = {
  done: "done",
  todo: "to do",
  optional: "optional",
  missed: "skipped",
};

/**
 * Where the event is in the workflow: the six stages, the next step with a link to where it is done, and the full
 * checklist. Computed by the server from the event's documents, so it is always current.
 */
export function EventJourneyPanel({ companyId, eventId, revision }: { companyId: string; eventId: string; revision: number }) {
  const { pathname } = useLocation();
  const [journey, setJourney] = useState<CateringEventJourney | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getCateringEventJourney(companyId, eventId, controller.signal)
      .then((data) => !controller.signal.aborted && setJourney(data))
      .catch((e) => !controller.signal.aborted && setError(readApiError(e)));
    return () => controller.abort();
  }, [companyId, eventId, revision]);

  if (error) return <div className="ew-journey"><StateMessage tone="error">{error}</StateMessage></div>;
  if (!journey || journey.eventId !== eventId) return <div className="ew-journey"><StateMessage tone="loading">Loading the checklist…</StateMessage></div>;

  const href = (step: CateringWorkflowStep) => cateringPath(pathname, workflowStepTarget(eventId, step.tab));
  const groups = ["deposit", "planning", "delivery", "closeout"].map((stage) => ({
    stage,
    steps: journey.steps.filter((s) => s.stage === stage),
  }));

  return (
    <div className="ew-journey">
      <ol className="ew-journey-stages" aria-label="Workflow stage">
        {journey.stages.map((s) => (
          <li key={s.key} className={`is-${s.state}`} aria-current={s.state === "current" ? "step" : undefined}>
            {s.label}
          </li>
        ))}
      </ol>

      {journey.stage === "cancelled" ? <StateMessage tone="warning">This event is cancelled.</StateMessage> : null}
      {journey.stage === "done" ? <StateMessage tone="success">Event closed. Everything on the checklist is done.</StateMessage> : null}

      {journey.next ? (
        <div className="ew-next">
          <div>
            <strong>Next: {journey.next.action ?? journey.next.label}</strong>
            {journey.next.detail ? <p>{journey.next.detail}</p> : null}
          </div>
          <Link className="co-primary" to={href(journey.next)}>
            {journey.next.action ?? "Open"}
          </Link>
        </div>
      ) : null}

      {journey.alerts.map((alert) => (
        <StateMessage key={alert} tone="warning">
          {alert}
        </StateMessage>
      ))}

      <div className="ew-checklist">
        {groups.map((group) => (
          <section key={group.stage} aria-label={STAGE_LABEL[group.stage]}>
            <h3>{STAGE_LABEL[group.stage]}</h3>
            <ul>
              {group.steps.map((step) => (
                <li key={step.key} className={`ew-step ew-step--${step.state}`}>
                  <StepIcon state={step.state} />
                  <span>
                    {step.state === "todo" || step.state === "optional" ? <Link to={href(step)}>{step.label}</Link> : step.label}
                    <span className="sr-only"> ({STATE_TEXT[step.state]})</span>
                    {step.state !== "done" && step.detail ? <small>{step.detail}</small> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
