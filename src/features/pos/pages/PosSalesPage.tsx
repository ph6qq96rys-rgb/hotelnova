import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Inbox, LayoutGrid, Percent, Printer, UserRound } from "lucide-react";

import ConfirmModal from "../../../components/ConfirmModal";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useAppScope } from "../../../app/useAppScope";
import { useI18n } from "../../../i18n";
import { useUnsavedChanges } from "../../eventmanagment/components/useUnsavedChanges";
import { useHasPermission } from "../../../auth/usePermissions";
import { posApi, setActiveStore, tryGetStoreId } from "../api/posApi";
import {
  holdRequires,
  posServiceApi,
  waiterKey,
  type HoldOrderRequest,
  type TableServiceState,
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
import { HoldReasonPicker, PosHoldDialog } from "../components/PosHoldDialog";
import { PosTableStateDialog } from "../components/PosTableStateDialog";
import { PosMenuPanel } from "../components/PosMenuPanel";
import { PosPaymentPanel } from "../components/PosPaymentPanel";
import { PosTicketPanel, type PendingTicket } from "../components/PosTicketPanel";
import { money } from "../components/posUi";
import { SessionBanner, SessionGate } from "../components/SessionGate";
import { usePosSession } from "../hooks/usePosSession";
import { usePosWorkspace } from "../hooks/usePosWorkspace";
import type { MenuItemDto } from "../types/posTypes";
import { buildTotals } from "../utils/checkoutPolicy";
import { cartReducer, itemBlockReason, owedLines, round2, selectedChargeLines, ticketChargeLines } from "../utils/posCart";
import { documentHtml, printHtml, tipSuggestionsHtml } from "../utils/posPrint";
import type { CartItem } from "../types/posTypes";
import { buildPayments, newPayer, paymentProblem, splitEvenly, type PayerDraft, type TipContext } from "../utils/posTips";
import { extractApiError } from "../utils/posUtils";
import { TABLE_STATUS_TEXT } from "../utils/posTables";
import "../pos-workspace.css";
import "../pos-service.css";

type View = "FLOOR" | "ORDER" | "PAY";
/** A new order that is saved together with its first items (see PendingTicket). */
type NewTicketForm = PendingTicket & {
  tableId: string;
  tableLabel: string;
};

const MIN_OPENING_FLOAT_ETB = 1;

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
  const [searchParams, setSearchParams] = useSearchParams();
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
  /** The sale just paid: its receipt is printed from the server's record (legal fields, COPY on reprint). */
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const canDiscount = useHasPermission("sales.discount.approve");
  const canOverridePrice = useHasPermission("pos.price.override");
  /** Split check: ticket line id → quantity this guest pays. Null pays everything still owed. */
  const [splitSel, setSplitSel] = useState<Record<string, number> | null>(null);
  const [splitDraft, setSplitDraft] = useState<Record<string, number> | null>(null);
  const [discount, setDiscount] = useState<{ amount: number; reason: string } | null>(null);
  const [discountDraft, setDiscountDraft] = useState<{ mode: "amount" | "percent"; value: string; reason: string } | null>(null);
  const [priceEdit, setPriceEdit] = useState<{ item: CartItem; price: string; reason: string } | null>(null);
  const submitLock = useRef(false);
  // Same id for every retry of one payment, so a lost response never charges the guest twice.
  const attemptKey = useRef<string | null>(null);

  const [newTicket, setNewTicket] = useState<NewTicketForm | null>(null);
  const [tableChoice, setTableChoice] = useState<{ label: string; tickets: PosTicketSummaryDto[] } | null>(null);
  const [voidLine, setVoidLine] = useState<PosTicketLineDto | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  /** Hold reason being entered (only when the branch requires a reason). */
  const [holdTicket, setHoldTicket] = useState<{ reason: string } | null>(null);
  const [tableState, setTableState] = useState<(PosFloorTableDto & { area: string }) | null>(null);

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
    setTicket(null); setCounter(false); setNewTicket(null); dispatchDraft({ type: "CLEAR" }); setView("FLOOR"); setNotice(null); setUncertain(false); attemptKey.current = null;
  }, [companyId, branchId]);

  useEffect(() => {
    if (sessionState.session?.storeId) setStoreId(sessionState.session.storeId);
  }, [sessionState.session?.id, sessionState.session?.storeId]);

  // A counter sale and a new order not yet saved are priced from the items picked so far.
  const pricedFromDraft = counter || (!!newTicket && !ticket);
  const chargeLines = useMemo(() => (pricedFromDraft ? draft : splitSel ? selectedChargeLines(ticket, ws.menu, splitSel) : ticketChargeLines(ticket, ws.menu)),
    [pricedFromDraft, draft, splitSel, ticket, ws.menu]);
  const totals = useMemo(() => buildTotals(chargeLines, discount?.amount ?? 0), [chargeLines, discount?.amount]);
  const owedQty = useMemo(() => owedLines(ticket).reduce((sum, line) => sum + line.quantity, 0), [ticket]);

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

  // A discount changes the bill: a single payer follows it, several payers start again.
  useEffect(() => {
    if (view !== "PAY") return;
    setPayers((current) => current.length <= 1 ? [current[0] ? { ...current[0], amount: totals.total.toFixed(2) } : newPayer(totals.total)] : [newPayer(totals.total)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** Guest check from the server: the same prices, VAT and header the receipt will carry. */
  const printGuestCheck = async (channel: "browser" | "printer") => {
    if (!ticket) return;
    setBusy(true);
    try {
      const doc = await posServiceApi.guestCheck(scope, ticket.id, storeId || null, channel);
      if (channel === "browser") printHtml(documentHtml(doc, tx, tipSuggestionsHtml(doc.total, doc.taxTotal, ws.tipSettings, tipCtx.offered, tx)));
      else setNotice({ tone: "ok", text: tx("Guest check sent to the receipt printer.") });
    } catch (err) {
      fail(err, "The guest check could not be printed.");
    } finally {
      setBusy(false);
    }
  };

  const printReceipt = async (channel: "browser" | "printer") => {
    if (!lastSaleId) return;
    try {
      const doc = await posServiceApi.receipt(scope, lastSaleId, channel);
      if (channel === "browser") printHtml(documentHtml(doc, tx));
      else setNotice({ tone: "ok", text: tx(doc.copyNo > 1 ? "Receipt copy sent to the printer." : "Receipt sent to the printer."), sale: true });
    } catch (err) {
      fail(err, "The receipt could not be printed.");
    }
  };

  const openCashDrawer = async () => {
    if (!storeId) return;
    try {
      await posServiceApi.openDrawer(scope, storeId);
      setNotice({ tone: "ok", text: tx("The cash drawer opens in a moment.") });
    } catch (err) {
      fail(err, "The cash drawer could not be opened.");
    }
  };

  const applyDiscount = () => {
    if (!discountDraft) return;
    const value = Number(discountDraft.value);
    const gross = chargeLines.reduce((sum, line) => sum + line.lineTotal, 0);
    const amount = round2(discountDraft.mode === "percent" ? gross * value / 100 : value);
    setDiscount(amount > 0 ? { amount: Math.min(amount, round2(gross)), reason: discountDraft.reason.trim() } : null);
    setDiscountDraft(null);
  };

  const savePrice = () => {
    if (!priceEdit) return;
    dispatchDraft({ type: "SET_PRICE", id: priceEdit.item.id, price: Number(priceEdit.price), reason: priceEdit.reason });
    setPriceEdit(null);
  };

  const startSplit = () => {
    setSplitDraft(Object.fromEntries(owedLines(ticket).map((line) => [line.id, 0])));
  };

  const confirmSplit = () => {
    if (!splitDraft) return;
    const chosen = Object.fromEntries(Object.entries(splitDraft).filter(([, qty]) => qty > 0));
    setSplitDraft(null);
    if (Object.keys(chosen).length === 0) return;
    setSplitSel(chosen);
    setDiscount(null);
  };

  const backToFloor = () => {
    setTicket(null); setCounter(false); setNewTicket(null); dispatchDraft({ type: "CLEAR" }); setView("FLOOR"); setLeaveOpen(false);
    setPayers([]); setSplitSel(null); setDiscount(null);
    void ws.refreshFloor();
  };

  const requestBack = () => (draft.length > 0 ? setLeaveOpen(true) : backToFloor());

  const openTicket = async (summary: PosTicketSummaryDto) => {
    setNotice(null);
    setBusy(true);
    try {
      const loaded = await posServiceApi.ticket(scope, summary.id);
      dispatchDraft({ type: "CLEAR" });
      setSplitSel(null); setDiscount(null);
      setCounter(false); setNewTicket(null);
      setTicket(loaded);
      setView("ORDER");
    } catch (err) {
      fail(err, "The ticket could not be loaded.");
    } finally {
      setBusy(false);
    }
  };

  // Opened from Held Orders: /sales/pos?ticket=<id> goes straight to that ticket.
  const linkedTicket = searchParams.get("ticket");
  useEffect(() => {
    if (!linkedTicket || !ws.actor) return;
    setSearchParams((params) => { params.delete("ticket"); return params; }, { replace: true });
    void openTicket({ id: linkedTicket } as PosTicketSummaryDto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedTicket, ws.actor]);

  /**
   * Hold Order for an order built item-first: the waiter (or the server chosen by a cashier)
   * and the table are recorded, or the items join the table's existing order.
   */
  const holdNewOrder = async (request: Omit<HoldOrderRequest, "items">, summary: { tableLabel?: string; waiterName?: string | null; appendTo?: string }) => {
    if (draft.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const held = await posServiceApi.holdOrder(scope, { ...request, items: draft.map((item) => ({ menuItemId: item.id, quantity: item.qty })) });
      setHoldOpen(false);
      backToFloor();
      const where = summary.tableLabel ? ` · ${tx("Table")} ${summary.tableLabel}` : held.customerName ? ` · ${held.customerName}` : "";
      setNotice({ tone: "ok", text: summary.appendTo
        ? tx("Items added to {ticket}{where}. The order is on hold.", { ticket: held.ticketNo, where })
        : tx("Order {ticket} held{where}{waiter}.", { ticket: held.ticketNo, where, waiter: held.waiterName ? ` · ${held.waiterName}` : "" }) });
    } catch (err) {
      fail(err, "The order could not be put on hold.");
      if (isConflict(err)) void ws.refreshFloor();
    } finally {
      setBusy(false);
    }
  };

  /** Holds the open ticket (sending any unsent items with it), or saves and holds a new table order. */
  const holdCurrent = async (reason: string) => {
    const holdReason = reason.trim() || null;
    if (!ticket && newTicket) {
      const waiter = ws.waiters.find((x) => waiterKey(x) === newTicket.waiter);
      await holdNewOrder({
        orderType: newTicket.orderType,
        tableId: newTicket.orderType === "dineIn" ? newTicket.tableId || null : null,
        waiterEmployeeId: waiter?.employeeId ?? null,
        waiterUserId: waiter?.employeeId ? null : waiter?.userId ?? null,
        guestCount: Number(newTicket.guests) || null,
        customerName: newTicket.customerName.trim() || null,
        note: newTicket.note.trim() || null,
        holdReason,
      }, { tableLabel: newTicket.tableLabel || undefined });
      setHoldTicket(null);
      return;
    }
    if (!ticket) return;
    const done = await ticketAction(() => posServiceApi.holdTicket(scope, ticket.id, ticket.version, holdReason,
      draft.length ? draft.map((item) => ({ menuItemId: item.id, quantity: item.qty })) : undefined));
    if (done) {
      dispatchDraft({ type: "CLEAR" });
      setHoldTicket(null);
      backToFloor();
      setNotice({ tone: "ok", text: tx("Order {ticket} held{where}{waiter}.", { ticket: done.ticketNo, where: done.tableLabel ? ` · ${tx("Table")} ${done.tableLabel}` : "", waiter: done.waiterName ? ` · ${done.waiterName}` : "" }) });
    }
  };

  /** Hold in one tap; a reason is asked for only when the branch requires one. */
  const requestHold = () => {
    if (ws.serviceSettings?.requireHoldReason) setHoldTicket({ reason: "" });
    else void holdCurrent("");
  };

  const saveTableState = async (state: TableServiceState, note: string) => {
    if (!tableState) return;
    setBusy(true);
    setNotice(null);
    try {
      const updated = await posServiceApi.setTableState(scope, tableState.id, state, note);
      setTableState(null);
      setNotice({ tone: "ok", text: tx("Table {table} is now {status}.", { table: updated.number, status: tx(TABLE_STATUS_TEXT[updated.status]).toLowerCase() }) });
      void ws.refreshFloor();
    } catch (err) {
      fail(err, "The table status could not be changed.");
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

  /** Tapping a free table (or Take-away ticket) goes straight to the menu; the order is saved with its first items. */
  const startTicket = (orderType: PosOrderType, table?: PosFloorTableDto, areaName?: string) => {
    const tableLabel = table ? `${table.number}${areaName ? ` · ${areaName}` : ""}` : "";
    setNotice(null);
    setTicket(null); setCounter(false); setSplitSel(null); setDiscount(null);
    dispatchDraft({ type: "CLEAR" });
    setNewTicket({
      title: orderType === "dineIn" ? `${tx("Table")} ${tableLabel}` : tx("New take-away ticket"),
      orderType,
      tableId: table?.id ?? "",
      tableLabel,
      guests: orderType === "dineIn" ? String(Math.min(2, Math.max(1, table?.seats ?? 2))) : "1",
      waiter: ownWaiterKey,
      customerName: "",
      note: "",
    });
    setView("ORDER");
  };

  /** Why the new order cannot be saved yet. */
  const pendingProblem = (() => {
    if (!newTicket) return null;
    if (newTicket.orderType === "dineIn" && !newTicket.tableId) return "Choose a table.";
    if (!(Number(newTicket.guests) >= 1)) return "Enter the number of guests.";
    if (cashierMode && holdRequires(ws.serviceSettings, newTicket.orderType).waiter && !newTicket.waiter) return "Choose the waiter serving this order.";
    return null;
  })();

  const onTable = (table: PosFloorTableDto, areaName: string, tickets: PosTicketSummaryDto[]) => {
    if (table.tickets.length === 0) {
      // New orders go only to available tables; a supervisor may seat a reservation.
      if (table.status === "available" || (table.status === "reserved" && cashierMode)) startTicket("dineIn", table, areaName);
      else setTableState({ ...table, area: areaName });
    }
    else if (tickets.length === 1) void openTicket(tickets[0]);
    else if (tickets.length > 1) setTableChoice({ label: table.number, tickets });
  };

  /** Saves a new order with its first items; the kitchen gets them as round 1. */
  const createTicketWithItems = async (): Promise<PosTicketDto | null> => {
    if (!newTicket || draft.length === 0 || pendingProblem) return null;
    const waiter = ws.waiters.find((x) => waiterKey(x) === newTicket.waiter);
    setBusy(true);
    setNotice(null);
    try {
      const created = await posServiceApi.openTicket(scope, {
        orderType: newTicket.orderType,
        tableId: newTicket.orderType === "dineIn" ? newTicket.tableId || null : null,
        guestCount: Number(newTicket.guests),
        waiterEmployeeId: waiter?.employeeId ?? null,
        waiterUserId: waiter?.employeeId ? null : waiter?.userId ?? null,
        customerName: newTicket.customerName.trim() || null,
        note: newTicket.note.trim() || null,
        items: draft.map((item) => ({ menuItemId: item.id, quantity: item.qty })),
      });
      dispatchDraft({ type: "CLEAR" });
      setNewTicket(null);
      void ws.refreshFloor();
      void ws.refreshWaiters();
      return created;
    } catch (err) {
      // The items stay on screen: if the table was just taken, the message says by which order.
      fail(err, "The order could not be sent.");
      void ws.refreshFloor();
      return null;
    } finally {
      setBusy(false);
    }
  };

  const sentNotice = (sent: PosTicketDto) => setNotice({ tone: "ok", text: tx("Order {ticket} sent{where}.", {
    ticket: sent.ticketNo, where: sent.tableLabel ? ` · ${tx("Table")} ${sent.tableLabel}` : sent.customerName ? ` · ${sent.customerName}` : "",
  }) });

  const addItem = (item: MenuItemDto) => {
    if (busy || uncertain) return;
    const blocked = itemBlockReason(item);
    if (blocked) { setNotice({ tone: "bad", text: blocked }); return; }
    dispatchDraft({ type: "ADD", item });
  };

  const sendDraftToTicket = () => ticketAction(async () => {
    const updated = await posServiceApi.addItems(scope, ticket!.id, ticket!.version,
      draft.map((item) => ({ menuItemId: item.id, quantity: item.qty })));
    dispatchDraft({ type: "CLEAR" });
    return updated;
  });

  /** Send order: the items go to the kitchen and the floor is shown again, ready for the next table. */
  const sendOrder = async () => {
    const sent = ticket ? await sendDraftToTicket() : await createTicketWithItems();
    if (!sent) return;
    backToFloor();
    sentNotice(sent);
  };

  /** Take payment straight away: unsent items are sent first, so there is no separate Send step. */
  const payNow = async () => {
    if (!counter && draft.length > 0) {
      const sent = ticket ? await sendDraftToTicket() : await createTicketWithItems();
      if (!sent) return;
      setTicket(sent);
    }
    startPayment();
  };

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
    if (!sessionState.session) return "Open a cashier session to take payment.";
    if (!counter && draft.length > 0) return newTicket ? pendingProblem : null; // sent automatically before payment
    if (totals.total <= 0) return "The transaction total must be greater than zero.";
    return null;
  })();

  const paymentDisabledReason = (() => {
    if (payBlockedReason) return payBlockedReason;
    if (!storeId) return "Select a POS location before processing the sale.";
    if (discount && discount.reason.length < 3) return "Give a reason for the discount.";
    return paymentProblem(payers, tipCtx);
  })();

  const confirmPayment = async () => {
    if (submitLock.current || paymentDisabledReason) return;
    submitLock.current = true;
    setBusy(true);
    setNotice(null);
    const payments = buildPayments(payers, tipCtx);
    attemptKey.current ??= crypto.randomUUID();
    const clientRequestId = attemptKey.current;
    const discountReason = discount ? discount.reason : null;
    const splitLines = !counter && splitSel
      ? Object.entries(splitSel).filter(([, quantity]) => quantity > 0).map(([lineId, quantity]) => ({ lineId, quantity }))
      : undefined;
    try {
      const sale = counter
        ? await posApi.createSale(scope, {
            companyId: scope.companyId, branchId: scope.branchId, storeId,
            discountAmount: totals.discount, taxAmount: totals.tax, serviceChargeAmount: totals.serviceCharge, clientRequestId, discountReason,
            lines: draft.map((item) => ({
              menuItemId: item.id, quantity: item.qty, unitPrice: item.price,
              priceOverride: item.listPrice !== undefined ? item.price : null, priceOverrideReason: item.listPrice !== undefined ? item.overrideReason : null,
            })),
            payments,
            service: { orderType: "takeAway" },
          })
        : await posServiceApi.settle(scope, ticket!.id, {
            version: ticket!.version, storeId,
            discountAmount: totals.discount, taxAmount: totals.tax, serviceChargeAmount: totals.serviceCharge, clientRequestId, discountReason, payments,
            lines: splitLines,
          });
      attemptKey.current = null;
      const label = counter ? "" : ` · ${tx("Ticket")} ${ticket!.ticketNo}`;
      const tipTotal = payments.reduce((sum, x) => sum + x.tipAmount, 0);
      setLastSaleId(sale.id);
      // After a split check the rest of the ticket stays open for the next guest.
      const rest = splitLines ? await posServiceApi.ticket(scope, ticket!.id).catch(() => null) : null;
      if (rest && rest.status === "open") {
        setTicket(rest); setSplitSel(null); setDiscount(null); setPayers([]); setView("ORDER");
        void ws.refreshFloor();
      } else {
        backToFloor();
      }
      setNotice({
        tone: "ok",
        sale: true,
        text: `${tx("Sale saved")}: ${sale.saleNo ?? sale.id}${label}.${tipTotal > 0 ? ` ${tx("Tips recorded")}: ${tipTotal.toFixed(2)}.` : ""} ${tx(sale.isInventoryPosted ? "Inventory posted." : "Inventory posting pending. Review the sales register.")}`,
      });
    } catch (err) {
      if (isUncertain(err)) {
        // Keep the key: confirming again returns the saved sale if this one went through.
        setUncertain(true);
        setNotice({ tone: "bad", text: tx("The connection dropped before the sale was confirmed. Confirm payment again: the guest will not be charged twice.") });
      } else {
        attemptKey.current = null;
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
          {cashierMode && storeId ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void openCashDrawer()} disabled={busy} title={tx("Open the cash drawer without a sale")}>
              <Inbox size={15} aria-hidden="true" /> {tx("Open drawer")}
            </Button>
          ) : null}
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
          {notice.sale && lastSaleId ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => void printReceipt("browser")}>
                <Printer size={14} aria-hidden="true" /> {tx("Print receipt")}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void printReceipt("printer")}>
                <Printer size={14} aria-hidden="true" /> {tx("Send to printer")}
              </Button>
            </>
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
          onNewOrder={() => { setTicket(null); setNewTicket(null); setCounter(true); dispatchDraft({ type: "CLEAR" }); setView("ORDER"); }}
          onTableStatus={(table, area) => setTableState({ ...table, area })}
        />
      ) : (
        <main className="rpos-order">
          {view === "PAY" ? (
            <PosPaymentPanel
              title={counter ? tx("Counter sale payment") : `${tx("Payment")} · ${tx("Ticket")} ${ticket?.ticketNo ?? ""}${splitSel ? ` · ${tx("selected items")}` : ""}`}
              adjustments={canDiscount || discount ? (
                <div className="rpos-chip-row">
                  {discount ? (
                    <span className="rpos-badge">{tx("Discount")} -{discount.amount.toFixed(2)} · {discount.reason}</span>
                  ) : null}
                  {canDiscount ? (
                    <Button type="button" size="sm" variant="outline" disabled={busy}
                      onClick={() => setDiscountDraft({ mode: "amount", value: discount ? String(discount.amount) : "", reason: discount?.reason ?? "" })}>
                      <Percent size={14} aria-hidden="true" /> {tx(discount ? "Change discount" : "Add discount")}
                    </Button>
                  ) : null}
                  {discount ? <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setDiscount(null)}>{tx("Remove discount")}</Button> : null}
                </div>
              ) : null}
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
              onBack={() => { setView("ORDER"); setDiscount(null); }}
            />
          ) : (
            <PosMenuPanel items={ws.menu} loading={ws.loading && ws.menu.length === 0} error={ws.menuError}
              disabled={busy || uncertain || (!counter && !newTicket && !ticket?.canEdit)} onAdd={addItem} />
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
            waiterMode={!cashierMode}
            payBlockedReason={payBlockedReason}
            onDraftChange={dispatchDraft}
            onClearDraft={() => dispatchDraft({ type: "CLEAR" })}
            onSend={() => void sendOrder()}
            onPay={() => void payNow()}
            onHold={counter
              ? draft.length > 0 ? () => setHoldOpen(true) : undefined
              : newTicket
                ? draft.length > 0 && !pendingProblem ? requestHold : undefined
                : ticket?.canEdit && (draft.length > 0 || ticket.lines.some((line) => !line.isVoided)) ? requestHold : undefined}
            onPrintCheck={ticket && chargeLines.length > 0 && draft.length === 0 ? () => void printGuestCheck("browser") : undefined}
            onSendCheck={ticket && cashierMode && chargeLines.length > 0 && draft.length === 0 ? () => void printGuestCheck("printer") : undefined}
            onSplitItems={ticket && cashierMode && view !== "PAY" && draft.length === 0 && owedQty > 1 ? startSplit : undefined}
            splitActive={!!splitSel}
            onClearSplit={view !== "PAY" ? () => setSplitSel(null) : undefined}
            onEditPrice={counter && canOverridePrice ? (item) => setPriceEdit({ item, price: item.price.toFixed(2), reason: item.overrideReason ?? "" }) : undefined}
            onBack={requestBack}
            onAssignWaiter={(waiter) => void assignWaiter(waiter)}
            onMoveTable={moveTable}
            onVoidLine={(line) => { setVoidReason(""); setVoidLine(line); }}
            onCancelTicket={() => { setCancelReason(""); setCancelOpen(true); }}
            pending={newTicket}
            pendingWaiterEditable={cashierMode}
            pendingWaiterName={ws.actor?.name}
            pendingProblem={pendingProblem}
            onPendingChange={(patch) => setNewTicket((current) => current ? { ...current, ...patch } : current)}
          />
          {view === "ORDER" && draft.length > 0 ? (
            // Phones show the menu first; keep the next step within thumb reach.
            <div className="rpos-mobile-bar" role="region" aria-label={tx("Not sent yet")}>
              <span>{tx("{count} items not sent", { count: draft.reduce((sum, item) => sum + item.qty, 0) })}</span>
              {counter ? (
                <>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setHoldOpen(true)}>{tx("Hold order")}</Button>
                  {cashierMode ? <Button type="button" disabled={busy || !!payBlockedReason} onClick={startPayment}>{tx("Take payment")}</Button> : null}
                </>
              ) : (
                <Button type="button" disabled={busy || (newTicket ? !!pendingProblem : !ticket?.canEdit)} onClick={() => void sendOrder()}>{tx("Send order")}</Button>
              )}
            </div>
          ) : null}
        </main>
      )}

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

      <PosHoldDialog open={holdOpen} busy={busy} floor={ws.floor} waiters={ws.waiters} actor={ws.actor} ownWaiterKey={ownWaiterKey}
        settings={ws.serviceSettings} itemCount={draft.reduce((sum, item) => sum + item.qty, 0)} itemTotal={totals.total}
        onClose={() => setHoldOpen(false)} onConfirm={(request, summary) => void holdNewOrder(request, summary)} />

      <PosDialog open={!!holdTicket} title={`${tx("Hold order")} ${ticket?.ticketNo ?? newTicket?.title ?? ""}`} confirmText={tx("Hold order")} busy={busy}
        description={draft.length ? tx("Unsent items are sent with the order before it is put on hold.") : undefined}
        confirmDisabled={!!ws.serviceSettings?.requireHoldReason && !holdTicket?.reason.trim()}
        onConfirm={() => void holdCurrent(holdTicket?.reason ?? "")} onClose={() => setHoldTicket(null)}>
        <HoldReasonPicker reasons={ws.serviceSettings?.holdReasons ?? []} value={holdTicket?.reason ?? ""}
          required={ws.serviceSettings?.requireHoldReason} onChange={(reason) => setHoldTicket({ reason })} />
      </PosDialog>

      <PosTableStateDialog table={tableState} busy={busy} canManage={cashierMode} onClose={() => setTableState(null)}
        onSave={(state, note) => void saveTableState(state, note)}
        onSeat={tableState ? () => { const t = tableState; setTableState(null); startTicket("dineIn", t, t.area); } : undefined} />

      <PosDialog open={!!splitDraft} title={tx("Split by items")} confirmText={tx("Pay selected items")} busy={busy}
        description={tx("Choose what this guest pays for. The rest of the ticket stays open for the next payment.")}
        confirmDisabled={!splitDraft || !Object.values(splitDraft).some((qty) => qty > 0)}
        onConfirm={() => { confirmSplit(); startPayment(); }} onClose={() => setSplitDraft(null)}>
        <div className="rpos-ticket-lines">
          {owedLines(ticket).map((line) => (
            <div key={line.id} className="rpos-line">
              <span className="rpos-line-name">{line.itemName}<small>{tx("{count} on the ticket", { count: line.quantity })} · {money(line.unitPrice)}</small></span>
              <Input type="number" inputMode="decimal" min={0} max={line.quantity} step={1} aria-label={`${tx("Quantity to pay")} ${line.itemName}`}
                value={String(splitDraft?.[line.id] ?? 0)}
                onChange={(e) => setSplitDraft((current) => ({ ...(current ?? {}), [line.id]: Math.max(0, Math.min(line.quantity, Number(e.target.value) || 0)) }))} />
              <Button type="button" size="sm" variant="outline" onClick={() => setSplitDraft((current) => ({ ...(current ?? {}), [line.id]: line.quantity }))}>{tx("All")}</Button>
            </div>
          ))}
        </div>
      </PosDialog>

      <PosDialog open={!!discountDraft} title={tx("Discount")} confirmText={tx("Apply discount")}
        description={tx("A discount needs your discount approval right and a reason; both are recorded on the sale.")}
        confirmDisabled={!discountDraft || !(Number(discountDraft.value) > 0) || (discountDraft.mode === "percent" && Number(discountDraft.value) > 100) || discountDraft.reason.trim().length < 3}
        onConfirm={applyDiscount} onClose={() => setDiscountDraft(null)}>
        {discountDraft ? (
          <div className="rpos-form-grid">
            <label className="rpos-field">
              <span>{tx("Discount type")}</span>
              <Select value={discountDraft.mode} onChange={(e) => setDiscountDraft({ ...discountDraft, mode: e.target.value as "amount" | "percent" })}>
                <option value="amount">{tx("Amount")}</option>
                <option value="percent">{tx("Percent of the bill")}</option>
              </Select>
            </label>
            <label className="rpos-field">
              <span>{tx(discountDraft.mode === "percent" ? "Percent" : "Amount")}</span>
              <Input type="number" inputMode="decimal" min={0} step="0.01" value={discountDraft.value} autoFocus
                onChange={(e) => setDiscountDraft({ ...discountDraft, value: e.target.value })} />
            </label>
            <label className="rpos-field rpos-span-all">
              <span>{tx("Reason")}</span>
              <Textarea rows={2} maxLength={300} value={discountDraft.reason} onChange={(e) => setDiscountDraft({ ...discountDraft, reason: e.target.value })} required />
            </label>
          </div>
        ) : null}
      </PosDialog>

      <PosDialog open={!!priceEdit} title={`${tx("Change price")} ${priceEdit?.item.name ?? ""}`} confirmText={tx("Change price")}
        description={tx("The new price and the reason are recorded on the sale as a price override.")}
        confirmDisabled={!priceEdit || !(Number(priceEdit.price) >= 0) || priceEdit.price === "" || priceEdit.reason.trim().length < 3}
        onConfirm={savePrice} onClose={() => setPriceEdit(null)}>
        {priceEdit ? (
          <div className="rpos-form-grid">
            <label className="rpos-field">
              <span>{tx("Unit price")}</span>
              <Input type="number" inputMode="decimal" min={0} step="0.01" value={priceEdit.price} autoFocus
                onChange={(e) => setPriceEdit({ ...priceEdit, price: e.target.value })} />
            </label>
            <p className="rpos-muted">{tx("Menu price")}: {money(priceEdit.item.listPrice ?? priceEdit.item.price)}</p>
            <label className="rpos-field rpos-span-all">
              <span>{tx("Reason")}</span>
              <Textarea rows={2} maxLength={300} value={priceEdit.reason} onChange={(e) => setPriceEdit({ ...priceEdit, reason: e.target.value })} required />
            </label>
          </div>
        ) : null}
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
