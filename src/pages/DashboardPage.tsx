import { useEffect,  useState } from "react";
import { getDashboardOverview } from "../api/dashboard/dashboardApi";
import type { DashboardOverviewDto } from "../api/dashboard/dashboardTypes";
import "../styles/dashboard.css";

type DashboardState =
  | { status: "loading" }
  | { status: "loaded"; data: DashboardOverviewDto }
  | { status: "error"; message: string };

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
    value
  );
}

function SoftDivider() {
  return (
    <div className="hna-divider" aria-hidden="true">
      <div className="hna-divider__line" />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "warn";
}) {
  return (
    <div className={`hna-card hna-card--stat ${tone !== "default" ? `is-${tone}` : ""}`}>
      <div className="hna-card-label">{label}</div>
      <div className="hna-card-value">{value}</div>
      {hint ? <div className="hna-card-hint">{hint}</div> : null}
    </div>
  );
}

function ActionTile({
  title,
  subtitle,
  href,
  primary,
}: {
  title: string;
  subtitle: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <a className={`hna-tile ${primary ? "hna-tile--primary" : ""}`} href={href}>
      <div className="hna-tile-title">{title}</div>
      <div className="hna-tile-sub">{subtitle}</div>
      <div className="hna-tile-arrow" aria-hidden="true">
        →
      </div>
    </a>
  );
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  // Key to trigger refetch (fixes "Retry" not actually refetching)
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setState({ status: "loading" });
        const data = await getDashboardOverview();
        if (!mounted) return;
        setState({ status: "loaded", data });
      } catch (err: any) {
        const message =
          err?.message ||
          err?.response?.data?.message ||
          "Failed to load dashboard overview.";
        if (!mounted) return;
        setState({ status: "error", message });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  const header = (
    <div className="hna-hero">
      <div className="hna-hero__bg" />
      <div className="hna-hero__content">
        <div>
          <div className="hna-kicker">Operations</div>
          <h1 className="hna-title">Dashboard</h1>
          <p className="hna-subtitle">Overview & quick actions</p>
        </div>

        <div className="hna-hero__right">
          {state.status === "loaded" ? (
            (() => {
              const d = state.data;
              const generatedAt = new Date(d.generatedAtUtc);
              return (
                <div className="hna-chip">
                  <span className="hna-chip-label">Last updated</span>
                  <span className="hna-chip-value">
                    {generatedAt.toLocaleString()}
                  </span>
                </div>
              );
            })()
          ) : (
            <div className="hna-chip hna-chip--muted">
              <span className="hna-chip-label">Last updated</span>
              <span className="hna-chip-value">—</span>
            </div>
          )}

          <button
            className="hna-btn"
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={state.status === "loading"}
            title="Refresh dashboard"
          >
            {state.status === "loading" ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );

  if (state.status === "loading") {
    return (
      <div className="hna-page">
        {header}

        <div className="hna-grid">
          <div className="hna-skeleton hna-card hna-skeleton--stat" />
          <div className="hna-skeleton hna-card hna-skeleton--stat" />
          <div className="hna-skeleton hna-card hna-skeleton--stat" />
          <div className="hna-skeleton hna-card hna-skeleton--stat" />
        </div>

        <div className="hna-section">
          <div className="hna-section-title">Operations</div>
          <div className="hna-grid hna-grid-3">
            <div className="hna-skeleton hna-card hna-skeleton--stat" />
            <div className="hna-skeleton hna-card hna-skeleton--stat" />
            <div className="hna-skeleton hna-card hna-skeleton--stat" />
          </div>
        </div>

        <div className="hna-section">
          <div className="hna-section-title">Quick actions</div>
          <div className="hna-grid hna-grid-3">
            <div className="hna-skeleton hna-card hna-skeleton--tile" />
            <div className="hna-skeleton hna-card hna-skeleton--tile" />
            <div className="hna-skeleton hna-card hna-skeleton--tile" />
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="hna-page">
        {header}

        <div className="hna-alert hna-alert-error">
          <div className="hna-alert-title">Couldn’t load dashboard</div>
          <div className="hna-alert-body">{state.message}</div>

          <div className="hna-row">
            <button
              className="hna-btn hna-btn-primary"
              onClick={() => setReloadKey((k) => k + 1)}
              type="button"
            >
              Retry
            </button>
            <button
              className="hna-btn"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loaded
  const d = state.data;
  return (
    <div className="hna-page">
      {header}

      <div className="hna-grid">
        <StatCard label="Users" value={d.totalUsers} hint="Total registered accounts" />
        <StatCard label="Roles" value={d.totalRoles} hint="RBAC roles configured" />
        <StatCard label="Today Orders" value={d.todayOrders} hint="Orders created today" />
        <StatCard
          label="Today Sales"
          value={formatMoney(d.todaySales)}
          hint="Gross sales today"
          tone="good"
        />
      </div>

      <SoftDivider />

      <div className="hna-section">
        <div className="hna-section-title">Operations</div>

        <div className="hna-grid hna-grid-3">
          <StatCard
            label="Low Stock Items"
            value={d.lowStockItems}
            hint="Below reorder level"
            tone={d.lowStockItems > 0 ? "warn" : "default"}
          />
          <StatCard
            label="Pending POs"
            value={d.pendingPurchaseOrders}
            hint="Awaiting approval/receiving"
          />
          <StatCard label="Open Transfers" value={d.openTransfers} hint="In progress" />
        </div>
      </div>

      <SoftDivider />

      <div className="hna-section">
        <div className="hna-section-title">Quick actions</div>

        <div className="hna-grid hna-grid-3">
          <ActionTile
            title="Manage Users"
            subtitle="Create, edit, reset passwords"
            href="/users"
            primary
          />
          <ActionTile
            title="Roles & Permissions"
            subtitle="RBAC, branch scope, direct access"
            href="/roles"
          />
          <ActionTile
            title="Settings"
            subtitle="Company configuration & preferences"
            href="/settings"
          />
        </div>
      </div>
    </div>
  );
}
