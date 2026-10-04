import { ArrowLeft } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useI18n } from "../../../i18n";
import type { PaymentMethod } from "../types/posTypes";
import { round2 } from "../utils/posCart";
import { money } from "./posUi";

type Props = {
  title: string;
  total: number;
  method: PaymentMethod;
  tendered: string;
  reference: string;
  busy: boolean;
  disabledReason?: string | null;
  onMethod: (method: PaymentMethod) => void;
  onTendered: (value: string) => void;
  onReference: (value: string) => void;
  onConfirm: () => void;
  onBack: () => void;
};

const METHODS: PaymentMethod[] = ["CASH", "CARD", "MOBILE", "TRANSFER"];

/** Takes one payment for the full amount and shows the change due for cash. */
export function PosPaymentPanel(props: Props) {
  const { tx } = useI18n();
  const change = round2(Number(props.tendered || 0) - props.total);
  const shortcuts = [100, 200, 500, 1000, 2000].filter((value) => value > props.total).slice(0, 3);

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

      <div className="rpos-chip-row" role="radiogroup" aria-label={tx("Payment method")}>
        {METHODS.map((method) => (
          <Button key={method} type="button" variant={props.method === method ? "default" : "outline"} role="radio"
            aria-checked={props.method === method} disabled={props.busy} onClick={() => props.onMethod(method)}>
            {tx(method)}
          </Button>
        ))}
      </div>

      {props.method === "CASH" ? (
        <>
          <label className="rpos-field">
            <span>{tx("Cash Received")}</span>
            <Input type="number" inputMode="decimal" min={0} step="0.01" value={props.tendered} disabled={props.busy}
              onChange={(event) => props.onTendered(event.target.value)} />
          </label>
          <div className="rpos-chip-row">
            <Button type="button" variant="outline" size="sm" disabled={props.busy} onClick={() => props.onTendered(props.total.toFixed(2))}>
              {tx("Exact amount")}
            </Button>
            {shortcuts.map((value) => (
              <Button key={value} type="button" variant="outline" size="sm" disabled={props.busy} onClick={() => props.onTendered(String(value))}>
                {money(value)}
              </Button>
            ))}
          </div>
          <div className="rpos-pay-change">
            <span>{tx(change < 0 ? "Remaining to pay" : "Change to Return")}</span>
            <strong>{money(Math.abs(change))}</strong>
          </div>
        </>
      ) : (
        <label className="rpos-field">
          <span>{tx("Payment Reference")}</span>
          <Input value={props.reference} disabled={props.busy} placeholder={tx("Card, mobile, transfer, or bank reference")}
            onChange={(event) => props.onReference(event.target.value)} />
        </label>
      )}

      {props.disabledReason ? <p className="rpos-muted">{tx(props.disabledReason)}</p> : null}
      <Button type="button" className="rpos-pay-confirm" disabled={props.busy || !!props.disabledReason} aria-busy={props.busy} onClick={props.onConfirm}>
        {props.busy ? tx("Processing...") : tx("Complete Sale")}
      </Button>
    </section>
  );
}
