import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { FormField } from "../../../components/ui/FormField";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import type { SupplierInvoice, SupplierInvoicePayment } from "../api/purchasingApi";
import { payablesApi, type SupplierAdvance, type SupplierCreditNote } from "../api/payablesApi";
import { ActionDialog, LabeledSelect, StatusChip, apiError, date, dateTime, money, todayIso } from "./p2pShared";

type Pending =
  | { kind: "approve" | "reject" | "reverse"; payment: SupplierInvoicePayment }
  | { kind: "credit-approve" | "credit-reject" | "credit-reverse"; note: SupplierCreditNote }
  | { kind: "credit-new" }
  | { kind: "advance-apply" }
  | null;

/**
 * Payments, credit notes and advance applications of one approved supplier invoice. Every money movement is recorded
 * by one person and approved by another (the server enforces it and explains any refusal).
 */
export default function InvoicePayablesPanel({ companyId, invoice, onChanged }: { companyId: string; invoice: SupplierInvoice; onChanged: () => Promise<void> }) {
  const { tx } = useI18n();
  const canManage = useHasPermission("finance.payables.manage");
  const canApprove = useHasPermission("finance.payables.approve");
  const [notes, setNotes] = useState<SupplierCreditNote[]>([]);
  const [advances, setAdvances] = useState<SupplierAdvance[]>([]);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credit, setCredit] = useState({ supplierCreditNo: "", creditDate: todayIso(), category: "PriceAdjustment", netAmount: "", taxAmount: "0", withholdingAmount: "0" });
  const [apply, setApply] = useState({ advanceId: "", amount: "" });

  async function loadRelated() {
    try {
      setNotes(await payablesApi.creditNotes(companyId, invoice.id));
      if (canManage) setAdvances((await payablesApi.advances(companyId, invoice.supplierId)).filter(a => a.status === "Approved" && a.unapplied > 0 && a.currencyCode === invoice.currencyCode));
    } catch (e) { setError(apiError(e, "Unable to load credit notes and advances.")); }
  }
  useEffect(() => { void loadRelated(); }, [companyId, invoice.id, invoice.version]);

  async function act(action: () => Promise<unknown>, fallback: string) {
    setBusy(true); setError(null);
    try { await action(); setPending(null); await onChanged(); await loadRelated(); }
    catch (e) { setError(apiError(e, fallback)); setPending(null); await onChanged(); }
    finally { setBusy(false); }
  }

  const advance = advances.find(a => a.id === apply.advanceId);
  const statusTone = (s: string) => s === "PendingApproval" ? "Pending approval" : s;

  return <>
    {error && <StateMessage tone="error">{tx(error)}</StateMessage>}
    <Card>
      <CardHeader><CardTitle>{tx("Payments")}</CardTitle></CardHeader>
      <CardContent>
        {invoice.pendingPaymentAmount > 0 && <StateMessage tone="info">
          {tx("Waiting for a second person to approve")}: {money(invoice.pendingPaymentAmount, invoice.currencyCode)}. {tx("Approved payments reduce the balance and post to the ledger.")}
        </StateMessage>}
        {invoice.payments.length === 0 ? (
          <EmptyState title={tx("No payments recorded")} detail={tx("Payments can be recorded once the invoice is approved. A second person approves each payment.")} />
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tx("Paid on")}</TableHead><TableHead>{tx("Method")}</TableHead><TableHead>{tx("Reference")}</TableHead>
              <TableHead>{tx("Status")}</TableHead><TableHead>{tx("Recorded")}</TableHead><TableHead className="p2p-right">{tx("Amount")}</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {invoice.payments.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{date(p.paidOn)}</TableCell>
                  <TableCell>{p.advanceId ? tx("Advance applied") : p.method ? tx(p.method) : "-"}</TableCell>
                  <TableCell>{p.reference || "-"}{p.exchangeRate > 0 && invoice.exchangeRate !== 1 ? ` · ${tx("rate")} ${p.exchangeRate}` : ""}</TableCell>
                  <TableCell>
                    <StatusChip status={statusTone(p.status)} />
                    {p.rejectionReason && <div className="p2p-muted">{p.rejectionReason}</div>}
                    {p.reversalReason && <div className="p2p-muted">{tx("Reversed")} {dateTime(p.reversedAtUtc)}: {p.reversalReason}</div>}
                  </TableCell>
                  <TableCell>{dateTime(p.recordedAtUtc)}</TableCell>
                  <TableCell className="p2p-right">{money(p.amount, invoice.currencyCode)}</TableCell>
                  <TableCell className="p2p-right">
                    {canApprove && p.status === "PendingApproval" && <>
                      <Button size="sm" disabled={busy} onClick={() => setPending({ kind: "approve", payment: p })}>{tx("Approve")}</Button>{" "}
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setPending({ kind: "reject", payment: p })}>{tx("Reject")}</Button>
                    </>}
                    {canApprove && p.status === "Approved" && invoice.status === "Approved" &&
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setPending({ kind: "reverse", payment: p })}>{tx("Reverse")}</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {canManage && invoice.status === "Approved" && invoice.availableToPay > 0 && advances.length > 0 &&
          <div className="prq-actions"><Button variant="outline" disabled={busy} onClick={() => { setApply({ advanceId: advances[0].id, amount: String(Math.min(advances[0].unapplied, invoice.availableToPay)) }); setPending({ kind: "advance-apply" }); }}>
            {tx("Apply supplier advance")}</Button></div>}
      </CardContent>
    </Card>

    {(invoice.status === "Approved" || notes.length > 0) && <Card>
      <CardHeader><CardTitle>{tx("Credit notes")}</CardTitle></CardHeader>
      <CardContent>
        <p className="p2p-muted">{tx("Price adjustments, rebates and billing corrections from the supplier. Goods sent back are credited through supplier returns.")}</p>
        {notes.length === 0 ? <EmptyState title={tx("No credit notes")} detail={tx("A credit note is prepared by one person and approved by another.")} /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tx("Credit note")}</TableHead><TableHead>{tx("Date")}</TableHead><TableHead>{tx("Type")}</TableHead><TableHead>{tx("Reason")}</TableHead>
              <TableHead>{tx("Status")}</TableHead><TableHead className="p2p-right">{tx("Credit")}</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>{notes.map(n => (
              <TableRow key={n.id}>
                <TableCell>{n.supplierCreditNo}<div className="p2p-muted">{n.internalNo}</div></TableCell>
                <TableCell>{date(n.creditDate)}</TableCell>
                <TableCell>{tx(n.category === "PriceAdjustment" ? "Price adjustment" : "Other credit")}</TableCell>
                <TableCell>{n.reason}{n.reversalReason && <div className="p2p-muted">{n.reversalReason}</div>}</TableCell>
                <TableCell><StatusChip status={statusTone(n.status)} /></TableCell>
                <TableCell className="p2p-right">{money(n.creditAmount, n.currencyCode)}</TableCell>
                <TableCell className="p2p-right">
                  {n.canDecide && <>
                    <Button size="sm" disabled={busy} onClick={() => setPending({ kind: "credit-approve", note: n })}>{tx("Approve")}</Button>{" "}
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setPending({ kind: "credit-reject", note: n })}>{tx("Reject")}</Button>
                  </>}
                  {canApprove && n.status === "Approved" && <Button size="sm" variant="outline" disabled={busy} onClick={() => setPending({ kind: "credit-reverse", note: n })}>{tx("Reverse")}</Button>}
                </TableCell>
              </TableRow>))}
            </TableBody>
          </Table>
        )}
        {canManage && invoice.status === "Approved" && <div className="prq-actions">
          <Button variant="outline" disabled={busy} onClick={() => { setCredit({ supplierCreditNo: "", creditDate: todayIso(), category: "PriceAdjustment", netAmount: "", taxAmount: "0", withholdingAmount: "0" }); setPending({ kind: "credit-new" }); }}>
            {tx("Record credit note")}</Button>
        </div>}
      </CardContent>
    </Card>}

    <ActionDialog open={pending?.kind === "approve"} title={tx("Approve payment")} busy={busy} confirmText={tx("Approve payment")}
      message={pending?.kind === "approve" ? `${money(pending.payment.amount, invoice.currencyCode)} · ${date(pending.payment.paidOn)} · ${pending.payment.reference ?? ""}. ${tx("It is posted to the ledger on the payment date.")}` : undefined}
      onConfirm={() => pending?.kind === "approve" && void act(() => payablesApi.approvePayment(companyId, invoice.id, pending.payment.id, { version: invoice.version }), "Unable to approve the payment.")}
      onClose={() => setPending(null)} />
    <ActionDialog open={pending?.kind === "reject"} title={tx("Reject payment")} busy={busy} confirmText={tx("Reject")} danger commentLabel={tx("Reason")} commentRequired
      onConfirm={(reason) => pending?.kind === "reject" && void act(() => payablesApi.rejectPayment(companyId, invoice.id, pending.payment.id, { version: invoice.version, reason }), "Unable to reject the payment.")}
      onClose={() => setPending(null)} />
    <ActionDialog open={pending?.kind === "reverse"} title={tx("Reverse payment")} busy={busy} confirmText={tx("Reverse")} danger commentLabel={tx("Reason")} commentRequired
      message={tx("Use this for a returned transfer, a cancelled cheque or a payment recorded in error. The balance is reopened and the payment journal is reversed today.")}
      onConfirm={(reason) => pending?.kind === "reverse" && void act(() => payablesApi.reversePayment(companyId, invoice.id, pending.payment.id, { version: invoice.version, reason }), "Unable to reverse the payment.")}
      onClose={() => setPending(null)} />
    <ActionDialog open={pending?.kind === "credit-approve"} title={tx("Approve credit note")} busy={busy} confirmText={tx("Approve")}
      message={pending?.kind === "credit-approve" ? `${pending.note.supplierCreditNo}: ${money(pending.note.creditAmount, pending.note.currencyCode)} ${tx("off this invoice")}.` : undefined}
      onConfirm={() => pending?.kind === "credit-approve" && void act(() => payablesApi.approveCreditNote(companyId, pending.note.id, { version: pending.note.version }), "Unable to approve the credit note.")}
      onClose={() => setPending(null)} />
    <ActionDialog open={pending?.kind === "credit-reject"} title={tx("Reject credit note")} busy={busy} confirmText={tx("Reject")} danger commentLabel={tx("Reason")} commentRequired
      onConfirm={(reason) => pending?.kind === "credit-reject" && void act(() => payablesApi.rejectCreditNote(companyId, pending.note.id, { version: pending.note.version, reason }), "Unable to reject the credit note.")}
      onClose={() => setPending(null)} />
    <ActionDialog open={pending?.kind === "credit-reverse"} title={tx("Reverse credit note")} busy={busy} confirmText={tx("Reverse")} danger commentLabel={tx("Reason")} commentRequired
      onConfirm={(reason) => pending?.kind === "credit-reverse" && void act(() => payablesApi.reverseCreditNote(companyId, pending.note.id, { version: pending.note.version, reason }), "Unable to reverse the credit note.")}
      onClose={() => setPending(null)} />
    <ActionDialog open={pending?.kind === "credit-new"} title={tx("Record supplier credit note")} busy={busy} confirmText={tx("Submit for approval")} commentLabel={tx("Reason")} commentRequired
      confirmDisabled={!credit.supplierCreditNo.trim() || !(Number(credit.netAmount) > 0)}
      onConfirm={(reason) => void act(() => payablesApi.prepareCreditNote(companyId, {
        invoiceId: invoice.id, supplierCreditNo: credit.supplierCreditNo.trim(), creditDate: credit.creditDate, category: credit.category,
        netAmount: Number(credit.netAmount), taxAmount: Number(credit.taxAmount) || 0, withholdingAmount: Number(credit.withholdingAmount) || 0, reason
      }), "Unable to record the credit note.")}
      onClose={() => setPending(null)}>
      <FormField label={tx("Supplier credit note number")} required value={credit.supplierCreditNo} onChange={e => setCredit(c => ({ ...c, supplierCreditNo: e.target.value }))} />
      <FormField label={tx("Credit note date")} type="date" required value={credit.creditDate} onChange={e => setCredit(c => ({ ...c, creditDate: e.target.value }))} />
      <LabeledSelect label={tx("Type")} value={credit.category} onChange={e => setCredit(c => ({ ...c, category: e.target.value }))}>
        <option value="PriceAdjustment">{tx("Price adjustment (purchase price variance)")}</option>
        <option value="Other">{tx("Other credit (non-stock purchases)")}</option>
      </LabeledSelect>
      <FormField label={`${tx("Net amount")} (${invoice.currencyCode})`} type="number" min={0} step="0.01" required value={credit.netAmount} onChange={e => setCredit(c => ({ ...c, netAmount: e.target.value }))} />
      <FormField label={tx("VAT")} type="number" min={0} step="0.01" value={credit.taxAmount} onChange={e => setCredit(c => ({ ...c, taxAmount: e.target.value }))} />
      <FormField label={tx("Withholding")} type="number" min={0} step="0.01" value={credit.withholdingAmount} onChange={e => setCredit(c => ({ ...c, withholdingAmount: e.target.value }))} />
    </ActionDialog>
    <ActionDialog open={pending?.kind === "advance-apply"} title={tx("Apply supplier advance")} busy={busy} confirmText={tx("Apply")}
      confirmDisabled={!advance || !(Number(apply.amount) > 0) || Number(apply.amount) > Math.min(advance.unapplied, invoice.availableToPay)}
      message={tx("No cash moves: the advance already paid is set against this invoice.")}
      onConfirm={() => advance && void act(() => payablesApi.applyAdvance(companyId, advance.id, { invoiceId: invoice.id, invoiceVersion: invoice.version, amount: Number(apply.amount) }), "Unable to apply the advance.")}
      onClose={() => setPending(null)}>
      <LabeledSelect label={tx("Advance")} value={apply.advanceId} onChange={e => setApply(a => ({ ...a, advanceId: e.target.value }))}>
        {advances.map(a => <option key={a.id} value={a.id}>{a.advanceNo} · {date(a.paidOn)} · {money(a.unapplied, a.currencyCode)} {tx("left")}</option>)}
      </LabeledSelect>
      <FormField label={`${tx("Amount")} (${invoice.currencyCode})`} type="number" min={0} step="0.01" required value={apply.amount} onChange={e => setApply(a => ({ ...a, amount: e.target.value }))} />
    </ActionDialog>
  </>;
}
