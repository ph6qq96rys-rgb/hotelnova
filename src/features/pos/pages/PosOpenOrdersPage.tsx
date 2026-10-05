import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, HandCoins, Minus, Plus, RefreshCw, Search, ShoppingBag, SquareArrowOutUpRight } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useAppScope } from "../../../app/useAppScope";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import { posOpenOrdersApi, type HeldOrderDto, type OpenOrdersDto, type UncollectedSaleDto } from "../api/posOpenOrdersApi";
import type { PosTicketDto } from "../api/posServiceApi";
import { PosDialog } from "../components/PosDialog";
import { money } from "../components/posUi";
import type { MenuItemDto, PaymentMethod } from "../types/posTypes";
import { round2 } from "../utils/posCart";
import { extractApiError } from "../utils/posUtils";
import "../pos-service.css";

const REFRESH_MS = 30_000;
const METHODS: PaymentMethod[] = ["CASH", "CARD", "MOBILE", "TRANSFER"];
const ORDER_TYPES: Record<string, string> = { dineIn: "Dine In", takeAway: "Take Away", delivery: "Delivery", roomService: "Room Service" };

type Tx = (text: string, values?: Record<string, string | number>) => string;

function duration(minutes: number, tx: Tx) {
  if (minutes < 60) return tx("{count} min", { count: minutes });
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? tx("{hours} h {minutes} min", { hours, minutes: minutes % 60 }) : tx("{count} days", { count: Math.floor(hours / 24) });
}

const waiterOf = (x: { waiterName?: string | null }) => x.waiterName?.trim() || "";

/**
 * Held orders (open tickets not yet paid) and sales with a balance due. Cashiers, the F&B
 * controller and finance review them here, add items to a held order, and collect balances.
 */
export function PosOpenOrdersPage() {
  const { tx } = useI18n();
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => ({ companyId: companyId ?? "", branchId: branchId ?? "" }), [companyId, branchId]);
  const canAdd = useHasPermission("pos.orders.manage");
  const canSell = useHasPermission("pos.sell");
  const canManageTickets = useHasPermission("pos.tickets.manage");
  const canOpenInPos = canSell && canManageTickets;

  const [data, setData] = useState<OpenOrdersDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [waiter, setWaiter] = useState("");
  const [view, setView] = useState<PosTicketDto | null>(null);
  const [adding, setAdding] = useState<{ ticket: PosTicketDto; lines: Map<string, { item: MenuItemDto; qty: number }> } | null>(null);
  const [menu, setMenu] = useState<MenuItemDto[]>([]);
  const [menuQuery, setMenuQuery] = useState("");
  const [collect, setCollect] = useState<{ sale: UncollectedSaleDto; method: PaymentMethod; amount: string; reference: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!scope.companyId || !scope.branchId) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    if (!quiet) setLoading(true);
    try {
      const next = await posOpenOrdersApi.list(scope, {}, controller.signal);
      if (!controller.signal.aborted) { setData(next); setError(null); }
    } catch (err) {
      if (!controller.signal.aborted) setError(extractApiError(err, tx("Held orders could not be loaded.")));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [scope, tx]);

  useEffect(() => { void load(); return () => abort.current?.abort(); }, [load]);
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === "visible" && !busy) void load(true); }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [busy, load]);

  const term = search.trim().toLowerCase();
  const matches = (values: Array<string | null | undefined>) => !term || values.some((v) => v?.toLowerCase().includes(term));
  const held = (data?.held ?? []).filter((x) => (!waiter || waiterOf(x) === waiter) &&
    matches([x.ticketNo, x.tableLabel, x.areaName, x.waiterName, x.customerName]));
  const uncollected = (data?.uncollected ?? []).filter((x) => (!waiter || waiterOf(x) === waiter) &&
    matches([x.saleNo, x.tableLabel, x.waiterName, x.customerName, x.soldByName]));
  const waiters = [...new Set([...(data?.held ?? []), ...(data?.uncollected ?? [])].map(waiterOf).filter(Boolean))].sort();

  const openView = async (order: HeldOrderDto) => {
    setBusy(true); setError(null);
    try {
      setView(await posOpenOrdersApi.ticket(scope, order.id));
    } catch (err) {
      setError(extractApiError(err, tx("The ticket could not be loaded.")));
    } finally {
      setBusy(false);
    }
  };

  const openAdd = async (order: HeldOrderDto) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const [ticket, items] = await Promise.all([posOpenOrdersApi.ticket(scope, order.id), menu.length ? Promise.resolve(menu) : posOpenOrdersApi.menu(scope)]);
      setMenu(items);
      setMenuQuery("");
      setAdding({ ticket, lines: new Map() });
    } catch (err) {
      setError(extractApiError(err, tx("The ticket could not be loaded.")));
    } finally {
      setBusy(false);
    }
  };

  const changeQty = (item: MenuItemDto, delta: number) => {
    if (!adding) return;
    const lines = new Map(adding.lines);
    const qty = (lines.get(item.id)?.qty ?? 0) + delta;
    if (qty <= 0) lines.delete(item.id); else lines.set(item.id, { item, qty });
    setAdding({ ...adding, lines });
  };

  const sendItems = async () => {
    if (!adding || adding.lines.size === 0) return;
    setBusy(true); setError(null);
    try {
      const updated = await posOpenOrdersApi.addItems(scope, adding.ticket.id, adding.ticket.version,
        [...adding.lines.values()].map((x) => ({ menuItemId: x.item.id, quantity: x.qty })));
      setAdding(null);
      setNotice(tx("Items added to {ticket}.", { ticket: updated.ticketNo }));
      await load(true);
    } catch (err) {
      setError(extractApiError(err, tx("The items could not be added.")));
      if ((err as { response?: { status?: number } })?.response?.status === 409) {
        const fresh = await posOpenOrdersApi.ticket(scope, adding.ticket.id).catch(() => null);
        if (fresh) setAdding({ ...adding, ticket: fresh });
      }
    } finally {
      setBusy(false);
    }
  };

  const collectAmount = Number(collect?.amount);
  const collectProblem = !collect ? null
    : !(collectAmount > 0) ? "Enter the amount collected."
    : collectAmount > collect.sale.balance + 0.001 ? "The payment is more than the balance due."
    : collect.method !== "CASH" && !collect.reference.trim() ? "Payment reference is required for card, mobile, and transfer payments."
    : null;

  const saveCollect = async () => {
    if (!collect || collectProblem) return;
    setBusy(true); setError(null);
    try {
      const result = await posOpenOrdersApi.collect(scope, collect.sale.id, [{
        method: collect.method, amount: round2(collectAmount), referenceCode: collect.reference.trim() || null,
      }]);
      setCollect(null);
      setNotice(result.balance > 0
        ? tx("{amount} collected on {sale}. Balance due: {balance}.", { amount: money(result.collected), sale: result.saleNo, balance: money(result.balance) })
        : tx("{sale} is fully paid.", { sale: result.saleNo }));
      await load(true);
    } catch (err) {
      setError(extractApiError(err, tx("The payment could not be recorded.")));
    } finally {
      setBusy(false);
    }
  };

  const menuTerm = menuQuery.trim().toLowerCase();
  const menuShown = menu.filter((x) => !menuTerm || x.name.toLowerCase().includes(menuTerm) || x.categoryName?.toLowerCase().includes(menuTerm)).slice(0, 60);
  const addTotal = adding ? [...adding.lines.values()].reduce((sum, x) => sum + x.qty * x.item.sellingPrice, 0) : 0;
  const s = data?.summary;

  return (
    <main className="rpos-page rpos-setup ui-page">
      <PageHeader title={tx("Held Orders & Uncollected Payments")}
        subtitle={tx("Orders on hold and sales with a balance due. Held orders are added to until a cashier takes payment.")}
        actions={<Button type="button" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw size={14} aria-hidden="true" /> {tx("Refresh")}</Button>} />

      {s ? (
        <section className="rpos-oo-tiles" aria-label={tx("Summary")}>
          <div className="rpos-oo-tile"><span>{tx("Held orders")}</span><strong>{s.heldCount}</strong><small>{money(s.heldAmount)}</small></div>
          <div className={s.staleCount ? "rpos-oo-tile is-warn" : "rpos-oo-tile"}>
            <span>{tx("Idle over {count} min", { count: s.staleAfterMinutes })}</span><strong>{s.staleCount}</strong>
            <small>{tx("Check with the server")}</small>
          </div>
          <div className="rpos-oo-tile"><span>{tx("Uncollected sales")}</span><strong>{s.uncollectedCount}</strong><small>{money(s.uncollectedBalance)}</small></div>
          <div className="rpos-oo-tile"><span>{tx("Not yet in the till")}</span><strong>{money(s.heldAmount + s.uncollectedBalance)}</strong>
            <small>{tx("Held orders at menu prices plus balances due")}</small></div>
        </section>
      ) : null}

      <section className="rpos-setup-area rpos-tip-filters" aria-label={tx("Filters")}>
        <label className="rpos-field">
          <span>{tx("Search")}</span>
          <span className="rpos-menu-search"><Search size={15} aria-hidden="true" />
            <Input value={search} placeholder={tx("Ticket, table, sale, guest...")} onChange={(e) => setSearch(e.target.value)} /></span>
        </label>
        <label className="rpos-field"><span>{tx("Waiter")}</span>
          <Select value={waiter} onChange={(e) => setWaiter(e.target.value)}>
            <option value="">{tx("All servers")}</option>
            {waiters.map((name) => <option key={name} value={name}>{name}</option>)}
          </Select>
        </label>
      </section>

      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {loading && !data ? <StateMessage tone="loading">{tx("Loading held orders...")}</StateMessage> : null}

      {data ? (
        <>
          <section className="rpos-setup-area" aria-label={tx("Held orders")}>
            <h2>{tx("Held orders")} <span className="rpos-muted">· {held.length}</span></h2>
            {held.length === 0 ? <p className="rpos-muted">{tx("No orders on hold.")}</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Ticket")}</TableHead>
                    <TableHead>{tx("Table / guest")}</TableHead>
                    <TableHead>{tx("Waiter")}</TableHead>
                    <TableHead className="rpos-num">{tx("Items")}</TableHead>
                    <TableHead className="rpos-num">{tx("Amount")}</TableHead>
                    <TableHead>{tx("Open for")}</TableHead>
                    <TableHead>{tx("Last activity")}</TableHead>
                    <TableHead><span className="sr-only">{tx("Actions")}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {held.map((order) => (
                    <TableRow key={order.id} className={order.idleMinutes >= (s?.staleAfterMinutes ?? 60) ? "is-stale" : undefined}>
                      <TableCell><strong>{order.ticketNo}</strong><br /><small className="rpos-muted">{tx(ORDER_TYPES[order.orderType] ?? order.orderType)}</small>
                        {order.heldAtUtc ? <><br /><small className="rpos-held-tag">{tx("On hold")}{order.holdReason ? ` · ${order.holdReason}` : ""}</small></> : null}</TableCell>
                      <TableCell>{order.tableLabel ? `${tx("Table")} ${order.tableLabel}` : order.customerName || "—"}
                        {order.tableLabel && order.customerName ? <><br /><small className="rpos-muted">{order.customerName}</small></> : null}</TableCell>
                      <TableCell>{order.waiterName || tx("Unassigned")}</TableCell>
                      <TableCell className="rpos-num">{order.itemCount}</TableCell>
                      <TableCell className="rpos-num">{money(order.subtotal)}</TableCell>
                      <TableCell>{duration(order.ageMinutes, tx)}</TableCell>
                      <TableCell>{tx("{time} ago", { time: duration(order.idleMinutes, tx) })}</TableCell>
                      <TableCell className="rpos-row-actions">
                        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void openView(order)} aria-label={`${tx("View")} ${order.ticketNo}`}>
                          <Eye size={14} aria-hidden="true" />
                        </Button>
                        {canAdd ? (
                          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void openAdd(order)}>
                            <ShoppingBag size={14} aria-hidden="true" /> {tx("Add items")}
                          </Button>
                        ) : null}
                        {canOpenInPos ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/companies/${companyId}/sales/pos?ticket=${order.id}`)}>
                            <SquareArrowOutUpRight size={14} aria-hidden="true" /> {tx("Open in POS")}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="rpos-muted">{tx("Amounts are at menu prices; tax and service charge are added when the bill is settled.")}</p>
          </section>

          <section className="rpos-setup-area" aria-label={tx("Uncollected payments")}>
            <h2>{tx("Uncollected payments")} <span className="rpos-muted">· {uncollected.length}</span></h2>
            {uncollected.length === 0 ? <p className="rpos-muted">{tx("Every confirmed sale is fully paid.")}</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Sale")}</TableHead>
                    <TableHead>{tx("Sold")}</TableHead>
                    <TableHead>{tx("Table / guest")}</TableHead>
                    <TableHead>{tx("Waiter")}</TableHead>
                    <TableHead className="rpos-num">{tx("Total")}</TableHead>
                    <TableHead className="rpos-num">{tx("Paid")}</TableHead>
                    <TableHead className="rpos-num">{tx("Balance due")}</TableHead>
                    <TableHead>{tx("Status")}</TableHead>
                    <TableHead><span className="sr-only">{tx("Actions")}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uncollected.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell><strong>{sale.saleNo}</strong><br /><small className="rpos-muted">{sale.soldByName}</small></TableCell>
                      <TableCell>{formatAppDateTime(sale.soldAtUtc)}{sale.ageDays > 0 ? <><br /><small className="rpos-muted">{tx("{count} days", { count: sale.ageDays })}</small></> : null}</TableCell>
                      <TableCell>{[sale.tableLabel ? `${tx("Table")} ${sale.tableLabel}` : null, sale.customerName].filter(Boolean).join(" · ") || "—"}</TableCell>
                      <TableCell>{sale.waiterName || "—"}</TableCell>
                      <TableCell className="rpos-num">{money(sale.totalAmount)}</TableCell>
                      <TableCell className="rpos-num">{money(sale.paidAmount)}</TableCell>
                      <TableCell className="rpos-num"><strong>{money(sale.balance)}</strong></TableCell>
                      <TableCell>{tx(sale.paymentStatus === "partiallyPaid" ? "Partly paid" : "Unpaid")}</TableCell>
                      <TableCell className="rpos-row-actions">
                        {canSell ? (
                          <Button type="button" size="sm" variant="outline" disabled={busy}
                            onClick={() => setCollect({ sale, method: "CASH", amount: sale.balance.toFixed(2), reference: "" })}>
                            <HandCoins size={14} aria-hidden="true" /> {tx("Collect")}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      ) : null}

      <PosDialog open={!!view} title={`${tx("Ticket")} ${view?.ticketNo ?? ""}`} confirmText={tx("Close")}
        description={view ? `${view.tableLabel ? `${tx("Table")} ${view.tableLabel} · ` : ""}${view.waiterName || tx("Unassigned")} · ${tx("Opened {time} by {name}", { time: formatAppDateTime(view.openedAtUtc), name: view.openedByName })}` : undefined}
        onConfirm={() => setView(null)} onClose={() => setView(null)}>
        <div className="rpos-ticket-lines">
          {[...new Set(view?.lines.map((x) => x.round))].map((round) => {
            const lines = view!.lines.filter((x) => x.round === round);
            return (
              <section key={round} className="rpos-round">
                <h3>{tx("Round {round}", { round })} · {formatAppDateTime(lines[0].addedAtUtc)} · {lines[0].addedByName}</h3>
                {lines.map((line) => (
                  <div key={line.id} className={line.isVoided ? "rpos-line is-voided" : "rpos-line"}>
                    <span className="rpos-line-qty">{line.quantity}×</span>
                    <span className="rpos-line-name">{line.itemName}{line.isVoided ? <small>{tx("Voided")}: {line.voidReason}</small> : null}</span>
                    <strong>{money(line.lineTotal)}</strong>
                    <span />
                  </div>
                ))}
              </section>
            );
          })}
          {view && view.lines.length === 0 ? <p className="rpos-muted">{tx("This ticket has no items.")}</p> : null}
          <p className="rpos-oo-total"><span>{tx("Ticket total")}</span><strong>{money(view?.subtotal ?? 0)}</strong></p>
        </div>
      </PosDialog>

      <PosDialog open={!!adding} title={`${tx("Add items")} · ${adding?.ticket.ticketNo ?? ""}`}
        description={adding ? tx("Items are sent as a new round on {ticket}, recorded with your name.", { ticket: adding.ticket.ticketNo }) : undefined}
        confirmText={adding?.lines.size ? `${tx("Send to order")} · ${money(addTotal)}` : tx("Send to order")} busy={busy}
        confirmDisabled={!adding?.lines.size} onConfirm={() => void sendItems()} onClose={() => setAdding(null)}>
        {adding ? (
          <div className="rpos-oo-add">
            <label className="rpos-field">
              <span>{tx("Search menu")}</span>
              <Input value={menuQuery} autoFocus placeholder={tx("Item or category")} onChange={(e) => setMenuQuery(e.target.value)} />
            </label>
            <div className="rpos-oo-menu" role="list" aria-label={tx("Menu")}>
              {menuShown.map((item) => (
                <div key={item.id} className="rpos-oo-menu-row" role="listitem">
                  <span className="rpos-line-name">{item.name}<small>{item.categoryName ?? ""}</small></span>
                  <strong>{money(item.sellingPrice)}</strong>
                  <span className="rpos-qty">
                    <Button type="button" size="sm" variant="outline" disabled={!adding.lines.get(item.id)} aria-label={`${tx("Decrease quantity")} ${item.name}`}
                      onClick={() => changeQty(item, -1)}><Minus size={14} aria-hidden="true" /></Button>
                    <span>{adding.lines.get(item.id)?.qty ?? 0}</span>
                    <Button type="button" size="sm" variant="outline" aria-label={`${tx("Increase quantity")} ${item.name}`}
                      onClick={() => changeQty(item, 1)}><Plus size={14} aria-hidden="true" /></Button>
                  </span>
                </div>
              ))}
              {menuShown.length === 0 ? <p className="rpos-muted">{tx("No menu items match.")}</p> : null}
            </div>
          </div>
        ) : null}
      </PosDialog>

      <PosDialog open={!!collect} title={`${tx("Collect payment")} · ${collect?.sale.saleNo ?? ""}`} busy={busy}
        description={collect ? tx("Balance due: {amount}. The money goes into your open cashier drawer.", { amount: money(collect.sale.balance) }) : undefined}
        confirmText={tx("Record payment")} confirmDisabled={!!collectProblem} onConfirm={() => void saveCollect()} onClose={() => setCollect(null)}>
        {collect ? (
          <div className="rpos-form-grid">
            <div className="rpos-chip-row rpos-span-all" role="radiogroup" aria-label={tx("Payment method")}>
              {METHODS.map((method) => (
                <Button key={method} type="button" size="sm" role="radio" aria-checked={collect.method === method}
                  variant={collect.method === method ? "default" : "outline"} onClick={() => setCollect({ ...collect, method })}>{tx(method)}</Button>
              ))}
            </div>
            <label className="rpos-field">
              <span>{tx("Amount")}</span>
              <Input type="number" inputMode="decimal" min={0} step="0.01" value={collect.amount} onChange={(e) => setCollect({ ...collect, amount: e.target.value })} />
            </label>
            {collect.method !== "CASH" ? (
              <label className="rpos-field">
                <span>{tx("Payment Reference")}</span>
                <Input value={collect.reference} maxLength={120} onChange={(e) => setCollect({ ...collect, reference: e.target.value })} />
              </label>
            ) : null}
            {collectProblem ? <p className="rpos-muted rpos-span-all">{tx(collectProblem)}</p> : null}
          </div>
        ) : null}
      </PosDialog>
    </main>
  );
}
