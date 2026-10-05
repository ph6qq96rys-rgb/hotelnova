import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Printer, UserRound } from "lucide-react";

import ConfirmModal from "../../../components/ConfirmModal";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useAppScope } from "../../../app/useAppScope";
import { useI18n } from "../../../i18n";
import { useUnsavedChanges } from "../../eventmanagment/components/useUnsavedChanges";
import { posApi, setActiveStore, tryGetStoreId } from "../api/posApi";
import {
  posServiceApi,
  waiterKey,
  type PosFloorTableDto,
  type PosOrderType,
  type PosTicketDto,
  type PosTicketLineDto,
  type PosTicketSummaryDto,
  type PosWaiterDto,
} from "../api/posServiceApi";
import { tipsEnabledFor } from "../api/posTipsApi";
import { PosDialog } from "../components/PosDialog";
import { PosFloorView } from "../components/PosFloorView";
import { PosMenuPanel } from "../components/PosMenuPanel";
import { PosPaymentPanel } from "../components/PosPaymentPanel";
import { PosTicketPanel } from "../components/PosTicketPanel";
import { SessionBanner, SessionGate } from "../components/SessionGate";
import { usePosSession } from "../hooks/usePosSession";
import { usePosWorkspace } from "../hooks/usePosWorkspace";
import type { MenuItemDto } from "../types/posTypes";
import { buildTotals } from "../utils/checkoutPolicy";
import { cartReducer, itemBlockReason, ticketChargeLines } from "../utils/posCart";
import { guestCheckHtml, printHtml, receiptHtml, type Receipt } from "../utils/posPrint";
import { buildPayments, newPayer, paymentProblem, splitEvenly, type PayerDraft, type TipContext } from "../utils/posTips";
import { extractApiError } from "../utils/posUtils";
import "../pos-workspace.css";
import "../pos-service.css";

type View = "FLOOR" | "ORDER" | "PAY";
type NewTicketForm = {
  orderType: PosOrderType;
  tableId: string;
  tableLabel: string;
  guests: string;
  waiter: string;
  customerName: string;
  note: string;
};

const MIN_OPENING_FLOAT_ETB = 1;
const ORDER_TYPES: Array<{ value: PosOrderType; label: string }> = [
  { value: "dineIn", label: "Dine In" },
  { value: "takeAway", label: "Take Away" },
  { value: "delivery", label: "Delivery" },
  { value: "roomService", label: "Room Service" },
];

function isConflict(err: unknown) {
  return (err as { response?: { status?: number } })?.response?.status === 409;
}

function isUncertain(err: unknown) {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return !status || status >= 500;
}

/**
 * Restaurant POS. Waiters open tickets for tables, send rounds and see only their own
 * tickets; cashiers and supervisors see the whole floor, reassign waiters and take
 * payment. A counter sale charges walk-in orders without a ticket.
 */
export function PosSalesPage() {
  const { tx } = useI18n();
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => ({ companyId: companyId ?? "", branchId: branchId ?? "" }), [companyId, branchId]);

  const [view, setView] = useState<View>("FLOOR");
  const ws = usePosWorkspace(scope, view === "FLOOR");
  const sessionState = usePosSession({ companyId, branchId });
  const cashierMode = !!ws.actor?.canManageTickets;

  const [ticket, setTicket] = useState<PosTicketDto | null>(null);
  const [counter, setCounter] = useState(false);
  const [draft, dispatchDraft] = useReducer(cartReducer, []);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string; sale?: boolean } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [now, setNow] = useState(() => Date.now());

  const [storeId, setStoreId] = useState(tryGetStoreId() ?? "");
  const [payers, setPayers] = useState<PayerDraft[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const submitLock = useRef(false);

  const [newTicket, setNewTicket] = useState<NewTicketForm | null>(null);
  const [tableChoice, setTableChoice] = useState<{ label: string; tickets: PosTicketSummaryDto[] } | null>(null);
  const [voidLine, setVoidLine] = useState<PosTicketLineDto | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);

  useUnsavedChanges(draft.length > 0 || busy);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); window.clearInterval(tick); };
  }, []);

  // A different company or branch starts from an empty floor.
  useEffect(() => {
    setTicket(null); setCounter(false); dispatchDraft({ type: "CLEAR" }); setView("FLOOR"); setNotice(null); setUncertain(false);
  }, [companyId, branchId]);

  useEffect(() => {
    if (sessionState.session?.storeId) setStoreId(sessionState.session.storeId);
  }, [sessionState.session?.id, sessionState.session?.storeId]);

  const chargeLines = useMemo(() => (counter ? draft : ticketChargeLines(ticket, ws.menu)), [counter, draft, ticket, ws.menu]);
  const totals = useMemo(() => buildTotals(chargeLines), [chargeLines]);

  // Tips belong to the server of the ticket, so they are offered only when tips are on for
  // this branch and service type and a server is assigned.
  const tipsOn = tipsEnabledFor(ws.tipSettings, counter ? "takeAway" : ticket?.orderType);
  const hasServer = !counter && !!(ticket?.waiterEmployeeId || ticket?.waiterUserId);
  const tipCtx = useMemo<TipContext>(() => ({
    offered: tipsOn && hasServer, settings: ws.tipSettings, billTotal: totals.total, billTax: totals.tax,
  }), [hasServer, tipsOn, totals.tax, totals.total, ws.tipSettings]);
  const tipNote = tipsOn && !hasServer
    ? counter ? "Tips are recorded on tickets with an assigned server." : "Assign a waiter to the ticket to accept a tip."
    : null;

  /** A single payer always pays the whole bill. */
  const changePayers = useCallback((next: PayerDraft[]) => {
    setPayers(next.length === 1 ? [{ ...next[0], amount: totals.total.toFixed(2) }] : next);
  }, [totals.total]);

  const startPayment = () => { setPayers([newPayer(totals.total)]); setView("PAY"); };

  const addPayer = () => {
    const covered = payers.reduce((sum, payer) => sum + (Number(payer.amount) || 0), 0);
    const next = payers.length === 1 ? [{ ...payers[0], amount: "" }] : payers;
    changePayers([...next, newPayer(payers.length === 1 ? 0 : Math.max(0, totals.total - covered))]);
  };

  const splitPayers = (count: number) => {
    const shares = splitEvenly(totals.total, count);
    changePayers(shares.map((share, i) => (payers[i] ? { ...payers[i], amount: share.toFixed(2), tendered: "" } : newPayer(share))));
  };

  const printLines = () => chargeLines.map((line) => ({ quantity: line.qty, name: line.name, amount: line.lineTotal }));

  const printGuestCheck = () => {
    if (!ticket) return;
    printHtml(guestCheckHtml({
      ticketNo: ticket.ticketNo, tableLabel: ticket.tableLabel, guestCount: ticket.guestCount, waiterName: ticket.waiterName,
      lines: printLines(), subtotal: totals.subtotal, serviceCharge: totals.serviceCharge, tax: totals.tax, total: totals.total,
      printedAt: new Date(),
    }, ws.tipSettings, tipCtx.offered, tx));
  };

  const fail = useCallback((err: unknown, fallback: string) => {
    setNotice({ tone: "bad", text: extractApiError(err, tx(fallback)) });
  }, [tx]);

  const reloadTicket = useCallback(async (id: string) => {
    try {
      setTicket(await posServiceApi.ticket(scope, id));
    } catch (err) {
      fail(err, "The ticket could not be loaded.");
    }
  }, [fail, scope]);

  /** Runs a ticket change; a 409 means another device changed it, so show the latest version. */
  const ticketAction = useCallback(async (action: () => Promise<PosTicketDto>, success?: string) => {
    if (!ticket) return;
    setBusy(true);
    setNotice(null);
    try {
      const updated = await action();
      setTicket(updated);
      if (success) setNotice({ tone: "ok", text: tx(success) });
      void ws.refreshFloor();
      return updated;
    } catch (err) {
      fail(err, "The ticket could not be updated.");
      if (isConflict(err)) await reloadTicket(ticket.id);
    } finally {
      setBusy(false);
    }
  }, [fail, reloadTicket, ticket, tx, ws]);

  const backToFloor = () => {
    setTicket(null); setCounter(false); dispatchDraft({ type: "CLEAR" }); setView("FLOOR"); setLeaveOpen(false);
    setPayers([]);
    void ws.refreshFloor();
  };

  const requestBack = () => (draft.length > 0 ? setLeaveOpen(true) : backToFloor());

  const openTicket = async (summary: PosTicketSummaryDto) => {
    setNotice(null);
    setBusy(true);
    try {
      const loaded = await posServiceApi.ticket(scope, summary.id);
      dispatchDraft({ type: "CLEAR" });
      setCounter(false);
      setTicket(loaded);
      setView("ORDER");
    } catch (err) {
      fail(err, "The ticket could not be loaded.");
    } finally {
      setBusy(false);
    }
  };

  const ownWaiterKey = useMemo(() => {
    const actor = ws.actor;
    if (!actor) return "";
    const own = ws.waiters.find((waiter) => waiter.userId === actor.userId || (!!actor.employeeId && waiter.employeeId === actor.employeeId));
    return own ? waiterKey(own) : "";
  }, [ws.actor, ws.waiters]);

  const startTicket = (orderType: PosOrderType, table?: PosFloorTableDto, areaName?: string) => {
    setNewTicket({
      orderType,
      tableId: table?.id ?? "",
      tableLabel: table ? `${table.number}${areaName ? ` · ${areaName}` : ""}` : "",
      guests: "2",
      waiter: ownWaiterKey,
      customerName: "",
      note: "",
    });
  };

  const onTable = (table: PosFloorTableDto, areaName: string, tickets: PosTicketSummaryDto[]) => {
    if (table.tickets.length === 0) startTicket("dineIn", table, areaName);
    else if (tickets.length === 1) void openTicket(tickets[0]);
    else if (tickets.length > 1) setTableChoice({ label: table.number, tickets });
  };

  const createTicket = async () => {
    if (!newTicket) return;
    const guests = Number(newTicket.guests);
    const waiter = ws.waiters.find((x) => waiterKey(x) === newTicket.waiter);
    setBusy(true);
    setNotice(null);
    try {
      const created = await posServiceApi.openTicket(scope, {
        orderType: newTicket.orderType,
        tableId: newTicket.orderType === "dineIn" ? newTicket.tableId || null : null,
        guestCount: guests,
        waiterEmployeeId: waiter?.employeeId ?? null,
        waiterUserId: waiter?.employeeId ? null : waiter?.userId ?? null,
        customerName: newTicket.customerName.trim() || null,
        note: newTicket.note.trim() || null,
      });
      setNewTicket(null);
      setCounter(false);
      dispatchDraft({ type: "CLEAR" });
      setTicket(created);
      setView("ORDER");
      void ws.refreshFloor();
      void ws.refreshWaiters();
    } catch (err) {
      fail(err, "The ticket could not be opened.");
      void ws.refreshFloor();
    } finally {
      setBusy(false);
    }
  };

  const addItem = (item: MenuItemDto) => {
    if (busy || uncertain) return;
    const blocked = itemBlockReason(item);
    if (blocked) { setNotice({ tone: "bad", text: blocked }); return; }
    dispatchDraft({ type: "ADD", item });
  };

  const sendDraft = () => ticketAction(async () => {
    const updated = await posServiceApi.addItems(scope, ticket!.id, ticket!.version,
      draft.map((item) => ({ menuItemId: item.id, quantity: item.qty })));
    dispatchDraft({ type: "CLEAR" });
    return updated;
  }, "Order sent to the ticket.");

  const assignWaiter = (waiter: PosWaiterDto | null) =>
    ticketAction(() => posServiceApi.assignWaiter(scope, ticket!.id, ticket!.version, waiter), waiter ? "Waiter assigned." : "Waiter removed.");

  const moveTable = (tableId: string) => {
    if (!ticket || !tableId || tableId === ticket.tableId) return;
    void ticketAction(() => posServiceApi.updateTicket(scope, ticket.id, {
      version: ticket.version, orderType: ticket.orderType, tableId, guestCount: ticket.guestCount,
      customerName: ticket.customerName, note: ticket.note,
    }), "Ticket moved to the new table.");
  };

  const confirmVoid = async () => {
    if (!voidLine) return;
    const done = await ticketAction(() => posServiceApi.voidLine(scope, ticket!.id, voidLine.id, ticket!.version, voidReason.trim()), "Item voided.");
    if (done) { setVoidLine(null); setVoidReason(""); }
  };

  const confirmCancel = async () => {
    const done = await ticketAction(() => posServiceApi.cancelTicket(scope, ticket!.id, ticket!.version, cancelReason.trim()));
    if (done) { setCancelOpen(false); setCancelReason(""); setNotice({ tone: "ok", text: `${tx("Ticket cancelled")}: ${done.ticketNo}` }); backToFloor(); }
  };

  const payBlockedReason = (() => {
    if (!online) return "Offline · checkout unavailable";
    if (uncertain) return "Sale outcome is uncertain. Check the sales register before starting another payment.";
    if (!sessionState.session) return "Open a cashier session to take payment.";
    if (!counter && draft.length > 0) return "Send or clear the unsent items before taking payment.";
    if (totals.total <= 0) return "The transaction total must be greater than zero.";
    return null;
  })();

  const paymentDisabledReason = (() => {
    if (payBlockedReason) return payBlockedReason;
    if (!storeId) return "Select a POS location before processing the sale.";
    return paymentProblem(payers, tipCtx);
  })();

  const confirmPayment = async () => {
    if (submitLock.current || paymentDisabledReason) return;
    submitLock.current = true;
    setBusy(true);
    setNotice(null);
    const payments = buildPayments(payers, tipCtx);
    const snapshot: Omit<Receipt, "saleNo"> = {
      ticketNo: counter ? "-" : ticket!.ticketNo, tableLabel: counter ? null : ticket!.tableLabel,
      guestCount: counter ? null : ticket!.guestCount, waiterName: counter ? null : ticket!.waiterName,
      lines: printLines(), subtotal: totals.subtotal, serviceCharge: totals.serviceCharge, tax: totals.tax, total: totals.total,
      printedAt: new Date(),
      payments: payments.map((x) => ({ method: x.method, amount: x.amount, tip: x.tipAmount, reference: x.referenceCode })),
    };
    try {
      const sale = counter
        ? await posApi.createSale(scope, {
            companyId: scope.companyId, branchId: scope.branchId, storeId,
            discountAmount: totals.discount, taxAmount: totals.tax, serviceChargeAmount: totals.serviceCharge,
            lines: draft.map((item) => ({ menuItemId: item.id, quantity: item.qty, unitPrice: item.price })),
            payments,
            service: { orderType: "takeAway" },
          })
        : await posServiceApi.settle(scope, ticket!.id, {
            version: ticket!.version, storeId,
            discountAmount: totals.discount, taxAmount: totals.tax, serviceChargeAmount: totals.serviceCharge, payments,
          });
      const label = counter ? "" : ` · ${tx("Ticket")} ${ticket!.ticketNo}`;
      const tipTotal = payments.reduce((sum, x) => sum + x.tipAmount, 0);
      backToFloor();
      setReceipt({ ...snapshot, saleNo: sale.saleNo ?? sale.id, printedAt: new Date() });
      setNotice({
        tone: "ok",
        sale: true,
        text: `${tx("Sale saved")}: ${sale.saleNo ?? sale.id}${label}.${tipTotal > 0 ? ` ${tx("Tips recorded")}: ${tipTotal.toFixed(2)}.` : ""} ${tx(sale.isInventoryPosted ? "Inventory posted." : "Inventory posting pending. Review the sales register.")}`,
      });
    } catch (err) {
      if (isUncertain(err)) {
        setUncertain(true);
        setNotice({ tone: "bad", text: tx("Sale outcome is uncertain. Check the sales register before starting another payment.") });
      } else {
        fail(err, "The operation could not be completed. Please try again.");
        if (isConflict(err) && ticket) await reloadTicket(ticket.id);
      }
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  };

  async function openSession(gateStoreId: string, cashierName: string, terminal: string, openingFloat: string | number) {
    const amount = Number.parseFloat(String(openingFloat ?? ""));
    if (!gateStoreId) { setNotice({ tone: "bad", text: tx("Select a POS location before starting a cashier session.") }); return; }
    if (!Number.isFinite(amount) || amount < MIN_OPENING_FLOAT_ETB) {
      setNotice({ tone: "bad", text: tx("Opening cash float is required before a cashier session can begin.") });
      return;
    }
    await sessionState.open({ storeId: gateStoreId, cashierName: cashierName.trim(), terminal: terminal.trim() || "POS-1", openingFloat: amount });
  }

  const onStoreChange = (id: string) => {
    setStoreId(id);
    const store = ws.stores.find((x) => x.id === id);
    if (store) setActiveStore(store.id, store.name);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F2" && view === "ORDER") { event.preventDefault(); document.getElementById("rpos-search")?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view]);

  const workspace = (
    <div className="rpos-shell">
      <header className="rpos-header">
        <div>
          <h1>{tx("Point of sale")}</h1>
          <p className="rpos-muted">
            {cashierMode ? tx("Cashier: all tables, waiter assignment and payment.") : tx("Waiter mode: your tables and tickets. A cashier takes payment.")}
          </p>
        </div>
        <div className="rpos-chip-row">
          <span className={online ? "rpos-badge rpos-badge--ok" : "rpos-badge rpos-badge--bad"}>{tx(online ? "Online" : "Offline · checkout unavailable")}</span>
          <span className="rpos-badge"><UserRound size={14} aria-hidden="true" /> {ws.actor?.name ?? "…"}</span>
          {view !== "FLOOR" ? (
            <Button type="button" size="sm" variant="outline" onClick={requestBack} disabled={busy}>
              <LayoutGrid size={15} aria-hidden="true" /> {tx("Floor")}
            </Button>
          ) : null}
        </div>
      </header>

      {cashierMode && sessionState.session ? (
        <SessionBanner session={sessionState.session} onClose={() => navigate(`/companies/${companyId}/sales/pos/session`)} />
      ) : null}

      {ws.error ? <p className="rpos-alert" role="alert">{ws.error}</p> : null}
      {notice ? (
        <div className={notice.tone === "ok" ? "rpos-notice rpos-notice--ok" : "rpos-notice rpos-notice--bad"} role="status" aria-live="polite">
          <span>{notice.text}</span>
          {notice.sale && receipt ? (
            <Button type="button" size="sm" variant="outline" onClick={() => printHtml(receiptHtml(receipt, tx))}>
              <Printer size={14} aria-hidden="true" /> {tx("Print receipt")}
            </Button>
          ) : null}
          {notice.sale ? (
            <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/companies/${companyId}/sales/list`)}>{tx("Sales register")}</Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={() => setNotice(null)} aria-label={tx("Dismiss")}>×</Button>
        </div>
      ) : null}

      {view === "FLOOR" ? (
        <PosFloorView
          floor={ws.floor}
          loading={ws.loading || ws.floorLoading}
          actor={ws.actor}
          now={now}
          onRefresh={() => void ws.refreshFloor()}
          onTable={onTable}
          onOpenTicket={(summary) => void openTicket(summary)}
          onNewTicket={() => startTicket("takeAway")}
          onCounterSale={cashierMode ? () => { setTicket(null); setCounter(true); dispatchDraft({ type: "CLEAR" }); setView("ORDER"); } : undefined}
        />
      ) : (
        <main className="rpos-order">
          {view === "PAY" ? (
            <PosPaymentPanel
              title={counter ? tx("Counter sale payment") : `${tx("Payment")} · ${tx("Ticket")} ${ticket?.ticketNo ?? ""}`}
              total={totals.total}
              payers={payers}
              tips={tipCtx}
              tipNote={tipNote}
              busy={busy}
              disabledReason={paymentDisabledReason}
              onChange={changePayers}
              onAddPayer={addPayer}
              onSplitEvenly={splitPayers}
              onConfirm={() => void confirmPayment()}
              onBack={() => setView("ORDER")}
            />
          ) : (
            <PosMenuPanel items={ws.menu} loading={ws.loading && ws.menu.length === 0} error={ws.menuError}
              disabled={busy || uncertain || (!counter && !ticket?.canEdit)} onAdd={addItem} />
          )}
          <PosTicketPanel
            ticket={ticket}
            counter={counter}
            draft={draft}
            totals={totals}
            waiters={ws.waiters}
            floor={ws.floor}
            busy={busy}
            canPay={cashierMode && view !== "PAY"}
            payBlockedReason={payBlockedReason}
            onDraftChange={dispatchDraft}
            onClearDraft={() => dispatchDraft({ type: "CLEAR" })}
            onSend={() => void sendDraft()}
            onPay={startPayment}
            onPrintCheck={ticket && chargeLines.length > 0 && draft.length === 0 ? printGuestCheck : undefined}
            onBack={requestBack}
            onAssignWaiter={(waiter) => void assignWaiter(waiter)}
            onMoveTable={moveTable}
            onVoidLine={(line) => { setVoidReason(""); setVoidLine(line); }}
            onCancelTicket={() => { setCancelReason(""); setCancelOpen(true); }}
          />
          {view === "ORDER" && draft.length > 0 ? (
            // Phones show the menu first; keep the next step within thumb reach.
            <div className="rpos-mobile-bar" role="region" aria-label={tx("Not sent yet")}>
              <span>{tx("{count} items not sent", { count: draft.reduce((sum, item) => sum + item.qty, 0) })}</span>
              {counter ? (
                <Button type="button" disabled={busy || !!payBlockedReason} onClick={startPayment}>{tx("Take payment")}</Button>
              ) : (
                <Button type="button" disabled={busy || !ticket?.canEdit} onClick={() => void sendDraft()}>{tx("Send order")}</Button>
              )}
            </div>
          ) : null}
        </main>
      )}

      <PosDialog
        open={!!newTicket}
        title={newTicket?.orderType === "dineIn" ? `${tx("Open table")} ${newTicket.tableLabel}` : tx("New ticket")}
        confirmText={tx("Open ticket")}
        busy={busy}
        confirmDisabled={!newTicket || !(Number(newTicket.guests) >= 1) || (newTicket.orderType === "dineIn" && !newTicket.tableId)}
        onConfirm={() => void createTicket()}
        onClose={() => setNewTicket(null)}
      >
        {newTicket ? (
          <div className="rpos-form-grid">
            {newTicket.orderType !== "dineIn" ? (
              <label className="rpos-field">
                <span>{tx("Service Type")}</span>
                <Select value={newTicket.orderType} onChange={(e) => setNewTicket({ ...newTicket, orderType: e.target.value as PosOrderType })}>
                  {ORDER_TYPES.filter((x) => x.value !== "dineIn").map((x) => <option key={x.value} value={x.value}>{tx(x.label)}</option>)}
                </Select>
              </label>
            ) : null}
            <label className="rpos-field">
              <span>{tx("Guest Count")}</span>
              <Input type="number" min={1} max={500} value={newTicket.guests} onChange={(e) => setNewTicket({ ...newTicket, guests: e.target.value })} />
            </label>
            <label className="rpos-field">
              <span>{tx("Waiter")}</span>
              {cashierMode ? (
                <Select value={newTicket.waiter} onChange={(e) => setNewTicket({ ...newTicket, waiter: e.target.value })}>
                  <option value="">{tx("Unassigned")}</option>
                  {ws.waiters.map((waiter) => (
                    <option key={waiterKey(waiter)} value={waiterKey(waiter)}>
                      {waiter.name}{waiter.openTickets ? ` (${tx("{count} open", { count: waiter.openTickets })})` : ""}
                    </option>
                  ))}
                </Select>
              ) : <strong>{ws.actor?.name}</strong>}
            </label>
            <label className="rpos-field">
              <span>{tx("Customer / Guest")}</span>
              <Input value={newTicket.customerName} maxLength={200} placeholder={tx("Walk-in customer")}
                onChange={(e) => setNewTicket({ ...newTicket, customerName: e.target.value })} />
            </label>
            <label className="rpos-field rpos-span-all">
              <span>{tx("Service Note")}</span>
              <Textarea rows={2} maxLength={500} value={newTicket.note} onChange={(e) => setNewTicket({ ...newTicket, note: e.target.value })} />
            </label>
          </div>
        ) : null}
      </PosDialog>

      <PosDialog open={!!tableChoice} title={`${tx("Table")} ${tableChoice?.label ?? ""}`} confirmText={tx("Close")}
        description={tx("This table has more than one open ticket. Choose one.")} onConfirm={() => setTableChoice(null)} onClose={() => setTableChoice(null)}>
        <div className="rpos-ticket-list">
          {tableChoice?.tickets.map((summary) => (
            <Button key={summary.id} type="button" variant="outline" className="rpos-ticket-row"
              onClick={() => { setTableChoice(null); void openTicket(summary); }}>
              <strong>{summary.ticketNo}</strong><span>{summary.waiterName || tx("No waiter")}</span>
              <span>{tx("{count} guests", { count: summary.guestCount })}</span>
            </Button>
          ))}
        </div>
      </PosDialog>

      <PosDialog open={!!voidLine} danger title={`${tx("Void")} ${voidLine?.itemName ?? ""}`} confirmText={tx("Void item")} busy={busy}
        description={tx("Voided items stay on the ticket history but are not charged.")}
        confirmDisabled={voidReason.trim().length < 3} onConfirm={() => void confirmVoid()} onClose={() => setVoidLine(null)}>
        <label className="rpos-field">
          <span>{tx("Reason")}</span>
          <Textarea rows={2} maxLength={300} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} required />
        </label>
      </PosDialog>

      <PosDialog open={cancelOpen} danger title={`${tx("Cancel ticket")} ${ticket?.ticketNo ?? ""}`} confirmText={tx("Cancel ticket")} busy={busy}
        description={tx("The table is freed and nothing is charged. This cannot be undone.")}
        confirmDisabled={cancelReason.trim().length < 3} onConfirm={() => void confirmCancel()} onClose={() => setCancelOpen(false)}>
        <label className="rpos-field">
          <span>{tx("Reason")}</span>
          <Textarea rows={2} maxLength={500} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required />
        </label>
      </PosDialog>

      <ConfirmModal open={leaveOpen} title={tx("Leave without sending?")}
        message={tx("Items you picked have not been sent to the ticket and will be discarded.")}
        confirmText={tx("Discard items")} cancelText={tx("Keep editing")} danger onClose={() => setLeaveOpen(false)} onConfirm={backToFloor} />
    </div>
  );

  if (!ws.actor && ws.loading) return <div className="erp-pos-page rpos-page"><p className="rpos-muted">{tx("Loading POS...")}</p></div>;

  // Cashiers work inside an open cash session; waiters take orders without one.
  if (!cashierMode) return <div className="erp-pos-page rpos-page">{workspace}</div>;

  return (
    <div className="erp-pos-page rpos-page">
      <SessionGate
        loading={sessionState.loading || ws.loading}
        session={sessionState.session}
        busy={sessionState.busy}
        error={sessionState.error || (notice?.tone === "bad" ? notice.text : null)}
        stores={ws.stores}
        storesLoading={ws.loading}
        storesError={null}
        selectedStoreId={storeId}
        onStoreChange={onStoreChange}
        onOpen={openSession}
        onClose={sessionState.close}
      >
        {sessionState.session ? workspace : null}
      </SessionGate>
    </div>
  );
}
