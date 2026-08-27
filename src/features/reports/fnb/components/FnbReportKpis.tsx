import type { FnbReportKpiDto } from "../api/fnbReportsApi";
import { formatReportValue } from "../utils/fnbReportFormatting";

type Props = {
  kpis: FnbReportKpiDto[];
  rowsShown: number;
  currencyCode?: string;
};

export function FnbReportKpis({
  kpis,
  rowsShown,
  currencyCode = "ETB",
}: Props) {
  return (
    <div className="fnb-kpi-grid">
      {kpis.map((kpi) => (
        <div key={kpi.key} className="fnb-kpi">
          <span>{kpi.label}</span>
          <strong>{formatReportValue(kpi.value, kpi.format, currencyCode)}</strong>
        </div>
      ))}

      <div className="fnb-kpi">
        <span>Rows Shown</span>
        <strong>{rowsShown.toLocaleString("en-GB")}</strong>
      </div>
    </div>
  );
}
