// ─── Sales Utility Functions ──────────────────────────────────────────────────
// Pure helpers — no React, no side effects, fully testable.

// ── Formatting ────────────────────────────────────────────────────────────────

export const fmt = (n: number, dp = 2): string =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })
    : "0.00";

export const fmtMoney = (n: number): string => `$${fmt(n)}`;

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

// ── Error extraction ──────────────────────────────────────────────────────────

export function extractApiError(e: unknown, fallback: string): string {
  const err = e as any;
  const data = err?.response?.data;
  if (!data) return err?.message ?? fallback;
  if (typeof data === "string") return data;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.title === "string") return data.title;
  if (data?.errors && typeof data.errors === "object") {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && first[0]) return String(first[0]);
  }
  return err?.message ?? fallback;
}

// ── Line ID generator ─────────────────────────────────────────────────────────

let _counter = 0;
export const newLineUid = (): string => `line-${Date.now()}-${++_counter}`;

// ── Sale totals ───────────────────────────────────────────────────────────────

export interface SaleTotals {
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
}

export function calcTotals(
  lines: Array<{ quantity: string | number; unitPrice: string | number }>,
  discount: string | number,
  tax: string | number
): SaleTotals {
  const subTotal = lines.reduce((s, l) => {
    return s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
  }, 0);
  const discountAmount = Number(discount) || 0;
  const taxAmount = Number(tax) || 0;
  const grandTotal = Math.max(0, subTotal - discountAmount + taxAmount);
  return { subTotal, discountAmount, taxAmount, grandTotal };
}

// ── Sale line validation ──────────────────────────────────────────────────────

export function validateSaleLines(
  lines: Array<{ menuItemId: string; quantity: string | number; unitPrice: string | number }>
): string | null {
  if (!lines.length) return "Add at least one line.";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.menuItemId) return `Line ${i + 1}: select a menu item.`;
    if (Number(l.quantity) <= 0) return `Line ${i + 1}: quantity must be > 0.`;
    if (Number(l.unitPrice) < 0) return `Line ${i + 1}: unit price cannot be negative.`;
  }
  return null;
}

// ── Array unwrap (for APIs that wrap responses) ───────────────────────────────

export function unwrapArray<T>(res: unknown): T[] {
  const r = res as any;
  const raw = r?.data ?? r?.items ?? r?.result ?? r;
  return Array.isArray(raw) ? (raw as T[]) : [];
}