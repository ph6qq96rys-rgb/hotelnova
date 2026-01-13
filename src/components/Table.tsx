import type { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return <table className="w-full border-collapse text-sm">{children}</table>;
}

export function Th({
  children,
  align = "left"
}: {
  children?: React.ReactNode; // ✅ now optional
  align?: "left" | "right";
}) {
  const alignClass = align === "right" ? "text-right" : "text-left";
  return (
    <th
      className={`border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 ${alignClass}`}
    >
      {children ?? null}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  colSpan
}: {
  children: ReactNode;
  align?: "left" | "right";
  colSpan?: number;
}) {
  const alignClass = align === "right" ? "text-right" : "text-left";
  return (
    <td colSpan={colSpan} className={`border-b px-4 py-3 ${alignClass}`}>
      {children}
    </td>
  );
}
