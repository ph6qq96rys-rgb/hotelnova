import { buildTotals, validateCheckout } from "../utils/checkoutPolicy";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import { useI18n } from "../../../i18n";

import { useNavigate } from "react-router-dom";
import ConfirmModal from "../../../components/ConfirmModal";
import { useUnsavedChanges } from "../../eventmanagment/components/useUnsavedChanges";
import "../pos-workspace.css";
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

const DEFAULT_ORDER_TYPE: OrderType = "DINE_IN";

const posAmharicPhrases: Record<string, string> = {
"Hold or clear the current order before restoring another.":"ሌላ ትዕዛዝ ከመመለስዎ በፊት የአሁኑን ትዕዛዝ ያቆዩ ወይም ያጽዱ።",
"Sale outcome is uncertain. Check the sales register before starting another payment.":"የሽያጩ ውጤት አልተረጋገጠም። ሌላ ክፍያ ከመጀመርዎ በፊት የሽያጭ መዝገቡን ያረጋግጡ።",
"This removes the items in the current order. Held orders are kept.":"ይህ በአሁኑ ትዕዛዝ ያሉ እቃዎችን ያስወግዳል። የተያዙ ትዕዛዞች ይቀመጣሉ።",
"Held orders are kept only while this page stays open.":"የተያዙ ትዕዛዞች ይህ ገጽ ክፍት ሲሆን ብቻ ይቀመጣሉ።",
"Local order note — not sent to the kitchen":"የአካባቢ ትዕዛዝ ማስታወሻ — ወደ ኩሽና አይላክም",
"Inventory posted.":"የእቃ እንቅስቃሴ ተመዝግቧል።",
"Inventory posting pending. Review the sales register.":"የእቃ እንቅስቃሴ ምዝገባ በመጠባበቅ ላይ ነው። የሽያጭ መዝገቡን ይመልከቱ።",
  "Point of sale": "የሽያጭ ነጥብ",
  "Online": "በመስመር ላይ",
  "Offline · checkout unavailable": "ከመስመር ውጭ · ክፍያ አይቻልም",
  "Sales register": "የሽያጭ መዝገብ",
  "Order details": "የትዕዛዝ ዝርዝር",
  "Exact amount": "ትክክለኛው መጠን",
  "Remaining to pay": "የሚቀረው ክፍያ",
  "Clear order": "ትዕዛዝ አጽዳ",
  "Keep order": "ትዕዛዝ አቆይ",
  "Clear current order?": "የአሁኑን ትዕዛዝ ማጽዳት?",
  "Remove": "አስወግድ",
  "Decrease quantity": "ብዛት ቀንስ",
  "Increase quantity": "ብዛት ጨምር",
  "All": "ሁሉም",
  "Hotel Nova POS Workstation": "የሆቴል ኖቫ POS የስራ ጣቢያ",
  "Order": "ትዕዛዝ",
  "Loading locations...": "ቦታዎች በመጫን ላይ...",
  "Select POS location": "የPOS ቦታ ይምረጡ",
  "SESSION ACTIVE": "ሴሽን ንቁ ነው",
  "Terminal": "ተርሚናል",
  "Cashier": "ካሸር",
  "Menu": "ምናሌ",
  "Held orders": "የተያዙ ትዕዛዞች",
  "Held Orders": "የተያዙ ትዕዛዞች",
  "Hold order": "ትዕዛዝ አቆይ",
  "Hold": "አቆይ",
  "Payment": "ክፍያ",
  "Cancel order": "ትዕዛዝ ሰርዝ",
  "Cancel": "ሰርዝ",
  "Current POS order summary": "የአሁኑ የPOS ትዕዛዝ ማጠቃለያ",
  "Lines": "መስመሮች",
  "Items": "እቃዎች",
  "Subtotal": "ንዑስ ድምር",
  "Total": "ጠቅላላ",
  "Service Context": "የአገልግሎት አውድ",
  "Operating Location": "የስራ ቦታ",
  "Service Type": "የአገልግሎት አይነት",
  "Dine In": "በቦታው መመገብ",
  "Take Away": "ይዞ መሄድ",
  "Delivery": "ዴሊቨሪ",
  "Room Service": "የክፍል አገልግሎት",
  "Table / Room No.": "የጠረጴዛ / ክፍል ቁጥር",
  "Guest Count": "የእንግዳ ብዛት",
  "Customer / Guest": "ደንበኛ / እንግዳ",
  "Walk-in customer": "በቀጥታ የመጣ ደንበኛ",
  "Service Note": "የአገልግሎት ማስታወሻ",
  "Kitchen, service, allergy, or delivery note": "የኩሽና፣ አገልግሎት፣ አለርጂ ወይም ዴሊቨሪ ማስታወሻ",
  "Order Snapshot": "የትዕዛዝ ማጠቃለያ",
  "Service": "አገልግሎት",
  "Table / Room": "ጠረጴዛ / ክፍል",
  "Guest": "እንግዳ",
  "Unassigned": "አልተመደበም",
  "Walk-in": "በቀጥታ የመጣ",
  "Search item, category, code, or barcode": "እቃ፣ ምድብ፣ ኮድ ወይም ባርኮድ ይፈልጉ",
  "F5 Hold - F8 Payment - Esc Return to Menu": "F5 አቆይ - F8 ክፍያ - Esc ወደ ምናሌ ተመለስ",
  "Menu categories": "የምናሌ ምድቦች",
  "Loading menu catalogue...": "የምናሌ ካታሎግ በመጫን ላይ...",
  "No matching menu items were found.": "ተዛማጅ የምናሌ እቃዎች አልተገኙም።",
  "Ready for Sale": "ለሽያጭ ዝግጁ",
  "Sale Blocked": "ሽያጭ ታግዷል",
  "Uncategorized": "ያልተመደበ",
  "There are currently no held orders.": "በአሁኑ ጊዜ የተያዙ ትዕዛዞች የሉም።",
  "No table assigned": "ጠረጴዛ አልተመደበም",
  "line": "መስመር",
  "lines": "መስመሮች",
  "Payment Processing": "ክፍያ ሂደት",
  "Cash Received": "የተቀበለ ጥሬ ገንዘብ",
  "Payment Reference": "የክፍያ ማጣቀሻ",
  "Card, mobile, transfer, or bank reference": "የካርድ፣ ሞባይል፣ ዝውውር ወይም ባንክ ማጣቀሻ",
  "Amount Payable": "መከፈል ያለበት መጠን",
  "Change to Return": "የሚመለስ ተረፈ ገንዘብ",
  "Complete Sale": "ሽያጩን አጠናቅቅ",
  "Active Order": "ንቁ ትዕዛዝ",
  "Select menu items to start a new order.": "አዲስ ትዕዛዝ ለመጀመር የምናሌ እቃዎችን ይምረጡ።",
  "Discount": "ቅናሽ",
  "Service Charge": "የአገልግሎት ክፍያ",
  "Tax": "ታክስ",
  "Net Total": "የተጣራ ድምር",
  "Complete Payment": "ክፍያ አጠናቅቅ",
  "CASH": "ጥሬ ገንዘብ",
  "CARD": "ካርድ",
  "MOBILE": "ሞባይል",
  "TRANSFER": "ዝውውር",
  "Select a POS location before processing the sale.": "ሽያጩን ከማስኬድ በፊት የPOS ቦታ ይምረጡ።",
  "At least one item must be added before checkout.": "ክፍያ ከመፈጸም በፊት ቢያንስ አንድ እቃ መጨመር አለበት።",
  "The transaction total must be greater than zero.": "የግብይቱ ጠቅላላ ድምር ከዜሮ መብለጥ አለበት።",
  "Table number is required for dine-in service.": "በቦታው መመገብ አገልግሎት የጠረጴዛ ቁጥር ያስፈልጋል።",
  "Guest count must be one or greater.": "የእንግዳ ብዛት አንድ ወይም ከዚያ በላይ መሆን አለበት።",
  "Enter a valid cash amount received from the customer.": "ከደንበኛው የተቀበለውን ትክክለኛ የጥሬ ገንዘብ መጠን ያስገቡ።",
  "Cash received is insufficient to complete the transaction.": "የተቀበለው ጥሬ ገንዘብ ግብይቱን ለማጠናቀቅ በቂ አይደለም።",
  "Payment reference is required for card, mobile, and transfer payments.": "ለካርድ፣ ሞባይል እና ዝውውር ክፍያዎች የክፍያ ማጣቀሻ ያስፈልጋል።",
  "Select a POS location before starting a cashier session.": "የካሸር ሴሽን ከመጀመር በፊት የPOS ቦታ ይምረጡ።",
  "Opening cash float is required before a cashier session can begin.": "የካሸር ሴሽን ከመጀመሩ በፊት የመክፈቻ ጥሬ ገንዘብ ያስፈልጋል።",
  "Company and branch context are required before processing a sale.": "ሽያጭ ከማስኬድ በፊት የኩባንያ እና ቅርንጫፍ አውድ ያስፈልጋል።",
  "The operation could not be completed. Please try again.": "ኦፕሬሽኑ አልተጠናቀቀም። እባክዎ እንደገና ይሞክሩ።"
};

function posText(language: string, text: string): string {
  return language === "am" ? posAmharicPhrases[text] ?? text : text;
}
const MIN_OPENING_FLOAT_ETB = 1;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;
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

function orderTypeLabel(value: OrderType, language = "en"): string {
  switch (value) {
    case "DINE_IN":
      return posText(language, "Dine In");
    case "TAKE_AWAY":
      return posText(language, "Take Away");
    case "DELIVERY":
      return posText(language, "Delivery");
    case "ROOM_SERVICE":
      return posText(language, "Room Service");
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
    pricing: item.pricing,
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

export function PosSalesPage() {
  const { language } = useI18n();
  const tx = (text: string) => posText(language, text);
  const { companyId, branchId } = useAppScope();
  const navigate = useNavigate();
  const submitLock = useRef(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [uncertain, setUncertain] = useState(false);
  const [lastSale, setLastSale] = useState<string | null>(null);
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
  useUnsavedChanges(cart.length > 0 || heldOrders.length > 0 || paying);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    dispatchCart({ type: "CLEAR" }); setHeldOrders([]); setOrderContext(newOrderContext());
    setView("MENU"); setCategory("All"); setSearch(""); setAmountTendered(""); setReferenceCode("");
    setUncertain(false); setLastSale(null);
  }, [companyId, branchId]);
  useEffect(() => {
    if (sessionState.session?.storeId) setStoreId(sessionState.session.storeId);
  }, [sessionState.session?.id, sessionState.session?.storeId]);

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
        if (!cancelled) setMessage(extractApiError(err, tx("The operation could not be completed. Please try again.")));
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
    setMessage(language === "am" ? `ትዕዛዝ ${held.orderNo} በተሳካ ሁኔታ ተይዟል።` : `Order ${held.orderNo} placed on hold successfully.`);
  }, [cart, orderContext, paying, resetOrder]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (submitLock.current || uncertain) return;
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
  }, [holdOrder, uncertain]);

  function addItem(item: MenuItemDto) {
    if (paying || uncertain) return;
    const blocked = itemBlockReason(item);
    if (blocked) {
      setMessage(blocked);
      return;
    }

    dispatchCart({ type: "ADD", item });
    setMessage(null);
  }

  function resumeOrder(held: HeldOrder) {
    if (paying || uncertain) return;
    if (cart.length > 0) { setMessage(tx("Hold or clear the current order before restoring another.")); return; }
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
    setMessage(language === "am" ? `የተያዘው ትዕዛዝ ${held.orderNo} በተሳካ ሁኔታ ተመልሷል።` : `Held order ${held.orderNo} restored successfully.`);
  }

  async function openSession(
    gateStoreId: string,
    cashierName: string,
    terminal: string,
    openingFloat: string | number,
  ): Promise<void> {
    const amount = Number.parseFloat(String(openingFloat ?? ""));

    if (!gateStoreId) {
      setMessage(tx("Select a POS location before starting a cashier session."));
      return;
    }

    if (!Number.isFinite(amount)) {
      setMessage(
        tx("Opening cash float is required before a cashier session can begin."),
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
    if (submitLock.current || paying || uncertain || !online) return;

    if (!companyId || !branchId) {
      setMessage(
        tx("Company and branch context are required before processing a sale."),
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
      setMessage(tx(validationError));
      if (validationError.includes("Table number")) document.querySelector<HTMLDetailsElement>(".erp-pos-left")?.setAttribute("open", "");
      return;
    }

    submitLock.current = true;
    setPaymentState("POSTING");
    setMessage(null);

    try {
      const sale = await posApi.createSale(
        { companyId, branchId },
        {
        companyId,
        branchId,
        storeId,
        customerName: orderContext.customerName.trim() || null,
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

      setLastSale(sale.saleNo ?? sale.id);
      resetOrder();
      setMessage(`${language === "am" ? "ሽያጩ ተቀምጧል" : "Sale saved"}: ${sale.saleNo ?? sale.id}. ${tx(sale.isInventoryPosted ? "Inventory posted." : "Inventory posting pending. Review the sales register.")}`);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const unknown = !status || status >= 500;
      setUncertain(unknown);
      setMessage(unknown ? tx("Sale outcome is uncertain. Check the sales register before starting another payment.")
        : extractApiError(err, tx("The operation could not be completed. Please try again.")));
    } finally {
      submitLock.current = false;
      setPaymentState("IDLE");
    }
  }

  return (
    <div className="erp-pos-page">
      <ConfirmModal open={discardOpen} title={tx("Clear current order?")} message={tx("This removes the items in the current order. Held orders are kept.")}
        confirmText={tx("Clear order")} cancelText={tx("Keep order")} danger busy={paying}
        onClose={() => setDiscardOpen(false)} onConfirm={() => { resetOrder(); setDiscardOpen(false); }} />

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
          <fieldset className="erp-pos-shell" disabled={paying} aria-busy={paying}>
            <SessionBanner
              session={sessionState.session}
              onClose={() => navigate(`/companies/${companyId}/sales/pos/session`)}
            />

            <header className="erp-pos-header">
              <div>
                <div className="erp-pos-title">
                  {tx("Point of sale")}
                </div>
                <div className="erp-pos-subtitle">
                  {tx("Order")} {orderContext.orderNo} -{" "}
                  {orderTypeLabel(orderContext.orderType, language)} - {clock}
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
                      ? tx("Loading locations...")
                      : tx("Select POS location")}
                  </option>

                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {storeLabel(store)}
                    </option>
                  ))}
                </select>

                <Pill tone={online ? "green" : "danger"}>{tx(online ? "Online" : "Offline · checkout unavailable")}</Pill>
                <Pill tone="gold">
                  {tx("Terminal")} {sessionState.session.terminal || "POS-1"}
                </Pill>
                <Pill>{sessionState.session.cashierName || tx("Cashier")}</Pill>
              </div>
            </header>

            {(message || catalog.error) && (
              <Card className="erp-pos-message"><div role="status" aria-live="polite">
                <span
                  className={
                    lastSale || message?.includes("successfully") ||
                    message?.includes("restored")
                      ? "ok"
                      : "bad"
                  }
                >
                  {message || catalog.error}
                </span>
                {lastSale && <Button onClick={() => navigate(`/companies/${companyId}/sales/list`)}>{tx("Sales register")}</Button>}
                </div>
              </Card>
            )}

            {uncertain && <Card><p role="alert">{tx("Sale outcome is uncertain. Check the sales register before starting another payment.")}</p>
              <Button onClick={() => navigate("/companies/" + companyId + "/sales/list")}>{tx("Sales register")}</Button></Card>}
            <section className="erp-pos-toolbar">
              <Button
                onClick={() => setView("MENU")}
                variant={view === "MENU" ? "gold" : "ghost"}
                title={tx("Menu")}
              >
                <Utensils size={16} /> {tx("Menu")}
              </Button>
              <Button
                onClick={() => setView("HELD_ORDERS")}
                variant={view === "HELD_ORDERS" ? "gold" : "ghost"}
                title={tx("Held orders")}
              >
                <PauseCircle size={16} /> {tx("Held Orders")} ({heldOrders.length})
              </Button>
              <Button disabled={!cart.length || paying || uncertain} onClick={holdOrder} title={tx("Hold order")}>
                <PauseCircle size={16} /> {tx("Hold")}
              </Button>
              <Button
                onClick={() => setView("PAYMENT")}
                variant={view === "PAYMENT" ? "gold" : "ghost"}
                title={tx("Payment")}
              >
                <CreditCard size={16} /> {tx("Payment")}
              </Button>
              <Button onClick={() => setDiscardOpen(true)} disabled={!cart.length || paying || uncertain} variant="danger" title={tx("Clear order")}>
                <Trash2 size={16} /> {tx("Clear order")}
              </Button>
            </section>

            <section className="erp-pos-metrics" aria-label={tx("Current POS order summary")}>
              <div>
                <span>{tx("Lines")}</span>
                <strong>{cart.length}</strong>
              </div>
              <div>
                <span>{tx("Items")}</span>
                <strong>{cart.reduce((sum, item) => sum + item.qty, 0)}</strong>
              </div>
              <div>
                <span>{tx("Subtotal")}</span>
                <strong>{money(totals.subtotal)}</strong>
              </div>
              <div className="accent">
                <span>{tx("Total")}</span>
                <strong>{money(totals.total)}</strong>
              </div>
            </section>

            <main className="erp-pos-workspace">
              <details className="erp-pos-left"><summary>{tx("Order details")} · {orderTypeLabel(orderContext.orderType, language)} · {orderContext.customerName || tx("Walk-in")}</summary>
                <Card className="erp-service-card">
                  <div className="erp-section-title">{tx("Service Context")}</div>

                  <label className="erp-pos-label">{tx("Operating Location")}</label>
                  <select
                    className="erp-pos-input"
                    value={storeId}
                    onChange={(e) => onStoreChange(e.target.value)}
                    disabled={Boolean(sessionState.session)}
                  >
                    <option value="">
                      {loadingStores
                        ? tx("Loading locations...")
                        : tx("Select POS location")}
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

                  <label className="erp-pos-label">{tx("Service Type")}</label>
                  <select
                    className="erp-pos-input"
                    aria-label={tx("Service Type")} value={orderContext.orderType}
                    onChange={(e) =>
                      setOrderField("orderType", e.target.value as OrderType)
                    }
                  >
                    <option value="DINE_IN">{tx("Dine In")}</option>
                    <option value="TAKE_AWAY">{tx("Take Away")}</option>
                    <option value="DELIVERY">{tx("Delivery")}</option>
                    <option value="ROOM_SERVICE">{tx("Room Service")}</option>
                  </select>

                  <div className="erp-pos-mini-grid">
                    <div>
                      <label className="erp-pos-label">{tx("Table / Room No.")}</label>
                      <input
                        className="erp-pos-input"
                        aria-label={tx("Table / Room No.")} value={orderContext.tableNo}
                        onChange={(e) =>
                          setOrderField("tableNo", e.target.value)
                        }
                        placeholder="T-01 / 205"
                      />
                    </div>

                    <div>
                      <label className="erp-pos-label">{tx("Guest Count")}</label>
                      <input
                        className="erp-pos-input"
                        type="number"
                        min={1}
                        aria-label={tx("Guest Count")} value={orderContext.guestCount}
                        onChange={(e) =>
                          setOrderField(
                            "guestCount",
                            Math.max(1, Number(e.target.value || 1)),
                          )
                        }
                      />
                    </div>
                  </div>

                  <label className="erp-pos-label">{tx("Customer / Guest")}</label>
                  <input
                    className="erp-pos-input"
                    aria-label={tx("Customer / Guest")} value={orderContext.customerName}
                    onChange={(e) =>
                      setOrderField("customerName", e.target.value)
                    }
                    placeholder={tx("Walk-in customer")}
                  />

                  <label className="erp-pos-label">{tx("Service Note")}</label>
                  <textarea
                    className="erp-pos-input"
                    rows={3}
                    aria-label={tx("Service Note")} value={orderContext.orderNote}
                    onChange={(e) => setOrderField("orderNote", e.target.value)}
                    placeholder={tx("Local order note — not sent to the kitchen")}
                  />
                </Card>

                <Card className="erp-order-snapshot">
                  <div className="erp-section-title">{tx("Order Snapshot")}</div>
                  <div className="erp-snapshot-row">
                    <span>{tx("Service")}</span>
                    <strong>{orderTypeLabel(orderContext.orderType, language)}</strong>
                  </div>
                  <div className="erp-snapshot-row">
                    <span>{tx("Table / Room")}</span>
                    <strong>{orderContext.tableNo || tx("Unassigned")}</strong>
                  </div>
                  <div className="erp-snapshot-row">
                    <span>{tx("Guest")}</span>
                    <strong>{orderContext.customerName || tx("Walk-in")}</strong>
                  </div>
                </Card>
              </details>

              <section className="erp-pos-center">
                {view === "MENU" && (
                  <>
                    <Card className="erp-menu-control-card">
                      <div className="erp-search-card">
                        <Search size={18} />
                      <input
                        id="pos-search"
                        aria-label={tx("Search item, category, code, or barcode")}
                        className="erp-pos-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={tx("Search item, category, code, or barcode")}
                      />
                      <div className="erp-pos-help">
                        {tx("F5 Hold - F8 Payment - Esc Return to Menu")}
                      </div>
                      </div>

                      <div className="erp-category-strip" aria-label={tx("Menu categories")}>
                        {categories.map((c) => (
                          <button
                            key={c === "All" ? tx("All") : c}
                            type="button"
                            className={
                              c === category
                                ? "erp-category active"
                                : "erp-category"
                            }
                            aria-pressed={c === category}
                            onClick={() => setCategory(c)}
                          >
                            {c === "All" ? tx("All") : c}
                          </button>
                        ))}
                      </div>
                    </Card>

                    <div className="erp-menu-grid">
                      {catalog.loadingMenu && (
                        <Card>{tx("Loading menu catalogue...")}</Card>
                      )}
                      {!catalog.loadingMenu && filteredItems.length === 0 && (
                        <Card>{tx("No matching menu items were found.")}</Card>
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
                            disabled={paying || uncertain || Boolean(blockedReason)}
                            onClick={() => addItem(item)}
                            title={blockedReason ?? tx("Ready for Sale")}
                          >
                            <div>
                              <div className="erp-menu-name">{item.name}</div>
                              <div className="erp-menu-category">
                                {item.categoryName || tx("Uncategorized")}
                              </div>
                            </div>

                            <div className="erp-menu-bottom">
                              <strong>
                                {money(Number(item.sellingPrice || 0))}
                              </strong>
                              {blockedReason ? (
                                <span>{blockedReason}</span>
                              ) : (
                                <span>{tx("Ready for Sale")}</span>
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
                    <div className="erp-section-title">{tx("Held Orders")}</div><p className="erp-muted">{tx("Held orders are kept only while this page stays open.")}</p>
                    {heldOrders.length === 0 ? (
                      <div className="erp-muted">
                        {tx("There are currently no held orders.")}
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
                              {orderTypeLabel(h.orderType, language)} -{" "}
                              {h.tableNo || tx("No table assigned")} -{" "}
                              {h.cart.length} {tx(h.cart.length === 1 ? "line" : "lines")}
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
                    <div className="erp-section-title">{tx("Payment Processing")}</div>

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
                          aria-pressed={paymentMethod === m}
                          onClick={() => setPaymentMethod(m)}
                        >
                          {tx(m.replace("_", " "))}
                        </button>
                      ))}
                    </div>

                    <div className="erp-pos-mini-grid">
                      <div>
                        <label className="erp-pos-label">{tx("Cash Received")}</label>
                        <input
                          className="erp-pos-input"
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label={tx("Cash Received")}
                          disabled={paymentMethod !== "CASH" || paying}
                          inputMode="decimal"
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
                          aria-label={tx("Payment Reference")}
                          disabled={paymentMethod === "CASH" || paying}
                          value={referenceCode}
                          onChange={(e) => setReferenceCode(e.target.value)}
                          placeholder={tx("Card, mobile, transfer, or bank reference")}
                        />
                      </div>
                    </div>

                    {paymentMethod === "CASH" && <div className="erp-cash-shortcuts"><Button onClick={() => setAmountTendered(totals.total.toFixed(2))}>{tx("Exact amount")}</Button>
                      {[100, 500, 1000].filter(value => value >= totals.total).map(value => <Button key={value} onClick={() => setAmountTendered(String(value))}>{money(value)}</Button>)}</div>}
                    <div className="erp-payment-total">
                      <span>{tx("Amount Payable")}</span>
                      <strong>{money(totals.total)}</strong>
                    </div>

                    <div className="erp-payment-total small">
                      <span>{tx(paymentMethod === "CASH" && changeDue < 0 ? "Remaining to pay" : "Change to Return")}</span>
                      <strong>
                        {paymentMethod === "CASH"
                          ? money(Math.abs(changeDue))
                          : money(0)}
                      </strong>
                    </div>

                    <Button
                      variant="gold"
                      loading={paying}
                      disabled={!cart.length || !online || uncertain}
                      onClick={confirmPayment}
                      style={{ width: "100%", marginTop: 16 }}
                    >
                      {tx("Complete Sale")}
                    </Button>
                  </Card>
                )}
              </section>

              <aside className="erp-pos-right">
                <Card className="erp-order-card">
                  <div className="erp-order-header">
                    <div>
                      <div className="erp-section-title">{tx("Active Order")}</div>
                      <div className="erp-muted">
                        <ShoppingBag size={13} /> {cart.length} {tx(cart.length === 1 ? "line" : "lines")}
                      </div>
                    </div>
                    <Pill tone="gold">
                      {orderTypeLabel(orderContext.orderType, language)}
                    </Pill>
                  </div>

                  <div className="erp-cart-lines">
                    {cart.length === 0 ? (
                      <div className="erp-empty-cart">
                        {tx("Select menu items to start a new order.")}
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div key={item.id} className="erp-cart-line">
                          <div className="erp-cart-line-main">
                            <strong>{item.name}</strong>
                            <span>
                              {money(item.price)} -{" "}
                              {item.categoryName || tx("Menu")}
                            </span>
                          </div>

                          <div className="erp-cart-controls">
                            <button
                              type="button"
                              onClick={() =>
                                !uncertain && dispatchCart({ type: "DECREMENT", id: item.id })
                              }
                            >
                              <span aria-label={`${tx("Decrease quantity")} ${item.name}`}>−</span>
                            </button>
                            <span>{item.qty}</span>
                            <button
                              type="button"
                              onClick={() =>
                                !uncertain && dispatchCart({ type: "INCREMENT", id: item.id })
                              }
                            >
                              <span aria-label={`${tx("Increase quantity")} ${item.name}`}>+</span>
                            </button>
                            <button
                              type="button"
                              className="danger"
                              aria-label={`${tx("Remove")} ${item.name}`}
                              onClick={() =>
                                !uncertain && dispatchCart({ type: "REMOVE", id: item.id })
                              }
                            >
                              <Trash2 size={16} aria-hidden="true" />
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
                      <span>{tx("Subtotal")}</span>
                      <strong>{money(totals.subtotal)}</strong>
                    </div>
                    <div>
                      <span>{tx("Discount")}</span>
                      <strong>{money(totals.discount)}</strong>
                    </div>
                    <div>
                      <span>{tx("Service Charge")}</span>
                      <strong>{money(totals.serviceCharge)}</strong>
                    </div>
                    <div>
                      <span>{tx("Tax")}</span>
                      <strong>{money(totals.tax)}</strong>
                    </div>
                    <div className="grand">
                      <span>{tx("Net Total")}</span>
                      <strong>{money(totals.total)}</strong>
                    </div>
                  </div>

                  <div className="erp-order-actions">
                    <Button disabled={!cart.length || paying || uncertain} onClick={holdOrder}>
                      <PauseCircle size={16} /> {tx("Hold")}
                    </Button>
                    <Button disabled={!cart.length || paying || uncertain || !online} onClick={() => setView("PAYMENT")} variant="gold">
                      <ReceiptText size={16} /> {tx("Complete Payment")}
                    </Button>
                  </div>
                </Card>
              </aside>
            </main>
          </fieldset>
        )}
      </SessionGate>
    </div>
  );
}
