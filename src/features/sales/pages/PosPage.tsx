import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { salesApi } from "../api/salesApi";
import type {
  CartLine,
  MenuItemLookupDto,
  PosSessionDto,
  SplitPayment,
  StockLocationDto,
} from "../api/salesTypes";
import { PAYMENT_METHODS, PosSessionStatus } from "../api/salesTypes";
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Modal,
  extractApiError,
  money,
} from "../components/pos-ui";
import "../components/pos.css";

type PageStatus = "IDLE" | "LOADING" | "READY" | "FAILED";
type PaymentStatus = "IDLE" | "VALIDATING" | "POSTING";

type AppScope = {
  companyId: string;
  branchId: string;
};

type ReceiptState = {
  saleNo: string;
  total: number;
  paid: number;
  change: number;
};

type PaymentValidationResult = {
  valid: boolean;
  message?: string;
};

const DEFAULT_CATEGORY = "All";
const DEFAULT_PAYMENT_METHOD = "CASH";
const DEBOUNCE_MS = 250;
const MAX_LINE_QTY = 999;
const MAX_MANUAL_ADJUSTMENT = 1_000_000;

function clean(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readScopeValue(keys: string[]): string {
  for (const key of keys) {
    const value = clean(localStorage.getItem(key) ?? sessionStorage.getItem(key));
    if (value) return value;
  }

  return "";
}

function useAppScope(): AppScope {
  return {
    companyId: readScopeValue(["companyId", "company_id", "selectedCompanyId"]),
    branchId: readScopeValue(["branchId", "branch_id", "selectedBranchId"]),
  };
}

function isSessionOpen(session: PosSessionDto | null): boolean {
  return session?.status === PosSessionStatus.Open || session?.status === 1;
}

function categoryOf(item: MenuItemLookupDto): string {
  return item.categoryName?.trim() || "Uncategorized";
}

function asMoneyNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function toPositiveAmount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function paymentMethodLabel(method: string): string {
  return method.replace(/_/g, " ");
}

function stockLocationLabel(location: StockLocationDto): string {
  return location.code ? `${location.name} (${location.code})` : location.name;
}

function menuItemIsBlocked(item: MenuItemLookupDto): string | null {
  const typed = item as MenuItemLookupDto & {
    isActive?: boolean;
    isAvailableForSale?: boolean;
    hasRecipe?: boolean;
    hasConsumptionLocation?: boolean;
  };

  if (typed.isActive === false) {
    return `${item.name} is inactive and cannot be sold.`;
  }

  if (typed.isAvailableForSale === false) {
    return `${item.name} is not available for POS sale.`;
  }

  if (typed.hasRecipe === false) {
    return `${item.name} cannot be sold because no recipe is configured.`;
  }

  if (typed.hasConsumptionLocation === false) {
    return `${item.name} cannot be sold because no inventory consumption location is configured.`;
  }

  return null;
}

function createCartLine(item: MenuItemLookupDto): CartLine {
  return {
    menuItemId: item.id,
    name: item.name,
    unitPrice: round2(Number(item.sellingPrice ?? 0)),
    quantity: 1,
    categoryName: item.categoryName,
  };
}

function validateAdjustment(label: string, value: number): string | null {
  if (Number.isNaN(value)) return `${label} must be a valid numeric amount.`;
  if (value < 0) return `${label} cannot be negative.`;
  if (value > MAX_MANUAL_ADJUSTMENT) {
    return `${label} exceeds the authorized adjustment limit.`;
  }

  return null;
}

function validatePayment(args: {
  companyId: string;
  branchId: string;
  sessionOpen: boolean;
  locationId: string;
  cart: CartLine[];
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  total: number;
  payments: SplitPayment[];
  paid: number;
}): PaymentValidationResult {
  if (!args.companyId || !args.branchId) {
    return {
      valid: false,
      message:
        "Company and branch context are required before processing POS transactions.",
    };
  }

  if (!args.sessionOpen) {
    return {
      valid: false,
      message:
        "A cashier session must be open before a sale can be processed.",
    };
  }

  if (!args.locationId) {
    return {
      valid: false,
      message:
        "Select an inventory issue location before completing the sale.",
    };
  }

  if (args.cart.length === 0) {
    return {
      valid: false,
      message: "Add at least one menu item before opening payment.",
    };
  }

  if (args.cart.some((line) => line.quantity <= 0 || line.quantity > MAX_LINE_QTY)) {
    return {
      valid: false,
      message:
        "One or more order lines has an invalid quantity. Review the cart before payment.",
    };
  }

  if (args.cart.some((line) => Number(line.unitPrice) < 0)) {
    return {
      valid: false,
      message:
        "One or more order lines has an invalid selling price. Refresh the menu and try again.",
    };
  }

  const adjustmentErrors = [
    validateAdjustment("Discount", args.discount),
    validateAdjustment("Tax", args.tax),
    validateAdjustment("Service charge", args.serviceCharge),
  ].filter(Boolean);

  if (adjustmentErrors.length > 0) {
    return { valid: false, message: adjustmentErrors[0] ?? undefined };
  }

  if (args.discount > args.subtotal) {
    return {
      valid: false,
      message:
        "Discount cannot exceed the order subtotal without supervisor approval.",
    };
  }

  if (args.total <= 0) {
    return {
      valid: false,
      message: "The payable amount must be greater than zero.",
    };
  }

  const activePayments = args.payments.filter((payment) => toPositiveAmount(payment.amount) > 0);

  if (activePayments.length === 0) {
    return {
      valid: false,
      message: "Enter at least one payment amount before charging the sale.",
    };
  }

  const invalidPayment = activePayments.find((payment) => !payment.method);

  if (invalidPayment) {
    return {
      valid: false,
      message: "Each payment line must have a valid payment method.",
    };
  }

  if (args.paid < args.total) {
    return {
      valid: false,
      message:
        "Payment received is less than the amount payable. Collect the remaining balance before posting.",
    };
  }

  return { valid: true };
}

export default function PosPage() {
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [session, setSession] = useState<PosSessionDto | null>(null);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [locationId, setLocationId] = useState("");
  const [items, setItems] = useState<MenuItemLookupDto[]>([]);

  const [activeCategory, setActiveCategory] = useState(DEFAULT_CATEGORY);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);

  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [serviceCharge, setServiceCharge] = useState("0");
  const [payments, setPayments] = useState<SplitPayment[]>([
    { method: DEFAULT_PAYMENT_METHOD, amount: "" },
  ]);

  const [showPayment, setShowPayment] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>("IDLE");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("IDLE");
  const [message, setMessage] = useState<string | null>(null);

  const sessionRequestRef = useRef(0);
  const menuRequestRef = useRef(0);

  const sessionOpen = isSessionOpen(session);
  const loading = pageStatus === "LOADING";
  const posting = paymentStatus === "POSTING";

  const loadOperationalContext = useCallback(async () => {
    if (!companyId || !branchId) {
      setSession(null);
      setLocations([]);
      setLocationId("");
      setPageStatus("FAILED");
      setMessage(
        "Company and branch context are required before opening the POS terminal."
      );
      return;
    }

    const requestId = ++sessionRequestRef.current;

    setPageStatus("LOADING");
    setMessage(null);

    try {
      const [sessionResponse, locationRows] = await Promise.all([
        salesApi.currentSession(companyId, branchId),
        salesApi.listStockLocations(companyId, { branchId }),
      ]);

      if (requestId !== sessionRequestRef.current) return;

      const activeLocations = (locationRows ?? [])
        .filter((location) => location.isActive !== false)
        .sort((a, b) => stockLocationLabel(a).localeCompare(stockLocationLabel(b)));

      setSession(sessionResponse.data ?? null);
      setLocations(activeLocations);
      setLocationId((current) => {
        if (current && activeLocations.some((location) => location.id === current)) {
          return current;
        }

        return (
          activeLocations.find((location) => location.isDefaultIssue)?.id ??
          activeLocations[0]?.id ??
          ""
        );
      });

      setPageStatus("READY");
    } catch (error) {
      if (requestId !== sessionRequestRef.current) return;

      setSession(null);
      setLocations([]);
      setLocationId("");
      setPageStatus("FAILED");
      setMessage(
        extractApiError(
          error,
          "Unable to load POS session and inventory location context."
        )
      );
    }
  }, [branchId, companyId]);

  const loadMenuItems = useCallback(async () => {
    if (!companyId || !branchId || !sessionOpen) {
      setItems([]);
      return;
    }

    const requestId = ++menuRequestRef.current;

    try {
      const rows = await salesApi.listMenuItems(companyId, branchId, search.trim());

      if (requestId !== menuRequestRef.current) return;

      setItems(Array.isArray(rows) ? rows : []);
    } catch (error) {
      if (requestId !== menuRequestRef.current) return;

      setItems([]);
      setMessage(extractApiError(error, "Unable to load the POS menu catalogue."));
    }
  }, [branchId, companyId, search, sessionOpen]);

  useEffect(() => {
    void loadOperationalContext();
  }, [loadOperationalContext]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMenuItems();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [loadMenuItems]);

  const selectedLocation = useMemo(() => {
    return locations.find((location) => location.id === locationId) ?? null;
  }, [locationId, locations]);

  const categories = useMemo(() => {
    const names = Array.from(new Set(items.map(categoryOf))).sort((a, b) =>
      a.localeCompare(b)
    );

    return [DEFAULT_CATEGORY, ...names];
  }, [items]);

  const visibleItems = useMemo(() => {
    if (activeCategory === DEFAULT_CATEGORY) return items;

    return items.filter((item) => categoryOf(item) === activeCategory);
  }, [activeCategory, items]);

  const subtotal = useMemo(() => {
    return round2(cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  }, [cart]);

  const totalQty = useMemo(() => {
    return cart.reduce((sum, line) => sum + line.quantity, 0);
  }, [cart]);

  const discountAmount = asMoneyNumber(discount);
  const taxAmount = asMoneyNumber(tax);
  const serviceChargeAmount = asMoneyNumber(serviceCharge);
  const total = round2(
    Math.max(
      0,
      subtotal -
        (Number.isNaN(discountAmount) ? 0 : discountAmount) +
        (Number.isNaN(taxAmount) ? 0 : taxAmount) +
        (Number.isNaN(serviceChargeAmount) ? 0 : serviceChargeAmount)
    )
  );
  const paid = round2(payments.reduce((sum, payment) => sum + toPositiveAmount(payment.amount), 0));
  const balance = round2(total - paid);
  const change = round2(Math.max(0, paid - total));

  const canOpenPayment =
    sessionOpen && cart.length > 0 && Boolean(locationId) && total > 0 && !posting;

  const paymentValidation = validatePayment({
    companyId,
    branchId,
    sessionOpen,
    locationId,
    cart,
    subtotal,
    discount: discountAmount,
    tax: taxAmount,
    serviceCharge: serviceChargeAmount,
    total,
    payments,
    paid,
  });

  const routes = useMemo(() => {
    const companyPrefix = companyId ? `/companies/${companyId}/sales` : "/sales";

    return {
      dashboard: companyId ? companyPrefix : "/sales",
      session: companyId ? `${companyPrefix}/pos/session` : "/sales/pos/session",
    };
  }, [companyId]);

  function addItem(item: MenuItemLookupDto) {
    const blocked = menuItemIsBlocked(item);

    if (blocked) {
      setMessage(blocked);
      return;
    }

    const price = Number(item.sellingPrice ?? 0);

    if (!Number.isFinite(price) || price <= 0) {
      setMessage(
        `${item.name} does not have a valid selling price. Update the menu price before sale.`
      );
      return;
    }

    setCart((current) => {
      const existing = current.find((line) => line.menuItemId === item.id);

      if (existing) {
        return current.map((line) =>
          line.menuItemId === item.id
            ? { ...line, quantity: Math.min(MAX_LINE_QTY, line.quantity + 1) }
            : line
        );
      }

      return [...current, createCartLine(item)];
    });

    setMessage(null);
  }

  function updateQty(menuItemId: string, quantity: number) {
    setCart((current) => {
      if (quantity <= 0) {
        return current.filter((line) => line.menuItemId !== menuItemId);
      }

      return current.map((line) =>
        line.menuItemId === menuItemId
          ? { ...line, quantity: Math.min(MAX_LINE_QTY, Math.floor(quantity)) }
          : line
      );
    });
  }

  function resetOrder() {
    setCart([]);
    setDiscount("0");
    setTax("0");
    setServiceCharge("0");
    setPayments([{ method: DEFAULT_PAYMENT_METHOD, amount: "" }]);
    setShowPayment(false);
    setMessage(null);
  }

  function openPayment() {
    if (!canOpenPayment) {
      setMessage(
        "A valid cashier session, inventory issue location, and order total are required before payment."
      );
      return;
    }

    setPayments([{ method: DEFAULT_PAYMENT_METHOD, amount: total.toFixed(2) }]);
    setPaymentStatus("IDLE");
    setShowPayment(true);
    setMessage(null);
  }

  function updatePayment(index: number, patch: Partial<SplitPayment>) {
    setPayments((current) =>
      current.map((payment, i) => (i === index ? { ...payment, ...patch } : payment))
    );
  }

  function removePayment(index: number) {
    setPayments((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, i) => i !== index);
    });
  }

  function addSplitPayment() {
    setPayments((current) => [
      ...current,
      { method: DEFAULT_PAYMENT_METHOD, amount: "" },
    ]);
  }

  async function charge() {
    if (posting) return;

    setPaymentStatus("VALIDATING");
    setMessage(null);

    if (!paymentValidation.valid) {
      setMessage(paymentValidation.message ?? "Payment validation failed.");
      setPaymentStatus("IDLE");
      return;
    }

    setPaymentStatus("POSTING");

    try {
      const payablePayments = payments.filter(
        (payment) => toPositiveAmount(payment.amount) > 0
      );
      const primaryPayment = payablePayments[0];

      const response = await salesApi.createSale({
        companyId,
        branchId,
        locationId,
        discountAmount: Number.isNaN(discountAmount) ? 0 : discountAmount,
        taxAmount: Number.isNaN(taxAmount) ? 0 : taxAmount,
        serviceChargeAmount: Number.isNaN(serviceChargeAmount)
          ? 0
          : serviceChargeAmount,
        lines: cart.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
        payment: primaryPayment
          ? {
              method: primaryPayment.method,
              amount: paid,
              referenceCode: clean(primaryPayment.referenceCode) || undefined,
            }
          : null,
      });

      const sale = response.data ?? response;

      setReceipt({
        saleNo: sale.saleNo ?? sale.id,
        total,
        paid,
        change,
      });

      resetOrder();
    } catch (error) {
      setMessage(extractApiError(error, "Sale posting failed. Please retry."));
    } finally {
      setPaymentStatus("IDLE");
    }
  }

  if (!sessionOpen) {
    return (
      <div className="pos-page">
        <div className="pos-terminal" style={{ display: "grid", placeItems: "center" }}>
          <Card
            title="Cashier Session Required"
            subtitle="Open an active POS session before processing restaurant sales."
          >
            <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
              {message ? <Alert tone="danger">{message}</Alert> : null}

              {!message && loading ? (
                <Alert tone="info">Loading POS operational context…</Alert>
              ) : null}

              {!loading ? (
                <Alert tone="warning">
                  Sales posting, inventory consumption, and cashier reconciliation
                  are locked until a cashier session is opened.
                </Alert>
              ) : null}

              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate(routes.session)}
              >
                Open Cashier Session
              </Button>

              <Button variant="secondary" onClick={() => navigate(routes.dashboard)}>
                Back to Sales Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pos-page">
      <div className="pos-terminal">
        <div className="pos-topbar">
          <div className="pos-title">
            <h1>Restaurant POS Terminal</h1>
            <p>
              <Badge tone="green">Session Open</Badge>{" "}
              Cashier: {session?.cashierName || "Cashier"} · Terminal:{" "}
              {session?.terminal || "POS"} · Issue Location:{" "}
              {selectedLocation ? stockLocationLabel(selectedLocation) : "Not selected"}
            </p>
          </div>

          <div className="pos-actions">
            <select
              className="pos-field-input"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              style={{
                minHeight: 40,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: "0 12px",
              }}
            >
              <option value="">Select issue location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {stockLocationLabel(location)}
                </option>
              ))}
            </select>

            <Button onClick={() => navigate(routes.dashboard)}>Sales Dashboard</Button>
            <Button onClick={() => navigate(routes.session)}>Session Control</Button>
          </div>
        </div>

        {message ? <Alert tone="danger">{message}</Alert> : null}

        {!locationId ? (
          <Alert tone="warning">
            Select an inventory issue location before completing a sale.
          </Alert>
        ) : null}

        <div className="pos-terminal-grid">
          <Card title="Menu Catalogue" subtitle="Categories and item groups">
            <div className="pos-menu-list">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`pos-category ${
                    activeCategory === category ? "active" : ""
                  }`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </Card>

          <Card
            title="Sellable Items"
            subtitle="Fast order entry"
            action={
              <input
                placeholder="Search item, code, or barcode..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{
                  minHeight: 40,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "0 12px",
                  minWidth: 260,
                }}
              />
            }
          >
            {visibleItems.length === 0 ? (
              <Empty
                title="No sellable items found"
                text="Search again or verify that active menu items are configured for this branch."
              />
            ) : (
              <div className="pos-product-grid">
                {visibleItems.map((item) => {
                  const blocked = menuItemIsBlocked(item);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="pos-product"
                      onClick={() => addItem(item)}
                      title={blocked ?? "Ready for sale"}
                      style={blocked ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
                    >
                      <strong>{item.name}</strong>
                      <span>
                        {item.code || item.externalCode || item.categoryName || "Menu item"}
                      </span>
                      <b>{money(item.sellingPrice)}</b>
                      {blocked ? <span>Sale blocked</span> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card
            title="Active Order"
            subtitle={`${cart.length} line(s) · ${totalQty} item(s)`}
            className="pos-cart"
          >
            <div className="pos-cart-lines">
              {cart.length === 0 ? (
                <Empty
                  title="No order lines"
                  text="Select a sellable menu item to begin the order."
                />
              ) : (
                cart.map((line) => (
                  <div className="pos-cart-line" key={line.menuItemId}>
                    <div className="pos-cart-line__top">
                      <strong>{line.name}</strong>
                      <b>{money(line.unitPrice * line.quantity)}</b>
                    </div>

                    <div className="pos-cart-line__controls">
                      <span>{money(line.unitPrice)}</span>

                      <div className="pos-qty">
                        <button
                          type="button"
                          onClick={() => updateQty(line.menuItemId, line.quantity - 1)}
                        >
                          -
                        </button>
                        <span>{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(line.menuItemId, line.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pos-totals">
              <div className="pos-total-row">
                <span>Subtotal</span>
                <b>{money(subtotal)}</b>
              </div>

              <div className="pos-total-row">
                <span>Discount</span>
                <input
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  inputMode="decimal"
                  style={{ width: 90, textAlign: "right" }}
                />
              </div>

              <div className="pos-total-row">
                <span>Tax</span>
                <input
                  value={tax}
                  onChange={(event) => setTax(event.target.value)}
                  inputMode="decimal"
                  style={{ width: 90, textAlign: "right" }}
                />
              </div>

              <div className="pos-total-row">
                <span>Service Charge</span>
                <input
                  value={serviceCharge}
                  onChange={(event) => setServiceCharge(event.target.value)}
                  inputMode="decimal"
                  style={{ width: 90, textAlign: "right" }}
                />
              </div>

              <div className="pos-total-row grand">
                <span>Amount Payable</span>
                <span>{money(total)}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                <Button block onClick={resetOrder} disabled={cart.length === 0 || posting}>
                  Clear Order
                </Button>

                <Button
                  block
                  variant="primary"
                  size="lg"
                  disabled={!canOpenPayment}
                  onClick={openPayment}
                >
                  Complete Payment
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {showPayment ? (
        <Modal
          title={`Payment Processing — ${money(total)}`}
          onClose={() => setShowPayment(false)}
          width={560}
        >
          <div style={{ display: "grid", gap: 12 }}>
            {payments.map((payment, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 1fr 130px 40px",
                  gap: 8,
                }}
              >
                <select
                  value={payment.method}
                  onChange={(event) =>
                    updatePayment(index, { method: event.target.value as SplitPayment["method"] })
                  }
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {paymentMethodLabel(method)}
                    </option>
                  ))}
                </select>

                <input
                  value={payment.amount}
                  inputMode="decimal"
                  placeholder="0.00"
                  onChange={(event) =>
                    updatePayment(index, { amount: event.target.value })
                  }
                  style={{ textAlign: "right" }}
                />

                <input
                  value={payment.referenceCode ?? ""}
                  placeholder="Reference"
                  onChange={(event) =>
                    updatePayment(index, { referenceCode: event.target.value })
                  }
                />

                <Button size="sm" onClick={() => removePayment(index)}>
                  ×
                </Button>
              </div>
            ))}

            <Button onClick={addSplitPayment}>+ Add Split Payment</Button>

            <div className="pos-totals">
              <div className="pos-total-row">
                <span>Amount Payable</span>
                <b>{money(total)}</b>
              </div>

              <div className="pos-total-row">
                <span>Payment Received</span>
                <b>{money(paid)}</b>
              </div>

              <div className="pos-total-row">
                <span>{paid >= total ? "Change to Return" : "Balance Due"}</span>
                <b>{paid >= total ? money(change) : money(Math.abs(balance))}</b>
              </div>
            </div>

            {paymentValidation.message && !paymentValidation.valid ? (
              <Alert tone="warning">{paymentValidation.message}</Alert>
            ) : null}

            <Button
              variant="success"
              size="lg"
              block
              disabled={posting || !paymentValidation.valid}
              onClick={charge}
            >
              {posting ? "Posting Sale..." : `Post Sale ${money(total)}`}
            </Button>
          </div>
        </Modal>
      ) : null}

      {receipt ? (
        <Modal title="Sale Posted Successfully" onClose={() => setReceipt(null)} width={440}>
          <div style={{ display: "grid", gap: 14, textAlign: "center" }}>
            <div style={{ fontSize: 52 }}>✓</div>

            <h2 style={{ margin: 0 }}>{money(receipt.total)}</h2>

            <p style={{ margin: 0, color: "#6b7280" }}>
              Sale {receipt.saleNo} has been posted and is ready for receipt
              printing.
            </p>

            {receipt.change > 0 ? (
              <Alert tone="info">Return change to customer: {money(receipt.change)}</Alert>
            ) : null}

            <Button variant="primary" block onClick={() => setReceipt(null)}>
              Start New Order
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
