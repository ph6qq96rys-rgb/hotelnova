import { useI18n } from "../../../../i18n";
import type { FnbReportKpiDto } from "../api/fnbReportsApi";
import { formatReportNumber, formatReportValue } from "../utils/fnbReportFormatting";

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
  const { tx } = useI18n();
  return (
    <div className="fnb-kpi-grid">
      {kpis.map((kpi) => (
        <div key={kpi.key} className="fnb-kpi">
          <span>{tx(kpi.label)}</span>
          <strong>{formatReportValue(kpi.value, kpi.format, currencyCode)}</strong>
        </div>
      ))}

      <div className="fnb-kpi">
        <span>{tx("Rows shown")}</span>
        <strong>{formatReportNumber(rowsShown)}</strong>
      </div>
    </div>
  );
}
