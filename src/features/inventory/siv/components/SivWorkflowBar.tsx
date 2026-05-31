// src/features/inventory/siv/components/SivWorkflowBar.tsx
//
// Horizontal workflow progress bar shown at the top of SivDetailsPage and
// SivApprovalPage. Shows Draft → Submitted → Approved → Issued → Posted
// with the responsible role labelled under each step.

import { WORKFLOW_TRACK, WORKFLOW_ROLES, workflowStep } from "../types/sivTypes";
import type { SivStatus } from "../types/sivTypes";
import "../pages/siv-draft.css";

interface Props {
  status: SivStatus;
}

const TERMINAL: SivStatus[] = ["Rejected", "ChangesRequested", "Reversed"];
const STATUS_BADGE: Record<string, string> = {
  Draft:            "badge badge-neutral",
  Submitted:        "badge badge-info",
  Approved:         "badge badge-success",
  Rejected:         "badge badge-danger",
  ChangesRequested: "badge badge-warn",
  Issued:           "badge badge-accent",
  Posted:           "badge badge-success",
  Reversed:         "badge badge-neutral",
};

export default function SivWorkflowBar({ status }: Props) {
  const cur       = workflowStep(status);
  const isTerminal = TERMINAL.includes(status);

  return (
    <div
      style={{
        background:   "var(--surface)",
        borderBottom: "1px solid var(--border-soft)",
        padding:      "12px 20px",
        display:      "flex",
        alignItems:   "center",
        gap:          0,
        overflowX:    "auto",
        flexShrink:   0,
      }}
    >
      {WORKFLOW_TRACK.map((step, i) => {
        const done   = cur > i;
        const active = cur === i && !isTerminal;
        return (
          <div
            key={step}
            style={{ display: "flex", alignItems: "center", flex: i < WORKFLOW_TRACK.length - 1 ? "1 1 0" : "0 0 auto" }}
          >
            {/* Step node */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div
                style={{
                  width:        24,
                  height:       24,
                  borderRadius: "50%",
                  background:   done   ? "var(--success)" : active ? "var(--accent)" : "var(--surface-2)",
                  border:       `2px solid ${done ? "var(--success)" : active ? "var(--accent)" : "var(--border)"}`,
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                  fontSize:     9,
                  fontWeight:   700,
                  color:        done || active ? "#fff" : "var(--text-muted)",
                  transition:   "all 0.25s",
                  boxShadow:    active ? "0 0 0 3px var(--accent-light)" : undefined,
                  flexShrink:   0,
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <div style={{ textAlign: "center", minWidth: 70 }}>
                <div
                  style={{
                    fontSize:     9,
                    fontWeight:   active || done ? 600 : 400,
                    color:        active ? "var(--accent)" : done ? "var(--success)" : "var(--text-muted)",
                    textTransform:"uppercase",
                    letterSpacing:"0.06em",
                    whiteSpace:   "nowrap",
                  }}
                >
                  {step}
                </div>
                <div
                  style={{
                    fontSize:  8,
                    color:     "var(--text-soft)",
                    marginTop: 1,
                    whiteSpace:"nowrap",
                    fontFamily:"var(--mono)",
                  }}
                >
                  {WORKFLOW_ROLES[step]}
                </div>
              </div>
            </div>

            {/* Connector */}
            {i < WORKFLOW_TRACK.length - 1 && (
              <div
                style={{
                  flex:         "1 1 0",
                  height:       2,
                  margin:       "0 8px 22px",
                  background:   done ? "var(--success)" : "var(--border-soft)",
                  borderRadius: 1,
                  minWidth:     24,
                  transition:   "background 0.35s",
                }}
              />
            )}
          </div>
        );
      })}

      {/* Terminal status badge */}
      {isTerminal && (
        <div style={{ marginLeft: 14, paddingBottom: 22 }}>
          <span className={STATUS_BADGE[status] ?? "badge badge-neutral"}>
            {status}
          </span>
        </div>
      )}
    </div>
  );
}
