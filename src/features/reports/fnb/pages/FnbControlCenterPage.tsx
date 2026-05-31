import { useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import {
  getFnbReport,
  type FnbReportDto,
  type FnbReportKey,
  type FnbReportRow,
} from "../api/fnbReportsApi";
import "./fnb-reports.css";

const REPORTS: { key: FnbReportKey; label: string; group: string }[] = [
  { key: "kitchen-consumption", label: "Daily Kitchen Consumption", group: "Consumption" },
  { key: "bar-consumption", label: "Bar Consumption", group: "Consumption" },
  { key: "cogs", label: "COGS", group: "Consumption" },
  { key: "inventory-valuation", label: "Inventory Valuation", group: "Stock Control" },
  { key: "negative-inventory", label: "Negative Inventory", group: "Stock Control" },
  { key: "dead-stock", label: "Dead Stock", group: "Stock Control" },
  { key: "fifo-aging", label: "FIFO Aging", group: "Stock Control" },
  { key: "stock-turnover", label: "Stock Turnover", group: "Stock Control" },
  { key: "theoretical-vs-actual", label: "Theoretical vs Actual", group: "Performance" },
  { key: "variance", label: "Variance", group: "Performance" },
  { key: "fast-moving-items", label: "Fast Moving Items", group: "Performance" },
  { key: "production-yield", label: "Production Yield", group: "Performance" },
];

const today = () => new Date().toISOString().slice(0, 10);

function fmt(n?: number | null, dp = 2) {
  return Number(n ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

function errorText(e: any) {
  return (
    e?.response?.data?.message ||
    e?.response?.data?.title ||
    e?.message ||
    "Failed to load report."
  );
}

export default function FnbControlCenterPage() {
  const { companyId, branchId } = useAppScope();

  const [report, setReport] = useState<FnbReportKey>("kitchen-consumption");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [days, setDays] = useState(30);

  const [data, setData] = useState<FnbReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!companyId || !branchId) return;

    setLoading(true);
    setError("");

    try {
      const res = await getFnbReport({
        companyId,
        branchId,
        report,
        from,
        to,
        locationId: locationId || null,
        days: report === "dead-stock" ? days : null,
      });

      setData(res);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [companyId, branchId, report, from, to, locationId, days]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data?.rows ?? [];

    if (!q) return all;

    return all.filter(
      (x) =>
        x.itemName?.toLowerCase().includes(q) ||
        x.itemCode?.toLowerCase().includes(q) ||
        x.locationName?.toLowerCase().includes(q) ||
        x.categoryName?.toLowerCase().includes(q)
    );
  }, [data, search]);

  const selected = REPORTS.find((x) => x.key === report);

  if (!companyId || !branchId) {
    return (
      <div className="fnb-page">
        <div className="fnb-empty">Select company and branch to continue.</div>
      </div>
    );
  }

  return (
    <div className="fnb-page">
      <header className="fnb-header">
        <div>
          <p className="fnb-kicker">ERP Reports</p>
          <h1 className="fnb-title">F&B Control Center</h1>
          <p className="fnb-subtitle">
            Kitchen, bar, COGS, valuation, variance, FIFO aging, turnover, and production yield.
          </p>
        </div>

        <button className="fnb-btn fnb-btn--primary" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {error && <div className="fnb-alert">{error}</div>}

      <section className="fnb-shell">
        <aside className="fnb-sidebar">
          {["Consumption", "Stock Control", "Performance"].map((group) => (
            <div key={group} className="fnb-menu-group">
              <div className="fnb-menu-group__title">{group}</div>
              {REPORTS.filter((x) => x.group === group).map((item) => (
                <button
                  key={item.key}
                  className={`fnb-menu-item ${report === item.key ? "is-active" : ""}`}
                  onClick={() => setReport(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="fnb-main">
          <div className="fnb-panel">
            <div>
              <p className="fnb-section-kicker">{selected?.group}</p>
              <h2 className="fnb-section-title">{data?.reportName ?? selected?.label}</h2>
            </div>

            <div className="fnb-filters">
              <input className="fnb-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <input className="fnb-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              <input
                className="fnb-input"
                placeholder="Location ID optional"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              />
              {report === "dead-stock" && (
                <input
                  className="fnb-input"
                  type="number"
                  min={1}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value || 30))}
                />
              )}
            </div>
          </div>

          <div className="fnb-kpi-grid">
            <div className="fnb-kpi">
              <span>Total Qty</span>
              <strong>{fmt(data?.summary.totalQty)}</strong>
            </div>
            <div className="fnb-kpi">
              <span>Total Value</span>
              <strong>{fmt(data?.summary.totalValue)}</strong>
            </div>
            <div className="fnb-kpi">
              <span>Items</span>
              <strong>{fmt(data?.summary.itemCount, 0)}</strong>
            </div>
            <div className="fnb-kpi">
              <span>Rows Shown</span>
              <strong>{fmt(rows.length, 0)}</strong>
            </div>
          </div>

          <div className="fnb-table-card">
            <div className="fnb-table-toolbar">
              <div>
                <strong>Report Detail</strong>
                <p>Grouped by item, location, and movement value.</p>
              </div>
              <input
                className="fnb-input"
                placeholder="Search item, code, location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <ReportTable report={report} rows={rows} loading={loading} />
          </div>
        </main>
      </section>
    </div>
  );
}

function ReportTable({
  report,
  rows,
  loading,
}: {
  report: FnbReportKey;
  rows: FnbReportRow[];
  loading: boolean;
}) {
  const isVariance = report === "variance" || report === "theoretical-vs-actual";
  const isAging = report === "fifo-aging" || report === "dead-stock";
  const isStock = report === "inventory-valuation" || report === "negative-inventory";

  return (
    <div className="fnb-table-wrap">
      <table className="fnb-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Location</th>
            {isStock && <th className="num">Closing Qty</th>}
            {isVariance && <th className="num">Theoretical</th>}
            {isVariance && <th className="num">Actual</th>}
            {isVariance && <th className="num">Variance</th>}
            {isAging && <th>Bucket</th>}
            {isAging && <th className="num">Days</th>}
            {!isVariance && <th className="num">Qty</th>}
            <th className="num">Unit Cost</th>
            <th className="num">Value</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={10} className="fnb-empty">Loading report…</td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="fnb-empty">No data found.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={`${row.itemId}-${row.locationId ?? "all"}-${row.bucket ?? ""}`}>
                <td>
                  <strong>{row.itemName}</strong>
                  <span>{row.itemCode || "—"} · {row.uomName || "—"}</span>
                </td>
                <td>{row.locationName ?? "All"}</td>

                {isStock && <td className="num">{fmt(row.closingQty)}</td>}

                {isVariance && <td className="num">{fmt(row.theoreticalQty)}</td>}
                {isVariance && <td className="num">{fmt(row.actualQty)}</td>}
                {isVariance && (
                  <td className={`num ${row.varianceQty < 0 ? "is-danger" : ""}`}>
                    {fmt(row.varianceQty)}
                  </td>
                )}

                {isAging && <td>{row.bucket ?? "—"}</td>}
                {isAging && <td className="num">{fmt(row.daysSinceLastMovement, 0)}</td>}

                {!isVariance && <td className="num">{fmt(row.qty)}</td>}

                <td className="num">{fmt(row.unitCost, 4)}</td>
                <td className="num">{fmt(row.value)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}