import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import {
  approvePurchaseRequisitionFinance,
  approvePurchaseRequisitionFnb,
  decidePurchaseRequisition,
  getPurchaseRequisition,
  submitPurchaseRequisition,
  type PurchaseRequisition,
} from "../api/procurementApi";
import "./procurement.css";

const money = new Intl.NumberFormat("en-ET", {
  style: "currency",
  currency: "ETB",
  maximumFractionDigits: 2,
});

function formatDateTime(value?: string | null) {
  return formatAppDateTime(value);
}

function statusClass(status: string) {
  return `prq-chip prq-chip--${status.toLowerCase()}`;
}

function canDecision(status: string) {
  return status === "PendingFnbApproval" || status === "PendingFinanceApproval";
}

export default function PurchaseRequisitionDetailPage() {
  const { companyId, id } = useParams<{ companyId: string; id: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<PurchaseRequisition | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!companyId || !id) return;
    setLoading(true);
    setError(null);
    try {
      setRow(await getPurchaseRequisition(companyId, id));
    } catch {
      setError("Unable to load purchase requisition.");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!companyId || !id) return;
    setError(null);
    const result = await submitPurchaseRequisition(companyId, id);
    if (!result.success) {
      setError(result.error ?? "Unable to submit requisition.");
      return;
    }
    await load();
  }

  async function approve(stage: "fnb" | "finance") {
    if (!companyId || !id) return;
    setError(null);
    const result = stage === "fnb"
      ? await approvePurchaseRequisitionFnb(companyId, id, comment)
      : await approvePurchaseRequisitionFinance(companyId, id, comment);
    if (!result.success) {
      setError(result.error ?? "Unable to approve requisition.");
      return;
    }
    setComment("");
    await load();
  }

  async function decide(decision: "reject" | "return" | "cancel") {
    if (!companyId || !id) return;
    setError(null);
    const result = await decidePurchaseRequisition(companyId, id, decision, comment);
    if (!result.success) {
      setError(result.error ?? "Unable to update requisition decision.");
      return;
    }
    setComment("");
    await load();
  }

  useEffect(() => {
    void load();
  }, [companyId, id]);

  if (!companyId || !id) return null;

  return (
    <main className="prq-page">
      <header className="prq-page-header">
        <div>
          <div className="prq-kicker">Procurement / Purchase Requisitions</div>
          <h1>{row?.requisitionNo ?? "Purchase Requisition"}</h1>
          <p>{row ? `${row.purchaseCategory} demand from ${row.branchName ?? "company scope"}` : "Loading requisition"}</p>
        </div>
        <div className="prq-actions">
          <button className="prq-btn" type="button" onClick={() => navigate(-1)}>Back</button>
          {row?.status === "Draft" || row?.status === "Returned" ? (
            <button className="prq-btn prq-btn--primary" type="button" onClick={submit}>Submit</button>
          ) : null}
        </div>
      </header>

      {error && <div className="prq-alert">{error}</div>}
      {loading && <div className="prq-panel prq-empty">Loading purchase requisition...</div>}

      {row && (
        <>
          <section className="prq-metrics">
            <div><span>Status</span><strong><span className={statusClass(row.status)}>{row.status}</span></strong></div>
            <div><span>Priority</span><strong>{row.priority}</strong></div>
            <div><span>Required by</span><strong>{formatDateTime(row.requiredByDateUtc)}</strong></div>
            <div><span>Estimated total</span><strong>{money.format(row.estimatedTotal || 0)}</strong></div>
          </section>

          <section className="prq-panel prq-detail-grid">
            <div><span>Requester</span><strong>{row.requestedByName ?? "-"}</strong></div>
            <div><span>Branch</span><strong>{row.branchName ?? "Company scope"}</strong></div>
            <div><span>Department</span><strong>{row.departmentName ?? "-"}</strong></div>
            <div><span>Suggested supplier</span><strong>{row.suggestedSupplierName ?? "-"}</strong></div>
            <div><span>Required location</span><strong>{row.requiredStockLocationName ?? "-"}</strong></div>
            <div><span>Delivery location</span><strong>{row.deliveryLocationName ?? "-"}</strong></div>
            <div className="prq-span-2"><span>Business justification</span><strong>{row.businessJustification}</strong></div>
            {row.stockAvailabilityNote && <div className="prq-span-2"><span>Stock note</span><strong>{row.stockAvailabilityNote}</strong></div>}
          </section>

          <section className="prq-panel">
            <div className="prq-section-title"><h2>Lines</h2></div>
            <div className="prq-table-wrap">
              <table className="prq-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Item or Service</th>
                    <th>UOM</th>
                    <th className="prq-right">Qty</th>
                    <th className="prq-right">Unit Price</th>
                    <th className="prq-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {row.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.lineNo}</td>
                      <td>{line.lineType}</td>
                      <td><strong>{line.itemName}</strong><br /><span>{line.specification ?? "-"}</span></td>
                      <td>{line.uomName}</td>
                      <td className="prq-right">{line.quantity}</td>
                      <td className="prq-right">{money.format(line.estimatedUnitPrice)}</td>
                      <td className="prq-right">{money.format(line.estimatedLineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="prq-panel prq-approval">
            <div>
              <h2>Approval Decision</h2>
              <p>Store Keeper submits the request. F&B validates operational need, then Finance gives final budget approval.</p>
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Decision comment" />
            <div className="prq-actions">
              {row.status === "PendingFnbApproval" && (
                <button className="prq-btn prq-btn--primary" type="button" onClick={() => approve("fnb")}>F&B approve</button>
              )}
              {row.status === "PendingFinanceApproval" && (
                <button className="prq-btn prq-btn--primary" type="button" onClick={() => approve("finance")}>Finance approve</button>
              )}
              {canDecision(row.status) && (
                <button className="prq-btn" type="button" onClick={() => decide("return")}>Return</button>
              )}
              {canDecision(row.status) && (
                <button className="prq-btn prq-btn--danger" type="button" onClick={() => decide("reject")}>Reject</button>
              )}
            </div>
          </section>

          <section className="prq-panel">
            <div className="prq-section-title"><h2>Decision History</h2><Link to={`/companies/${companyId}/procurement/requisitions`}>All requisitions</Link></div>
            {row.decisions.length === 0 ? <p className="prq-empty">No decisions recorded.</p> : (
              <div className="prq-history">
                {row.decisions.map((decision) => (
                  <div key={decision.id}>
                    <strong>{decision.decision}</strong>
                    <span>{formatDateTime(decision.decidedAtUtc)}</span>
                    <p>{decision.comment ?? "-"}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
