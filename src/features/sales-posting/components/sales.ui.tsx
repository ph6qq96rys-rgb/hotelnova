// ─── Shared Sales UI Components ───────────────────────────────────────────────
import React from "react";
import { fmtMoney } from "../utils/sales.utils";

// ── Status Badge ──────────────────────────────────────────────────────────────

interface BadgeProps {
  label: string;
  color: string;
}

export function StatusBadge({ label, color }: BadgeProps) {
  return (
    <span style={{
      padding: "2px 10px",
      borderRadius: 12,
      fontSize: 11,
      fontFamily: "monospace",
      background: color + "22",
      color,
      fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

// ── Inventory badge ───────────────────────────────────────────────────────────

export function InventoryBadge({ posted }: { posted: boolean }) {
  return (
    <StatusBadge
      label={posted ? "COGS Posted" : "COGS Pending"}
      color={posted ? "#10b981" : "#6b7280"}
    />
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string | number;
  mono?: boolean;
  color?: string;
  bold?: boolean;
}

export function KpiCard({ label, value, mono, color, bold }: KpiProps) {
  return (
    <div style={{
      background: "#f8fafc",
      borderRadius: 8,
      padding: "10px 14px",
      border: "1px solid #e5e7eb",
    }}>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 16,
        fontWeight: bold ? 700 : 500,
        fontFamily: mono ? "monospace" : undefined,
        color: color ?? "inherit",
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────

interface AlertProps {
  type: "error" | "success" | "warning";
  message: string;
}

const ALERT_COLORS = {
  error:   { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  success: { bg: "#f0fdf4", color: "#14532d", border: "#bbf7d0" },
  warning: { bg: "#fffbeb", color: "#78350f", border: "#fde68a" },
};

export function Alert({ type, message }: AlertProps) {
  const c = ALERT_COLORS[type];
  return (
    <div style={{
      padding: "10px 14px",
      borderRadius: 8,
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
      fontSize: 13,
      marginBottom: 12,
    }}>
      {message}
    </div>
  );
}

// ── Total row ─────────────────────────────────────────────────────────────────

interface TotalRowProps {
  label: string;
  value: number;
  bold?: boolean;
  large?: boolean;
  color?: string;
}

export function TotalRow({ label, value, bold, large, color }: TotalRowProps) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: large ? 15 : 13,
      fontWeight: bold ? 700 : 400,
      color: color ?? "inherit",
      padding: "3px 0",
    }}>
      <span style={{ color: bold ? "inherit" : "#6b7280" }}>{label}</span>
      <span style={{ fontFamily: "monospace" }}>{fmtMoney(value)}</span>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

interface EmptyRowProps {
  colSpan: number;
  message?: string;
}

export function EmptyRow({ colSpan, message = "No records found." }: EmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} style={{
        padding: 32,
        textAlign: "center",
        color: "#9ca3af",
        fontSize: 13,
        fontStyle: "italic",
      }}>
        {message}
      </td>
    </tr>
  );
}

// ── Loading row ───────────────────────────────────────────────────────────────

export function LoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>
        Loading…
      </td>
    </tr>
  );
}

// ── Totals summary block ──────────────────────────────────────────────────────

interface TotalsSummaryProps {
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
}

export function TotalsSummary({ subTotal, discountAmount, taxAmount, grandTotal }: TotalsSummaryProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <TotalRow label="Subtotal" value={subTotal} />
      <TotalRow label="Discount" value={-discountAmount} />
      <TotalRow label="Tax" value={taxAmount} />
      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 6, paddingTop: 6 }}>
        <TotalRow label="Total" value={grandTotal} bold large />
      </div>
    </div>
  );
}

// ── Payment method select ─────────────────────────────────────────────────────

import { PAYMENT_METHODS } from "../sales.types";

interface PaymentMethodSelectProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

export function PaymentMethodSelect({ value, onChange, disabled, className }: PaymentMethodSelectProps) {
  return (
    <select
      className={className ?? "input"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {PAYMENT_METHODS.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

export function SectionHead({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
      {action}
    </div>
  );
}