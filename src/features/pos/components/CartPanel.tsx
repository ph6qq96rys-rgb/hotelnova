import type { CartItem, PaymentMethod } from "../types/posTypes";
import { Button, Card, Field, money } from "./posUi";

export function CartPanel({
  items,
  subtotal,
  discount,
  tax,
  total,
  paymentMethod,
  setPaymentMethod,
  onIncrement,
  onDecrement,
  onRemove,
  onClear,
  onPay,
  paying,
}: {
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (m: PaymentMethod) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPay: () => void;
  paying: boolean;
}) {
  const methods: PaymentMethod[] = ["CASH", "CARD", "MOBILE", "TRANSFER"];

  return (
    <Card style={{ width: 380, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Current Sale</h3>
          <div style={{ color: "#71717A", fontSize: 12 }}>{items.length} line(s)</div>
        </div>

        <Button onClick={onClear} disabled={items.length === 0 || paying}>
          Clear
        </Button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 220 }}>
        {items.length === 0 ? (
          <div style={{ color: "#71717A", textAlign: "center", padding: "50px 0", fontSize: 13 }}>
            No items in cart.
          </div>
        ) : (
          items.map((item) => {
            const lineTotal = item.price * item.qty;

            return (
              <div key={item.id} style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{item.name}</div>

                    <div style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>
                      {item.categoryName || "Uncategorized"}
                    </div>

                    <div style={{ fontSize: 12, color: "#A1A1AA", marginTop: 5 }}>
                      {money(item.price)} × {item.qty}
                    </div>
                  </div>

                  <strong>{money(lineTotal)}</strong>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
                  <Button disabled={paying} onClick={() => onDecrement(item.id)}>
                    -
                  </Button>

                  <Button disabled={paying} onClick={() => onIncrement(item.id)}>
                    +
                  </Button>

                  <Button variant="danger" disabled={paying} onClick={() => onRemove(item.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <Field label="Subtotal" value={money(subtotal)} />
        <Field label="Discount" value={money(discount)} />
        <Field label="Tax" value={money(tax)} />
        <Field label="Total" value={money(total)} accent />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, margin: "14px 0" }}>
          {methods.map((m) => (
            <Button
              key={m}
              variant={paymentMethod === m ? "gold" : "ghost"}
              disabled={paying}
              onClick={() => setPaymentMethod(m)}
            >
              {m}
            </Button>
          ))}
        </div>

        <Button
          variant="green"
          loading={paying}
          disabled={items.length === 0 || total <= 0 || paying}
          style={{ width: "100%", padding: 12 }}
          onClick={onPay}
        >
          Confirm Payment
        </Button>
      </div>
    </Card>
  );
}