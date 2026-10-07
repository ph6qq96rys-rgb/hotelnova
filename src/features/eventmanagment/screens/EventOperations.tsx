import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { listCateringEvents, type CateringEventDto } from "../api/cateringManagementApi";
import { EventDocuments } from "./EventDocuments";
import { EventLifecycleCard, EventProfitabilityCard, EventStockWorkspace } from "./EventStock";
import { cateringPath } from "../components/CateringLayout";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { formatDateTime, formatDay, readApiError } from "../sales/ui";
import { humanize } from "../sales/options";
export function EventOperations({
  companyId,
  branchId,
  mode,
}: {
  companyId: string;
  branchId: string;
  mode: "event" | "kitchen" | "finance" | "inventory";
}) {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState<CateringEventDto[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setEvents([]);
    setError("");
    setLoading(true);
    if (!companyId) {
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
  const selected = events.find((e) => e.id === params.get("event")) ?? events[0] ?? null;
  const title =
    mode === "event"
      ? "Staffing & logistics"
      : mode === "kitchen"
        ? "Production plan"
        : mode === "inventory"
          ? "Event stock"
          : "Invoicing";
  return (
    <section className="co-workspace">
      <header className="co-heading">
        <div>
          <span className="co-eyebrow">Catering / Event operations</span>
          <h1>{title}</h1>
          <p>
            {mode === "event"
              ? "Coordinate people, equipment and deliveries."
              : mode === "kitchen"
                ? "Turn the accepted menu into a working kitchen schedule."
                : mode === "inventory"
                  ? "Reserve, issue, return, write off and reconcile the event's stock."
                  : "Prepare, approve and issue the event bill."}
          </p>
        </div>
        <div className="co-actions">
          <button disabled={loading} onClick={() => setRevision((r) => r + 1)}>
            Refresh events
          </button>
          <Link
            className="co-primary"
            to={cateringPath(pathname, selected ? "sales?doc=events&id=" + selected.id : "sales?doc=events")}
          >
            {mode === "finance" ? "Payments & event details" : "Event details"} →
          </Link>
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
            <select
              aria-label="Select confirmed event"
              disabled={loading}
              value={selected?.id ?? ""}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.set("event", e.target.value);
                setParams(next);
              }}
            >
              {!events.length && <option value="">{loading ? "Loading events..." : "No confirmed events"}</option>}
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.eventNo} · {e.customerName} · {formatDay(e.eventDateUtc)}
                </option>
              ))}
            </select>
          </label>
          {selected && <span className="co-pill">{humanize(String(selected.status))}</span>}
        </div>
      </section>
      {selected && (
        <div className="co-metrics">
          <article>
            <span>Venue</span>
            <strong style={{ fontSize: 19 }}>{selected.venueName}</strong>
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
      )}
      {selected && (mode === "event" || mode === "finance") && (
        <EventLifecycleCard key={"life" + selected.id} event={selected} onChanged={() => setRevision((r) => r + 1)} />
      )}
      {!loading && mode === "inventory" && selected && (
        <EventStockWorkspace key={"stock" + selected.id} event={selected} onChanged={() => setRevision((r) => r + 1)} />
      )}
      {!loading && mode !== "inventory" && (
        <EventDocuments key={mode + (selected?.id ?? "none")} event={selected} mode={mode} />
      )}
      {selected && mode === "finance" && <EventProfitabilityCard key={"profit" + selected.id} event={selected} />}
    </section>
  );
}
