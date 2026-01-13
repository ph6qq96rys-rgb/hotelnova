import { useEffect,  useState } from "react";
import { getDashboardOverview } from "../api/dashboard/dashboardApi";
import type { DashboardOverviewDto } from "../api/dashboard/dashboardTypes";

type DashboardState =
  | { status: "loading" }
  | { status: "loaded"; data: DashboardOverviewDto }
  | { status: "error"; message: string };

function formatMoney(value: number) {
  // Simple formatting; you can replace with Intl + currency config later
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="hna-card">
      <div className="hna-card-label">{label}</div>
      <div className="hna-card-value">{value}</div>
      {hint ? <div className="hna-card-hint">{hint}</div> : null}
    </div>
  );
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

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
        setState({ status: "error", message });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

 switch (state.status) {
  case "loading":
    return (
        <div className="hna-page">
          <div className="hna-page-header">
            <h1>Dashboard</h1>
            <p>Overview & quick actions</p>
          </div>

          <div className="hna-grid">
            <div className="hna-skeleton hna-card" />
            <div className="hna-skeleton hna-card" />
            <div className="hna-skeleton hna-card" />
            <div className="hna-skeleton hna-card" />
          </div>
        </div>
      );
  case "error":
    return (
        <div className="hna-page">
          <div className="hna-page-header">
            <h1>Dashboard</h1>
            <p>Overview & quick actions</p>
          </div>

          <div className="hna-alert hna-alert-error">
            <div className="hna-alert-title">Couldn’t load dashboard</div>
            <div className="hna-alert-body">{state.message}</div>
            <button
              className="hna-btn"
              onClick={() => setState({ status: "loading" })}
              type="button"
            >
              Retry
            </button>
          </div>
        </div>
      );

  case "loaded":
     { const d = state.data;
    const generatedAt = new Date(d.generatedAtUtc);

    return (
      <div className="hna-page">
        <div className="hna-page-header">
          <div>
            <h1>Dashboard</h1>
            <p>Overview & quick actions</p>
          </div>

          <div className="hna-meta">
            <span className="hna-meta-label">Last updated</span>
            <span className="hna-meta-value">{generatedAt.toLocaleString()}</span>
          </div>
        </div>

        <div className="hna-grid">
          <StatCard label="Users" value={d.totalUsers} hint="Total registered accounts" />
          <StatCard label="Roles" value={d.totalRoles} hint="RBAC roles configured" />
          <StatCard
            label="Today Orders"
            value={d.todayOrders}
            hint="Orders created today"
          />
          <StatCard
            label="Today Sales"
            value={formatMoney(d.todaySales)}
            hint="Gross sales today"
          />
        </div>

        <div className="hna-section">
          <div className="hna-section-title">Operations</div>

          <div className="hna-grid hna-grid-3">
            <StatCard
              label="Low Stock Items"
              value={d.lowStockItems}
              hint="Below reorder level"
            />
            <StatCard
              label="Pending POs"
              value={d.pendingPurchaseOrders}
              hint="Awaiting approval/receiving"
            />
            <StatCard label="Open Transfers" value={d.openTransfers} hint="In progress" />
          </div>
        </div>

        <div className="hna-section">
          <div className="hna-section-title">Quick actions</div>

          <div className="hna-actions">
            <a className="hna-btn hna-btn-primary" href="/users">
              Manage Users
            </a>
            <a className="hna-btn" href="/roles">
              Roles & Permissions
            </a>
            <a className="hna-btn" href="/settings">
              Settings
            </a>
          </div>
        </div>
      </div>
    );
  }
}
}
