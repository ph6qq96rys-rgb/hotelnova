import type React from "react";
import { cx } from "../utils/onboarding.utils";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-4 focus:ring-slate-200",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200",
        props.className
      )}
    />
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800"
    >
      <span>{label}</span>

      <span
        className={cx(
          "ml-4 h-6 w-11 rounded-full p-1 transition",
          checked ? "bg-slate-950" : "bg-slate-200"
        )}
      >
        <span
          className={cx(
            "block h-4 w-4 rounded-full bg-white transition",
            checked && "translate-x-5"
          )}
        />
      </span>
    </button>
  );
}