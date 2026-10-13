import { useEffect, useId, useMemo, useState } from "react";
import { ArrowRightLeft, Clock3, ExternalLink, PauseCircle, UserPlus, Users } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { StateMessage } from "../../../components/ui/Feedback";
import { useDialogFocus } from "../../../components/ui/useDialogFocus";
import { useI18n } from "../../../i18n";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import {
  posServiceApi,
  waiterKey,
  type PosActorDto,
  type PosFloorTableDto,
  type PosScope,
  type PosTicketSummaryDto,
  type PosWaiterDto,
  type TableServiceState,
} from "../api/posServiceApi";
import { minutesSince } from "../utils/posCart";
import { isMine, TABLE_STATUS_TEXT } from "../utils/posTables";
import { extractApiError } from "../utils/posUtils";
import { money } from "./posUi";

export type BoardTable = PosFloorTableDto & { area: string; areaId: string };

type Props = {
  scope: PosScope;
  table: BoardTable | null;
  /** Every table on the floor, for moving an order. */
  tables: BoardTable[];
  actor: PosActorDto | null;
  waiters: PosWaiterDto[];
  now: number;
  onClose: () => void;
  /** Something changed: reload the floor and show the message. */
  onChanged: (message: string) => void;
  /** Open a ticket on the POS register. */
  onOpenInPos: (ticketId: string) => void;
};

const STATES: Array<{ state: TableServiceState; label: string; managed: boolean }> = [
  { state: "available", label: "Available", managed: false },
  { state: "needsCleaning", label: "Needs cleaning", managed: false },
  { state: "reserved", label: "Reserved", managed: true },
  { state: "unavailable", label: "Unavailable", managed: true },
];

const age = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`);

/**
 * Everything staff can do with one table from the live board: see and open its orders,
 * move an order to another table, seat new guests, and set the table's status.
 * The rules match the POS register: waiters act on their own orders, supervisors on all.
 */
export function PosTableActionsDialog({ scope, table, tables, actor, waiters, now, onClose, onChanged, onOpenInPos }: Props) {
  const { tx } = useI18n();
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<Record<string, string>>({});
  const [guests, setGuests] = useState("2");
  const [waiter, setWaiter] = useState("");
  const [state, setState] = useState<TableServiceState>("available");
  const [note, setNote] = useState("");
  useDialogFocus(!!table, busy, onClose);

  const canManage = !!actor?.canManageTickets;
  const ownWaiter = useMemo(() => {
    if (!actor) return "";
    const own = waiters.find((w) => w.userId === actor.userId || (!!actor.employeeId && w.employeeId === actor.employeeId));
    return own ? waiterKey(own) : "";
  }, [actor, waiters]);

  useEffect(() => {
    if (!table) return;
    setError(null);
    setMoveTarget({});
    setGuests(String(Math.min(table.seats, 2) || 2));
    setWaiter(ownWaiter);
    setState(table.serviceState);
    setNote(table.serviceNote ?? "");
  }, [table, ownWaiter]);

  const moveOptions = useMemo(() => {
    if (!table) return [];
    return tables
      .filter((t) => t.id !== table.id && t.status !== "unavailable" && (t.status !== "reserved" || canManage))
      .sort((a, b) => a.area.localeCompare(b.area) || a.number.localeCompare(b.number, undefined, { numeric: true }));
  }, [table, tables, canManage]);

  if (!table) return null;

  const hasOrder = table.tickets.length > 0;
  const canSeat = !hasOrder && (table.status === "available" || (table.status === "reserved" && canManage));
  const lockedByManager = !canManage && (table.serviceState === "reserved" || table.serviceState === "unavailable");
  const stateAllowed = (o: (typeof STATES)[number]) => !(o.managed && !canManage) && !(hasOrder && o.managed) && !lockedByManager;
  const stateChanged = state !== table.serviceState || note.trim() !== (table.serviceNote ?? "");
  const canTouch = (t: PosTicketSummaryDto) => canManage || isMine(t, actor);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged(message);
      return true;
    } catch (err) {
      setError(extractApiError(err, tx("The change could not be saved.")));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const move = (ticket: PosTicketSummaryDto) => {
    const target = tables.find((t) => t.id === moveTarget[ticket.id]);
    if (!target) return;
    void run(async () => {
      // The summary has no note, and the version must be current: read the ticket first.
      const full = await posServiceApi.ticket(scope, ticket.id);
      await posServiceApi.updateTicket(scope, ticket.id, {
        version: full.version, orderType: full.orderType, tableId: target.id,
        guestCount: full.guestCount, customerName: full.customerName ?? null, note: full.note ?? null,
      });
    }, tx("Order {ticket} moved to table {table}.", { ticket: ticket.ticketNo, table: target.number }));
  };

  const seat = () => {
    const chosen = waiters.find((w) => waiterKey(w) === waiter);
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const created = await posServiceApi.openTicket(scope, {
          orderType: "dineIn", tableId: table.id, guestCount: Number(guests),
          waiterEmployeeId: chosen?.employeeId ?? null,
          waiterUserId: chosen?.employeeId ? null : chosen?.userId ?? null,
        });
        onChanged(tx("Table {table} seated.", { table: table.number }));
        onOpenInPos(created.id);
      } catch (err) {
        setError(extractApiError(err, tx("The order could not be opened.")));
      } finally {
        setBusy(false);
      }
    })();
  };

  const saveState = () =>
    void run(() => posServiceApi.setTableState(scope, table.id, state, note.trim()),
      tx("Table {table} is now {status}.", { table: table.number, status: tx(TABLE_STATUS_TEXT[state]).toLowerCase() }));

  const guestsValid = Number(guests) >= 1 && Number(guests) <= 100;

  return (
    <div className="ui-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="ui-dialog rpos-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ maxWidth: 560, width: "100%" }}>
        <div className="ui-dialog-header">
          <h3 id={titleId}>{tx("Table")} {table.number} · {table.area}</h3>
        </div>
        <div className="ui-dialog-body rpos-dialog-body rpos-ta">
          <p className="rpos-muted" style={{ margin: 0 }}>
            <strong>{tx(TABLE_STATUS_TEXT[table.status])}</strong>
            {" · "}{tx("{seats} seats", { seats: table.seats })}
            {table.serviceNote ? ` · ${table.serviceNote}` : ""}
            {table.serviceStateChangedBy ? ` · ${tx("set by {name} at {time}", { name: table.serviceStateChangedBy, time: formatAppDateTime(table.serviceStateChangedAtUtc) })}` : ""}
          </p>
          {error ? <StateMessage tone="error">{error}</StateMessage> : null}

          {hasOrder ? (
            <section className="rpos-ta-section" aria-label={tx("Open orders")}>
              <h4>{tx("Open orders")}</h4>
              {table.tickets.map((t) => {
                const allowed = canTouch(t);
                const mins = minutesSince(t.openedAtUtc, now);
                return (
                  <div key={t.id} className="rpos-ta-ticket">
                    <span>
                      <strong>{t.ticketNo}</strong>{" "}
                      {t.heldAtUtc ? <span className="rpos-held-tag"><PauseCircle size={12} aria-hidden="true" /> {tx("On hold")}</span> : null}
                      <br />
                      <small>{[t.waiterName || tx("No waiter"), tx("{n} guests", { n: t.guestCount }), tx("{n} items", { n: t.itemCount }), t.holdReason].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span style={{ textAlign: "end" }}>
                      <strong>{money(t.subtotal)}</strong><br />
                      <small className={`rpos-age ${mins >= 120 ? "is-bad" : mins >= 60 ? "is-warn" : ""}`}><Clock3 size={11} aria-hidden="true" /> {age(mins)}</small>
                    </span>
                    {allowed ? (
                      <>
                        <div className="rpos-chip-row">
                          <Button type="button" size="sm" onClick={() => onOpenInPos(t.id)} disabled={busy}>
                            <ExternalLink size={14} aria-hidden="true" /> {tx("Open in POS")}
                          </Button>
                        </div>
                        <div className="rpos-ta-move">
                          <label className="rpos-field">
                            <span>{tx("Move this order to")}</span>
                            <Select value={moveTarget[t.id] ?? ""} disabled={busy} onChange={(e) => setMoveTarget((m) => ({ ...m, [t.id]: e.target.value }))}>
                              <option value="">{tx("Choose a table")}</option>
                              {moveOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.area} · {o.number} ({tx(TABLE_STATUS_TEXT[o.status])}{o.tickets.length ? `, ${tx("joins {n} order(s)", { n: o.tickets.length })}` : ""})
                                </option>
                              ))}
                            </Select>
                          </label>
                          <Button type="button" size="sm" variant="outline" disabled={busy || !moveTarget[t.id]} onClick={() => move(t)}>
                            <ArrowRightLeft size={14} aria-hidden="true" /> {tx("Move")}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <small className="rpos-muted" style={{ gridColumn: "1 / -1" }}>{tx("Served by another waiter. A supervisor can change it.")}</small>
                    )}
                  </div>
                );
              })}
            </section>
          ) : null}

          {canSeat ? (
            <section className="rpos-ta-section" aria-label={tx("Seat guests")}>
              <h4>{tx("Seat guests")}</h4>
              <div className="rpos-ta-seat">
                <label className="rpos-field">
                  <span><Users size={12} aria-hidden="true" /> {tx("Guests")}</span>
                  <Input type="number" min={1} max={100} value={guests} disabled={busy} onChange={(e) => setGuests(e.target.value)} />
                </label>
                <label className="rpos-field">
                  <span>{tx("Waiter")}</span>
                  <Select value={waiter} disabled={busy} onChange={(e) => setWaiter(e.target.value)}>
                    <option value="">{tx("No waiter")}</option>
                    {waiters.map((w) => <option key={waiterKey(w)} value={waiterKey(w)}>{w.name}{w.openTickets ? ` (${w.openTickets})` : ""}</option>)}
                  </Select>
                </label>
              </div>
              {Number(guests) > table.seats ? <small className="rpos-age is-warn">{tx("More guests than seats ({seats}).", { seats: table.seats })}</small> : null}
              <Button type="button" disabled={busy || !guestsValid} onClick={seat}>
                <UserPlus size={15} aria-hidden="true" /> {tx("Seat and start order")}
              </Button>
            </section>
          ) : null}

          <section className="rpos-ta-section" aria-label={tx("Table status")}>
            <h4>{tx("Table status")}</h4>
            <div className="rpos-chip-row" role="radiogroup" aria-label={tx("Table status")}>
              {STATES.map((o) => (
                <Button key={o.state} type="button" size="sm" role="radio" aria-checked={state === o.state} disabled={busy || !stateAllowed(o)}
                  variant={state === o.state ? "default" : "outline"} className={`rpos-state-chip rpos-table--${o.state}`}
                  onClick={() => setState(o.state)}>
                  {tx(o.label)}
                </Button>
              ))}
            </div>
            {state === "reserved" || state === "unavailable" ? (
              <label className="rpos-field">
                <span>{tx(state === "reserved" ? "Reserved for" : "Reason")}</span>
                <Input value={note} maxLength={200} disabled={busy || !canManage}
                  placeholder={tx(state === "reserved" ? "Guest name and time" : "e.g. broken chair")} onChange={(e) => setNote(e.target.value)} />
              </label>
            ) : null}
            {lockedByManager ? <small className="rpos-muted">{tx("Only a supervisor can release a reserved or out-of-use table.")}</small> : null}
            {hasOrder ? <small className="rpos-muted">{tx("This table has an open order, so it cannot be reserved or taken out of use.")}</small> : null}
            <div>
              <Button type="button" size="sm" variant="outline" disabled={busy || !stateChanged || lockedByManager} onClick={saveState}>
                {tx("Save status")}
              </Button>
            </div>
          </section>

          <div className="rpos-dialog-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{tx("Close")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
