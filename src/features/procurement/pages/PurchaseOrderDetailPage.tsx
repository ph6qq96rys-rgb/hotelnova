import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import PurchaseOrderRevisions from "../components/PurchaseOrderRevisions";
import ReceivingInspectionPanel from "../components/ReceivingInspectionPanel";
import ServiceAcceptancePanel from "../components/ServiceAcceptancePanel";
import PurchasePricePanel from "../components/PurchasePricePanel";
import PurchaseBudgetPanel from "../components/PurchaseBudgetPanel";
import SupplierControlsPanel from "../components/SupplierControlsPanel";
import PurchaseAgreementPanel from "../components/PurchaseAgreementPanel";
import LandedCostsPanel from "../components/LandedCostsPanel";
import BranchDeliveriesPanel from "../components/BranchDeliveriesPanel";
import EmergencyPurchasePanel from "../components/EmergencyPurchasePanel";
import { purchaseOrdersApi, type PurchaseOrder, type PurchaseOrderActionName } from "../api/purchasingApi";
import {
  ActionDialog,
  BackButton,
  ManageCard,
  DetailItem,
  Metric,
  StatusChip,
  apiError,
  date,
  dateTime,
  money,
  qty,
  splitWords,
  useCompanyId,
} from "../components/p2pShared";

type ActionDef = {
  api: PurchaseOrderActionName;
  label: string;
  title: string;
  message: string;
  commentLabel: string;
  commentRequired?: boolean;
  danger?: boolean;
  primary?: boolean;
};

const ACTIONS: Record<string, ActionDef> = {
  Submit: { api: "submit", label: "Submit", title: "Submit for approval", message: "The order is locked for editing while it is reviewed.", commentLabel: "Comment", primary: true },
  Approve: { api: "approve", label: "Approve", title: "Approve purchase order", message: "You cannot approve an order you prepared or submitted.", commentLabel: "Comment", primary: true },
  FinanceApprove: { api: "finance-approve", label: "Finance approve", title: "Finance approval", message: "Required because the order total is above the finance threshold.", commentLabel: "Comment", primary: true },
  Return: { api: "return", label: "Return", title: "Return to preparer", message: "The order goes back to draft for correction.", commentLabel: "Reason", commentRequired: true },
  Send: { api: "send", label: "Mark as sent", title: "Mark as sent to supplier", message: "Record that the approved order was sent to the supplier.", commentLabel: "Comment", primary: true },
  Amend: { api: "amend", label: "Amend", title: "Amend purchase order", message: "Creates a new revision in draft. It must be approved again before receiving.", commentLabel: "Reason", commentRequired: true },
  Cancel: { api: "cancel", label: "Cancel remaining quantities", title: "Cancel remaining quantities", message: "Cancels the unreceived balance and preserves received quantities and invoice references.", commentLabel: "Reason", commentRequired: true, danger: true },
  Close: { api: "close", label: "Close order", title: "Close purchase order", message: "Stops further receiving. A reason is required when quantities are still outstanding; received obligations remain available for invoicing.", commentLabel: "Reason" },
  Acknowledge:{api:"acknowledge",label:"Supplier acknowledgement",title:"Record supplier acknowledgement",message:"Record the supplier’s confirmation of this issued revision.",commentLabel:"Supplier confirmation reference",commentRequired:true},
};

/** Workflow steps shown in the header; the first allowed approval/submit step is the primary action. */
const HEADER_ACTIONS = ["FinanceApprove", "Approve", "Submit", "Send", "Acknowledge", "Return"];
/** Lifecycle-ending actions, kept in the "Manage order" card. */
const MANAGE_ACTIONS = ["Amend", "Close", "Cancel"];

const LINKED_ROUTES: Record<string, (companyId: string, id: string) => string> = {
  GRN: (c, id) => `/companies/${c}/grns/${id}`,
  Requisition: (c, id) => `/companies/${c}/procurement/requisitions/${id}`,
  SupplierInvoice: (c, id) => `/companies/${c}/procurement/supplier-invoices/${id}`,
  PurchaseReturn: (c, id) => `/companies/${c}/procurement/purchase-returns/${id}`,
};

export default function PurchaseOrderDetailPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canManage = useHasPermission("purchasing.manage");
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ActionDef | null>(null);

  const root = `/companies/${companyId}/procurement/purchase-orders`;

  async function load() {
    if (!companyId || !id) return;
    setLoading(true);
    try {
      setPo(await purchaseOrdersApi.get(companyId, id));
      setError(null);
    } catch (e) {
      setError(apiError(e, "Unable to load purchase order."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [companyId, id]);

  async function runAction(comment: string) {
    if (!po || !pending) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await purchaseOrdersApi.action(companyId, po.id, pending.api, po.version, comment || undefined);
      setPending(null);
      if (pending.api === "amend" && updated.id !== po.id) navigate(`${root}/${updated.id}`);
      else setPo(updated);
    } catch (e) {
      setError(apiError(e, "Unable to update purchase order."));
      setPending(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resync() {
    if (!po) return;
    setBusy(true);
    try {
      setPo(await purchaseOrdersApi.resync(companyId, po.id));
    } catch (e) {
      setError(apiError(e, "Unable to recalculate purchase order."));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !po) return <main className="p2p-page"><StateMessage tone="loading">{tx("Loading purchase order...")}</StateMessage></main>;
  if (!po) return <main className="p2p-page"><StateMessage tone="error">{tx(error ?? "Purchase order not found.")}</StateMessage></main>;

  const allowed = new Set(po.allowedActions);
  const headerActions = HEADER_ACTIONS.filter((a) => allowed.has(a));
  const primaryAction = headerActions.find((a) => a !== "Return" && a !== "Acknowledge");
  const manageActions = MANAGE_ACTIONS.filter((a) => allowed.has(a));

  return (
    <main className="p2p-page">
      <PageHeader
        title={`${po.poNo}${po.revision > 0 ? ` · ${tx("Rev.")} ${po.revision}` : ""}`}
        subtitle={`${po.supplierName ?? ""} → ${po.deliveryLocationName ?? ""}`}
        actions={
          <>
            <BackButton to={root} label={tx("Purchase Orders")} />
            {allowed.has("Edit") && <Button variant="outline" onClick={() => navigate(`${root}/${po.id}/edit`)}>{tx("Edit")}</Button>}
            {allowed.has("Invoice") && (
              <Button variant="outline" onClick={() => navigate(`/companies/${companyId}/procurement/supplier-invoices/new?purchaseOrderId=${po.id}`)}>{tx("Record invoice")}</Button>
            )}
            {headerActions.map((a) => (
              <Button key={a} variant={a === primaryAction ? "default" : "outline"} disabled={busy} onClick={() => setPending(ACTIONS[a])}>
                {tx(ACTIONS[a].label)}
              </Button>
            ))}
          </>
        }
      />

      {error && <StateMessage tone="error">{tx(error)}</StateMessage>}
      {po.status === "PendingFinanceApproval" && <StateMessage tone="warning">{tx("Waiting for finance approval because the total is above the finance threshold.")}</StateMessage>}
      {po.cancelReason && <StateMessage tone="warning">{tx("Cancelled")}: {po.cancelReason}</StateMessage>}
      <PurchaseOrderRevisions companyId={companyId} po={po}/>
      <PurchasePricePanel companyId={companyId} id={po.id} version={po.version}/>
      <PurchaseBudgetPanel companyId={companyId} id={po.id} version={po.version}/>
      <SupplierControlsPanel companyId={companyId} id={po.id} version={po.version}/>
      <PurchaseAgreementPanel companyId={companyId} id={po.id} version={po.version} status={po.status}/>
      <LandedCostsPanel companyId={companyId} id={po.id} version={po.version}/>
      <BranchDeliveriesPanel companyId={companyId} id={po.id} version={po.version}/>
      <EmergencyPurchasePanel companyId={companyId} id={po.id} version={po.version} status={po.status}/>
      <ReceivingInspectionPanel companyId={companyId} po={po}/>
      <ServiceAcceptancePanel companyId={companyId} po={po} onChanged={()=>void load()}/>
      {po.acknowledgedAtUtc&&<StateMessage tone="success">{tx("Supplier acknowledged")}: {dateTime(po.acknowledgedAtUtc)} · {po.acknowledgementReference}</StateMessage>}
      {po.closeReason && <StateMessage tone="info">{tx("Closed")}: {po.closeReason}</StateMessage>}

      <section className="p2p-metrics">
        <Metric label={tx("Status")} value={<StatusChip status={po.status} />} />
        <Metric label={tx("Grand total")} value={money(po.grandTotal, po.currencyCode)} />
        <Metric label={tx("Received")} value={`${Math.round(po.receivedPercent)}%`} />
        <Metric label={tx("Expected delivery")} value={date(po.expectedDeliveryDate)} />
      </section>

      <Card>
        <CardContent className="p2p-details p2p-mt">
          <DetailItem label={tx("Supplier")}>{po.supplierCode ? `${po.supplierCode} - ` : ""}{po.supplierName}</DetailItem>
          <DetailItem label={tx("Deliver to")}>{po.deliveryLocationName ?? "-"}</DetailItem>
          <DetailItem label={tx("Branch")}>{po.branchName ?? tx("Company scope")}</DetailItem>
          <DetailItem label={tx("Order date")}>{date(po.orderDate)}</DetailItem>
          <DetailItem label={tx("Payment terms (days)")}>{po.paymentTermDays}</DetailItem>
          <DetailItem label={tx("Currency")}>{po.currencyCode}{po.exchangeRate !== 1 ? ` @ ${po.exchangeRate}` : ""}</DetailItem>
          <DetailItem label={tx("Supplier reference")}>{po.supplierReference || "-"}</DetailItem>
          <DetailItem label={tx("Prepared by")}>{po.preparedByName ?? "-"}</DetailItem>
          {po.notes && <DetailItem label={tx("Notes")} wide>{po.notes}</DetailItem>}
          {po.terms && <DetailItem label={tx("Terms and conditions")} wide>{po.terms}</DetailItem>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{tx("Lines")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{tx("Item or Service")}</TableHead>
                <TableHead>{tx("UOM")}</TableHead>
                <TableHead className="p2p-right">{tx("Ordered")}</TableHead>
                <TableHead className="p2p-right">{tx("Received")}</TableHead>
                <TableHead className="p2p-right">{tx("Outstanding")}</TableHead>
                <TableHead className="p2p-right">{tx("Invoiced")}</TableHead>
                <TableHead className="p2p-right">{tx("Unit Price")}</TableHead>
                <TableHead className="p2p-right">{tx("Disc. %")}</TableHead>
                <TableHead className="p2p-right">{tx("Tax %")}</TableHead>
                <TableHead className="p2p-right">{tx("Total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.lineNo}</TableCell>
                  <TableCell>
                    <strong>{l.itemName}</strong>
                    <div className="p2p-muted">{tx(splitWords(l.lineType))}{l.notes ? ` · ${l.notes}` : ""}</div>
                  </TableCell>
                  <TableCell>{l.uomName || "-"}</TableCell>
                  <TableCell className="p2p-right">{qty(l.orderedQty)}{l.orderedBaseQty!=null&&<div className="p2p-muted">{qty(l.orderedBaseQty)} {tx("base units")}</div>}{(l.cancelledQty??0)>0&&<div className="p2p-muted">{tx("Cancelled")}: {qty(l.cancelledQty)}</div>}</TableCell>
                  <TableCell className="p2p-right">{qty(l.receivedQty)}</TableCell>
                  <TableCell className="p2p-right">{qty(l.outstandingQty)}</TableCell>
                  <TableCell className="p2p-right">{qty(l.invoicedQty)}</TableCell>
                  <TableCell className="p2p-right">{money(l.unitPrice, po.currencyCode)}</TableCell>
                  <TableCell className="p2p-right">{l.discountPercent}</TableCell>
                  <TableCell className="p2p-right">{l.taxRatePercent}</TableCell>
                  <TableCell className="p2p-right">{money(l.lineTotal, po.currencyCode)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p2p-totals">
            <span>{tx("Subtotal")}: {money(po.subtotal, po.currencyCode)}</span>
            {po.discountTotal > 0 && <span>{tx("Discount")}: -{money(po.discountTotal, po.currencyCode)}</span>}
            <span>{tx("Tax")}: {money(po.taxTotal, po.currencyCode)}</span>
            <strong>{tx("Grand total")}: {money(po.grandTotal, po.currencyCode)}</strong>
          </div>
        </CardContent>
      </Card>

      <div className="p2p-split">
        <Card>
          <CardHeader><CardTitle>{tx("Linked documents")}</CardTitle></CardHeader>
          <CardContent>
            {po.linkedDocuments.length === 0 ? (
              <EmptyState title={tx("No linked documents")} detail={tx("Requisitions, goods receipts, invoices and returns appear here.")} />
            ) : (
              <Table>
                <TableBody>
                  {po.linkedDocuments.map((d) => {
                    const to = LINKED_ROUTES[d.type]?.(companyId, d.id);
                    return (
                      <TableRow key={`${d.type}-${d.id}`}>
                        <TableCell>{tx(splitWords(d.type))}</TableCell>
                        <TableCell className="p2p-nowrap">{to ? <Link className="p2p-strong-link" to={to}>{d.number}</Link> : d.number}</TableCell>
                        <TableCell><StatusChip status={d.status} /></TableCell>
                        <TableCell className="p2p-nowrap">{date(d.date)}</TableCell>
                        <TableCell className="p2p-right">{money(d.amount, po.currencyCode)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="p2p-section-head">
              <CardTitle>{tx("History")}</CardTitle>
              {canManage && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void resync()}>{tx("Recalculate")}</Button>}
            </div>
          </CardHeader>
          <CardContent>
            <ol className="p2p-timeline">
              {[...po.history].reverse().map((h) => (
                <li key={h.id}>
                  <strong>{tx(splitWords(h.action))}</strong> · {tx(splitWords(h.toStatus))}
                  <div className="p2p-muted">{h.userName ?? "-"} · {dateTime(h.atUtc)}{h.revision > 0 ? ` · ${tx("Rev.")} ${h.revision}` : ""}</div>
                  {h.comment && <p>{h.comment}</p>}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      {manageActions.length > 0 && (
        <ManageCard
          title={tx("Manage order")}
          detail={tx("Amend creates a new revision that must be approved again. Close stops further receiving. Cancelling remaining quantities keeps what was already received and invoiced.")}
        >
          {manageActions.map((a) => (
            <Button key={a} variant={ACTIONS[a].danger ? "destructive" : "outline"} disabled={busy} onClick={() => setPending(ACTIONS[a])}>
              {tx(ACTIONS[a].label)}
            </Button>
          ))}
        </ManageCard>
      )}

      <ActionDialog
        open={!!pending}
        title={pending ? tx(pending.title) : ""}
        message={pending ? tx(pending.message) : undefined}
        confirmText={pending ? tx(pending.label) : ""}
        danger={pending?.danger}
        commentLabel={pending ? tx(pending.commentLabel) : undefined}
        commentRequired={pending?.commentRequired}
        busy={busy}
        onConfirm={(c) => void runAction(c)}
        onClose={() => setPending(null)}
      />


    </main>
  );
}
