import { useEffect, useMemo, useState } from "react";
import { Clock3, Users } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useI18n } from "../../../i18n";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import {
  holdRequires,
  waiterKey,
  type HoldOrderRequest,
  type PosActorDto,
  type PosFloorDto,
  type PosFloorTableDto,
  type PosOrderType,
  type PosServiceSettingsDto,
  type PosTicketSummaryDto,
  type PosWaiterDto,
} from "../api/posServiceApi";
import { PosDialog } from "./PosDialog";
import { isMine, TABLE_STATUS_TEXT } from "../utils/posTables";
import { money } from "./posUi";

const ORDER_TYPES: Array<{ value: PosOrderType; label: string }> = [
  { value: "dineIn", label: "Dine In" },
  { value: "takeAway", label: "Take Away" },
  { value: "delivery", label: "Delivery" },
  { value: "roomService", label: "Room Service" },
];

/** Quick-pick hold reasons plus a free-text reason. */
export function HoldReasonPicker({ reasons, value, onChange, required }: {
  reasons: string[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const { tx } = useI18n();
  return (
    <div className="rpos-field rpos-span-all">
      <span>{tx(required ? "Hold reason" : "Hold reason (optional)")}</span>
      {reasons.length ? (
        <div className="rpos-chip-row" role="radiogroup" aria-label={tx("Hold reason")}>
          {reasons.map((reason) => (
            <Button key={reason} type="button" size="sm" role="radio" aria-checked={value === reason}
              variant={value === reason ? "default" : "outline"} onClick={() => onChange(value === reason ? "" : reason)}>
              {tx(reason)}
            </Button>
          ))}
        </div>
      ) : null}
      <Input value={value} maxLength={200} placeholder={tx("Or type a reason")} aria-label={tx("Hold reason")} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

type Props = {
  open: boolean;
  busy: boolean;
  floor: PosFloorDto | null;
  waiters: PosWaiterDto[];
  actor: PosActorDto | null;
  ownWaiterKey: string;
  settings: PosServiceSettingsDto | null;
  itemCount: number;
  itemTotal: number;
  onClose: () => void;
  onConfirm: (request: Omit<HoldOrderRequest, "items">, summary: { tableLabel?: string; waiterName?: string | null; appendTo?: string }) => void;
};

/**
 * Hold Order for an order built item-first. A waiter is always the server; a cashier or
 * supervisor chooses one. Dine-in orders are seated at a table picked from the live floor:
 * a table that already has an order gets these items added to it instead of a second order.
 */
export function PosHoldDialog(props: Props) {
  const { tx } = useI18n();
  const { actor, settings, floor } = props;
  const canManage = !!actor?.canManageTickets;
  const quick = settings?.serviceStyle === "quickService";
  const [orderType, setOrderType] = useState<PosOrderType>(quick ? "takeAway" : "dineIn");
  const [tableId, setTableId] = useState("");
  const [waiter, setWaiter] = useState(props.ownWaiterKey);
  const [guests, setGuests] = useState("");
  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!props.open) return;
    setOrderType(quick ? "takeAway" : "dineIn");
    setTableId(""); setWaiter(props.ownWaiterKey); setGuests(""); setCustomer(""); setNote(""); setReason("");
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, [props.open, props.ownWaiterKey, quick]);

  const requires = holdRequires(settings, orderType);
  const tables = useMemo(() => (floor?.areas ?? []).map((area) => ({ ...area, tables: area.tables })), [floor]);
  const selected = tables.flatMap((a) => a.tables.map((t) => ({ ...t, area: a.name }))).find((t) => t.id === tableId);
  const appendTo: PosTicketSummaryDto | undefined = selected?.tickets.find((t) => canManage || isMine(t, actor));
  const waiterOption = props.waiters.find((w) => waiterKey(w) === waiter);
  const guestCount = Number(guests);

  const selectable = (table: PosFloorTableDto) => {
    if (table.tickets.length) return table.tickets.some((t) => canManage || isMine(t, actor));
    return table.status === "available" || (table.status === "reserved" && canManage);
  };

  const problem = (() => {
    if (orderType === "dineIn" && requires.table && !tableId) return "Select a table for this dine-in order.";
    if (!appendTo && requires.waiter && canManage && !waiterOption) return "Select the waiter or waitress serving this order.";
    if (!appendTo && settings?.requireGuestCount && !(guestCount >= 1)) return "Enter the number of guests.";
    if (guests && !(guestCount >= 1 && guestCount <= 500)) return "Guest count must be between 1 and 500.";
    if (settings?.requireHoldReason && !reason.trim()) return "Choose a reason for holding the order.";
    return null;
  })();

  const confirm = () => {
    if (problem) return;
    props.onConfirm({
      orderType,
      tableId: orderType === "dineIn" ? tableId || null : null,
      waiterEmployeeId: canManage && !appendTo ? waiterOption?.employeeId ?? null : null,
      waiterUserId: canManage && !appendTo && !waiterOption?.employeeId ? waiterOption?.userId ?? null : null,
      guestCount: guests ? guestCount : null,
      customerName: customer.trim() || null,
      note: note.trim() || null,
      holdReason: reason.trim() || null,
      appendToTicketId: appendTo?.id ?? null,
    }, {
      tableLabel: selected?.number,
      waiterName: appendTo ? appendTo.waiterName : canManage ? waiterOption?.name : actor?.name,
      appendTo: appendTo?.ticketNo,
    });
  };

  return (
    <PosDialog open={props.open} title={tx("Hold order")} busy={props.busy} confirmText={appendTo ? tx("Add to {ticket}", { ticket: appendTo.ticketNo }) : tx("Hold order")}
      description={tx("{count} items · {amount}", { count: props.itemCount, amount: money(props.itemTotal) })}
      confirmDisabled={!!problem} onConfirm={confirm} onClose={props.onClose}>
      <div className="rpos-hold">
        <div className="rpos-hold-meta">
          <span>{tx("Order number")}: <strong>{appendTo ? appendTo.ticketNo : tx("assigned when held")}</strong></span>
          <span><Clock3 size={13} aria-hidden="true" /> {formatAppDateTime(now)}</span>
        </div>

        <div className="rpos-chip-row" role="radiogroup" aria-label={tx("Service Type")}>
          {ORDER_TYPES.map((x) => (
            <Button key={x.value} type="button" size="sm" role="radio" aria-checked={orderType === x.value}
              variant={orderType === x.value ? "default" : "outline"} onClick={() => { setOrderType(x.value); if (x.value !== "dineIn") setTableId(""); }}>
              {tx(x.label)}
            </Button>
          ))}
        </div>

        <div className="rpos-field">
          <span>{tx("Waiter/Waitress")}</span>
          {appendTo ? (
            <strong>{appendTo.waiterName || tx("Unassigned")} <small className="rpos-muted">· {tx("kept from {ticket}", { ticket: appendTo.ticketNo })}</small></strong>
          ) : canManage ? (
            <Select value={waiter} aria-label={tx("Waiter/Waitress")} onChange={(e) => setWaiter(e.target.value)}>
              <option value="">{tx(requires.waiter ? "Select waiter/waitress" : "No waiter")}</option>
              {props.waiters.map((w) => (
                <option key={waiterKey(w)} value={waiterKey(w)}>{w.name}{w.openTickets ? ` (${tx("{count} open", { count: w.openTickets })})` : ""}</option>
              ))}
            </Select>
          ) : <strong>{actor?.name}</strong>}
        </div>

        {orderType === "dineIn" ? (
          <div className="rpos-field">
            <span>{tx(requires.table ? "Select table" : "Table (optional)")}</span>
            {tables.length === 0 ? <p className="rpos-muted">{tx("No tables are set up for this branch yet.")}</p> : null}
            {tables.map((area) => (
              <div key={area.id} className="rpos-hold-area">
                <small className="rpos-muted">{area.name}</small>
                <div className="rpos-hold-tables" role="radiogroup" aria-label={area.name}>
                  {area.tables.map((table) => {
                    const ok = selectable(table);
                    const mine = table.tickets.some((t) => isMine(t, actor));
                    const status = table.tickets.length && mine ? "mine" : table.status;
                    return (
                      <Button key={table.id} type="button" role="radio" aria-checked={tableId === table.id} disabled={!ok}
                        variant="outline" className={`rpos-hold-table rpos-table--${status}${tableId === table.id ? " is-selected" : ""}`}
                        aria-label={`${tx("Table")} ${table.number}, ${tx(TABLE_STATUS_TEXT[table.status])}`}
                        onClick={() => setTableId(tableId === table.id ? "" : table.id)}>
                        <strong>{table.number}</strong>
                        <small>{tx(TABLE_STATUS_TEXT[table.status])}</small>
                        <small className="rpos-muted"><Users size={11} aria-hidden="true" /> {table.seats}</small>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
            {appendTo ? (
              <p className="rpos-notice rpos-notice--ok" role="status">
                {tx("Table {table} already has order {ticket}. These items will be added to it.", { table: selected!.number, ticket: appendTo.ticketNo })}
              </p>
            ) : selected?.status === "reserved" ? (
              <p className="rpos-muted">{tx("Seating the reservation{note}.", { note: selected.serviceNote ? ` (${selected.serviceNote})` : "" })}</p>
            ) : null}
          </div>
        ) : (
          <label className="rpos-field">
            <span>{tx("Customer / Guest")}</span>
            <Input value={customer} maxLength={200} placeholder={tx("Name to call the order")} onChange={(e) => setCustomer(e.target.value)} />
          </label>
        )}

        {!appendTo ? (
          <label className="rpos-field">
            <span>{tx(settings?.requireGuestCount ? "Guest Count" : "Guest Count (optional)")}</span>
            <Input type="number" inputMode="numeric" min={1} max={500} value={guests} onChange={(e) => setGuests(e.target.value)} />
          </label>
        ) : null}

        <label className="rpos-field">
          <span>{tx("Order note (optional)")}</span>
          <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <HoldReasonPicker reasons={settings?.holdReasons ?? []} value={reason} onChange={setReason} required={settings?.requireHoldReason} />
        {problem ? <p className="rpos-muted">{tx(problem)}</p> : null}
      </div>
    </PosDialog>
  );
}
