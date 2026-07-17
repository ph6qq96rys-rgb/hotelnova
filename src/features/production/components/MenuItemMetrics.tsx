import type { MenuItemDto } from "../types";

function money(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return "—";

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="p-card" style={{ margin: 0 }}>
      <div className="p-card__body" style={{ padding: 14 }}>
        <div className="mid-metric__label">{label}</div>
        <div className="mid-metric__value">{value}</div>
        {hint && (
          <div style={{ color: "var(--p-text-muted)", fontSize: 12, marginTop: 4 }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MenuItemMetrics({ item }: { item: MenuItemDto }) {
  const cost = item.cost ?? null;
  const sellingPrice = item.sellingPrice ?? null;

  const marginValue =
    sellingPrice != null && cost != null ? Number(sellingPrice) - Number(cost) : null;

  const marginPct =
    sellingPrice && cost != null && Number(sellingPrice) > 0
      ? `${(((Number(sellingPrice) - Number(cost)) / Number(sellingPrice)) * 100).toFixed(1)}%`
      : "—";

  const posReady = Boolean(
    item.isActive === true &&
      item.isAvailableForSale === true &&
      item.hasRecipe === true &&
      item.hasConsumptionLocation === true
  );

  return (
    <div className="mid-metrics-grid">
      <Metric label="Selling Price" value={money(sellingPrice)} />
      <Metric label="Recipe Cost" value={money(cost)} />
      <Metric
        label="Gross Margin"
        value={marginValue == null ? "—" : `${money(marginValue)} · ${marginPct}`}
      />
      <Metric label="Units Sold" value={item.unitsSold ?? 0} />
      <Metric
        label="ERP Readiness"
        value={posReady ? "Approved" : "Blocked"}
        hint={posReady ? "Visible to POS" : "Missing setup"}
      />
    </div>
  );
}
