// src/features/sales/pages/PosPage.tsx
// Production-grade ERP POS — catalog + split-cart layout, split payment,
// parked sales drawer, receipt modal, keyboard-accessible.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { posApi, salesApi } from "../api/salesApi";
import { stockLocationsApi } from "../../inventory/stock-locations/api/stockLocationsApi";
import type {
  MenuCategoryDto, MenuItemPosDto, CartLine,
  SplitPayment, LocationLite,
} from "../sales.types";
import { PAYMENT_METHODS } from "../sales.types";
import { fmt, extractApiError } from "../utils/sales.utils";

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens (matches rest of app CSS variables)
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg:          "var(--color-background-primary,   #ffffff)",
  bgSecondary: "var(--color-background-secondary, #f8fafc)",
  bgTertiary:  "var(--color-background-tertiary,  #f1f5f9)",
  border:      "var(--color-border-tertiary,       #e2e8f0)",
  textPrimary: "var(--color-text-primary,          #0f172a)",
  textSecondary:"var(--color-text-secondary,       #475569)",
  textTertiary: "var(--color-text-tertiary,        #94a3b8)",
  accent:      "#4f46e5",
  accentBg:    "#eef2ff",
  success:     "#16a34a",
  successBg:   "#f0fdf4",
  danger:      "#dc2626",
  dangerBg:    "#fef2f2",
  dark:        "#0f172a",
};

// ─────────────────────────────────────────────────────────────────────────────
// Tiny primitives
// ─────────────────────────────────────────────────────────────────────────────

function Pill({ children, active, onClick }: {
  children: React.ReactNode; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: active ? 600 : 400,
      whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit",
      border: active ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
      background: active ? C.accentBg : C.bg,
      color: active ? C.accent : C.textSecondary,
      transition: "all 0.12s",
    }}>{children}</button>
  );
}

function IconBtn({ children, onClick, title, disabled }: {
  children: React.ReactNode; onClick: () => void; title?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{
      width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`,
      background: C.bg, cursor: disabled ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, color: C.textSecondary, opacity: disabled ? 0.4 : 1,
      fontFamily: "inherit",
    }}>{children}</button>
  );
}

function Badge({ children, tone = "default" }: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warn" | "open";
}) {
  const map = {
    default: { bg: C.bgTertiary,  color: C.textSecondary },
    success: { bg: C.successBg,   color: C.success        },
    warn:    { bg: "#fffbeb",      color: "#92400e"        },
    open:    { bg: C.accentBg,    color: C.accent         },
  };
  const s = map[tone];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px",
      borderRadius: 999, background: s.bg, color: s.color,
      letterSpacing: "0.04em", textTransform: "uppercase",
    }}>{children}</span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal shell
// ─────────────────────────────────────────────────────────────────────────────

function Modal({ title, width = 420, onClose, children }: {
  title: string; width?: number; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: C.bg, borderRadius: 16, width: "100%", maxWidth: width,
        boxShadow: "0 24px 64px rgba(0,0,0,0.2)", overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{title}</span>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`,
            background: "none", cursor: "pointer", fontSize: 16, color: C.textTertiary,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt modal
// ─────────────────────────────────────────────────────────────────────────────

function ReceiptModal({ saleNo, total, change, lines, onClose }: {
  saleNo: string; total: number; change: number;
  lines: CartLine[]; onClose: () => void;
}) {
  return (
    <Modal title="Sale Confirmed" width={400} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{
          textAlign: "center", padding: "20px 0",
          borderBottom: `1px dashed ${C.border}`,
        }}>
          <div style={{ fontSize: 40 }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.success, marginTop: 8 }}>
            ${fmt(total)}
          </div>
          <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 4 }}>
            Sale {saleNo}
          </div>
        </div>

        <div style={{ fontSize: 12 }}>
          {lines.map((l) => (
            <div key={l.menuItemId} style={{
              display: "flex", justifyContent: "space-between",
              padding: "5px 0", borderBottom: `1px solid ${C.bgTertiary}`,
              color: C.textSecondary,
            }}>
              <span>{l.name} × {l.qty}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>${fmt(l.price * l.qty)}</span>
            </div>
          ))}
        </div>

        {change > 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between",
            padding: "10px 14px", borderRadius: 8,
            background: C.accentBg, color: C.accent, fontWeight: 600, fontSize: 14,
          }}>
            <span>Change due</span>
            <span>${fmt(change)}</span>
          </div>
        )}

        <button onClick={onClose} style={{
          width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
          background: C.dark, color: "#fff", fontSize: 14, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          New sale
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment modal
// ─────────────────────────────────────────────────────────────────────────────

function PaymentModal({ grandTotal, payments, setPayments, saving, onConfirm, onBack }: {
  grandTotal: number;
  payments: SplitPayment[];
  setPayments: React.Dispatch<React.SetStateAction<SplitPayment[]>>;
  saving: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const change    = totalPaid - grandTotal;
  const canCharge = totalPaid >= grandTotal && !saving;

  const updatePayment = (i: number, patch: Partial<SplitPayment>) =>
    setPayments((p) => p.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  const fillRemaining = (i: number) => {
    const paid = payments.reduce((s, p, idx) => idx === i ? s : s + (Number(p.amount) || 0), 0);
    updatePayment(i, { amount: Math.max(0, grandTotal - paid).toFixed(2) });
  };

  return (
    <Modal title={`Payment — $${fmt(grandTotal)}`} width={440} onClose={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {payments.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={p.method}
              onChange={(e) => updatePayment(i, { method: e.target.value })}
              style={{
                flex: "0 0 120px", padding: "8px 10px", borderRadius: 8, fontSize: 13,
                border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary,
                fontFamily: "inherit",
              }}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              value={p.amount}
              onChange={(e) => updatePayment(i, { amount: e.target.value })}
              inputMode="decimal" placeholder="0.00"
              style={{
                flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 13,
                border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary,
                fontFamily: "inherit", textAlign: "right", fontVariantNumeric: "tabular-nums",
              }} />
            <IconBtn onClick={() => fillRemaining(i)} title="Fill remaining">↓</IconBtn>
            {payments.length > 1 && (
              <IconBtn onClick={() => setPayments((prev) => prev.filter((_, idx) => idx !== i))}>×</IconBtn>
            )}
          </div>
        ))}

        <button
          onClick={() => setPayments((p) => [...p, { method: "CASH", amount: "" }])}
          style={{
            fontSize: 12, padding: "7px 14px", borderRadius: 8, cursor: "pointer",
            border: `1px dashed ${C.border}`, background: "transparent",
            color: C.textSecondary, fontFamily: "inherit", width: "fit-content",
          }}>
          + Split payment
        </button>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textSecondary, fontVariantNumeric: "tabular-nums" }}>
            <span>Paid</span>
            <span>${fmt(totalPaid)}</span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums",
            color: change >= 0 ? C.success : C.danger,
          }}>
            <span>{change >= 0 ? "Change" : "Remaining"}</span>
            <span>${fmt(Math.abs(change))}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={onBack} disabled={saving}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13,
              border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary,
              cursor: "pointer", fontFamily: "inherit",
            }}>
            Back
          </button>
          <button onClick={onConfirm} disabled={!canCharge}
            style={{
              flex: 2, padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: "none", background: canCharge ? C.dark : C.border,
              color: canCharge ? "#fff" : C.textTertiary,
              cursor: canCharge ? "pointer" : "not-allowed", fontFamily: "inherit",
              transition: "background 0.15s",
            }}>
            {saving ? "Processing…" : `Confirm — $${fmt(grandTotal)}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// No-session screen
// ─────────────────────────────────────────────────────────────────────────────

function NoSessionScreen({ onManage }: { onManage: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: C.bgSecondary,
    }}>
      <div style={{
        textAlign: "center", maxWidth: 360, padding: "48px 32px",
        background: C.bg, borderRadius: 20, border: `1px solid ${C.border}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>
          No active session
        </div>
        <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, marginBottom: 28 }}>
          A cashier session must be open before taking orders. Open a session to start the shift.
        </div>
        <button onClick={onManage} style={{
          padding: "12px 28px", borderRadius: 10, fontSize: 14, fontWeight: 600,
          border: "none", background: C.dark, color: "#fff",
          cursor: "pointer", fontFamily: "inherit",
        }}>
          Manage session
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function PosPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();
  const effectiveBranchId = branchId ?? "";
  const searchRef = useRef<HTMLInputElement>(null);

  // ── State ────────────────────────────────────────────────────────────────

  const [session,            setSession]            = useState<any>(null);
  const [locations,          setLocations]          = useState<LocationLite[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [categories,         setCategories]         = useState<MenuCategoryDto[]>([]);
  const [items,              setItems]              = useState<MenuItemPosDto[]>([]);
  const [activeCategoryId,   setActiveCategoryId]   = useState<string | null>(null);
  const [catalogLoading,     setCatalogLoading]     = useState(false);
  const [search,             setSearch]             = useState("");
  const [cart,               setCart]               = useState<CartLine[]>([]);
  const [discount,           setDiscount]           = useState("0");
  const [tax,                setTax]                = useState("0");
  const [showPayment,        setShowPayment]        = useState(false);
  const [payments,           setPayments]           = useState<SplitPayment[]>([{ method: "CASH", amount: "" }]);
  const [parkedSales,        setParkedSales]        = useState<any[]>([]);
  const [showParked,         setShowParked]         = useState(false);
  const [parkedLoading,      setParkedLoading]      = useState(false);
  const [saving,             setSaving]             = useState(false);
  const [err,                setErr]                = useState<string | null>(null);
  const [receipt,            setReceipt]            = useState<{ saleNo: string; total: number; change: number; lines: CartLine[] } | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!companyId || !effectiveBranchId) return;
    posApi.currentSession(companyId, effectiveBranchId)
      .then(setSession).catch(() => setSession(null));
  }, [companyId, effectiveBranchId]);

  useEffect(() => {
    if (!companyId || !effectiveBranchId) return;
    stockLocationsApi.list(companyId, effectiveBranchId)
      .then((rows) => {
        const active = rows.filter((x) => x.isActive !== false);
        setLocations(active);
        setSelectedLocationId((prev) => {
          if (active.some((x) => x.id === prev)) return prev;
          const sessionLoc = session?.locationId as string | undefined;
          if (sessionLoc && active.some((x) => x.id === sessionLoc)) return sessionLoc;
          return active[0]?.id ?? "";
        });
      })
      .catch(() => { setLocations([]); setSelectedLocationId(""); });
  }, [companyId, effectiveBranchId, session?.locationId]);

  useEffect(() => {
    if (!companyId || !effectiveBranchId) return;
    setCatalogLoading(true);
    posApi.categories(companyId, effectiveBranchId)
      .then((cats) => {
        setCategories(cats);
        setActiveCategoryId((prev) =>
          prev && cats.some((c) => c.id === prev) ? prev : cats[0]?.id ?? null
        );
      })
      .catch(() => setCategories([]))
      .finally(() => setCatalogLoading(false));
  }, [companyId, effectiveBranchId]);

  useEffect(() => {
    if (!companyId || !effectiveBranchId || !activeCategoryId) return;
    setCatalogLoading(true);
    posApi.categoryItems(companyId, effectiveBranchId, activeCategoryId)
      .then(setItems).catch(() => setItems([]))
      .finally(() => setCatalogLoading(false));
  }, [companyId, effectiveBranchId, activeCategoryId]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) || i.code?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const subTotal    = useMemo(() => cart.reduce((s, l) => s + l.price * l.qty, 0), [cart]);
  const discountAmt = Number(discount) || 0;
  const taxAmt      = Number(tax) || 0;
  const grandTotal  = Math.max(0, subTotal - discountAmt + taxAmt);
  const cartCount   = cart.reduce((s, l) => s + l.qty, 0);
  const totalPaid   = useMemo(() => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments]);
  const change      = totalPaid - grandTotal;

  // ── Cart actions ──────────────────────────────────────────────────────────

  function addToCart(item: MenuItemPosDto) {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (existing) return prev.map((l) => l.menuItemId === item.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { menuItemId: item.id, name: item.name, price: item.sellingPrice, qty: 1 }];
    });
  }

  function updateQty(menuItemId: string, qty: number) {
    if (qty <= 0) { setCart((p) => p.filter((l) => l.menuItemId !== menuItemId)); return; }
    setCart((p) => p.map((l) => l.menuItemId === menuItemId ? { ...l, qty } : l));
  }

  function clearCart() {
    setCart([]); setDiscount("0"); setTax("0");
    setPayments([{ method: "CASH", amount: "" }]); setErr(null);
  }

  // ── Parked ────────────────────────────────────────────────────────────────

  const loadParkedSales = useCallback(async () => {
    if (!companyId || !effectiveBranchId) return;
    setParkedLoading(true);
    try {
      const r = await salesApi.list(companyId, effectiveBranchId, { status: 1 });
      setParkedSales(r.items ?? []);
    } catch { setParkedSales([]); }
    finally { setParkedLoading(false); }
  }, [companyId, effectiveBranchId]);

  async function resumeParkedSale(saleId: string) {
    if (!companyId || !effectiveBranchId) return;
    try {
      const sale = await salesApi.get(companyId, effectiveBranchId, saleId);
      setCart(sale.saleItems.map((l: any) => ({
        menuItemId: l.menuItemId, name: l.menuItemName || l.menuItemId,
        price: l.unitPrice, qty: l.quantity,
      })));
      setShowParked(false);
    } catch (e) { setErr(extractApiError(e, "Failed to resume parked sale.")); }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function parkSale() {
    if (!companyId || !effectiveBranchId || !cart.length) return;
    setSaving(true); setErr(null);
    try {
      await salesApi.create(companyId, effectiveBranchId, {
        companyId, branchId: effectiveBranchId, locationId: selectedLocationId,
        lines: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.qty, unitPrice: l.price })),
        discountAmount: discountAmt, taxAmount: taxAmt, payment: null,
      });
      clearCart();
    } catch (e) { setErr(extractApiError(e, "Failed to park sale.")); }
    finally { setSaving(false); }
  }

  async function confirmSale() {
    if (!companyId || !effectiveBranchId || !cart.length || totalPaid < grandTotal) return;
    setSaving(true); setErr(null);
    try {
      const first = payments[0];
      const sale = await salesApi.create(companyId, effectiveBranchId, {
        companyId, branchId: effectiveBranchId, locationId: selectedLocationId,
        lines: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.qty, unitPrice: l.price })),
        discountAmount: discountAmt, taxAmount: taxAmt,
        payment: first ? { method: first.method, amount: Number(first.amount) || 0 } : null,
      });
      for (const p of payments.slice(1)) {
        if (Number(p.amount) > 0)
          await salesApi.recordPayment(companyId, effectiveBranchId, sale.id, {
            method: p.method, amount: Number(p.amount),
          });
      }
      await salesApi.confirm(companyId, effectiveBranchId, sale.id);
      const currentCart = [...cart];
      clearCart();
      setShowPayment(false);
      setReceipt({
        saleNo: sale.saleNo ?? sale.id,
        total:  grandTotal,
        change: Math.max(0, change),
        lines:  currentCart,
      });
    } catch (e) { setErr(extractApiError(e, "Failed to process sale.")); }
    finally { setSaving(false); }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!session || session.status !== 1) {
    return <NoSessionScreen onManage={() => nav("/sales/session")} />;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      fontFamily: "var(--font-sans, system-ui, sans-serif)",
      background: C.bgSecondary,
    }}>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {showPayment && (
        <PaymentModal
          grandTotal={grandTotal}
          payments={payments}
          setPayments={setPayments}
          saving={saving}
          onConfirm={confirmSale}
          onBack={() => setShowPayment(false)}
        />
      )}

      {receipt && (
        <ReceiptModal
          saleNo={receipt.saleNo}
          total={receipt.total}
          change={receipt.change}
          lines={receipt.lines}
          onClose={() => setReceipt(null)}
        />
      )}

      {/* ── Parked drawer ─────────────────────────────────────────────────── */}
      {showParked && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.3)",
          display: "flex", justifyContent: "flex-end",
        }} onClick={() => setShowParked(false)}>
          <div style={{
            width: 340, height: "100%", background: C.bg,
            display: "flex", flexDirection: "column",
            borderLeft: `1px solid ${C.border}`,
            boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                Parked sales
              </span>
              <IconBtn onClick={() => setShowParked(false)}>✕</IconBtn>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {parkedLoading ? (
                <div style={{ padding: 32, textAlign: "center", color: C.textTertiary, fontSize: 13 }}>
                  Loading…
                </div>
              ) : parkedSales.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: C.textTertiary, fontSize: 13, fontStyle: "italic" }}>
                  No parked sales
                </div>
              ) : parkedSales.map((sale: any) => (
                <div key={sale.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: C.textPrimary }}>
                      {sale.saleNo}
                    </div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                      ${fmt(sale.totalAmount)} · {sale.itemCount} items
                    </div>
                    <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 1 }}>
                      {new Date(sale.soldAtUtc).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    onClick={() => resumeParkedSale(sale.id)}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                      border: `1px solid ${C.border}`, background: C.bgSecondary,
                      color: C.textPrimary, cursor: "pointer", fontFamily: "inherit",
                    }}>
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Left: Catalog ─────────────────────────────────────────────────── */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        overflow: "hidden", borderRight: `1px solid ${C.border}`,
      }}>

        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", background: C.bg,
          borderBottom: `1px solid ${C.border}`, gap: 12, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => nav("/sales/session")}
              style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12,
                border: `1px solid ${C.border}`, background: C.bgSecondary,
                color: C.textSecondary, cursor: "pointer", fontFamily: "inherit",
              }}>
              ← Session
            </button>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              style={{
                padding: "6px 10px", borderRadius: 8, fontSize: 12,
                border: `1px solid ${C.border}`, background: C.bgSecondary,
                color: C.textPrimary, fontFamily: "inherit", width: 180,
              }}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          {/* Search */}
          <div style={{ flex: 1, maxWidth: 320, position: "relative" }}>
            <span style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              fontSize: 14, color: C.textTertiary, pointerEvents: "none",
            }}>⌕</span>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "7px 10px 7px 30px", borderRadius: 8, fontSize: 13,
                border: `1px solid ${C.border}`, background: C.bgSecondary,
                color: C.textPrimary, fontFamily: "inherit", outline: "none",
              }} />
          </div>

          <div style={{ fontSize: 12, color: C.textTertiary }}>
            {session.cashierName} · <Badge tone="open">Open</Badge>
          </div>
        </div>

        {/* Category bar */}
        <div style={{
          display: "flex", gap: 6, padding: "10px 16px",
          overflowX: "auto", background: C.bg,
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0, scrollbarWidth: "none",
        }}>
          {categories.map((c) => (
            <Pill key={c.id} active={activeCategoryId === c.id}
              onClick={() => { setActiveCategoryId(c.id); setSearch(""); }}>
              {c.name}
              <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>
                {c.itemCount}
              </span>
            </Pill>
          ))}
        </div>

        {err && (
          <div style={{
            margin: "8px 16px", padding: "10px 14px", borderRadius: 10,
            background: "#fef2f2", border: "1px solid #fecaca",
            fontSize: 12, color: C.danger,
          }}>{err}</div>
        )}

        {/* Item grid */}
        {catalogLoading ? (
          <div style={{ padding: 48, textAlign: "center", color: C.textTertiary, fontSize: 13 }}>
            Loading catalog…
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 10, padding: 16, overflowY: "auto", flex: 1,
          }}>
            {filteredItems.length === 0 ? (
              <div style={{
                gridColumn: "1 / -1", padding: "48px 0",
                textAlign: "center", color: C.textTertiary, fontSize: 13,
              }}>
                {search ? `No results for "${search}"` : "No items in this category."}
              </div>
            ) : filteredItems.map((item) => {
              const inCart = cart.find((l) => l.menuItemId === item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start",
                    padding: "12px 14px", background: inCart ? C.accentBg : C.bg,
                    border: inCart ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                    borderRadius: 10, cursor: "pointer", textAlign: "left",
                    transition: "border-color 0.12s, background 0.12s", gap: 4,
                    fontFamily: "inherit",
                  }}>
                  {inCart && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 7px",
                      background: C.accent, color: "#fff", borderRadius: 999,
                      marginBottom: 2,
                    }}>
                      ×{inCart.qty}
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, lineHeight: 1.3 }}>
                    {item.name}
                  </span>
                  {item.code && (
                    <span style={{ fontSize: 11, color: C.textTertiary }}>{item.code}</span>
                  )}
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: C.dark,
                    marginTop: 6, fontVariantNumeric: "tabular-nums",
                  }}>
                    ${fmt(item.sellingPrice)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Right: Cart ───────────────────────────────────────────────────── */}
      <aside style={{
        width: 340, display: "flex", flexDirection: "column",
        background: C.bg, flexShrink: 0,
      }}>

        {/* Cart header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 15, fontWeight: 700, color: C.textPrimary,
            }}>
              Order
              {cartCount > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "1px 8px",
                  background: C.dark, color: "#fff", borderRadius: 999,
                }}>
                  {cartCount}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>
              {session.terminal}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => { setShowParked(true); void loadParkedSales(); }}
              style={{
                padding: "5px 10px", borderRadius: 7, fontSize: 12,
                border: `1px solid ${C.border}`, background: C.bgSecondary,
                color: C.textSecondary, cursor: "pointer", fontFamily: "inherit",
              }}>
              Parked
            </button>
            <button
              onClick={clearCart}
              disabled={!cart.length}
              style={{
                padding: "5px 10px", borderRadius: 7, fontSize: 12,
                border: `1px solid ${C.border}`, background: C.bgSecondary,
                color: !cart.length ? C.textTertiary : C.danger,
                cursor: cart.length ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}>
              Clear
            </button>
          </div>
        </div>

        {/* Cart lines */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {cart.length === 0 ? (
            <div style={{
              padding: "40px 16px", textAlign: "center",
              fontSize: 13, color: C.textTertiary, fontStyle: "italic",
            }}>
              Tap an item to add it to the order.
            </div>
          ) : cart.map((line) => (
            <div key={line.menuItemId} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 16px", borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: C.textPrimary,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{line.name}</div>
                <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>
                  ${fmt(line.price)} each
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => updateQty(line.menuItemId, line.qty - 1)}
                  style={{
                    width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`,
                    background: C.bgSecondary, cursor: "pointer", fontSize: 14,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: C.textPrimary,
                  }}>−</button>
                <span style={{
                  fontSize: 13, fontWeight: 700, minWidth: 22, textAlign: "center",
                  fontVariantNumeric: "tabular-nums",
                }}>{line.qty}</span>
                <button
                  onClick={() => updateQty(line.menuItemId, line.qty + 1)}
                  style={{
                    width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`,
                    background: C.bgSecondary, cursor: "pointer", fontSize: 14,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: C.textPrimary,
                  }}>+</button>
              </div>
              <div style={{
                fontSize: 13, fontWeight: 600, minWidth: 56, textAlign: "right",
                fontVariantNumeric: "tabular-nums", color: C.textPrimary,
              }}>
                ${fmt(line.price * line.qty)}
              </div>
            </div>
          ))}
        </div>

        {/* Adjustments */}
        {cart.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            padding: "10px 16px", borderTop: `1px solid ${C.border}`, flexShrink: 0,
          }}>
            {[["Discount", discount, setDiscount], ["Tax", tax, setTax]].map(([label, val, setter]) => (
              <div key={label as string}>
                <div style={{ fontSize: 11, color: C.textTertiary, marginBottom: 4 }}>
                  {label as string}
                </div>
                <input
                  value={val as string}
                  onChange={(e) => (setter as any)(e.target.value)}
                  inputMode="decimal"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    fontSize: 13, padding: "7px 10px", borderRadius: 8,
                    border: `1px solid ${C.border}`, background: C.bgSecondary,
                    color: C.textPrimary, fontFamily: "inherit",
                  }} />
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          {[
            ["Subtotal",  subTotal],
            ["Discount", -discountAmt],
            ["Tax",       taxAmt],
          ].map(([label, value]) => (
            <div key={label as string} style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 12, color: C.textSecondary, padding: "2px 0",
              fontVariantNumeric: "tabular-nums",
            }}>
              <span>{label as string}</span>
              <span>${fmt(value as number)}</span>
            </div>
          ))}
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 18, fontWeight: 800, marginTop: 8, paddingTop: 8,
            borderTop: `1px solid ${C.border}`,
            color: C.textPrimary, fontVariantNumeric: "tabular-nums",
          }}>
            <span>Total</span>
            <span>${fmt(grandTotal)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: "flex", gap: 8, padding: "12px 16px",
          borderTop: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <button
            onClick={parkSale}
            disabled={saving || !cart.length}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 500,
              border: `1px solid ${C.border}`, background: C.bgSecondary,
              color: saving || !cart.length ? C.textTertiary : C.textPrimary,
              cursor: saving || !cart.length ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}>
            {saving ? "Saving…" : "Park"}
          </button>
          <button
            disabled={saving || !cart.length}
            onClick={() => {
              setErr(null);
              setPayments([{ method: "CASH", amount: grandTotal.toFixed(2) }]);
              setShowPayment(true);
            }}
            style={{
              flex: 2, padding: "11px 0", borderRadius: 10, fontSize: 15, fontWeight: 700,
              border: "none",
              background: saving || !cart.length ? C.border : C.dark,
              color: saving || !cart.length ? C.textTertiary : "#fff",
              cursor: saving || !cart.length ? "not-allowed" : "pointer",
              fontFamily: "inherit", fontVariantNumeric: "tabular-nums",
            }}>
            Charge ${fmt(grandTotal)}
          </button>
        </div>
      </aside>
    </div>
  );
}