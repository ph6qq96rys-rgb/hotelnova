// src/features/inventory/adjustments/utils/adjustmentWorkflow.ts

export type AdjustmentStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Posted"
  | "Rejected"
  | "Reversed";

/** Normalises any raw value (string, number, null) to a typed status. */
export function normalizeAdjustmentStatus(
  value?: string | number | null
): AdjustmentStatus {
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  switch (s) {
    case "10":
    case "draft":
      return "Draft";
    case "20":
    case "submitted":
      return "Submitted";
    case "30":
    case "approved":
      return "Approved";
    case "60":
    case "posted":
      return "Posted";
    case "70":
    case "rejected":
      return "Rejected";
    case "90":
    case "reversed":
      return "Reversed";
    default:
      return "Draft";
  }
}

// ── Transition guards ─────────────────────────────────────────────────────────

export const canEdit    = (s: AdjustmentStatus) => s === "Draft";
export const canSubmit  = (s: AdjustmentStatus) => s === "Draft";
export const canApprove = (s: AdjustmentStatus) => s === "Submitted";
export const canReject  = (s: AdjustmentStatus) => s === "Submitted";
export const canPost    = (s: AdjustmentStatus) => s === "Approved";
export const canReverse = (s: AdjustmentStatus) => s === "Posted";

// ── Badge class map ───────────────────────────────────────────────────────────

export const STATUS_BADGE: Record<AdjustmentStatus, string> = {
  Draft:     "badge badge-neutral",
  Submitted: "badge badge-info",
  Approved:  "badge badge-warn",
  Posted:    "badge badge-success",
  Rejected:  "badge badge-danger",
  Reversed:  "badge badge-danger",
};