import { StateMessage, EmptyState as SharedEmptyState } from "../../../components/ui/Feedback";
import { useDialogFocus } from "../../../components/ui/useDialogFocus";
// src/features/eventmanagment/sales/ui.tsx
//
// Shared building blocks for the sales document screens: form controls, a
// modal form shell, list/detail chrome and error handling.
//
// The previous UI rendered action buttons with no onClick, so every call to
// action was decorative. Everything here is wired: forms submit, errors from
// the API surface verbatim, and busy state blocks double submission.

import { useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Loader2, X } from "lucide-react";

/* =========================
   Errors
========================= */

export function readApiError(cause: unknown, fallback = "The request failed."): string {
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
      const errors = record.errors;
      if (errors && typeof errors === "object") {
        const messages = Object.values(errors as Record<string, unknown>)
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .filter((value): value is string => typeof value === "string");
        if (messages.length) return messages.join(" ");
      }
    }
    if (response?.status) return `${fallback} (HTTP ${response.status})`;
  }
  if (cause instanceof Error && cause.message) return cause.message;
  return fallback;
}

/* =========================
   Dates
========================= */

/** ISO string -> value for <input type="datetime-local">. */
export function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local"> value -> ISO string for the API. */
export function fromDateTimeInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

/* =========================
   Form controls
========================= */

type BaseFieldProps = {
  label: string;
  help?: string;
  required?: boolean;
  error?: string | null;
};

function FieldFrame({
  label,
  help,
  required,
  error,
  children,
}: BaseFieldProps & { children: ReactNode }) {
  return (
    <label className={`cat-field${error ? " has-error" : ""}`}>
      <span className="cat-field__label">
        {label}
        {required ? <em aria-hidden> *</em> : null}
      </span>
      {children}
      {error ? <small className="cat-field__error">{error}</small> : null}
      {!error && help ? <small className="cat-field__help">{help}</small> : null}
    </label>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
  ...frame
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel";
}) {
  return (
    <FieldFrame {...frame}>
      <input
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </FieldFrame>
  );
}

export function TextAreaField({
  value,
  onChange,
  rows = 3,
  ...frame
}: BaseFieldProps & { value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <FieldFrame {...frame}>
      <textarea onChange={(event) => onChange(event.target.value)} rows={rows} value={value} />
    </FieldFrame>
  );
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  ...frame
}: BaseFieldProps & {
  value: number | "";
  onChange: (value: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <FieldFrame {...frame}>
      <span className="cat-field__number">
        <input
          max={max}
          min={min}
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : Number(event.target.value))
          }
          step={step}
          type="number"
          value={value}
        />
        {suffix ? <em>{suffix}</em> : null}
      </span>
    </FieldFrame>
  );
}

export function SelectField<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  ...frame
}: BaseFieldProps & {
  value: T | "";
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }> | ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <FieldFrame {...frame}>
      <select onChange={(event) => onChange(event.target.value as T)} value={value}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

export function DateTimeField({
  value,
  onChange,
  ...frame
}: BaseFieldProps & { value: string; onChange: (value: string) => void }) {
  return (
    <FieldFrame {...frame}>
      <input
        onChange={(event) => onChange(event.target.value)}
        type="datetime-local"
        value={value}
      />
    </FieldFrame>
  );
}

/* =========================
   Modal form
========================= */

export function FormDialog({
  title,
  description,
  submitLabel,
  busy,
  error,
  onSubmit,
  onClose,
  destructive,
  disabled,
  children,
}: {
  title: string;
  description?: string;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
  destructive?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  useDialogFocus(true,busy,onClose);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!busy && !disabled) onSubmit();
  }

  return (
    <div className="cat-modal-backdrop" role="presentation">
      <form aria-modal="true" aria-label={title} className="cat-modal" onSubmit={handleSubmit} role="dialog">
        <header className="cat-modal__head">
          <div>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <button aria-label="Close" disabled={busy} onClick={onClose} type="button">
            <X size={16} />
          </button>
        </header>

        <div className="cat-modal__body">{children}</div>

        {error ? (
          <p className="cat-alert cat-alert--error" role="alert">
            <AlertTriangle size={15} /> {error}
          </p>
        ) : null}

        <footer className="cat-modal__foot">
          <button className="cat-btn" disabled={busy} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={`cat-btn cat-btn--primary${destructive ? " cat-btn--danger" : ""}`}
            disabled={busy || disabled}
            type="submit"
          >
            {busy ? <Loader2 className="cat-spin" size={15} /> : null}
            {busy ? "Saving" : submitLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}

/* =========================
   List / detail chrome
========================= */

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="cat-toolbar">{children}</div>;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      className="cat-search"
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      type="search"
      value={value}
    />
  );
}

export function DetailHeader({
  onBack,
  eyebrow,
  title,
  meta,
  actions,
}: {
  onBack: () => void;
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="cat-detail-head">
      <button className="cat-btn cat-btn--ghost" onClick={onBack} type="button">
        <ArrowLeft size={15} /> Back
      </button>
      <div className="cat-detail-head__title">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        {meta ? <div className="cat-detail-head__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="cat-detail-head__actions">{actions}</div> : null}
    </header>
  );
}

export function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="cat-facts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Card({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="cat-card">
      <header>
        <h3>{title}</h3>
        {meta ? <span>{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({title,detail}:{title:string;detail:string}){return <SharedEmptyState title={title} detail={detail}/>;}
export function ErrorBanner({message}:{message:string}){return <StateMessage tone="error">{message}</StateMessage>;}

export function Pill({ value }: { value: string }) {
  const tone = pillTone(value);
  return <span className={`cat-pill cat-pill--${tone}`}>{value}</span>;
}

function pillTone(value: string): string {
  const normalized = value.toLowerCase();
  if (["cancelled", "rejected", "lost", "superseded"].some((t) => normalized.includes(t))) return "danger";
  if (["draft", "new", "pending", "submitted", "contacted", "negotiating"].some((t) => normalized.includes(t))) return "warn";
  if (["accepted", "approved", "won", "confirmed", "completed", "issued"].some((t) => normalized.includes(t))) return "good";
  return "info";
}

/** Small helper so screens can run a mutation with busy/error handling. */
export function useMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(action: () => Promise<T>, onDone?: (result: T) => void) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      onDone?.(result);
      setBusy(false);
      return true;
    } catch (cause) {
      setError(readApiError(cause));
      setBusy(false);
      return false;
    }
  }

  return { busy, error, setError, run };
}
