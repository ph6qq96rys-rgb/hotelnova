import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  CreditCard,
  MapPin,
  PauseCircle,
  ReceiptText,
  Search,
  ShoppingBag,
  Trash2,
  Utensils,
} from "lucide-react";
import { SessionBanner, SessionGate } from "../components/SessionGate";
import {
  Button,
  Card,
  ensurePosStyles,
  money,
  Pill,
} from "../components/posUi";
import { usePosCatalog } from "../hooks/usePosCatalog";
import { usePosSession } from "../hooks/usePosSession";
import type { CartItem, MenuItemDto, PaymentMethod } from "../types/posTypes";
import {
  posApi,
  setActiveStore,
  tryGetStoreId,
  type PosStoreDto,
} from "../api/posApi";
import { useAppScope } from "../../../app/useAppScope";
import { extractApiError } from "../utils/posUtils";

ensurePosStyles();

type OrderType = "DINE_IN" | "TAKE_AWAY" | "DELIVERY" | "ROOM_SERVICE";
type PosView = "MENU" | "PAYMENT" | "HELD_ORDERS";
type PaymentState = "IDLE" | "VALIDATING" | "POSTING";

type HeldOrder = {
  id: string;
  orderNo: string;
  orderType: OrderType;
  tableNo: string;
  guestCount: number;
  customerName: string;
  note: string;
  cart: CartItem[];
  createdAt: string;
};

type OrderContext = {
  orderNo: string;
  orderType: OrderType;
  tableNo: string;
  guestCount: number;
  customerName: string;
  orderNote: string;
};

type CartAction =
  | { type: "ADD"; item: MenuItemDto }
  | { type: "INCREMENT"; id: string }
  | { type: "DECREMENT"; id: string }
  | { type: "REMOVE"; id: string }
  | { type: "REPLACE"; items: CartItem[] }
  | { type: "CLEAR" };

const TAX_RATE = 0.08;
const DEFAULT_ORDER_TYPE: OrderType = "DINE_IN";
const MIN_OPENING_FLOAT_ETB = 1;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function nowTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function buildOrderNo(): string {
  const d = new Date();
  return `POS-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function newOrderContext(): OrderContext {
  return {
    orderNo: buildOrderNo(),
    orderType: DEFAULT_ORDER_TYPE,
    tableNo: "",
    guestCount: 1,
    customerName: "",
    orderNote: "",
  };
}

function orderTypeLabel(value: OrderType): string {
  switch (value) {
    case "DINE_IN":
      return "Dine In";
    case "TAKE_AWAY":
      return "Take Away";
    case "DELIVERY":
      return "Delivery";
    case "ROOM_SERVICE":
      return "Room Service";
    default:
      return value;
  }
}

function storeLabel(store: PosStoreDto): string {
  return store.code ? `${store.name} (${store.code})` : store.name;
}

function itemBlockReason(item: MenuItemDto): string | null {
  if (item.isActive === false)
    return `${item.name} is inactive and cannot be added to the order.`;
  if (item.isAvailableForSale === false)
    return `${item.name} is not currently available for POS sale.`;
  if (item.hasRecipe === false)
    return `${item.name} cannot be sold because no production recipe is configured.`;
  if (item.hasConsumptionLocation === false)
    return `${item.name} cannot be sold because the inventory consumption location is not configured.`;
  return null;
}

function toCartItem(item: MenuItemDto): CartItem {
  const price = round2(Number(item.sellingPrice || 0));

  return {
    id: item.id,
    name: item.name,
    categoryName: item.categoryName,
    price,
    qty: 1,
    lineTotal: price,
    hasRecipe: item.hasRecipe,
    hasConsumptionLocation: item.hasConsumptionLocation,
    isAvailableForSale: item.isAvailableForSale,
    code: item.code,
  };
}

function recalc(item: CartItem, qty: number): CartItem {
  return { ...item, qty, lineTotal: round2(item.price * qty) };
}

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case "ADD": {
      const existing = state.find((x) => x.id === action.item.id);
      if (!existing) return [...state, toCartItem(action.item)];

      return state.map((x) =>
        x.id === action.item.id ? recalc(x, x.qty + 1) : x,
      );
    }

    case "INCREMENT":
      return state.map((x) => (x.id === action.id ? recalc(x, x.qty + 1) : x));

    case "DECREMENT":
      return state
        .map((x) => (x.id === action.id ? recalc(x, x.qty - 1) : x))
        .filter((x) => x.qty > 0);

    case "REMOVE":
      return state.filter((x) => x.id !== action.id);

    case "REPLACE":
      return action.items.map((x) =>
        recalc(x, Math.max(1, Number(x.qty || 1))),
      );

    case "CLEAR":
      return [];

    default:
      return state;
  }
}

function buildTotals(cart: CartItem[]) {
  const subtotal = round2(cart.reduce((sum, item) => sum + item.lineTotal, 0));
  const discount = 0;
  const serviceCharge = 0;
  const tax = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + tax + serviceCharge - discount);

  return { subtotal, discount, serviceCharge, tax, total };
}

function validateCheckout(args: {
  storeId: string;
  cart: CartItem[];
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered: string;
  referenceCode: string;
  orderContext: OrderContext;
}): string | null {
  if (!args.storeId) return "Select a POS location before processing the sale.";
  if (args.cart.length === 0)
    return "At least one item must be added before checkout.";
  if (args.total <= 0)
    return "The transaction total must be greater than zero.";

  if (
    args.orderContext.orderType === "DINE_IN" &&
    !args.orderContext.tableNo.trim()
  ) {
    return "Table number is required for dine-in service.";
  }

  if (args.orderContext.guestCount <= 0) {
    return "Guest count must be one or greater.";
  }

  const blocked = args.cart.find(
    (x) =>
      x.isAvailableForSale === false ||
      x.hasRecipe === false ||
      x.hasConsumptionLocation === false,
  );

  if (blocked) {
    return `${blocked.name} is not ready for sale. Refresh the menu catalogue or contact the supervisor.`;
  }

  if (args.paymentMethod === "CASH") {
    const tendered = Number(args.amountTendered || 0);

    if (!Number.isFinite(tendered) || tendered < 0) {
      return "Enter a valid cash amount received from the customer.";
    }

    if (tendered < args.total) {
      return "Cash received is insufficient to complete the transaction.";
    }
  }

  if (args.paymentMethod !== "CASH" && !args.referenceCode.trim()) {
    return "Payment reference is required for card, mobile, and transfer payments.";
  }

  return null;
}

export function PosSalesPage() {
  const { companyId, branchId } = useAppScope();
  const sessionState = usePosSession({ companyId, branchId });

  const [clock, setClock] = useState(nowTime());
  const [view, setView] = useState<PosView>("MENU");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const [stores, setStores] = useState<PosStoreDto[]>([]);
  const [storeId, setStoreId] = useState<string>(tryGetStoreId() ?? "");
  const [loadingStores, setLoadingStores] = useState(false);

  const [cart, dispatchCart] = useReducer(cartReducer, []);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [orderContext, setOrderContext] = useState<OrderContext>(() =>
    newOrderContext(),
  );

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [amountTendered, setAmountTendered] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [paymentState, setPaymentState] = useState<PaymentState>("IDLE");
  const [message, setMessage] = useState<string | null>(null);

  const catalog = usePosCatalog({ companyId, branchId }, Boolean(sessionState.session), search);
  const paying = paymentState !== "IDLE";

  useEffect(() => {
    const id = window.setInterval(() => setClock(nowTime()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStores() {
      if (!companyId || !branchId) {
        setStores([]);
        setStoreId("");
        setMessage(
          "Company and branch context are required before loading POS locations.",
        );
        setLoadingStores(false);
        return;
      }

      setLoadingStores(true);
      setMessage(null);

      try {
        const rows = await posApi.stores({ companyId, branchId });
        if (cancelled) return;

        const activeStores = rows
          .filter((x) => x.isActive !== false)
          .sort((a, b) => storeLabel(a).localeCompare(storeLabel(b)));

        setStores(activeStores);

        const current = tryGetStoreId();
        const currentStillExists =
          current && activeStores.some((x) => x.id === current);

        if (currentStillExists) {
          setStoreId(current);
          return;
        }

        if (activeStores.length === 1) {
          const onlyStore = activeStores[0];
          setStoreId(onlyStore.id);
          setActiveStore(onlyStore.id, onlyStore.name);
        }
      } catch (err) {
        if (!cancelled) setMessage(extractApiError(err, "The operation could not be completed. Please try again."));
      } finally {
        if (!cancelled) setLoadingStores(false);
      }
    }

    void loadStores();

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  const selectedStore = useMemo(
    () => stores.find((x) => x.id === storeId) ?? null,
    [stores, storeId],
  );
  const totals = useMemo(() => buildTotals(cart), [cart]);
  const changeDue = round2(Number(amountTendered || 0) - totals.total);

  const categories = useMemo(() => {
    return ["All", ...(catalog.categories ?? []).filter((x) => x !== "All")];
  }, [catalog.categories]);

  const filteredItems = useMemo(() => {
    const items = catalog.menuItems ?? [];
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesCategory =
        category === "All" || item.categoryName === category;

      const matchesSearch =
        !q ||
        item.name?.toLowerCase().includes(q) ||
        item.categoryName?.toLowerCase().includes(q) ||
        item.code?.toLowerCase().includes(q) ||
        item.externalCode?.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [catalog.menuItems, category, search]);

  const setOrderField = useCallback(
    <K extends keyof OrderContext>(key: K, value: OrderContext[K]) => {
      setOrderContext((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  function onStoreChange(nextStoreId: string) {
    setStoreId(nextStoreId);

    const store = stores.find((x) => x.id === nextStoreId);

    if (store) {
      setActiveStore(store.id, store.name);
      setMessage(null);
    }
  }

  const resetOrder = useCallback(() => {
    dispatchCart({ type: "CLEAR" });
    setOrderContext(newOrderContext());
    setAmountTendered("");
    setReferenceCode("");
    setPaymentMethod("CASH");
    setView("MENU");
  }, []);

  const holdOrder = useCallback(() => {
    if (cart.length === 0 || paying) return;

    const held: HeldOrder = {
      id: safeId(),
      orderNo: orderContext.orderNo,
      orderType: orderContext.orderType,
      tableNo: orderContext.tableNo,
      guestCount: orderContext.guestCount,
      customerName: orderContext.customerName,
      note: orderContext.orderNote,
      cart,
      createdAt: new Date().toISOString(),
    };

    setHeldOrders((prev) => [held, ...prev]);
    resetOrder();
    setMessage(`Order ${held.orderNo} placed on hold successfully.`);
  }, [cart, orderContext, paying, resetOrder]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        document.getElementById("pos-search")?.focus();
      }

      if (e.key === "F5") {
        e.preventDefault();
        holdOrder();
      }

      if (e.key === "F8") {
        e.preventDefault();
        setView("PAYMENT");
      }

      if (e.key === "Escape") {
        setMessage(null);
        setView("MENU");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [holdOrder]);

  function addItem(item: MenuItemDto) {
    const blocked = itemBlockReason(item);
    if (blocked) {
      setMessage(blocked);
      return;
    }

    dispatchCart({ type: "ADD", item });
    setMessage(null);
  }

  function resumeOrder(held: HeldOrder) {
    setOrderContext({
      orderNo: held.orderNo,
      orderType: held.orderType,
      tableNo: held.tableNo,
      guestCount: held.guestCount,
      customerName: held.customerName,
      orderNote: held.note,
    });
    dispatchCart({ type: "REPLACE", items: held.cart });
    setHeldOrders((prev) => prev.filter((x) => x.id !== held.id));
    setView("MENU");
    setMessage(`Held order ${held.orderNo} restored successfully.`);
  }

  async function openSession(
    gateStoreId: string,
    cashierName: string,
    terminal: string,
    openingFloat: string | number,
  ): Promise<void> {
    const amount = Number.parseFloat(String(openingFloat ?? ""));

    if (!gateStoreId) {
      setMessage("Select a POS location before starting a cashier session.");
      return;
    }

    if (!Number.isFinite(amount)) {
      setMessage(
        "Opening cash float is required before a cashier session can begin.",
      );
      return;
    }

    if (amount < MIN_OPENING_FLOAT_ETB) {
      setMessage(
        `Opening cash float must be at least ${MIN_OPENING_FLOAT_ETB.toFixed(2)} ETB.`,
      );
      return;
    }

    setMessage(null);

    await sessionState.open({
      storeId: gateStoreId,
      cashierName: cashierName.trim(),
      terminal: terminal.trim() || "POS-1",
      openingFloat: amount,
    });
  }

  async function confirmPayment() {
    if (paying) return;

    if (!companyId || !branchId) {
      setMessage(
        "Company and branch context are required before processing a sale.",
      );
      return;
    }

    const validationError = validateCheckout({
      storeId,
      cart,
      total: totals.total,
      paymentMethod,
      amountTendered,
      referenceCode,
      orderContext,
    });

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setPaymentState("POSTING");
    setMessage(null);

    try {
      const sale = await posApi.createSale(
        { companyId, branchId },
        {
        companyId,
        branchId,
        storeId,
        discountAmount: totals.discount,
        taxAmount: totals.tax,
        serviceChargeAmount: totals.serviceCharge,
        lines: cart.map((x) => ({
          menuItemId: x.id,
          quantity: x.qty,
          unitPrice: x.price,
        })),
        payments: [
          {
            method: paymentMethod,
            amount: totals.total,
            referenceCode: referenceCode.trim() || null,
          },
        ],
      },
      );

      resetOrder();
      setMessage(`Sale ${sale.saleNo ?? "document"} completed successfully.`);
    } catch (err) {
      setMessage(extractApiError(err, "The operation could not be completed. Please try again."));
    } finally {
      setPaymentState("IDLE");
    }
  }

  return (
    <div className="erp-pos-page">
      <style>{css}</style>

      <SessionGate
        loading={sessionState.loading || loadingStores}
        session={sessionState.session}
        busy={sessionState.busy}
        error={sessionState.error || message}
        stores={stores}
        storesLoading={loadingStores}
        storesError={null}
        selectedStoreId={storeId}
        onStoreChange={onStoreChange}
        onOpen={openSession}
        onClose={sessionState.close}
      >
        {sessionState.session && (
          <div className="erp-pos-shell">
            <SessionBanner
              session={sessionState.session}
              onClose={() => sessionState.close(0)}
            />

            <header className="erp-pos-header">
              <div>
                <div className="erp-pos-title">
                  Hotel Nova POS Workstation
                </div>
                <div className="erp-pos-subtitle">
                  Order {orderContext.orderNo} -{" "}
                  {orderTypeLabel(orderContext.orderType)} - {clock}
                </div>
              </div>

              <div className="erp-pos-header-actions">
                <select
                  className="erp-pos-store-select"
                  value={storeId}
                  onChange={(e) => onStoreChange(e.target.value)}
                  disabled={Boolean(sessionState.session)}
                >
                  <option value="">
                    {loadingStores
                      ? "Loading locations..."
                      : "Select POS location"}
                  </option>

                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {storeLabel(store)}
                    </option>
                  ))}
                </select>

                <Pill tone="green">SESSION ACTIVE</Pill>
                <Pill tone="gold">
                  Terminal {sessionState.session.terminal || "POS-1"}
                </Pill>
                <Pill>{sessionState.session.cashierName || "Cashier"}</Pill>
              </div>
            </header>

            {(message || catalog.error) && (
              <Card className="erp-pos-message">
                <span
                  className={
                    message?.includes("successfully") ||
                    message?.includes("restored")
                      ? "ok"
                      : "bad"
                  }
                >
                  {message || catalog.error}
                </span>
              </Card>
            )}

            <section className="erp-pos-toolbar">
              <Button
                onClick={() => setView("MENU")}
                variant={view === "MENU" ? "gold" : "ghost"}
                title="Menu"
              >
                <Utensils size={16} /> Menu
              </Button>
              <Button
                onClick={() => setView("HELD_ORDERS")}
                variant={view === "HELD_ORDERS" ? "gold" : "ghost"}
                title="Held orders"
              >
                <PauseCircle size={16} /> Held Orders ({heldOrders.length})
              </Button>
              <Button onClick={holdOrder} title="Hold order">
                <PauseCircle size={16} /> Hold
              </Button>
              <Button
                onClick={() => setView("PAYMENT")}
                variant={view === "PAYMENT" ? "gold" : "ghost"}
                title="Payment"
              >
                <CreditCard size={16} /> Payment
              </Button>
              <Button onClick={resetOrder} variant="danger" title="Cancel order">
                <Trash2 size={16} /> Cancel
              </Button>
            </section>

            <section className="erp-pos-metrics" aria-label="Current POS order summary">
              <div>
                <span>Lines</span>
                <strong>{cart.length}</strong>
              </div>
              <div>
                <span>Items</span>
                <strong>{cart.reduce((sum, item) => sum + item.qty, 0)}</strong>
              </div>
              <div>
                <span>Subtotal</span>
                <strong>{money(totals.subtotal)}</strong>
              </div>
              <div className="accent">
                <span>Total</span>
                <strong>{money(totals.total)}</strong>
              </div>
            </section>

            <main className="erp-pos-workspace">
              <aside className="erp-pos-left">
                <Card className="erp-service-card">
                  <div className="erp-section-title">Service Context</div>

                  <label className="erp-pos-label">Operating Location</label>
                  <select
                    className="erp-pos-input"
                    value={storeId}
                    onChange={(e) => onStoreChange(e.target.value)}
                    disabled={Boolean(sessionState.session)}
                  >
                    <option value="">
                      {loadingStores
                        ? "Loading locations..."
                        : "Select POS location"}
                    </option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {storeLabel(store)}
                      </option>
                    ))}
                  </select>

                  {selectedStore && (
                    <div className="erp-location-note">
                      <MapPin size={13} />
                      <span>{storeLabel(selectedStore)}</span>
                    </div>
                  )}

                  <label className="erp-pos-label">Service Type</label>
                  <select
                    className="erp-pos-input"
                    value={orderContext.orderType}
                    onChange={(e) =>
                      setOrderField("orderType", e.target.value as OrderType)
                    }
                  >
                    <option value="DINE_IN">Dine In</option>
                    <option value="TAKE_AWAY">Take Away</option>
                    <option value="DELIVERY">Delivery</option>
                    <option value="ROOM_SERVICE">Room Service</option>
                  </select>

                  <div className="erp-pos-mini-grid">
                    <div>
                      <label className="erp-pos-label">Table / Room No.</label>
                      <input
                        className="erp-pos-input"
                        value={orderContext.tableNo}
                        onChange={(e) =>
                          setOrderField("tableNo", e.target.value)
                        }
                        placeholder="T-01 / 205"
                      />
                    </div>

                    <div>
                      <label className="erp-pos-label">Guest Count</label>
                      <input
                        className="erp-pos-input"
                        type="number"
                        min={1}
                        value={orderContext.guestCount}
                        onChange={(e) =>
                          setOrderField(
                            "guestCount",
                            Math.max(1, Number(e.target.value || 1)),
                          )
                        }
                      />
                    </div>
                  </div>

                  <label className="erp-pos-label">Customer / Guest</label>
                  <input
                    className="erp-pos-input"
                    value={orderContext.customerName}
                    onChange={(e) =>
                      setOrderField("customerName", e.target.value)
                    }
                    placeholder="Walk-in customer"
                  />

                  <label className="erp-pos-label">Service Note</label>
                  <textarea
                    className="erp-pos-input"
                    rows={3}
                    value={orderContext.orderNote}
                    onChange={(e) => setOrderField("orderNote", e.target.value)}
                    placeholder="Kitchen, service, allergy, or delivery note"
                  />
                </Card>

                <Card className="erp-order-snapshot">
                  <div className="erp-section-title">Order Snapshot</div>
                  <div className="erp-snapshot-row">
                    <span>Service</span>
                    <strong>{orderTypeLabel(orderContext.orderType)}</strong>
                  </div>
                  <div className="erp-snapshot-row">
                    <span>Table / Room</span>
                    <strong>{orderContext.tableNo || "Unassigned"}</strong>
                  </div>
                  <div className="erp-snapshot-row">
                    <span>Guest</span>
                    <strong>{orderContext.customerName || "Walk-in"}</strong>
                  </div>
                </Card>
              </aside>

              <section className="erp-pos-center">
                {view === "MENU" && (
                  <>
                    <Card className="erp-menu-control-card">
                      <div className="erp-search-card">
                        <Search size={18} />
                      <input
                        id="pos-search"
                        className="erp-pos-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search item, category, code, or barcode"
                      />
                      <div className="erp-pos-help">
                        F5 Hold - F8 Payment - Esc Return to Menu
                      </div>
                      </div>

                      <div className="erp-category-strip" aria-label="Menu categories">
                        {categories.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={
                              c === category
                                ? "erp-category active"
                                : "erp-category"
                            }
                            onClick={() => setCategory(c)}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </Card>

                    <div className="erp-menu-grid">
                      {catalog.loadingMenu && (
                        <Card>Loading menu catalogue...</Card>
                      )}
                      {!catalog.loadingMenu && filteredItems.length === 0 && (
                        <Card>No matching menu items were found.</Card>
                      )}

                      {filteredItems.map((item) => {
                        const blockedReason = itemBlockReason(item);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={
                              blockedReason
                                ? "erp-menu-card unavailable"
                                : "erp-menu-card"
                            }
                            onClick={() => addItem(item)}
                            title={blockedReason ?? "Ready for Sale"}
                          >
                            <div>
                              <div className="erp-menu-name">{item.name}</div>
                              <div className="erp-menu-category">
                                {item.categoryName || "Uncategorized"}
                              </div>
                            </div>

                            <div className="erp-menu-bottom">
                              <strong>
                                {money(Number(item.sellingPrice || 0))}
                              </strong>
                              {blockedReason ? (
                                <span>Sale Blocked</span>
                              ) : (
                                <span>Ready for Sale</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {view === "HELD_ORDERS" && (
                  <Card>
                    <div className="erp-section-title">Held Orders</div>
                    {heldOrders.length === 0 ? (
                      <div className="erp-muted">
                        There are currently no held orders.
                      </div>
                    ) : (
                      <div className="erp-held-list">
                        {heldOrders.map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            className="erp-held-order"
                            onClick={() => resumeOrder(h)}
                          >
                            <strong>{h.orderNo}</strong>
                            <span>
                              {orderTypeLabel(h.orderType)} -{" "}
                              {h.tableNo || "No table assigned"} -{" "}
                              {h.cart.length} lines
                            </span>
                            <span>
                              {new Date(h.createdAt).toLocaleTimeString()}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {view === "PAYMENT" && (
                  <Card>
                    <div className="erp-section-title">Payment Processing</div>

                    <div className="erp-payment-methods">
                      {(
                        [
                          "CASH",
                          "CARD",
                          "MOBILE",
                          "TRANSFER",
                        ] as PaymentMethod[]
                      ).map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={
                            paymentMethod === m
                              ? "erp-payment active"
                              : "erp-payment"
                          }
                          onClick={() => setPaymentMethod(m)}
                        >
                          {m.replace("_", " ")}
                        </button>
                      ))}
                    </div>

                    <div className="erp-pos-mini-grid">
                      <div>
                        <label className="erp-pos-label">Cash Received</label>
                        <input
                          className="erp-pos-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={amountTendered}
                          onChange={(e) => setAmountTendered(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="erp-pos-label">
                          Payment Reference
                        </label>
                        <input
                          className="erp-pos-input"
                          value={referenceCode}
                          onChange={(e) => setReferenceCode(e.target.value)}
                          placeholder="Card, mobile, transfer, or bank reference"
                        />
                      </div>
                    </div>

                    <div className="erp-payment-total">
                      <span>Amount Payable</span>
                      <strong>{money(totals.total)}</strong>
                    </div>

                    <div className="erp-payment-total small">
                      <span>Change to Return</span>
                      <strong>
                        {paymentMethod === "CASH"
                          ? money(Math.max(changeDue, 0))
                          : money(0)}
                      </strong>
                    </div>

                    <Button
                      variant="gold"
                      loading={paying}
                      onClick={confirmPayment}
                      style={{ width: "100%", marginTop: 16 }}
                    >
                      Complete Sale
                    </Button>
                  </Card>
                )}
              </section>

              <aside className="erp-pos-right">
                <Card className="erp-order-card">
                  <div className="erp-order-header">
                    <div>
                      <div className="erp-section-title">Active Order</div>
                      <div className="erp-muted">
                        <ShoppingBag size={13} /> {cart.length} line{cart.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Pill tone="gold">
                      {orderTypeLabel(orderContext.orderType)}
                    </Pill>
                  </div>

                  <div className="erp-cart-lines">
                    {cart.length === 0 ? (
                      <div className="erp-empty-cart">
                        Select menu items to start a new order.
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div key={item.id} className="erp-cart-line">
                          <div className="erp-cart-line-main">
                            <strong>{item.name}</strong>
                            <span>
                              {money(item.price)} -{" "}
                              {item.categoryName || "Menu"}
                            </span>
                          </div>

                          <div className="erp-cart-controls">
                            <button
                              type="button"
                              onClick={() =>
                                dispatchCart({ type: "DECREMENT", id: item.id })
                              }
                            >
                              -
                            </button>
                            <span>{item.qty}</span>
                            <button
                              type="button"
                              onClick={() =>
                                dispatchCart({ type: "INCREMENT", id: item.id })
                              }
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() =>
                                dispatchCart({ type: "REMOVE", id: item.id })
                              }
                            >
                              
                            </button>
                          </div>

                          <div className="erp-cart-line-total">
                            {money(item.lineTotal)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="erp-totals">
                    <div>
                      <span>Subtotal</span>
                      <strong>{money(totals.subtotal)}</strong>
                    </div>
                    <div>
                      <span>Discount</span>
                      <strong>{money(totals.discount)}</strong>
                    </div>
                    <div>
                      <span>Service Charge</span>
                      <strong>{money(totals.serviceCharge)}</strong>
                    </div>
                    <div>
                      <span>Tax</span>
                      <strong>{money(totals.tax)}</strong>
                    </div>
                    <div className="grand">
                      <span>Net Total</span>
                      <strong>{money(totals.total)}</strong>
                    </div>
                  </div>

                  <div className="erp-order-actions">
                    <Button onClick={holdOrder}>
                      <PauseCircle size={16} /> Hold
                    </Button>
                    <Button onClick={() => setView("PAYMENT")} variant="gold">
                      <ReceiptText size={16} /> Complete Payment
                    </Button>
                  </div>
                </Card>
              </aside>
            </main>
          </div>
        )}
      </SessionGate>
    </div>
  );
}

const css = `
.erp-pos-page {
  background: #09090b;
  color: #fafaf9;
  min-height: 100%;
  padding: 16px;
  overflow-x: hidden;
}

.erp-pos-store-select {
  border: 1px solid #3f3f46;
  background: #111113;
  color: #fafaf9;
  border-radius: 999px;
  padding: 8px 12px;
  min-width: 190px;
}

.erp-pos-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: calc(100vh - 32px);
}

.erp-pos-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
}

.erp-pos-title {
  font-size: 24px;
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: 0;
}

.erp-pos-subtitle,
.erp-muted {
  color: #a1a1aa;
  font-size: 12px;
}

.erp-pos-header-actions,
.erp-pos-toolbar,
.erp-order-actions,
.erp-payment-methods {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
}

.erp-pos-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 360px;
  gap: 12px;
  align-items: start;
  min-width: 0;
}

.erp-pos-left,
.erp-pos-center,
.erp-pos-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.erp-section-title {
  font-size: 13px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: .04em;
  margin-bottom: 10px;
}

.erp-pos-label {
  display: block;
  margin-top: 12px;
  margin-bottom: 5px;
  font-size: 11px;
  font-weight: 800;
  color: #d4d4d8;
}

.erp-pos-input,
.erp-pos-search {
  width: 100%;
  border: 1px solid #3f3f46;
  background: #111113;
  color: #fafaf9;
  border-radius: 10px;
  padding: 10px 12px;
}

.erp-pos-mini-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.erp-category-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.erp-category,
.erp-payment,
.erp-held-order {
  border: 1px solid #3f3f46;
  background: #111113;
  color: #fafaf9;
  border-radius: 8px;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  min-height: 42px;
}

.erp-category.active,
.erp-payment.active {
  border-color: #f59e0b;
  background: #29210f;
}

.erp-search-card {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.erp-pos-help {
  white-space: nowrap;
  color: #a1a1aa;
  font-size: 12px;
}

.erp-menu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
}

.erp-menu-card {
  min-height: 126px;
  border: 1px solid #3f3f46;
  background: #18181b;
  color: #fafaf9;
  border-radius: 8px;
  padding: 14px;
  text-align: left;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
}

.erp-menu-card.unavailable {
  opacity: .55;
  cursor: not-allowed;
}

.erp-menu-name {
  font-weight: 900;
}

.erp-menu-category,
.erp-menu-bottom span {
  color: #a1a1aa;
  font-size: 12px;
}

.erp-menu-bottom,
.erp-order-header,
.erp-payment-total,
.erp-totals div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.erp-cart-lines,
.erp-held-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.erp-empty-cart {
  color: #a1a1aa;
  padding: 18px 0;
  text-align: center;
}

.erp-cart-line {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  align-items: center;
  border-bottom: 1px solid #27272a;
  padding: 8px 0;
  min-width: 0;
}

.erp-cart-line-main span {
  display: block;
  color: #a1a1aa;
  font-size: 12px;
}

.erp-cart-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.erp-cart-controls button {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid #3f3f46;
  background: #111113;
  color: #fafaf9;
  cursor: pointer;
}

.erp-cart-controls .danger {
  color: #fca5a5;
}

.erp-cart-line-total {
  font-weight: 900;
  text-align: right;
}

.erp-totals {
  border-top: 1px solid #27272a;
  margin-top: 12px;
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.erp-totals .grand,
.erp-payment-total {
  font-size: 18px;
  font-weight: 900;
}

.erp-payment-total.small {
  font-size: 14px;
  color: #a1a1aa;
  margin-top: 8px;
}

.erp-pos-message .ok { color: #86efac; }
.erp-pos-message .bad { color: #fca5a5; }

@media (max-width: 1180px) {
  .erp-pos-workspace {
    grid-template-columns: 1fr;
  }

  .erp-pos-left {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .erp-pos-left > * {
    min-width: 0;
  }

  .erp-pos-right {
    position: sticky;
    bottom: 0;
    z-index: 5;
  }
}

@media (max-width: 760px) {
  .erp-pos-page {
    padding: 10px;
  }

  .erp-pos-shell {
    min-height: auto;
  }

  .erp-pos-header {
    flex-direction: column;
    align-items: stretch;
  }

  .erp-pos-title {
    font-size: 20px;
  }

  .erp-pos-header-actions,
  .erp-pos-toolbar,
  .erp-order-actions,
  .erp-payment-methods {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .erp-pos-header-actions > *,
  .erp-pos-toolbar > *,
  .erp-order-actions > *,
  .erp-payment-methods > * {
    width: 100%;
  }

  .erp-pos-store-select {
    min-width: 0;
    width: 100%;
    border-radius: 8px;
  }

  .erp-pos-left {
    grid-template-columns: 1fr;
  }

  .erp-pos-mini-grid {
    grid-template-columns: 1fr;
  }

  .erp-search-card {
    align-items: stretch;
    flex-direction: column;
  }

  .erp-pos-help {
    white-space: normal;
  }

  .erp-menu-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .erp-menu-card {
    min-height: 112px;
    padding: 12px;
  }

  .erp-cart-line {
    grid-template-columns: 1fr auto;
  }

  .erp-cart-line-total {
    grid-column: 1 / -1;
    text-align: left;
  }
}

@media (max-width: 430px) {
  .erp-pos-header-actions,
  .erp-pos-toolbar,
  .erp-order-actions,
  .erp-payment-methods {
    display: grid;
    grid-template-columns: 1fr;
  }

  .erp-menu-grid {
    grid-template-columns: 1fr;
  }
}

.erp-pos-page {
  background:
    linear-gradient(180deg, #101014 0%, #09090b 42%, #0d0d10 100%);
}

.erp-pos-shell {
  gap: 10px;
}

.erp-pos-header {
  align-items: center;
  padding: 10px 0 2px;
}

.erp-pos-title {
  font-size: 22px;
  font-weight: 850;
}

.erp-pos-subtitle {
  margin-top: 4px;
  color: #b8b1a5;
}

.erp-pos-toolbar {
  position: sticky;
  top: 0;
  z-index: 4;
  padding: 8px;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 8px;
  background: rgba(15,15,18,.92);
  backdrop-filter: blur(16px);
}

.erp-pos-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.erp-pos-metrics > div {
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 8px;
  background: #18181b;
}

.erp-pos-metrics span {
  display: block;
  color: #a1a1aa;
  font-size: 11px;
  font-weight: 750;
  text-transform: uppercase;
}

.erp-pos-metrics strong {
  display: block;
  margin-top: 4px;
  overflow-wrap: anywhere;
  color: #fafaf9;
  font-size: 18px;
}

.erp-pos-metrics .accent {
  border-color: rgba(212,168,83,.45);
  background: rgba(212,168,83,.12);
}

.erp-pos-metrics .accent strong {
  color: #f6c86b;
}

.erp-pos-workspace {
  grid-template-columns: 270px minmax(360px, 1fr) 386px;
}

.erp-service-card,
.erp-order-card,
.erp-menu-control-card {
  box-shadow: 0 16px 40px rgba(0,0,0,.18);
}

.erp-location-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: #d4a853;
  font-size: 12px;
}

.erp-order-snapshot {
  display: grid;
  gap: 8px;
}

.erp-snapshot-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,.07);
  color: #a1a1aa;
  font-size: 12px;
}

.erp-snapshot-row strong {
  max-width: 55%;
  overflow: hidden;
  color: #fafaf9;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.erp-menu-control-card {
  display: grid;
  gap: 12px;
  padding: 12px !important;
}

.erp-search-card {
  gap: 10px;
  padding: 0;
  color: #d4a853;
}

.erp-pos-search {
  min-height: 44px;
  border-color: rgba(255,255,255,.1);
  background: #111113;
  font-size: 14px;
}

.erp-search-card .erp-pos-help {
  display: none;
}

.erp-category-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: thin;
}

.erp-category-strip .erp-category {
  flex: 0 0 auto;
  min-height: 36px;
  border-radius: 999px;
  padding: 8px 13px;
  white-space: nowrap;
}

.erp-menu-grid {
  grid-template-columns: repeat(auto-fill, minmax(162px, 1fr));
}

.erp-menu-card {
  min-height: 132px;
  border-color: rgba(255,255,255,.08);
  background: linear-gradient(180deg, #1b1b1f, #151518);
}

.erp-menu-card:hover {
  border-color: rgba(212,168,83,.55);
  background: #202024;
}

.erp-menu-bottom strong {
  color: #f6c86b;
}

.erp-order-card {
  position: sticky;
  top: 78px;
  display: grid;
  gap: 12px;
}

.erp-order-header {
  align-items: flex-start;
}

.erp-order-header .erp-muted {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.erp-cart-lines {
  max-height: min(44vh, 460px);
  overflow-y: auto;
  padding-right: 2px;
}

.erp-cart-line {
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 10px;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 8px;
  background: #111113;
}

.erp-cart-line-total {
  grid-column: 1 / -1;
  color: #f6c86b;
}

.erp-cart-controls button {
  width: 32px;
  height: 32px;
}

.erp-totals {
  margin-top: 0;
}

.erp-totals .grand {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid rgba(212,168,83,.28);
  color: #f6c86b;
}

@media (max-width: 1180px) {
  .erp-pos-workspace {
    grid-template-columns: 1fr;
  }

  .erp-order-card {
    top: auto;
  }
}

@media (max-width: 760px) {
  .erp-pos-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .erp-pos-toolbar {
    position: static;
  }

  .erp-search-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
  }

  .erp-cart-lines {
    max-height: none;
  }
}

@media (max-width: 430px) {
  .erp-pos-metrics {
    grid-template-columns: 1fr 1fr;
  }

  .erp-menu-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .erp-menu-card {
    min-height: 118px;
    padding: 10px;
  }
}
`;
