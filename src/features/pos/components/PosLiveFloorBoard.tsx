import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, PauseCircle, Play, RefreshCw, Search, Sparkles, Users } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { StateMessage } from "../../../components/ui/Feedback";
import { useI18n } from "../../../i18n";
import {
  posServiceApi,
  type PosActorDto,
  type PosFloorDto,
  type PosScope,
  type PosWaiterDto,
  type TableFloorStatus,
} from "../api/posServiceApi";
import { minutesSince } from "../utils/posCart";
import { isMine, TABLE_STATUS_TEXT } from "../utils/posTables";
import { extractApiError } from "../utils/posUtils";
import { money } from "./posUi";
import { PosTableActionsDialog, type BoardTable } from "./PosTableActionsDialog";

const REFRESH_MS = 20_000;
const LATE_MIN = 60;
const STATUSES: TableFloorStatus[] = ["available", "occupied", "held", "reserved", "needsCleaning", "unavailable"];

const age = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`);

/**
 * Live view of every table in the branch for floor managers: status, guests, waiter,
 * seated time and running bill, refreshed on a timer. Clicking a table opens its actions.
 */
export function PosLiveFloorBoard({ scope, companyId }: { scope: PosScope; companyId: string }) {
  const { tx } = useI18n();
  const navigate = useNavigate();
  const ready = !!scope.companyId && !!scope.branchId;

  const [floor, setFloor] = useState<PosFloorDto | null>(null);
  const [actor, setActor] = useState<PosActorDto | null>(null);
  const [waiters, setWaiters] = useState<PosWaiterDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const [areaId, setAreaId] = useState("all");
  const [status, setStatus] = useState<TableFloorStatus | "all" | "late" | "mine">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!ready) { setLoading(false); return; }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    try {
      const next = await posServiceApi.floor(scope, controller.signal);
      if (controller.signal.aborted) return;
      setFloor(next);
      setError(null);
      setNow(Date.now());
    } catch (err) {
      if (!controller.signal.aborted) setError(extractApiError(err, tx("The floor could not be loaded.")));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [ready, scope, tx]);

  useEffect(() => {
    void load();
    if (!ready) return;
    posServiceApi.me(scope).then(setActor).catch(() => setActor(null));
    posServiceApi.waiters(scope).then(setWaiters).catch(() => setWaiters([]));
    return () => abort.current?.abort();
  }, [load, ready, scope]);

  useEffect(() => {
    if (!live) return;
    const tick = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(tick); document.removeEventListener("visibilitychange", onVisible); };
  }, [live, load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(tick);
  }, []);

  const tables = useMemo<BoardTable[]>(
    () => (floor?.areas ?? []).flatMap((a) => a.tables.map((t) => ({ ...t, area: a.name, areaId: a.id }))),
    [floor],
  );
  const oldest = (t: BoardTable) => t.tickets.reduce((max, k) => Math.max(max, minutesSince(k.openedAtUtc, now)), 0);

  const counts = useMemo(() => {
    const by = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<TableFloorStatus, number>;
    for (const t of tables) by[t.status] = (by[t.status] ?? 0) + 1;
    return by;
  }, [tables]);
  const seated = tables.filter((t) => t.tickets.length > 0);
  const covers = seated.reduce((sum, t) => sum + t.tickets.reduce((s, k) => s + k.guestCount, 0), 0);
  const seats = tables.filter((t) => t.status !== "unavailable").reduce((sum, t) => sum + t.seats, 0);
  const openValue = seated.reduce((sum, t) => sum + t.tickets.reduce((s, k) => s + k.subtotal, 0), 0);
  const lateCount = seated.filter((t) => oldest(t) >= LATE_MIN).length;

  const term = search.trim().toLowerCase();
  const visible = tables.filter((t) =>
    (areaId === "all" || t.areaId === areaId) &&
    (status === "all" ? true
      : status === "late" ? oldest(t) >= LATE_MIN
      : status === "mine" ? t.tickets.some((k) => isMine(k, actor))
      : t.status === status) &&
    (!term || t.number.toLowerCase().includes(term) || t.tickets.some((k) => (k.waiterName ?? "").toLowerCase().includes(term) || k.ticketNo.toLowerCase().includes(term))));
  const visibleAreas = (floor?.areas ?? []).filter((a) => visible.some((t) => t.areaId === a.id));
  const selected = tables.find((t) => t.id === selectedId) ?? null;

  const openInPos = (ticketId: string) => navigate(`/companies/${companyId}/sales/pos?ticket=${ticketId}`);

  return (
    <section className="rpos-floor" aria-label={tx("Live tables")}>
      <div className="rpos-kpis">
        <div className="rpos-kpi"><span>{tx("Tables in use")}</span><strong>{seated.length} / {tables.length}</strong>
          <div className="rpos-meter" aria-hidden="true"><span style={{ width: `${tables.length ? (seated.length / tables.length) * 100 : 0}%` }} /></div></div>
        <div className="rpos-kpi"><span>{tx("Guests seated")}</span><strong>{covers}</strong><small>{tx("of {seats} seats", { seats })}</small></div>
        <div className="rpos-kpi"><span>{tx("Open bills")}</span><strong>{money(openValue)}</strong></div>
        <div className={`rpos-kpi${lateCount ? " is-warn" : ""}`}><span>{tx("Seated over {min} min", { min: LATE_MIN })}</span><strong>{lateCount}</strong></div>
        <div className={`rpos-kpi${counts.needsCleaning ? " is-warn" : ""}`}><span>{tx("Needs cleaning")}</span><strong>{counts.needsCleaning}</strong></div>
      </div>

      <div className="rpos-board-tools">
        <div className="rpos-chip-row" role="tablist" aria-label={tx("Dining areas")}>
          <Button type="button" size="sm" role="tab" aria-selected={areaId === "all"} variant={areaId === "all" ? "default" : "outline"} onClick={() => setAreaId("all")}>{tx("All areas")}</Button>
          {(floor?.areas ?? []).map((a) => (
            <Button key={a.id} type="button" size="sm" role="tab" aria-selected={areaId === a.id} variant={areaId === a.id ? "default" : "outline"} onClick={() => setAreaId(a.id)}>
              {a.name} <small className="rpos-muted">{a.tables.length}</small>
            </Button>
          ))}
        </div>
        <div className="rpos-chip-row">
          <span className="rpos-live-meta"><span className={`rpos-live-dot${live ? " is-on" : ""}`} aria-hidden="true" />{live ? tx("Live") : tx("Paused")}</span>
          <Button type="button" size="sm" variant="outline" aria-pressed={live} onClick={() => setLive((x) => !x)}>
            {live ? <PauseCircle size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />} {live ? tx("Pause") : tx("Go live")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading} aria-busy={loading}>
            <RefreshCw size={15} aria-hidden="true" /> {tx("Refresh")}
          </Button>
        </div>
      </div>

      <div className="rpos-board-tools">
        <div className="rpos-chip-row" role="radiogroup" aria-label={tx("Filter by status")}>
          <Button type="button" size="sm" role="radio" aria-checked={status === "all"} variant={status === "all" ? "default" : "outline"} onClick={() => setStatus("all")}>
            {tx("All")} · {tables.length}
          </Button>
          {STATUSES.map((s) => (
            <Button key={s} type="button" size="sm" role="radio" aria-checked={status === s} className={`rpos-status-chip rpos-table--${s}`}
              variant={status === s ? "default" : "outline"} onClick={() => setStatus(status === s ? "all" : s)}>
              {tx(TABLE_STATUS_TEXT[s])} · {counts[s] ?? 0}
            </Button>
          ))}
          <Button type="button" size="sm" role="radio" aria-checked={status === "late"} variant={status === "late" ? "default" : "outline"} onClick={() => setStatus(status === "late" ? "all" : "late")}>
            <Clock3 size={14} aria-hidden="true" /> {tx("Late")} · {lateCount}
          </Button>
          {actor ? (
            <Button type="button" size="sm" role="radio" aria-checked={status === "mine"} variant={status === "mine" ? "default" : "outline"} onClick={() => setStatus(status === "mine" ? "all" : "mine")}>
              {tx("My tables")}
            </Button>
          ) : null}
        </div>
        <label className="rpos-menu-search rpos-board-search">
          <Search size={15} aria-hidden="true" />
          <Input value={search} placeholder={tx("Table, waiter, ticket")} aria-label={tx("Search tables")} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      {error ? <StateMessage tone="error" action={<Button type="button" size="sm" variant="outline" onClick={() => void load()}>{tx("Retry")}</Button>}>{error}</StateMessage> : null}
      {notice ? <div className="rpos-notice rpos-notice--ok" role="status"><Sparkles size={16} aria-hidden="true" /><span>{notice}</span>
        <Button type="button" size="sm" variant="ghost" onClick={() => setNotice(null)}>{tx("Dismiss")}</Button></div> : null}

      {!loading && !error && tables.length === 0 ? (
        <div className="rpos-empty">
          <strong>{tx("No tables are set up for this branch yet.")}</strong>
          <span>{tx("Add dining areas and tables on the Setup tab.")}</span>
        </div>
      ) : null}
      {tables.length > 0 && visible.length === 0 ? <p className="rpos-panel-empty">{tx("No tables match these filters.")}</p> : null}

      {visibleAreas.map((area) => (
        <div key={area.id} className="rpos-area">
          <h3>{area.name}</h3>
          <div className="rpos-board-grid">
            {visible.filter((t) => t.areaId === area.id).map((t) => {
              const mins = oldest(t);
              const guests = t.tickets.reduce((s, k) => s + k.guestCount, 0);
              const total = t.tickets.reduce((s, k) => s + k.subtotal, 0);
              const waitersText = [...new Set(t.tickets.map((k) => k.waiterName).filter(Boolean))].join(", ");
              const late = mins >= LATE_MIN;
              return (
                <Button key={t.id} type="button" variant="outline"
                  className={`rpos-board-table rpos-board-table--${t.status}${mins >= LATE_MIN * 2 ? " is-late" : ""}`}
                  aria-label={`${tx("Table")} ${t.number}, ${tx(TABLE_STATUS_TEXT[t.status])}${waitersText ? `, ${waitersText}` : ""}${t.tickets.length ? `, ${age(mins)}, ${money(total)}` : ""}`}
                  onClick={() => setSelectedId(t.id)}>
                  <span className="rpos-table-head">
                    <strong>{t.number}</strong>
                    <span><Users size={13} aria-hidden="true" /> {t.tickets.length ? `${guests}/${t.seats}` : t.seats}</span>
                  </span>
                  <span className="rpos-board-body">
                    <span className="rpos-board-state">{tx(TABLE_STATUS_TEXT[t.status])}</span>
                    {t.tickets.length ? (
                      <>
                        <span>{waitersText || tx("No waiter")}</span>
                        {t.tickets.length > 1 ? <span className="rpos-muted">{tx("{count} tickets", { count: t.tickets.length })}</span> : null}
                      </>
                    ) : t.serviceNote ? <span className="rpos-muted" title={t.serviceNote}>{t.serviceNote}</span> : null}
                  </span>
                  {t.tickets.length ? (
                    <span className="rpos-board-foot">
                      <span className={`rpos-age ${mins >= LATE_MIN * 2 ? "is-bad" : late ? "is-warn" : ""}`}><Clock3 size={12} aria-hidden="true" /> {age(mins)}</span>
                      <strong>{money(total)}</strong>
                    </span>
                  ) : <span />}
                  {late ? <span className={`rpos-age-bar${mins >= LATE_MIN * 2 ? " is-bad" : ""}`} aria-hidden="true" /> : null}
                </Button>
              );
            })}
          </div>
        </div>
      ))}

      <PosTableActionsDialog
        scope={scope}
        table={selected}
        tables={tables}
        actor={actor}
        waiters={waiters}
        now={now}
        onClose={() => setSelectedId(null)}
        onChanged={(message) => { setSelectedId(null); setNotice(message); void load(); void posServiceApi.waiters(scope).then(setWaiters).catch(() => undefined); }}
        onOpenInPos={openInPos}
      />
    </section>
  );
}
