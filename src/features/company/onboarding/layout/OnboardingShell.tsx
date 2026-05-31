import type React from "react";

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">{children}</div></main>;
}

export function OnboardingHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><div className="mb-2 inline-flex rounded-full bg-slate-950 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">ERP Setup</div><h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p></div>{right ? <div className="shrink-0">{right}</div> : null}</div>;
}