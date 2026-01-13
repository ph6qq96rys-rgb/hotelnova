import React from "react";

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
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-xl font-bold text-slate-900">{title}</div>
        {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
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
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{children}</div>;
}

export function Kpi({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-900">{value}</div>
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
    <div className="card">
      <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </div>
  );
}

export function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{children}</div>;
}

export function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900">{value ?? "—"}</div>
    </div>
  );
}
