import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { FormField } from "../../../components/ui/FormField";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { supplierInvoicesApi, type SupplierInvoice } from "../api/purchasingApi";
import InvoiceEvidencePanel from "../components/InvoiceEvidencePanel";
import {
  ActionDialog,
  BackButton,
  DetailItem,
  ManageCard,
  LabeledSelect,
  Metric,
  StatusChip,
  apiError,
  date,
  dateTime,
  money,
  qty,
  todayIso,
  useCompanyId,
} from "../components/p2pShared";

type Dialog = "approve" | "override" | "cancel" | "payment" | null;
const PAYMENT_METHODS = ["BankTransfer", "Cheque", "Cash", "MobileMoney", "Other"];

export default function SupplierInvoiceDetailPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
    const canCreate = useHasPermission("purchasing.create");
  const canPayables = useHasPermission("finance.payables.manage");
  const canApprove = useHasPermission("purchasing.approve");
  const canFinance = useHasPermission("purchasing.financeapprove");
  const [inv, setInv] = useState<SupplierInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [payment, setPayment] = useState({ amount: "", paidOn: todayIso(), method: "BankTransfer", reference: "" });

  async function load() {
    if (!companyId || !id) return;
    setLoading(true);
    try {
      setInv(await supplierInvoicesApi.get(companyId, id));
      setError(null);
    } catch (e) {
      setError(apiError(e, "Unable to load supplier invoice."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [companyId, id]);

  async function run(action: (current: SupplierInvoice) => Promise<SupplierInvoice>, fallback: string) {
    if (!inv) return;
    setBusy(true);
    setError(null);
    try {
      setInv(await action(inv));
      setDialog(null);
    } catch (e) {
      setError(apiError(e, fallback));
      setDialog(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading && !inv) return <main className="p2p-page"><StateMessage tone="loading">{tx("Loading supplier invoice...")}</StateMessage></main>;
  if (!inv) return <main className="p2p-page"><StateMessage tone="error">{tx(error ?? "Supplier invoice not found.")}</StateMessage></main>;

  const canRecord = canCreate || canPayables;
  const open = inv.status === "Draft" || inv.status === "Matched" || inv.status === "OnHold";
  const showMatch = canRecord && open;
  const showApprove = canApprove && inv.status === "Matched";
  const showOverride = canApprove && canFinance && inv.status === "OnHold";
  const showCancel = (open && canRecord) || (inv.status === "Approved" && canFinance && inv.paidAmount === 0 && inv.creditedAmount === 0);
  const showPayment = canPayables && inv.status === "Approved" && inv.outstandingAmount > 0;
  const poLink = inv.purchaseOrderId ? `/companies/${companyId}/procurement/purchase-orders/${inv.purchaseOrderId}` : null;

  return (
    <main className="p2p-page">
      <PageHeader
        title={`${inv.internalNo} · ${inv.supplierInvoiceNo}`}
        subtitle={inv.supplierName ?? undefined}
        actions={
          <>
            <BackButton to={`/companies/${companyId}/procurement/supplier-invoices`} label={tx("Supplier Invoices")} />
            {showMatch && <Button variant="outline" onClick={() => navigate(`/companies/${companyId}/procurement/supplier-invoices/${inv.id}/edit`)}>{tx("Edit")}</Button>}
            {showMatch && <Button variant="outline" disabled={busy} onClick={() => void run((c) => supplierInvoicesApi.match(companyId, c.id, c.version), "Unable to run the three-way match.")}>{tx("Run match")}</Button>}
            {showApprove && <Button disabled={busy} onClick={() => setDialog("approve")}>{tx("Approve")}</Button>}
            {showOverride && <Button disabled={busy} onClick={() => setDialog("override")}>{tx("Approve with override")}</Button>}
            {showPayment && <Button disabled={busy} onClick={() => { setPayment({ amount: String(inv.outstandingAmount), paidOn: todayIso(), method: "BankTransfer", reference: "" }); setDialog("payment"); }}>{tx("Record payment")}</Button>}
          </>
        }
      />

      {error && <StateMessage tone="error">{tx(error)}</StateMessage>}
      {inv.status === "OnHold" && (
        <StateMessage tone="warning">
          {tx("On hold")}: {inv.holdReason ?? tx("The invoice does not match the purchase order or goods received.")}
          {!canFinance && <> {tx("A finance approver can approve it with an override.")}</>}
        </StateMessage>
      )}
      {!inv.supplierTaxId && inv.status !== "Cancelled" && <StateMessage tone="warning">{tx("The supplier has no TIN. Invoices cannot be approved until it is recorded on the supplier.")}</StateMessage>}
      {inv.varianceOverridden && <StateMessage tone="info">{tx("Approved with a variance override")}: {inv.approvalComment}</StateMessage>}
      {inv.cancelReason && <StateMessage tone="warning">{tx("Cancelled")}: {inv.cancelReason}</StateMessage>}

      <section className="p2p-metrics">
        <Metric label={tx("Status")} value={<StatusChip status={inv.status} />} />
        <Metric label={tx("Invoice total")} value={money(inv.grandTotal, inv.currencyCode)} />
        <Metric label={tx("Payable")} value={money(inv.payableAmount, inv.currencyCode)} />
        <Metric label={tx("Supplier credits")} value={money(inv.creditedAmount,inv.currencyCode)} />
        <Metric label={tx("Refunds received")} value={money(inv.refundedAmount,inv.currencyCode)} />
        <Metric label={tx("Unapplied supplier credit")} value={money(inv.supplierCreditBalance,inv.currencyCode)} />
        <Metric label={tx("Outstanding")} value={money(inv.outstandingAmount, inv.currencyCode)} tone={inv.isOverdue ? "danger" : undefined} />
      </section>

      <InvoiceEvidencePanel companyId={companyId} id={inv.id} version={inv.version}/>
      <Card>
        <CardContent className="p2p-details p2p-mt">
          <DetailItem label={tx("Supplier")}>{inv.supplierName}{inv.supplierTaxId ? ` · ${tx("TIN")} ${inv.supplierTaxId}` : ""}</DetailItem>
          <DetailItem label={tx("Purchase order")}>{poLink ? <Link className="p2p-strong-link" to={poLink}>{inv.poNo}</Link> : tx("None")}</DetailItem>
          <DetailItem label={tx("Invoice date")}>{date(inv.invoiceDate)}</DetailItem>
          <DetailItem label={tx("Due date")}>{date(inv.dueDate)}{inv.isOverdue ? ` · ${tx("Overdue")}` : ""}</DetailItem>
          <DetailItem label={tx("Fiscal reference")}>{inv.fiscalReference || "-"}</DetailItem>
          <DetailItem label={tx("Payment")}><StatusChip status={inv.paymentStatus} /></DetailItem>
          <DetailItem label={tx("Matched at")}>{dateTime(inv.matchedAtUtc)}</DetailItem>
          <DetailItem label={tx("Approved at")}>{dateTime(inv.approvedAtUtc)}</DetailItem>
          {inv.notes && <DetailItem label={tx("Notes")} wide>{inv.notes}</DetailItem>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{tx("Three-way match")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{tx("Description")}</TableHead>
                <TableHead className="p2p-right">{tx("Invoiced qty")}</TableHead>
                <TableHead className="p2p-right">{tx("PO ordered")}</TableHead>
                <TableHead className="p2p-right">{tx("Received")}</TableHead>
                <TableHead className="p2p-right">{tx("Invoice price")}</TableHead>
                <TableHead className="p2p-right">{tx("PO price")}</TableHead>
                <TableHead className="p2p-right">{tx("Total")}</TableHead>
                <TableHead>{tx("Match")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inv.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.lineNo}</TableCell>
                  <TableCell>{l.description}{l.matchNote && <div className="p2p-muted">{l.matchNote}</div>}</TableCell>
                  <TableCell className={`p2p-right${l.matchStatus.includes("Quantity") ? " p2p-variance" : ""}`}>{qty(l.quantity)}</TableCell>
                  <TableCell className="p2p-right">{l.poOrderedQty == null ? "-" : qty(l.poOrderedQty)}</TableCell>
                  <TableCell className="p2p-right">{l.poReceivedQty == null ? "-" : qty(l.poReceivedQty)}</TableCell>
                  <TableCell className={`p2p-right p2p-nowrap${l.matchStatus.includes("Price") ? " p2p-variance" : ""}`}>{money(l.unitPrice, inv.currencyCode)}</TableCell>
                  <TableCell className="p2p-right">{l.poNetUnitPrice == null ? "-" : money(l.poNetUnitPrice, inv.currencyCode)}</TableCell>
                  <TableCell className="p2p-right">{money(l.lineTotal, inv.currencyCode)}</TableCell>
                  <TableCell>{l.matchStatus ? <StatusChip status={l.matchStatus} /> : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p2p-totals">
            <span>{tx("Subtotal")}: {money(inv.subtotal, inv.currencyCode)}</span>
            <span>{tx("Tax")}: {money(inv.taxTotal, inv.currencyCode)}</span>
            <span>{tx("Invoice total")}: {money(inv.grandTotal, inv.currencyCode)}</span>
            {inv.withholdingAmount > 0 && <span>{tx("Withholding")}: -{money(inv.withholdingAmount, inv.currencyCode)}</span>}
            <strong>{tx("Payable")}: {money(inv.payableAmount, inv.currencyCode)}</strong>
          </div>
        </CardContent>
      </Card>

      {(inv.status === "Approved" || inv.payments.length > 0) && <Card>
        <CardHeader><CardTitle>{tx("Payments")}</CardTitle></CardHeader>
        <CardContent>
          {inv.payments.length === 0 ? (
            <EmptyState title={tx("No payments recorded")} detail={tx("Payments can be recorded once the invoice is approved.")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Paid on")}</TableHead>
                  <TableHead>{tx("Method")}</TableHead>
                  <TableHead>{tx("Reference")}</TableHead>
                  <TableHead>{tx("Recorded")}</TableHead>
                  <TableHead className="p2p-right">{tx("Amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inv.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{date(p.paidOn)}</TableCell>
                    <TableCell>{p.method ? tx(p.method) : "-"}</TableCell>
                    <TableCell>{p.reference || "-"}</TableCell>
                    <TableCell>{dateTime(p.recordedAtUtc)}</TableCell>
                    <TableCell className="p2p-right">{money(p.amount, inv.currencyCode)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>}

      {showCancel && (
        <ManageCard
          title={tx(inv.status === "Approved" ? "Void invoice" : "Cancel invoice")}
          detail={tx(inv.status === "Approved"
            ? "Voiding an approved invoice removes it from payables and releases the invoiced quantities on the purchase order."
            : "Cancelling releases the supplier invoice number so it can be recorded again.")}
        >
          <Button variant="destructive" disabled={busy} onClick={() => setDialog("cancel")}>{tx(inv.status === "Approved" ? "Void" : "Cancel invoice")}</Button>
        </ManageCard>
      )}

      <ActionDialog
        open={dialog === "approve"}
        title={tx("Approve supplier invoice")}
        message={tx("The invoice matched the purchase order and goods received. Approval makes it payable.")}
        confirmText={tx("Approve")}
        commentLabel={tx("Comment")}
        busy={busy}
        onConfirm={(c) => void run((cur) => supplierInvoicesApi.approve(companyId, cur.id, cur.version, false, c || undefined), "Unable to approve invoice.")}
        onClose={() => setDialog(null)}
      />
      <ActionDialog
        open={dialog === "override"}
        title={tx("Approve with variance override")}
        message={tx("The invoice is on hold because of a quantity or price variance. Approving it records your override and reason in the audit trail.")}
        confirmText={tx("Approve with override")}
        commentLabel={tx("Override reason")}
        commentRequired
        busy={busy}
        onConfirm={(c) => void run((cur) => supplierInvoicesApi.approve(companyId, cur.id, cur.version, true, c), "Unable to approve invoice.")}
        onClose={() => setDialog(null)}
      />
      <ActionDialog
        open={dialog === "cancel"}
        title={tx(inv.status === "Approved" ? "Void approved invoice" : "Cancel supplier invoice")}
        confirmText={tx(inv.status === "Approved" ? "Void" : "Cancel invoice")}
        danger
        commentLabel={tx("Reason")}
        commentRequired
        busy={busy}
        onConfirm={(c) => void run((cur) => supplierInvoicesApi.cancel(companyId, cur.id, cur.version, c), "Unable to cancel invoice.")}
        onClose={() => setDialog(null)}
      />
      <ActionDialog
        open={dialog === "payment"}
        title={tx("Record payment")}
        message={`${tx("Outstanding")}: ${money(inv.outstandingAmount, inv.currencyCode)}`}
        confirmText={tx("Record payment")}
        busy={busy}
        onConfirm={() => {
          const amount = Number(payment.amount);
          if (!(amount > 0)) return setError(tx("Payment amount must be greater than zero."));
          void run((cur) => supplierInvoicesApi.recordPayment(companyId, cur.id, {
            version: cur.version,
            amount,
            paidOn: payment.paidOn,
            method: payment.method,
            reference: payment.reference.trim() || null,
          }), "Unable to record payment.");
        }}
        onClose={() => setDialog(null)}
      >
        <FormField label={tx("Amount")} type="number" min={0} step="0.01" required value={payment.amount} onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))} />
        <FormField label={tx("Paid on")} type="date" required value={payment.paidOn} onChange={(e) => setPayment((p) => ({ ...p, paidOn: e.target.value }))} />
        <LabeledSelect label={tx("Method")} value={payment.method} onChange={(e) => setPayment((p) => ({ ...p, method: e.target.value }))}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{tx(m)}</option>)}
        </LabeledSelect>
        <FormField label={tx("Reference")} value={payment.reference} placeholder={tx("Bank reference or cheque number")} onChange={(e) => setPayment((p) => ({ ...p, reference: e.target.value }))} />
      </ActionDialog>
    </main>
  );
}
