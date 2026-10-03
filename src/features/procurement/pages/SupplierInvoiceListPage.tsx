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
import {
  INVOICE_STATUSES,
  PAYMENT_STATUSES,
  supplierInvoicesApi,
  suppliersApi,
  type PagedResult,
  type SupplierInvoice,
  type SupplierLookup,
} from "../api/purchasingApi";
import { LabeledSelect, Pager, StatusChip, apiError, date, money, splitWords, useCompanyId } from "../components/p2pShared";

const PAGE_SIZE = 25;

export default function SupplierInvoiceListPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const navigate = useNavigate();
  const canCreatePurchasing = useHasPermission("purchasing.create");
  const canManagePayables = useHasPermission("finance.payables.manage");
  const canCreate = canCreatePurchasing || canManagePayables;
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);
  const [filters, setFilters] = useState({ search: "", status: "", paymentStatus: "", supplierId: "", overdueOnly: false });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedResult<SupplierInvoice> | null>(null);
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
      setData(await supplierInvoicesApi.list(companyId, { ...filters, search: filters.search.trim(), page, pageSize: PAGE_SIZE }));
    } catch (e) {
      setError(apiError(e, "Unable to load supplier invoices."));
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
  const root = `/companies/${companyId}/procurement/supplier-invoices`;
  const rows = data?.items ?? [];

  return (
    <main className="p2p-page">
      <PageHeader
        title={tx("Supplier Invoices")}
        subtitle={tx("Accounts payable with three-way match against purchase orders and goods receipts.")}
        actions={canCreate ? <Button onClick={() => navigate(`${root}/new`)}><Plus size={16} />{tx("Record invoice")}</Button> : undefined}
      />

      <Card>
        <CardContent className="p2p-toolbar">
          <FormField label={tx("Search")} value={filters.search} placeholder={tx("Invoice number, supplier or PO")} onChange={(e) => update({ search: e.target.value })} />
          <LabeledSelect label={tx("Status")} value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">{tx("All statuses")}</option>
            {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{tx(splitWords(s))}</option>)}
          </LabeledSelect>
          <LabeledSelect label={tx("Payment")} value={filters.paymentStatus} onChange={(e) => update({ paymentStatus: e.target.value })}>
            <option value="">{tx("All")}</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{tx(splitWords(s))}</option>)}
          </LabeledSelect>
          <LabeledSelect label={tx("Supplier")} value={filters.supplierId} onChange={(e) => update({ supplierId: e.target.value })}>
            <option value="">{tx("All suppliers")}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
          </LabeledSelect>
          <label className="p2p-check"><Checkbox checked={filters.overdueOnly} onChange={(e) => update({ overdueOnly: e.target.checked })} />{tx("Overdue only")}</label>
        </CardContent>
      </Card>

      {error && <StateMessage tone="error" action={<Button variant="outline" size="sm" onClick={() => void load()}>{tx("Retry")}</Button>}>{tx(error)}</StateMessage>}
      {loading && !data && <StateMessage tone="loading">{tx("Loading supplier invoices...")}</StateMessage>}

      {data && rows.length === 0 && !loading ? (
        <EmptyState title={tx("No supplier invoices found")} detail={tx("Record an invoice from a purchase order to start the three-way match.")} />
      ) : rows.length > 0 && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Internal No.")}</TableHead>
                  <TableHead>{tx("Supplier invoice")}</TableHead>
                  <TableHead>{tx("Supplier")}</TableHead>
                  <TableHead>{tx("PO No.")}</TableHead>
                  <TableHead>{tx("Due date")}</TableHead>
                  <TableHead className="p2p-right">{tx("Payable")}</TableHead>
                  <TableHead className="p2p-right">{tx("Outstanding")}</TableHead>
                  <TableHead>{tx("Status")}</TableHead>
                  <TableHead>{tx("Payment")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="p2p-nowrap"><Link className="p2p-strong-link" to={`${root}/${inv.id}`}>{inv.internalNo}</Link></TableCell>
                    <TableCell>{inv.supplierInvoiceNo}<div className="p2p-muted">{date(inv.invoiceDate)}</div></TableCell>
                    <TableCell>{inv.supplierName ?? "-"}</TableCell>
                    <TableCell className="p2p-nowrap">{inv.poNo ?? "-"}</TableCell>
                    <TableCell className={inv.isOverdue ? "p2p-nowrap p2p-variance" : "p2p-nowrap"}>{date(inv.dueDate)}{inv.isOverdue && <div className="p2p-muted">{tx("Overdue")}</div>}</TableCell>
                    <TableCell className="p2p-right">{money(inv.payableAmount, inv.currencyCode)}</TableCell>
                    <TableCell className="p2p-right">{money(inv.outstandingAmount, inv.currencyCode)}</TableCell>
                    <TableCell><StatusChip status={inv.status} /></TableCell>
                    <TableCell><StatusChip status={inv.paymentStatus} /></TableCell>
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
