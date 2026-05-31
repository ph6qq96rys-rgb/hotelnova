import type React from "react";

export function DataGrid({ columns, rows, emptyTitle, emptySubtitle }: { columns: string[]; rows: React.ReactNode[][]; emptyTitle: string; emptySubtitle: string }) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><div className="font-bold text-slate-900">{emptyTitle}</div><div className="mt-1 text-sm text-slate-500">{emptySubtitle}</div></div>;
  return <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{columns.map((c) => <th key={c} className="px-4 py-3">{c}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody></table></div>;
}