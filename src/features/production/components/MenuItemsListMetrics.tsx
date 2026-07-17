import type { ReactNode } from "react";

type Props = {
  total: number;
  visible: number;
  ready: number;
  blocked: number;
  missingRecipe: number;
  missingLocation: number;
};

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="p-card" style={{ margin: 0 }}>
      <div className="p-card__body" style={{ padding: 14 }}>
        <div style={{ fontSize: 11, color: "var(--p-text-muted)", textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
        {hint && <div style={{ fontSize: 11, color: "var(--p-text-muted)" }}>{hint}</div>}
      </div>
    </div>
  );
}

export default function MenuItemsListMetrics({
  total,
  visible,
  ready,
  blocked,
  missingRecipe,
  missingLocation,
}: Props) {
  return (
    <div className="mi-list-metrics">
      <Metric label="Total Items" value={total} hint={`${visible} visible`} />
      <Metric label="POS Ready" value={ready} />
      <Metric label="Blocked" value={blocked} />
      <Metric label="Missing Recipes" value={missingRecipe} />
      <Metric label="Missing Locations" value={missingLocation} />
    </div>
  );
}
