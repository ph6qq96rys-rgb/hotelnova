import { useMemo, useState } from "react";
import { Clock3, MoreHorizontal, PauseCircle, Plus, RefreshCw, ShoppingBag, Users } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { useI18n } from "../../../i18n";
import type { PosActorDto, PosFloorDto, PosFloorTableDto, PosTicketSummaryDto } from "../api/posServiceApi";
import { money } from "./posUi";
import { minutesSince } from "../utils/posCart";
import { isMine, TABLE_STATUS_TEXT } from "../utils/posTables";

export { isMine };

type Props = {
  floor: PosFloorDto | null;
  loading: boolean;
  actor: PosActorDto | null;
  now: number;
  onRefresh: () => void;
  /** A table was chosen; <c>tickets</c> are the open tickets there that the user may open. */
  onTable: (table: PosFloorTableDto, areaName: string, tickets: PosTicketSummaryDto[]) => void;
  onOpenTicket: (ticket: PosTicketSummaryDto) => void;
  onNewTicket: () => void;
  /** Start an order item-first; it is held at a table or paid at the counter afterwards. */
  onNewOrder?: () => void;
  /** Open the status of a table (clean, dirty, reserved, out of use). */
  onTableStatus?: (table: PosFloorTableDto, areaName: string) => void;
};

const LEGEND: Array<keyof typeof TABLE_STATUS_TEXT> = ["available", "occupied", "held", "reserved", "needsCleaning", "unavailable"];

function elapsedLabel(minutes: number) {
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/**
 * Floor plan of the branch: each table shows whether it is free, who serves it,
 * how long it has been seated and the running bill. Waiters see every table so they
 * know what is free, but can open only their own tickets.
 */
export function PosFloorView({ floor, loading, actor, now, onRefresh, onTable, onOpenTicket, onNewTicket, onNewOrder, onTableStatus }: Props) {
  const { tx } = useI18n();
  const [areaId, setAreaId] = useState<string>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const areas = useMemo(() => floor?.areas ?? [], [floor]);
  const visibleAreas = areaId === "all" ? areas : areas.filter((area) => area.id === areaId);
  const tables = areas.flatMap((area) => area.tables);
  const occupied = tables.filter((table) => table.tickets.length > 0).length;
  const unseated = (floor?.unseatedTickets ?? []).filter((ticket) => !mineOnly || isMine(ticket, actor));
  const canManage = !!actor?.canManageTickets;

  const openTable = (table: PosFloorTableDto, areaName: string) =>
    onTable(table, areaName, canManage ? table.tickets : table.tickets.filter((ticket) => isMine(ticket, actor)));

  return (
    <section className="rpos-floor" aria-label={tx("Floor plan")}>
      <div className="rpos-floor-toolbar">
        <div className="rpos-chip-row" role="tablist" aria-label={tx("Dining areas")}>
          <Button type="button" size="sm" variant={areaId === "all" ? "default" : "outline"} role="tab"
            aria-selected={areaId === "all"} onClick={() => setAreaId("all")}>{tx("All areas")}</Button>
          {areas.map((area) => (
            <Button key={area.id} type="button" size="sm" variant={areaId === area.id ? "default" : "outline"} role="tab"
              aria-selected={areaId === area.id} onClick={() => setAreaId(area.id)}>{area.name}</Button>
          ))}
        </div>
        <div className="rpos-chip-row">
          <span className="rpos-muted">{tx("{occupied} of {total} tables occupied", { occupied, total: tables.length })}</span>
          <Button type="button" size="sm" variant={mineOnly ? "default" : "outline"} aria-pressed={mineOnly} onClick={() => setMineOnly((x) => !x)}>
            {tx("My tables")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={loading} aria-label={tx("Refresh floor")}>
            <RefreshCw size={15} aria-hidden="true" /> {tx("Refresh")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onNewTicket}>
            <ShoppingBag size={15} aria-hidden="true" /> {tx("Take-away ticket")}
          </Button>
          {onNewOrder ? <Button type="button" size="sm" onClick={onNewOrder}><Plus size={15} aria-hidden="true" /> {tx("New order")}</Button> : null}
        </div>
      </div>
      <div className="rpos-legend" aria-label={tx("Table status")}>
        {LEGEND.map((status) => (
          <span key={status} className={`rpos-legend-item rpos-table--${status}`}>
            {tx(TABLE_STATUS_TEXT[status])} · {tables.filter((t) => t.status === status).length}
          </span>
        ))}
      </div>

      {!loading && tables.length === 0 ? (
        <div className="rpos-empty">
          <strong>{tx("No tables are set up for this branch yet.")}</strong>
          <span>{tx("A manager can add dining areas and tables under POS → Tables. Take-away tickets work without tables.")}</span>
        </div>
      ) : null}

      {visibleAreas.map((area) => {
        const areaTables = area.tables.filter((table) => !mineOnly || table.tickets.some((ticket) => isMine(ticket, actor)));
        if (mineOnly && areaTables.length === 0) return null;
        return (
          <div key={area.id} className="rpos-area">
            <h3>{area.name}</h3>
            <div className="rpos-table-grid">
              {areaTables.map((table) => {
                const tickets = table.tickets;
                const mine = tickets.some((ticket) => isMine(ticket, actor));
                const locked = tickets.length > 0 && !canManage && !mine;
                const total = tickets.reduce((sum, ticket) => sum + ticket.subtotal, 0);
                const oldest = tickets.reduce((max, ticket) => Math.max(max, minutesSince(ticket.openedAtUtc, now)), 0);
                const waiters = [...new Set(tickets.map((ticket) => ticket.waiterName).filter(Boolean))].join(", ");
                const state = tickets.length > 0 && mine ? "mine" : table.status;
                const held = tickets.length > 0 && tickets.every((ticket) => ticket.heldAtUtc);
                return (
                  <div key={table.id} className="rpos-table-cell">
                  <Button type="button" variant="outline"
                    className={`rpos-table rpos-table--${state}`} disabled={locked}
                    aria-label={`${tx("Table")} ${table.number}, ${tx(TABLE_STATUS_TEXT[table.status])}${waiters ? `, ${waiters}` : ""}`}
                    title={locked ? tx("This table is served by another waiter.") : table.serviceNote ?? undefined}
                    onClick={() => openTable(table, area.name)}>
                    <span className="rpos-table-head">
                      <strong>{table.number}</strong>
                      <span><Users size={13} aria-hidden="true" /> {tickets.reduce((sum, ticket) => sum + ticket.guestCount, 0) || table.seats}</span>
                    </span>
                    {tickets.length === 0 ? (
                      <span className="rpos-table-status">
                        {tx(TABLE_STATUS_TEXT[table.status])}{table.serviceNote ? ` · ${table.serviceNote}` : ` · ${tx("{seats} seats", { seats: table.seats })}`}
                      </span>
                    ) : (
                      <>
                        <span className="rpos-table-waiter">{waiters || tx("No waiter")}</span>
                        <span className="rpos-table-foot">
                          <span><Clock3 size={13} aria-hidden="true" /> {elapsedLabel(oldest)}</span>
                          <strong>{money(total)}</strong>
                        </span>
                        {held ? <span className="rpos-table-status rpos-held-tag"><PauseCircle size={12} aria-hidden="true" /> {tx("On hold")}</span> : null}
                        {tickets.length > 1 ? <span className="rpos-table-status">{tx("{count} tickets", { count: tickets.length })}</span> : null}
                      </>
                    )}
                  </Button>
                  {onTableStatus ? (
                    <Button type="button" size="sm" variant="ghost" className="rpos-table-more"
                      aria-label={`${tx("Table status")} ${table.number}`} onClick={() => onTableStatus(table, area.name)}>
                      <MoreHorizontal size={16} aria-hidden="true" />
                    </Button>
                  ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {unseated.length > 0 ? (
        <div className="rpos-area">
          <h3>{tx("Take-away, delivery and room service")}</h3>
          <div className="rpos-ticket-list">
            {unseated.map((ticket) => (
              <Button key={ticket.id} type="button" variant="outline" className="rpos-ticket-row"
                disabled={!canManage && !isMine(ticket, actor)} onClick={() => onOpenTicket(ticket)}>
                <strong>{ticket.ticketNo}</strong>
                <span>{ticket.customerName || tx(ticket.orderType === "delivery" ? "Delivery" : ticket.orderType === "roomService" ? "Room service" : "Take-away")}</span>
                <span>{ticket.waiterName || tx("No waiter")}</span>
                <span>{elapsedLabel(minutesSince(ticket.openedAtUtc, now))}</span>
                <strong>{money(ticket.subtotal)}</strong>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
