// src/modules/company/pages/components/company.ui.tsx

import type React from "react";

export function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export function PageShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="ob-page">
      <div className="ob-page-header">
        <div>
          <div className="ob-page-title">{title}</div>
          {subtitle && <div className="ob-page-subtitle">{subtitle}</div>}
        </div>
        {action && <div className="ob-page-actions">{action}</div>}
      </div>
      {children}
    </div>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const safePct = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));

  return (
    <div className="ob-progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safePct}>
      <div className="ob-progress-fill" style={{ width: `${safePct}%` }} />
    </div>
  );
}

export function Card({
  title,
  subtitle,
  children,
  footer,
  style,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="ob-card" style={style}>
      {(title || subtitle) && (
        <div className="ob-card-header">
          {title && <div className="ob-card-title">{title}</div>}
          {subtitle && <div className="ob-card-subtitle">{subtitle}</div>}
        </div>
      )}
      <div className="ob-card-body">{children}</div>
      {footer && <div className="ob-card-footer">{footer}</div>}
    </div>
  );
}

export function InnerCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="ob-inner-card">
      {(title || subtitle) && (
        <div className="ob-inner-card-header">
          {title && <div className="ob-inner-card-title">{title}</div>}
          {subtitle && <div className="ob-inner-card-sub">{subtitle}</div>}
        </div>
      )}
      <div className="ob-inner-card-body">{children}</div>
      {footer && <div className="ob-inner-card-footer">{footer}</div>}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="ob-section-title">{title}</div>
      {subtitle && <div className="ob-section-sub">{subtitle}</div>}
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ob-field", className)}>
      {label && (
        <label className="ob-label">
          {label}
          {required && <span className="ob-label-req">*</span>}
        </label>
      )}

      {children}

      {error ? (
        <span className="ob-error">{error}</span>
      ) : hint ? (
        <span className="ob-hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cx("ob-input", className)}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cx("ob-select", className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  disabled = false,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="ob-textarea"
    />
  );
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cx(
        "ob-toggle",
        checked ? "ob-toggle--on" : "ob-toggle--off",
        disabled && "ob-toggle--disabled",
      )}
    >
      <span className="ob-toggle-knob" />
    </button>
  );
}

export interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  className,
}: CheckboxProps) {
  return (
    <label
      className={cx(
        "ob-checkbox",
        disabled && "ob-checkbox--disabled",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="ob-checkbox__input"
      />

      <span className="ob-checkbox__content">
        <span className="ob-checkbox__label">{label}</span>
        {hint && <span className="ob-checkbox__hint">{hint}</span>}
      </span>
    </label>
  );
}

export function Btn({
  children,
  variant = "ghost",
  onClick,
  disabled = false,
  type = "button",
  style,
  className,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "soft" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={cx("ob-btn", `ob-btn--${variant}`, className)}
    >
      {children}
    </button>
  );
}

const ALERT_ICONS: Record<"ok" | "success" | "danger" | "warn" | "info", string> = {
  ok: "",
  success: "",
  danger: "",
  warn: "Warning:",
  info: "i",
};

export function Alert({
  tone,
  title,
  message,
}: {
  tone: "ok" | "success" | "danger" | "warn" | "info";
  title: string;
  message?: string | null;
}) {
  const cls = tone === "success" ? "ok" : tone;

  return (
    <div className={cx("ob-alert", `ob-alert--${cls}`)}>
      <span className="ob-alert__icon">{ALERT_ICONS[tone]}</span>
      <div>
        <div className="ob-alert__title">{title}</div>
        {message && <div className="ob-alert__msg">{message}</div>}
      </div>
    </div>
  );
}

export const Banner = Alert;

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "info" | "warn" | "danger";
}) {
  return <span className={cx("ob-badge", `ob-badge--${tone}`)}>{children}</span>;
}

export const Pill = Badge;

export function CheckItem({
  done,
  title,
  required,
}: {
  done: boolean;
  title: string;
  required?: boolean;
}) {
  return (
    <div className={cx("ob-check-item", done ? "ob-check-item--done" : "ob-check-item--pending")}>
      <div className={cx("ob-check-dot", done ? "ob-check-dot--done" : "ob-check-dot--pending")}>
        {done ? "" : "-"}
      </div>
      <span className={cx("ob-check-label", done ? "ob-check-label--done" : "ob-check-label--pending")}>
        {title}
      </span>
      {required && !done && <Badge tone="warn">Required</Badge>}
      {done && <Badge tone="success">Done</Badge>}
    </div>
  );
}

export const CheckRow = CheckItem;

export function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;

  return (
    <div className="ob-info-row">
      <span className="ob-info-row__label">{label}</span>
      <span className="ob-info-row__value">{value}</span>
    </div>
  );
}

export function EmptyState({
  title,
  sub,
}: {
  title: string;
  sub?: string;
}) {
  return (
    <div className="ob-empty">
      <div className="ob-empty__icon"></div>
      <div className="ob-empty__title">{title}</div>
      {sub && <div className="ob-empty__sub">{sub}</div>}
    </div>
  );
}

export function WizardSidebar<TKey extends string>({
  steps,
  activeKey,
  stepState,
  onSelect,
}: {
  steps: Array<{ key: TKey; title: string; subtitle: string }>;
  activeKey: TKey;
  stepState: Record<TKey, { done: boolean; locked: boolean }>;
  onSelect: (key: TKey) => void;
}) {
  return (
    <div className="ob-rail">
      {steps.map((step) => {
        const state = stepState[step.key] ?? { done: false, locked: false };
        const isActive = step.key === activeKey;
        const isDone = state.done;
        const isLocked = state.locked;

        return (
          <button
            key={step.key}
            type="button"
            disabled={isLocked}
            onClick={() => !isLocked && onSelect(step.key)}
            className={cx(
              "ob-rail-item",
              isActive && "ob-rail-item--active",
              isLocked && "ob-rail-item--locked",
            )}
          >
            <div
              className={cx(
                "ob-rail-dot",
                isActive
                  ? "ob-rail-dot--active"
                  : isDone
                    ? "ob-rail-dot--done"
                    : "ob-rail-dot--default",
              )}
            >
              {isDone ? "" : isLocked ? "" : ""}
            </div>

            <div className="ob-rail-label">
              <div className="ob-rail-label-title">{step.title}</div>
              <div className="ob-rail-label-sub">{step.subtitle}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function WizardRail<TKey extends string>({
  steps,
  active,
  readiness,
  onSelect,
}: {
  steps: Array<{ key: TKey; title: string; subtitle: string }>;
  active: TKey;
  readiness: Record<TKey, { done: boolean; locked: boolean }>;
  onSelect: (key: TKey) => void;
}) {
  return (
    <WizardSidebar
      steps={steps}
      activeKey={active}
      stepState={readiness}
      onSelect={onSelect}
    />
  );
}

export function WizardNav({
  onBack,
  onNext,
  backDisabled,
  nextDisabled,
  step,
  total,
  finishLabel,
  onFinish,
}: {
  onBack: () => void;
  onNext: () => void;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  step: number;
  total: number;
  finishLabel?: string;
  onFinish?: () => void;
}) {
  const isLast = step === total;

  return (
    <div className="ob-wizard-nav">
      <Btn variant="ghost" onClick={onBack} disabled={backDisabled}>
        Back
      </Btn>

      <span className="ob-wizard-step-lbl">
        Step {step} of {total}
      </span>

      {isLast && onFinish ? (
        <Btn variant="primary" onClick={onFinish} disabled={nextDisabled}>
          {finishLabel ?? "Finish setup"}
        </Btn>
      ) : (
        <Btn variant="primary" onClick={onNext} disabled={nextDisabled}>
          Continue to
        </Btn>
      )}
    </div>
  );
}

export function Spinner() {
  return (
    <svg
      className="ob-spinner"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export function DataGrid({
  columns,
  rows,
  emptyTitle,
  emptySubtitle,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  emptyTitle: string;
  emptySubtitle: string;
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} sub={emptySubtitle} />;
  }

  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--ob-slate-200)" }}>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {columns.map((c) => (
              <th
                key={c}
                style={{
                  padding: "9px 14px",
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                  borderBottom: "1px solid var(--ob-slate-200)",
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "10px 14px" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReviewCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, React.ReactNode]>;
}) {
  return (
    <InnerCard title={title}>
      {rows.map(([k, v]) => (
        <InfoRow key={k} label={k} value={String(v ?? "")} />
      ))}
    </InnerCard>
  );
}

export function ToggleRow({
  title,
  subtitle,
  checked,
  onChange,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cx("ob-toggle-row", disabled && "ob-toggle-row--disabled")}>
      <div>
        <div className="ob-toggle-row__title">{title}</div>
        {subtitle && <div className="ob-toggle-row__sub">{subtitle}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return <div className="ob-page">{children}</div>;
}

export function OnboardingHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="ob-page-header">
      <div>
        <div className="ob-page-title">{title}</div>
        {subtitle && <div className="ob-page-subtitle">{subtitle}</div>}
      </div>
      {right && <div className="ob-page-actions">{right}</div>}
    </div>
  );
}