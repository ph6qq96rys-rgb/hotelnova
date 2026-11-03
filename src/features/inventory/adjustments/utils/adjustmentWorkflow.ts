// src/features/inventory/adjustments/utils/adjustmentWorkflow.ts

import { useHasPermission } from "../../../../auth/usePermissions";

export type AdjustmentStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Posted"
  | "Rejected"
  | "Reversed"
  | "Cancelled"
  | "Unknown";

/** Server DocStatus values (names, or the numbers of the enum). */
const STATUS_BY_KEY: Record<string, AdjustmentStatus> = {
  draft: "Draft",
  "0": "Draft",
  submitted: "Submitted",
  "1": "Submitted",
  approved: "Approved",
  "2": "Approved",
  posted: "Posted",
  "3": "Posted",
  rejected: "Rejected",
  "4": "Rejected",
  reversed: "Reversed",
  "5": "Reversed",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  "6": "Cancelled",
};

/** Normalises a raw status. Anything unrecognised is "Unknown", which allows no actions. */
export function normalizeAdjustmentStatus(value?: string | number | null): AdjustmentStatus {
  const key = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!key) return "Draft";
  return STATUS_BY_KEY[key] ?? "Unknown";
}

//  Transition guards (the server enforces the same rules)

export const canEdit = (s: AdjustmentStatus) => s === "Draft" || s === "Rejected";
export const canSubmit = (s: AdjustmentStatus) => s === "Draft";
export const canApprove = (s: AdjustmentStatus) => s === "Submitted";
export const canReject = (s: AdjustmentStatus) => s === "Submitted" || s === "Approved";
export const canCancel = (s: AdjustmentStatus) => s === "Draft" || s === "Rejected" || s === "Submitted" || s === "Approved";
export const canPost = (s: AdjustmentStatus) => s === "Approved";
export const canReverse = (s: AdjustmentStatus) => s === "Posted";

export const STATUS_BADGE: Record<AdjustmentStatus, string> = {
  Draft: "badge badge-neutral",
  Submitted: "badge badge-info",
  Approved: "badge badge-warn",
  Posted: "badge badge-success",
  Rejected: "badge badge-danger",
  Reversed: "badge badge-danger",
  Cancelled: "badge badge-neutral",
  Unknown: "badge badge-neutral",
};

export const STATUS_LABEL: Record<AdjustmentStatus, string> = {
  Draft: "Draft",
  Submitted: "Waiting for approval",
  Approved: "Approved, ready to post",
  Posted: "Posted to stock",
  Rejected: "Rejected, needs correction",
  Reversed: "Reversed",
  Cancelled: "Cancelled",
  Unknown: "Unknown",
};

/** What the signed-in user may do with adjustments. */
export function useAdjustmentPermissions() {
  const view = useHasPermission("inventory.adjustments.view");
  const create = useHasPermission("inventory.adjustments.create");
  const approve = useHasPermission("inventory.adjustments.approve");
  const post = useHasPermission("inventory.adjustments.post");
  const reverse = useHasPermission("inventory.adjustments.cancel");
  return { view, create, approve, post, reverse };
}

export type AdjustmentPermissions = ReturnType<typeof useAdjustmentPermissions>;

/** Actions the user can take on a document in this status. */
export function availableActions(status: AdjustmentStatus, can: AdjustmentPermissions) {
  return {
    edit: canEdit(status) && can.create,
    submit: canSubmit(status) && can.create,
    approve: canApprove(status) && can.approve,
    reject: canReject(status) && can.approve,
    cancel: canCancel(status) && (can.create || can.approve),
    post: canPost(status) && can.post,
    reverse: canReverse(status) && can.reverse,
  };
}

export type AvailableActions = ReturnType<typeof availableActions>;

export const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  StockCount: "Stock count",
  Variance: "Unexplained variance",
  Correction: "Correction",
  Waste: "Waste",
  Spoilage: "Spoilage",
  Expiry: "Expired",
  Damage: "Damage / breakage",
  Other: "Other",
};

export const WRITE_OFF_TYPES = new Set(["Waste", "Spoilage", "Expiry", "Damage"]);
