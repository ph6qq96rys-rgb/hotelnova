export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div><div className="text-sm font-black text-slate-950">{title}</div>{subtitle ? <div className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</div> : null}</div>;
}