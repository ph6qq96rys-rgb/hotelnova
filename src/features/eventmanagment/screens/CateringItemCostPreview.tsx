import { useEffect, useState } from "react";
import { http } from "../../../api/http";
import { StateMessage } from "../../../components/ui/Feedback";
import { formatCurrency as money } from "../../../shared/currency/currencyFormat";
import { readApiError } from "../sales/ui";
type Cost = {
  source: string;
  complete: boolean;
  totalCost: number | null;
  costPerServing?: number | null;
  lines: {
    itemId: string;
    name: string;
    baseQuantity: number;
    unit: string;
    unitCost: number | null;
    cost: number | null;
    costSource: string;
  }[];
};
export function CateringItemCostPreview({
  companyId,
  request,
}: {
  companyId: string;
  request: {
    branchId: string | null;
    consumptionLocationId?: string | null;
    recipeId?: string | null;
    inventoryItemId?: string | null;
    uomId?: string | null;
    lines?: unknown[];
    serving?: unknown;
  };
}) {
  const key = JSON.stringify(request),
    [state, setState] = useState<{ key: string; cost?: Cost; error?: string }>({ key: "" });
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(() => {
      http
        .post<Cost>("/companies/" + companyId + "/catering/catalog/items/cost-preview", JSON.parse(key), {
          signal: c.signal,
        })
        .then((r) => {
          if (!c.signal.aborted) setState({ key, cost: r.data });
        })
        .catch((e) => {
          if (!c.signal.aborted) setState({ key, error: readApiError(e) });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [companyId, key]);

  if (state.key !== key) return <StateMessage tone="loading">Calculating cost…</StateMessage>;
  if (state.error) return <StateMessage tone="error">{state.error}</StateMessage>;
  const cost = state.cost;
  if (!cost) return null;
  const orderedLines = [...cost.lines].sort(
    (a, b) =>
      a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base", numeric: true }) ||
      a.itemId.localeCompare(b.itemId),
  );
  return (
    <section aria-label="Catering item cost preview" aria-live="polite">
      <h3>{request.serving ? "Cost per recipe batch" : "Ingredient cost"}</h3>
      <strong>{cost.complete ? money(cost.totalCost!) : "Cost incomplete"}</strong>
      {cost.costPerServing != null && <p>Cost per serving: {money(cost.costPerServing)}</p>}
      {!cost.complete && (
        <StateMessage tone="warning">
          {cost.lines.length
            ? "Some ingredients have no cost: they have never been received and have no default cost. Receive them once, or set a default cost on the inventory item."
            : "Link an inventory item or configure recipe ingredients to calculate cost."}
        </StateMessage>
      )}
      <p>
        {cost.source === "Recipe"
          ? "Calculated from recipe ingredients, conversions and waste. The recipe takes precedence over a direct inventory link."
          : "Calculated for one selected inventory unit."}{" "}
        Costs use stock on hand at the consumption location when there is enough; otherwise the last
        received cost, then the item's default cost. Stock is only consumed when it is issued to a sold event.
      </p>
      <div className="co-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Inventory item</th>
              <th>Quantity in base unit</th>
              <th>Unit cost</th>
              <th>Cost</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {orderedLines.map((line, i) => {
              const missing = line.unitCost == null || line.cost == null || line.costSource === "Missing stock cost";
              return (
                <tr key={line.itemId + ":" + i} style={missing ? { background: "var(--erp-warn-bg)" } : undefined}>
                  <td>{line.name}</td>
                  <td>
                    {line.baseQuantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} {line.unit}
                  </td>
                  <td>{missing ? "Missing" : money(line.unitCost)}</td>
                  <td>{missing ? "Missing" : money(line.cost)}</td>
                  <td>{line.costSource}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
