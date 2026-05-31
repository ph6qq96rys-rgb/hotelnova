// src/features/production/components/RecipeCostingPanel.tsx

import { useState } from "react";
import { recipeCostingApi, type RecipeCostDto } from "../api/recipeCostingApi";
import { menuItemsApi } from "../api/menuItemsApi";
import "../production.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  companyId:   string;
  branchId:    string;
  menuItemId:  string;
  disabled?:   boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dp = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function foodCostColor(pct: number | null, target: number): string {
  if (pct == null)          return "inherit";
  if (pct <= target)        return "var(--p-success)";
  if (pct <= target * 1.1)  return "var(--p-warning)";
  return "var(--p-danger)";
}

function extractApiError(e: unknown, fallback: string): string {
  const err = e as any;
  const data = err?.response?.data;
  if (!data) return err?.message ?? fallback;
  if (typeof data === "string") return data;
  return data?.message ?? data?.title ?? err?.message ?? fallback;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RecipeCostingPanel({ companyId, branchId, menuItemId, disabled }: Props) {
  const [previewing,    setPreviewing]    = useState(false);
  const [savingCost,    setSavingCost]    = useState(false);
  const [applyingPrice, setApplyingPrice] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [success,       setSuccess]       = useState<string | null>(null);
  const [cost,          setCost]          = useState<RecipeCostDto | null>(null);
  const [targetPct,     setTargetPct]     = useState(30);

  const busy = previewing || savingCost || applyingPrice || !!disabled;

  // ── Actions ───────────────────────────────────────────────────────────────

  async function preview() {
    setError(null); setSuccess(null); setPreviewing(true);
    try {
      setCost(await recipeCostingApi.get(companyId, menuItemId, targetPct / 100));
    } catch (e) {
      setError(extractApiError(e, "Failed to calculate cost."));
    } finally {
      setPreviewing(false);
    }
  }

  async function saveCost() {
    setError(null); setSuccess(null); setSavingCost(true);
    try {
      const dto = await recipeCostingApi.recalculate(companyId, menuItemId, targetPct / 100);
      setCost(dto);
      setSuccess("Recipe cost saved to menu item.");
    } catch (e) {
      setError(extractApiError(e, "Failed to save cost."));
    } finally {
      setSavingCost(false);
    }
  }

  async function applySuggestedPrice() {
    if (!cost?.suggestedSellingPrice) return;
    setError(null); setSuccess(null); setApplyingPrice(true);
    try {
      await menuItemsApi.updatePrice(companyId, branchId, menuItemId, cost.suggestedSellingPrice);
      const dto = await recipeCostingApi.get(companyId, menuItemId, targetPct / 100);
      setCost(dto);
      setSuccess(`Selling price updated to ${fmt(cost.suggestedSellingPrice)}.`);
    } catch (e) {
      setError(extractApiError(e, "Failed to update selling price."));
    } finally {
      setApplyingPrice(false);
    }
  }

  // ── Costing cards data ────────────────────────────────────────────────────

  const costingCards = cost
    ? [
        { label: "Recipe Cost",          value: fmt(cost.totalRecipeCost),     sub: "per menu unit",                       bg: "#eff6ff", color: "#1e40af" },
        { label: "Current Selling Price", value: fmt(cost.currentSellingPrice), sub: "set on menu item",                    bg: "#f0fdf4", color: "var(--p-success)" },
        { label: "Food Cost %",
          value: cost.foodCostPct != null ? `${fmt(cost.foodCostPct, 1)}%` : "—",
          sub: `target ${fmt(cost.targetFoodCostPct, 0)}%`,
          bg: "#fefce8",
          color: foodCostColor(cost.foodCostPct, cost.targetFoodCostPct) },
        { label: "Suggested Price",
          value: cost.suggestedSellingPrice != null ? fmt(cost.suggestedSellingPrice) : "—",
          sub: `at ${fmt(cost.targetFoodCostPct, 0)}% food cost`,
          bg: "#fff7ed",
          color: "var(--p-warning)" },
      ]
    : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-section">
      {/* Header */}
      <div className="p-section__head p-section__head--slate">
        <span style={{ color: "#7c3aed" }}>＄</span>
        COSTING — Theoretical food cost
        <span className="p-section__badge" style={{ background: "#ede9fe", color: "#5b21b6" }}>
          Based on latest FIFO costs
        </span>
      </div>

      <div className="p-section__body">
        {error   && <div className="p-alert p-alert--error"   style={{ marginBottom: 12 }}><span className="p-alert__body">{error}</span></div>}
        {success && <div className="p-alert p-alert--success" style={{ marginBottom: 12 }}><span className="p-alert__body">{success}</span></div>}

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
          <div className="p-field" style={{ margin: 0, width: 120 }}>
            <label className="p-field__label" style={{ fontSize: 11 }}>Target food cost %</label>
            <input
              className="p-input p-input--num"
              type="number"
              min={1}
              max={100}
              value={targetPct}
              onChange={(e) => setTargetPct(Number(e.target.value))}
              disabled={busy}
              style={{ width: 80 }}
            />
          </div>

          <button className="p-btn p-btn--outline" onClick={preview} disabled={busy}>
            {previewing ? "Calculating…" : "Preview Cost"}
          </button>

          <button
            className="p-btn p-btn--primary"
            onClick={saveCost}
            disabled={busy || !cost}
            title={!cost ? "Preview cost first" : undefined}
          >
            {savingCost ? "Saving…" : "Save Cost to Menu Item"}
          </button>

          {cost?.suggestedSellingPrice != null && (
            <button
              className="p-btn p-btn--success"
              onClick={applySuggestedPrice}
              disabled={busy}
            >
              {applyingPrice ? "Applying…" : `Apply Suggested Price (${fmt(cost.suggestedSellingPrice)})`}
            </button>
          )}
        </div>

        {/* Summary cards */}
        {cost && (
          <>
            <div className="p-costing-cards">
              {costingCards.map((card) => (
                <div key={card.label} className="p-costing-card" style={{ background: card.bg }}>
                  <div className="p-costing-card__label">{card.label}</div>
                  <div className="p-costing-card__value" style={{ color: card.color }}>{card.value}</div>
                  <div className="p-costing-card__sub">{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Line breakdown */}
            <div className="p-table-wrap">
              <table className="p-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th className="num" style={{ width: 100 }}>Qty / Unit</th>
                    <th className="num" style={{ width: 80 }}>Waste %</th>
                    <th className="num" style={{ width: 110 }}>Eff. Qty</th>
                    <th className="num" style={{ width: 110 }}>Unit Cost</th>
                    <th className="num" style={{ width: 110 }}>Line Cost</th>
                    <th className="num" style={{ width: 70 }}>% Total</th>
                  </tr>
                </thead>

                <tbody>
                  {cost.lines.map((line) => {
                    const pctOfTotal = cost.totalRecipeCost > 0
                      ? (line.lineCost / cost.totalRecipeCost) * 100
                      : 0;

                    return (
                      <tr key={line.lineId}>
                        <td>
                          <span style={{ fontWeight: 600 }}>
                            {line.itemName || <em style={{ color: "var(--p-text-soft)" }}>Unknown item</em>}
                          </span>
                          {line.uomName && (
                            <span style={{ color: "var(--p-text-soft)", marginLeft: 6, fontSize: 11 }}>
                              ({line.uomName})
                            </span>
                          )}
                        </td>
                        <td className="num">{fmt(line.qtyPerMenuUnit, 4)}</td>
                        <td className="num">{line.wastePct != null ? `${fmt(line.wastePct, 1)}%` : "—"}</td>
                        <td className="num">{fmt(line.effectiveQty, 4)}</td>
                        <td className="num">{fmt(line.unitCost, 4)}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{fmt(line.lineCost, 4)}</td>
                        <td className="num" style={{ color: "var(--p-text-muted)" }}>{fmt(pctOfTotal, 1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ textAlign: "right" }}>Total Recipe Cost</td>
                    <td className="num">{fmt(cost.totalRecipeCost, 4)}</td>
                    <td className="num">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {!cost && !previewing && (
          <div style={{ textAlign: "center", padding: 24, color: "var(--p-text-muted)", fontSize: 13 }}>
            Click "Preview Cost" to calculate the theoretical food cost for this recipe.
          </div>
        )}
      </div>
    </div>
  );
}