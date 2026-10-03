import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ConfirmModal from "../../../components/ConfirmModal";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { StateMessage } from "../../../components/ui/Feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { purchaseReturnsApi, type PurchaseReturn } from "../api/purchasingApi";
import ReturnOutcomePanel from "../components/ReturnOutcomePanel";
import { DetailItem, Metric, StatusChip, apiError, date, dateTime, money, qty, useCompanyId } from "../components/p2pShared";

export default function PurchaseReturnDetailPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canAct = useHasPermission("purchasing.receiveinspect");
  const [row, setRow] = useState<PurchaseReturn | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"post" | "cancel" | null>(null);

  async function load() {
    if (!companyId || !id) return;
    try {
      setRow(await purchaseReturnsApi.get(companyId, id));
    } catch (e) {
      setError(apiError(e, "Unable to load purchase return."));
    }
  }

  useEffect(() => {
    void load();
  }, [companyId, id]);

  async function act() {
    if (!row || !confirm) return;
    setBusy(true);
    setError(null);
    try {
      setRow(confirm === "post"
        ? await purchaseReturnsApi.post(companyId, row.id, row.version)
        : await purchaseReturnsApi.cancel(companyId, row.id, row.version));
    } catch (e) {
      setError(apiError(e, confirm === "post" ? "Unable to post purchase return." : "Unable to cancel purchase return."));
      await load();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  if (!row) return <main className="p2p-page">{error ? <StateMessage tone="error">{tx(error)}</StateMessage> : <StateMessage tone="loading">{tx("Loading purchase return...")}</StateMessage>}</main>;

  return (
    <main className="p2p-page">
      <PageHeader
        title={row.returnNo}
        subtitle={`${row.supplierName ?? ""} · ${row.locationName ?? ""}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(`/companies/${companyId}/procurement/purchase-returns`)}>{tx("Back")}</Button>
            {canAct && row.status === "Draft" && <Button disabled={busy} onClick={() => setConfirm("post")}>{tx("Post return")}</Button>}
            {canAct && row.status === "Draft" && <Button variant="destructive" disabled={busy} onClick={() => setConfirm("cancel")}>{tx("Cancel return")}</Button>}
          </>
        }
      />
      {error && <StateMessage tone="error">{tx(error)}</StateMessage>}

      <section className="p2p-metrics">
        <Metric label={tx("Status")} value={<StatusChip status={row.status} />} />
        <Metric label={tx("Value")} value={money(row.totalAmount)} />
        <Metric label={tx("Return date")} value={date(row.returnDate)} />
        <Metric label={tx("Posted")} value={dateTime(row.postedAtUtc)} />
      </section>

      <ReturnOutcomePanel companyId={companyId} id={row.id} status={row.status} onChanged={()=>void load()}/>
      <Card>
        <CardContent className="p2p-details p2p-mt">
          <DetailItem label={tx("Goods receipt")}><Link className="p2p-strong-link" to={`/companies/${companyId}/grns/${row.grnId}`}>{row.grnNo ?? row.grnId}</Link></DetailItem>
          <DetailItem label={tx("Purchase order")}>
            {row.purchaseOrderId ? <Link className="p2p-strong-link" to={`/companies/${companyId}/procurement/purchase-orders/${row.purchaseOrderId}`}>{row.poNo}</Link> : "-"}
          </DetailItem>
          <DetailItem label={tx("Reason")}>{tx(row.reason)}</DetailItem>
          <DetailItem label={tx("Warehouse")}>{row.locationName ?? "-"}</DetailItem>
          {row.notes && <DetailItem label={tx("Notes")} wide>{row.notes}</DetailItem>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{tx("Lines")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{tx("Item")}</TableHead>
                <TableHead>{tx("UOM")}</TableHead>
                <TableHead className="p2p-right">{tx("Qty")}</TableHead>
                <TableHead className="p2p-right">{tx("Unit cost")}</TableHead>
                <TableHead className="p2p-right">{tx("Total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {row.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.lineNo}</TableCell>
                  <TableCell>{l.itemName ?? l.itemId}{l.notes && <div className="p2p-muted">{l.notes}</div>}</TableCell>
                  <TableCell>{l.uomName ?? "-"}</TableCell>
                  <TableCell className="p2p-right">{qty(l.quantity)}</TableCell>
                  <TableCell className="p2p-right">{money(l.unitCost)}</TableCell>
                  <TableCell className="p2p-right">{money(l.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!confirm}
        title={confirm === "post" ? tx("Post purchase return") : tx("Cancel purchase return")}
        message={confirm === "post"
          ? tx("Stock leaves the warehouse at receipt cost and the purchase order received quantity is reduced. This cannot be undone.")
          : tx("The draft return will be cancelled.")}
        confirmText={confirm === "post" ? tx("Post return") : tx("Cancel return")}
        cancelText={tx("Back")}
        danger={confirm === "cancel"}
        busy={busy}
        onConfirm={() => void act()}
        onClose={() => setConfirm(null)}
      />
    </main>
  );
}
