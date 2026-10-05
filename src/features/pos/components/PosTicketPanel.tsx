import { ArrowLeft, Ban, Minus, PauseCircle, Plus, Printer, ReceiptText, Send, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import { useI18n } from "../../../i18n";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import type { PosFloorDto, PosTicketDto, PosTicketLineDto, PosWaiterDto } from "../api/posServiceApi";
import { waiterKey } from "../api/posServiceApi";
import type { CartItem } from "../types/posTypes";
import { money } from "./posUi";

export type PosTotals = { subtotal: number; discount: number; serviceCharge: number; tax: number; total: number };

type Props = {
  ticket: PosTicketDto | null;
  /** Counter sale: items are paid immediately without a ticket. */
  counter: boolean;
  draft: CartItem[];
  totals: PosTotals;
  waiters: PosWaiterDto[];
  floor: PosFloorDto | null;
  busy: boolean;
  canPay: boolean;
  payBlockedReason?: string | null;
  onDraftChange: (action: { type: "INCREMENT" | "DECREMENT" | "REMOVE"; id: string }) => void;
  onClearDraft: () => void;
  onSend: () => void;
  onPay: () => void;
  /** Prints the guest check (bill with suggested tips) before payment. */
  onPrintCheck?: () => void;
  /** Puts a counter order on hold as an open ticket. */
  onHold?: () => void;
  onBack: () => void;
  onAssignWaiter: (waiter: PosWaiterDto | null) => void;
  onMoveTable: (tableId: string) => void;
  onVoidLine: (line: PosTicketLineDto) => void;
  onCancelTicket: () => void;
};

const EVENT_TEXT: Record<string, string> = {
  opened: "Order opened", held: "Put on hold", resumed: "Resumed", waiterChanged: "Waiter changed",
  tableMoved: "Table changed", cancelled: "Cancelled",
};

const orderTypeText: Record<string, string> = {
  dineIn: "Dine In", takeAway: "Take Away", delivery: "Delivery", roomService: "Room Service",
};

/** The open ticket (or counter sale): who serves it, what was sent, what is still unsent, and its bill. */
export function PosTicketPanel(props: Props) {
  const { tx } = useI18n();
  const { ticket, counter, draft, totals, waiters, busy } = props;
  const rounds = new Map<number, PosTicketLineDto[]>();
  for (const line of ticket?.lines ?? []) rounds.set(line.round, [...(rounds.get(line.round) ?? []), line]);
  const freeTables = (props.floor?.areas ?? []).flatMap((area) =>
    area.tables.filter((table) => table.status === "available" || table.id === ticket?.tableId).map((table) => ({ ...table, area: area.name })));
  const draftTotal = draft.reduce((sum, item) => sum + item.lineTotal, 0);
  const editable = counter || !!ticket?.canEdit;

  return (
    <aside className="rpos-ticket" aria-label={tx(counter ? "New order" : "Ticket")}>
      <header className="rpos-ticket-head">
        <Button type="button" size="sm" variant="ghost" onClick={props.onBack} aria-label={tx("Back to floor")}>
          <ArrowLeft size={16} aria-hidden="true" />
        </Button>
        <div>
          <h2>{counter ? tx("New order") : ticket ? `${tx("Ticket")} ${ticket.ticketNo}` : tx("New order")}</h2>
          {ticket ? (
            <p className="rpos-muted">
              {tx(orderTypeText[ticket.orderType] ?? "Dine In")}
              {ticket.tableLabel ? ` · ${tx("Table")} ${ticket.tableLabel}${ticket.areaName ? ` (${ticket.areaName})` : ""}` : ""}
              {` · ${tx("{count} guests", { count: ticket.guestCount })}`}
            </p>
          ) : null}
        </div>
      </header>

      {ticket ? (
        <div className="rpos-ticket-meta">
          <label>
            <span>{tx("Waiter")}</span>
            {ticket.canManage ? (
              <Select value={waiterKey(ticket)} disabled={busy} onChange={(event) =>
                props.onAssignWaiter(waiters.find((waiter) => waiterKey(waiter) === event.target.value) ?? null)}>
                <option value="">{tx("Unassigned")}</option>
                {waiters.map((waiter) => (
                  <option key={waiterKey(waiter)} value={waiterKey(waiter)}>
                    {waiter.name}{waiter.openTickets ? ` (${waiter.openTickets})` : ""}
                  </option>
                ))}
                {ticket.waiterName && !waiters.some((waiter) => waiterKey(waiter) === waiterKey(ticket))
                  ? <option value={waiterKey(ticket)}>{ticket.waiterName}</option> : null}
              </Select>
            ) : <strong>{ticket.waiterName || tx("Unassigned")}</strong>}
          </label>
          {ticket.orderType === "dineIn" ? (
            <label>
              <span>{tx("Table")}</span>
              {ticket.canEdit ? (
                <Select value={ticket.tableId ?? ""} disabled={busy} onChange={(event) => props.onMoveTable(event.target.value)}>
                  {freeTables.map((table) => (
                    <option key={table.id} value={table.id}>{table.number} · {table.area}</option>
                  ))}
                </Select>
              ) : <strong>{ticket.tableLabel}</strong>}
            </label>
          ) : null}
          <p className="rpos-muted">
            {tx("Opened {time} by {name}", { time: formatAppDateTime(ticket.openedAtUtc), name: ticket.openedByName })}
          </p>
          {ticket.heldAtUtc ? (
            <p className="rpos-held-banner" role="status">
              <PauseCircle size={14} aria-hidden="true" />
              {tx("On hold since {time} by {name}", { time: formatAppDateTime(ticket.heldAtUtc), name: ticket.heldByName ?? "" })}
              {ticket.holdReason ? ` · ${ticket.holdReason}` : ""}
            </p>
          ) : null}
          {ticket.events?.length ? (
            <details className="rpos-history">
              <summary>{tx("History")} · {ticket.events.length}</summary>
              <ol>
                {ticket.events.map((event, index) => (
                  <li key={index}>
                    <strong>{tx(EVENT_TEXT[event.type] ?? event.type)}</strong>
                    {event.fromValue || event.toValue ? <span> {[event.fromValue, event.toValue].filter(Boolean).join(" → ")}</span> : null}
                    {event.reason ? <span className="rpos-muted"> · {event.reason}</span> : null}
                    <small className="rpos-muted">{formatAppDateTime(event.atUtc)} · {event.byName}</small>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="rpos-ticket-lines">
        {[...rounds.entries()].map(([round, lines]) => (
          <section key={round} className="rpos-round" aria-label={tx("Round {round}", { round })}>
            <h3>{tx("Round {round}", { round })} · {formatAppDateTime(lines[0].addedAtUtc)} · {lines[0].addedByName}</h3>
            {lines.map((line) => (
              <div key={line.id} className={line.isVoided ? "rpos-line is-voided" : "rpos-line"}>
                <span className="rpos-line-qty">{line.quantity}×</span>
                <span className="rpos-line-name">
                  {line.itemName}
                  {line.note ? <small>{line.note}</small> : null}
                  {line.isVoided ? <small>{tx("Voided")}: {line.voidReason}</small> : null}
                </span>
                <strong>{money(line.lineTotal)}</strong>
                {ticket?.canManage && !line.isVoided ? (
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => props.onVoidLine(line)}
                    aria-label={`${tx("Void")} ${line.itemName}`} title={tx("Void")}>
                    <Ban size={15} aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            ))}
          </section>
        ))}

        {draft.length > 0 ? (
          <section className="rpos-round rpos-round--draft" aria-label={tx("Not sent yet")}>
            <h3>{counter ? tx("Items") : tx("Not sent yet")}</h3>
            {draft.map((item) => (
              <div key={item.id} className="rpos-line">
                <span className="rpos-line-name">{item.name}<small>{money(item.price)}</small></span>
                <span className="rpos-qty">
                  <Button type="button" size="sm" variant="outline" disabled={busy} aria-label={`${tx("Decrease quantity")} ${item.name}`}
                    onClick={() => props.onDraftChange({ type: "DECREMENT", id: item.id })}><Minus size={14} aria-hidden="true" /></Button>
                  <span>{item.qty}</span>
                  <Button type="button" size="sm" variant="outline" disabled={busy} aria-label={`${tx("Increase quantity")} ${item.name}`}
                    onClick={() => props.onDraftChange({ type: "INCREMENT", id: item.id })}><Plus size={14} aria-hidden="true" /></Button>
                </span>
                <strong>{money(item.lineTotal)}</strong>
                <Button type="button" size="sm" variant="ghost" disabled={busy} aria-label={`${tx("Remove")} ${item.name}`}
                  onClick={() => props.onDraftChange({ type: "REMOVE", id: item.id })}><Trash2 size={15} aria-hidden="true" /></Button>
              </div>
            ))}
          </section>
        ) : null}

        {rounds.size === 0 && draft.length === 0 ? (
          <p className="rpos-empty-line">{tx(editable ? "Select menu items to start the order." : "This ticket has no items.")}</p>
        ) : null}
      </div>

      <dl className="rpos-totals">
        <div><dt>{tx("Subtotal")}</dt><dd>{money(totals.subtotal)}</dd></div>
        <div><dt>{tx("Service Charge")}</dt><dd>{money(totals.serviceCharge)}</dd></div>
        <div><dt>{tx("Tax")}</dt><dd>{money(totals.tax)}</dd></div>
        <div className="rpos-grand"><dt>{tx(counter ? "Total" : "Ticket total")}</dt><dd>{money(totals.total)}</dd></div>
        {!counter && draft.length > 0 ? <div className="rpos-pending"><dt>{tx("Not sent yet")}</dt><dd>{money(draftTotal)}</dd></div> : null}
      </dl>

      <div className="rpos-ticket-actions">
        {!counter && editable ? (
          <Button type="button" disabled={busy || draft.length === 0} onClick={props.onSend}>
            <Send size={16} aria-hidden="true" /> {tx("Send order")}
          </Button>
        ) : null}
        {draft.length > 0 ? (
          <Button type="button" variant="outline" disabled={busy} onClick={props.onClearDraft}>{tx("Clear unsent")}</Button>
        ) : null}
        {props.onHold ? (
          <Button type="button" variant="outline" disabled={busy} onClick={props.onHold}>
            <PauseCircle size={16} aria-hidden="true" /> {tx("Hold order")}
          </Button>
        ) : null}
        {props.onPrintCheck ? (
          <Button type="button" variant="outline" disabled={busy} onClick={props.onPrintCheck}>
            <Printer size={16} aria-hidden="true" /> {tx("Print guest check")}
          </Button>
        ) : null}
        {props.canPay ? (
          <Button type="button" disabled={busy || !!props.payBlockedReason} onClick={props.onPay} title={props.payBlockedReason ? tx(props.payBlockedReason) : undefined}>
            <ReceiptText size={16} aria-hidden="true" /> {tx("Take payment")}
          </Button>
        ) : null}
        {ticket && (ticket.canManage || (ticket.canEdit && !ticket.lines.some((line) => !line.isVoided))) ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={props.onCancelTicket}>{tx("Cancel ticket")}</Button>
        ) : null}
      </div>
      {props.canPay && props.payBlockedReason ? <p className="rpos-muted">{tx(props.payBlockedReason)}</p> : null}
    </aside>
  );
}
