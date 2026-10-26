import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Select } from "../../../components/ui/select";
import { EmptyState } from "../../../components/ui/Feedback";
import { listCateringEvents, type CateringEventDto } from "../api/cateringManagementApi";
import { EventDocuments } from "./EventDocuments";
import { EventLifecycleCard, EventProfitabilityCard, EventStockWorkspace } from "./EventStock";
import { EventsScreen } from "../sales/EventsScreen";
import { EventJourneyPanel } from "./EventJourneyPanel";
import { CateringAccountingPanel } from "./CateringAccountingPanel";
import { cateringPath } from "../components/CateringLayout";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { formatDateTime, formatDay, readApiError } from "../sales/ui";
import { humanize } from "../sales/options";
import { appDayKey } from "./eventWorkspaceDates";
import "./event-workspace.css";

type Mode = "event" | "kitchen" | "finance" | "inventory";
type TabKey = "overview" | "logistics" | "kitchen" | "stock" | "billing" | "close";

const STATUSES = ["", "pendingDeposit", "confirmed", "inPlanning", "inExecution", "completed", "cancelled"];

/** Event status as a camelCase name, whether the API sent the enum number or its name. */
export function eventStatus(value: string | number): string {
  if (typeof value === "number") return STATUSES[value] ?? String(value);
  const text = String(value);
  return /^\d+$/.test(text) ? (STATUSES[Number(text)] ?? text) : text.charAt(0).toLowerCase() + text.slice(1);
}

const isClosed = (e: CateringEventDto) => ["completed", "cancelled"].includes(eventStatus(e.status));

/** Route permissions mirror routeConfig, so a tab is only offered where its page will open. */
const ROUTE_PERMISSIONS: Record<Mode, string[]> = {
  event: [
    "catering.events.manage", "catering.siv.manage", "catering.reservations.manage", "catering.dispatch.manage",
    "catering.returns.manage", "catering.waste.manage", "catering.waste.approve", "catering.reconciliation.manage",
    "catering.reconciliation.approve", "catering.staffing.manage", "catering.equipment.manage",
  ],
  kitchen: ["catering.production.manage", "catering.events.manage"],
  inventory: [
    "catering.reservations.manage", "catering.siv.manage", "catering.returns.manage", "catering.waste.manage",
    "catering.reconciliation.manage", "inventory.view",
  ],
  finance: ["catering.billing.manage", "catering.billing.approve", "catering.payments.manage", "catering.profitability.view"],
};

/** Tab labels are the sidebar labels, so the menu and the page always say the same thing. */
const TABS: Array<{ key: TabKey; label: string; mode: Mode }> = [
  { key: "overview", label: "Overview & payments", mode: "event" },
  { key: "logistics", label: "Staffing & logistics", mode: "event" },
  { key: "kitchen", label: "Kitchen production", mode: "kitchen" },
  { key: "stock", label: "Event stock", mode: "inventory" },
  { key: "billing", label: "Invoicing", mode: "finance" },
  { key: "close", label: "Close event", mode: "event" },
];

const DEFAULT_TAB: Record<Mode, TabKey> = { event: "logistics", kitchen: "kitchen", inventory: "stock", finance: "billing" };

/** The event to open when none is chosen: the next open one, else the latest still open, else the latest. */
function defaultEvent(events: CateringEventDto[]): CateringEventDto | null {
  const today = appDayKey(new Date());
  const byDate = [...events].sort((a, b) => a.eventDateUtc.localeCompare(b.eventDateUtc));
  const open = byDate.filter((e) => !isClosed(e));
  return (
    open.find((e) => appDayKey(e.eventDateUtc) >= today) ??
    open[open.length - 1] ??
    byDate[byDate.length - 1] ??
    null
  );
}

/**
 * Event workspace: one record per catering event, with its stage and every area of work as tabs
 * (the sidebar entries open the matching tab). The event stays selected across tabs.
 */
export function EventOperations({ companyId, branchId, mode }: { companyId: string; branchId: string; mode: Mode }) {
  const { pathname } = useLocation();
  const { hasPermission } = useAuth();
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState<CateringEventDto[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    setError("");
    setLoading(true);
    if (!companyId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    listCateringEvents(companyId, { branchId, signal: c.signal })
      .then((rows) => {
        if (!c.signal.aborted) setEvents(rows);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(readApiError(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [companyId, branchId, revision]);

  const requested = params.get("event");
  const selected = useMemo(
    () => events.find((e) => e.id === requested) ?? defaultEvent(events),
    [events, requested],
  );

  // Keep the chosen event in the URL so tabs, refresh and shared links open the same event.
  useEffect(() => {
    if (selected && selected.id !== requested) {
      const next = new URLSearchParams(params);
      next.set("event", selected.id);
      setParams(next, { replace: true });
    }
  }, [selected, requested, params, setParams]);

  const canOpen = (m: Mode) => ROUTE_PERMISSIONS[m].some((p) => hasPermission(p));
  const tabs = TABS.map((t) =>
    // Closing is also offered from invoicing to people who cannot open the logistics page.
    t.key === "close" && !canOpen("event") && canOpen("finance") ? { ...t, mode: "finance" as Mode } : t,
  ).filter((t) => t.mode === mode || canOpen(t.mode));
  const requestedTab = params.get("tab") as TabKey | null;
  const active =
    tabs.find((t) => t.key === requestedTab && t.mode === mode) ??
    tabs.find((t) => t.key === DEFAULT_TAB[mode]) ??
    tabs[0];

  const tabHref = (t: { key: TabKey; mode: Mode }) => {
    const query = new URLSearchParams();
    if (selected) query.set("event", selected.id);
    if (t.key !== DEFAULT_TAB[t.mode]) query.set("tab", t.key);
    return cateringPath(pathname, t.mode + "?" + query.toString());
  };

  const today = appDayKey(new Date());
  const groups = useMemo(() => {
    const byDate = [...events].sort((a, b) => a.eventDateUtc.localeCompare(b.eventDateUtc));
    const open = byDate.filter((e) => !isClosed(e));
    return [
      { label: "Upcoming", rows: open.filter((e) => appDayKey(e.eventDateUtc) >= today) },
      { label: "Past, still open", rows: open.filter((e) => appDayKey(e.eventDateUtc) < today).reverse() },
      {
        label: "Completed and cancelled",
        rows: byDate.filter((e) => isClosed(e) && (showClosed || e.id === selected?.id)).reverse(),
      },
    ].filter((g) => g.rows.length);
  }, [events, showClosed, selected?.id, today]);

  const refresh = () => setRevision((r) => r + 1);

  return (
    <section className="co-workspace">
      <header className="co-heading">
        <div>
          <h1>{selected ? selected.eventNo + " · " + selected.customerName : (active?.label ?? "Events")}</h1>
          <p>
            {selected
              ? selected.venueName + " · " + formatDateTime(selected.eventDateUtc)
              : "Every stage of a confirmed event, in one place."}
          </p>
        </div>
        <div className="co-actions">
          <Button variant="outline" disabled={loading} onClick={refresh}>
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <p role="alert" className="co-notice">
          {error}
        </p>
      )}

      <section className="co-card">
        <div className="co-toolbar">
          <label>
            Event
            <Select
              aria-label="Select event"
              disabled={loading || !events.length}
              value={selected?.id ?? ""}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.set("event", e.target.value);
                setParams(next);
              }}
            >
              {!events.length && <option value="">{loading ? "Loading events…" : "No confirmed events"}</option>}
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.rows.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.eventNo} · {e.customerName} · {formatDay(e.eventDateUtc)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </label>
          <label className="co-check">
            <Checkbox checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
            Show completed and cancelled
          </label>
        </div>
        {selected && <EventJourneyPanel companyId={companyId} eventId={selected.id} revision={revision} />}
      </section>

      {!loading && !events.length && !error && (
        <EmptyState
          title="No confirmed events yet"
          detail="Accept a quotation and confirm it to create the event; its work then appears here."
          action={
            <Link className="co-primary" to={cateringPath(pathname, "sales?doc=quotations")}>
              Open quotations
            </Link>
          }
        />
      )}

      {selected && (
        <>
          <div className="co-metrics">
            <article>
              <span>Venue</span>
              <strong className="ew-metric-text">{selected.venueName}</strong>
              <small>{formatDateTime(selected.eventDateUtc)}</small>
            </article>
            <article>
              <span>Guests</span>
              <strong>{selected.guestCount}</strong>
              <small>{humanize(String(selected.serviceStyle))}</small>
            </article>
            <article>
              <span>Contract value</span>
              <strong>{formatCurrency(selected.contractValue)}</strong>
              <small>{selected.quoteNoSnapshot}</small>
            </article>
            <article>
              <span>Balance</span>
              <strong>{formatCurrency(selected.remainingBalance)}</strong>
              <small>Payments recorded against the event</small>
            </article>
          </div>

          <nav className="ew-tabs" aria-label="Event areas">
            {tabs.map((t) => (
              <Link key={t.key} to={tabHref(t)} aria-current={t.key === active?.key ? "page" : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>

          {active?.key === "overview" && (
            <EventsScreen
              key={"overview" + selected.id}
              embedded
              companyId={companyId}
              branchId={branchId}
              selectedId={selected.id}
              onSelect={() => undefined}
              onChanged={refresh}
              confirmQuotationId={null}
              onConfirmConsumed={() => undefined}
            />
          )}
          {active?.key === "logistics" && <EventDocuments key={"event" + selected.id} event={selected} mode="event" />}
          {active?.key === "kitchen" && <EventDocuments key={"kitchen" + selected.id} event={selected} mode="kitchen" />}
          {active?.key === "stock" && !loading && (
            <EventStockWorkspace key={"stock" + selected.id} event={selected} onChanged={refresh} />
          )}
          {active?.key === "billing" && (
            <>
              <EventDocuments key={"finance" + selected.id} event={selected} mode="finance" />
              <EventProfitabilityCard key={"profit" + selected.id} event={selected} />
              <CateringAccountingPanel key={"accounting" + selected.id} companyId={companyId} eventId={selected.id} />
            </>
          )}
          {active?.key === "close" && (
            <EventLifecycleCard key={"life" + selected.id} event={selected} onChanged={refresh} />
          )}
        </>
      )}
    </section>
  );
}
