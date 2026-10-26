import React from "react";
import "./doc-ui.css";

export function DocHeader({
  title,
  subtitle,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="doc-header">
      <div>
        <div className="doc-title">{title}</div>
        {subtitle && <div className="doc-subtitle">{subtitle}</div>}
      </div>
      {right && <div className="doc-actions">{right}</div>}
    </div>
  );
}

/**
 * StatusPill
 * - `text` can be a string OR a numeric enum value
 * - If you pass a number, also pass `labelOf` to render a string label
 */
export function StatusPill<T extends string | number>({
  text,
  tone,
  labelOf,
}: {
  text: T;
  tone: string;
  labelOf?: (v: T) => string;
}) {
  const label =
    typeof text === "string" ? text : labelOf ? labelOf(text) : String(text);

  return (
    <span className={`doc-status ${tone}`}>
      {label}
    </span>
  );
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="doc-kpis">{children}</div>;
}

export function Kpi({ label, value }: { label: string; value: any }) {
  return (
    <div className="doc-kpi">
      <div className="doc-label">{label}</div>
      <div className="doc-kpi-value">{value}</div>
    </div>
  );
}

export function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="doc-card">
      <div className="doc-card-header">
        <div>
          <div className="doc-value">{title}</div>
          {subtitle && <div className="doc-label">{subtitle}</div>}
        </div>
        {right && <div className="doc-actions">{right}</div>}
      </div>
      <div className="doc-card-body">{children}</div>
    </div>
  );
}

export function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="doc-info-grid">{children}</div>;
}

export function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="doc-label">{label}</div>
      <div className="doc-value">{value ?? "-"}</div>
    </div>
  );
}
