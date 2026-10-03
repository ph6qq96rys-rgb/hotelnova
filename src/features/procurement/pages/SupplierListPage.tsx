import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { FormField } from "../../../components/ui/FormField";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { SUPPLIER_STATUSES, suppliersApi, type PagedResult, type Supplier } from "../api/purchasingApi";
import { LabeledSelect, Pager, StatusChip, apiError, splitWords, useCompanyId } from "../components/p2pShared";

const PAGE_SIZE = 25;

export default function SupplierListPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const navigate = useNavigate();
  const canCreate = useHasPermission("suppliers.create");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedResult<Supplier> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await suppliersApi.list(companyId, { search: search.trim(), status, page, pageSize: PAGE_SIZE }));
    } catch (e) {
      setError(apiError(e, "Unable to load suppliers."));
    } finally {
      setLoading(false);
    }
  }, [companyId, search, status, page]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(handle);
  }, [load]);

  const rows = data?.items ?? [];
  const root = `/companies/${companyId}/procurement/suppliers`;

  return (
    <main className="p2p-page">
      <PageHeader
        title={tx("Suppliers")}
        subtitle={tx("Approved vendors, tax registration, payment terms and price lists.")}
        actions={canCreate ? <Button onClick={() => navigate(`${root}/new`)}><Plus size={16} />{tx("New supplier")}</Button> : undefined}
      />

      <Card>
        <CardContent className="p2p-toolbar">
          <FormField label={tx("Search")} value={search} placeholder={tx("Name, code, TIN or phone")}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <LabeledSelect label={tx("Status")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">{tx("All statuses")}</option>
            {SUPPLIER_STATUSES.map((s) => <option key={s} value={s}>{tx(splitWords(s))}</option>)}
          </LabeledSelect>
        </CardContent>
      </Card>

      {error && <StateMessage tone="error" action={<Button variant="outline" size="sm" onClick={() => void load()}>{tx("Retry")}</Button>}>{tx(error)}</StateMessage>}
      {loading && !data && <StateMessage tone="loading">{tx("Loading suppliers...")}</StateMessage>}

      {data && rows.length === 0 && !loading ? (
        <EmptyState title={tx("No suppliers found")} detail={tx("Create a supplier to start raising purchase orders.")} />
      ) : rows.length > 0 && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Code")}</TableHead>
                  <TableHead>{tx("Supplier")}</TableHead>
                  <TableHead>{tx("Category")}</TableHead>
                  <TableHead>{tx("TIN")}</TableHead>
                  <TableHead>{tx("Contact")}</TableHead>
                  <TableHead className="p2p-right">{tx("Terms (days)")}</TableHead>
                  <TableHead>{tx("Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><Link className="p2p-strong-link" to={`${root}/${s.id}`}>{s.code}</Link></TableCell>
                    <TableCell>
                      <strong>{s.name}</strong>
                      {s.isVatRegistered && <div className="p2p-muted">{tx("VAT registered")}</div>}
                    </TableCell>
                    <TableCell>{s.category || "-"}</TableCell>
                    <TableCell>{s.taxId || <span className="p2p-warning-text">{tx("Missing")}</span>}</TableCell>
                    <TableCell>
                      {s.contactPerson || "-"}
                      <div className="p2p-muted">{[s.phone, s.email].filter(Boolean).join(" · ")}</div>
                    </TableCell>
                    <TableCell className="p2p-right">{s.paymentTermDays}</TableCell>
                    <TableCell><StatusChip status={s.status} /></TableCell>
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
