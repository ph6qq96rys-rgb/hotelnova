import type { TipBasis, TipSettingsDto } from "../api/posTipsApi";
import type { PaymentMethod } from "../types/posTypes";
import { round2 } from "./posCart";

/** The guest's explicit tip decision. `null` means nobody has chosen yet: there is never a default tip. */
export type TipChoice =
  | { kind: "none" }
  | { kind: "percent"; percent: number }
  | { kind: "custom"; amount: string };

export type PayerDraft = {
  key: string;
  method: PaymentMethod;
  /** This payer's share of the bill (without tip). */
  amount: string;
  /** Cash handed over, for cash payers. */
  tendered: string;
  reference: string;
  tip: TipChoice | null;
};

export type TipContext = {
  /** Tips may be offered for this order (enabled for the branch and service type, and a server is assigned). */
  offered: boolean;
  settings: TipSettingsDto | null;
  billTotal: number;
  billTax: number;
};

let payerSeq = 0;
export function newPayer(amount: number, method: PaymentMethod = "CASH"): PayerDraft {
  payerSeq += 1;
  return { key: `payer-${payerSeq}`, method, amount: amount > 0 ? amount.toFixed(2) : "", tendered: "", reference: "", tip: null };
}

/** The part of a payer's share that tip percentages apply to. Mirrors TipCalculator.Basis on the server. */
export function tipBasis(share: number, billTotal: number, billTax: number, basis: TipBasis | undefined) {
  if (basis !== "beforeTax" || billTotal <= 0) return round2(share);
  return round2(share * (billTotal - billTax) / billTotal);
}

export function tipFromPercent(basis: number, percent: number) {
  return round2(basis * percent / 100);
}

/** Cash tips can only be recorded when the branch tracks them through the drawer. */
export function canTipWith(method: PaymentMethod, settings: TipSettingsDto | null) {
  return method !== "CASH" || !!settings?.trackCashTips;
}

export function payerBasis(payer: PayerDraft, ctx: TipContext) {
  return tipBasis(Number(payer.amount) || 0, ctx.billTotal, ctx.billTax, ctx.settings?.basis);
}

export function payerTip(payer: PayerDraft, ctx: TipContext) {
  if (!ctx.offered || !payer.tip || !canTipWith(payer.method, ctx.settings)) return 0;
  if (payer.tip.kind === "none") return 0;
  if (payer.tip.kind === "percent") return tipFromPercent(payerBasis(payer, ctx), payer.tip.percent);
  const custom = Number(payer.tip.amount);
  return Number.isFinite(custom) && custom > 0 ? round2(custom) : 0;
}

export function paymentSummary(payers: PayerDraft[], ctx: TipContext) {
  const bill = round2(payers.reduce((sum, payer) => sum + (Number(payer.amount) || 0), 0));
  const tips = round2(payers.reduce((sum, payer) => sum + payerTip(payer, ctx), 0));
  return { bill, tips, collected: round2(bill + tips), remaining: round2(ctx.billTotal - bill) };
}

/** First problem that stops this payer from paying, or null. */
export function payerProblem(payer: PayerDraft, ctx: TipContext, single: boolean): string | null {
  const share = Number(payer.amount);
  if (!single && !(share > 0)) return "Enter each payer's share of the bill.";
  if (ctx.offered && canTipWith(payer.method, ctx.settings) && !payer.tip) return "Ask the guest about a tip: choose No tip, a percentage or a custom amount.";
  if (payer.tip?.kind === "custom") {
    const custom = Number(payer.tip.amount);
    if (!Number.isFinite(custom) || custom < 0) return "Enter a valid tip amount.";
    if (custom > payerBasis(payer, ctx)) return "A tip cannot exceed the payer's share of the bill.";
  }
  const due = round2(share + payerTip(payer, ctx));
  if (payer.method === "CASH" && !(Number(payer.tendered) >= due)) return "Cash received is insufficient to complete the transaction.";
  if (payer.method !== "CASH" && !payer.reference.trim()) return "Payment reference is required for card, mobile, and transfer payments.";
  return null;
}

export function paymentProblem(payers: PayerDraft[], ctx: TipContext): string | null {
  if (payers.length === 0) return "Add a payer.";
  const { remaining } = paymentSummary(payers, ctx);
  if (Math.abs(remaining) >= 0.01) return remaining > 0 ? "The payers' shares do not cover the bill yet." : "The payers' shares are more than the bill.";
  for (const payer of payers) {
    const problem = payerProblem(payer, ctx, payers.length === 1);
    if (problem) return problem;
  }
  return null;
}

/** Payment lines for the settle / create-sale request. The tip travels beside, never inside, the bill amount. */
export function buildPayments(payers: PayerDraft[], ctx: TipContext) {
  return payers.map((payer) => {
    const tipAmount = payerTip(payer, ctx);
    return {
      method: payer.method,
      amount: round2(Number(payer.amount) || 0),
      referenceCode: payer.reference.trim() || null,
      tipAmount,
      tipPercent: tipAmount > 0 && payer.tip?.kind === "percent" ? payer.tip.percent : null,
    };
  });
}

/** Splits the bill evenly across `count` payers; the last payer absorbs rounding. */
export function splitEvenly(total: number, count: number): number[] {
  const each = Math.floor(total / count * 100) / 100;
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? round2(total - each * (count - 1)) : each));
}
