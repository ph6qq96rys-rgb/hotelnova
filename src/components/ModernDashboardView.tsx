import type {
  BestSellerDto,
  DashboardAlertDto,
  DashboardOverviewDto,
  InventorySummaryDto,
  MenuEngineeringSummaryDto,
} from "../api/dashboard/dashboardTypes";
import { formatAppDate } from "../shared/datetime/dateFormat";
import "./dashboard-modern-saas.css";

type QuickAction = {
  icon: string;
  title: string;
  sub: string;
  href: string;
};

type DashboardCapabilities = {
  sales?: boolean;
  inventory?: boolean;
  procurement?: boolean;
  identity?: boolean;
  menu?: boolean;
  operations?: boolean;
};

type Props = {
  dashboard: DashboardOverviewDto;
  updatedAt: string | null;
  actions: QuickAction[];
  capabilities?: DashboardCapabilities;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  refreshing?: boolean;
};

const fmtMoney = (value?: number | null) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
const fmtPct = (value?: number | null) => `${Number(value ?? 0).toFixed(1)}%`;
const fmtNum = (value?: number | null) => new Intl.NumberFormat(undefined).format(Number(value ?? 0));
const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function ModernDashboardView({
  dashboard,
  updatedAt,
  actions,
  capabilities,
  onNavigate,
  onRefresh,
  refreshing = false,
}: Props) {
  const can = {
    sales: Boolean(capabilities?.sales),
    inventory: Boolean(capabilities?.inventory),
    procurement: Boolean(capabilities?.procurement),
    identity: Boolean(capabilities?.identity),
    menu: Boolean(capabilities?.menu),
    operations: Boolean(capabilities?.operations),
  };

  const sales = dashboard.sales;
  const inventorySummary = dashboard.inventorySummary;
  const procurement = dashboard.procurement;
  const identity = dashboard.identity;
  const alerts = Array.isArray(dashboard.alerts) ? dashboard.alerts : [];
  const bestSellers = Array.isArray(dashboard.bestSellers) ? dashboard.bestSellers : [];
  const lowInventory = Array.isArray(dashboard.inventory) ? dashboard.inventory : [];
  const menu = dashboard.menuEngineering ?? { star: 0, puzzle: 0, plowhorse: 0, dog: 0 };

  const criticalCount = alerts.filter((x) => x.severity === "critical").length;
  const warningCount = alerts.filter((x) => x.severity === "warning").length;

  const kpis = [
    can.sales && {
      label: "Today's revenue",
      value: fmtMoney(sales.todaySales),
      meta: `${fmtPct(sales.todayMarginPct)} margin`,
      icon: "ti-cash",
      tone: sales.todayMarginPct >= 50 ? "success" : "warning",
    },
    can.sales && {
      label: "Orders today",
      value: fmtNum(sales.todayOrders),
      meta: `${fmtMoney(sales.averageOrderValue)} avg ticket`,
      icon: "ti-receipt",
      tone: "info",
    },
    can.inventory && {
      label: "Inventory risk",
      value: fmtNum(inventorySummary.lowStockItems),
      meta: `${fmtNum(inventorySummary.openTransfers)} transfers open`,
      icon: "ti-package-off",
      tone: inventorySummary.lowStockItems > 0 ? "danger" : "success",
    },
    can.procurement && {
      label: "Approval queue",
      value: fmtNum(procurement.pendingPurchaseOrders),
      meta: criticalCount > 0 ? `${criticalCount} critical alerts` : `${warningCount} warnings`,
      icon: "ti-file-check",
      tone: criticalCount > 0 ? "danger" : "warning",
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    meta: string;
    icon: string;
    tone: string;
  }>;

  const copilotActions = buildCopilotActions(dashboard, alerts, lowInventory);
  const primaryOperationAction = actions.find((action) => action.title === "Daily Operations");
  const hasMainSections = can.sales || can.operations || can.procurement || can.menu || can.inventory;
  const hasSideSections =
    actions.length > 0 || can.operations || can.inventory || can.procurement || can.identity || can.sales;

  return (
    <div className="modern-saas-dashboard">
      <header className="saas-page-header">
        <div>
          <div className="saas-eyebrow">Hotel Nova Command Center</div>
          <h1>Operations dashboard</h1>
          <p>{updatedAt ? `Live view - Updated ${updatedAt}` : "Live operational view"}</p>
        </div>
        <div className="saas-header-actions">
          <button className="saas-btn" onClick={onRefresh} disabled={refreshing}>
            <i className="ti ti-refresh" /> {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          {primaryOperationAction ? (
            <button className="saas-btn saas-btn-primary" onClick={() => onNavigate(primaryOperationAction.href)}>
              <i className="ti ti-plus" /> New operation
            </button>
          ) : null}
        </div>
      </header>

      {kpis.length > 0 ? (
        <section className="saas-kpi-grid">
          {kpis.map((kpi) => (
            <article className="saas-kpi" key={kpi.label}>
              <span className={`saas-kpi-icon is-${kpi.tone}`}><i className={`ti ${kpi.icon}`} /></span>
              <div><small>{kpi.label}</small><strong>{kpi.value}</strong><p>{kpi.meta}</p></div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="saas-dashboard-layout">
        <main className="saas-main-column">
          {!hasMainSections ? (
            <article className="saas-card">
              <CardHeader eyebrow="Workspace" title="Dashboard" subtitle="No dashboard widgets are available for your current role." />
              <Empty text="Only modules assigned to your role are shown here." />
            </article>
          ) : null}

          {can.sales ? <PerformanceCard dashboard={dashboard} /> : null}

          {can.operations || can.procurement ? (
            <div className="saas-split-grid">
              {can.operations ? <AlertsCard alerts={alerts} onNavigate={onNavigate} /> : null}
              {can.procurement ? (
                <ApprovalQueue
                  pending={procurement.pendingPurchaseOrders}
                  critical={criticalCount}
                  warnings={warningCount}
                  total={alerts.length}
                />
              ) : null}
            </div>
          ) : null}

          {can.sales || can.menu ? (
            <div className="saas-split-grid">
              {can.sales ? <BestSellers items={bestSellers} /> : null}
              {can.menu ? <MenuEngineering summary={menu} /> : null}
            </div>
          ) : null}

          {can.inventory ? <InventoryWatchlist items={lowInventory} /> : null}
        </main>

        {hasSideSections ? (
          <aside className="saas-side-column">
            {can.operations || can.inventory || can.procurement ? (
              <CopilotCard
                actions={copilotActions}
                critical={criticalCount}
                warnings={warningCount}
                onNavigate={onNavigate}
              />
            ) : null}
            {actions.length > 0 ? <QuickActions actions={actions} onNavigate={onNavigate} /> : null}
            {can.sales || can.inventory || can.identity ? (
              <BusinessHealth dashboard={dashboard} identity={identity} capabilities={can} />
            ) : null}
          </aside>
        ) : null}
      </section>
    </div>
  );
}

function fmtTrendLabel(item: any, fallback: string): string {
  const raw = item.label ?? item.day ?? item.dateLabel ?? item.date;
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? formatAppDate(raw) : raw;
}
function PerformanceCard({ dashboard }: { dashboard: DashboardOverviewDto }) {
  const sales = dashboard.sales;
  const raw = Array.isArray(dashboard.revenueTrend) ? dashboard.revenueTrend.slice(-7) : [];
  const points = raw.map((item: any, i) => ({
    label: fmtTrendLabel(item, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]),
    value: num(item.value ?? item.revenue ?? item.amount ?? item.total ?? item),
  }));
  const max = Math.max(...points.map((x) => x.value), 1);

  return (
    <article className="saas-card">
      <CardHeader eyebrow="Performance" title="Revenue & food cost" subtitle="Current operating performance and margin health" badge="Live" />
      <div className="saas-metric-row">
        <Metric label="Today revenue" value={fmtMoney(sales.todaySales)} />
        <Metric label="Gross profit" value={fmtMoney(sales.todayGrossProfit)} />
        <Metric label="Food cost" value={fmtPct(sales.todayFoodCostPct)} />
        <Metric label="Avg order" value={fmtMoney(sales.averageOrderValue)} />
      </div>
      {points.length === 0 ? <Empty text="No revenue trend is available yet." /> : <div className="saas-chart">
        {points.map((point) => (
          <div className="saas-chart-column" key={`${point.label}-${point.value}`}>
            <div className="saas-chart-track"><div style={{ height: `${Math.max(point.value / max * 100, 6)}%` }} /></div>
            <span>{point.label}</span>
          </div>
        ))}
      </div>}
      <div className="saas-period-row">
        <Metric label="7 days" value={fmtMoney(sales.last7DaysRevenue)} />
        <Metric label="30 days" value={fmtMoney(sales.last30DaysRevenue)} />
        <Metric label="YTD" value={fmtMoney(sales.yearToDateRevenue)} />
        <Metric label="Margin" value={fmtPct(sales.todayMarginPct)} />
      </div>
    </article>
  );
}

function AlertsCard({ alerts, onNavigate }: { alerts: DashboardAlertDto[]; onNavigate: (path: string) => void }) {
  return (
    <article className="saas-card">
      <CardHeader eyebrow="Operations" title="Active alerts" subtitle="Issues requiring attention" badge={String(alerts.length)} tone="danger" />
      <div className="saas-list">
        {alerts.length === 0 ? <Empty text="No active alerts." /> : alerts.slice(0, 5).map((alert) => (
          <button key={alert.key} onClick={() => alert.route && onNavigate(alert.route)}>
            <span className={`saas-dot is-${alert.severity === "critical" ? "danger" : alert.severity === "warning" ? "warning" : "info"}`} />
            <span><strong>{alert.count != null ? `${fmtNum(alert.count)} ` : ""}{alert.title}</strong><small>{alert.message ?? "Open to review"}</small></span>
            <i className="ti ti-chevron-right" />
          </button>
        ))}
      </div>
    </article>
  );
}

function ApprovalQueue({ pending, critical, warnings, total }: { pending: number; critical: number; warnings: number; total: number }) {
  return (
    <article className="saas-card">
      <CardHeader eyebrow="Workflow" title="Approval queue" subtitle="Documents and controls waiting for action" />
      <div className="saas-queue-grid">
        <Queue label="Approval queue" value={pending} tone="warning" />
        <Queue label="Critical alerts" value={critical} tone="danger" />
        <Queue label="Warnings" value={warnings} tone="warning" />
        <Queue label="Total alerts" value={total} tone="info" />
      </div>
      <div className="saas-note">Prioritize critical alerts and the oldest approvals first.</div>
    </article>
  );
}

function BestSellers({ items }: { items: BestSellerDto[] }) {
  return (
    <article className="saas-card">
      <CardHeader eyebrow="Sales" title="Best sellers" subtitle="Top items by profitability" />
      {items.length === 0 ? <Empty text="No sales ranking available yet." /> : (
        <table className="saas-table"><thead><tr><th>Item</th><th>Units</th><th>Revenue</th><th>Margin</th></tr></thead>
          <tbody>{items.slice(0, 6).map((item, i) => <tr key={item.itemId ?? `${item.itemName}-${i}`}>
            <td><span className="saas-rank">{i + 1}</span><strong>{item.itemName}</strong></td>
            <td>{fmtNum(item.unitsSold)}</td><td>{fmtMoney(item.revenue)}</td><td><span className="saas-chip is-success">{fmtPct(item.marginPct)}</span></td>
          </tr>)}</tbody></table>
      )}
    </article>
  );
}

function MenuEngineering({ summary }: { summary: MenuEngineeringSummaryDto }) {
  const cells = [
    ["Stars", summary.star, "success"], ["Puzzles", summary.puzzle, "info"],
    ["Plowhorses", summary.plowhorse, "warning"], ["Dogs", summary.dog, "danger"],
  ] as const;
  return (
    <article className="saas-card">
      <CardHeader eyebrow="Menu" title="Menu engineering" subtitle="Boston Matrix classification" />
      <div className="saas-menu-grid">{cells.map(([label, value, tone]) => <div className={`is-${tone}`} key={label}><span>{label}</span><strong>{fmtNum(value)}</strong><small>items</small></div>)}</div>
    </article>
  );
}

function InventoryWatchlist({ items }: { items: InventorySummaryDto[] }) {
  return (
    <article className="saas-card">
      <CardHeader eyebrow="Inventory" title="Inventory watchlist" subtitle="Items requiring stock attention" badge={String(items.length)} tone="warning" />
      {items.length === 0 ? <Empty text="Inventory watchlist is clear." /> : (
        <table className="saas-table"><thead><tr><th>Item</th><th>Location</th><th>On hand</th><th>Available</th><th>Reorder</th><th>Status</th></tr></thead>
          <tbody>{items.slice(0, 8).map((item, i) => {
            const available = num(item.availableQuantity); const reorder = num(item.reorderLevel);
            const tone = available <= 0 ? "danger" : available <= reorder ? "warning" : "success";
            return <tr key={item.itemId ?? `${item.itemName}-${i}`}><td><strong>{item.itemName}</strong><small>{item.uomCode ?? ""}</small></td><td>{item.locationName ?? "-"}</td><td>{fmtNum(item.quantity)}</td><td>{fmtNum(item.availableQuantity)}</td><td>{fmtNum(item.reorderLevel)}</td><td><span className={`saas-chip is-${tone}`}>{tone === "danger" ? "Critical" : tone === "warning" ? "Low" : "Healthy"}</span></td></tr>;
          })}</tbody></table>
      )}
    </article>
  );
}

function CopilotCard({
  actions,
  critical,
  warnings,
  onNavigate,
}: {
  actions: string[];
  critical: number;
  warnings: number;
  onNavigate: (path: string) => void;
}) {
  return (
    <article className="saas-card saas-copilot-card">
      <CardHeader eyebrow="AI workspace" title="Restaurant Copilot" subtitle="Prioritized actions from current operations" badge="AI" />
      <div className="saas-copilot-summary"><div><strong>{critical + warnings}</strong><span>items need attention</span></div><div><span className="saas-chip is-danger">{critical} critical</span><span className="saas-chip is-warning">{warnings} warning</span></div></div>
      <ol className="saas-copilot-actions">{actions.map((action, i) => <li key={action}><span>{i + 1}</span><p>{action}</p></li>)}</ol>
      <button
        className="saas-btn saas-btn-primary saas-full"
        type="button"
        onClick={() => onNavigate("sales/operations")}
      >
        Open Copilot workspace
      </button>
    </article>
  );
}

function QuickActions({ actions, onNavigate }: { actions: QuickAction[]; onNavigate: (path: string) => void }) {
  return (
    <article className="saas-card">
      <CardHeader eyebrow="Shortcuts" title="Quick actions" subtitle="Start common workflows" />
      <div className="saas-quick-actions">{actions.map((a) => <button key={a.href} onClick={() => onNavigate(a.href)}><span className="saas-quick-icon"><i className={`ti ${a.icon}`} /></span><span><strong>{a.title}</strong><small>{a.sub}</small></span><i className="ti ti-chevron-right" /></button>)}</div>
    </article>
  );
}

function BusinessHealth({
  dashboard,
  identity,
  capabilities,
}: {
  dashboard: DashboardOverviewDto;
  identity: DashboardOverviewDto["identity"];
  capabilities: DashboardCapabilities;
}) {
  const rows = [
    capabilities.sales ? ["Food cost", fmtPct(dashboard.sales.todayFoodCostPct)] : null,
    capabilities.inventory
      ? ["Inventory value", dashboard.inventorySummary.inventoryValue == null ? "-" : fmtMoney(dashboard.inventorySummary.inventoryValue)]
      : null,
    dashboard.hr ? ["Present today", fmtNum(dashboard.hr.employeesPresentToday)] : null,
    dashboard.hr ? ["Pending leave", fmtNum(dashboard.hr.pendingLeaveRequests ?? 0)] : null,
    capabilities.identity ? ["Users", fmtNum(identity.totalUsers)] : null,
    capabilities.identity ? ["Roles", fmtNum(identity.totalRoles)] : null,
  ].filter(Boolean) as string[][];

  return <article className="saas-card"><CardHeader eyebrow="Snapshot" title="Business health" subtitle="Compact operating summary" /><div className="saas-health">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></article>;
}

function CardHeader({ eyebrow, title, subtitle, badge, tone = "info" }: { eyebrow: string; title: string; subtitle: string; badge?: string; tone?: string }) {
  return <div className="saas-card-header"><div><span className="saas-card-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div>{badge ? <span className={`saas-chip is-${tone}`}>{badge}</span> : null}</div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="saas-metric"><span>{label}</span><strong>{value}</strong></div>; }
function Queue({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className={`saas-queue is-${tone}`}><span>{label}</span><strong>{fmtNum(value)}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="saas-empty">{text}</div>; }

function buildCopilotActions(dashboard: DashboardOverviewDto, alerts: DashboardAlertDto[], inventory: InventorySummaryDto[]) {
  const actions: string[] = [];
  const critical = alerts.find((a) => a.severity === "critical");
  if (critical) actions.push(`Review ${critical.title.toLowerCase()} immediately.`);
  if (dashboard.inventorySummary.lowStockItems > 0) actions.push(`Review ${dashboard.inventorySummary.lowStockItems} low-stock items.`);
  if (dashboard.procurement.pendingPurchaseOrders > 0) actions.push(`${dashboard.procurement.pendingPurchaseOrders} purchase orders require action.`);
  if (inventory[0]) actions.push(`Open the watchlist and review ${inventory[0].itemName}.`);
  if (dashboard.sales.todayFoodCostPct > 40) actions.push(`Food cost is ${fmtPct(dashboard.sales.todayFoodCostPct)}; review high-cost menu items.`);
  return (actions.length ? actions : ["No critical action is required. Operations are within normal range."]).slice(0, 4);
}
