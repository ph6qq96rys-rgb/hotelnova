// src/features/production/pages/MenuEngineeringPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { useI18n } from "../../../i18n";
import { CAT_META, menuEngineeringApi } from "../api/menuEngineeringApi";
import type { AnalysisResponse, CategorySummary, MenuEngineeringCategory, MenuEngineeringItem } from "../api/menuEngineeringApi";
import "../layout/production.css";

//  Types 

type SortKey =
  | "itemName"
  | "category"
  | "quantitySold"
  | "totalRevenue"
  | "totalCost"
  | "foodCostPct"
  | "contributionMargin"
  | "grossProfit"
  | "grossProfitPct"
  | "popularityIndex"
  | "profitabilityIndex"
  | "recommendation";

type EngineeredItem = MenuEngineeringItem & {
  revenue: number;
  foodCost: number;
  grossProfit: number;
  grossProfitPct: number;
  bostonCategory: MenuEngineeringCategory;
  aiRecommendation: string;
};

const CATEGORY_ORDER = ["STAR", "PUZZLE", "PLOWHORSE", "DOG"] as const;


//  Helpers 

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

const money = (n: number, dp = 0) => `$${fmt(n, dp)}`;
const pct = (n: number, dp = 1) => `${fmt(n, dp)}%`;

function numberOf(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function categoryLabel(category: MenuEngineeringCategory): string {
  if (category === "STAR") return "Star";
  if (category === "PLOWHORSE") return "Plow Horse";
  if (category === "PUZZLE") return "Puzzle";
  return "Dog";
}

function generateRecommendation(item: MenuEngineeringItem, category: MenuEngineeringCategory): string {
  const foodCostPct = numberOf(item.foodCostPct);
  const popularity = numberOf(item.popularityIndex);
  const profitability = numberOf(item.profitabilityIndex);

  if (category === "STAR") {
    return foodCostPct > 32
      ? "Negotiate ingredient costs while protecting demand."
      : "Protect placement and test a 3-5% price increase.";
  }

  if (category === "PLOWHORSE") {
    return foodCostPct > 35
      ? "Review recipe yield and reduce high-cost ingredients."
      : "Increase price by 5% or bundle with high-margin sides.";
  }

  if (category === "PUZZLE") {
    return popularity < 80
      ? "Promote during lunch and improve menu description."
      : "Move to a stronger menu position and train servers to suggest it.";
  }

  return profitability < 80
    ? "Consider discontinuation or full recipe redesign."
    : "Limit visibility and replace with a higher-margin alternative.";
}

function normalizeItem(item: MenuEngineeringItem): EngineeredItem {
  const revenue = numberOf(item.revenue ?? item.totalRevenue);
  const foodCost = numberOf(item.foodCost ?? item.totalCost);
  const grossProfit = numberOf(item.grossProfit ?? item.totalMargin ?? revenue - foodCost);
  const grossProfitPct = revenue > 0
    ? numberOf(item.grossProfitPct ?? (grossProfit / revenue) * 100)
    : 0;
  const bostonCategory = item.bostonCategory ?? item.category;
  const aiRecommendation =
    String(item.aiRecommendation ?? item.recommendation ?? "").trim() ||
    generateRecommendation(item, bostonCategory);

  return {
    ...item,
    revenue,
    foodCost,
    grossProfit,
    grossProfitPct,
    bostonCategory,
    recommendation: aiRecommendation,
    aiRecommendation,
  };
}

function sortValue(item: EngineeredItem, key: SortKey): string | number {
  if (key === "grossProfit") return item.grossProfit;
  if (key === "grossProfitPct") return item.grossProfitPct;
  if (key === "recommendation") return item.aiRecommendation;
  if (key === "category") return categoryLabel(item.bostonCategory);
  if (key === "totalRevenue") return item.revenue;
  if (key === "totalCost") return item.foodCost;
  return (item as any)[key] ?? 0;
}

function getSummaryKey(cat: string): keyof AnalysisResponse["summary"] {
  const map: Record<string, keyof AnalysisResponse["summary"]> = {
    STAR: "stars", PUZZLE: "puzzles", PLOWHORSE: "plowhorses", DOG: "dogs",
  };
  return map[cat] ?? "stars";
}

//  Sub-components 

function SummaryCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="p-summary">
      <div className="p-summary__label">{label}</div>
      <div className={`p-summary__value${danger ? " is-danger" : ""}`}>{value}</div>
    </div>
  );
}

function Th({
  label, col, sortCol, sortDir, onSort, align = "right",
}: {
  label: string; col: SortKey; sortCol: SortKey; sortDir: "asc" | "desc";
  onSort: (col: SortKey) => void; align?: "left" | "right";
}) {
  const mark = sortCol === col ? (sortDir === "asc" ? " " : " ") : "";
  return (
    <th className={align === "left" ? "" : "num"} onClick={() => onSort(col)}>
      {label}{mark}
    </th>
  );
}

//  Component 

export default function MenuEngineeringPage() {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();

  const [loading,       setLoading]       = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [data,          setData]          = useState<AnalysisResponse | null>(null);
  const [categoryFilter,setCategoryFilter]= useState("ALL");
  const [search,        setSearch]        = useState("");
  const [sortCol,       setSortCol]       = useState<SortKey>("grossProfit");
  const [sortDir,       setSortDir]       = useState<"asc" | "desc">("desc");

  //  Load 

  useEffect(() => {
    if (!companyId || !branchId) return;
    let cancelled = false;

    setLoading(true); setError(null);
    menuEngineeringApi.get(companyId, branchId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e: any) => { if (!cancelled) setError(e?.response?.data?.message ?? e?.message ?? "Failed to load analysis."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [companyId, branchId]);

  async function recalculate() {
    if (!companyId || !branchId) return;
    setRecalculating(true); setError(null);
    try {
      setData(await menuEngineeringApi.recalculate(companyId, branchId));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Recalculation failed.");
    } finally {
      setRecalculating(false);
    }
  }

  //  Derived items 

  const normalizedItems = useMemo(() => (data?.items ?? []).map(normalizeItem), [data]);

  const totals = useMemo(() => {
    const quantity = normalizedItems.reduce((sum, item) => sum + numberOf(item.quantitySold), 0);
    const revenue = normalizedItems.reduce((sum, item) => sum + item.revenue, 0);
    const foodCost = normalizedItems.reduce((sum, item) => sum + item.foodCost, 0);
    const grossProfit = normalizedItems.reduce((sum, item) => sum + item.grossProfit, 0);

    return {
      quantity,
      revenue,
      foodCost,
      foodCostPct: revenue > 0 ? (foodCost / revenue) * 100 : 0,
      grossProfit,
      grossProfitPct: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    };
  }, [normalizedItems]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();

    return normalizedItems
      .filter((item) => categoryFilter === "ALL" || item.bostonCategory === categoryFilter)
      .filter((item) =>
        !q ||
        item.itemName.toLowerCase().includes(q) ||
        (item.itemCode ?? "").toLowerCase().includes(q) ||
        item.aiRecommendation.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const av = sortValue(a, sortCol);
        const bv = sortValue(b, sortCol);
        const cmp = typeof av === "string"
          ? String(av ?? "").localeCompare(String(bv ?? ""))
          : Number(av ?? 0) - Number(bv ?? 0);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [normalizedItems, categoryFilter, search, sortCol, sortDir]);

  function toggleSort(col: SortKey) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  //  Guards 

  if (!companyId || !branchId) {
    return (
      <div className="p-page">
        <div className="p-guard"><div className="p-guard__icon"></div>Select a company and branch to continue.</div>
      </div>
    );
  }

  const busy = loading || recalculating;

  //  Render 

  return (
    <div className="p-page p-menu-eng">
      {/* Header */}
      <div className="p-page-header">
        <div>
          <p className="p-kicker">ERP Menu Engineering</p>
          <h1 className="p-title">Menu Engineering Dashboard</h1>
          <p className="p-subtitle">
            Boston Matrix analysis - quantity sold, contribution margin, revenue,
            and food-cost performance.
          </p>
          {data && (
            <p className="p-timestamp">Last calculated: {new Date(data.analysedAt).toLocaleString()}</p>
          )}
        </div>

        <button className="p-btn p-btn--primary" onClick={recalculate} disabled={busy}>
          {recalculating ? "Recalculating..." : "Recalculate Analysis"}
        </button>
      </div>

      {error && (
        <div className="p-alert p-alert--error">
          <span className="p-alert__body">{error}</span>
          <button className="p-dismiss" onClick={() => setError(null)}></button>
        </div>
      )}

      {loading && !data ? (
        <div className="p-guard" style={{ padding: 40 }}>Loading menu engineering analysis...</div>
      ) : data ? (
        <>
          {/* KPI cards */}
          <div className="p-kpi-grid p-menu-category-grid">
            {CATEGORY_ORDER.map((cat) => {
              const meta    = CAT_META[cat];
              const summary = data.summary[getSummaryKey(cat)] as CategorySummary;
              return (
                <button
                  key={cat}
                  type="button"
                  className={`p-kpi${categoryFilter === cat ? " is-active" : ""}`}
                  onClick={() => setCategoryFilter((prev) => prev === cat ? "ALL" : cat)}
                >
                  <div className="p-kpi__label">{categoryLabel(cat)}</div>
                  <div className="p-kpi__value">{summary.count}</div>
                  <div className="p-kpi__meta">
                    <span>Revenue {money(summary.totalRevenue)}</span>
                    <span>Gross profit {money(summary.totalMargin)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Summary bar */}
          <div className="p-summary-bar p-menu-summary-bar">
            <SummaryCard label="Quantity Sold" value={fmt(totals.quantity, 0)} />
            <SummaryCard label="Revenue" value={money(totals.revenue)} />
            <SummaryCard label="Food Cost" value={`${money(totals.foodCost)} / ${pct(totals.foodCostPct)}`} danger={totals.foodCostPct > 35} />
            <SummaryCard label="Gross Profit" value={`${money(totals.grossProfit)} / ${pct(totals.grossProfitPct)}`} />
          </div>

          <div className="p-card p-menu-matrix-card">
            <div className="p-card__head">
              <div>
                <p className="p-card__title">Beyond Boston Matrix</p>
                <p className="p-card__subtitle">Quadrants stay visible while the table carries full ERP economics.</p>
              </div>
            </div>
            <div className="p-matrix-grid">
              {CATEGORY_ORDER.map((cat) => {
                const meta = CAT_META[cat];
                const catItems = normalizedItems.filter((item) => item.bostonCategory === cat);
                const topItems = [...catItems].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 3);

                return (
                  <button
                    key={cat}
                    type="button"
                    className="p-matrix-quadrant"
                    onClick={() => setCategoryFilter(cat)}
                  >
                    <div className="p-matrix-quadrant__head">
                      <span className="p-cat-pill" style={{ color: meta.color, background: meta.bg }}>
                        <span className="p-cat-pill__dot" style={{ background: meta.color }} />
                        {categoryLabel(cat)}
                      </span>
                      <strong>{catItems.length}</strong>
                    </div>
                    <div className="p-matrix-quadrant__items">
                      {topItems.length ? topItems.map((item) => item.itemName).join(", ") : tx("No items classified")}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table card */}
          <div className="p-card">
            <div className="p-toolbar">
              <div>
                <p className="p-card__title">{tx("Menu Item Performance")}</p>
                <p className="p-card__subtitle">{tx("Full ERP metric set per menu item.")}</p>
              </div>
              <div className="p-toolbar__controls">
                <select
                  className="p-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ width: 180 }}
                >
                  <option value="ALL">{tx("All Boston Categories")}</option>
                  {CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>{categoryLabel(cat)}</option>
                  ))}
                </select>
                <input
                  className="p-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tx("Search item or code...")}
                  style={{ width: 220 }}
                />
              </div>
            </div>

            <div className="p-table-wrap p-menu-table-wrap">
              <table className="p-table p-menu-table">
                <thead>
                  <tr>
                    <Th label={tx("Menu Item")} col="itemName" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="left" />
                    <Th label={tx("Qty Sold")} col="quantitySold" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label={tx("Revenue")} col="totalRevenue" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label={tx("Food Cost")} col="totalCost" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label={tx("Food Cost %")} col="foodCostPct" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label={tx("Contribution")} col="contributionMargin" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label={tx("Gross Profit")} col="grossProfit" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label={tx("Gross Profit %")} col="grossProfitPct" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label={tx("Popularity")} col="popularityIndex" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label={tx("Profitability")} col="profitabilityIndex" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label={tx("Boston Category")} col="category" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="left" />
                    <Th label={tx("AI Recommendation")} col="recommendation" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="left" />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={12} className="p-table__empty">{tx("No items match the current filter.")}</td></tr>
                  ) : items.map((item) => {
                    const meta = CAT_META[item.bostonCategory];
                    return (
                      <tr key={item.menuItemId}>
                        <td>
                          <strong>{item.itemName}</strong>
                          {item.itemCode && (
                            <span className="p-menu-code">
                              {item.itemCode}
                            </span>
                          )}
                        </td>
                        <td className="num">{fmt(item.quantitySold, 0)}</td>
                        <td className="num">{money(item.revenue)}</td>
                        <td className="num">{money(item.foodCost)}</td>
                        <td className={`num${item.foodCostPct > 35 ? " is-danger" : item.foodCostPct < 25 ? " is-success" : ""}`}>
                          {pct(item.foodCostPct)}
                        </td>
                        <td className="num">{money(item.contributionMargin, 2)}</td>
                        <td className="num">{money(item.grossProfit)}</td>
                        <td className={`num${item.grossProfitPct >= 65 ? " is-success" : item.grossProfitPct < 45 ? " is-danger" : ""}`}>
                          {pct(item.grossProfitPct)}
                        </td>
                        <td className="num">{fmt(item.popularityIndex, 1)}</td>
                        <td className="num">{fmt(item.profitabilityIndex, 1)}</td>
                        <td>
                          <span className="p-cat-pill" style={{ color: meta.color, background: meta.bg }}>
                            <span className="p-cat-pill__dot" style={{ background: meta.color }} />
                            {categoryLabel(item.bostonCategory)}
                          </span>
                        </td>
                        <td className="p-reco">{item.recommendation ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="p-guard">No analysis available. Click "Recalculate Analysis" to begin.</div>
      )}
    </div>
  );
}
