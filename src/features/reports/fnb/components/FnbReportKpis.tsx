import type { FnbReportKpiDto } from "../api/fnbReportsApi";

type Props = {
  kpis: FnbReportKpiDto[];
  rowsShown: number;
};

function formatValue(value: string | number | null, format: string): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;

  switch (format) {
    case "currency":
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    case "percent":
      return `${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`;

    case "number":
      return value.toLocaleString();

    default:
      return String(value);
  }
}

export function FnbReportKpis({ kpis, rowsShown }: Props) {
  return (
    <div className="fnb-kpi-grid">
      {kpis.map((kpi) => (
        <div key={kpi.key} className="fnb-kpi">
          <span>{kpi.label}</span>
          <strong>{formatValue(kpi.value, kpi.format)}</strong>
        </div>
      ))}

      <div className="fnb-kpi">
        <span>Rows Shown</span>
        <strong>{rowsShown.toLocaleString()}</strong>
      </div>
    </div>
  );
}