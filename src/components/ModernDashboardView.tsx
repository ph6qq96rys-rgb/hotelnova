import { useState } from "react";
import type {
  BestSellerDto,
  DashboardAlertDto,
  DashboardOverviewDto,
  InventorySummaryDto,
  BusinessHealthDto,
  HealthIndicatorDto,
  MenuEngineeringSummaryDto,
  MenuQuadrantKey,
  OperationsDashboardSummaryDto,
} from "../api/dashboard/dashboardTypes";
import { formatAppDate } from "../shared/datetime/dateFormat";
import { formatCurrency } from "../shared/currency/currencyFormat";
import { useI18n } from "../i18n";
import { Button } from "./ui/button";
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
  hr?: boolean;
};

type Props = {
  dashboard: DashboardOverviewDto;
  updatedAt: string | null;
  actions: QuickAction[];
  capabilities?: DashboardCapabilities;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  refreshError?: string | null;
};

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const fmtPct = (value?: number | null) => `${Number(value ?? 0).toFixed(1)}%`;
const fmtNum = (value?: number | null, locale?: string) => new Intl.NumberFormat(locale).format(Number(value ?? 0));

const dashboardAmharicPhrases: Record<string, string> = {
  "Command center": "መቆጣጠሪያ ማዕከል",
  "Operations dashboard": "የኦፕሬሽን ዳሽቦርድ",
  "Business date": "የንግድ ቀን",
  "Updated": "ተዘምኗል",
  "Refresh": "አድስ",
  "Refreshing...": "በመታደስ ላይ...",
  "Refreshes every 5 minutes": "በየ5 ደቂቃው ይታደሳል",
  "Couldn't refresh. Showing the last figures.": "ማደስ አልተቻለም። የመጨረሻዎቹ አሃዞች እየታዩ ነው።",
  "Daily operation plan": "ዕለታዊ የኦፕሬሽን እቅድ",
  "Net sales today": "የዛሬ የተጣራ ሽያጭ",
  "excl. VAT": "ቫትን ሳይጨምር",
  "Orders today": "የዛሬ ትዕዛዞች",
  "avg ticket": "አማካይ ትኬት",
  "vs same time last week": "ካለፈው ሳምንት ተመሳሳይ ሰዓት ጋር",
  "No sales at this time last week": "ባለፈው ሳምንት በዚህ ሰዓት ሽያጭ አልነበረም",
  "Stock at risk": "አደጋ ላይ ያለ ስቶክ",
  "below reorder level": "ከእንደገና ማዘዣ ደረጃ በታች",
  "out of stock": "ያለቁ",
  "Approvals waiting": "የሚጠብቁ ማጽደቂያዎች",
  "requisitions approved, awaiting PO": "የጸደቁ ጥያቄዎች የግዢ ትዕዛዝ ይጠብቃሉ",
  "Workspace": "የስራ ቦታ",
  "Dashboard": "ዳሽቦርድ",
  "No dashboard widgets are available for your current role.": "ለአሁኑ ሚናዎ የዳሽቦርድ ካርዶች አልተመደቡም።",
  "Only modules assigned to your role are shown here.": "እዚህ የሚታዩት ለሚናዎ የተመደቡ ሞጁሎች ብቻ ናቸው።",
  "Performance": "አፈጻጸም",
  "Revenue & food cost": "ገቢ እና የምግብ ወጪ",
  "Last 7 business days, excluding VAT": "ያለፉት 7 የንግድ ቀናት፣ ቫትን ሳይጨምር",
  "Net sales": "የተጣራ ሽያጭ",
  "Gross profit": "ጠቅላላ ትርፍ",
  "Food cost": "የምግብ ወጪ",
  "Avg order": "አማካይ ትዕዛዝ",
  "No revenue trend is available yet.": "የገቢ አዝማሚያ ገና አልተገኘም።",
  "Daily net sales for the last 7 days": "ለያለፉት 7 ቀናት ዕለታዊ የተጣራ ሽያጭ",
  "7 days": "7 ቀናት",
  "30 days": "30 ቀናት",
  "YTD": "ከዓመት መጀመሪያ",
  "Margin": "ማርጅን",
  "Operations": "ኦፕሬሽን",
  "Today's operations": "የዛሬ ኦፕሬሽኖች",
  "Shift plans, tills and day close": "የሺፍት እቅዶች፣ ካዝናዎች እና የቀን መዝጊያ",
  "Branches ready": "ዝግጁ ቅርንጫፎች",
  "Open tills": "ክፍት ካዝናዎች",
  "Day closed": "ቀኑ ተዘግቷል",
  "No shift plan for today yet.": "ለዛሬ የሺፍት እቅድ ገና የለም።",
  "critical checks open": "ክፍት ወሳኝ ፍተሻዎች",
  "Draft": "ረቂቅ",
  "Briefed": "ገለጻ ተሰጥቷል",
  "Ready": "ዝግጁ",
  "Ready with exceptions": "ከልዩ ሁኔታዎች ጋር ዝግጁ",
  "Closed": "ተዘግቷል",
  "Attention": "ትኩረት",
  "Today's priorities": "የዛሬ ቅድሚያዎች",
  "Most urgent first; open one to act on it": "አስቸኳዩ መጀመሪያ፤ እርምጃ ለመውሰድ ይክፈቱ",
  "Nothing needs attention right now.": "አሁን ትኩረት የሚፈልግ ነገር የለም።",
  "Open to review": "ለመገምገም ክፈት",
  "Workflow": "የስራ ፍሰት",
  "Approval queue": "የማጽደቅ ወረፋ",
  "Purchase requisitions waiting for a decision": "ውሳኔ የሚጠብቁ የግዢ ጥያቄዎች",
  "F&B approval": "የF&B ማጽደቅ",
  "Finance approval": "የፋይናንስ ማጽደቅ",
  "Approved, awaiting PO": "ጸድቋል፣ የግዢ ትዕዛዝ ይጠብቃል",
  "Open transfers": "ክፍት ዝውውሮች",
  "Open requisitions": "ጥያቄዎችን ክፈት",
  "Sales": "ሽያጭ",
  "Best sellers": "በጣም የሚሸጡ",
  "Last 30 days, by revenue": "ያለፉት 30 ቀናት፣ በገቢ",
  "No sales ranking available yet.": "የሽያጭ ደረጃ ገና አልተገኘም።",
  "Item": "እቃ",
  "Units": "ክፍሎች",
  "Revenue": "ገቢ",
  "Menu": "ምናሌ",
  "Menu engineering": "ምናሌ ኢንጂነሪንግ",
  "Latest analysis run": "የቅርብ ጊዜ ትንተና",
  "Stars": "ኮከቦች",
  "Puzzles": "ፓዝሎች",
  "Plowhorses": "ፕላው ሆርሶች",
  "Dogs": "ውሾች",
  "items": "እቃዎች",
  "Inventory": "ኢንቬንቶሪ",
  "Inventory watchlist": "የኢንቬንቶሪ ክትትል ዝርዝር",
  "Items at or below reorder level": "በእንደገና ማዘዣ ደረጃ ወይም በታች ያሉ እቃዎች",
  "Inventory watchlist is clear.": "የኢንቬንቶሪ ክትትል ዝርዝር ንጹህ ነው።",
  "Location": "ቦታ",
  "On hand": "በእጅ ያለ",
  "Available": "ያለ",
  "Reorder": "እንደገና ማዘዝ",
  "Status": "ሁኔታ",
  "Out of stock": "አልቋል",
  "Low": "ዝቅተኛ",
  "Healthy": "ጤናማ",
  "Shortcuts": "አቋራጮች",
  "Quick actions": "ፈጣን እርምጃዎች",
  "Start common workflows": "የተለመዱ የስራ ፍሰቶችን ጀምር",
  "Daily Operation Plan": "ዕለታዊ የኦፕሬሽን እቅድ",
  "Plan, brief, ready, close": "ያቅዱ፣ ገለጻ ይስጡ፣ ዝግጁ ይሁኑ፣ ይዝጉ",
  "Inventory Items": "የኢንቬንቶሪ እቃዎች",
  "Manage inventory master": "የኢንቬንቶሪ ማስተር አስተዳድር",
  "Stock Transfer": "የስቶክ ዝውውር",
  "Move inventory": "ኢንቬንቶሪ አንቀሳቅስ",
  "Stock Adjustment": "የስቶክ ማስተካከያ",
  "Adjust inventory": "ኢንቬንቶሪ አስተካክል",
  "Production Batch": "የምርት ባች",
  "Execute recipe": "የምግብ አሰራር ፈጽም",
  "Recipe Management": "የምግብ አሰራር አስተዳደር",
  "Manage recipes": "የምግብ አሰራሮችን አስተዳድር",
  "Menu Engineering": "ምናሌ ኢንጂነሪንግ",
  "Boston Matrix": "Boston Matrix",
  "Snapshot": "ማጠቃለያ",
  "Business health": "የንግድ ጤና",
  "Compact operating summary": "አጭር የኦፕሬሽን ማጠቃለያ",
  "Inventory value": "የኢንቬንቶሪ ዋጋ",
  "Present today": "ዛሬ የተገኙ",
  "Pending leave": "በመጠባበቅ ላይ ያለ ፈቃድ",
  "Users": "ተጠቃሚዎች",
  "Roles": "ሚናዎች",
  "for information": "ለመረጃ",
  "warning": "ማስጠንቀቂያ",
  "critical": "ወሳኝ",
  "Show fewer": "ያነሰ አሳይ",
  "Show": "አሳይ",
  "more": "ተጨማሪ",
  "Last": "ያለፉት",
  "sold": "የተሸጡ",
  "contribution": "አስተዋጽኦ",
  "of margin": "ከትርፍ",
  "of units": "ከብዛት",
  "Sold": "የተሸጠ",
  "Margin per sale": "በአንድ ሽያጭ ትርፍ",
  "Contribution": "አስተዋጽኦ",
  "No menu items were sold in this period, so the matrix cannot be calculated yet.": "በዚህ ጊዜ ውስጥ ምንም የምናሌ እቃ አልተሸጠም፤ ስለዚህ ማትሪክሱ ገና ሊሰላ አይችልም።",
  "No active menu items in this scope.": "በዚህ ወሰን ውስጥ ንቁ የምናሌ እቃዎች የሉም።",
  "Open menu engineering": "ምናሌ ኢንጂነሪንግ ክፈት",
  "Full matrix, prices and recipe costs": "ሙሉ ማትሪክስ፣ ዋጋዎች እና የምግብ አሰራር ወጪዎች",
  "No items in this group.": "በዚህ ቡድን ውስጥ እቃዎች የሉም።",
  "What to do": "ምን ማድረግ እንዳለበት",
  "Popular · high margin": "ተወዳጅ · ከፍተኛ ትርፍ",
  "Unpopular · high margin": "ብዙም ያልተወደደ · ከፍተኛ ትርፍ",
  "Popular · low margin": "ተወዳጅ · ዝቅተኛ ትርፍ",
  "Unpopular · low margin": "ብዙም ያልተወደደ · ዝቅተኛ ትርፍ",
  "Re-cost": "ወጪ እንደገና አስላ",
  "Promote": "አስተዋውቅ",
  "Review": "ገምግም",
  "Protect": "ጠብቅ",
  "Scorecard": "የውጤት ካርድ",
  "Health score": "የጤና ውጤት",
  "Needs attention": "ትኩረት ይፈልጋል",
  "At risk": "አደጋ ላይ",
  "Not enough data": "በቂ መረጃ የለም",
  "On target": "በግብ ላይ",
  "Watch": "ይከታተሉ",
  "Off target": "ከግብ ውጭ",
  "No data": "መረጃ የለም",
  "on target": "በግብ ላይ",
  "to watch": "የሚከታተሉ",
  "off target": "ከግብ ውጭ",
  "Target": "ግብ",
  "Gross margin": "ጠቅላላ ትርፍ ህዳግ",
  "Sales vs previous week": "ሽያጭ ከባለፈው ሳምንት ጋር",
  "Average ticket": "አማካይ ትኬት",
  "Stock availability": "የስቶክ መገኘት",
  "Days of inventory": "የኢንቬንቶሪ ቀናት",
  "On-time deliveries": "በሰዓቱ የደረሱ ርክክቦች",
  "Attendance today": "የዛሬ መገኘት",
  "Branches ready today": "ዛሬ ዝግጁ የሆኑ ቅርንጫፎች",
  "65% or more": "65% ወይም ከዚያ በላይ",
  "35% or less": "35% ወይም ከዚያ በታች",
  "Growing (0% or more)": "እያደገ (0% ወይም ከዚያ በላይ)",
  "Holding or rising": "የቆመ ወይም እየጨመረ",
  "97% or more": "97% ወይም ከዚያ በላይ",
  "2 to 14 days": "ከ2 እስከ 14 ቀናት",
  "90% or more": "90% ወይም ከዚያ በላይ",
  "All branches": "ሁሉም ቅርንጫፎች",
  "Sales indicators use the last 7 full days; delivery and stock cover use the last 30 days.": "የሽያጭ አመልካቾች ያለፉትን 7 ሙሉ ቀናት፣ ርክክብ እና የስቶክ ሽፋን ያለፉትን 30 ቀናት ይጠቀማሉ።",
  "Open daily plan": "ዕለታዊ እቅድ ክፈት",
  "Request stock": "ስቶክ ጠይቅ",
  "View items": "እቃዎችን እይ",
  "Chase deliveries": "ርክክቦችን ተከታተል",
  "Post receipts": "የእቃ መቀበያዎችን ለጥፍ",
  "Review requests": "ጥያቄዎችን ገምግም",
  "Review orders": "ትዕዛዞችን ገምግም",
  "Send orders": "ትዕዛዞችን ላክ",
  "Create orders": "ትዕዛዞችን አዘጋጅ",
  "Review menu costs": "የምናሌ ወጪዎችን ገምግም",
  "View attendance": "መገኘትን እይ",
  "Review leave": "ፈቃድን ገምግም",
  "View transfers": "ዝውውሮችን እይ",
  "Items out of stock": "ያለቁ እቃዎች",
  "Deliveries overdue": "ጊዜያቸው ያለፈ ርክክቦች",
  "Goods receipts not posted": "ያልተለጠፉ የእቃ መቀበያዎች",
  "Purchase requests waiting for approval": "ማጽደቅ የሚጠብቁ የግዢ ጥያቄዎች",
  "Purchase orders waiting for approval": "ማጽደቅ የሚጠብቁ የግዢ ትዕዛዞች",
  "Approved purchase orders not sent": "ያልተላኩ የጸደቁ የግዢ ትዕዛዞች",
  "Approved requests without a purchase order": "የግዢ ትዕዛዝ የሌላቸው የጸደቁ ጥያቄዎች",
  "Food cost above target": "የምግብ ወጪ ከግብ በላይ",
  "Popular dishes with high food cost": "ከፍተኛ የምግብ ወጪ ያላቸው ተወዳጅ ምግቦች",
  "Late arrivals today": "የዛሬ ዘግይተው የመጡ",
  "Leave requests waiting for a decision": "ውሳኔ የሚጠብቁ የፈቃድ ጥያቄዎች",
  "Open stock transfers": "ክፍት የስቶክ ዝውውሮች",
  "Staff not clocked in yet": "ገና ያልገቡ ሰራተኞች",
  "Today's operation plan is not ready": "የዛሬው የኦፕሬሽን እቅድ ዝግጁ አይደለም",
  "Branches without a ready operation plan": "ዝግጁ የኦፕሬሽን እቅድ የሌላቸው ቅርንጫፎች",
  "Popular and profitable. Protect them: keep quality, portion and placement consistent.": "ተወዳጅ እና ትርፋማ። ይጠብቋቸው፦ ጥራት፣ መጠን እና ቦታን ወጥ ያድርጉ።",
  "Popular but low margin. Re-cost the recipe or portion, or raise the price gradually.": "ተወዳጅ ግን ዝቅተኛ ትርፍ። የምግብ አሰራሩን ወይም መጠኑን እንደገና ያስሉ፣ ወይም ዋጋውን ቀስ በቀስ ይጨምሩ።",
  "Profitable but rarely ordered. Promote them: menu position, staff suggestions, combos.": "ትርፋማ ግን ብዙም አይታዘዙም። ያስተዋውቋቸው፦ የምናሌ ቦታ፣ የሰራተኞች ጥቆማ፣ ጥምር።",
  "Unpopular and low margin. Rework, reprice or remove them.": "ብዙም ያልተወደዱ እና ዝቅተኛ ትርፍ። እንደገና ያዘጋጁ፣ ዋጋ ይቀይሩ ወይም ያስወግዱ።"
};

function dashboardText(language: string, text: string): string {
  return language === "am" ? dashboardAmharicPhrases[text] ?? text : text;
}

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const severityRank: Record<string, number> = { critical: 0, warning: 1, info: 2 };

const severityTone = (severity: string): Tone =>
  severity === "critical" ? "danger" : severity === "warning" ? "warning" : "info";

const planStatus: Record<string, { label: string; tone: Tone }> = {
  Draft: { label: "Draft", tone: "neutral" },
  Briefed: { label: "Briefed", tone: "info" },
  Ready: { label: "Ready", tone: "success" },
  ReadyWithException: { label: "Ready with exceptions", tone: "warning" },
  Closed: { label: "Closed", tone: "neutral" },
};

/** Change against the same weekday last week, up to the same time of day. */
function weekDelta(today: number, lastWeek: number | null | undefined): { pct: number | null; tone: Tone } | null {
  if (lastWeek == null) return null;
  if (lastWeek <= 0) return { pct: null, tone: "neutral" };
  const pct = ((today - lastWeek) / lastWeek) * 100;
  return { pct, tone: pct >= 0 ? "success" : "danger" };
}

function formatTime(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export default function ModernDashboardView({
  dashboard,
  updatedAt,
  actions,
  capabilities,
  onNavigate,
  onRefresh,
  refreshing = false,
  refreshError = null,
}: Props) {
  const { language, locale } = useI18n();
  const tx = (text: string) => dashboardText(language, text);
  const currency = dashboard.currencyCode ?? undefined;
  const money = (value?: number | null) => formatCurrency(value, currency, locale);
  const number = (value?: number | null) => fmtNum(value, locale);

  const can = {
    sales: Boolean(capabilities?.sales),
    inventory: Boolean(capabilities?.inventory),
    procurement: Boolean(capabilities?.procurement),
    identity: Boolean(capabilities?.identity),
    menu: Boolean(capabilities?.menu),
    operations: Boolean(capabilities?.operations),
    hr: Boolean(capabilities?.hr),
  };

  const sales = dashboard.sales;
  const inventorySummary = dashboard.inventorySummary;
  const procurement = dashboard.procurement;
  const alerts = (Array.isArray(dashboard.alerts) ? dashboard.alerts : [])
    .slice()
    .sort((a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3));
  const bestSellers = Array.isArray(dashboard.bestSellers) ? dashboard.bestSellers : [];
  const lowInventory = Array.isArray(dashboard.inventory) ? dashboard.inventory : [];
  const menu = dashboard.menuEngineering ?? { star: 0, puzzle: 0, plowhorse: 0, dog: 0 };

  const approvalsWaiting = num(procurement.pendingFnbApprovals) + num(procurement.pendingFinanceApprovals);
  const salesDelta = weekDelta(sales.todaySales, sales.sameTimeLastWeekSales);
  const ordersDelta = weekDelta(sales.todayOrders, sales.sameTimeLastWeekOrders);

  const deltaText = (delta: ReturnType<typeof weekDelta>) => {
    if (!delta) return null;
    if (delta.pct == null) return tx("No sales at this time last week");
    return `${delta.pct >= 0 ? "+" : ""}${delta.pct.toFixed(1)}% ${tx("vs same time last week")}`;
  };

  const kpis = [
    can.sales && {
      label: `${tx("Net sales today")} (${tx("excl. VAT")})`,
      value: money(sales.todaySales),
      meta: `${fmtPct(sales.todayMarginPct)} ${tx("Margin").toLowerCase()}`,
      delta: deltaText(salesDelta),
      deltaTone: salesDelta?.tone ?? "neutral",
      icon: "ti-cash",
      tone: "success" as Tone,
    },
    can.sales && {
      label: tx("Orders today"),
      value: number(sales.todayOrders),
      meta: `${money(sales.averageOrderValue)} ${tx("avg ticket")}`,
      delta: deltaText(ordersDelta),
      deltaTone: ordersDelta?.tone ?? "neutral",
      icon: "ti-receipt",
      tone: "info" as Tone,
    },
    can.inventory && {
      label: tx("Stock at risk"),
      value: number(inventorySummary.lowStockItems),
      meta: `${tx("below reorder level")} · ${number(inventorySummary.outOfStockItems ?? 0)} ${tx("out of stock")}`,
      delta: null,
      deltaTone: "neutral" as Tone,
      icon: "ti-package-off",
      tone: (inventorySummary.outOfStockItems ?? 0) > 0 ? "danger" : inventorySummary.lowStockItems > 0 ? "warning" : "success",
    },
    can.procurement && {
      label: tx("Approvals waiting"),
      value: number(approvalsWaiting),
      meta: `${number(procurement.approvedRequisitions)} ${tx("requisitions approved, awaiting PO")}`,
      delta: null,
      deltaTone: "neutral" as Tone,
      icon: "ti-file-check",
      tone: approvalsWaiting > 0 ? "warning" : "success",
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    meta: string;
    delta: string | null;
    deltaTone: Tone;
    icon: string;
    tone: Tone;
  }>;

  const planAction = can.operations ? actions.find((action) => action.href === "sales/operations") : undefined;
  const hasMainSections = can.sales || can.operations || can.procurement || can.menu || can.inventory;
  const health = dashboard.businessHealth;
  const showHealth = Boolean(health && health.indicators.length > 0);

  const updatedTime = formatTime(updatedAt, locale);
  const subtitle = [
    dashboard.scopeName,
    dashboard.businessDate ? `${tx("Business date")} ${formatAppDate(dashboard.businessDate)}` : null,
    updatedTime ? `${tx("Updated")} ${updatedTime}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="modern-saas-dashboard">
      <header className="saas-page-header">
        <div>
          <div className="saas-eyebrow">{dashboard.companyName || tx("Command center")}</div>
          <h1>{tx("Operations dashboard")}</h1>
          <p>
            {subtitle}
            <span className="saas-refresh-hint"> · {tx("Refreshes every 5 minutes")}</span>
          </p>
        </div>
        <div className="saas-header-actions">
          <button type="button" className="saas-btn" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing}>
            <i className={`ti ti-refresh${refreshing ? " saas-spin" : ""}`} aria-hidden="true" /> {refreshing ? tx("Refreshing...") : tx("Refresh")}
          </button>
          {planAction ? (
            <button type="button" className="saas-btn saas-btn-primary" onClick={() => onNavigate(planAction.href)}>
              <i className="ti ti-clipboard-check" aria-hidden="true" /> {tx("Daily operation plan")}
            </button>
          ) : null}
        </div>
      </header>

      {refreshError ? (
        <div className="saas-banner is-warning" role="status">
          <i className="ti ti-alert-triangle" aria-hidden="true" />
          <span><strong>{tx("Couldn't refresh. Showing the last figures.")}</strong> {refreshError}</span>
        </div>
      ) : null}

      {kpis.length > 0 ? (
        <section className="saas-kpi-grid" aria-label={tx("Snapshot")}>
          {kpis.map((kpi) => (
            <article className="saas-kpi" key={kpi.label}>
              <span className={`saas-kpi-icon is-${kpi.tone}`}><i className={`ti ${kpi.icon}`} aria-hidden="true" /></span>
              <div>
                <small>{kpi.label}</small>
                <strong>{kpi.value}</strong>
                <p>{kpi.meta}</p>
                {kpi.delta ? <p className={`saas-delta is-${kpi.deltaTone}`}>{kpi.delta}</p> : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="saas-dashboard-layout">
        <div className="saas-main-column">
          {!hasMainSections ? (
            <article className="saas-card">
              <CardHeader eyebrow={tx("Workspace")} title={tx("Dashboard")} subtitle={tx("No dashboard widgets are available for your current role.")} />
              <Empty text={tx("Only modules assigned to your role are shown here.")} />
            </article>
          ) : null}

          {can.sales ? <PerformanceCard dashboard={dashboard} money={money} tx={tx} locale={locale} /> : null}

          {can.operations || can.procurement ? (
            <div className="saas-split-grid">
              {can.operations ? (
                <OperationsCard summary={dashboard.operations ?? null} onNavigate={onNavigate} tx={tx} locale={locale} />
              ) : null}
              {can.procurement ? (
                <ApprovalQueue
                  fnb={num(procurement.pendingFnbApprovals)}
                  finance={num(procurement.pendingFinanceApprovals)}
                  approved={num(procurement.approvedRequisitions)}
                  transfers={can.inventory ? num(inventorySummary.openTransfers) : null}
                  onNavigate={onNavigate}
                  tx={tx}
                  locale={locale}
                />
              ) : null}
            </div>
          ) : null}

          {can.menu ? <MenuEngineering summary={menu} money={money} onNavigate={onNavigate} tx={tx} locale={locale} /> : null}
          {can.sales ? <BestSellers items={bestSellers} money={money} tx={tx} locale={locale} /> : null}

          {can.inventory ? <InventoryWatchlist items={lowInventory} tx={tx} locale={locale} /> : null}
        </div>

        <aside className="saas-side-column">
          <PrioritiesCard alerts={alerts} onNavigate={onNavigate} tx={tx} locale={locale} />
          {actions.length > 0 ? <QuickActions actions={actions} onNavigate={onNavigate} tx={tx} /> : null}
          {showHealth && health ? <BusinessHealth health={health} money={money} onNavigate={onNavigate} tx={tx} locale={locale} /> : null}
        </aside>
      </section>
    </div>
  );
}

type Tx = (text: string) => string;
type Money = (value?: number | null) => string;

function trendLabel(raw: string | undefined, locale: string): string {
  if (!raw) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return raw;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString(locale, { weekday: "short", day: "numeric", timeZone: "UTC" });
}

function PerformanceCard({ dashboard, money, tx, locale }: { dashboard: DashboardOverviewDto; money: Money; tx: Tx; locale: string }) {
  const sales = dashboard.sales;
  const foodCostByDate = new Map(
    (Array.isArray(dashboard.foodCostTrend) ? dashboard.foodCostTrend : []).map((x) => [String(x.date).slice(0, 10), num(x.foodCostPct)]),
  );
  const points = (Array.isArray(dashboard.revenueTrend) ? dashboard.revenueTrend.slice(-7) : []).map((item: any) => {
    const date = String(item.date ?? item.day ?? item.label ?? "").slice(0, 10);
    return {
      key: date,
      label: trendLabel(date, locale),
      fullDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatAppDate(date) : date,
      value: num(item.revenue ?? item.value ?? item.amount ?? item.total),
      foodCost: foodCostByDate.get(date) ?? null,
    };
  });
  const max = Math.max(...points.map((x) => x.value), 1);
  const summary = points
    .map((p) => `${p.fullDate}: ${money(p.value)}${p.foodCost != null ? `, ${tx("Food cost")} ${fmtPct(p.foodCost)}` : ""}`)
    .join("; ");

  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Performance")} title={tx("Revenue & food cost")} subtitle={tx("Last 7 business days, excluding VAT")} />
      <div className="saas-metric-row">
        <Metric label={tx("Net sales")} value={money(sales.todaySales)} />
        <Metric label={tx("Gross profit")} value={money(sales.todayGrossProfit)} />
        <Metric label={tx("Food cost")} value={fmtPct(sales.todayFoodCostPct)} tone={sales.todayFoodCostPct > 35 ? "danger" : undefined} />
        <Metric label={tx("Avg order")} value={money(sales.averageOrderValue)} />
      </div>
      {points.length === 0 ? (
        <Empty text={tx("No revenue trend is available yet.")} />
      ) : (
        <div className="saas-chart" role="img" aria-label={`${tx("Daily net sales for the last 7 days")}. ${summary}`}>
          {points.map((point, index) => (
            <div className="saas-chart-column" key={point.key || index} title={`${point.fullDate}: ${money(point.value)}`} aria-hidden="true">
              <div className="saas-chart-value">{point.value > 0 ? money(point.value) : ""}</div>
              <div className="saas-chart-track">
                <div className={index === points.length - 1 ? "is-today" : undefined} style={{ height: `${Math.max((point.value / max) * 100, point.value > 0 ? 4 : 0)}%` }} />
              </div>
              <span>{point.label}</span>
              <small className={point.foodCost != null && point.foodCost > 35 ? "is-danger" : undefined}>
                {point.foodCost != null ? fmtPct(point.foodCost) : "–"}
              </small>
            </div>
          ))}
        </div>
      )}
      <div className="saas-period-row">
        <Metric label={tx("7 days")} value={money(sales.last7DaysRevenue)} />
        <Metric label={tx("30 days")} value={money(sales.last30DaysRevenue)} />
        <Metric label={tx("YTD")} value={money(sales.yearToDateRevenue)} />
        <Metric label={tx("Margin")} value={fmtPct(sales.todayMarginPct)} />
      </div>
    </article>
  );
}

function OperationsCard({ summary, onNavigate, tx, locale }: { summary: OperationsDashboardSummaryDto | null; onNavigate: (path: string) => void; tx: Tx; locale: string }) {
  const plans = summary?.plans ?? [];
  const inScope = summary?.branchesInScope ?? 0;
  const ready = summary?.branchesReady ?? 0;
  return (
    <article className="saas-card">
      <CardHeader
        eyebrow={tx("Operations")}
        title={tx("Today's operations")}
        subtitle={tx("Shift plans, tills and day close")}
        badge={inScope > 0 ? `${fmtNum(ready, locale)}/${fmtNum(inScope, locale)} ${tx("Ready").toLowerCase()}` : undefined}
        tone={inScope > 0 && ready >= inScope ? "success" : "warning"}
      />
      <div className="saas-queue-grid is-three">
        <Queue label={tx("Branches ready")} value={`${fmtNum(ready, locale)}/${fmtNum(inScope, locale)}`} tone={ready >= inScope && inScope > 0 ? "success" : "warning"} />
        <Queue label={tx("Open tills")} value={fmtNum(summary?.openCashierShifts ?? 0, locale)} tone="info" />
        <Queue label={tx("Day closed")} value={`${fmtNum(summary?.endOfDayGenerated ?? 0, locale)}/${fmtNum(inScope, locale)}`} tone="neutral" />
      </div>
      <div className="saas-list">
        {plans.length === 0 ? (
          <RowLink tone="warning" title={tx("No shift plan for today yet.")} detail={tx("Daily operation plan")} onClick={() => onNavigate("sales/operations")} />
        ) : (
          plans.slice(0, 5).map((plan) => {
            const status = planStatus[plan.status] ?? { label: plan.status, tone: "neutral" as Tone };
            return (
              <RowLink
                key={`${plan.branchId}-${plan.shiftName}`}
                tone={status.tone}
                title={`${plan.branchName} · ${plan.shiftName}`}
                detail={plan.criticalOpenCount > 0 ? `${fmtNum(plan.criticalOpenCount, locale)} ${tx("critical checks open")}` : tx(status.label)}
                chip={tx(status.label)}
                onClick={() => onNavigate("sales/operations")}
              />
            );
          })
        )}
      </div>
    </article>
  );
}

const PRIORITY_LIMIT = 5;

function PrioritiesCard({ alerts, onNavigate, tx, locale }: { alerts: DashboardAlertDto[]; onNavigate: (path: string) => void; tx: Tx; locale: string }) {
  const [expanded, setExpanded] = useState(false);
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const warnings = alerts.filter((a) => a.severity === "warning").length;
  const info = alerts.length - critical - warnings;
  // Critical and warning items are always shown; information items fill the remaining space.
  const urgentCount = critical + warnings;
  const visible = expanded ? alerts : alerts.slice(0, Math.max(PRIORITY_LIMIT, urgentCount));
  const hidden = alerts.length - visible.length;
  const summary = [
    critical > 0 ? `${fmtNum(critical, locale)} ${tx("critical")}` : null,
    warnings > 0 ? `${fmtNum(warnings, locale)} ${tx(warnings === 1 ? "warning" : "warnings")}` : null,
    info > 0 ? `${fmtNum(info, locale)} ${tx("for information")}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <article className="saas-card">
      <CardHeader
        eyebrow={tx("Attention")}
        title={tx("Today's priorities")}
        subtitle={alerts.length > 0 ? summary : tx("Most urgent first; open one to act on it")}
        badge={urgentCount > 0 ? fmtNum(urgentCount, locale) : undefined}
        tone={critical > 0 ? "danger" : warnings > 0 ? "warning" : "info"}
      />
      <div className="saas-list">
        {alerts.length === 0 ? (
          <div className="saas-all-clear"><i className="ti ti-circle-check" aria-hidden="true" /> {tx("Nothing needs attention right now.")}</div>
        ) : (
          visible.map((alert) => (
            <RowLink
              key={alert.key}
              tone={severityTone(alert.severity)}
              title={`${alert.count != null ? `${fmtNum(alert.count, locale)} · ` : ""}${tx(alert.title)}`}
              detail={alert.message ?? tx("Open to review")}
              chip={alert.route && alert.actionLabel ? tx(alert.actionLabel) : undefined}
              chipTone={alert.severity === "critical" ? "danger" : "info"}
              onClick={alert.route ? () => onNavigate(alert.route!) : undefined}
            />
          ))
        )}
      </div>
      {hidden > 0 || expanded ? (
        <div className="saas-card-footer">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? tx("Show fewer") : `${tx("Show")} ${fmtNum(hidden, locale)} ${tx("more")}`}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function ApprovalQueue({
  fnb, finance, approved, transfers, onNavigate, tx, locale,
}: { fnb: number; finance: number; approved: number; transfers: number | null; onNavigate: (path: string) => void; tx: Tx; locale: string }) {
  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Workflow")} title={tx("Approval queue")} subtitle={tx("Purchase requisitions waiting for a decision")} />
      <div className="saas-queue-grid">
        <Queue label={tx("F&B approval")} value={fmtNum(fnb, locale)} tone={fnb > 0 ? "warning" : "neutral"} />
        <Queue label={tx("Finance approval")} value={fmtNum(finance, locale)} tone={finance > 0 ? "warning" : "neutral"} />
        <Queue label={tx("Approved, awaiting PO")} value={fmtNum(approved, locale)} tone={approved > 0 ? "info" : "neutral"} />
        {transfers != null ? <Queue label={tx("Open transfers")} value={fmtNum(transfers, locale)} tone={transfers > 0 ? "info" : "neutral"} /> : null}
      </div>
      <div className="saas-list">
        <RowLink tone="info" title={tx("Open requisitions")} onClick={() => onNavigate("/procurement/requisitions")} />
      </div>
    </article>
  );
}

function BestSellers({ items, money, tx, locale }: { items: BestSellerDto[]; money: Money; tx: Tx; locale: string }) {
  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Sales")} title={tx("Best sellers")} subtitle={tx("Last 30 days, by revenue")} />
      {items.length === 0 ? <Empty text={tx("No sales ranking available yet.")} /> : (
        <div className="saas-table-wrap">
          <table className="saas-table">
            <thead><tr><th scope="col">{tx("Item")}</th><th scope="col" className="is-num">{tx("Units")}</th><th scope="col" className="is-num">{tx("Revenue")}</th><th scope="col" className="is-num">{tx("Margin")}</th></tr></thead>
            <tbody>{items.slice(0, 6).map((item, i) => {
              const tone: Tone = item.marginPct >= 65 ? "success" : item.marginPct >= 50 ? "warning" : "danger";
              return (
                <tr key={item.itemId ?? `${item.itemName}-${i}`}>
                  <td><span className="saas-rank">{i + 1}</span><strong>{item.itemName}</strong></td>
                  <td className="is-num">{fmtNum(item.unitsSold, locale)}</td>
                  <td className="is-num">{money(item.revenue)}</td>
                  <td className="is-num"><span className={`saas-chip is-${tone}`}>{fmtPct(item.marginPct)}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </article>
  );
}

const QUADRANTS: { key: MenuQuadrantKey; label: string; tone: Tone; hint: string }[] = [
  { key: "star", label: "Stars", tone: "success", hint: "Popular · high margin" },
  { key: "puzzle", label: "Puzzles", tone: "info", hint: "Unpopular · high margin" },
  { key: "plowhorse", label: "Plowhorses", tone: "warning", hint: "Popular · low margin" },
  { key: "dog", label: "Dogs", tone: "danger", hint: "Unpopular · low margin" },
];

const MENU_ACTION: Record<string, { label: string; tone: Tone }> = {
  recost: { label: "Re-cost", tone: "warning" },
  promote: { label: "Promote", tone: "info" },
  review: { label: "Review", tone: "danger" },
  protect: { label: "Protect", tone: "success" },
};

const MENU_ENGINEERING_ROUTE = "/production/menu-engineering";

function MenuEngineering({
  summary, money, onNavigate, tx, locale,
}: { summary: MenuEngineeringSummaryDto; money: Money; onNavigate: (path: string) => void; tx: Tx; locale: string }) {
  const quadrants = summary.quadrants ?? [];
  const [selected, setSelected] = useState<MenuQuadrantKey>("plowhorse");
  const period = summary.periodDays ?? 30;
  const active = quadrants.find((q) => q.key === selected);
  const subtitle = summary.hasSales
    ? `${tx("Last")} ${period} ${tx("days")} · ${fmtNum(summary.itemsAnalysed, locale)} ${tx("items")} · ${fmtNum(summary.unitsSold, locale)} ${tx("sold")} · ${money(summary.totalContribution)} ${tx("contribution")}`
    : `${tx("Last")} ${period} ${tx("days")}`;

  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Menu")} title={tx("Menu engineering")} subtitle={subtitle} />
      {!summary.hasSales ? (
        <div className="saas-list">
          <Empty text={(summary.itemsAnalysed ?? 0) > 0 ? tx("No menu items were sold in this period, so the matrix cannot be calculated yet.") : tx("No active menu items in this scope.")} />
          <RowLink icon="ti-chart-dots" title={tx("Open menu engineering")} onClick={() => onNavigate(MENU_ENGINEERING_ROUTE)} />
        </div>
      ) : (
        <>
          <div className="saas-menu-matrix" role="group" aria-label={tx("Menu engineering")}>
            {QUADRANTS.map((q) => {
              const data = quadrants.find((x) => x.key === q.key);
              return (
                <Button
                  key={q.key}
                  variant="ghost"
                  className={`saas-menu-cell is-${q.tone}${selected === q.key ? " is-selected" : ""}`}
                  aria-pressed={selected === q.key}
                  onClick={() => setSelected(q.key)}
                >
                  <span className="saas-menu-cell-head"><span>{tx(q.label)}</span><small>{tx(q.hint)}</small></span>
                  <strong>{fmtNum(data?.count ?? 0, locale)}</strong>
                  <small>{fmtPct(data?.contributionShare)} {tx("of margin")} · {fmtPct(data?.unitsShare)} {tx("of units")}</small>
                </Button>
              );
            })}
          </div>

          {active ? (
            <div className="saas-menu-detail">
              <p className="saas-menu-advice"><span className={`saas-dot is-${QUADRANTS.find((q) => q.key === active.key)?.tone ?? "info"}`} aria-hidden="true" />{tx(active.advice)}</p>
              {active.topItems.length === 0 ? <p className="saas-muted-line">{tx("No items in this group.")}</p> : (
                <div className="saas-table-wrap">
                  <table className="saas-table">
                    <thead><tr><th scope="col">{tx("Item")}</th><th scope="col" className="is-num">{tx("Sold")}</th><th scope="col" className="is-num">{tx("Margin per sale")}</th><th scope="col" className="is-num">{tx("Food cost")}</th><th scope="col" className="is-num">{tx("Contribution")}</th></tr></thead>
                    <tbody>
                      {active.topItems.map((item) => (
                        <tr key={item.menuItemId}>
                          <td><strong>{item.name}</strong>{item.branchName ? <small>{item.branchName}</small> : null}</td>
                          <td className="is-num">{fmtNum(item.unitsSold, locale)}</td>
                          <td className="is-num">{money(item.contributionMargin)}</td>
                          <td className="is-num"><span className={item.foodCostPct > 35 ? "saas-text-danger" : undefined}>{fmtPct(item.foodCostPct)}</span></td>
                          <td className="is-num">{money(item.totalContribution)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          <div className="saas-list saas-menu-actions">
            <div className="saas-list-heading">{tx("What to do")}</div>
            {(summary.actions ?? []).map((action) => {
              const meta = MENU_ACTION[action.kind] ?? { label: action.kind, tone: "info" as Tone };
              return (
                <RowLink
                  key={`${action.kind}-${action.menuItemId}`}
                  tone={meta.tone}
                  title={`${tx(meta.label)}: ${action.itemName}${action.branchName ? ` (${action.branchName})` : ""}`}
                  detail={action.detail}
                  onClick={() => onNavigate(MENU_ENGINEERING_ROUTE)}
                />
              );
            })}
            <RowLink icon="ti-chart-dots" title={tx("Open menu engineering")} detail={tx("Full matrix, prices and recipe costs")} onClick={() => onNavigate(MENU_ENGINEERING_ROUTE)} />
          </div>
        </>
      )}
    </article>
  );
}

function InventoryWatchlist({ items, tx, locale }: { items: InventorySummaryDto[]; tx: Tx; locale: string }) {
  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Inventory")} title={tx("Inventory watchlist")} subtitle={tx("Items at or below reorder level")} badge={items.length > 0 ? fmtNum(items.length, locale) : undefined} tone="warning" />
      {items.length === 0 ? <Empty text={tx("Inventory watchlist is clear.")} /> : (
        <div className="saas-table-wrap">
          <table className="saas-table">
            <thead><tr><th scope="col">{tx("Item")}</th><th scope="col">{tx("Location")}</th><th scope="col" className="is-num">{tx("On hand")}</th><th scope="col" className="is-num">{tx("Available")}</th><th scope="col" className="is-num">{tx("Reorder")}</th><th scope="col">{tx("Status")}</th></tr></thead>
            <tbody>{items.slice(0, 8).map((item, i) => {
              const available = num(item.availableQuantity ?? item.quantity); const reorder = num(item.reorderLevel);
              const tone: Tone = available <= 0 ? "danger" : available <= reorder ? "warning" : "success";
              return (
                <tr key={`${item.itemId ?? item.itemName}-${item.locationName ?? ""}-${i}`}>
                  <td><strong>{item.itemName}</strong><small>{item.uomCode ?? ""}</small></td>
                  <td>{item.locationName ?? "-"}</td>
                  <td className="is-num">{fmtNum(item.quantity, locale)}</td>
                  <td className="is-num">{fmtNum(available, locale)}</td>
                  <td className="is-num">{fmtNum(item.reorderLevel, locale)}</td>
                  <td><span className={`saas-chip is-${tone}`}>{tx(tone === "danger" ? "Out of stock" : tone === "warning" ? "Low" : "Healthy")}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function QuickActions({ actions, onNavigate, tx }: { actions: QuickAction[]; onNavigate: (path: string) => void; tx: Tx }) {
  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Shortcuts")} title={tx("Quick actions")} subtitle={tx("Start common workflows")} />
      <div className="saas-list">
        {actions.map((a) => (
          <RowLink key={a.href} icon={a.icon} title={tx(a.title)} detail={tx(a.sub)} onClick={() => onNavigate(a.href)} />
        ))}
      </div>
    </article>
  );
}

const HEALTH_TONE: Record<string, Tone> = { good: "success", watch: "warning", poor: "danger", none: "neutral" };
const HEALTH_LABEL: Record<string, string> = { good: "Healthy", watch: "Needs attention", poor: "At risk", none: "Not enough data" };
const INDICATOR_LABEL: Record<string, string> = { good: "On target", watch: "Watch", poor: "Off target", none: "No data" };

function formatIndicator(indicator: HealthIndicatorDto, money: Money, locale: string): string {
  if (indicator.value == null) return "–";
  switch (indicator.format) {
    case "percent": return fmtPct(indicator.value);
    case "money": return money(indicator.value);
    case "days": return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(indicator.value)} d`;
    default: return fmtNum(indicator.value, locale);
  }
}

function BusinessHealth({
  health, money, onNavigate, tx, locale,
}: { health: BusinessHealthDto; money: Money; onNavigate: (path: string) => void; tx: Tx; locale: string }) {
  const tone = HEALTH_TONE[health.status] ?? "neutral";
  const counts = (["good", "watch", "poor"] as const).map((status) => health.indicators.filter((i) => i.status === status).length);
  return (
    <article className="saas-card">
      <CardHeader eyebrow={tx("Scorecard")} title={tx("Business health")} subtitle={tx(health.periodNote)} />
      <div className="saas-health-score">
        <div className={`saas-score is-${tone}`} role="img" aria-label={`${tx("Health score")}: ${health.score ?? "-"} / 100, ${tx(HEALTH_LABEL[health.status] ?? "")}`}>
          <strong>{health.score ?? "–"}</strong><small>/100</small>
        </div>
        <div>
          <strong className={`saas-text-${tone}`}>{tx(HEALTH_LABEL[health.status] ?? health.status)}</strong>
          <p>
            {fmtNum(counts[0], locale)} {tx("on target")} · {fmtNum(counts[1], locale)} {tx("to watch")} · {fmtNum(counts[2], locale)} {tx("off target")}
          </p>
        </div>
      </div>
      <div className="saas-list">
        {health.indicators.map((indicator) => (
          <RowLink
            key={indicator.key}
            tone={HEALTH_TONE[indicator.status] ?? "neutral"}
            title={tx(indicator.label)}
            detail={`${tx("Target")}: ${tx(indicator.target)} · ${tx(indicator.detail)}`}
            chip={`${formatIndicator(indicator, money, locale)} · ${tx(INDICATOR_LABEL[indicator.status] ?? indicator.status)}`}
            onClick={indicator.route ? () => onNavigate(indicator.route!) : undefined}
          />
        ))}
      </div>
    </article>
  );
}

/** One clickable row; rows without an action render as plain text. */
function RowLink({
  title, detail, tone, icon, chip, chipTone, onClick,
}: { title: string; detail?: string; tone?: Tone; icon?: string; chip?: string; chipTone?: Tone; onClick?: () => void }) {
  const lead = icon
    ? <span className="saas-quick-icon"><i className={`ti ${icon}`} aria-hidden="true" /></span>
    : <span className={`saas-dot is-${tone ?? "info"}`} aria-hidden="true" />;
  const body = (
    <>
      {lead}
      <span><strong>{title}</strong>{detail ? <small>{detail}</small> : null}</span>
      {chip ? <span className={`saas-chip is-${chipTone ?? tone ?? "neutral"}`}>{chip}</span> : onClick ? <i className="ti ti-chevron-right" aria-hidden="true" /> : <span />}
    </>
  );
  if (!onClick) return <div className="saas-row">{body}</div>;
  return <button type="button" className="saas-row is-action" onClick={onClick}>{body}</button>;
}

function CardHeader({ eyebrow, title, subtitle, badge, tone = "info" }: { eyebrow: string; title: string; subtitle: string; badge?: string; tone?: string }) {
  return <div className="saas-card-header"><div><span className="saas-card-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div>{badge ? <span className={`saas-chip is-${tone}`}>{badge}</span> : null}</div>;
}
function Metric({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return <div className="saas-metric"><span>{label}</span><strong className={tone ? `is-${tone}` : undefined}>{value}</strong></div>;
}
function Queue({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return <div className={`saas-queue is-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}
function Empty({ text }: { text: string }) { return <div className="saas-empty">{text}</div>; }
