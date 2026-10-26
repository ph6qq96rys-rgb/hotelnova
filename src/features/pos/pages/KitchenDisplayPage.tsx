import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Printer, RefreshCw, RotateCcw } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Select } from "../../../components/ui/select";
import { useAppScope } from "../../../app/useAppScope";
import { useI18n } from "../../../i18n";
import { kitchenApi, type KitchenOrderDto, type PrepStationDto } from "../api/posDevicesApi";
import { extractApiError } from "../utils/posUtils";
import "../pos-service.css";
import "../pos-kitchen.css";

const POLL_MS = 5000;
const LATE_MINUTES = 10;
const OVERDUE_MINUTES = 20;
const STATION_KEY = "fnb.kds.station";

const STATUS_TEXT: Record<string, string> = { new: "New", inprogress: "Cooking", ready: "Ready", served: "Served", voided: "Voided" };
const ORDER_TYPE_TEXT: Record<string, string> = { dineIn: "Dine In", takeAway: "Take Away", delivery: "Delivery", roomService: "Room Service" };

function age(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function readStation() {
  try { return window.localStorage.getItem(STATION_KEY) ?? ""; } catch { return ""; }
}

/**
 * Kitchen display: every order sent to a preparation station, oldest first, with its age.
 * Cooks bump orders from new to cooking, ready and served; a ready or served order can be recalled.
 */
export function KitchenDisplayPage() {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => ({ companyId: companyId ?? "", branchId: branchId ?? "" }), [companyId, branchId]);
  const [stations, setStations] = useState<PrepStationDto[]>([]);
  const [stationId, setStationId] = useState(readStation);
  const [orders, setOrders] = useState<KitchenOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!scope.companyId || !scope.branchId) return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    try {
      const rows = await kitchenApi.orders(scope, stationId || null, controller.signal);
      setOrders(rows);
      setFetchedAt(Date.now());
      setError(null);
    } catch (err) {
      if (!controller.signal.aborted) setError(extractApiError(err, tx("Kitchen orders could not be loaded.")));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [scope, stationId, tx]);

  useEffect(() => {
    if (!scope.companyId || !scope.branchId) return;
    kitchenApi.stations(scope).then(setStations).catch((err) => setError(extractApiError(err, tx("Stations could not be loaded."))));
  }, [scope, tx]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, POLL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(poll); window.clearInterval(tick); inFlight.current?.abort(); };
  }, [load]);

  const chooseStation = (id: string) => {
    setStationId(id);
    try { window.localStorage.setItem(STATION_KEY, id); } catch { /* the choice is a convenience only */ }
  };

  const bump = async (order: KitchenOrderDto, action: "start" | "ready" | "served" | "recall") => {
    setBusyId(order.id);
    try {
      const updated = await kitchenApi.bump(scope, order.id, action, order.version);
      setOrders((rows) => rows.map((x) => (x.id === updated.id ? updated : x)).filter((x) => x.status !== "served" || action === "served"));
      if (action === "served") void load();
    } catch (err) {
      setError(extractApiError(err, tx("The order could not be updated.")));
      void load();
    } finally {
      setBusyId(null);
    }
  };

  const reprint = async (order: KitchenOrderDto) => {
    setBusyId(order.id);
    try { await kitchenApi.reprint(scope, order.id); } catch (err) { setError(extractApiError(err, tx("The order could not be reprinted."))); } finally { setBusyId(null); }
  };

  const drift = Math.floor((now - fetchedAt) / 1000);
  const active = orders.filter((x) => x.status !== "served" && x.status !== "voided");
  const served = orders.filter((x) => x.status === "served");
  const stationName = (id: string) => stations.find((s) => s.id === id)?.name ?? "";

  const card = (order: KitchenOrderDto) => {
    const seconds = order.status === "served" ? order.ageSeconds : order.ageSeconds + drift;
    const minutes = seconds / 60;
    const tone = order.status === "ready" ? " is-ready" : order.status === "served" ? "" : minutes >= OVERDUE_MINUTES ? " is-overdue" : minutes >= LATE_MINUTES ? " is-late" : "";
    const busy = busyId === order.id;
    return (
      <article key={order.id} className={`rpos-kds-card${tone}`} aria-label={`${tx("Order")} ${order.orderNo}`}>
        <header>
          <h3>{order.tableLabel ? `${tx("Table")} ${order.tableLabel}` : order.orderNo}</h3>
          <span className="rpos-kds-age" title={tx("Time since the order was sent")}>{age(Math.max(0, seconds))}</span>
        </header>
        <p className="rpos-muted">
          {order.orderNo} · {tx(ORDER_TYPE_TEXT[order.orderType] ?? order.orderType)}
          {order.guestCount ? ` · ${tx("{count} guests", { count: order.guestCount })}` : ""}
          {!stationId ? ` · ${stationName(order.stationId) || order.stationName}` : ""}
        </p>
        <p className="rpos-muted">{order.waiterName ? `${tx("Server")}: ${order.waiterName}` : `${tx("Sent by")} ${order.sentByName}`} · <strong>{tx(STATUS_TEXT[order.status] ?? order.status)}</strong></p>
        <ul>
          {order.lines.map((line) => (
            <li key={line.id} className={line.isVoided ? "is-voided" : ""}>
              {line.quantity} × {line.itemName}
              {line.note ? <small>{line.note}</small> : null}
              {line.isVoided ? <small>{tx("Voided")}: {line.voidReason}</small> : null}
            </li>
          ))}
        </ul>
        {order.note ? <p className="rpos-muted">{tx("Note")}: {order.note}</p> : null}
        <div className="rpos-kds-actions">
          {order.status === "new" ? <Button type="button" size="sm" disabled={busy} onClick={() => void bump(order, "start")}>{tx("Start")}</Button> : null}
          {order.status === "new" || order.status === "inprogress" ? <Button type="button" size="sm" variant={order.status === "new" ? "outline" : "default"} disabled={busy} onClick={() => void bump(order, "ready")}>{tx("Ready")}</Button> : null}
          {order.status === "ready" ? <Button type="button" size="sm" disabled={busy} onClick={() => void bump(order, "served")}>{tx("Served")}</Button> : null}
          {order.status === "ready" || order.status === "served" ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void bump(order, "recall")}><RotateCcw size={14} aria-hidden="true" /> {tx("Recall")}</Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void reprint(order)} aria-label={`${tx("Reprint")} ${order.orderNo}`}><Printer size={14} aria-hidden="true" /></Button>
        </div>
      </article>
    );
  };

  return (
    <main className="rpos-page ui-page rpos-kds">
      <PageHeader title={tx("Kitchen display")} subtitle={tx("Orders sent to the kitchen and bar, oldest first. Bump each order as it is cooked, ready and served.")}
        actions={<Button type="button" variant="outline" onClick={() => void load()}><RefreshCw size={15} aria-hidden="true" /> {tx("Refresh")}</Button>} />
      <div className="rpos-kds-toolbar">
        <label className="rpos-field">
          <span>{tx("Station")}</span>
          <Select value={stationId} onChange={(e) => chooseStation(e.target.value)}>
            <option value="">{tx("All stations")}</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </label>
        <span className="rpos-muted">{tx("{count} open orders", { count: active.length })}</span>
      </div>
      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">{tx("Loading kitchen orders...")}</StateMessage> : null}
      {!loading && stations.length === 0 ? <StateMessage tone="info">{tx("No preparation stations are set up for this branch. Add them under POS Devices.")}</StateMessage> : null}
      {!loading && stations.length > 0 && active.length === 0 ? <StateMessage tone="info">{tx("No open orders.")}</StateMessage> : null}
      <section className="rpos-kds-board" aria-label={tx("Open orders")}>{active.map(card)}</section>
      {served.length ? (
        <details>
          <summary>{tx("Served in the last 15 minutes")} · {served.length}</summary>
          <section className="rpos-kds-board">{served.map(card)}</section>
        </details>
      ) : null}
    </main>
  );
}
