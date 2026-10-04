import { useI18n } from "../../../../i18n";
import type { FnbReportRow } from "../api/fnbReportsApi";
import { formatReportMoney, formatReportNumber } from "../utils/fnbReportFormatting";
import {
  AGING_RISK_BUCKETS,
  buildAgingBuckets,
  numberFrom,
  topRowsByValue,
  type ReportFocus,
} from "../utils/fnbReportMeta";

type Props = {
  focus: ReportFocus;
  rows: FnbReportRow[];
  currencyCode?: string;
};

function ShareBar({ share }: { share: number }) {
  return (
    <div className="fnb-bar" aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(3, share))}%` }} />
    </div>
  );
}

function ConsumptionInsight({ rows, currencyCode }: Omit<Props, "focus">) {
  const { tx } = useI18n();
  const totalValue = rows.reduce((sum, row) => sum + numberFrom(row.value), 0);
  const count = (field: keyof FnbReportRow) => new Set(rows.map((row) => row[field]).filter(Boolean)).size;

  return (
    <section className="fnb-insight fnb-insight--consumption" aria-label={tx("Consumption report summary")}>
      <div className="fnb-insight-hero">
        <div>
          <p className="fnb-section-kicker">{tx("Consumption control")}</p>
          <h3>{tx("Cost concentration and usage movement")}</h3>
          <span>
            {tx("{items} items across {locations} locations and {categories} categories.", {
              items: formatReportNumber(count("itemId")),
              locations: formatReportNumber(count("locationName")),
              categories: formatReportNumber(count("categoryName")),
            })}
          </span>
        </div>
        <div className="fnb-insight-total">
          <span>{tx("Total consumed value")}</span>
          <strong>{formatReportMoney(totalValue, currencyCode)}</strong>
          <small>{tx("Quantities are shown per item and unit below")}</small>
        </div>
      </div>

      <div className="fnb-insight-grid">
        {topRowsByValue(rows).map((row, index) => {
          const value = numberFrom(row.value);
          const share = totalValue > 0 ? (value / totalValue) * 100 : 0;
          return (
            <article className="fnb-consumption-line" key={`${row.itemId ?? row.itemName}-${index}`}>
              <div>
                <strong>{String(row.itemName || tx("Unnamed item"))}</strong>
                <span>{String(row.locationName || row.categoryName || "-")}</span>
              </div>
              <div className="fnb-consumption-value">
                <strong>{formatReportMoney(value, currencyCode)}</strong>
                <span>{formatReportNumber(share, 1)}%</span>
              </div>
              <ShareBar share={share} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AgingInsight({ rows, currencyCode }: Omit<Props, "focus">) {
  const { tx } = useI18n();
  const buckets = buildAgingBuckets(rows);
  const totalValue = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
  const riskValue = buckets
    .filter((bucket) => AGING_RISK_BUCKETS.has(bucket.bucket))
    .reduce((sum, bucket) => sum + bucket.value, 0);
  const oldest = rows.reduce<FnbReportRow | undefined>(
    (best, row) => (!best || numberFrom(row.daysSinceLastMovement) > numberFrom(best.daysSinceLastMovement) ? row : best),
    undefined,
  );

  return (
    <section className="fnb-insight fnb-insight--aging" aria-label={tx("FIFO aging report summary")}>
      <div className="fnb-insight-hero">
        <div>
          <p className="fnb-section-kicker">{tx("FIFO aging control")}</p>
          <h3>{tx("Age exposure by remaining stock value")}</h3>
          <span>
            {tx("{value} sits in 61+ day layers from {rows} open FIFO rows.", {
              value: formatReportMoney(riskValue, currencyCode),
              rows: formatReportNumber(rows.length),
            })}
          </span>
        </div>
        <div className="fnb-insight-total">
          <span>{tx("Oldest open layer")}</span>
          <strong>{tx("{days} days", { days: formatReportNumber(numberFrom(oldest?.daysSinceLastMovement)) })}</strong>
          <small>{String(oldest?.itemName || "-")}</small>
        </div>
      </div>

      <div className="fnb-aging-strip">
        {buckets.map((bucket) => (
          <article className="fnb-aging-bucket" key={bucket.bucket}>
            <div>
              <span>{tx(bucket.bucket)}</span>
              <strong>{formatReportMoney(bucket.value, currencyCode)}</strong>
            </div>
            <small>{tx("{count} remaining layers", { count: formatReportNumber(bucket.count) })}</small>
            <ShareBar share={totalValue > 0 ? (bucket.value / totalValue) * 100 : 0} />
          </article>
        ))}
      </div>
    </section>
  );
}

/** Visual summary above the detail table for reports that have one. */
export function FnbReportInsights({ focus, rows, currencyCode }: Props) {
  if (!focus || rows.length === 0) return null;
  return focus === "consumption"
    ? <ConsumptionInsight rows={rows} currencyCode={currencyCode} />
    : <AgingInsight rows={rows} currencyCode={currencyCode} />;
}
