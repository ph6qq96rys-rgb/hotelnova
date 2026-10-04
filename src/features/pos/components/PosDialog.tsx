import { useId, type ReactNode } from "react";

import { Button } from "../../../components/ui/button";
import { useDialogFocus } from "../../../components/ui/useDialogFocus";
import { useI18n } from "../../../i18n";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmText: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

/** Modal form for POS decisions (open ticket, void, cancel, reassign). */
export function PosDialog({ open, title, description, confirmText, danger, busy, confirmDisabled, children, onConfirm, onClose }: Props) {
  const { tx } = useI18n();
  const titleId = useId();
  const descriptionId = useId();
  useDialogFocus(open, !!busy, onClose);
  if (!open) return null;

  return (
    <div className="ui-dialog-backdrop">
      <div className="ui-dialog rpos-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}>
        <div className="ui-dialog-header"><h3 id={titleId}>{title}</h3></div>
        <form className="ui-dialog-body rpos-dialog-body" onSubmit={(event) => { event.preventDefault(); if (!confirmDisabled && !busy) onConfirm(); }}>
          {description ? <p id={descriptionId} className="rpos-muted">{description}</p> : null}
          {children}
          <div className="rpos-dialog-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{tx("Back")}</Button>
            <Button type="submit" variant={danger ? "destructive" : "default"} disabled={busy || confirmDisabled} aria-busy={busy}>
              {busy ? tx("Saving...") : confirmText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
