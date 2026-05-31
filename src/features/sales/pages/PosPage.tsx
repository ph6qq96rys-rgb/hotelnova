import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { salesApi } from "../api/salesApi";
import type { CartLine, MenuItemLookupDto, PosSessionDto, SplitPayment, StockLocationDto } from "../api/salesTypes";
import { PAYMENT_METHODS, PosSessionStatus } from "../api/salesTypes";
import { Alert, Badge, Button, Card, Empty, Field, Modal, extractApiError, money } from "../components/pos-ui";
import "../components/pos.css";

function useAppScope() {
  return {
    companyId: localStorage.getItem("companyId") ?? "",
    branchId: localStorage.getItem("branchId") ?? "",
  };
}

const categoryOf = (x: MenuItemLookupDto) => x.categoryName?.trim() || "All Items";

export default function PosPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [session, setSession] = useState<PosSessionDto | null>(null);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [locationId, setLocationId] = useState("");
  const [items, setItems] = useState<MenuItemLookupDto[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [serviceCharge, setServiceCharge] = useState("0");
  const [payments, setPayments] = useState<SplitPayment[]>([{ method: "CASH", amount: "" }]);
  const [showPayment, setShowPayment] = useState(false);
  const [receipt, setReceipt] = useState<{ saleNo: string; total: number; change: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isOpen = session?.status === PosSessionStatus.Open || session?.status === 1;

  useEffect(() => {
    if (!companyId || !branchId) return;
    salesApi.currentSession(companyId, branchId)
      .then((r) => setSession((r as any).data ?? r))
      .catch(() => setSession(null));

    salesApi.listStockLocations(companyId, branchId)
      .then((rows) => {
        const active = rows.filter((x) => x.isActive !== false);
        setLocations(active);
        setLocationId((prev) =>
          active.some((x) => x.id === prev)
            ? prev
            : active.find((x) => x.isDefaultIssue)?.id ?? active[0]?.id ?? ""
        );
      })
      .catch(() => setLocations([]));
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId || !branchId) return;
    const t = window.setTimeout(() => {
      salesApi.listMenuItems(companyId, branchId, search)
        .then(setItems)
        .catch((e) => setErr(extractApiError(e, "Failed to load menu items.")));
    }, 200);
    return () => window.clearTimeout(t);
  }, [companyId, branchId, search]);

  const categories = useMemo(() => {
    const names = Array.from(new Set(items.map(categoryOf))).sort();
    return ["All", ...names];
  }, [items]);

  const visibleItems = useMemo(() => {
    return activeCategory === "All" ? items : items.filter((x) => categoryOf(x) === activeCategory);
  }, [items, activeCategory]);

  const subTotal = useMemo(() => cart.reduce((s, x) => s + x.quantity * x.unitPrice, 0), [cart]);
  const discountAmount = Number(discount) || 0;
  const taxAmount = Number(tax) || 0;
  const serviceChargeAmount = Number(serviceCharge) || 0;
  const total = Math.max(0, subTotal - discountAmount + taxAmount + serviceChargeAmount);
  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const change = Math.max(0, paid - total);
  const canPay = isOpen && cart.length > 0 && !!locationId && total > 0;

  function addItem(item: MenuItemLookupDto) {
    setCart((prev) => {
      const found = prev.find((x) => x.menuItemId === item.id);
      if (found) {
        return prev.map((x) => x.menuItemId === item.id ? { ...x, quantity: x.quantity + 1 } : x);
      }
      return [...prev, {
        menuItemId: item.id,
        name: item.name,
        unitPrice: item.sellingPrice ?? 0,
        quantity: 1,
        categoryName: item.categoryName,
      }];
    });
  }

  function updateQty(id: string, qty: number) {
    setCart((prev) => qty <= 0 ? prev.filter((x) => x.menuItemId !== id) : prev.map((x) => x.menuItemId === id ? { ...x, quantity: qty } : x));
  }

  function resetOrder() {
    setCart([]);
    setDiscount("0");
    setTax("0");
    setServiceCharge("0");
    setPayments([{ method: "CASH", amount: "" }]);
    setShowPayment(false);
    setErr(null);
  }

  async function charge() {
    if (!companyId || !branchId || !canPay) return;
    if (paid < total) {
      setErr("Payment is less than order total.");
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const primaryPayment = payments.find((p) => Number(p.amount) > 0);
      const response = await salesApi.createSale({
        companyId,
        branchId,
        locationId,
        discountAmount,
        taxAmount,
        serviceChargeAmount,
        lines: cart.map((x) => ({
          menuItemId: x.menuItemId,
          quantity: x.quantity,
          unitPrice: x.unitPrice,
        })),
        payment: primaryPayment
          ? {
              method: primaryPayment.method,
              amount: paid,
              referenceCode: primaryPayment.referenceCode,
            }
          : null,
      });

      const sale = (response as any).data ?? response;
      setReceipt({ saleNo: sale.saleNo ?? sale.id, total, change });
      resetOrder();
    } catch (e) {
      setErr(extractApiError(e, "Failed to place sale."));
    } finally {
      setBusy(false);
    }
  }

  if (!isOpen) {
    return (
      <div className="pos-page">
        <div className="pos-terminal" style={{ placeItems: "center", display: "grid" }}>
          <Card title="No active POS session" subtitle="Open a cashier session before taking restaurant orders.">
            <div style={{ display: "grid", gap: 12, maxWidth: 360 }}>
              <Alert tone="warning">A session is required to place sales and close the shift.</Alert>
              <Button variant="primary" size="lg" onClick={() => nav("/sales/pos/session")}>Open Session</Button>
              <Button variant="secondary" onClick={() => nav("/sales")}>Go to Sales</Button>
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
            <h1>Restaurant POS</h1>
            <p>
              <Badge tone="green">Session Open</Badge>{" "}
              Cashier: {session?.cashierName || "Cashier"} · Terminal: {session?.terminal || "POS"}
            </p>
          </div>
          <div className="pos-actions">
            <select className="pos-field-input" value={locationId} onChange={(e) => setLocationId(e.target.value)}
              style={{ minHeight: 40, borderRadius: 12, border: "1px solid #e5e7eb", padding: "0 12px" }}>
              {locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <Button onClick={() => nav("/sales")}>Sales</Button>
            <Button onClick={() => nav("/sales/pos/session")}>Session</Button>
          </div>
        </div>

        {err && <Alert tone="danger">{err}</Alert>}

        <div className="pos-terminal-grid">
          <Card title="Menu" subtitle="Categories">
            <div className="pos-menu-list">
              {categories.map((c) => (
                <button key={c} className={`pos-category ${activeCategory === c ? "active" : ""}`}
                  onClick={() => setActiveCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
          </Card>

          <Card
            title="Items"
            subtitle="Fast order entry"
            action={
              <input
                placeholder="Search item or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ minHeight: 40, border: "1px solid #e5e7eb", borderRadius: 12, padding: "0 12px", minWidth: 260 }}
              />
            }
          >
            {visibleItems.length === 0 ? (
              <Empty title="No menu items" text="Search or create menu items first." />
            ) : (
              <div className="pos-product-grid">
                {visibleItems.map((item) => (
                  <button key={item.id} className="pos-product" onClick={() => addItem(item)}>
                    <strong>{item.name}</strong>
                    <span>{item.code || item.externalCode || item.categoryName || "Menu item"}</span>
                    <b>{money(item.sellingPrice)}</b>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title="Current Order" subtitle={`${cart.reduce((s, x) => s + x.quantity, 0)} items`} className="pos-cart">
            <div className="pos-cart-lines">
              {cart.length === 0 ? (
                <Empty title="Cart is empty" text="Tap a menu item to begin." />
              ) : cart.map((line) => (
                <div className="pos-cart-line" key={line.menuItemId}>
                  <div className="pos-cart-line__top">
                    <strong>{line.name}</strong>
                    <b>{money(line.unitPrice * line.quantity)}</b>
                  </div>
                  <div className="pos-cart-line__controls">
                    <span>{money(line.unitPrice)}</span>
                    <div className="pos-qty">
                      <button onClick={() => updateQty(line.menuItemId, line.quantity - 1)}>-</button>
                      <span>{line.quantity}</span>
                      <button onClick={() => updateQty(line.menuItemId, line.quantity + 1)}>+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pos-totals">
              <div className="pos-total-row"><span>Subtotal</span><b>{money(subTotal)}</b></div>
              <div className="pos-total-row">
                <span>Discount</span>
                <input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal"
                  style={{ width: 90, textAlign: "right" }} />
              </div>
              <div className="pos-total-row">
                <span>Tax</span>
                <input value={tax} onChange={(e) => setTax(e.target.value)} inputMode="decimal"
                  style={{ width: 90, textAlign: "right" }} />
              </div>
              <div className="pos-total-row">
                <span>Service</span>
                <input value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} inputMode="decimal"
                  style={{ width: 90, textAlign: "right" }} />
              </div>
              <div className="pos-total-row grand"><span>Total</span><span>{money(total)}</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                <Button block onClick={resetOrder} disabled={cart.length === 0}>Clear</Button>
                <Button block variant="primary" size="lg" disabled={!canPay} onClick={() => {
                  setPayments([{ method: "CASH", amount: total.toFixed(2) }]);
                  setShowPayment(true);
                }}>
                  Pay
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {showPayment && (
        <Modal title={`Payment — ${money(total)}`} onClose={() => setShowPayment(false)} width={520}>
          <div style={{ display: "grid", gap: 12 }}>
            {payments.map((payment, index) => (
              <div key={index} style={{ display: "grid", gridTemplateColumns: "140px 1fr 40px", gap: 8 }}>
                <select value={payment.method} onChange={(e) => setPayments((prev) => prev.map((p, i) => i === index ? { ...p, method: e.target.value } : p))}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input value={payment.amount} inputMode="decimal" placeholder="0.00"
                  onChange={(e) => setPayments((prev) => prev.map((p, i) => i === index ? { ...p, amount: e.target.value } : p))}
                  style={{ textAlign: "right" }} />
                <Button size="sm" onClick={() => setPayments((prev) => prev.filter((_, i) => i !== index))}>×</Button>
              </div>
            ))}
            <Button onClick={() => setPayments((prev) => [...prev, { method: "CASH", amount: "" }])}>+ Split Payment</Button>
            <div className="pos-totals">
              <div className="pos-total-row"><span>Paid</span><b>{money(paid)}</b></div>
              <div className="pos-total-row"><span>{paid >= total ? "Change" : "Remaining"}</span><b>{money(Math.abs(paid - total))}</b></div>
            </div>
            <Button variant="success" size="lg" block disabled={busy || paid < total} onClick={charge}>
              {busy ? "Processing..." : `Charge ${money(total)}`}
            </Button>
          </div>
        </Modal>
      )}

      {receipt && (
        <Modal title="Sale Complete" onClose={() => setReceipt(null)} width={420}>
          <div style={{ display: "grid", gap: 14, textAlign: "center" }}>
            <div style={{ fontSize: 52 }}>✓</div>
            <h2 style={{ margin: 0 }}>{money(receipt.total)}</h2>
            <p style={{ margin: 0, color: "#6b7280" }}>Sale {receipt.saleNo}</p>
            {receipt.change > 0 && <Alert tone="info">Change due: {money(receipt.change)}</Alert>}
            <Button variant="primary" block onClick={() => setReceipt(null)}>New Order</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
