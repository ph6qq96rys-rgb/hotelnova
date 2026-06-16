import { useMemo, useState } from "react";
import { posApi, getBranchId, getCompanyId } from "../api/posApi";
import { CartPanel } from "../components/CartPanel";
import { MenuGrid } from "../components/MenuGrid";
import { SessionBanner, SessionGate } from "../components/SessionGate";
import { Card, ensurePosStyles } from "../components/posUi";
import { usePosCatalog } from "../hooks/usePosCatalog";
import { usePosSession } from "../hooks/usePosSession";
import type { CartItem, MenuItemDto, PaymentMethod } from "../types/posTypes";

ensurePosStyles();

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function PosSalesPage() {
  const sessionState = usePosSession();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const catalog = usePosCatalog(Boolean(sessionState.session), search);

  const subtotal = useMemo(
    () => round2(cart.reduce((sum, item) => sum + item.lineTotal, 0)),
    [cart]
  );

  const discount = 0;
  const tax = round2(subtotal * 0.08);
  const total = round2(subtotal + tax - discount);

  const addItem = (item: MenuItemDto) => {
    if (item.isActive === false) {
      setMessage(`${item.name} is inactive.`);
      return;
    }

    if (item.isAvailableForSale === false) {
      setMessage(`${item.name} is not available for sale.`);
      return;
    }

    if (item.hasRecipe === false) {
      setMessage(`${item.name} has no recipe configured.`);
      return;
    }

    if (item.hasConsumptionLocation === false) {
      setMessage(`${item.name} has no consumption location configured.`);
      return;
    }

    const price = round2(Number(item.sellingPrice || 0));

    setCart((prev) => {
      const existing = prev.find((x) => x.id === item.id);

      if (existing) {
        return prev.map((x) =>
          x.id === item.id
            ? {
                ...x,
                qty: x.qty + 1,
                lineTotal: round2(x.price * (x.qty + 1)),
              }
            : x
        );
      }

      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          categoryName: item.categoryName,
          price,
          qty: 1,
          lineTotal: price,
          hasRecipe: item.hasRecipe,
          hasConsumptionLocation: item.hasConsumptionLocation,
          isAvailableForSale: item.isAvailableForSale,
        },
      ];
    });
  };

  const incrementItem = (id: string) => {
    setCart((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              qty: x.qty + 1,
              lineTotal: round2(x.price * (x.qty + 1)),
            }
          : x
      )
    );
  };

  const decrementItem = (id: string) => {
    setCart((prev) =>
      prev
        .map((x) =>
          x.id === id
            ? {
                ...x,
                qty: x.qty - 1,
                lineTotal: round2(x.price * (x.qty - 1)),
              }
            : x
        )
        .filter((x) => x.qty > 0)
    );
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((x) => x.id !== id));
  };

  const clearCart = () => {
    if (paying) return;
    setCart([]);
    setMessage(null);
  };

  const confirmPayment = async () => {
    if (paying) return;

    if (cart.length === 0) {
      setMessage("Add at least one item before confirming payment.");
      return;
    }

    if (total <= 0) {
      setMessage("Sale total must be greater than zero.");
      return;
    }

    setPaying(true);
    setMessage(null);

    try {
      const sale = await posApi.createSale({
        companyId: getCompanyId(),
        branchId: getBranchId(),
        discountAmount: discount,
        taxAmount: tax,
        serviceChargeAmount: 0,
        lines: cart.map((x) => ({
          menuItemId: x.id,
          quantity: x.qty,
          unitPrice: x.price,
        })),
        payment: {
          method: paymentMethod,
          amount: total,
          referenceCode: null,
        },
      });

      setCart([]);
      setMessage(`Sale ${sale.saleNo || sale.id} completed.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div
      style={{
        background: "#09090B",
        color: "#FAFAF9",
        minHeight: "100%",
        padding: 18,
        fontFamily: "inherit",
      }}
    >
      <SessionGate
        loading={sessionState.loading}
        session={sessionState.session}
        busy={sessionState.busy}
        error={sessionState.error}
        onOpen={(cashierName, terminal, openingFloat) =>
          sessionState.open({ cashierName, terminal, openingFloat })
        }
        onClose={sessionState.close}
      >
        {sessionState.session && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              height: "calc(100vh - 96px)",
            }}
          >
            <SessionBanner
              session={sessionState.session}
              onClose={() => sessionState.close(0)}
            />

            {(message || catalog.error) && (
              <Card style={{ padding: 12 }}>
                {message && (
                  <span
                    style={{
                      color: message.includes("completed") ? "#4ADE80" : "#F87171",
                      fontSize: 13,
                    }}
                  >
                    {message}
                  </span>
                )}

                {!message && catalog.error && (
                  <span style={{ color: "#F87171", fontSize: 13 }}>
                    {catalog.error}
                  </span>
                )}
              </Card>
            )}

            <div style={{ display: "flex", gap: 14, minHeight: 0, flex: 1 }}>
              <MenuGrid
                menuItems={catalog.menuItems}
                categories={catalog.categories}
                category={category}
                setCategory={setCategory}
                search={search}
                setSearch={setSearch}
                loading={catalog.loadingMenu}
                addItem={addItem}
              />

              <CartPanel
                items={cart}
                subtotal={subtotal}
                discount={discount}
                tax={tax}
                total={total}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                onIncrement={incrementItem}
                onDecrement={decrementItem}
                onRemove={removeItem}
                onClear={clearCart}
                onPay={confirmPayment}
                paying={paying}
              />
            </div>
          </div>
        )}
      </SessionGate>
    </div>
  );
}