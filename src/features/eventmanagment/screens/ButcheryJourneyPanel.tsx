import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { StateMessage } from "../../../components/ui/Feedback";
import { getButcheryBatchJourney, type ButcheryBatchJourney } from "../api/butcheryManagementApi";
import { readApiError } from "../sales/ui";
import "./workflow-board.css";

/**
 * Where the selected cutting order is: its stages, the next step (done with the buttons on this page) and the
 * checklist. Computed by the server from the batch, so it changes as soon as the order does.
 */
export function ButcheryJourneyPanel({ companyId, batchId, revision }: { companyId: string; batchId: string; revision: string }) {
  const [journey, setJourney] = useState<ButcheryBatchJourney | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getButcheryBatchJourney(companyId, batchId, controller.signal)
      .then((data) => !controller.signal.aborted && setJourney(data))
      .catch((e) => !controller.signal.aborted && setError(readApiError(e)));
    return () => controller.abort();
  }, [companyId, batchId, revision]);

  if (error) return <div className="ew-journey"><StateMessage tone="error">{error}</StateMessage></div>;
  if (!journey || journey.batchId !== batchId) return null;

  return (
    <div className="ew-journey">
      <ol className="ew-journey-stages ew-journey-stages--5" aria-label="Cutting order stage">
        {journey.stages.map((s) => (
          <li key={s.key} className={`is-${s.state}`} aria-current={s.state === "current" ? "step" : undefined}>
            {s.label}
          </li>
        ))}
      </ol>
      {journey.stage === "cancelled" ? <StateMessage tone="warning">This cutting order is {journey.status.toLowerCase()}.</StateMessage> : null}
      {journey.next ? (
        <div className="ew-next">
          <div>
            <strong>Next: {journey.next.action ?? journey.next.label}</strong>
            {journey.next.detail ? <p>{journey.next.detail}</p> : null}
          </div>
        </div>
      ) : journey.stage === "done" ? (
        <StateMessage tone="success">Posted to stock. Print labels or review the yield.</StateMessage>
      ) : null}
      {journey.alerts.map((alert) => (
        <StateMessage key={alert} tone="warning">
          {alert}
        </StateMessage>
      ))}
      <ul className="ew-checklist ew-checklist--flat">
        {journey.steps.map((step) => (
          <li key={step.key} className={`ew-step ew-step--${step.state}`}>
            {step.state === "done" ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
            <span>
              {step.label}
              <span className="sr-only"> ({step.state === "done" ? "done" : "to do"})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
