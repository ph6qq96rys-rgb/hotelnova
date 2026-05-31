import type React from "react";
import { PAYMENT_STATUS, SALE_STATUS } from "../api/salesTypes";

export const money = (n: number | null | undefined) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(n ?? 0));

export const number = (n: number | null | undefined) =>
  new Intl.NumberFormat().format(Number(n ?? 0));

export const dateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

export function extractApiError(e: unknown, fallback = "Request failed.") {
  const err = e as any;
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.message === "string") return data.message;
  return err?.message ?? fallback;
}

export function Button({
  children,
  variant = "secondary",
  size = "md",
  block,
  disabled,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`pos-btn pos-btn--${variant} pos-btn--${size}${block ? " pos-btn--block" : ""}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  title,
  subtitle,
  action,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`pos-card ${className}`}>
      {(title || subtitle || action) && (
        <header className="pos-card__header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="pos-card__body">{children}</div>
    </section>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "success" | "danger" | "warning"; children: React.ReactNode }) {
  return <div className={`pos-alert pos-alert--${tone}`}>{children}</div>;
}

export function Modal({
  title,
  children,
  onClose,
  width = 520,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
}) {
  return (
    <div className="pos-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pos-modal" style={{ maxWidth: width }}>
        <header className="pos-modal__header">
          <strong>{title}</strong>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="pos-modal__body">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="pos-field">
      <span>{label}</span>
      {children}
      {hint && <em>{hint}</em>}
    </label>
  );
}

export function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "blue" | "green" | "red" | "amber" | "purple";
}) {
  return <span className={`pos-badge pos-badge--${tone}`}>{children}</span>;
}

export function SaleStatusBadge({ status }: { status: number }) {
  const s = SALE_STATUS[status];
  return <Badge tone={s?.tone ?? "gray"}>{s?.label ?? `Status ${status}`}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: number }) {
  const s = PAYMENT_STATUS[status];
  return <Badge tone={s?.tone ?? "gray"}>{s?.label ?? `Payment ${status}`}</Badge>;
}

export function InventoryBadge({ posted }: { posted: boolean }) {
  return posted ? <Badge tone="green">Inventory Posted</Badge> : <Badge tone="amber">Inventory Pending</Badge>;
}

export function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="pos-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <em>{hint}</em>}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="pos-empty">
      <strong>{title}</strong>
      {text && <span>{text}</span>}
    </div>
  );
}
