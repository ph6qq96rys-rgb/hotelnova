import { Button } from "../../../../components/ui/button";
import { useI18n } from "../../../../i18n";
import type { FnbReportDrilldownDto } from "../api/fnbReportsApi";
import { formatReportDateTime, formatReportMoney, formatReportNumber } from "../utils/fnbReportFormatting";

type Props = {
  drilldown: FnbReportDrilldownDto;
  reportKey: string;
  currencyCode?: string;
  timeZone?: string | null;
  page: number;
  pageCount: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onOpenItem: () => void;
  onClose: () => void;
};

const text = (value: unknown, fallback = "-") => (value == null || value === "" ? fallback : String(value));
const num = (value: unknown) => (typeof value === "number" ? value : value == null ? null : Number(value));

/** Posted ledger lines behind one report row, paged on the server. */
export function FnbMovementDrilldown({
  drilldown, reportKey, currencyCode, timeZone, page, pageCount, totalRows, onPageChange, onOpenItem, onClose,
}: Props) {
  const { tx } = useI18n();

  return (
    <section className="fnb-drilldown" aria-label={tx("Movement drilldown")}>
      <div className="fnb-table-toolbar">
        <div>
          <strong>{drilldown.itemName || tx("Movement drilldown")}</strong>
          <p>
            {drilldown.locationName || tx("All locations")} /{" "}
            {formatReportNumber(drilldown.summary?.totalQty)} {tx("net")} {drilldown.uomName || tx("qty")} /{" "}
            {formatReportMoney(drilldown.summary?.totalValue, currencyCode)}
          </p>
          {reportKey === "fifo-aging" ? <p>{tx("Item stock ledger — all receipt ages")}</p> : null}
          <p>
            {tx("Movement details generated {time}. Later postings may change movement totals.", {
              time: formatReportDateTime(drilldown.generatedAtUtc, timeZone),
            })}
          </p>
        </div>
        <div className="fnb-toolbar">
          <Button type="button" variant="outline" size="sm" onClick={onOpenItem} disabled={!drilldown.itemId}>
            {tx("Open item master")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {tx("Close")}
          </Button>
        </div>
      </div>

      <div className="fnb-table-wrap">
        <table className="fnb-table">
          <thead>
            <tr>
              <th>{tx("Posted")}</th>
              <th>{tx("Source")}</th>
              <th className="num">{tx("Qty In")}</th>
              <th className="num">{tx("Qty Out")}</th>
              <th className="num">{tx("Value In")}</th>
              <th className="num">{tx("Value Out")}</th>
              <th>{tx("Batch")}</th>
            </tr>
          </thead>
          <tbody>
            {drilldown.ledger.length === 0 ? (
              <tr>
                <td colSpan={7} className="fnb-empty">{tx("No source movements found for this selection.")}</td>
              </tr>
            ) : (
              drilldown.ledger.map((line, index) => (
                <tr key={text(line.id, String(index))}>
                  <td>{formatReportDateTime(text(line.postedAtUtc, ""), timeZone)}</td>
                  <td>
                    <strong>{text(line.sourceNo ?? line.sourceType)}</strong>
                    <span>{text(line.direction)}</span>
                  </td>
                  <td className="num">{formatReportNumber(num(line.qtyInBase))}</td>
                  <td className="num">{formatReportNumber(num(line.qtyOutBase))}</td>
                  <td className="num">{formatReportMoney(num(line.valueIn), currencyCode)}</td>
                  <td className="num">{formatReportMoney(num(line.valueOut), currencyCode)}</td>
                  <td>{text(line.batchNo)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav className="fnb-movement-pagination" aria-label={tx("Movement pages")}>
        <span>
          {tx("{total} movements · Page {page} of {pages}. Totals cover all matching movements.", {
            total: formatReportNumber(totalRows), page, pages: pageCount,
          })}
        </span>
        <div className="fnb-toolbar">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            {tx("Previous")}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
            {tx("Next")}
          </Button>
        </div>
      </nav>
    </section>
  );
}
