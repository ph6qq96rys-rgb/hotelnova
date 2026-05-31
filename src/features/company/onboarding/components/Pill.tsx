import type React from "react";
import { cx } from "../utils/onboarding.utils";

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "success" | "warning" | "neutral" }) {
  const cls = tone === "success" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : tone === "warning" ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-slate-50 text-slate-700 ring-slate-200";
  return <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1", cls)}>{children}</span>;
}