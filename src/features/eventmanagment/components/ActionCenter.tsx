// src/features/eventmanagment/components/ActionCenter.tsx
//
// Renders the guided actions for a screen. Each action opens a dialog showing
// the parameters that will actually be sent, instead of firing a hardcoded
// payload from a click handler.

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import {
  initialValues,
  type ActionContext,
  type ActionSpec,
  type ActionValues,
} from "../workspace/eventActions";

type ActionCenterProps = {
  title: string;
  actions: ActionSpec[];
  context: ActionContext | null;
  /** Why actions are unavailable, shown in place of the buttons. */
  disabledReason?: string | null;
  onCompleted: (action: ActionSpec) => void;
};

export function ActionCenter({
  title,
  actions,
  context,
  disabledReason,
  onCompleted,
}: ActionCenterProps) {
  const [openAction, setOpenAction] = useState<ActionSpec | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  if (!actions.length) return null;

  return (
    <section className="erp-action-center">
      <header className="erp-action-center__head">
        <strong>{title}</strong>
        {disabledReason ? <span>{disabledReason}</span> : <span>Each action confirms its parameters before running.</span>}
      </header>

      <div className="erp-action-center__buttons">
        {actions.map((action) => (
          <button
            className={`erp-button${action.destructive ? " erp-button--destructive" : ""}`}
            disabled={!context}
            key={action.key}
            onClick={() => {
              setLastResult(null);
              setOpenAction(action);
            }}
            title={action.description}
            type="button"
          >
            {action.title}
          </button>
        ))}
      </div>

      {lastResult ? <small className="erp-action-center__result">{lastResult}</small> : null}

      {openAction && context ? (
        <ActionDialog
          action={openAction}
          context={context}
          onClose={() => setOpenAction(null)}
          onSuccess={(action) => {
            setOpenAction(null);
            setLastResult(`${action.title} completed.`);
            onCompleted(action);
          }}
        />
      ) : null}
    </section>
  );
}

type ActionDialogProps = {
  action: ActionSpec;
  context: ActionContext;
  onClose: () => void;
  onSuccess: (action: ActionSpec) => void;
};

function ActionDialog({ action, context, onClose, onSuccess }: ActionDialogProps) {
  const [values, setValues] = useState<ActionValues>(() => initialValues(action));
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const missingRequired = action.fields.some(
    (field) =>
      field.kind === "text" &&
      field.required &&
      !String(values[field.name] ?? "").trim(),
  );

  const confirmSatisfied =
    !action.destructive || confirmText.trim().toUpperCase() === (action.confirmWord ?? "CONFIRM");

  const canSubmit = !busy && !missingRequired && confirmSatisfied;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await action.run(context, values);
      onSuccess(action);
    } catch (cause) {
      setError(readError(cause));
      setBusy(false);
    }
  }

  return (
    <div className="erp-dialog-backdrop" role="presentation">
      <section
        aria-labelledby={`action-${action.key}-title`}
        aria-modal="true"
        className="erp-dialog"
        role="dialog"
      >
        <header className="erp-dialog__head">
          <div>
            <h3 id={`action-${action.key}-title`}>{action.title}</h3>
            <p>{action.description}</p>
          </div>
          <button
            aria-label="Close"
            className="erp-icon-button"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </header>

        {action.fields.length ? (
          <div className="erp-dialog__fields">
            {action.fields.map((field) => (
              <Field
                field={field}
                key={field.name}
                onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
                value={values[field.name]}
              />
            ))}
          </div>
        ) : (
          <p className="erp-dialog__note">This action takes no parameters.</p>
        )}

        {action.destructive ? (
          <label className="erp-dialog__confirm">
            <span>
              <AlertTriangle size={14} /> This changes committed records. Type{" "}
              <code>{action.confirmWord ?? "CONFIRM"}</code> to continue.
            </span>
            <input
              autoComplete="off"
              disabled={busy}
              onChange={(event) => setConfirmText(event.target.value)}
              value={confirmText}
            />
          </label>
        ) : null}

        {error ? (
          <p className="erp-dialog__error" role="alert">
            <AlertTriangle size={14} /> {error}
          </p>
        ) : null}

        <footer className="erp-dialog__foot">
          <button className="erp-button" disabled={busy} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={`erp-button erp-button--primary${action.destructive ? " erp-button--destructive" : ""}`}
            disabled={!canSubmit}
            onClick={() => void submit()}
            type="button"
          >
            {busy ? <Loader2 className="is-spinning" size={15} /> : null}
            {busy ? "Working" : action.submitLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ActionSpec["fields"][number];
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
}): ReactNode {
  if (field.kind === "toggle") {
    return (
      <label className="erp-field erp-field--toggle">
        <input
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          <strong>{field.label}</strong>
          {field.help ? <small>{field.help}</small> : null}
        </span>
      </label>
    );
  }

  if (field.kind === "number") {
    return (
      <label className="erp-field">
        <span>
          <strong>{field.label}</strong>
          {field.help ? <small>{field.help}</small> : null}
        </span>
        <input
          max={field.max}
          min={field.min}
          onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
          step={field.step ?? 1}
          type="number"
          value={typeof value === "number" || typeof value === "string" ? value : ""}
        />
      </label>
    );
  }

  return (
    <label className="erp-field">
      <span>
        <strong>
          {field.label}
          {field.required ? " *" : ""}
        </strong>
        {field.help ? <small>{field.help}</small> : null}
      </span>
      {field.multiline ? (
        <textarea
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          value={typeof value === "string" ? value : ""}
        />
      ) : (
        <input
          onChange={(event) => onChange(event.target.value)}
          type="text"
          value={typeof value === "string" ? value : ""}
        />
      )}
    </label>
  );
}

function readError(cause: unknown): string {
  if (cause && typeof cause === "object") {
    const response = (cause as { response?: { data?: unknown; status?: number } }).response;
    const data = response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      for (const key of ["detail", "title", "message", "error"]) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) return value;
      }
    }
    if (response?.status) return `Request failed with status ${response.status}.`;
  }
  if (cause instanceof Error && cause.message) return cause.message;
  return "The action failed. No further detail was returned.";
}
