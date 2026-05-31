import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboardOverview } from "../api/dashboard/dashboardApi";
import type { DashboardOverviewDto } from "../api/dashboard/dashboardTypes";
import { useAppScope } from "../app/useAppScope";

// ── Types ─────────────────────────────────────────────────────────────────────

type State =
  | { status: "loading" }
  | { status: "loaded"; data: DashboardOverviewDto }
  | { status: "error"; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (v: number) =>
  "$" +
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(v);

const fmtPct = (v: number) => v.toFixed(1) + "%";

const fmtNum = (v: number) =>
  new Intl.NumberFormat(undefined).format(v);

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  badge,
  badgeTone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  badge?: string;
  badgeTone?: "up" | "down" | "warn";
}) {
  const badgeClass =
    badgeTone === "up"   ? "kpi-badge badge-up"   :
    badgeTone === "down" ? "kpi-badge badge-down"  :
    badgeTone === "warn" ? "kpi-badge badge-warn"  : "";

  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-val">{value}</div>
      {sub   && <div className="kpi-sub">{sub}</div>}
      {badge && <div className={badgeClass}>{badge}</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();

  const [state,     setState]     = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let mounted = true;
    setState({ status: "loading" });
    getDashboardOverview()
      .then((data) => { if (mounted) setState({ status: "loaded", data }); })
      .catch((err) => {
        if (!mounted) return;
        setState({
          status: "error",
          message:
            err?.response?.data?.message ??
            err?.message ??
            "Failed to load dashboard.",
        });
      });
    return () => { mounted = false; };
  }, [reloadKey]);

  const updatedAt =
    state.status === "loaded"
      ? new Date(state.data.generatedAtUtc).toLocaleString()
      : null;

  // Quick actions — wired to actual routes
  const actions = [
    { icon: "ti-shopping-cart",   title: "New sale",         sub: "Back-office entry",  href: "/sales/new" },
    { icon: "ti-tools-kitchen-2", title: "Production batch", sub: "Execute a recipe",   href: "/production/batches/new" },
    { icon: "ti-truck",           title: "Receive stock",    sub: "Create a GRN",
      href: companyId ? `/companies/${companyId}/grns/drafts/new` : "/inventory-master" },
    { icon: "ti-arrow-bar-right", title: "Issue stock",      sub: "Create a SIV",
      href: companyId ? `/companies/${companyId}/siv/drafts/new` : "/inventory-master" },
    { icon: "ti-upload",          title: "Import sales",     sub: "Excel upload",       href: "/sales/import" },
    { icon: "ti-chart-dots",      title: "Menu engineering", sub: "Boston Matrix",      href: "/production/menu-engineering" },
  ];

  // ── Header ────────────────────────────────────────────────────────────────

  const header = (
    <div className="page-header">
      <div>
        <div className="page-kicker">Operations</div>
        <div className="page-title">Dashboard</div>
        <div className="page-sub">
          {updatedAt ? `Updated ${updatedAt}` : "Overview & quick actions"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          className="btn"
          onClick={reload}
          disabled={state.status === "loading"}
        >
          <i className="ti ti-refresh" aria-hidden="true" />
          {state.status === "loading" ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
  );

  // ── Loading ───────────────────────────────────────────────────────────────

  if (state.status === "loading") {
    return (
      <div className="page">
        {header}
        <div className="kpi-grid" style={{ marginBottom: 20 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton kpi" style={{ height: 88 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (state.status === "error") {
    return (
      <div className="page">
        {header}
        <div className="alert alert-danger">
          <strong>Couldn't load dashboard</strong>
          <p style={{ marginTop: 4, fontSize: 12 }}>{state.message}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn btn-sm" onClick={reload}>Retry</button>
            <button className="btn btn-sm" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loaded ────────────────────────────────────────────────────────────────

  const d = state.data;
  const grossProfit = d.todaySales - d.todayCogs;
  const marginPct   = d.todaySales > 0 ? (grossProfit / d.todaySales) * 100 : 0;
  const foodCostPct = d.todaySales > 0 ? (d.todayCogs  / d.todaySales) * 100 : 0;

  const engTotal = Object.values(d.menuEngineeringMap ?? {}).reduce(
    (s, v) => s + v, 0
  );

  return (
    <div className="page">
      {header}

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="kpi-grid">
        <KpiCard
          label="Today's revenue"
          value={fmtMoney(d.todaySales)}
          sub="Gross sales today"
        />
        <KpiCard
          label="Orders today"
          value={fmtNum(d.todayOrders)}
          sub={
            d.todayOrders > 0
              ? `avg ${fmtMoney(d.todaySales / d.todayOrders)} / order`
              : "No orders yet"
          }
        />
        <KpiCard
          label="Gross profit"
          value={fmtMoney(grossProfit)}
          sub={`${fmtPct(marginPct)} margin`}
          badge={marginPct >= 50 ? "On target" : "Below target"}
          badgeTone={marginPct >= 50 ? "up" : "warn"}
        />
        <KpiCard
          label="COGS"
          value={fmtMoney(d.todayCogs)}
          sub={`${fmtPct(foodCostPct)} food cost`}
          badge={foodCostPct > 40 ? "High" : undefined}
          badgeTone={foodCostPct > 40 ? "down" : undefined}
        />
        <KpiCard
          label="Low stock items"
          value={fmtNum(d.lowStockItems)}
          sub="Below reorder level"
          badge={d.lowStockItems > 0 ? "Action needed" : undefined}
          badgeTone={d.lowStockItems > 0 ? "warn" : undefined}
        />
        <KpiCard
          label="Open transfers"
          value={fmtNum(d.openTransfers)}
          sub="In progress"
        />
        <KpiCard
          label="Total users"
          value={fmtNum(d.totalUsers)}
          sub={`${d.totalRoles} roles configured`}
        />
        <KpiCard
          label="30-day revenue"
          value={fmtMoney(d.last30DaysRevenue)}
          sub={`7-day: ${fmtMoney(d.last7DaysRevenue)}`}
        />
      </div>

      {/* ── Trend strip ─────────────────────────────────────────────── */}
      <div className="metrics-strip">
        {[
          { label: "7-day revenue",  value: fmtMoney(d.last7DaysRevenue) },
          { label: "30-day revenue", value: fmtMoney(d.last30DaysRevenue) },
          { label: "YTD revenue",    value: fmtMoney(d.yearToDateRevenue) },
          { label: "Avg food cost",  value: fmtPct(foodCostPct) },
        ].map((m) => (
          <div key={m.label} className="metric-cell">
            <div className="metric-label">{m.label}</div>
            <div className="metric-value">{m.value}</div>
          </div>
        ))}
      </div>

      {/* ── Middle row: Best sellers + Menu engineering ──────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: d.bestSellers.length > 0 ? "1fr 1fr" : "1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Best sellers */}
        {d.bestSellers.length > 0 && (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Best sellers</div>
                <div className="card-subtitle">Last 30 days by units sold</div>
              </div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: "right" }}>Units</th>
                  <th style={{ textAlign: "right" }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {d.bestSellers.map((b, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 13 }}>{b.itemName}</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                      }}
                    >
                      {fmtNum(b.unitsSold)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {fmtMoney(b.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Menu engineering summary */}
        {engTotal > 0 && (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Menu engineering</div>
                <div className="card-subtitle">
                  Boston Matrix — {engTotal} items analysed
                </div>
              </div>
              <button
                className="btn btn-sm"
                onClick={() => nav("/production/menu-engineering")}
              >
                Full report
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 1,
                background: "var(--border-soft)",
              }}
            >
              {(
                [
                  { key: "STAR",      label: "Stars",      color: "#b8860b", bg: "#fef9ec" },
                  { key: "PUZZLE",    label: "Puzzles",    color: "#4f46e5", bg: "#f0f0ff" },
                  { key: "PLOWHORSE", label: "Plowhorses", color: "#0f766e", bg: "#f0faf9" },
                  { key: "DOG",       label: "Dogs",       color: "#b91c1c", bg: "#fff0f0" },
                ] as const
              ).map(({ key, label, color, bg }) => (
                <div
                  key={key}
                  style={{
                    padding: "16px 20px",
                    background: bg,
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color,
                      fontFamily: "var(--mono)",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      color,
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {d.menuEngineeringMap[key] ?? 0}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    items
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Quick actions ────────────────────────────────────────────── */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">Quick actions</div>
        </div>
        <div className="act-grid">
          {actions.map((a) => (
            <a
              key={a.href}
              className="act-tile"
              href={a.href}
              onClick={(e) => { e.preventDefault(); nav(a.href); }}
            >
              <div className="act-icon">
                <i className={`ti ${a.icon}`} aria-hidden="true" />
              </div>
              <div className="act-title">{a.title}</div>
              <div className="act-sub">{a.sub}</div>
              <div className="act-arr">→</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
