import type React from "react";

export function ReviewCard({ title, rows }: { title: string; rows: Array<[string, React.ReactNode]> }) {
  return <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="mb-3 text-sm font-bold text-slate-950">{title}</div><dl className="space-y-2">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 text-sm"><dt className="text-slate-500">{k}</dt><dd className="text-right font-semibold text-slate-900">{v}</dd></div>)}</dl></div>;
}
