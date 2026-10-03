import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { formatAppDate } from "../../../shared/datetime/dateFormat";
import {
  listPurchaseRequisitionsPaged,
  type PurchaseRequisition,
} from "../api/procurementApi";
import { Pager } from "../components/p2pShared";

const PAGE_SIZE = 50;
const PENDING_STATUSES = new Set(["Submitted", "PendingApproval", "PendingFnbApproval", "PendingFinanceApproval"]);
const READY_STATUSES = new Set(["Approved", "Sourcing"]);
const STATUS_FILTERS = [
  "Draft", "Submitted", "PendingFnbApproval", "PendingFinanceApproval", "PendingApproval", "Approved",
  "Sourcing", "Ordered", "Completed", "Closed", "Returned", "Rejected", "Cancelled",
];
import { useI18n } from "../../../i18n";
import "./procurement.css";

const money = {
  format: (value: number | string | null | undefined) => formatCurrency(value),
};

function formatDate(value?: string | null) {
  return formatAppDate(value);
}

function statusClass(status: string) {
  return `prq-chip prq-chip--${status.toLowerCase()}`;
}

export default function PurchaseRequisitionListPage() {
  const { tx } = useI18n();
  const { companyId } = useParams<{ companyId: string }>();
  const [rows, setRows] = useState<PurchaseRequisition[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.value += row.estimatedTotal || 0;
        if (PENDING_STATUSES.has(row.status)) acc.pending += 1;
        if (READY_STATUSES.has(row.status)) acc.approved += 1;
        return acc;
      },
      { value: 0, pending: 0, approved: 0 },
    );
  }, [rows]);

  async function load(nextPage = page) {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listPurchaseRequisitionsPaged(companyId, { status, search: search.trim(), page: nextPage, pageSize: PAGE_SIZE });
      setRows(data.items);
      setTotalCount(data.totalCount);
      setPage(nextPage);
    } catch {
      setError(tx("Unable to load purchase requisitions."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [companyId]);

  if (!companyId) return null;

  return (
    <main className="prq-page">
      <header className="prq-page-header">
        <div>
          <div className="prq-kicker">{tx("Procurement / Purchase Requisitions")}</div>
          <h1>{tx("Purchase Requisition Control")}</h1>
          <p>{tx("Capture business demand, validate budget intent, and route approved needs into sourcing.")}</p>
        </div>
        <div className="prq-actions">
          <button className="prq-btn" type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} /> {tx("Refresh")}
          </button>
          <Link className="prq-btn prq-btn--primary" to={`/companies/${companyId}/procurement/requisitions/new`}>
            <Plus size={16} /> {tx("New requisition")}
          </Link>
        </div>
      </header>

      {error && <div className="prq-alert">{error}</div>}

      <section className="prq-metrics" aria-label={tx("Requisition summary")}>
        <div><span>{tx("Total requests")}</span><strong>{totalCount}</strong></div>
        <div><span>{tx("Pending approval")}</span><strong>{totals.pending}</strong></div>
        <div><span>{tx("Ready to order")}</span><strong>{totals.approved}</strong></div>
        <div><span>{tx("Estimated value")}</span><strong>{money.format(totals.value)}</strong></div>
      </section>

      <section className="prq-panel">
        <div className="prq-toolbar">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tx("Search PR number, category, justification")} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{tx("All status")}</option>
            {STATUS_FILTERS.map((s) => <option key={s} value={s}>{tx(s.replace(/([a-z])([A-Z])/g, "$1 $2"))}</option>)}
          </select>
          <button className="prq-btn" type="button" onClick={() => void load(1)}>{tx("Apply")}</button>
        </div>

        <div className="prq-table-wrap">
          <table className="prq-table">
            <thead>
              <tr>
                <th>{tx("PR No")}</th>
                <th>{tx("Status")}</th>
                <th>{tx("Priority")}</th>
                <th>{tx("Category")}</th>
                <th>{tx("Requester")}</th>
                <th>{tx("Branch")}</th>
                <th>{tx("Required By")}</th>
                <th className="prq-right">{tx("Estimated Total")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><Link to={`/companies/${companyId}/procurement/requisitions/${row.id}`}>{row.requisitionNo}</Link></td>
                  <td><span className={statusClass(row.status)}>{tx(row.status.replace(/([a-z])([A-Z])/g, "$1 $2"))}</span></td>
                  <td>{tx(row.priority)}</td>
                  <td>{row.purchaseCategory}</td>
                  <td>{row.requestedByName ?? "-"}</td>
                  <td>{row.branchName ?? tx("Company scope")}</td>
                  <td>{formatDate(row.requiredByDateUtc)}</td>
                  <td className="prq-right">{money.format(row.estimatedTotal || 0)}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="prq-empty">{tx("No purchase requisitions found.")}</td></tr>
              )}
              {loading && (
                <tr><td colSpan={8} className="prq-empty">{tx("Loading purchase requisitions...")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPage={(p) => void load(p)} />
      </section>
    </main>
  );
}
