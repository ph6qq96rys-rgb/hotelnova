/** Small building blocks shared by the Mini App screens (built on the shared UI components). */
import type { ReactNode } from "react";

import { Button } from "../../components/ui/button";
import { useI18n } from "../../i18n";

export function TgField({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: ReactNode;
}) {
  return (
    <label className="tg-field">
      <span className="tg-field__label">
        {label}
        {required ? <span className="tg-field__required"> *</span> : null}
      </span>
      {children}
      {help ? <span className="tg-field__help">{help}</span> : null}
    </label>
  );
}

export function TgSegment<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  const { tx } = useI18n();
  return (
    <div className="tg-segment" role="group" aria-label={tx(label)}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {tx(option.label)}
        </Button>
      ))}
    </div>
  );
}

export function TgCardHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h3 className="tg-card__title">{title}</h3>
      {hint ? <p className="tg-card__hint">{hint}</p> : null}
    </div>
  );
}

type Tone = "success" | "warning" | "danger" | "muted" | "info";

export function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (["approved", "issued", "posted", "completed", "received", "taken"].includes(s)) return "success";
  if (["submitted", "pending", "changesrequested", "reversalrequested"].includes(s)) return "warning";
  if (["rejected", "cancelled", "canceled", "failed", "reversed"].includes(s)) return "danger";
  if (s === "draft") return "muted";
  return "info";
}

export function TgStatus({ status }: { status: string }) {
  const { tx } = useI18n();
  const tone = statusTone(status);
  const label = status.replace(/([a-z])([A-Z])/g, "$1 $2");
  return <span className={`tg-status${tone === "info" ? "" : ` tg-status--${tone}`}`}>{tx(label)}</span>;
}

export function fmtQty(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(n);
}

export function fmtDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(0, 10)
    : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
