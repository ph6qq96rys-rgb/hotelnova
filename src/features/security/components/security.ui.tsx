// ─── Security UI Components ───────────────────────────────────────────────────
// All styles are inline using CSS variables for light/dark mode compatibility.
// Replaces roles-permissions.css entirely.

import React from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────

export const T = {
  // These map to the app's CSS variable system
  bg:       "var(--color-background-primary)",
  bgSec:    "var(--color-background-secondary)",
  bgTer:    "var(--color-background-tertiary)",
  border:   "var(--color-border-tertiary)",
  borderSec:"var(--color-border-secondary)",
  text:     "var(--color-text-primary)",
  muted:    "var(--color-text-secondary)",
  hint:     "var(--color-text-tertiary)",
  danger:   "var(--color-text-danger)",
  dangerBg: "var(--color-background-danger)",
  dangerBorder: "var(--color-border-danger)",
  radius:   "var(--border-radius-md)",
  radiusLg: "var(--border-radius-lg)",
  font:     "var(--font-sans, 'Inter', system-ui, sans-serif)",
  mono:     "var(--font-mono, monospace)",
  // Accent — used for active states, primary actions
  accent:   "#1a1a2e",
  accentBg: "rgba(26,26,46,0.06)",
} as const;

// ── cx helper ─────────────────────────────────────────────────────────────────

export const cx = (...xs: Array<string | false | undefined | null>) =>
  xs.filter(Boolean).join(" ");

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      border: `2px solid ${T.border}`,
      borderTopColor: T.muted,
      animation: "sec-spin 700ms linear infinite",
      flexShrink: 0,
    }} />
  );
}

// Inject keyframes once
if (typeof document !== "undefined") {
  const id = "__sec_styles";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes sec-spin { to { transform: rotate(360deg); } }
      @keyframes sec-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `;
    document.head.appendChild(s);
  }
}

// ── Alert ─────────────────────────────────────────────────────────────────────

interface AlertProps { type: "error" | "success" | "warning" | "info"; title: string; body?: string; }

const ALERT = {
  error:   { bg: "var(--color-background-danger)", border: "var(--color-border-danger)", text: "var(--color-text-danger)" },
  success: { bg: "var(--color-background-success)", border: "var(--color-border-success)", text: "var(--color-text-success)" },
  warning: { bg: "var(--color-background-warning)", border: "var(--color-border-warning)", text: "var(--color-text-warning)" },
  info:    { bg: "var(--color-background-info)",    border: "var(--color-border-info)",    text: "var(--color-text-info)" },
};

export function Alert({ type, title, body }: AlertProps) {
  const c = ALERT[type];
  return (
    <div style={{ padding: "12px 14px", borderRadius: T.radiusLg, border: `1px solid ${c.border}`, background: c.bg, marginBottom: 12 }}>
      <div style={{ fontWeight: 500, fontSize: 13, color: c.text }}>{title}</div>
      {body && <div style={{ marginTop: 4, fontSize: 12, color: c.text, opacity: 0.85 }}>{body}</div>}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

export function Badge({ label, variant = "default" }: { label: string; variant?: "default" | "system" | "active" }) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: T.bgSec, border: `1px solid ${T.border}`, color: T.muted },
    system:  { background: "rgba(26,26,46,0.08)", border: "1px solid rgba(26,26,46,0.15)", color: T.accent },
    active:  { background: T.accent, border: "none", color: "#fff" },
  };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px",
      borderRadius: 999, letterSpacing: "0.02em",
      ...styles[variant],
    }}>
      {label}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

type BtnVariant = "default" | "primary" | "danger" | "ghost" | "mini";

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  children: React.ReactNode;
}

const BTN_STYLES: Record<BtnVariant, React.CSSProperties> = {
  default: {
    background: T.bg, border: `1px solid ${T.border}`,
    color: T.text, cursor: "pointer",
    padding: "8px 14px", borderRadius: T.radius, fontSize: 13, fontWeight: 500,
  },
  primary: {
    background: T.accent, border: "none",
    color: "#fff", cursor: "pointer",
    padding: "8px 16px", borderRadius: T.radius, fontSize: 13, fontWeight: 600,
  },
  danger: {
    background: "var(--color-background-danger)", border: "1px solid var(--color-border-danger)",
    color: "var(--color-text-danger)", cursor: "pointer",
    padding: "8px 14px", borderRadius: T.radius, fontSize: 13, fontWeight: 500,
  },
  ghost: {
    background: "transparent", border: `1px solid ${T.border}`,
    color: T.muted, cursor: "pointer",
    padding: "8px 14px", borderRadius: T.radius, fontSize: 13,
  },
  mini: {
    background: T.bgSec, border: `1px solid ${T.border}`,
    color: T.muted, cursor: "pointer",
    padding: "5px 10px", borderRadius: 999, fontSize: 12,
  },
};

export function Btn({ variant = "default", children, style, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        fontFamily: T.font,
        ...BTN_STYLES[variant],
        ...(disabled ? { opacity: 0.45, cursor: "not-allowed" } : {}),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { hasError?: boolean; }

export function Input({ hasError, style, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      style={{
        width: "100%", boxSizing: "border-box",
        padding: "8px 12px", borderRadius: T.radius, fontSize: 13,
        border: `1px solid ${hasError ? "var(--color-border-danger)" : T.border}`,
        background: T.bg, color: T.text, outline: "none",
        fontFamily: T.font,
        ...style,
      }}
    />
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

export function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: T.bgSec, border: `1px solid ${T.border}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 500, color: T.muted, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: T.bgSec, border: `1px solid ${T.border}`,
      borderRadius: T.radius, padding: "10px 14px", minWidth: 110,
    }}>
      <div style={{ fontSize: 11, color: T.hint, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

// ── Perm dot (group coverage indicator) ──────────────────────────────────────

export function PermDot({ state }: { state: "all" | "some" | "none" }) {
  const colors = { all: T.accent, some: T.muted, none: T.border };
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: colors[state], border: `1px solid ${T.borderSec}`,
      flexShrink: 0,
    }} />
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: 64, borderRadius: T.radiusLg,
          border: `1px solid ${T.border}`,
          background: `linear-gradient(90deg, ${T.bgSec} 0%, ${T.bgTer} 50%, ${T.bgSec} 100%)`,
          backgroundSize: "200% 100%",
          animation: "sec-shimmer 1.2s ease-in-out infinite",
        }} />
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{title}</div>
      {sub && <div style={{ marginTop: 6, fontSize: 13, color: T.muted, maxWidth: 400, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

// ── Section head ──────────────────────────────────────────────────────────────

export function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function Drawer({ open, title, onClose, footer, children }: DrawerProps) {
  if (!open) return null;
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        style={{ width: 420, maxWidth: "90vw", background: T.bg, borderLeft: `1px solid ${T.border}`, height: "100%", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{title}</div>
          <Btn variant="ghost" onClick={onClose} style={{ padding: "4px 8px", fontSize: 16 }}>✕</Btn>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.muted, marginBottom: 5, letterSpacing: "0.03em" }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: T.hint, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}