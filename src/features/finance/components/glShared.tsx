import { useId, type ReactNode } from "react";

import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Select } from "../../../components/ui/select";
import { useDialogFocus } from "../../../components/ui/useDialogFocus";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { toUserFriendlyError } from "../../../shared/errors/errorMessage.utils";
import { ACCOUNT_TYPE_LABEL, type GlAccount } from "../api/financeApi";
import "../pages/finance.css";

export const money = (value?: number | null) => formatCurrency(value ?? 0);
/** Debit/credit cells stay empty instead of showing zeros. */
export const amount = (value?: number | null) => (value ? formatCurrency(value) : "");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Ledger dates are calendar days (yyyy-MM-dd); show them without any time-zone shift. */
export const day = (value?: string | null) => {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d} ${MONTHS[Number(m) - 1]} ${y}` : value;
};
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const monthStartIso = () => `${todayIso().slice(0, 8)}01`;

export function apiError(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { detail?: string; message?: string; error?: string; title?: string } } })?.response?.data;
  const text = data?.detail || data?.message || data?.error;
  return typeof text === "string" && text.trim() ? text.trim() : toUserFriendlyError(error, fallback);
}

export function Chip({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "bad" | "info" | "muted"; children: ReactNode }) {
  return <span className={`gl-chip gl-chip--${tone}`}>{children}</span>;
}

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "gl-field gl-field--wide" : "gl-field"}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

/** Posting accounts only, grouped by statement class, as "code — name". */
export function AccountSelect({ accounts, value, onChange, manualOnly, placeholder = "Choose account", id, ariaLabel, required }: {
  accounts: GlAccount[]; value: string; onChange: (id: string) => void; manualOnly?: boolean; placeholder?: string; id?: string; ariaLabel?: string; required?: boolean;
}) {
  const usable = accounts.filter((a) => !a.isHeader && (a.isActive || a.id === value) && (!manualOnly || a.allowManualPosting || a.id === value));
  const groups = Object.entries(ACCOUNT_TYPE_LABEL).map(([type, label]) => [label, usable.filter((a) => a.type === type)] as const).filter(([, list]) => list.length > 0);
  return (
    <Select id={id} aria-label={ariaLabel} value={value} required={required} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {groups.map(([label, list]) => (
        <optgroup key={label} label={label}>
          {list.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}{a.isActive ? "" : " (inactive)"}</option>)}
        </optgroup>
      ))}
    </Select>
  );
}

type DialogProps = {
  open: boolean; title: string; description?: ReactNode; confirmText: string; busy?: boolean; danger?: boolean; confirmDisabled?: boolean;
  error?: string | null; size?: "normal" | "wide" | "full"; children?: ReactNode; onConfirm?: () => void; onClose: () => void; closeText?: string;
  /** Extra buttons shown beside Close (for dialogs that act on a record rather than submit a form). */
  actions?: ReactNode;
};

/** Modal form for finance actions. Errors appear inside the dialog, never behind it. */
export function GlDialog({ open, title, description, confirmText, busy, danger, confirmDisabled, error, size = "normal", children, onConfirm, onClose, closeText = "Cancel", actions }: DialogProps) {
  const titleId = useId();
  useDialogFocus(open, !!busy, onClose);
  if (!open) return null;
  return (
    <div className="ui-dialog-backdrop">
      <div className={`ui-dialog gl-dialog gl-dialog--${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="ui-dialog-header"><h3 id={titleId}>{title}</h3></div>
        <form className="ui-dialog-body gl-dialog-body" onSubmit={(e) => { e.preventDefault(); if (!busy && !confirmDisabled && onConfirm) onConfirm(); }}>
          {description ? <div className="gl-muted">{description}</div> : null}
          {error ? <StateMessage tone="error">{error}</StateMessage> : null}
          {children}
          <div className="gl-dialog-actions">
            {actions}
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{closeText}</Button>
            {onConfirm ? (
              <Button type="submit" variant={danger ? "destructive" : "default"} disabled={busy || confirmDisabled} aria-busy={busy}>
                {busy ? "Saving…" : confirmText}
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

export function downloadCsv(fileName: string, header: string[], rows: Array<Array<string | number | null | undefined>>) {
  const cell = (v: string | number | null | undefined) => {
    const text = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
