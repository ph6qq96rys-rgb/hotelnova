// src/features/inventory/adjustments/components/AdjustmentWorkflowActionBar.tsx

import {
  canApprove,
  canEdit,
  canPost,
  canReject,
  canReverse,
  canSubmit,
  normalizeAdjustmentStatus,
} from "../utils/adjustmentWorkflow";

interface Props {
  status:     string | number;
  working?:   boolean;
  onEdit?:    () => void;
  onSubmit?:  () => void;
  onApprove?: () => void;
  onReject?:  () => void;
  onPost?:    () => void;
  onReverse?: () => void;
}

export default function AdjustmentWorkflowActionBar({
  status,
  working = false,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onPost,
  onReverse,
}: Props) {
  const s = normalizeAdjustmentStatus(status);

  const none =
    !canEdit(s) && !canSubmit(s) && !canApprove(s) &&
    !canReject(s) && !canPost(s) && !canReverse(s);

  if (none) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
      }}
    >
      {canEdit(s) && (
        <button className="btn" disabled={working} onClick={onEdit}>
          <i className="ti ti-pencil" aria-hidden /> Edit draft
        </button>
      )}

      {canSubmit(s) && (
        <button className="btn btn-primary" disabled={working} onClick={onSubmit}>
          <i className="ti ti-send" aria-hidden />
          {working ? "Submitting…" : "Submit for review"}
        </button>
      )}

      {canApprove(s) && (
        <button className="btn btn-success" disabled={working} onClick={onApprove}>
          <i className="ti ti-thumb-up" aria-hidden />
          {working ? "Approving…" : "Approve"}
        </button>
      )}

      {canReject(s) && (
        <button className="btn btn-danger" disabled={working} onClick={onReject}
          style={{ background: "transparent" }}>
          <i className="ti ti-thumb-down" aria-hidden />
          Reject
        </button>
      )}

      {canPost(s) && (
        <button className="btn btn-primary" disabled={working} onClick={onPost}>
          <i className="ti ti-circle-check" aria-hidden />
          {working ? "Posting…" : "Post to inventory"}
        </button>
      )}

      {canReverse(s) && (
        <button className="btn btn-danger" disabled={working} onClick={onReverse}
          style={{ background: "transparent" }}>
          <i className="ti ti-rotate-clockwise-2" aria-hidden />
          Reverse
        </button>
      )}
    </div>
  );
}