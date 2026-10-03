import type {
  BestSellerDto,
  DashboardAlertDto,
  DashboardOverviewDto,
  InventorySummaryDto,
  MenuEngineeringSummaryDto,
} from "../api/dashboard/dashboardTypes";
import { formatAppDate } from "../shared/datetime/dateFormat";
import { formatCurrency } from "../shared/currency/currencyFormat";
import { useI18n } from "../i18n";
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

const fmtMoney = (value?: number | null, locale?: string) =>
  formatCurrency(value, undefined, locale);
const fmtPct = (value?: number | null) => `${Number(value ?? 0).toFixed(1)}%`;
const fmtNum = (value?: number | null, locale?: string) => new Intl.NumberFormat(locale).format(Number(value ?? 0));

const dashboardAmharicPhrases: Record<string, string> = {
  "Hotel Nova Command Center": "የሆቴል ኖቫ መቆጣጠሪያ ማዕከል",
  "Operations dashboard": "የኦፕሬሽን ዳሽቦርድ",
  "Live operational view": "የቀጥታ ኦፕሬሽን እይታ",
  "Live view": "ቀጥታ እይታ",
  "Updated": "ተዘምኗል",
  "Refresh": "አድስ",
  "Refreshing...": "በመታደስ ላይ...",
  "New operation": "አዲስ ኦፕሬሽን",
  "Today's revenue": "የዛሬ ገቢ",
  "Orders today": "የዛሬ ትዕዛዞች",
  "Inventory risk": "የኢንቬንቶሪ አደጋ",
  "Approval queue": "የማጽደቅ ወረፋ",
  "margin": "ማርጅን",
  "avg ticket": "አማካይ ትኬት",
  "transfers open": "ክፍት የዝውውር ጥያቄዎች",
  "critical alerts": "ወሳኝ ማሳወቂያዎች",
  "warnings": "ማስጠንቀቂያዎች",
  "warning": "ማስጠንቀቂያ",
  "Workspace": "የስራ ቦታ",
  "Dashboard": "ዳሽቦርድ",
  "No dashboard widgets are available for your current role.": "ለአሁኑ ሚናዎ የዳሽቦርድ ካርዶች አልተመደቡም።",
  "Only modules assigned to your role are shown here.": "እዚህ የሚታዩት ለሚናዎ የተመደቡ ሞጁሎች ብቻ ናቸው።",
  "Performance": "አፈጻጸም",
  "Revenue & food cost": "ገቢ እና የምግብ ወጪ",
  "Current operating performance and margin health": "የአሁኑ የኦፕሬሽን አፈጻጸም እና የማርጅን ጤና",
  "Live": "ቀጥታ",
  "Today revenue": "የዛሬ ገቢ",
  "Gross profit": "ጠቅላላ ትርፍ",
  "Food cost": "የምግብ ወጪ",
  "Avg order": "አማካይ ትዕዛዝ",
  "No revenue trend is available yet.": "የገቢ አዝማሚያ ገና አልተገኘም።",
  "7 days": "7 ቀናት",
  "30 days": "30 ቀናት",
  "YTD": "ከዓመት መጀመሪያ",
  "Margin": "ማርጅን",
  "Operations": "ኦፕሬሽን",
  "Active alerts": "ንቁ ማሳወቂያዎች",
  "Issues requiring attention": "ትኩረት የሚፈልጉ ጉዳዮች",
  "No active alerts.": "ንቁ ማሳወቂያዎች የሉም።",
  "Open to review": "ለመገምገም ክፈት",
  "Workflow": "የስራ ፍሰት",
  "Documents and controls waiting for action": "እርምጃ የሚጠብቁ ሰነዶች እና ቁጥጥሮች",
  "Critical alerts": "ወሳኝ ማሳወቂያዎች",
  "Warnings": "ማስጠንቀቂያዎች",
  "Total alerts": "ጠቅላላ ማሳወቂያዎች",
  "Prioritize critical alerts and the oldest approvals first.": "በመጀመሪያ ወሳኝ ማሳወቂያዎችን እና አሮጌ ማጽደቂያዎችን ይቀድሙ።",
  "Sales": "ሽያጭ",
  "Best sellers": "በጣም የሚሸጡ",
  "Top items by profitability": "በትርፋማነት ከፍተኛ እቃዎች",
  "No sales ranking available yet.": "የሽያጭ ደረጃ ገና አልተገኘም።",
  "Item": "እቃ",
  "Units": "ክፍሎች",
  "Revenue": "ገቢ",
  "Menu": "ምናሌ",
  "Menu engineering": "ምናሌ ኢንጂነሪንግ",
  "Boston Matrix classification": "የBoston Matrix ምደባ",
  "Stars": "ኮከቦች",
  "Puzzles": "ፓዝሎች",
  "Plowhorses": "ፕላው ሆርሶች",
  "Dogs": "ውሾች",
  "items": "እቃዎች",
  "Inventory": "ኢንቬንቶሪ",
  "Inventory watchlist": "የኢንቬንቶሪ ክትትል ዝርዝር",
  "Items requiring stock attention": "የስቶክ ትኩረት የሚፈልጉ እቃዎች",
  "Inventory watchlist is clear.": "የኢንቬንቶሪ ክትትል ዝርዝር ንጹህ ነው።",
  "Location": "ቦታ",
  "On hand": "በእጅ ያለ",
  "Available": "ያለ",
  "Reorder": "እንደገና ማዘዝ",
  "Status": "ሁኔታ",
  "Critical": "ወሳኝ",
  "Low": "ዝቅተኛ",
  "Healthy": "ጤናማ",
  "AI workspace": "AI የስራ ቦታ",
  "Restaurant Copilot": "የሬስቶራንት ኮፓይለት",
  "Prioritized actions from current operations": "ከአሁኑ ኦፕሬሽን የተቀደሙ እርምጃዎች",
  "items need attention": "እቃዎች ትኩረት ይፈልጋሉ",
  "Open Copilot workspace": "የኮፓይለት የስራ ቦታ ክፈት",
  "Shortcuts": "አቋራጮች",
  "Quick actions": "ፈጣን እርምጃዎች",
  "Start common workflows": "የተለመዱ የስራ ፍሰቶችን ጀምር",
  "Daily Operations": "ዕለታዊ ኦፕሬሽኖች",
  "Plan shift and readiness": "ሺፍትን እና ዝግጁነትን ያቅዱ",
  "Inventory Items": "የኢንቬንቶሪ እቃዎች",
  "Manage inventory master": "የኢንቬንቶሪ ማስተር አስተዳድር",
  "Snapshot": "ማጠቃለያ",
  "Business health": "የንግድ ጤና",
  "Compact operating summary": "አጭር የኦፕሬሽን ማጠቃለያ",
  "Inventory value": "የኢንቬንቶሪ ዋጋ",
  "Present today": "ዛሬ የተገኙ",
  "Pending leave": "በመጠባበቅ ላይ ያለ ፈቃድ",
  "Users": "ተጠቃሚዎች",
  "Roles": "ሚናዎች",
  "No critical action is required. Operations are within normal range.": "ወሳኝ እርምጃ አያስፈልግም። ኦፕሬሽኖች በመደበኛ ክልል ውስጥ ናቸው።"
};

function dashboardText(language: string, text: string): string {
  return language === "am" ? dashboardAmharicPhrases[text] ?? text : text;
}
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
  const { language, locale } = useI18n();
  const tx = (text: string) => dashboardText(language, text);
  const money = (value?: number | null) => fmtMoney(value, locale);
  const number = (value?: number | null) => fmtNum(value, locale);

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
      label: tx("Today's revenue"),
      value: money(sales.todaySales),
      meta: `${fmtPct(sales.todayMarginPct)} ${tx("margin")}`,
      icon: "ti-cash",
      tone: sales.todayMarginPct >= 50 ? "success" : "warning",
    },
    can.sales && {
      label: tx("Orders today"),
      value: number(sales.todayOrders),
      meta: `${money(sales.averageOrderValue)} ${tx("avg ticket")}`,
      icon: "ti-receipt",
      tone: "info",
    },
    can.inventory && {
      label: tx("Inventory risk"),
      value: number(inventorySummary.lowStockItems),
      meta: `${number(inventorySummary.openTransfers)} ${tx("transfers open")}`,
      icon: "ti-package-off",
      tone: inventorySummary.lowStockItems > 0 ? "danger" : "success",
    },
    can.procurement && {
      label: tx("Approval queue"),
      value: number(procurement.pendingPurchaseOrders),
      meta: criticalCount > 0 ? `${number(criticalCount)} ${tx("critical alerts")}` : `${number(warningCount)} ${tx("warnings")}`,
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

  const copilotActions = buildCopilotActions(dashboard, alerts, lowInventory, language, locale);
  const primaryOperationAction = actions.find((action) => action.title === "Daily Operations");
  const hasMainSections = can.sales || can.operations || can.procurement || can.menu || can.inventory;
  const hasSideSections =
    actions.length > 0 || can.operations || can.inventory || can.procurement || can.identity || can.sales;

  return (
    <div className="modern-saas-dashboard">
      <header className="saas-page-header">
        <div>
          <div className="saas-eyebrow">{tx("Hotel Nova Command Center")}</div>
          <h1>{tx("Operations dashboard")}</h1>
          <p>{updatedAt ? `${tx("Live view")} - ${tx("Updated")} ${updatedAt}` : tx("Live operational view")}</p>
        </div>
        <div className="saas-header-actions">
          <button className="saas-btn" onClick={onRefresh} disabled={refreshing}>
            <i className="ti ti-refresh" /> {refreshing ? tx("Refreshing...") : tx("Refresh")}
          </button>
          {primaryOperationAction ? (
            <button className="saas-btn saas-btn-primary" onClick={() => onNavigate(primaryOperationAction.href)}>
              <i className="ti ti-plus" /> {tx("New operation")}
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
              <CardHeader eyebrow={tx("Workspace")} title={tx("Dashboard")} subtitle={tx("No dashboard widgets are available for your current role.")} />
              <Empty text={tx("Only modules assigned to your role are shown here.")} />
            </article>
          ) : null}

          {can.sales ? <PerformanceCard dashboard={dashboard} language={language} locale={locale} /> : null}

          {can.operations || can.procurement ? (
            <div className="saas-split-grid">
              {can.operations ? <AlertsCard alerts={alerts} onNavigate={onNavigate} language={language} locale={locale} /> : null}
              {can.procurement ? (
                <ApprovalQueue
                  pending={procurement.pendingPurchaseOrders}
                  critical={criticalCount}
                  warnings={warningCount}
                  total={alerts.length}
                  language={language}
                  locale={locale}
                />
              ) : null}
            </div>
          ) : null}

          {can.sales || can.menu ? (
            <div className="saas-split-grid">
              {can.sales ? <BestSellers items={bestSellers} language={language} locale={locale} /> : null}
              {can.menu ? <MenuEngineering summary={menu} language={language} locale={locale} /> : null}
            </div>
          ) : null}

          {can.inventory ? <InventoryWatchlist items={lowInventory} language={language} locale={locale} /> : null}
        </main>

        {hasSideSections ? (
          <aside className="saas-side-column">
            {can.operations || can.inventory || can.procurement ? (
              <CopilotCard
                actions={copilotActions}
                critical={criticalCount}
                warnings={warningCount}
                onNavigate={onNavigate}
                language={language}
                locale={locale}
              />
            ) : null}
            {actions.length > 0 ? <QuickActions actions={actions} onNavigate={onNavigate} language={language} /> : null}
            {can.sales || can.inventory || can.identity ? (
              <BusinessHealth dashboard={dashboard} identity={identity} capabilities={can} language={language} locale={locale} />
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
function PerformanceCard({ dashboard, language, locale }: { dashboard: DashboardOverviewDto; language: string; locale: string }) {
  const tx = (text: string) => dashboardText(language, text);
  const sales = dashboard.sales;
  const raw = Array.isArray(dashboard.revenueTrend) ? dashboard.revenueTrend.slice(-7) : [];
  const points = raw.map((item: any, i) => ({
    label: fmtTrendLabel(item, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]),
    value: num(item.value ?? item.revenue ?? item.amount ?? item.total ?? item),
  }));
  const max = Math.max(...points.map((x) => x.value), 1);

  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Performance")} title={tx("Revenue & food cost")} subtitle={tx("Current operating performance and margin health")} badge={tx("Live")} />
      <div className="saas-metric-row">
        <Metric label={tx("Today revenue")} value={fmtMoney(sales.todaySales, locale)} />
        <Metric label={tx("Gross profit")} value={fmtMoney(sales.todayGrossProfit, locale)} />
        <Metric label={tx("Food cost")} value={fmtPct(sales.todayFoodCostPct)} />
        <Metric label={tx("Avg order")} value={fmtMoney(sales.averageOrderValue, locale)} />
      </div>
      {points.length === 0 ? <Empty text={tx("No revenue trend is available yet.")} /> : <div className="saas-chart">
        {points.map((point) => (
          <div className="saas-chart-column" key={`${point.label}-${point.value}`}>
            <div className="saas-chart-track"><div style={{ height: `${Math.max(point.value / max * 100, 6)}%` }} /></div>
            <span>{point.label}</span>
          </div>
        ))}
      </div>}
      <div className="saas-period-row">
        <Metric label={tx("7 days")} value={fmtMoney(sales.last7DaysRevenue, locale)} />
        <Metric label={tx("30 days")} value={fmtMoney(sales.last30DaysRevenue, locale)} />
        <Metric label={tx("YTD")} value={fmtMoney(sales.yearToDateRevenue, locale)} />
        <Metric label={tx("Margin")} value={fmtPct(sales.todayMarginPct)} />
      </div>
    </article>
  );
}

function AlertsCard({ alerts, onNavigate, language, locale }: { alerts: DashboardAlertDto[]; onNavigate: (path: string) => void; language: string; locale: string }) {
  const tx = (text: string) => dashboardText(language, text);
  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Operations")} title={tx("Active alerts")} subtitle={tx("Issues requiring attention")} badge={fmtNum(alerts.length, locale)} tone="danger" />
      <div className="saas-list">
        {alerts.length === 0 ? <Empty text={tx("No active alerts.")} /> : alerts.slice(0, 5).map((alert) => (
          <button key={alert.key} onClick={() => alert.route && onNavigate(alert.route)}>
            <span className={`saas-dot is-${alert.severity === "critical" ? "danger" : alert.severity === "warning" ? "warning" : "info"}`} />
            <span><strong>{alert.count != null ? `${fmtNum(alert.count, locale)} ` : ""}{alert.title}</strong><small>{alert.message ?? tx("Open to review")}</small></span>
            <i className="ti ti-chevron-right" />
          </button>
        ))}
      </div>
    </article>
  );
}

function ApprovalQueue({ pending, critical, warnings, total, language, locale }: { pending: number; critical: number; warnings: number; total: number; language: string; locale: string }) {
  const tx = (text: string) => dashboardText(language, text);
  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Workflow")} title={tx("Approval queue")} subtitle={tx("Documents and controls waiting for action")} />
      <div className="saas-queue-grid">
        <Queue label={tx("Approval queue")} value={pending} tone="warning" locale={locale} />
        <Queue label={tx("Critical alerts")} value={critical} tone="danger" locale={locale} />
        <Queue label={tx("Warnings")} value={warnings} tone="warning" locale={locale} />
        <Queue label={tx("Total alerts")} value={total} tone="info" locale={locale} />
      </div>
      <div className="saas-note">{tx("Prioritize critical alerts and the oldest approvals first.")}</div>
    </article>
  );
}

function BestSellers({ items, language, locale }: { items: BestSellerDto[]; language: string; locale: string }) {
  const tx = (text: string) => dashboardText(language, text);
  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Sales")} title={tx("Best sellers")} subtitle={tx("Top items by profitability")} />
      {items.length === 0 ? <Empty text={tx("No sales ranking available yet.")} /> : (
        <table className="saas-table"><thead><tr><th>{tx("Item")}</th><th>{tx("Units")}</th><th>{tx("Revenue")}</th><th>{tx("Margin")}</th></tr></thead>
          <tbody>{items.slice(0, 6).map((item, i) => <tr key={item.itemId ?? `${item.itemName}-${i}`}>
            <td><span className="saas-rank">{i + 1}</span><strong>{item.itemName}</strong></td>
            <td>{fmtNum(item.unitsSold, locale)}</td><td>{fmtMoney(item.revenue, locale)}</td><td><span className="saas-chip is-success">{fmtPct(item.marginPct)}</span></td>
          </tr>)}</tbody></table>
      )}
    </article>
  );
}

function MenuEngineering({ summary, language, locale }: { summary: MenuEngineeringSummaryDto; language: string; locale: string }) {
  const tx = (text: string) => dashboardText(language, text);
  const cells = [
    ["Stars", summary.star, "success"], ["Puzzles", summary.puzzle, "info"],
    ["Plowhorses", summary.plowhorse, "warning"], ["Dogs", summary.dog, "danger"],
  ] as const;
  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Menu")} title={tx("Menu engineering")} subtitle={tx("Boston Matrix classification")} />
      <div className="saas-menu-grid">{cells.map(([label, value, tone]) => <div className={`is-${tone}`} key={label}><span>{tx(label)}</span><strong>{fmtNum(value, locale)}</strong><small>{tx("items")}</small></div>)}</div>
    </article>
  );
}

function InventoryWatchlist({ items, language, locale }: { items: InventorySummaryDto[]; language: string; locale: string }) {
  const tx = (text: string) => dashboardText(language, text);
  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Inventory")} title={tx("Inventory watchlist")} subtitle={tx("Items requiring stock attention")} badge={fmtNum(items.length, locale)} tone="warning" />
      {items.length === 0 ? <Empty text={tx("Inventory watchlist is clear.")} /> : (
        <table className="saas-table"><thead><tr><th>{tx("Item")}</th><th>{tx("Location")}</th><th>{tx("On hand")}</th><th>{tx("Available")}</th><th>{tx("Reorder")}</th><th>{tx("Status")}</th></tr></thead>
          <tbody>{items.slice(0, 8).map((item, i) => {
            const available = num(item.availableQuantity); const reorder = num(item.reorderLevel);
            const tone = available <= 0 ? "danger" : available <= reorder ? "warning" : "success";
            return <tr key={item.itemId ?? `${item.itemName}-${i}`}><td><strong>{item.itemName}</strong><small>{item.uomCode ?? ""}</small></td><td>{item.locationName ?? "-"}</td><td>{fmtNum(item.quantity, locale)}</td><td>{fmtNum(item.availableQuantity, locale)}</td><td>{fmtNum(item.reorderLevel, locale)}</td><td><span className={`saas-chip is-${tone}`}>{tx(tone === "danger" ? "Critical" : tone === "warning" ? "Low" : "Healthy")}</span></td></tr>;
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
  language,
  locale,
}: {
  actions: string[];
  critical: number;
  warnings: number;
  onNavigate: (path: string) => void;
  language: string;
  locale: string;
}) {
  const tx = (text: string) => dashboardText(language, text);
  return (
    <article className="saas-card saas-copilot-card">
      <CardHeader eyebrow={tx("AI workspace")} title={tx("Restaurant Copilot")} subtitle={tx("Prioritized actions from current operations")} badge="AI" />
      <div className="saas-copilot-summary"><div><strong>{fmtNum(critical + warnings, locale)}</strong><span>{tx("items need attention")}</span></div><div><span className="saas-chip is-danger">{fmtNum(critical, locale)} {tx("critical alerts")}</span><span className="saas-chip is-warning">{fmtNum(warnings, locale)} {tx("warning")}</span></div></div>
      <ol className="saas-copilot-actions">{actions.map((action, i) => <li key={action}><span>{i + 1}</span><p>{action}</p></li>)}</ol>
      <button
        className="saas-btn saas-btn-primary saas-full"
        type="button"
        onClick={() => onNavigate("sales/operations")}
      >
        {tx("Open Copilot workspace")}
      </button>
    </article>
  );
}

function QuickActions({ actions, onNavigate, language }: { actions: QuickAction[]; onNavigate: (path: string) => void; language: string }) {
  const tx = (text: string) => dashboardText(language, text);
  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Shortcuts")} title={tx("Quick actions")} subtitle={tx("Start common workflows")} />
      <div className="saas-quick-actions">{actions.map((a) => <button key={a.href} onClick={() => onNavigate(a.href)}><span className="saas-quick-icon"><i className={`ti ${a.icon}`} /></span><span><strong>{tx(a.title)}</strong><small>{tx(a.sub)}</small></span><i className="ti ti-chevron-right" /></button>)}</div>
    </article>
  );
}

function BusinessHealth({
  dashboard,
  identity,
  capabilities,
  language,
  locale,
}: {
  dashboard: DashboardOverviewDto;
  identity: DashboardOverviewDto["identity"];
  capabilities: DashboardCapabilities;
  language: string;
  locale: string;
}) {
  const tx = (text: string) => dashboardText(language, text);
  const rows = [
    capabilities.sales ? [tx("Food cost"), fmtPct(dashboard.sales.todayFoodCostPct)] : null,
    capabilities.inventory
      ? [tx("Inventory value"), dashboard.inventorySummary.inventoryValue == null ? "-" : fmtMoney(dashboard.inventorySummary.inventoryValue, locale)]
      : null,
    dashboard.hr ? [tx("Present today"), fmtNum(dashboard.hr.employeesPresentToday, locale)] : null,
    dashboard.hr ? [tx("Pending leave"), fmtNum(dashboard.hr.pendingLeaveRequests ?? 0, locale)] : null,
    capabilities.identity ? [tx("Users"), fmtNum(identity.totalUsers, locale)] : null,
    capabilities.identity ? [tx("Roles"), fmtNum(identity.totalRoles, locale)] : null,
  ].filter(Boolean) as string[][];

  return <article className="saas-card"><CardHeader eyebrow={tx("Snapshot")} title={tx("Business health")} subtitle={tx("Compact operating summary")} /><div className="saas-health">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></article>;
}

function CardHeader({ eyebrow, title, subtitle, badge, tone = "info" }: { eyebrow: string; title: string; subtitle: string; badge?: string; tone?: string }) {
  return <div className="saas-card-header"><div><span className="saas-card-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div>{badge ? <span className={`saas-chip is-${tone}`}>{badge}</span> : null}</div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="saas-metric"><span>{label}</span><strong>{value}</strong></div>; }
function Queue({ label, value, tone, locale }: { label: string; value: number; tone: string; locale?: string }) { return <div className={`saas-queue is-${tone}`}><span>{label}</span><strong>{fmtNum(value, locale)}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="saas-empty">{text}</div>; }

function buildCopilotActions(dashboard: DashboardOverviewDto, alerts: DashboardAlertDto[], inventory: InventorySummaryDto[], language: string, locale: string) {
  const actions: string[] = [];
  const critical = alerts.find((a) => a.severity === "critical");
  if (critical) {
    actions.push(language === "am" ? `${critical.title} ወዲያውኑ ይገምግሙ።` : `Review ${critical.title.toLowerCase()} immediately.`);
  }
  if (dashboard.inventorySummary.lowStockItems > 0) {
    actions.push(language === "am" ? `${fmtNum(dashboard.inventorySummary.lowStockItems, locale)} ዝቅተኛ ስቶክ እቃዎችን ይገምግሙ።` : `Review ${fmtNum(dashboard.inventorySummary.lowStockItems, locale)} low-stock items.`);
  }
  if (dashboard.procurement.pendingPurchaseOrders > 0) {
    actions.push(language === "am" ? `${fmtNum(dashboard.procurement.pendingPurchaseOrders, locale)} የግዢ ትዕዛዞች እርምጃ ይፈልጋሉ።` : `${fmtNum(dashboard.procurement.pendingPurchaseOrders, locale)} purchase orders require action.`);
  }
  if (inventory[0]) {
    actions.push(language === "am" ? `የክትትል ዝርዝሩን ክፈቱ እና ${inventory[0].itemName} ይገምግሙ።` : `Open the watchlist and review ${inventory[0].itemName}.`);
  }
  if (dashboard.sales.todayFoodCostPct > 40) {
    actions.push(language === "am" ? `የምግብ ወጪ ${fmtPct(dashboard.sales.todayFoodCostPct)} ነው፤ ከፍተኛ ወጪ ያላቸውን የምናሌ እቃዎች ይገምግሙ።` : `Food cost is ${fmtPct(dashboard.sales.todayFoodCostPct)}; review high-cost menu items.`);
  }
  return (actions.length ? actions : [dashboardText(language, "No critical action is required. Operations are within normal range.")]).slice(0, 4);
}
