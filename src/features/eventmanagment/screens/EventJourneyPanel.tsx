import { Link } from "react-router-dom";
import { StateMessage } from "../../../components/ui/Feedback";
import type { CateringEventJourney, CateringWorkflowStep } from "../api/cateringManagementApi";
import "./workflow-board.css";

/**
 * Where the event is: the stages (each opens its page), the one next step with a button to do it, and alerts.
 * The full checklist of a stage is on that stage's page. Computed by the server from the event's documents.
 */
export function EventJourneyPanel({ journey, error, eventId, stageHref, stepHref }: {
  journey: CateringEventJourney | null;
  error: string;
  eventId: string;
  stageHref: (stage: string) => string;
  stepHref: (step: CateringWorkflowStep) => string;
}) {
  if (error) return <div className="ew-journey"><StateMessage tone="error">{error}</StateMessage></div>;
  if (!journey || journey.eventId !== eventId) return <div className="ew-journey"><StateMessage tone="loading">Loading the checklist…</StateMessage></div>;

  return (
    <div className="ew-journey">
      <ol className="ew-journey-stages" aria-label="Workflow stage">
        {journey.stages.map((s) => (
          <li key={s.key} className={`is-${s.state}`} aria-current={s.state === "current" ? "step" : undefined}>
            <Link to={stageHref(s.key)}>{s.label}</Link>
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
          <Link className="co-primary" to={stepHref(journey.next)}>
            {journey.next.action ?? "Open"}
          </Link>
        </div>
      ) : null}

      {journey.alerts.map((alert) => (
        <StateMessage key={alert} tone="warning">
          {alert}
        </StateMessage>
      ))}
    </div>
  );
}
