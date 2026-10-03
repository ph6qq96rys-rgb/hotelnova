import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { FormField } from "../../../components/ui/FormField";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useI18n } from "../../../i18n";
import { purchasingSetupApi, type OutstandingDelivery, type PurchasingDashboard, type SupplierSpend } from "../api/purchasingApi";
import { Metric, apiError, date, money, qty, todayIso, useCompanyId } from "../components/p2pShared";

export default function PurchasingDashboardPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const [dashboard, setDashboard] = useState<PurchasingDashboard | null>(null);
  const [deliveries, setDeliveries] = useState<OutstandingDelivery[]>([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [range, setRange] = useState({ from: todayIso(-90), to: todayIso() });
  const [spend, setSpend] = useState<SupplierSpend[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    purchasingSetupApi.dashboard(companyId).then(setDashboard).catch((e) => setError(apiError(e, "Unable to load purchasing dashboard.")));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    purchasingSetupApi.outstandingDeliveries(companyId, { overdueOnly }).then(setDeliveries).catch(() => setDeliveries([]));
  }, [companyId, overdueOnly]);

  async function loadSpend() {
    try {
      setSpend(await purchasingSetupApi.supplierSpend(companyId, range.from, range.to));
    } catch (e) {
      setError(apiError(e, "Unable to load supplier spend."));
    }
  }

  useEffect(() => {
    if (companyId) void loadSpend();
  }, [companyId]);

  const base = `/companies/${companyId}/procurement`;

  return (
    <main className="p2p-page">
      <PageHeader title={tx("Purchasing Overview")} subtitle={tx("What needs attention across requisitions, orders, deliveries and payables.")} />
      {error && <StateMessage tone="error">{tx(error)}</StateMessage>}

      {dashboard && (
        <section className="p2p-metrics">
          <Metric label={tx("Requisitions awaiting approval")} value={<Link className="p2p-strong-link" to={`${base}/requisitions`}>{dashboard.requisitionsPendingApproval}</Link>} tone={dashboard.requisitionsPendingApproval ? "warning" : undefined} />
          <Metric label={tx("Requisitions ready to order")} value={<Link className="p2p-strong-link" to={`${base}/requisitions`}>{dashboard.requisitionsReadyToOrder}</Link>} />
          <Metric label={tx("Orders awaiting approval")} value={<Link className="p2p-strong-link" to={`${base}/purchase-orders`}>{dashboard.ordersPendingApproval}</Link>} tone={dashboard.ordersPendingApproval ? "warning" : undefined} />
          <Metric label={tx("Orders awaiting delivery")} value={dashboard.ordersAwaitingDelivery} />
          <Metric label={tx("Overdue deliveries")} value={dashboard.ordersOverdue} tone={dashboard.ordersOverdue ? "danger" : undefined} />
          <Metric label={tx("Invoices on hold")} value={<Link className="p2p-strong-link" to={`${base}/supplier-invoices`}>{dashboard.invoicesOnHold}</Link>} tone={dashboard.invoicesOnHold ? "danger" : undefined} />
          <Metric label={tx("Invoices awaiting approval")} value={dashboard.invoicesAwaitingApproval} />
          <Metric label={tx("Payables due in 7 days")} value={money(dashboard.payablesDue7Days)} />
          <Metric label={tx("Overdue payables")} value={money(dashboard.payablesOverdue)} tone={dashboard.payablesOverdue ? "danger" : undefined} />
          <Metric label={tx("Open commitments")} value={money(dashboard.openCommitmentValue)} />
        </section>
      )}

      <Card>
        <CardHeader>
          <div className="p2p-section-head">
            <CardTitle>{tx("Outstanding deliveries")}</CardTitle>
            <label className="p2p-check"><Checkbox checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />{tx("Overdue only")}</label>
          </div>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <EmptyState title={tx("Nothing outstanding")} detail={tx("All approved orders have been received.")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("PO No.")}</TableHead>
                  <TableHead>{tx("Supplier")}</TableHead>
                  <TableHead>{tx("Item")}</TableHead>
                  <TableHead>{tx("Expected")}</TableHead>
                  <TableHead className="p2p-right">{tx("Outstanding")}</TableHead>
                  <TableHead className="p2p-right">{tx("Value")}</TableHead>
                  <TableHead className="p2p-right">{tx("Days overdue")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.lineId}>
                    <TableCell><Link className="p2p-strong-link" to={`${base}/purchase-orders/${d.purchaseOrderId}`}>{d.poNo}</Link></TableCell>
                    <TableCell>{d.supplierName}</TableCell>
                    <TableCell>{d.itemName}</TableCell>
                    <TableCell>{date(d.expectedDeliveryDate)}</TableCell>
                    <TableCell className="p2p-right">{qty(d.outstandingQty)} {d.uomName}</TableCell>
                    <TableCell className="p2p-right">{money(d.outstandingValue)}</TableCell>
                    <TableCell className={d.daysOverdue > 0 ? "p2p-right p2p-danger-text" : "p2p-right"}>{d.daysOverdue > 0 ? d.daysOverdue : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{tx("Supplier performance and spend")}</CardTitle></CardHeader>
        <CardContent>
          <div className="p2p-toolbar">
            <FormField label={tx("From")} type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            <FormField label={tx("To")} type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            <div className="p2p-toolbar-actions"><Button variant="outline" onClick={() => void loadSpend()}>{tx("Refresh")}</Button></div>
          </div>
          {spend.length === 0 ? (
            <EmptyState title={tx("No purchases in this period")} detail={tx("Choose a different date range (up to one year).")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Supplier")}</TableHead>
                  <TableHead className="p2p-right">{tx("Orders")}</TableHead>
                  <TableHead className="p2p-right">{tx("Ordered")}</TableHead>
                  <TableHead className="p2p-right">{tx("Received")}</TableHead>
                  <TableHead className="p2p-right">{tx("Invoiced")}</TableHead>
                  <TableHead className="p2p-right">{tx("Paid")}</TableHead>
                  <TableHead className="p2p-right">{tx("Outstanding")}</TableHead>
                  <TableHead className="p2p-right">{tx("On time %")}</TableHead>
                  <TableHead className="p2p-right">{tx("Fill rate %")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spend.map((s) => (
                  <TableRow key={s.supplierId}>
                    <TableCell><Link className="p2p-strong-link" to={`${base}/suppliers/${s.supplierId}`}>{s.supplierCode}</Link> {s.supplierName}</TableCell>
                    <TableCell className="p2p-right">{s.orderCount}</TableCell>
                    <TableCell className="p2p-right">{money(s.orderedValue)}</TableCell>
                    <TableCell className="p2p-right">{money(s.receivedValue)}</TableCell>
                    <TableCell className="p2p-right">{money(s.invoicedValue)}</TableCell>
                    <TableCell className="p2p-right">{money(s.paidValue)}</TableCell>
                    <TableCell className="p2p-right">{money(s.outstandingPayable)}</TableCell>
                    <TableCell className="p2p-right">{Math.round(s.onTimeDeliveryPercent)}</TableCell>
                    <TableCell className="p2p-right">{Math.round(s.fillRatePercent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
