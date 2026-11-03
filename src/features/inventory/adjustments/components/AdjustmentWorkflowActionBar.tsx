// src/features/inventory/adjustments/components/AdjustmentWorkflowActionBar.tsx

import type { AvailableActions } from "../utils/adjustmentWorkflow";
import { Button } from "../../../../components/ui/button";

interface Props {
  actions: AvailableActions;
  working?: boolean;
  onEdit?: () => void;
  onSubmit?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onPost?: () => void;
  onReverse?: () => void;
}

/** Workflow buttons for the actions the user may take on the document as it stands. */
export default function AdjustmentWorkflowActionBar({
  actions,
  working = false,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onCancel,
  onPost,
  onReverse,
}: Props) {
  const shown = [
    actions.edit && onEdit,
    actions.submit && onSubmit,
    actions.approve && onApprove,
    actions.reject && onReject,
    actions.cancel && onCancel,
    actions.post && onPost,
    actions.reverse && onReverse,
  ].some(Boolean);

  if (!shown) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        padding: "10px 14px",
        marginBottom: 16,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
      }}
    >
      {actions.edit && onEdit && (
        <Button variant="bare" type="button" className="btn" disabled={working} onClick={onEdit}>
          <i className="ti ti-pencil" aria-hidden /> Edit
        </Button>
      )}

      {actions.submit && onSubmit && (
        <Button variant="bare" type="button" className="btn btn-primary" disabled={working} onClick={onSubmit}>
          <i className="ti ti-send" aria-hidden /> Submit
        </Button>
      )}

      {actions.approve && onApprove && (
        <Button variant="bare" type="button" className="btn btn-success" disabled={working} onClick={onApprove}>
          <i className="ti ti-thumb-up" aria-hidden /> Approve
        </Button>
      )}

      {actions.reject && onReject && (
        <Button variant="bare" type="button" className="btn btn-danger" disabled={working} onClick={onReject} style={{ background: "transparent" }}>
          <i className="ti ti-thumb-down" aria-hidden /> Reject
        </Button>
      )}

      {actions.post && onPost && (
        <Button variant="bare" type="button" className="btn btn-primary" disabled={working} onClick={onPost}>
          <i className="ti ti-circle-check" aria-hidden /> Post to stock
        </Button>
      )}

      {actions.reverse && onReverse && (
        <Button variant="bare" type="button" className="btn btn-danger" disabled={working} onClick={onReverse} style={{ background: "transparent" }}>
          <i className="ti ti-rotate-clockwise-2" aria-hidden /> Reverse
        </Button>
      )}

      {actions.cancel && onCancel && (
        <Button variant="bare" type="button" className="btn" disabled={working} onClick={onCancel} style={{ marginLeft: "auto" }}>
          <i className="ti ti-ban" aria-hidden /> Cancel adjustment
        </Button>
      )}
    </div>
  );
}
