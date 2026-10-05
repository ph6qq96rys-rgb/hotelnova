import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import { tipFromPercent, tipBasis } from "./posTips";
import type { TipSettingsDto } from "../api/posTipsApi";

type Translate = (text: string, values?: Record<string, string | number>) => string;

export type PrintLine = { quantity: number; name: string; amount: number };

export type GuestCheck = {
  businessName?: string | null;
  ticketNo: string;
  tableLabel?: string | null;
  guestCount?: number | null;
  waiterName?: string | null;
  lines: PrintLine[];
  subtotal: number;
  serviceCharge: number;
  tax: number;
  total: number;
  printedAt: Date;
};

export type ReceiptPayment = { method: string; amount: number; tip: number; reference?: string | null };

export type Receipt = GuestCheck & {
  saleNo: string;
  payments: ReceiptPayment[];
};

const escape = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const amount = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STYLE = `
  @page { size: 80mm auto; margin: 4mm; }
  body { font: 12px/1.35 ui-monospace, Menlo, Consolas, monospace; color: black; margin: 0; width: 72mm; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
  p { margin: 0; }
  .c { text-align: center; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row span:first-child { overflow-wrap: anywhere; }
  .rule { border-top: 1px dashed black; margin: 6px 0; }
  .big { font-weight: 700; font-size: 13px; }
  .muted { font-size: 11px; }
`;

function header(doc: GuestCheck, tx: Translate) {
  return [
    doc.businessName ? `<h1>${escape(doc.businessName)}</h1>` : "",
    `<p class="c">${escape(tx("Ticket"))} ${escape(doc.ticketNo)}</p>`,
    doc.tableLabel ? `<p class="c">${escape(tx("Table"))} ${escape(doc.tableLabel)}${doc.guestCount ? ` · ${escape(tx("{count} guests", { count: doc.guestCount }))}` : ""}</p>` : "",
    doc.waiterName ? `<p class="c">${escape(tx("Server"))}: ${escape(doc.waiterName)}</p>` : "",
    `<p class="c muted">${escape(formatAppDateTime(doc.printedAt))}</p>`,
    `<div class="rule"></div>`,
    ...doc.lines.map((line) => `<div class="row"><span>${line.quantity} × ${escape(line.name)}</span><span>${amount(line.amount)}</span></div>`),
    `<div class="rule"></div>`,
    `<div class="row"><span>${escape(tx("Subtotal"))}</span><span>${amount(doc.subtotal)}</span></div>`,
    doc.serviceCharge ? `<div class="row"><span>${escape(tx("Service Charge"))}</span><span>${amount(doc.serviceCharge)}</span></div>` : "",
    `<div class="row"><span>${escape(tx("Tax"))}</span><span>${amount(doc.tax)}</span></div>`,
  ].join("");
}

/** Pre-payment guest check. Shows suggested tips for information only; nothing is added to the bill. */
export function guestCheckHtml(doc: GuestCheck, settings: TipSettingsDto | null, tipsOffered: boolean, tx: Translate) {
  const basis = tipBasis(doc.total, doc.total, doc.tax, settings?.basis);
  const suggestions = tipsOffered && settings?.suggestedPercents.length
    ? [
        `<div class="rule"></div>`,
        `<p class="c">${escape(tx("Gratuity is not included. Suggested tips:"))}</p>`,
        ...settings.suggestedPercents.map((percent) =>
          `<div class="row"><span>${percent}%</span><span>${amount(tipFromPercent(basis, percent))}</span></div>`),
        `<p class="c muted">${escape(tx(settings.basis === "beforeTax" ? "Calculated on the bill before tax." : "Calculated on the bill including tax."))}</p>`,
      ].join("")
    : "";
  return `<title>${escape(tx("Guest check"))} ${escape(doc.ticketNo)}</title><style>${STYLE}</style>` +
    `<p class="c big">${escape(tx("Guest check"))}</p>` + header(doc, tx) +
    `<div class="row big"><span>${escape(tx("Amount due"))}</span><span>${amount(doc.total)}</span></div>` + suggestions +
    `<div class="rule"></div><p class="c muted">${escape(tx("This is not a receipt."))}</p>`;
}

/** Receipt after settlement: the bill, each payment with its tip, and the total paid. */
export function receiptHtml(doc: Receipt, tx: Translate) {
  const tips = doc.payments.reduce((sum, payment) => sum + payment.tip, 0);
  const paid = doc.payments.reduce((sum, payment) => sum + payment.amount + payment.tip, 0);
  return `<title>${escape(tx("Receipt"))} ${escape(doc.saleNo)}</title><style>${STYLE}</style>` +
    `<p class="c big">${escape(tx("Receipt"))} ${escape(doc.saleNo)}</p>` + header(doc, tx) +
    `<div class="row big"><span>${escape(tx("Bill total"))}</span><span>${amount(doc.total)}</span></div>` +
    (tips > 0 ? `<div class="row"><span>${escape(tx("Tip"))}</span><span>${amount(tips)}</span></div>` : "") +
    `<div class="row big"><span>${escape(tx("Total paid"))}</span><span>${amount(paid)}</span></div>` +
    `<div class="rule"></div>` +
    doc.payments.map((payment) =>
      `<div class="row"><span>${escape(tx(payment.method))}${payment.reference ? ` (${escape(payment.reference)})` : ""}</span><span>${amount(payment.amount + payment.tip)}</span></div>` +
      (payment.tip > 0 ? `<div class="row muted"><span>&nbsp;&nbsp;${escape(tx("incl. tip"))}</span><span>${amount(payment.tip)}</span></div>` : "")).join("") +
    `<div class="rule"></div><p class="c">${escape(tx("Thank you"))}</p>`;
}

/** Prints an HTML document through a hidden frame, so the POS screen stays as it is. */
export function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc || !frame.contentWindow) { frame.remove(); return; }
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`);
  doc.close();
  const win = frame.contentWindow;
  window.setTimeout(() => {
    win.focus();
    win.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, 50);
}
