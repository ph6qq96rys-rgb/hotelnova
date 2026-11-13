import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Select } from "../../../components/ui/select";
import { EmptyState } from "../../../components/ui/Feedback";
import { getCateringEventJourney, listCateringEvents, type CateringEventDto, type CateringEventJourney, type CateringWorkflowStep } from "../api/cateringManagementApi";
import { EventsScreen } from "../sales/EventsScreen";
import { EventJourneyPanel } from "./EventJourneyPanel";
import { EventStagePanel, STAGE_TAB, type StageTab } from "./EventStagePanel";
import { cateringPath } from "../components/CateringLayout";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { formatDateTime, formatDay, readApiError } from "../sales/ui";
import { humanize } from "../sales/options";
import { appDayKey } from "./eventWorkspaceDates";
import "./event-workspace.css";

type Mode = "event" | "kitchen" | "finance" | "inventory";
type TabKey = "overview" | StageTab;
/** Links from before the stage tabs (sidebar areas, the workflow board) land on the stage and step they meant. */
const LEGACY_TAB: Record<string, { tab: TabKey; step: string }> = {
  logistics: { tab: "plan", step: "staffing-plan" }, kitchen: { tab: "plan", step: "production-plan" },
  stock: { tab: "plan", step: "reserve-stock" }, billing: { tab: "closeout", step: "final-bill" }, close: { tab: "closeout", step: "complete" },
};

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

/** The event's pages follow its stages; every team works from the same pages and sees the steps it can do. */
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview & payments" },
  { key: "plan", label: "1 · Plan" },
  { key: "deliver", label: "2 · Deliver" },
  { key: "closeout", label: "3 · Close out" },
];

/** Where each sidebar area opens when no page is chosen (the event area follows the event's current stage). */
const AREA_START: Record<Exclude<Mode, "event">, { tab: TabKey; step: string }> = {
  kitchen: { tab: "plan", step: "production-plan" }, inventory: { tab: "plan", step: "reserve-stock" }, finance: { tab: "closeout", step: "final-bill" },
};

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
 * Event workspace: one record per catering event. Its pages follow the event's stages (overview, plan, deliver,
 * close out); each stage is a numbered checklist whose steps open their tool in place. Sidebar areas open the
 * step they are about. The event stays selected across pages.
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

  // The event's checklist, from the server; it decides which steps are done and which stage is current.
  const [journey, setJourney] = useState<CateringEventJourney | null>(null), [journeyError, setJourneyError] = useState("");
  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) { setJourney(null); return; }
    const c = new AbortController();
    setJourneyError("");
    getCateringEventJourney(companyId, selectedId, c.signal)
      .then((j) => { if (!c.signal.aborted) setJourney(j); })
      .catch((e) => { if (!c.signal.aborted) setJourneyError(readApiError(e)); });
    return () => c.abort();
  }, [companyId, selectedId, revision]);

  const rawTab = params.get("tab");
  const legacy = rawTab ? LEGACY_TAB[rawTab] : undefined;
  const fallback: { tab: TabKey; step: string | null } = mode === "event"
    ? { tab: journey ? STAGE_TAB[journey.stage] ?? "plan" : "plan", step: null }
    : AREA_START[mode];
  const active: TabKey = legacy?.tab ?? (TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : fallback.tab);
  const openStep: string | null = params.has("step") ? params.get("step") : legacy?.step ?? (rawTab ? null : fallback.step);

  /** Same sidebar area, another page (and optionally a step) of the selected event. */
  const pageHref = (tab: TabKey, step?: string) => {
    const query = new URLSearchParams();
    if (selected) query.set("event", selected.id);
    query.set("tab", tab);
    if (step) query.set("step", step);
    return cateringPath(pathname, mode + "?" + query.toString());
  };
  const stepHref = (step: CateringWorkflowStep) => pageHref(STAGE_TAB[step.stage] ?? "closeout", step.key);
  const openStepHere = (key: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", active);
    next.set("step", key);
    setParams(next, { replace: true });
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
          <h1>{selected ? selected.eventNo + " · " + selected.customerName : (TABS.find((t) => t.key === active)?.label ?? "Events")}</h1>
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
        {selected && <EventJourneyPanel journey={journey} error={journeyError} eventId={selected.id}
          stageHref={(stage) => pageHref(STAGE_TAB[stage] ?? "closeout")} stepHref={stepHref} />}
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

          <nav className="ew-tabs" aria-label="Event pages">
            {TABS.map((t) => (
              <Link key={t.key} to={pageHref(t.key)} aria-current={t.key === active ? "page" : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>

          {active === "overview" && (
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
          {active !== "overview" && (
            <EventStagePanel
              event={selected}
              journey={journey}
              stage={active}
              openStep={openStep}
              onOpenStep={openStepHere}
              canOpen={canOpen}
              overviewHref={pageHref("overview")}
              onChanged={refresh}
            />
          )}
        </>
      )}
    </section>
  );
}
