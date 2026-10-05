import { ArrowLeft, Plus, Trash2, Users } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useI18n } from "../../../i18n";
import type { PaymentMethod } from "../types/posTypes";
import { round2 } from "../utils/posCart";
import {
  canTipWith,
  payerBasis,
  payerProblem,
  payerTip,
  paymentSummary,
  tipFromPercent,
  type PayerDraft,
  type TipChoice,
  type TipContext,
} from "../utils/posTips";
import { money } from "./posUi";

type Props = {
  title: string;
  total: number;
  payers: PayerDraft[];
  tips: TipContext;
  /** Why tips are not offered on this order, when they are enabled for the branch. */
  tipNote?: string | null;
  busy: boolean;
  disabledReason?: string | null;
  onChange: (payers: PayerDraft[]) => void;
  onAddPayer: () => void;
  onSplitEvenly: (count: number) => void;
  onConfirm: () => void;
  onBack: () => void;
};

const METHODS: PaymentMethod[] = ["CASH", "CARD", "MOBILE", "TRANSFER"];

function sameChoice(a: TipChoice | null, b: TipChoice) {
  if (!a || a.kind !== b.kind) return false;
  return a.kind !== "percent" || (b.kind === "percent" && a.percent === b.percent);
}

function PayerCard({ payer, index, props }: { payer: PayerDraft; index: number; props: Props }) {
  const { tx } = useI18n();
  const { tips, busy } = props;
  const single = props.payers.length === 1;
  const update = (patch: Partial<PayerDraft>) => props.onChange(props.payers.map((x) => (x.key === payer.key ? { ...x, ...patch } : x)));
  const share = Number(payer.amount) || 0;
  const tip = payerTip(payer, tips);
  const due = round2(share + tip);
  const change = round2((Number(payer.tendered) || 0) - due);
  const tipAllowed = tips.offered && canTipWith(payer.method, tips.settings);
  const basis = payerBasis(payer, tips);
  const shortcuts = [100, 200, 500, 1000, 2000].filter((value) => value > due).slice(0, 3);
  const problem = payerProblem(payer, tips, single);
  const label = single ? tx("Payment") : tx("Payer {number}", { number: index + 1 });

  const tipOptions: Array<{ choice: TipChoice; label: string }> = [
    ...(tips.settings?.allowNoTip !== false ? [{ choice: { kind: "none" } as TipChoice, label: tx("No tip") }] : []),
    ...(tips.settings?.suggestedPercents ?? []).map((percent) => ({
      choice: { kind: "percent", percent } as TipChoice,
      label: `${percent}% · ${money(tipFromPercent(basis, percent))}`,
    })),
    ...(tips.settings?.allowCustom ? [{ choice: { kind: "custom", amount: "" } as TipChoice, label: tx("Custom") }] : []),
  ];

  return (
    <section className="rpos-payer" aria-label={label}>
      <header>
        <h3>{label}</h3>
        {!single ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy} aria-label={`${tx("Remove")} ${label}`}
            onClick={() => props.onChange(props.payers.filter((x) => x.key !== payer.key))}>
            <Trash2 size={15} aria-hidden="true" />
          </Button>
        ) : null}
      </header>

      {!single ? (
        <label className="rpos-field">
          <span>{tx("Share of the bill")}</span>
          <Input type="number" inputMode="decimal" min={0} step="0.01" value={payer.amount} disabled={busy}
            onChange={(event) => update({ amount: event.target.value })} />
        </label>
      ) : null}

      <div className="rpos-chip-row" role="radiogroup" aria-label={`${tx("Payment method")} · ${label}`}>
        {METHODS.map((method) => (
          <Button key={method} type="button" size="sm" variant={payer.method === method ? "default" : "outline"} role="radio"
            aria-checked={payer.method === method} disabled={busy} onClick={() => update({ method })}>
            {tx(method)}
          </Button>
        ))}
      </div>

      {tips.offered ? (
        tipAllowed ? (
          <div className="rpos-tip">
            <span className="rpos-tip-label">{tx("Tip for the server")}</span>
            <div className="rpos-chip-row" role="radiogroup" aria-label={`${tx("Tip")} · ${label}`}>
              {tipOptions.map((option) => (
                <Button key={option.label} type="button" size="sm" role="radio" disabled={busy}
                  variant={sameChoice(payer.tip, option.choice) ? "default" : "outline"}
                  aria-checked={sameChoice(payer.tip, option.choice)}
                  onClick={() => update({ tip: option.choice.kind === "custom" && payer.tip?.kind === "custom" ? payer.tip : option.choice })}>
                  {option.label}
                </Button>
              ))}
            </div>
            {payer.tip?.kind === "custom" ? (
              <label className="rpos-field">
                <span>{tx("Tip amount")}</span>
                <Input type="number" inputMode="decimal" min={0} step="0.01" value={payer.tip.amount} disabled={busy} autoFocus
                  onChange={(event) => update({ tip: { kind: "custom", amount: event.target.value } })} />
              </label>
            ) : null}
          </div>
        ) : (
          <p className="rpos-muted">{tx("Cash tips are not recorded at this branch. Cash tips go to the server directly.")}</p>
        )
      ) : null}

      {payer.method === "CASH" ? (
        <>
          <label className="rpos-field">
            <span>{tx("Cash Received")}</span>
            <Input type="number" inputMode="decimal" min={0} step="0.01" value={payer.tendered} disabled={busy}
              onChange={(event) => update({ tendered: event.target.value })} />
          </label>
          <div className="rpos-chip-row">
            <Button type="button" variant="outline" size="sm" disabled={busy || due <= 0} onClick={() => update({ tendered: due.toFixed(2) })}>
              {tx("Exact amount")}
            </Button>
            {shortcuts.map((value) => (
              <Button key={value} type="button" variant="outline" size="sm" disabled={busy} onClick={() => update({ tendered: String(value) })}>
                {money(value)}
              </Button>
            ))}
          </div>
          {payer.tendered ? (
            <div className="rpos-pay-change">
              <span>{tx(change < 0 ? "Remaining to pay" : "Change to Return")}</span>
              <strong>{money(Math.abs(change))}</strong>
            </div>
          ) : null}
        </>
      ) : (
        <label className="rpos-field">
          <span>{tx("Payment Reference")}</span>
          <Input value={payer.reference} disabled={busy} placeholder={tx("Card, mobile, transfer, or bank reference")}
            onChange={(event) => update({ reference: event.target.value })} />
        </label>
      )}

      <dl className="rpos-payer-sum">
        <div><dt>{tx("Bill share")}</dt><dd>{money(share)}</dd></div>
        {tips.offered ? <div><dt>{tx("Tip")}</dt><dd>{money(tip)}</dd></div> : null}
        <div className="rpos-grand"><dt>{tx("To collect")}</dt><dd>{money(due)}</dd></div>
      </dl>
      {problem && !single ? <p className="rpos-muted">{tx(problem)}</p> : null}
    </section>
  );
}

/**
 * Settlement: one or more payers, each with their own share, method and tip. The tip
 * is chosen explicitly by every payer (nothing is preselected) and is kept beside the
 * bill, so it never changes the sale total.
 */
export function PosPaymentPanel(props: Props) {
  const { tx } = useI18n();
  const summary = paymentSummary(props.payers, props.tips);

  return (
    <section className="rpos-payment" aria-label={tx("Payment")}>
      <header className="rpos-ticket-head">
        <Button type="button" size="sm" variant="ghost" onClick={props.onBack} disabled={props.busy} aria-label={tx("Back to order")}>
          <ArrowLeft size={16} aria-hidden="true" />
        </Button>
        <h2>{props.title}</h2>
      </header>

      <div className="rpos-pay-due">
        <span>{tx("Amount Payable")}</span>
        <strong>{money(props.total)}</strong>
      </div>
      {props.tipNote ? <p className="rpos-muted">{tx(props.tipNote)}</p> : null}

      <div className="rpos-chip-row">
        <Button type="button" size="sm" variant="outline" disabled={props.busy || props.payers.length >= 8} onClick={props.onAddPayer}>
          <Plus size={14} aria-hidden="true" /> {tx("Add payer")}
        </Button>
        {[2, 3, 4].map((count) => (
          <Button key={count} type="button" size="sm" variant="outline" disabled={props.busy} onClick={() => props.onSplitEvenly(count)}>
            <Users size={14} aria-hidden="true" /> {tx("Split {count} ways", { count })}
          </Button>
        ))}
      </div>

      {props.payers.map((payer, index) => <PayerCard key={payer.key} payer={payer} index={index} props={props} />)}

      <dl className="rpos-totals rpos-pay-summary" aria-label={tx("Payment summary")}>
        <div><dt>{tx("Bill")}</dt><dd>{money(summary.bill)}</dd></div>
        {props.tips.offered ? <div><dt>{tx("Tips")}</dt><dd>{money(summary.tips)}</dd></div> : null}
        <div className="rpos-grand"><dt>{tx("Total collected")}</dt><dd>{money(summary.collected)}</dd></div>
        {Math.abs(summary.remaining) >= 0.01 ? (
          <div className="rpos-pending"><dt>{tx(summary.remaining > 0 ? "Bill not covered" : "Over the bill")}</dt><dd>{money(Math.abs(summary.remaining))}</dd></div>
        ) : null}
      </dl>

      {props.disabledReason ? <p className="rpos-muted">{tx(props.disabledReason)}</p> : null}
      <Button type="button" className="rpos-pay-confirm" disabled={props.busy || !!props.disabledReason} aria-busy={props.busy} onClick={props.onConfirm}>
        {props.busy ? tx("Processing...") : tx("Complete Sale")}
      </Button>
    </section>
  );
}
