import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useAppScope } from "../../../app/useAppScope";
import { useI18n } from "../../../i18n";
import { formatAppDateTime, todayLocalIsoDate } from "../../../shared/datetime/dateFormat";
import { money } from "../../pos/components/posUi";
import { extractApiError } from "../../pos/utils/posUtils";
import { saleReturnsApi, type SaleReturnDto } from "../api/saleReturnsApi";
import { ReturnDecision } from "../components/SaleReturnsPanel";
import "../../pos/pos-service.css";

const STATUSES = [
  { value: "requested", label: "Waiting for approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All returns" },
];
const stockLabel: Record<string, string> = { notRequired: "No stock to put back", pending: "Stock waiting", posted: "Back in stock", failed: "Stock posting failed" };

/** Returns (credit notes) of the branch: the supervisor's approval queue and history. */
export default function SalesReturnsPage() {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => ({ companyId: companyId ?? "", branchId: branchId ?? "" }), [companyId, branchId]);
  const [filters, setFilters] = useState({ status: "requested", from: "", to: todayLocalIsoDate(), search: "" });
  const [rows, setRows] = useState<SaleReturnDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scope.companyId || !scope.branchId) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await saleReturnsApi.list(scope, {
        status: filters.status || undefined, from: filters.from || undefined, to: filters.to || undefined, search: filters.search.trim() || undefined,
      }));
    } catch (err) {
      setError(extractApiError(err, "Unable to load returns."));
    } finally {
      setLoading(false);
    }
  }, [scope, filters]);

  useEffect(() => { void load(); }, [load]);
  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <main className="rpos-page rpos-setup ui-page">
      <PageHeader title={tx("Returns & Refunds")}
        subtitle={tx("Returns are credit notes. A supervisor who did not make the sale or ask for the return approves it.")}
        actions={<Button type="button" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw size={14} aria-hidden="true" /> {tx("Refresh")}</Button>} />

      <section className="rpos-setup-area rpos-tip-filters" aria-label={tx("Filters")}>
        <label className="rpos-field"><span>{tx("Status")}</span>
          <Select value={filters.status} onChange={(e) => set({ status: e.target.value })}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{tx(s.label)}</option>)}
          </Select>
        </label>
        <label className="rpos-field"><span>{tx("From")}</span><Input type="date" value={filters.from} max={filters.to} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="rpos-field"><span>{tx("To")}</span><Input type="date" value={filters.to} min={filters.from} onChange={(e) => set({ to: e.target.value })} /></label>
        <label className="rpos-field"><span>{tx("Search")}</span><Input value={filters.search} placeholder={tx("Return, sale or cashier")} onChange={(e) => set({ search: e.target.value })} /></label>
      </section>

      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {loading && rows.length === 0 ? <StateMessage tone="loading">{tx("Loading returns...")}</StateMessage> : null}

      <section className="rpos-setup-area" aria-label={tx("Returns")}>
        {!loading && rows.length === 0 ? <p className="rpos-muted">{tx("No returns match these filters.")}</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx("Return")}</TableHead>
                <TableHead>{tx("Sale")}</TableHead>
                <TableHead>{tx("Requested")}</TableHead>
                <TableHead>{tx("Items")}</TableHead>
                <TableHead className="rpos-num">{tx("Total")}</TableHead>
                <TableHead className="rpos-num">{tx("Refund")}</TableHead>
                <TableHead>{tx("Status")}</TableHead>
                <TableHead><span className="sr-only">{tx("Actions")}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={r.status === "requested" ? "is-stale" : undefined}>
                  <TableCell>{r.returnNo}<br /><span className="rpos-muted">{r.reason}</span></TableCell>
                  <TableCell><Link to={`/companies/${companyId}/sales/details/${r.saleId}`}>{r.saleNo}</Link></TableCell>
                  <TableCell>{r.requestedByName}<br /><span className="rpos-muted">{formatAppDateTime(r.requestedAtUtc)}</span></TableCell>
                  <TableCell>{r.lines.map((l) => `${l.quantity} × ${l.itemName}`).join(", ")}</TableCell>
                  <TableCell className="rpos-num">{money(r.totalAmount)}</TableCell>
                  <TableCell className="rpos-num">{money(r.refundAmount)}<br /><span className="rpos-muted">{r.refunds.map((x) => tx(x.method)).join(" + ")}</span></TableCell>
                  <TableCell>
                    {tx(STATUSES.find((s) => s.value === r.status)?.label ?? r.status)}
                    {r.decidedByName ? <><br /><span className="rpos-muted">{r.decidedByName}{r.decisionNote ? ` · ${r.decisionNote}` : ""}</span></> : null}
                    {r.status === "approved" ? <><br /><span className="rpos-muted">{tx(stockLabel[r.stockStatus] ?? r.stockStatus)}</span></> : null}
                  </TableCell>
                  <TableCell className="rpos-row-actions"><ReturnDecision item={r} onDone={(message) => { setNotice(message); void load(); }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  );
}
