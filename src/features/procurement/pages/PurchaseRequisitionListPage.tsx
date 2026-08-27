import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { formatAppDate } from "../../../shared/datetime/dateFormat";
import {
  listPurchaseRequisitions,
  type PurchaseRequisition,
} from "../api/procurementApi";
import "./procurement.css";

const money = new Intl.NumberFormat("en-ET", {
  style: "currency",
  currency: "ETB",
  maximumFractionDigits: 2,
});

function formatDate(value?: string | null) {
  return formatAppDate(value);
}

function statusClass(status: string) {
  return `prq-chip prq-chip--${status.toLowerCase()}`;
}

export default function PurchaseRequisitionListPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [rows, setRows] = useState<PurchaseRequisition[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.value += row.estimatedTotal || 0;
        if (row.status === "PendingApproval") acc.pending += 1;
        if (row.status === "Approved") acc.approved += 1;
        return acc;
      },
      { count: 0, value: 0, pending: 0, approved: 0 },
    );
  }, [rows]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listPurchaseRequisitions(companyId, { status, search });
      setRows(data);
    } catch {
      setError("Unable to load purchase requisitions.");
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
          <div className="prq-kicker">Procurement / Purchase Requisitions</div>
          <h1>Purchase Requisition Control</h1>
          <p>Capture business demand, validate budget intent, and route approved needs into sourcing.</p>
        </div>
        <div className="prq-actions">
          <button className="prq-btn" type="button" onClick={load} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <Link className="prq-btn prq-btn--primary" to={`/companies/${companyId}/procurement/requisitions/new`}>
            <Plus size={16} /> New requisition
          </Link>
        </div>
      </header>

      {error && <div className="prq-alert">{error}</div>}

      <section className="prq-metrics" aria-label="Requisition summary">
        <div><span>Total requests</span><strong>{totals.count}</strong></div>
        <div><span>Pending approval</span><strong>{totals.pending}</strong></div>
        <div><span>Approved</span><strong>{totals.approved}</strong></div>
        <div><span>Estimated value</span><strong>{money.format(totals.value)}</strong></div>
      </section>

      <section className="prq-panel">
        <div className="prq-toolbar">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PR number, category, justification" />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All status</option>
            <option value="Draft">Draft</option>
            <option value="PendingApproval">Pending approval</option>
            <option value="Approved">Approved</option>
            <option value="Returned">Returned</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <button className="prq-btn" type="button" onClick={load}>Apply</button>
        </div>

        <div className="prq-table-wrap">
          <table className="prq-table">
            <thead>
              <tr>
                <th>PR No</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Category</th>
                <th>Requester</th>
                <th>Branch</th>
                <th>Required By</th>
                <th className="prq-right">Estimated Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><Link to={`/companies/${companyId}/procurement/requisitions/${row.id}`}>{row.requisitionNo}</Link></td>
                  <td><span className={statusClass(row.status)}>{row.status}</span></td>
                  <td>{row.priority}</td>
                  <td>{row.purchaseCategory}</td>
                  <td>{row.requestedByName ?? "-"}</td>
                  <td>{row.branchName ?? "Company scope"}</td>
                  <td>{formatDate(row.requiredByDateUtc)}</td>
                  <td className="prq-right">{money.format(row.estimatedTotal || 0)}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="prq-empty">No purchase requisitions found.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={8} className="prq-empty">Loading purchase requisitions...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
