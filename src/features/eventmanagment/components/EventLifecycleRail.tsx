// src/features/eventmanagment/components/EventLifecycleRail.tsx
//
// Shows where the selected event actually is in its operational pipeline, and
// which stage is due next. This replaces the flat row of twelve workflow
// buttons, which gave no indication of order, prerequisite or progress.

import { CheckCircle2, Circle, CircleDot, ShieldAlert } from "lucide-react";
import { lifecycleProgress, type LifecycleStage } from "../workspace/lifecycle";

type EventLifecycleRailProps = {
  stages: LifecycleStage[];
  loading?: boolean;
  /** Navigate to the screen that owns a stage. */
  onOpenModule?: (module: string) => void;
};

export function EventLifecycleRail({ stages, loading, onOpenModule }: EventLifecycleRailProps) {
  const progress = lifecycleProgress(stages);

  return (
    <section aria-label="Event lifecycle" className="erp-lifecycle">
      <header className="erp-lifecycle__head">
        <div>
          <strong>Event lifecycle</strong>
          <span>
            {loading
              ? "Loading event state"
              : progress.current
                ? `Next: ${progress.current.label}`
                : "All stages complete"}
          </span>
        </div>
        <div className="erp-lifecycle__progress">
          <div aria-hidden className="erp-lifecycle__bar">
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <small>
            {progress.done} of {progress.total} stages
          </small>
        </div>
      </header>

      <ol className="erp-lifecycle__stages">
        {stages.map((stage) => (
          <li className={`erp-lifecycle__stage is-${stage.state}`} key={stage.key}>
            <button
              onClick={() => onOpenModule?.(stage.module)}
              title={`Open ${stage.module} screen`}
              type="button"
            >
              <span className="erp-lifecycle__icon">{stageIcon(stage.state)}</span>
              <strong>{stage.label}</strong>
              <small>{stage.caption}</small>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function stageIcon(state: LifecycleStage["state"]) {
  if (state === "done") return <CheckCircle2 size={15} />;
  if (state === "current") return <CircleDot size={15} />;
  if (state === "blocked") return <ShieldAlert size={15} />;
  return <Circle size={15} />;
}
