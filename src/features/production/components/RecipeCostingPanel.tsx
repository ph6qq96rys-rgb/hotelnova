// src/features/production/components/RecipeCostingPanel.tsx

import { useState } from "react";
import { recipeCostingApi, type RecipeCostDto } from "../api/recipeCostingApi";
import { menuItemsApi } from "../api/menuItemsApi";
import type { MenuItemDto, UpsertMenuItemRequest } from "../types";
import "../production.css";

interface Props {
  companyId: string;
  branchId: string;
  menuItemId: string;
  disabled?: boolean;
}

function fmt(n: number, dp = 2): string {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

function extractApiError(e: unknown, fallback: string): string {
  const err = e as any;
  const data = err?.response?.data;
  if (!data) return err?.message ?? fallback;
  if (typeof data === "string") return data;
  return data?.message ?? data?.title ?? err?.message ?? fallback;
}

function foodCostColor(pct: number | null | undefined, target: number): string {
  if (pct == null) return "inherit";
  if (pct <= target) return "var(--p-success)";
  if (pct <= target * 1.1) return "var(--p-warning)";
  return "var(--p-danger)";
}

function toUpsertRequest(item: MenuItemDto, sellingPrice: number): UpsertMenuItemRequest {
  return {
    name: item.name,
    code: item.code || null,
    externalCode: item.externalCode || null,
    categoryId: item.categoryId,
    subCategoryId: item.subCategoryId || null,
    itemType: item.itemType,
    sellingPrice,
    isActive: item.isActive,
    isAvailableForSale: item.isAvailableForSale,
    consumptionLocationId: item.consumptionLocationId || null,
    outputItemId: item.outputItemId || null,
    outputUomId: item.outputUomId || null,
  };
}

export function RecipeCostingPanel({
  companyId,
  branchId,
  menuItemId,
  disabled,
}: Props) {
  const [previewing, setPreviewing] = useState(false);
  const [savingCost, setSavingCost] = useState(false);
  const [applyingPrice, setApplyingPrice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cost, setCost] = useState<RecipeCostDto | null>(null);
  const [targetPct, setTargetPct] = useState(30);

  const busy = previewing || savingCost || applyingPrice || !!disabled;

  const grossProfit = cost
    ? cost.currentSellingPrice - cost.totalRecipeCost
    : 0;

  const grossMarginPct =
    cost && cost.currentSellingPrice > 0
      ? (grossProfit / cost.currentSellingPrice) * 100
      : 0;

  const recommendation =
    !cost?.foodCostPct
      ? "Preview Required"
      : cost.foodCostPct <= cost.targetFoodCostPct
        ? "Excellent"
        : cost.foodCostPct <= cost.targetFoodCostPct * 1.1
          ? "Acceptable"
          : "Review Price";

  async function preview() {
    setError(null);
    setSuccess(null);
    setPreviewing(true);

    try {
      const dto = await recipeCostingApi.get(companyId, menuItemId, targetPct / 100);
      setCost(dto);
    } catch (e) {
      setError(extractApiError(e, "Failed to calculate recipe cost."));
    } finally {
      setPreviewing(false);
    }
  }

  async function saveCost() {
    setError(null);
    setSuccess(null);
    setSavingCost(true);

    try {
      const dto = await recipeCostingApi.recalculate(companyId, menuItemId, targetPct / 100);
      setCost(dto);
      setSuccess("Recipe cost saved to menu item.");
    } catch (e) {
      setError(extractApiError(e, "Failed to save recipe cost."));
    } finally {
      setSavingCost(false);
    }
  }

  async function applySuggestedPrice() {
    if (!cost?.suggestedSellingPrice) return;

    setError(null);
    setSuccess(null);
    setApplyingPrice(true);

    try {
      const item = await menuItemsApi.get(companyId, branchId, menuItemId);
      const payload = toUpsertRequest(item, cost.suggestedSellingPrice);

      await menuItemsApi.update(companyId, branchId, menuItemId, payload);

      const refreshed = await recipeCostingApi.get(companyId, menuItemId, targetPct / 100);
      setCost(refreshed);

      setSuccess(`Selling price updated to ${fmt(cost.suggestedSellingPrice)}.`);
    } catch (e) {
      setError(extractApiError(e, "Failed to apply suggested selling price."));
    } finally {
      setApplyingPrice(false);
    }
  }

  return (
    <div className="p-section">
      <div className="p-section__head p-section__head--slate">
        <span style={{ color: "#7c3aed" }}>＄</span>
        COSTING — Menu engineering and theoretical food cost
        <span className="p-section__badge" style={{ background: "#ede9fe", color: "#5b21b6" }}>
          FIFO based
        </span>
      </div>

      <div className="p-section__body">
        {error && (
          <div className="p-alert p-alert--error" style={{ marginBottom: 12 }}>
            <span className="p-alert__body">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-alert p-alert--success" style={{ marginBottom: 12 }}>
            <span className="p-alert__body">{success}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
          <div className="p-field" style={{ margin: 0, width: 150 }}>
            <label className="p-field__label" style={{ fontSize: 11 }}>
              Target food cost %
            </label>
            <input
              className="p-input p-input--num"
              type="number"
              min={1}
              max={100}
              value={targetPct}
              onChange={(e) => setTargetPct(Number(e.target.value || 0))}
              disabled={busy}
            />
          </div>

          <button className="p-btn p-btn--outline" onClick={preview} disabled={busy}>
            {previewing ? "Calculating..." : "Preview Cost"}
          </button>

          <button
            className="p-btn p-btn--primary"
            onClick={saveCost}
            disabled={busy || !cost}
            title={!cost ? "Preview cost first" : undefined}
          >
            {savingCost ? "Saving..." : "Save Cost"}
          </button>

          {cost?.suggestedSellingPrice != null && (
            <button className="p-btn p-btn--success" onClick={applySuggestedPrice} disabled={busy}>
              {applyingPrice ? "Applying..." : `Apply Suggested Price (${fmt(cost.suggestedSellingPrice)})`}
            </button>
          )}
        </div>

        {cost ? (
          <>
            <div className="p-costing-cards">
              <div className="p-costing-card" style={{ background: "#eff6ff" }}>
                <div className="p-costing-card__label">Recipe Cost</div>
                <div className="p-costing-card__value" style={{ color: "#1e40af" }}>
                  {fmt(cost.totalRecipeCost)}
                </div>
                <div className="p-costing-card__sub">per menu unit</div>
              </div>

              <div className="p-costing-card" style={{ background: "#f0fdf4" }}>
                <div className="p-costing-card__label">Current Price</div>
                <div className="p-costing-card__value" style={{ color: "var(--p-success)" }}>
                  {fmt(cost.currentSellingPrice)}
                </div>
                <div className="p-costing-card__sub">menu selling price</div>
              </div>

              <div className="p-costing-card" style={{ background: "#fefce8" }}>
                <div className="p-costing-card__label">Food Cost %</div>
                <div
                  className="p-costing-card__value"
                  style={{ color: foodCostColor(cost.foodCostPct, cost.targetFoodCostPct) }}
                >
                  {cost.foodCostPct != null ? `${fmt(cost.foodCostPct, 1)}%` : "—"}
                </div>
                <div className="p-costing-card__sub">target {fmt(cost.targetFoodCostPct, 0)}%</div>
              </div>

              <div className="p-costing-card" style={{ background: "#fff7ed" }}>
                <div className="p-costing-card__label">Suggested Price</div>
                <div className="p-costing-card__value" style={{ color: "var(--p-warning)" }}>
                  {cost.suggestedSellingPrice != null ? fmt(cost.suggestedSellingPrice) : "—"}
                </div>
                <div className="p-costing-card__sub">target margin pricing</div>
              </div>

              <div className="p-costing-card" style={{ background: "#f8fafc" }}>
                <div className="p-costing-card__label">Gross Profit</div>
                <div className="p-costing-card__value">{fmt(grossProfit)}</div>
                <div className="p-costing-card__sub">price minus recipe cost</div>
              </div>

              <div className="p-costing-card" style={{ background: "#f8fafc" }}>
                <div className="p-costing-card__label">Gross Margin %</div>
                <div className="p-costing-card__value">{fmt(grossMarginPct, 1)}%</div>
                <div className="p-costing-card__sub">menu engineering margin</div>
              </div>

              <div className="p-costing-card" style={{ background: "#f8fafc" }}>
                <div className="p-costing-card__label">Recommendation</div>
                <div className="p-costing-card__value">{recommendation}</div>
                <div className="p-costing-card__sub">pricing review status</div>
              </div>
            </div>

            <div className="p-table-wrap">
              <table className="p-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th className="num">Qty / Unit</th>
                    <th className="num">Waste %</th>
                    <th className="num">UOM</th>
                    <th className="num">Unit Cost</th>
                    <th className="num">Line Cost</th>
                    <th className="num">% Total</th>
                  </tr>
                </thead>

                <tbody>
                  {cost.lines.map((line) => {
                    const pctOfTotal =
                      cost.totalRecipeCost > 0
                        ? (line.lineCost / cost.totalRecipeCost) * 100
                        : 0;

                    return (
                      <tr key={line.lineId}>
                        <td>
                          <span style={{ fontWeight: 600 }}>
                            {line.itemName || "Unknown item"}
                          </span>
                        </td>
                        <td className="num">{fmt(line.qtyPerMenuUnit, 4)}</td>
                        <td className="num">{line.wastePct != null ? `${fmt(line.wastePct, 1)}%` : "—"}</td>
                        <td className="num">{line.uomName || "—"}</td>
                        <td className="num">{fmt(line.unitCost, 4)}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{fmt(line.lineCost, 4)}</td>
                        <td className="num">{fmt(pctOfTotal, 1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ textAlign: "right" }}>
                      Total Recipe Cost
                    </td>
                    <td className="num">{fmt(cost.totalRecipeCost, 4)}</td>
                    <td className="num">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          !previewing && (
            <div style={{ textAlign: "center", padding: 24, color: "var(--p-text-muted)", fontSize: 13 }}>
              Click "Preview Cost" to calculate the theoretical food cost for this recipe.
            </div>
          )
        )}
      </div>
    </div>
  );
}