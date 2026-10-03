import { useEffect, useId, useState, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useDialogFocus } from "../../../components/ui/useDialogFocus";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { formatAppDate, formatAppDateTime } from "../../../shared/datetime/dateFormat";
import { toUserFriendlyError } from "../../../shared/errors/errorMessage.utils";
import { useI18n } from "../../../i18n";
import "./p2p.css";

/** Accepts either a plain array or a paged envelope ({ items }) — e.g. GET /branches returns PagedResult. */
export function asItems<T>(data: T[] | { items?: T[] | null } | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

export function useCompanyId(): string {
  const { companyId } = useParams<{ companyId: string }>();
  return companyId ?? "";
}

export function money(value?: number | null, currencyCode?: string | null): string {
  return formatCurrency(value ?? 0, currencyCode ?? undefined);
}

export function qty(value?: number | null): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0";
}

export function date(value?: string | null): string {
  return value ? formatAppDate(value) : "-";
}

export function dateTime(value?: string | null): string {
  return value ? formatAppDateTime(value) : "-";
}

export function todayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** Maps API failures (incl. 409 stale version) to a readable message. */
export function apiError(error: unknown, fallback: string): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 409) {
    const message = toUserFriendlyError(error, "");
    return message || "This document was changed by someone else. Reload and try again.";
  }
  return toUserFriendlyError(error, fallback);
}

const STATUS_TONE: Record<string, string> = {
  draft: "neutral",
  pendingapproval: "warning",
  pendingfinanceapproval: "warning",
  pendingfnbapproval: "warning",
  submitted: "warning",
  onhold: "warning",
  pendingreview: "warning",
  suspended: "danger",
  partiallyreceived: "info",
  partiallypaid: "info",
  sourcing: "info",
  sent: "info",
  ordered: "info",
  matched: "info",
  approved: "success",
  received: "success",
  completed: "success",
  posted: "success",
  paid: "success",
  active: "success",
  closed: "neutral",
  inactive: "neutral",
  unpaid: "neutral",
  returned: "warning",
  blocked: "danger",
  rejected: "danger",
  cancelled: "danger",
  quantityvariance: "danger",
  pricevariance: "danger",
  quantityandpricevariance: "danger",
  invalidreference: "danger",
  notapplicable: "neutral",
};

export function StatusChip({ status }: { status?: string | null }) {
  const { tx } = useI18n();
  const value = status ?? "";
  const tone = STATUS_TONE[value.toLowerCase()] ?? "neutral";
  return <span className={`p2p-chip p2p-chip--${tone}`}>{tx(splitWords(value))}</span>;
}

export function splitWords(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

type LabeledSelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode };
export function LabeledSelect({ label, id, children, ...props }: LabeledSelectProps) {
  const generated = useId();
  const control = id ?? generated;
  return (
    <div className="ui-field">
      <label htmlFor={control}>{label}{props.required && <span aria-hidden="true"> *</span>}</label>
      <Select id={control} {...props}>{children}</Select>
    </div>
  );
}

type LabeledTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string };
export function LabeledTextarea({ label, id, ...props }: LabeledTextareaProps) {
  const generated = useId();
  const control = id ?? generated;
  return (
    <div className="ui-field">
      <label htmlFor={control}>{label}{props.required && <span aria-hidden="true"> *</span>}</label>
      <Textarea id={control} {...props} />
    </div>
  );
}

export function Pager({
  page,
  pageSize,
  totalCount,
  onPage,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPage: (page: number) => void;
}) {
  const { tx } = useI18n();
  const pages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));
  if (totalCount <= pageSize) return <div className="p2p-pager"><span>{totalCount} {tx("records")}</span></div>;
  return (
    <div className="p2p-pager">
      <span>{tx("Page")} {page} / {pages} · {totalCount} {tx("records")}</span>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>{tx("Previous")}</Button>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>{tx("Next")}</Button>
    </div>
  );
}

export function Metric({ label, value, tone }: { label: string; value: ReactNode; tone?: "warning" | "danger" | "success" }) {
  return (
    <div className={`p2p-metric${tone ? ` p2p-metric--${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function DetailItem({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "p2p-detail p2p-detail--wide" : "p2p-detail"}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

/**
 * Dialog that asks for an optional/required comment before running an action.
 * Used for approve/return/cancel/close decisions so reasons land in the audit trail.
 */
export function ActionDialog({
  open,
  title,
  message,
  confirmText,
  danger,
  commentLabel,
  commentRequired,
  busy,
  children,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmText: string;
  danger?: boolean;
  commentLabel?: string;
  commentRequired?: boolean;
  busy?: boolean;
  children?: ReactNode;
  onConfirm: (comment: string) => void;
  onClose: () => void;
}) {
  const { tx } = useI18n();
  const titleId = useId();
  const [comment, setComment] = useState("");
  useDialogFocus(open, !!busy, onClose);
  useEffect(() => {
    if (open) setComment("");
  }, [open]);
  if (!open) return null;
  const blocked = !!commentRequired && !comment.trim();
  return (
    <div className="ui-dialog-backdrop">
      <div className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="ui-dialog-header"><h3 id={titleId}>{title}</h3></div>
        <div className="ui-dialog-body p2p-dialog-body">
          {message && <p>{message}</p>}
          {children}
          {commentLabel && (
            <LabeledTextarea
              label={commentLabel}
              required={commentRequired}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          )}
        </div>
        <div className="ui-dialog-actions">
          <Button variant="outline" onClick={onClose} disabled={busy}>{tx("Cancel")}</Button>
          <Button variant={danger ? "destructive" : "default"} onClick={() => onConfirm(comment.trim())} disabled={busy || blocked}>
            {busy ? tx("Working...") : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Low-frequency, lifecycle-ending actions (amend, close, cancel, status changes) kept away from the header. */
export function ManageCard({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <section className="ui-card">
      <div className="ui-card-content p2p-manage">
        <div>
          <h2>{title}</h2>
          <p>{detail}</p>
        </div>
        <div className="p2p-actions">{children}</div>
      </div>
    </section>
  );
}

export function Progress({ percent }: { percent: number }) {
  const value = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return (
    <span className="p2p-progress" aria-label={`${value}%`}>
      <span className="p2p-progress-track" aria-hidden="true"><span className="p2p-progress-fill" style={{ width: `${value}%` }} /></span>
      {value}%
    </span>
  );
}

export function BackButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <Button variant="ghost" onClick={() => navigate(to)}>
      <ArrowLeft size={16} aria-hidden="true" />
      {label}
    </Button>
  );
}
