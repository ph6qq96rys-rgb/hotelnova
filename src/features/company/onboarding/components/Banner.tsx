


// =====================================================================================
// FILE: src/modules/company/onboarding/components/Controls.tsx
// =====================================================================================

import type React from "react";
import { cx } from "../utils/onboarding.utils";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx("h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-4 focus:ring-slate-200", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx("h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200", props.className)} />;
}

export function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800"><span>{label}</span><span className={cx("ml-4 h-6 w-11 rounded-full p-1 transition", checked ? "bg-slate-950" : "bg-slate-200")}><span className={cx("block h-4 w-4 rounded-full bg-white transition", checked && "translate-x-5")} /></span></button>;
}
export function Banner({ tone, title, message }: { tone: "danger" | "success" | "warning"; title: string; message?: string | null }) {
  const cls = tone === "danger" ? "bg-rose-50 text-rose-900 ring-rose-200" : tone === "success" ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : "bg-amber-50 text-amber-900 ring-amber-200";
  return <div className={cx("mb-5 rounded-2xl px-4 py-3 ring-1", cls)}><div className="text-sm font-bold">{title}</div>{message ? <div className="mt-1 text-sm opacity-90">{message}</div> : null}</div>;
}

export function Field({ label, required, error, children, className }: { label: string; required?: boolean; error?: string; children: React.ReactNode; className?: string }) {
  return <label className={cx("block", className)}><div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-700">{label}{required ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 ring-1 ring-rose-200">Required</span> : null}</div>{children}{error ? <div className="mt-1.5 text-xs font-medium text-rose-700">{error}</div> : null}</label>;
}