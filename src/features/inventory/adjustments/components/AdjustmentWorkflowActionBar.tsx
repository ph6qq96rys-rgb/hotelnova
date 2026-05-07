import {
  canApproveAdjustment,
  canEditAdjustment,
  canPostAdjustment,
  canReverseAdjustment,
  canSubmitAdjustment,
  normalizeAdjustmentStatus,
} from "../utils/adjustmentWorkflow";

export default function AdjustmentWorkflowActionBar(props: {
  status: string | number;
  onEdit?: () => void;
  onSubmit?: () => void;
  onApprove?: () => void;
  onPost?: () => void;
  onReverse?: () => void;
}) {
  const status = normalizeAdjustmentStatus(props.status);

  return (
    <div className="flex items-center gap-2 rounded-2xl border bg-white p-3 shadow-sm">
      {canEditAdjustment(status) && (
        <button className="btn" onClick={props.onEdit}>
          Edit
        </button>
      )}

      {canSubmitAdjustment(status) && (
        <button className="btn btn-primary" onClick={props.onSubmit}>
          Submit
        </button>
      )}

      {canApproveAdjustment(status) && (
        <button className="btn btn-primary" onClick={props.onApprove}>
          Approve
        </button>
      )}

      {canPostAdjustment(status) && (
        <button className="btn btn-success" onClick={props.onPost}>
          Post to Ledger
        </button>
      )}

      {canReverseAdjustment(status) && (
        <button className="btn btn-danger" onClick={props.onReverse}>
          Reverse
        </button>
      )}
    </div>
  );
}