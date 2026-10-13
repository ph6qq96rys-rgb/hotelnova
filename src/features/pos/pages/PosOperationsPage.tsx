import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LayoutGrid,
  Lock,
  PauseCircle,
  Play,
  RefreshCw,
  Receipt,
  ShoppingCart,
  Wallet,
} from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { useAppScope } from "../../../app/useAppScope";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import { operationsApi } from "../../operations/api/operationsApi";
import type { SalesSummaryDto } from "../../operations/api/operationsTypes";
import { salesApi } from "../../sales/api/salesApi";
import type { SaleListItemDto } from "../../sales/api/salesTypes";
import { posApi } from "../api/posApi";
import { posDrawerApi, type DrawerDto } from "../api/posDrawerApi";
import { posServiceApi, type PosFloorDto, type PosTicketSummaryDto } from "../api/posServiceApi";
import { money } from "../components/posUi";
import type { BulkPostCogsResultDto } from "../types/posTypes";
import { minutesSince } from "../utils/posCart";
import { extractApiError } from "../utils/posUtils";
import "../pos-service.css";
import "../pos-control.css";

/* ─── Settings ──────────────────────────────────────────────────────────── */

const REFRESH_MS = 30_000;
/** A ticket open this long is flagged; twice as long is overdue. */
const TICKET_WARN_MIN = 60;
/** A drawer open longer than this probably was not closed at end of shift. */
const DRAWER_STALE_HOURS = 14;
const MAX_COGS_DAYS = 31;
/** Confirmed sales whose stock was not consumed yet (SaleStatus.Confirmed). */
const SALE_STATUS_CONFIRMED = 2;

/* ─── Dates ─────────────────────────────────────────────────────────────── */

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = () => isoDate(new Date());
const daysAgoIso = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return isoDate(d); };
const monthStartIso = () => { const d = new Date(); return isoDate(new Date(d.getFullYear(), d.getMonth(), 1)); };
const rangeDays = (from: string, to: string) => {
  const a = Date.parse(`${from}T00:00:00`), b = Date.parse(`${to}T00:00:00`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.floor((b - a) / 86_400_000) + 1 : 0;
};

function ageLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  return h < 24 ? `${h}h ${minutes % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}
const ageTone = (minutes: number) => (minutes >= TICKET_WARN_MIN * 2 ? "is-bad" : minutes >= TICKET_WARN_MIN ? "is-warn" : "");

/* ─── Data model ────────────────────────────────────────────────────────── */

/** One independently loaded source: a failure or missing permission never blanks the rest of the page. */
type Source<T> = { data: T | null; error: string | null; allowed: boolean };
const blank = <T,>(allowed: boolean): Source<T> => ({ data: null, error: null, allowed });

type Snapshot = {
  summary: Source<SalesSummaryDto>;
  floor: Source<PosFloorDto>;
  drawers: Source<DrawerDto[]>;
  pendingCogs: Source<{ items: SaleListItemDto[]; truncated: boolean }>;
};

type Alert = { id: string; tone: "bad" | "warn"; title: string; detail: string; action?: { label: string; run: () => void } };

/* ─── Small parts ───────────────────────────────────────────────────────── */

function Kpi({ label, value, hint, tone, meter }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warn" | "bad" | "muted"; meter?: number }) {
  return (
    <div className={`rpos-kpi${tone ? ` is-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
      {meter !== undefined ? <div className="rpos-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} /></div> : null}
    </div>
  );
}

function Panel({ title, badge, actions, children }: { title: string; badge?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rpos-panel" aria-label={title}>
      <header>
        <h2>{title} {badge}</h2>
        {actions ? <div className="rpos-chip-row">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

function SourceGate<T>({ source, need, children }: { source: Source<T>; need: string; children: (data: T) => ReactNode }) {
  const { tx } = useI18n();
  if (!source.allowed) return <p className="rpos-locked"><Lock size={14} aria-hidden="true" /> {tx("Requires the {permission} permission.", { permission: need })}</p>;
  if (source.error) return <StateMessage tone="error">{source.error}</StateMessage>;
  if (!source.data) return <p className="rpos-panel-empty">{tx("Loading...")}</p>;
  return <>{children(source.data)}</>;
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

/**
 * Live control view for the branch POS: today's takings, the floor, open cash drawers,
 * stock posting (COGS) and anything that needs a manager's attention. Every panel loads
 * on its own and refreshes on a timer; end-of-day close stays on the Operations dashboard.
 */
export function PosOperationsPage() {
  const { tx } = useI18n();
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => ({ companyId: companyId ?? "", branchId: branchId ?? "" }), [companyId, branchId]);
  const ready = !!scope.companyId && !!scope.branchId;

  const canSales = useHasPermission("sales.view");
  const canPostCogs = useHasPermission("sales.import");
  const canDrawers = useHasPermission("pos.session.approve");
  const canFloor = useHasPermission("pos.view");

  const [snap, setSnap] = useState<Snapshot>(() => ({
    summary: blank(canSales), floor: blank(canFloor), drawers: blank(canDrawers), pendingCogs: blank(canSales),
  }));
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [cogsFrom, setCogsFrom] = useState(todayIso());
  const [cogsTo, setCogsTo] = useState(todayIso());
  const [cogsRun, setCogsRun] = useState<{ status: "running" | "done" | "failed"; result?: BulkPostCogsResultDto; error?: string; at?: number } | null>(null);
  const [retrying, setRetrying] = useState<Record<string, "busy" | "ok" | string>>({});
  const loadSeq = useRef(0);

  const cogsDays = rangeDays(cogsFrom, cogsTo);
  const cogsRangeError = !cogsFrom || !cogsTo ? tx("Choose a start and end date.")
    : cogsDays < 1 ? tx("The start date is after the end date.")
    : cogsDays > MAX_COGS_DAYS ? tx("Post at most {days} days at a time.", { days: MAX_COGS_DAYS }) : "";

  const load = useCallback(async () => {
    if (!ready) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    const today = todayIso();
    const settle = async <T,>(allowed: boolean, fetch: () => Promise<T>, fallback: string): Promise<Source<T>> => {
      if (!allowed) return blank<T>(false);
      try { return { data: await fetch(), error: null, allowed }; }
      catch (err) { return { data: null, error: extractApiError(err, tx(fallback)), allowed }; }
    };
    const [summary, floor, drawers, pendingCogs] = await Promise.all([
      settle(canSales, async () => (await operationsApi.salesSummaryForBusinessDate(scope.companyId, scope.branchId, today)).data,
        "Today's sales could not be loaded."),
      settle(canFloor, () => posServiceApi.floor(scope), "The floor could not be loaded."),
      settle(canDrawers, () => posDrawerApi.list(scope, { status: "open" }), "Open drawers could not be loaded."),
      settle(canSales, async () => {
        const page = (await salesApi.list(scope.companyId, scope.branchId, {
          status: SALE_STATUS_CONFIRMED, fromDate: cogsFrom, toDate: cogsTo, page: 1, pageSize: 100,
        })).data;
        const items = (page?.items ?? []).filter((sale) => !sale.isInventoryPosted);
        return { items, truncated: (page?.totalCount ?? 0) > (page?.items?.length ?? 0) };
      }, "Unposted sales could not be loaded."),
    ]);
    if (seq !== loadSeq.current) return;
    setSnap({ summary, floor, drawers, pendingCogs });
    setUpdatedAt(Date.now());
    setNow(Date.now());
    setLoading(false);
  }, [ready, scope, canSales, canFloor, canDrawers, cogsFrom, cogsTo, tx]);

  useEffect(() => { void load(); }, [load]);

  // Poll while the tab is visible; catch up immediately when it becomes visible again.
  useEffect(() => {
    if (!autoRefresh) return;
    const tick = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(tick); document.removeEventListener("visibilitychange", onVisible); };
  }, [autoRefresh, load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(tick);
  }, []);

  /* ── Derived figures ── */
  const tables = useMemo(() => (snap.floor.data?.areas ?? []).flatMap((a) => a.tables.map((t) => ({ ...t, area: a.name }))), [snap.floor.data]);
  const openTickets = useMemo<Array<PosTicketSummaryDto & { age: number }>>(() => {
    const seated = tables.flatMap((t) => t.tickets);
    return [...seated, ...(snap.floor.data?.unseatedTickets ?? [])]
      .map((t) => ({ ...t, age: minutesSince(t.openedAtUtc, now) }))
      .sort((a, b) => b.age - a.age);
  }, [tables, snap.floor.data, now]);
  const occupied = tables.filter((t) => t.tickets.length > 0).length;
  const needsCleaning = tables.filter((t) => t.status === "needsCleaning");
  const openValue = openTickets.reduce((sum, t) => sum + t.subtotal, 0);
  const covers = openTickets.reduce((sum, t) => sum + (t.tableId ? t.guestCount : 0), 0);
  const lateTickets = openTickets.filter((t) => t.age >= TICKET_WARN_MIN);
  const drawers = snap.drawers.data ?? [];
  const variancePending = drawers.filter((d) => d.varianceStatus === "pending");
  const staleDrawers = drawers.filter((d) => minutesSince(d.openedAtUtc, now) >= DRAWER_STALE_HOURS * 60);
  const pendingSales = snap.pendingCogs.data?.items ?? [];
  const summary = snap.summary.data;
  const margin = summary && summary.netSales > 0 ? (summary.grossProfit / summary.netSales) * 100 : null;
  const paymentsTotal = (summary?.payments ?? []).reduce((sum, p) => sum + p.amount, 0);

  const go = (path: string) => navigate(`/companies/${companyId}/${path}`);

  const alerts = useMemo<Alert[]>(() => {
    const list: Alert[] = [];
    if (variancePending.length) list.push({
      id: "variance", tone: "bad",
      title: tx("{count} cash drawer(s) closed with a variance awaiting approval", { count: variancePending.length }),
      detail: variancePending.map((d) => `${d.cashierName} ${money(d.cashVariance)}`).join(" · "),
      action: { label: tx("Review drawers"), run: () => go("sales/pos/session") },
    });
    const overdue = lateTickets.filter((t) => t.age >= TICKET_WARN_MIN * 2);
    if (overdue.length) list.push({
      id: "overdue", tone: "bad",
      title: tx("{count} order(s) open for more than {hours} hours", { count: overdue.length, hours: (TICKET_WARN_MIN * 2) / 60 }),
      detail: overdue.slice(0, 4).map((t) => `${t.ticketNo}${t.tableLabel ? ` · ${t.tableLabel}` : ""} (${ageLabel(t.age)})`).join(", "),
      action: { label: tx("Held orders"), run: () => go("sales/pos/open-orders") },
    });
    if (pendingSales.length) list.push({
      id: "cogs", tone: "warn",
      title: tx("{count} sale(s) without stock posting (COGS)", { count: pendingSales.length }),
      detail: tx("Inventory and gross profit stay understated until these are posted."),
      action: canPostCogs ? { label: tx("Go to posting"), run: () => document.getElementById("rpos-cogs")?.scrollIntoView({ behavior: "smooth" }) } : undefined,
    });
    if (staleDrawers.length) list.push({
      id: "stale", tone: "warn",
      title: tx("{count} drawer(s) open for more than {hours} hours", { count: staleDrawers.length, hours: DRAWER_STALE_HOURS }),
      detail: staleDrawers.map((d) => `${d.cashierName}${d.terminal ? ` · ${d.terminal}` : ""}`).join(", "),
      action: { label: tx("Cash drawer"), run: () => go("sales/pos/session") },
    });
    if (needsCleaning.length) list.push({
      id: "clean", tone: "warn",
      title: tx("{count} table(s) waiting to be cleaned", { count: needsCleaning.length }),
      detail: needsCleaning.map((t) => t.number).join(", "),
      action: { label: tx("Open tables"), run: () => go("sales/pos/tables") },
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variancePending, lateTickets, pendingSales, staleDrawers, needsCleaning, canPostCogs, tx, companyId]);

  /* ── Stock posting ── */
  const runBulk = async () => {
    if (cogsRangeError || cogsRun?.status === "running") return;
    setCogsRun({ status: "running" });
    try {
      const result = await posApi.postBulkCogs(scope, cogsFrom, cogsTo);
      setCogsRun({ status: "done", result, at: Date.now() });
    } catch (err) {
      setCogsRun({ status: "failed", error: extractApiError(err, tx("Stock posting failed.")), at: Date.now() });
    } finally {
      void load();
    }
  };

  const retrySale = async (sale: SaleListItemDto) => {
    setRetrying((r) => ({ ...r, [sale.id]: "busy" }));
    try {
      await posApi.postSaleCogs(scope, sale.id);
      setRetrying((r) => ({ ...r, [sale.id]: "ok" }));
      void load();
    } catch (err) {
      setRetrying((r) => ({ ...r, [sale.id]: extractApiError(err, tx("Posting failed.")) }));
    }
  };

  const setRange = (from: string, to: string) => { setCogsFrom(from); setCogsTo(to); };
  const secondsAgo = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;

  if (!ready) {
    return (
      <main className="rpos-page rpos-shell ui-page">
        <PageHeader title={tx("POS Operations Control Center")} />
        <StateMessage tone="info">{tx("Select a company and branch to see POS operations.")}</StateMessage>
      </main>
    );
  }

  return (
    <main className="rpos-page rpos-shell ui-page">
      <PageHeader
        title={tx("POS Operations Control Center")}
        subtitle={tx("Live status of sales, tables, cash drawers and stock posting for this branch.")}
        actions={
          <div className="rpos-chip-row">
            <span className="rpos-live-meta" aria-live="polite">
              <span className={`rpos-live-dot${autoRefresh ? " is-on" : ""}`} aria-hidden="true" />
              {updatedAt === null ? tx("Loading...")
                : secondsAgo! < 10 ? tx("Updated just now")
                : secondsAgo! < 120 ? tx("Updated {s}s ago", { s: secondsAgo! })
                : tx("Updated {m} min ago", { m: Math.round(secondsAgo! / 60) })}
            </span>
            <Button type="button" size="sm" variant="outline" aria-pressed={autoRefresh} onClick={() => setAutoRefresh((x) => !x)}>
              {autoRefresh ? <><PauseCircle size={15} aria-hidden="true" /> {tx("Pause live")}</> : <><Play size={15} aria-hidden="true" /> {tx("Go live")}</>}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading} aria-busy={loading}>
              <RefreshCw size={15} aria-hidden="true" /> {tx("Refresh")}
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="rpos-kpis">
        <Kpi label={tx("Net sales today")} tone={!canSales ? "muted" : undefined}
          value={!canSales ? tx("No access") : summary ? money(summary.netSales) : "—"}
          hint={summary ? tx("{count} sales · gross {gross}", { count: summary.salesCount, gross: money(summary.grossSales) }) : undefined} />
        <Kpi label={tx("Gross profit")} tone={!canSales ? "muted" : margin !== null && margin < 0 ? "bad" : undefined}
          value={!canSales ? tx("No access") : summary ? money(summary.grossProfit) : "—"}
          hint={margin !== null ? tx("{pct}% margin · COGS {cogs}", { pct: margin.toFixed(1), cogs: money(summary!.totalCogs) }) : undefined}
          meter={margin !== null ? margin : undefined} />
        <Kpi label={tx("Open orders")} tone={!canFloor ? "muted" : lateTickets.length ? "warn" : undefined}
          value={!canFloor ? tx("No access") : snap.floor.data ? openTickets.length : "—"}
          hint={snap.floor.data ? tx("{value} on the bill · {late} over {min} min", { value: money(openValue), late: lateTickets.length, min: TICKET_WARN_MIN }) : undefined} />
        <Kpi label={tx("Tables in use")} tone={!canFloor ? "muted" : undefined}
          value={!canFloor ? tx("No access") : snap.floor.data ? `${occupied} / ${tables.length}` : "—"}
          hint={snap.floor.data ? tx("{covers} guests seated · {clean} to clean", { covers, clean: needsCleaning.length }) : undefined}
          meter={tables.length ? (occupied / tables.length) * 100 : undefined} />
        <Kpi label={tx("Open cash drawers")} tone={!canDrawers ? "muted" : variancePending.length ? "bad" : undefined}
          value={!canDrawers ? tx("No access") : snap.drawers.data ? drawers.length : "—"}
          hint={snap.drawers.data ? tx("{count} variance(s) pending", { count: variancePending.length }) : undefined} />
        <Kpi label={tx("Unposted stock (COGS)")} tone={!canSales ? "muted" : pendingSales.length ? "warn" : undefined}
          value={!canSales ? tx("No access") : snap.pendingCogs.data ? pendingSales.length : "—"}
          hint={snap.pendingCogs.data ? tx("sales in the selected period") : undefined} />
      </div>

      {/* Alerts */}
      <section aria-label={tx("Needs attention")}>
        {alerts.length === 0 ? (
          updatedAt ? <div className="rpos-alert-row is-ok"><CheckCircle2 size={18} aria-hidden="true" /><span>{tx("Nothing needs attention right now.")}</span></div> : null
        ) : (
          <ul className="rpos-alerts">
            {alerts.map((a) => (
              <li key={a.id} className={`rpos-alert-row is-${a.tone}`}>
                <AlertTriangle size={18} aria-hidden="true" />
                <span><strong>{a.title}</strong><small>{a.detail}</small></span>
                {a.action ? <Button type="button" size="sm" variant="outline" onClick={a.action.run}>{a.action.label}</Button> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rpos-cc-grid">
        <div className="rpos-cc-col">
          {/* Live service */}
          <Panel title={tx("Open orders, oldest first")}
            actions={<Button type="button" size="sm" variant="outline" onClick={() => go("sales/pos/tables")}><LayoutGrid size={14} aria-hidden="true" /> {tx("Live tables")}</Button>}>
            <SourceGate source={snap.floor} need="pos.view">
              {() => openTickets.length === 0 ? <p className="rpos-panel-empty">{tx("No open orders.")}</p> : (
                <ul className="rpos-list">
                  {openTickets.slice(0, 10).map((t) => (
                    <li key={t.id}>
                      <strong>{t.ticketNo} · {t.tableLabel ? `${tx("Table")} ${t.tableLabel}` : t.customerName || tx(t.orderType === "delivery" ? "Delivery" : t.orderType === "roomService" ? "Room service" : "Take-away")}</strong>
                      <small>{[t.areaName, t.waiterName || tx("No waiter"), tx("{n} items", { n: t.itemCount }), t.heldAtUtc ? tx("On hold") : null].filter(Boolean).join(" · ")}</small>
                      <span className="rpos-list-end">
                        <strong>{money(t.subtotal)}</strong>
                        <span className={`rpos-age ${ageTone(t.age)}`}><Clock3 size={11} aria-hidden="true" /> {ageLabel(t.age)}</span>
                      </span>
                    </li>
                  ))}
                  {openTickets.length > 10 ? <li><small>{tx("and {n} more", { n: openTickets.length - 10 })}</small></li> : null}
                </ul>
              )}
            </SourceGate>
          </Panel>

          {/* Stock posting */}
          <div id="rpos-cogs">
            <Panel title={tx("Stock posting (COGS)")}
              badge={pendingSales.length ? <span className="rpos-badge rpos-badge--bad">{pendingSales.length}</span> : <span className="rpos-badge rpos-badge--ok">{tx("Up to date")}</span>}>
              <p className="rpos-muted" style={{ margin: 0 }}>
                {tx("Sales whose recipe stock was not consumed at checkout, for example after a network drop or a missing recipe. Posting consumes FIFO stock and records cost of goods.")}
              </p>
              <div className="rpos-presets">
                <Button type="button" size="sm" variant="outline" onClick={() => setRange(todayIso(), todayIso())}>{tx("Today")}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setRange(daysAgoIso(1), daysAgoIso(1))}>{tx("Yesterday")}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setRange(daysAgoIso(6), todayIso())}>{tx("Last 7 days")}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setRange(monthStartIso(), todayIso())}>{tx("Month to date")}</Button>
              </div>
              <div className="rpos-range">
                <label className="rpos-field"><span>{tx("From")}</span><Input type="date" value={cogsFrom} max={cogsTo || undefined} onChange={(e) => setCogsFrom(e.target.value)} /></label>
                <label className="rpos-field"><span>{tx("To")}</span><Input type="date" value={cogsTo} min={cogsFrom || undefined} onChange={(e) => setCogsTo(e.target.value)} /></label>
              </div>
              {cogsRangeError ? <StateMessage tone="warning">{cogsRangeError}</StateMessage> : null}

              <SourceGate source={snap.pendingCogs} need="sales.view">
                {(data) => data.items.length === 0 ? <p className="rpos-panel-empty">{tx("Every confirmed sale in this period has its stock posted.")}</p> : (
                  <ul className="rpos-list">
                    {data.items.slice(0, 12).map((sale) => {
                      const state = retrying[sale.id];
                      return (
                        <li key={sale.id}>
                          <strong>{sale.saleNo}{sale.tableLabel ? ` · ${tx("Table")} ${sale.tableLabel}` : ""}</strong>
                          <small>{formatAppDateTime(sale.soldAtUtc)} · {tx("{n} items", { n: sale.itemCount })}{state && state !== "busy" && state !== "ok" ? ` · ${state}` : ""}</small>
                          <span className="rpos-list-end">
                            <strong>{money(sale.totalAmount)}</strong>
                            {canPostCogs ? (
                              <Button type="button" size="sm" variant="outline" disabled={state === "busy" || state === "ok"} onClick={() => void retrySale(sale)}>
                                {state === "busy" ? tx("Posting...") : state === "ok" ? tx("Posted") : tx("Post")}
                              </Button>
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                    {data.items.length > 12 || data.truncated ? <li><small>{tx("More sales are pending; use Post all to process the whole period.")}</small></li> : null}
                  </ul>
                )}
              </SourceGate>

              {canPostCogs ? (
                <Button type="button" disabled={!!cogsRangeError || cogsRun?.status === "running"} aria-busy={cogsRun?.status === "running"} onClick={() => void runBulk()}>
                  <Receipt size={15} aria-hidden="true" />
                  {cogsRun?.status === "running" ? tx("Posting...") : tx("Post all for {days} day(s)", { days: Math.max(cogsDays, 0) })}
                </Button>
              ) : <p className="rpos-locked"><Lock size={14} aria-hidden="true" /> {tx("Posting requires the {permission} permission.", { permission: "sales.import" })}</p>}

              {cogsRun?.status === "failed" ? <StateMessage tone="error">{cogsRun.error}</StateMessage> : null}
              {cogsRun?.status === "done" && cogsRun.result ? (
                <>
                  <div className="rpos-result" aria-live="polite">
                    <div><span>{tx("Posted")}</span><strong>{cogsRun.result.posted ?? 0}</strong></div>
                    <div><span>{tx("Skipped")}</span><strong>{cogsRun.result.skipped ?? 0}</strong></div>
                    <div className={(cogsRun.result.failed ?? 0) > 0 ? "is-bad" : ""}><span>{tx("Failed")}</span><strong>{cogsRun.result.failed ?? 0}</strong></div>
                  </div>
                  {(cogsRun.result.errors?.length ?? 0) > 0 ? (
                    <ul className="rpos-log" aria-label={tx("Posting errors")}>
                      {cogsRun.result.errors!.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  ) : null}
                  <small className="rpos-muted">{tx("Run at {time}", { time: new Date(cogsRun.at!).toLocaleTimeString() })}</small>
                </>
              ) : null}
            </Panel>
          </div>
        </div>

        <div className="rpos-cc-col">
          {/* Drawers */}
          <Panel title={tx("Open cash drawers")}
            actions={<Button type="button" size="sm" variant="outline" onClick={() => go("sales/pos/session")}><Wallet size={14} aria-hidden="true" /> {tx("Cash drawer")}</Button>}>
            <SourceGate source={snap.drawers} need="pos.session.approve">
              {(rows) => rows.length === 0 ? <p className="rpos-panel-empty">{tx("No drawers are open.")}</p> : (
                <ul className="rpos-list">
                  {rows.map((d) => {
                    const age = minutesSince(d.openedAtUtc, now);
                    return (
                      <li key={d.id}>
                        <strong>{d.cashierName}</strong>
                        <small>{[d.terminal, d.storeName, tx("float {amount}", { amount: money(d.openingFloat) })].filter(Boolean).join(" · ")}</small>
                        <span className="rpos-list-end">
                          {typeof d.expectedCash === "number" ? <strong>{money(d.expectedCash)}</strong> : null}
                          <span className={`rpos-age ${age >= DRAWER_STALE_HOURS * 60 ? "is-warn" : ""}`}>{tx("open {age}", { age: ageLabel(age) })}</span>
                          {d.pendingReturns > 0 ? <span className="rpos-age is-warn">{tx("{n} return(s) pending", { n: d.pendingReturns })}</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SourceGate>
          </Panel>

          {/* Payments */}
          <Panel title={tx("Payments today")}>
            <SourceGate source={snap.summary} need="sales.view">
              {(s) => s.payments.length === 0 ? <p className="rpos-panel-empty">{tx("No payments yet today.")}</p> : (
                <div className="rpos-bars">
                  {[...s.payments].sort((a, b) => b.amount - a.amount).map((p) => (
                    <div key={p.method} className="rpos-bar">
                      <span>{tx(p.method)} <small className="rpos-muted">×{p.count}</small></span>
                      <div className="rpos-bar-track" aria-hidden="true"><span style={{ width: `${paymentsTotal ? (p.amount / paymentsTotal) * 100 : 0}%` }} /></div>
                      <strong>{money(p.amount)}</strong>
                    </div>
                  ))}
                  <div className="rpos-bar" style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 8 }}>
                    <span>{tx("Discounts")}</span><span /><strong>{money(s.discount)}</strong>
                  </div>
                  <div className="rpos-bar"><span>{tx("Tax")}</span><span /><strong>{money(s.tax)}</strong></div>
                  <div className="rpos-bar"><span>{tx("Service")}</span><span /><strong>{money(s.serviceCharge)}</strong></div>
                </div>
              )}
            </SourceGate>
          </Panel>

          {/* Shortcuts */}
          <Panel title={tx("Go to")}>
            <div className="rpos-shortcuts">
              <Button type="button" variant="outline" className="rpos-shortcut" onClick={() => go("sales/pos")}><ShoppingCart size={16} aria-hidden="true" /> {tx("POS register")}</Button>
              <Button type="button" variant="outline" className="rpos-shortcut" onClick={() => go("sales/pos/tables")}><LayoutGrid size={16} aria-hidden="true" /> {tx("Tables")}</Button>
              <Button type="button" variant="outline" className="rpos-shortcut" onClick={() => go("sales/pos/open-orders")}><PauseCircle size={16} aria-hidden="true" /> {tx("Held orders")}</Button>
              <Button type="button" variant="outline" className="rpos-shortcut" onClick={() => go("sales/pos/session")}><Banknote size={16} aria-hidden="true" /> {tx("Cash drawer")}</Button>
              <Button type="button" variant="outline" className="rpos-shortcut" onClick={() => go("sales/operations")}><ClipboardList size={16} aria-hidden="true" /> {tx("End of day")}</Button>
              <Button type="button" variant="outline" className="rpos-shortcut" onClick={() => go("sales/reports")}><Receipt size={16} aria-hidden="true" /> {tx("Sales reports")}</Button>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
