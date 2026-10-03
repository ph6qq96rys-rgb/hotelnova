import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { FormField } from "../../../components/ui/FormField";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { PO_STATUSES, purchaseOrdersApi, suppliersApi, type PagedResult, type PurchaseOrder, type SupplierLookup } from "../api/purchasingApi";
import { LabeledSelect, Pager, Progress, StatusChip, apiError, date, money, splitWords, useCompanyId } from "../components/p2pShared";

const PAGE_SIZE = 25;

export default function PurchaseOrderListPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const navigate = useNavigate();
  const canCreate = useHasPermission("purchasing.create");
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);
  const [filters, setFilters] = useState({ search: "", status: "", supplierId: "", from: "", to: "", openOnly: false });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedResult<PurchaseOrder> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (companyId) suppliersApi.lookup(companyId, undefined, true).then(setSuppliers).catch(() => setSuppliers([]));
  }, [companyId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await purchaseOrdersApi.list(companyId, { ...filters, search: filters.search.trim(), page, pageSize: PAGE_SIZE }));
    } catch (e) {
      setError(apiError(e, "Unable to load purchase orders."));
    } finally {
      setLoading(false);
    }
  }, [companyId, filters, page]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(handle);
  }, [load]);

  const update = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const root = `/companies/${companyId}/procurement/purchase-orders`;
  const rows = data?.items ?? [];

  return (
    <main className="p2p-page">
      <PageHeader
        title={tx("Purchase Orders")}
        subtitle={tx("Approved commitments to suppliers, from draft through receipt and closure.")}
        actions={canCreate ? <Button onClick={() => navigate(`${root}/new`)}><Plus size={16} />{tx("New purchase order")}</Button> : undefined}
      />

      <Card>
        <CardContent className="p2p-toolbar">
          <FormField label={tx("Search")} value={filters.search} placeholder={tx("PO number, supplier or reference")} onChange={(e) => update({ search: e.target.value })} />
          <LabeledSelect label={tx("Status")} value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">{tx("All statuses")}</option>
            {PO_STATUSES.map((s) => <option key={s} value={s}>{tx(splitWords(s))}</option>)}
          </LabeledSelect>
          <LabeledSelect label={tx("Supplier")} value={filters.supplierId} onChange={(e) => update({ supplierId: e.target.value })}>
            <option value="">{tx("All suppliers")}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
          </LabeledSelect>
          <FormField label={tx("From")} type="date" value={filters.from} onChange={(e) => update({ from: e.target.value })} />
          <FormField label={tx("To")} type="date" value={filters.to} onChange={(e) => update({ to: e.target.value })} />
          <label className="p2p-check"><Checkbox checked={filters.openOnly} onChange={(e) => update({ openOnly: e.target.checked })} />{tx("Open only")}</label>
        </CardContent>
      </Card>

      {error && <StateMessage tone="error" action={<Button variant="outline" size="sm" onClick={() => void load()}>{tx("Retry")}</Button>}>{tx(error)}</StateMessage>}
      {loading && !data && <StateMessage tone="loading">{tx("Loading purchase orders...")}</StateMessage>}

      {data && rows.length === 0 && !loading ? (
        <EmptyState title={tx("No purchase orders found")} detail={tx("Convert an approved requisition or create a purchase order directly.")} />
      ) : rows.length > 0 && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("PO No.")}</TableHead>
                  <TableHead>{tx("Supplier")}</TableHead>
                  <TableHead>{tx("Order date")}</TableHead>
                  <TableHead>{tx("Expected")}</TableHead>
                  <TableHead>{tx("Deliver to")}</TableHead>
                  <TableHead className="p2p-right">{tx("Total")}</TableHead>
                  <TableHead className="p2p-right">{tx("Received")}</TableHead>
                  <TableHead>{tx("Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="p2p-nowrap">
                      <Link className="p2p-strong-link" to={`${root}/${po.id}`}>{po.poNo}</Link>
                      {po.revision > 0 && <div className="p2p-muted">{tx("Rev.")} {po.revision}</div>}
                    </TableCell>
                    <TableCell>{po.supplierName ?? "-"}</TableCell>
                    <TableCell className="p2p-nowrap">{date(po.orderDate)}</TableCell>
                    <TableCell className="p2p-nowrap">{date(po.expectedDeliveryDate)}</TableCell>
                    <TableCell>{po.deliveryLocationName ?? "-"}</TableCell>
                    <TableCell className="p2p-right p2p-nowrap">{money(po.grandTotal, po.currencyCode)}</TableCell>
                    <TableCell className="p2p-right"><Progress percent={po.receivedPercent} /></TableCell>
                    <TableCell><StatusChip status={po.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={page} pageSize={PAGE_SIZE} totalCount={data?.totalCount ?? 0} onPage={setPage} />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
