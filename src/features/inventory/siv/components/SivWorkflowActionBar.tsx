// src/features/inventory/siv/components/SivWorkflowActionBar.tsx
// Replaced: lux-btn-* dark-only classes with global .btn .btn-primary .btn-danger etc.
// Removed: inline <style> block - buttons now use global.css

import { getAllowedSivActions, type SivWorkflowAction } from "../utils/sivWorkflow";
import { useI18n } from "../../../../i18n";

type Props = {
  status?:           unknown;
  busy?:             boolean;
  onEdit?:           () => void;
  onSubmit?:         () => void;
  onApprove?:        () => void;
  onRequestChanges?: () => void;
  onReject?:         () => void;
  onIssue?:          () => void;
  onPost?:           () => void;
  onReverse?:        () => void;
  onPrint?:          () => void;
  onRefresh?:        () => void;
};

export default function SivWorkflowActionBar(props: Props) {
  const { tx } = useI18n();
  const actions  = getAllowedSivActions(props.status);
  const disabled = !!props.busy;

  function render(action: SivWorkflowAction) {
    switch (action) {
      case "edit":
        return (
          <button key={action} className="btn" onClick={props.onEdit} disabled={disabled}>
            <i className="ti ti-pencil" aria-hidden /> {tx("Edit")}
          </button>
        );
      case "submit":
        return (
          <button key={action} className="btn btn-primary" onClick={props.onSubmit} disabled={disabled}>
            <i className="ti ti-send" aria-hidden /> {tx("Submit")}
          </button>
        );
      case "approve":
        return (
          <button key={action} className="btn btn-success" onClick={props.onApprove} disabled={disabled}>
            <i className="ti ti-circle-check" aria-hidden /> {tx("Approve")}
          </button>
        );
      case "requestChanges":
        return (
          <button key={action} className="btn" onClick={props.onRequestChanges} disabled={disabled}>
            <i className="ti ti-rotate-ccw" aria-hidden /> {tx("Request changes")}
          </button>
        );
      case "reject":
        return (
          <button key={action} className="btn btn-danger" onClick={props.onReject} disabled={disabled}>
            <i className="ti ti-x" aria-hidden /> {tx("Reject")}
          </button>
        );
      case "issue":
        return (
          <button key={action} className="btn btn-primary" onClick={props.onIssue} disabled={disabled}>
            <i className="ti ti-arrow-bar-right" aria-hidden /> {tx("Issue")}
          </button>
        );
      case "post":
        return (
          <button key={action} className="btn btn-primary" onClick={props.onPost} disabled={disabled}>
            <i className="ti ti-check" aria-hidden /> {tx("Post")}
          </button>
        );
      case "reverse":
        return (
          <button key={action} className="btn btn-danger" onClick={props.onReverse} disabled={disabled}>
            <i className="ti ti-arrow-back-up" aria-hidden /> {tx("Reverse")}
          </button>
        );
      case "print":
        return (
          <button key={action} className="btn" onClick={props.onPrint} disabled={disabled}>
            <i className="ti ti-printer" aria-hidden /> {tx("Print")}
          </button>
        );
      case "refresh":
        return (
          <button key={action} className="btn" onClick={props.onRefresh} disabled={disabled}>
            <i className="ti ti-refresh" aria-hidden />
            {disabled ? tx("Loading...") : tx("Refresh")}
          </button>
        );
      default:
        return null;
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {actions.map(render)}
    </div>
  );
}
