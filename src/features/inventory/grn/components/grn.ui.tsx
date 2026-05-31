// ─── Shared GRN UI Components ────────────────────────────────────────────────
// Reusable components scoped to the GRN module.

import React from "react";
import { NavLink } from "react-router-dom";
import { normalize, trim } from "../utils/grn.utils";
import type { GrnStatus } from "../types/grn.types";

// ── Design Tokens ─────────────────────────────────────────────────────────────
// Centralized so any redesign touches one place.

export const tokens = {
  // Surfaces
  pageBg: "#F8F9FB",
  cardBg: "#FFFFFF",
  cardBorder: "1px solid #E8EAF0",
  cardRadius: 10,
  cardPad: "20px 24px",

  // Typography
  fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  colorPrimary: "#0F172A",
  colorMuted: "#64748B",
  colorHint: "#94A3B8",

  // Brand accent
  accent: "#2563EB",
  accentHover: "#1D4ED8",
  accentLight: "#EFF6FF",
  accentMid: "#BFDBFE",

  // Status
  successBg: "#F0FDF4", successText: "#15803D", successBorder: "#BBF7D0",
  warningBg: "#FFFBEB", warningText: "#B45309", warningBorder: "#FDE68A",
  dangerBg: "#FFF1F2", dangerText: "#BE123C", dangerBorder: "#FECDD3",
  neutralBg: "#F8FAFC", neutralText: "#475569", neutralBorder: "#E2E8F0",

  // Table
  tableHeaderBg: "#F8FAFC",
  tableBorder: "1px solid #F1F5F9",
  tableRowHover: "#FAFBFC",

  // Inputs
  inputBg: "#FFFFFF",
  inputBorder: "#D1D5DB",
  inputBorderError: "#F87171",
  inputRadius: 7,
  inputPad: "8px 12px",
  inputFontSize: 14,

  // Sticky bar
  stickyBg: "#FFFFFF",
  stickyBorder: "1px solid #E8EAF0",
  stickyShadow: "0 -4px 16px rgba(0,0,0,0.06)",
} as const;

// ── Base Button Styles ────────────────────────────────────────────────────────

const btnBase: React.CSSProperties = {
  fontFamily: tokens.fontFamily,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.01em",
  padding: "8px 16px",
  borderRadius: 7,
  cursor: "pointer",
  border: "none",
  transition: "all 0.15s ease",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

export const primaryBtn: React.CSSProperties = {
  ...btnBase,
  background: tokens.accent,
  color: "#FFFFFF",
};

export const secondaryBtn: React.CSSProperties = {
  ...btnBase,
  background: "#FFFFFF",
  color: tokens.colorPrimary,
  border: `1px solid ${tokens.inputBorder}`,
};

export const dangerBtn: React.CSSProperties = {
  ...btnBase,
  background: tokens.dangerBg,
  color: tokens.dangerText,
  border: `1px solid ${tokens.dangerBorder}`,
};

export const ghostBtn: React.CSSProperties = {
  ...btnBase,
  background: "transparent",
  color: tokens.colorMuted,
  border: `1px solid transparent`,
};

// ── Form Primitives ───────────────────────────────────────────────────────────

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: tokens.colorMuted,
  marginBottom: 5,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

export const inputStyle = (hasError = false): React.CSSProperties => ({
  width: "100%",
  fontSize: tokens.inputFontSize,
  fontFamily: tokens.fontFamily,
  padding: tokens.inputPad,
  borderRadius: tokens.inputRadius,
  border: `1px solid ${hasError ? tokens.inputBorderError : tokens.inputBorder}`,
  background: tokens.inputBg,
  color: tokens.colorPrimary,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
});

export const errorInline: React.CSSProperties = {
  fontSize: 11,
  color: tokens.dangerText,
  marginTop: 3,
  fontWeight: 500,
};

// ── Layout Primitives ─────────────────────────────────────────────────────────

export const pageWrap: React.CSSProperties = {
  padding: "24px 28px",
  maxWidth: 1280,
  margin: "0 auto",
  fontFamily: tokens.fontFamily,
};

export const cardStyle: React.CSSProperties = {
  background: tokens.cardBg,
  border: tokens.cardBorder,
  borderRadius: tokens.cardRadius,
  padding: tokens.cardPad,
  marginTop: 16,
};

export const stickyBar: React.CSSProperties = {
  position: "sticky",
  bottom: 0,
  marginTop: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 20px",
  background: tokens.stickyBg,
  border: tokens.stickyBorder,
  borderRadius: tokens.cardRadius,
  boxShadow: tokens.stickyShadow,
  zIndex: 10,
};

export const tableWrap: React.CSSProperties = {
  overflowX: "auto",
  marginTop: 14,
};

export const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
  fontFamily: tokens.fontFamily,
};

export const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  background: tokens.tableHeaderBg,
  color: tokens.colorMuted,
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  borderBottom: `1px solid #E8EAF0`,
  whiteSpace: "nowrap",
};

export const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  color: tokens.colorPrimary,
  borderBottom: tokens.tableBorder,
  verticalAlign: "middle",
};

export const totRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "6px 0",
  fontSize: 13,
  color: tokens.colorPrimary,
  borderTop: `1px solid #F1F5F9`,
};

// ── Status Badge ──────────────────────────────────────────────────────────────

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  POSTED: { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  CANCELLED: { bg: "#FFF1F2", text: "#BE123C", border: "#FECDD3" },
  REVERSED: { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" },
};

export function StatusBadge({ status }: { status?: string | null }) {
  const val = normalize(status) as GrnStatus;
  const colors = statusColors[val] ?? { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        padding: "0 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        textTransform: "uppercase",
        fontFamily: tokens.fontFamily,
      }}
    >
      {trim(status) || "—"}
    </span>
  );
}

// ── Issued Badge ──────────────────────────────────────────────────────────────

export function IssuedBadge({ issued }: { issued: boolean }) {
  return issued ? (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11,
      fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8",
      border: "1px solid #BFDBFE", letterSpacing: "0.04em",
    }}>
      ✓ Issued
    </span>
  ) : (
    <span style={{ fontSize: 12, color: tokens.colorHint }}>—</span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div style={{
      background: accent ? tokens.accentLight : tokens.neutralBg,
      border: `1px solid ${accent ? tokens.accentMid : tokens.neutralBorder}`,
      borderRadius: 8,
      padding: "14px 18px",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent ? tokens.accent : tokens.colorMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ? tokens.accent : tokens.colorPrimary, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: tokens.colorHint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Page Header ───────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  errorMsg?: string | null;
  successMsg?: string | null;
}

export function PageHeader({ title, subtitle, rightSlot, errorMsg, successMsg }: PageHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: tokens.colorPrimary, margin: 0, fontFamily: tokens.fontFamily }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: "5px 0 0", fontSize: 13, color: tokens.colorMuted, fontFamily: tokens.fontFamily }}>
            {subtitle}
          </p>
        )}
        {errorMsg && <InlineAlert type="error" message={errorMsg} />}
        {successMsg && <InlineAlert type="success" message={successMsg} />}
      </div>
      {rightSlot && <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>{rightSlot}</div>}
    </div>
  );
}

// ── Inline Alert ──────────────────────────────────────────────────────────────

interface InlineAlertProps {
  type: "error" | "success" | "warning" | "info";
  message: string;
}

const alertColors = {
  error:   { bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3", icon: "⚠" },
  success: { bg: "#F0FDF4", text: "#14532D", border: "#BBF7D0", icon: "✓" },
  warning: { bg: "#FFFBEB", text: "#78350F", border: "#FDE68A", icon: "!" },
  info:    { bg: "#EFF6FF", text: "#1E3A5F", border: "#BFDBFE", icon: "i" },
} as const;

export function InlineAlert({ type, message }: InlineAlertProps) {
  const c = alertColors[type];
  return (
    <div style={{
      marginTop: 10, padding: "8px 12px",
      background: c.bg, color: c.text,
      border: `1px solid ${c.border}`,
      borderRadius: 7, fontSize: 13, fontWeight: 500,
      display: "flex", alignItems: "flex-start", gap: 8,
      fontFamily: tokens.fontFamily,
    }}>
      <span style={{ fontWeight: 800, flexShrink: 0 }}>{c.icon}</span>
      {message}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  message: string;
  colSpan: number;
}

export function EmptyRow({ message, colSpan }: EmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: "32px 18px", textAlign: "center", color: tokens.colorHint, fontSize: 13, fontStyle: "italic" }}>
        {message}
      </td>
    </tr>
  );
}

// ── Nav Button ────────────────────────────────────────────────────────────────

interface NavButtonProps {
  to: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function NavBtn({ to, style = secondaryBtn, children }: NavButtonProps) {
  return (
    <NavLink to={to} style={{ textDecoration: "none" }}>
      <button style={style}>{children}</button>
    </NavLink>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

export function LoadingRows({ colSpan, rows = 3 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: colSpan }).map((_, j) => (
            <td key={j} style={tdStyle}>
              <div style={{ height: 14, borderRadius: 4, background: "#F1F5F9", animation: "pulse 1.5s ease-in-out infinite" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Section Divider ───────────────────────────────────────────────────────────

export function SectionHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: tokens.colorPrimary, fontFamily: tokens.fontFamily }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: tokens.colorMuted, marginTop: 3, fontFamily: tokens.fontFamily }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}