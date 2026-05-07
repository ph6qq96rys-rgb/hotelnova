import type { AdjustmentStatus } from "../types";

export function normalizeAdjustmentStatus(
  value?: string | number | null
): AdjustmentStatus {
  if (value == null || value === "") return "Unknown";

  const s = String(value).trim().toLowerCase().replace(/\s+/g, "");

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

    case "100":
    case "cancelled":
      return "Cancelled";

    default:
      return "Unknown";
  }
}

export function canEditAdjustment(status: AdjustmentStatus) {
  return status === "Draft";
}

export function canSubmitAdjustment(status: AdjustmentStatus) {
  return status === "Draft";
}

export function canApproveAdjustment(status: AdjustmentStatus) {
  return status === "Submitted";
}

export function canPostAdjustment(status: AdjustmentStatus) {
  return status === "Approved";
}

export function canReverseAdjustment(status: AdjustmentStatus) {
  return status === "Posted";
}