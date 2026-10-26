import "../pages/catering-interactions.css";
import { formatAppDate } from "../../../shared/datetime/dateFormat";
import { http } from "../../../api/http";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { humanize } from "../sales/options";
import { readApiError } from "../sales/ui";
import { cateringPath } from "../components/CateringLayout";
import { appDayKey, appMonthKey, appMonthRange, weekdayNames } from "./eventWorkspaceDates";

type Row = {
  id: string;
  doc: string;
  reference: string;
  customer: string;
  service: string;
  date: string;
  venue: string;
  guests: number;
  status: string;
  value: number;
};
type Summary = { openOrders: number; upcomingGuests: number; upcomingEvents: number; contractedValue: number; awaitingDeposit: number };
type Page = { items: Row[]; total: number; summary: Summary };

const PAGE_SIZE = 25;
const ALL_PAGE_SIZE = 200;

/** Quotation and event statuses are different documents; the filter keeps them apart. */
const STATUS_GROUPS: Array<{ doc: "quotations" | "events"; label: string; statuses: string[] }> = [
  { doc: "quotations", label: "Quotations", statuses: ["draft", "submitted", "approved", "accepted", "rejected"] },
  {
    doc: "events",
    label: "Events",
    statuses: ["pendingDeposit", "confirmed", "inPlanning", "inExecution", "completed", "cancelled"],
  },
];

const EMPTY_SUMMARY: Summary = { openOrders: 0, upcomingGuests: 0, upcomingEvents: 0, contractedValue: 0, awaitingDeposit: 0 };

export function OrderPipeline({
  companyId,
  branchId,
  calendar = false,
}: {
  companyId: string;
  branchId: string;
  calendar?: boolean;
}) {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  // Filters live in the URL: Back, refresh and a shared link keep them.
  const search = params.get("q") ?? "";
  const statusFilter = params.get("status") ?? ""; // "doc:status"
  const month = params.get("month") ?? "";
  const venue = params.get("venue") ?? "";
  const layout = params.get("layout") === "board" ? "board" : "table";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const calendarMonth = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? (params.get("month") as string) : appMonthKey();

  // Typing is kept locally and written to the URL after a short pause.
  const [searchDraft, setSearchDraft] = useState(search);
  const [venueDraft, setVenueDraft] = useState(venue);
  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => setVenueDraft(venue), [venue]);

  function update(changes: Record<string, string | null>, resetPage = true) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) next.delete("page");
    setParams(next, { replace: true });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchDraft !== search || venueDraft !== venue) update({ q: searchDraft.trim() || null, venue: venueDraft.trim() || null });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft, venueDraft]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);

  const [docFilter, statusValue] = statusFilter.includes(":") ? statusFilter.split(":") : ["", ""];
  const queryParams = useMemo(() => {
    const selectedMonth = calendar ? calendarMonth : month;
    const range = selectedMonth ? appMonthRange(selectedMonth) : null;
    return {
      branchId: branchId || undefined,
      q: search || undefined,
      status: statusValue || undefined,
      venue: venue || undefined,
      from: range?.from.toISOString(),
      to: range?.to.toISOString(),
      doc: calendar ? "events" : docFilter || undefined,
    };
  }, [branchId, search, statusValue, venue, calendar, calendarMonth, month, docFilter]);

  /** Every matching row, page by page (board, calendar and export need the whole set). */
  async function loadAll(signal?: AbortSignal): Promise<Page> {
    const url = "/companies/" + companyId + "/operations-query/orders";
    const first = await http.get<Page>(url, { params: { ...queryParams, page: 1, pageSize: ALL_PAGE_SIZE }, signal });
    const items = [...first.data.items];
    for (let p = 2; items.length < first.data.total; p++) {
      const next = await http.get<Page>(url, { params: { ...queryParams, page: p, pageSize: ALL_PAGE_SIZE }, signal });
      if (!next.data.items.length) break;
      items.push(...next.data.items);
    }
    return { ...first.data, items };
  }

  const wantsAll = calendar || layout === "board";
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setLoading(true);
    if (!companyId) {
      setLoading(false);
      return;
    }
    const request = wantsAll
      ? loadAll(controller.signal)
      : http
          .get<Page>("/companies/" + companyId + "/operations-query/orders", {
            params: { ...queryParams, page, pageSize: PAGE_SIZE },
            signal: controller.signal,
          })
          .then((r) => r.data);
    request
      .then((data) => {
        if (controller.signal.aborted) return;
        setRows(data.items);
        setTotal(data.total);
        setSummary(data.summary);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setRows([]);
        setError(readApiError(e, "Unable to load orders."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, queryParams, page, wantsAll, revision]);

  const href = (r: Row) => cateringPath(pathname, "sales?doc=" + r.doc + "&id=" + encodeURIComponent(r.id));

  async function exportRows() {
    setExporting(true);
    try {
      const all = wantsAll ? rows : (await loadAll()).items;
      const cell = (v: unknown) =>
        '"' +
        String(v ?? "")
          .replace(/^[=+@-]/, "'$&")
          .replace(/"/g, '""') +
        '"';
      const csv = [
        ["Order", "Client", "Service", "Date", "Venue", "Guests", "Status", "Value"],
        ...all.map((r) => [r.reference, r.customer, r.service, r.date ? appDayKey(r.date) : "", r.venue, r.guests, r.status, r.value]),
      ]
        .map((r) => r.map(cell).join(","))
        .join("\r\n");
      const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "catering-orders.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(readApiError(e, "Unable to export orders."));
    } finally {
      setExporting(false);
    }
  }

  // Calendar grid: calendar dates in the business time zone, weeks starting on Monday.
  const [year, mm] = calendarMonth.split("-").map(Number);
  const dayCount = new Date(Date.UTC(year, mm, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, mm - 1, 1)).getUTCDay() + 6) % 7;
  const weekdays = weekdayNames(document.documentElement.lang || undefined);
  const today = appDayKey(new Date());
  const rowsByDay = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const key = appDayKey(r.date);
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return map;
  }, [rows]);

  const hasFilters = !!(search || statusFilter || month || venue);
  function shiftMonth(amount: number) {
    const next = new Date(Date.UTC(year, mm - 1 + amount, 1));
    update({ month: next.getUTCFullYear() + "-" + String(next.getUTCMonth() + 1).padStart(2, "0") });
  }
  const resetFilters = () => {
    setSearchDraft("");
    setVenueDraft("");
    update({ q: null, status: null, month: null, venue: null });
  };
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="co-workspace ci-pipeline">
      <header className="co-heading">
        <div>
          <span className="co-eyebrow">Catering / {calendar ? "Schedule" : "Overview"}</span>
          <h1>{calendar ? "Event calendar" : "Order pipeline"}</h1>
          <p>Plan the service. Keep every handoff in view.</p>
        </div>
        <div className="co-actions">
          <Button variant="outline" disabled={loading} onClick={() => setRevision((r) => r + 1)}>
            Refresh
          </Button>
          <Button variant="outline" disabled={loading || exporting || !!error || !total} onClick={() => void exportRows()}>
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
          <Link className="co-primary" to={cateringPath(pathname, "sales?doc=inquiries&new=1")}>
            + New inquiry
          </Link>
        </div>
      </header>
      {error && (
        <div role="alert" className="co-notice">
          {error}{" "}
          <Button variant="outline" disabled={loading} onClick={() => setRevision((r) => r + 1)}>
            Try again
          </Button>
        </div>
      )}
      {!calendar && (
        <section className="ci-next-steps" aria-label="Catering quick actions">
          <div>
            <span className="co-eyebrow">Your next step</span>
            <h2>From first inquiry to a memorable event</h2>
            <p>Open the workspace you need. Your records stay connected throughout the process.</p>
          </div>
          <div className="ci-step-links">
            {[
              ["01", "Prepare a menu", "Compose packages and review costs", "command?view=packages"],
              ["02", "Review quotations", "Follow up on pricing and approvals", "sales?doc=quotations"],
              ["03", "Plan the service", "See confirmed events on the calendar", "command?view=calendar"],
            ].map(([number, title, caption, target]) => (
              <Link key={number} to={cateringPath(pathname, target)}>
                <span>{number}</span>
                <div>
                  <strong>{title} →</strong>
                  <small>{caption}</small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="co-metrics">
        {[
          ["Open orders", summary.openOrders, "Quotes and events in progress"],
          ["Guests · next 7 days", summary.upcomingGuests, summary.upcomingEvents + " scheduled events"],
          ["Contracted value", formatCurrency(summary.contractedValue), "All non-cancelled events"],
          ["Awaiting deposit", summary.awaitingDeposit, "Follow up before service"],
        ].map(([label, value, caption]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{loading || error ? "—" : value}</strong>
            <small>{caption}</small>
          </article>
        ))}
      </div>
      {calendar ? (
        <section className="co-card">
          <div className="co-toolbar">
            <h2>Confirmed event schedule</h2>
            <div className="co-actions">
              <Button variant="outline" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                ← Previous
              </Button>
              <Button variant="outline" onClick={() => update({ month: appMonthKey() })}>
                This month
              </Button>
              <Button variant="outline" aria-label="Next month" onClick={() => shiftMonth(1)}>
                Next →
              </Button>
            </div>
            <label>
              Month
              <Input
                type="month"
                value={calendarMonth}
                required
                onChange={(e) => {
                  if (e.target.value) update({ month: e.target.value });
                }}
              />
            </label>
          </div>
          <div className="co-calendar">
            {weekdays.map((d) => (
              <strong key={d}>{d}</strong>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <div key={"blank" + i} />
            ))}
            {Array.from({ length: dayCount }, (_, i) => {
              const day = calendarMonth + "-" + String(i + 1).padStart(2, "0");
              return (
                <article key={day} className={today === day ? "ci-today" : undefined}>
                  <span>{i + 1}</span>
                  {(rowsByDay.get(day) ?? []).map((e) => (
                    <Link key={e.id} to={cateringPath(pathname, "sales?doc=events&id=" + e.id)}>
                      <strong>{e.customer}</strong>
                      <small>
                        {e.guests} guests · {humanize(e.status)}
                      </small>
                    </Link>
                  ))}
                </article>
              );
            })}
          </div>
          {loading ? (
            <p className="ci-help" role="status">
              Loading schedule…
            </p>
          ) : (
            !rows.length &&
            !error && (
              <p className="ci-help">
                No confirmed events this month. Browse another month or open quotations to plan your next event.
              </p>
            )
          )}
        </section>
      ) : (
        <section className="co-card">
          <div className="co-toolbar">
            <div className="co-view">
              <Button variant="ghost" aria-pressed={layout === "table"} onClick={() => update({ layout: null }, false)}>
                Table
              </Button>
              <Button variant="ghost" aria-pressed={layout === "board"} onClick={() => update({ layout: "board" }, false)}>
                Pipeline board
              </Button>
            </div>
            <span aria-live="polite">{loading ? "Updating orders…" : total + " orders"}</span>
          </div>
          <div className="co-filters">
            <Input
              aria-label="Search orders"
              placeholder="Search orders, clients or venues…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
            <Select aria-label="Order status" value={statusFilter} onChange={(e) => update({ status: e.target.value || null })}>
              <option value="">All quotations and events</option>
              {STATUS_GROUPS.map((g) => (
                <optgroup key={g.doc} label={g.label}>
                  <option value={g.doc + ":"}>All {g.label.toLowerCase()}</option>
                  {g.statuses.map((s) => (
                    <option key={s} value={g.doc + ":" + s}>
                      {humanize(s)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <Input aria-label="Event month" type="month" value={month} onChange={(e) => update({ month: e.target.value || null })} />
            <Input
              aria-label="Venue"
              placeholder="Venue"
              value={venueDraft}
              onChange={(e) => setVenueDraft(e.target.value)}
            />
            <Button variant="outline" onClick={resetFilters} disabled={!hasFilters}>
              Clear
            </Button>
          </div>
          {loading ? (
            <p className="co-empty" role="status">
              Loading orders…
            </p>
          ) : rows.length === 0 ? (
            <div className="co-empty">
              <h3>
                {error ? "Orders unavailable" : hasFilters ? "No matching orders" : "Your next event starts here"}
              </h3>
              <p>
                {hasFilters
                  ? "Try a different search or clear the filters."
                  : "Create an inquiry, prepare a quote, then confirm the event."}
              </p>
              {hasFilters ? (
                <Button variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                !error && (
                  <Link className="co-primary" to={cateringPath(pathname, "sales?doc=inquiries&new=1")}>
                    Create your first inquiry
                  </Link>
                )
              )}
            </div>
          ) : layout === "table" ? (
            <div className="co-table-wrap">
              <table className="co-table">
                <thead>
                  <tr>
                    {["Order", "Client / event", "Service", "Pax", "Status", "Value", ""].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={href(r)}>{r.reference}</Link>
                        <small>{r.date ? formatAppDate(r.date) : "Date pending"}</small>
                      </td>
                      <td>
                        <strong>{r.customer}</strong>
                        <small>{r.venue || "Venue pending"}</small>
                      </td>
                      <td>{r.service}</td>
                      <td>{r.guests}</td>
                      <td>
                        <span className={"co-pill co-status-" + r.status}>{humanize(r.status)}</span>
                      </td>
                      <td>{formatCurrency(r.value)}</td>
                      <td>
                        <Link aria-label={"Open " + r.reference} to={href(r)}>
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="co-board">
              {/* The board holds every matching order, so each column is the real pipeline stage. */}
              {STATUS_GROUPS.flatMap((g) => g.statuses)
                .filter((s) => rows.some((r) => r.status === s))
                .map((s) => (
                  <section key={s}>
                    <h3>
                      {humanize(s)} <small>{rows.filter((r) => r.status === s).length}</small>
                    </h3>
                    {rows
                      .filter((r) => r.status === s)
                      .map((r) => (
                        <Link key={r.id} to={href(r)}>
                          <small>{r.reference}</small>
                          <strong>{r.customer}</strong>
                          <span>
                            {r.guests} guests · {r.service}
                          </span>
                          <b>{formatCurrency(r.value)}</b>
                        </Link>
                      ))}
                  </section>
                ))}
            </div>
          )}
          {layout === "table" && (
            <footer className="co-toolbar">
              <span>
                Page {page} of {pageCount} · {PAGE_SIZE} orders per page
              </span>
              <div className="co-actions">
                <Button
                  variant="outline"
                  disabled={loading || page <= 1}
                  onClick={() => update({ page: page - 1 > 1 ? String(page - 1) : null }, false)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={loading || page >= pageCount}
                  onClick={() => update({ page: String(page + 1) }, false)}
                >
                  Next
                </Button>
              </div>
            </footer>
          )}
        </section>
      )}
    </section>
  );
}
