import type React from "react";
import { cx } from "../utils/onboarding.utils";

export function Field({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-700">
        {label}
        {required ? (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 ring-1 ring-rose-200">
            Required
          </span>
        ) : null}
      </div>

      {children}

      {error ? (
        <div className="mt-1.5 text-xs font-medium text-rose-700">
          {error}
        </div>
      ) : null}
    </label>
  );
}