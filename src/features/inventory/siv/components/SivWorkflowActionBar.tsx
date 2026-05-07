import { CheckCircle2, RotateCcw, Send, XCircle, Undo2, Printer, RefreshCcw, Pencil } from "lucide-react";
import { getAllowedSivActions, type SivWorkflowAction } from "../utils/sivWorkflow";

type Props = {
  status?: unknown;
  busy?: boolean;
  onEdit?: () => void;
  onSubmit?: () => void;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  onReject?: () => void;
  onIssue?: () => void;
  onPost?: () => void;
  onReverse?: () => void;
  onPrint?: () => void;
  onRefresh?: () => void;
};

export default function SivWorkflowActionBar(props: Props) {
  const actions = getAllowedSivActions(props.status);

  function renderAction(action: SivWorkflowAction) {
    const disabled = !!props.busy;

    switch (action) {
      case "edit":
        return (
          <button key={action} className="lux-btn lux-btn-secondary" onClick={props.onEdit} disabled={disabled}>
            <Pencil size={16} />
            Edit
          </button>
        );

      case "submit":
        return (
          <button key={action} className="lux-btn lux-btn-primary" onClick={props.onSubmit} disabled={disabled}>
            <Send size={16} />
            Submit
          </button>
        );

      case "approve":
        return (
          <button key={action} className="lux-btn lux-btn-success" onClick={props.onApprove} disabled={disabled}>
            <CheckCircle2 size={16} />
            Approve
          </button>
        );

      case "requestChanges":
        return (
          <button key={action} className="lux-btn lux-btn-warning" onClick={props.onRequestChanges} disabled={disabled}>
            <RotateCcw size={16} />
            Request Changes
          </button>
        );

      case "reject":
        return (
          <button key={action} className="lux-btn lux-btn-danger" onClick={props.onReject} disabled={disabled}>
            <XCircle size={16} />
            Reject
          </button>
        );

      case "issue":
        return (
          <button key={action} className="lux-btn lux-btn-primary" onClick={props.onIssue} disabled={disabled}>
            <CheckCircle2 size={16} />
            Issue
          </button>
        );

      case "post":
        return (
          <button key={action} className="lux-btn lux-btn-success" onClick={props.onPost} disabled={disabled}>
            <CheckCircle2 size={16} />
            Post
          </button>
        );

      case "reverse":
        return (
          <button key={action} className="lux-btn lux-btn-danger" onClick={props.onReverse} disabled={disabled}>
            <Undo2 size={16} />
            Reverse
          </button>
        );

      case "print":
        return (
          <button key={action} className="lux-btn lux-btn-secondary" onClick={props.onPrint} disabled={disabled}>
            <Printer size={16} />
            Print
          </button>
        );

      case "refresh":
        return (
          <button key={action} className="lux-btn lux-btn-secondary" onClick={props.onRefresh} disabled={disabled}>
            <RefreshCcw size={16} />
            Refresh
          </button>
        );

      default:
        return null;
    }
  }

  return (
    <>
      <style>{`
        .lux-btn {
          appearance: none;
          border: none;
          cursor: pointer;
          border-radius: 16px;
          padding: 12px 16px;
          font-weight: 700;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          transition: 0.18s ease;
          text-decoration: none;
        }

        .lux-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .lux-btn-primary {
          background: linear-gradient(135deg, #d8b67c 0%, #b48b4d 100%);
          color: #1f1607;
        }

        .lux-btn-secondary {
          background: rgba(255,255,255,0.04);
          color: #e5edf8;
          border: 1px solid rgba(148, 163, 184, 0.16);
        }

        .lux-btn-success {
          background: rgba(52, 211, 153, 0.18);
          color: #bbf7d0;
          border: 1px solid rgba(52, 211, 153, 0.3);
        }

        .lux-btn-warning {
          background: rgba(251, 191, 36, 0.18);
          color: #fde68a;
          border: 1px solid rgba(251, 191, 36, 0.3);
        }

        .lux-btn-danger {
          background: rgba(248, 113, 113, 0.18);
          color: #fecaca;
          border: 1px solid rgba(248, 113, 113, 0.3);
        }
      `}</style>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {actions.map(renderAction)}
      </div>
    </>
  );
}