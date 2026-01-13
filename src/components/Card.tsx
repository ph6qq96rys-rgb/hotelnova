import type { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action
}: {
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b px-5 py-3">
      {title && <h3 className="font-medium text-slate-800">{title}</h3>}
      {action}
    </div>
  );
}

export function CardContent({ children }: { children: ReactNode }) {
  return <div className="p-5">{children}</div>;
}
