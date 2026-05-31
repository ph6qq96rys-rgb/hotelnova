import { Pill } from "./Pill";

export function CheckRow({ label, done, required }: { label: string; done: boolean; required: boolean }) {
  return <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200"><div className="text-sm font-semibold text-slate-800">{label}</div><div className="flex items-center gap-2">{required ? <Pill tone="warning">Required</Pill> : <Pill>Optional</Pill>}{done ? <Pill tone="success">Done</Pill> : <Pill tone="warning">Pending</Pill>}</div></div>;
}