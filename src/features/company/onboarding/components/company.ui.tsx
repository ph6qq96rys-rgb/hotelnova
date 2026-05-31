// src/modules/company/pages/components/company.ui.tsx
//
// Every primitive used by CompanyOnboardingModule, BranchOnboardingWizardPage,
// and CompanySettingsPage — rebuilt to match the HotelNova ERP prototype.
// All logic is untouched; only className / JSX structure changed.

import type React from "react";

// ── cx helper ─────────────────────────────────────────────────────────────────
export function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

// ── PageShell ─────────────────────────────────────────────────────────────────
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

// ── ProgressBar ───────────────────────────────────────────────────────────────
export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="ob-progress">
      <div className="ob-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
// Accepts optional `style` so CompanySettingsPage can pass marginBottom etc.
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
          {title    && <div className="ob-card-title">{title}</div>}
          {subtitle && <div className="ob-card-subtitle">{subtitle}</div>}
        </div>
      )}
      <div className="ob-card-body">{children}</div>
      {footer && <div className="ob-card-footer">{footer}</div>}
    </div>
  );
}

// ── InnerCard ─────────────────────────────────────────────────────────────────
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
          {title    && <div className="ob-inner-card-title">{title}</div>}
          {subtitle && <div className="ob-inner-card-sub">{subtitle}</div>}
        </div>
      )}
      <div className="ob-inner-card-body">{children}</div>
      {footer && <div className="ob-inner-card-footer">{footer}</div>}
    </div>
  );
}

// ── SectionTitle ──────────────────────────────────────────────────────────────
export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="ob-section-title">{title}</div>
      {subtitle && <div className="ob-section-sub">{subtitle}</div>}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
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
      {hint && <span className="ob-hint">{hint}</span>}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
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

// ── SelectInput ───────────────────────────────────────────────────────────────
export function SelectInput({
  value,
  onChange,
  options,
  disabled,
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
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── TextArea ──────────────────────────────────────────────────────────────────
export function TextArea({
  value,
  onChange,
  placeholder,
  disabled,
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

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx("ob-toggle", checked ? "ob-toggle--on" : "ob-toggle--off")}
    >
      <span className="ob-toggle-knob" />
    </button>
  );
}

// ── Checkbox ──────────────────────────────────────────────────────────────────
export function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="ob-checkbox" onClick={() => onChange(!checked)}>
      <div className={cx("ob-checkbox-box", checked && "ob-checkbox-box--checked")}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5 3.5-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div>
        <div className="ob-checkbox-label">{label}</div>
        {hint && <div className="ob-checkbox-hint">{hint}</div>}
      </div>
    </div>
  );
}

// ── Btn ───────────────────────────────────────────────────────────────────────
export function Btn({
  children,
  variant = "ghost",
  onClick,
  disabled,
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

// ── Alert / Banner ────────────────────────────────────────────────────────────
const ALERT_ICONS: Record<string, string> = {
  ok:      "✓",
  success: "✓",
  danger:  "✕",
  warn:    "⚠",
  info:    "i",
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
  // normalise "success" → "ok" for CSS class
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

// Banner is the same component (CompanyOnboardingModule uses Banner)
export const Banner = Alert;

// ── Badge / Pill ──────────────────────────────────────────────────────────────
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

// ── CheckItem ─────────────────────────────────────────────────────────────────
export function CheckItem({ done, title, required }: { done: boolean; title: string; required?: boolean }) {
  return (
    <div className={cx("ob-check-item", done ? "ob-check-item--done" : "ob-check-item--pending")}>
      <div className={cx("ob-check-dot", done ? "ob-check-dot--done" : "ob-check-dot--pending")}>
        {done ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="9" height="2" viewBox="0 0 9 2" fill="none">
            <rect width="9" height="2" rx="1" fill="#94a3b8" />
          </svg>
        )}
      </div>
      <span className={cx("ob-check-label", done ? "ob-check-label--done" : "ob-check-label--pending")}>
        {title}
      </span>
      {required && !done && <Badge tone="warn">Required</Badge>}
      {done && <Badge tone="success">Done</Badge>}
    </div>
  );
}

// Alias used in some files
export const CheckRow = CheckItem;

// ── InfoRow ───────────────────────────────────────────────────────────────────
export function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="ob-info-row">
      <span className="ob-info-row__label">{label}</span>
      <span className="ob-info-row__value">{value}</span>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="ob-empty">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"
        style={{ margin: "0 auto 4px", display: "block" }}>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M9 9h6M9 12h4" strokeLinecap="round" />
      </svg>
      <div className="ob-empty__title">{title}</div>
      {sub && <div className="ob-empty__sub">{sub}</div>}
    </div>
  );
}

// ── WizardSidebar ─────────────────────────────────────────────────────────────
// Used by BranchOnboardingWizardPage (activeKey / stepState API)
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
        const s        = stepState[step.key];
        const isActive = step.key === activeKey;
        const isDone   = s.done;
        const isLocked = s.locked;
        return (
          <button
            key={step.key}
            type="button"
            onClick={() => !isLocked && onSelect(step.key)}
            className={cx(
              "ob-rail-item",
              isActive  && "ob-rail-item--active",
              isLocked  && "ob-rail-item--locked",
            )}
          >
            <div className={cx(
              "ob-rail-dot",
              isActive ? "ob-rail-dot--active" : isDone ? "ob-rail-dot--done" : "ob-rail-dot--default",
            )}>
              {isDone && !isActive ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5.5" stroke="#16a34a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : isLocked ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke={isActive ? "#fff" : "#94a3b8"} strokeWidth="2">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 018 0v4" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke={isActive ? "#fff" : "#94a3b8"} strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
            </div>
            <div className="ob-rail-label">
              <div className="ob-rail-label-title">{step.title}</div>
              <div className="ob-rail-label-sub">{step.subtitle}</div>
            </div>
            {!isActive && isDone && (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5.5" stroke="#16a34a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── WizardRail ────────────────────────────────────────────────────────────────
// Used by CompanyOnboardingModule (active / readiness API — different prop shape)
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

// ── WizardNav ─────────────────────────────────────────────────────────────────
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
      <Btn variant="ghost" onClick={onBack} disabled={backDisabled}>← Back</Btn>
      <span className="ob-wizard-step-lbl">Step {step} of {total}</span>
      {isLast && onFinish ? (
        <Btn variant="primary" onClick={onFinish} disabled={nextDisabled}>
          {finishLabel ?? "Finish setup"}
        </Btn>
      ) : (
        <Btn variant="primary" onClick={onNext} disabled={nextDisabled}>Continue →</Btn>
      )}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <svg className="ob-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ── DataGrid ──────────────────────────────────────────────────────────────────
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
  if (!rows.length) return <EmptyState title={emptyTitle} sub={emptySubtitle} />;
  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--ob-slate-200)" }}>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {columns.map((c) => (
              <th key={c} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", borderBottom: "1px solid var(--ob-slate-200)" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "10px 14px" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── ReviewCard ────────────────────────────────────────────────────────────────
export function ReviewCard({ title, rows }: { title: string; rows: Array<[string, React.ReactNode]> }) {
  return (
    <InnerCard title={title}>
      {rows.map(([k, v]) => <InfoRow key={k} label={k} value={String(v ?? "")} />)}
    </InnerCard>
  );
}

// ── ToggleRow (used in CompanySettingsPage) ───────────────────────────────────
export function ToggleRow({
  title,
  subtitle,
  checked,
  onChange,
}: {
  title: string;
  subtitle?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="ob-toggle-row">
      <div>
        <div className="ob-toggle-row__title">{title}</div>
        {subtitle && <div className="ob-toggle-row__sub">{subtitle}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ── OnboardingShell / OnboardingHeader ────────────────────────────────────────
// Used by CompanyOnboardingModule
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