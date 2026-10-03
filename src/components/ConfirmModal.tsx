import { useId } from "react";
import { Button } from "./ui/button";
import { useDialogFocus } from "./ui/useDialogFocus";
type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger,
  busy,
  onConfirm,
  onClose,
}: Props) {
  const titleId=useId(),messageId=useId();
  useDialogFocus(open,!!busy,onClose);
  if (!open) return null;

  return (
    <div className="ui-dialog-backdrop"><div className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
      
        <div className="ui-dialog-header">
          <h3 id={titleId}>{title}</h3>
        </div>

        <div className="ui-dialog-body">
          <p id={messageId}>{message}</p>
        </div>

        <div className="ui-dialog-actions">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {cancelText}
          </Button>
          <Button type="button"
            variant={danger?"destructive":"default"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
