import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { purchaseReturnsApi, suppliersApi, type PagedResult, type PurchaseReturn, type SupplierLookup } from "../api/purchasingApi";
import { LabeledSelect, Pager, StatusChip, apiError, date, money, useCompanyId } from "../components/p2pShared";

const PAGE_SIZE = 25;

export default function PurchaseReturnListPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const navigate = useNavigate();
  const canCreate = useHasPermission("purchasing.receiveinspect");
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);
  const [filters, setFilters] = useState({ status: "", supplierId: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedResult<PurchaseReturn> | null>(null);
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
      setData(await purchaseReturnsApi.list(companyId, { ...filters, page, pageSize: PAGE_SIZE }));
    } catch (e) {
      setError(apiError(e, "Unable to load purchase returns."));
    } finally {
      setLoading(false);
    }
  }, [companyId, filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const root = `/companies/${companyId}/procurement/purchase-returns`;
  const rows = data?.items ?? [];

  return (
    <main className="p2p-page">
      <PageHeader
        title={tx("Purchase Returns")}
        subtitle={tx("Goods sent back to suppliers against posted goods receipts.")}
        actions={canCreate ? <Button onClick={() => navigate(`${root}/new`)}><Plus size={16} />{tx("New return")}</Button> : undefined}
      />

      <Card>
        <CardContent className="p2p-toolbar">
          <LabeledSelect label={tx("Status")} value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
            <option value="">{tx("All statuses")}</option>
            {["Draft", "Posted", "Cancelled"].map((s) => <option key={s} value={s}>{tx(s)}</option>)}
          </LabeledSelect>
          <LabeledSelect label={tx("Supplier")} value={filters.supplierId} onChange={(e) => { setFilters((f) => ({ ...f, supplierId: e.target.value })); setPage(1); }}>
            <option value="">{tx("All suppliers")}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
          </LabeledSelect>
        </CardContent>
      </Card>

      {error && <StateMessage tone="error">{tx(error)}</StateMessage>}
      {loading && !data && <StateMessage tone="loading">{tx("Loading purchase returns...")}</StateMessage>}

      {data && rows.length === 0 && !loading ? (
        <EmptyState title={tx("No purchase returns")} detail={tx("Returns are raised from a posted goods receipt.")} />
      ) : rows.length > 0 && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Return No.")}</TableHead>
                  <TableHead>{tx("Date")}</TableHead>
                  <TableHead>{tx("Supplier")}</TableHead>
                  <TableHead>{tx("GRN")}</TableHead>
                  <TableHead>{tx("PO No.")}</TableHead>
                  <TableHead>{tx("Reason")}</TableHead>
                  <TableHead className="p2p-right">{tx("Value")}</TableHead>
                  <TableHead>{tx("Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="p2p-nowrap"><Link className="p2p-strong-link" to={`${root}/${r.id}`}>{r.returnNo}</Link></TableCell>
                    <TableCell>{date(r.returnDate)}</TableCell>
                    <TableCell>{r.supplierName ?? "-"}</TableCell>
                    <TableCell>{r.grnNo ?? "-"}</TableCell>
                    <TableCell>{r.poNo ?? "-"}</TableCell>
                    <TableCell>{tx(r.reason)}</TableCell>
                    <TableCell className="p2p-right">{money(r.totalAmount)}</TableCell>
                    <TableCell><StatusChip status={r.status} /></TableCell>
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
