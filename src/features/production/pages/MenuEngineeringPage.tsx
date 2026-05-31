// src/features/production/pages/MenuEngineeringPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { CAT_META, menuEngineeringApi } from "../api/menuEngineeringApi";
import type { AnalysisResponse, CategorySummary, MenuEngineeringItem } from "../api/menuEngineeringApi";
import "../production.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = "itemName" | "category" | "quantitySold" | "contributionMargin" | "foodCostPct" | "totalRevenue" | "recommendation";

const CATEGORY_ORDER = ["STAR", "PUZZLE", "PLOWHORSE", "DOG"] as const;


// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

function getSummaryKey(cat: string): keyof AnalysisResponse["summary"] {
  const map: Record<string, keyof AnalysisResponse["summary"]> = {
    STAR: "stars", PUZZLE: "puzzles", PLOWHORSE: "plowhorses", DOG: "dogs",
  };
  return map[cat] ?? "stars";
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
  const mark = sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th className={align === "left" ? "" : "num"} onClick={() => onSort(col)}>
      {label}{mark}
    </th>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MenuEngineeringPage() {
  const { companyId, branchId } = useAppScope();

  const [loading,       setLoading]       = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [data,          setData]          = useState<AnalysisResponse | null>(null);
  const [categoryFilter,setCategoryFilter]= useState("ALL");
  const [search,        setSearch]        = useState("");
  const [sortCol,       setSortCol]       = useState<SortKey>("totalRevenue");
  const [sortDir,       setSortDir]       = useState<"asc" | "desc">("desc");

  // ── Load ──────────────────────────────────────────────────────────────────

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

  // ── Derived items ─────────────────────────────────────────────────────────

  const items = useMemo(() => {
    if (!data?.items) return [];
    const q = search.trim().toLowerCase();

    return data.items
      .filter((item) => categoryFilter === "ALL" || item.category === categoryFilter)
      .filter((item) => !q || item.itemName.toLowerCase().includes(q) || (item.itemCode ?? "").toLowerCase().includes(q))
      .sort((a, b) => {
        const av = a[sortCol as keyof MenuEngineeringItem] as any;
        const bv = b[sortCol as keyof MenuEngineeringItem] as any;
        const cmp = typeof av === "string"
          ? String(av ?? "").localeCompare(String(bv ?? ""))
          : Number(av ?? 0) - Number(bv ?? 0);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [data, categoryFilter, search, sortCol, sortDir]);

  function toggleSort(col: SortKey) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!companyId || !branchId) {
    return (
      <div className="p-page">
        <div className="p-guard"><div className="p-guard__icon">📊</div>Select a company and branch to continue.</div>
      </div>
    );
  }

  const busy = loading || recalculating;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-page">
      {/* Header */}
      <div className="p-page-header">
        <div>
          <p className="p-kicker">Menu Profitability</p>
          <h1 className="p-title">Menu Engineering</h1>
          <p className="p-subtitle">
            Boston Matrix analysis — quantity sold, contribution margin, revenue,
            and food-cost performance.
          </p>
          {data && (
            <p className="p-timestamp">Last calculated: {new Date(data.analysedAt).toLocaleString()}</p>
          )}
        </div>

        <button className="p-btn p-btn--primary" onClick={recalculate} disabled={busy}>
          {recalculating ? "Recalculating…" : "Recalculate Analysis"}
        </button>
      </div>

      {error && (
        <div className="p-alert p-alert--error">
          <span className="p-alert__body">{error}</span>
          <button className="p-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {loading && !data ? (
        <div className="p-guard" style={{ padding: 40 }}>Loading menu engineering analysis…</div>
      ) : data ? (
        <>
          {/* KPI cards */}
          <div className="p-kpi-grid">
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
                  <div className="p-kpi__icon">{meta.icon}</div>
                  <div className="p-kpi__label">{meta.label}</div>
                  <div className="p-kpi__value">{summary.count}</div>
                  <div className="p-kpi__meta">
                    <span>Revenue ${fmt(summary.totalRevenue, 0)}</span>
                    <span>Margin ${fmt(summary.totalMargin, 0)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Summary bar */}
          <div className="p-summary-bar">
            <SummaryCard label="Total Revenue" value={`$${fmt(data.summary.totalRevenue, 0)}`} />
            <SummaryCard label="Total Margin"  value={`$${fmt(data.summary.totalMargin, 0)}`} />
            <SummaryCard label="Avg Food Cost" value={`${fmt(data.summary.avgFoodCostPct, 1)}%`} danger={data.summary.avgFoodCostPct > 35} />
            <SummaryCard label="Items Analyzed" value={String(data.items.length)} />
          </div>

          {/* Table card */}
          <div className="p-card">
            <div className="p-toolbar">
              <div>
                <p className="p-card__title">Item Classification</p>
                <p className="p-card__subtitle">Filter, search, and sort menu items by profitability and popularity.</p>
              </div>
              <div className="p-toolbar__controls">
                <select
                  className="p-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ width: 180 }}
                >
                  <option value="ALL">All Categories</option>
                  {CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>{CAT_META[cat].label}</option>
                  ))}
                </select>
                <input
                  className="p-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search item or code…"
                  style={{ width: 220 }}
                />
              </div>
            </div>

            <div className="p-table-wrap">
              <table className="p-table">
                <thead>
                  <tr>
                    <Th label="Item"          col="itemName"          sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="left" />
                    <Th label="Class"         col="category"          sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="left" />
                    <Th label="Qty Sold"      col="quantitySold"      sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label="Contribution"  col="contributionMargin" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label="Food Cost %"   col="foodCostPct"       sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label="Revenue"       col="totalRevenue"      sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                    <Th label="Recommendation" col="recommendation"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="left" />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={7} className="p-table__empty">No items match the current filter.</td></tr>
                  ) : items.map((item) => {
                    const meta = CAT_META[item.category];
                    return (
                      <tr key={item.menuItemId}>
                        <td>
                          <strong>{item.itemName}</strong>
                          {item.itemCode && (
                            <span style={{ display: "block", fontFamily: "var(--p-mono)", fontSize: 11, color: "var(--p-text-muted)", marginTop: 2 }}>
                              {item.itemCode}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="p-cat-pill" style={{ color: meta.color, background: meta.bg }}>
                            <span className="p-cat-pill__dot" style={{ background: meta.color }} />
                            {item.category}
                          </span>
                        </td>
                        <td className="num">{item.quantitySold}</td>
                        <td className="num">${fmt(item.contributionMargin)}</td>
                        <td className={`num${item.foodCostPct > 35 ? " is-danger" : item.foodCostPct < 25 ? " is-success" : ""}`}
                            style={{ color: item.foodCostPct > 35 ? "var(--p-danger)" : item.foodCostPct < 25 ? "var(--p-success)" : undefined }}>
                          {fmt(item.foodCostPct, 1)}%
                        </td>
                        <td className="num">${fmt(item.totalRevenue, 0)}</td>
                        <td className="p-reco">{item.recommendation ?? "—"}</td>
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