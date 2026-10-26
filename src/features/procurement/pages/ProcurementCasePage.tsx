import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, CircleDot, ExternalLink, RefreshCw, X } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { http } from "../../../api/http";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { useI18n } from "../../../i18n";
import { suppliersApi, type SupplierLookup } from "../api/purchasingApi";
import {
  ActionDialog,
  apiError,
  BackButton,
  date,
  dateTime,
  DetailItem,
  LabeledSelect,
  money,
  Progress,
  qty,
  StatusChip,
  useCompanyId,
} from "../components/p2pShared";
import { procurementWorkflowApi, type CaseAction, type ProcurementCase } from "../api/procurementWorkflowApi";
import "../components/workflow.css";

/** Actions that run straight away; everything else asks for confirmation or a reason first. */
const DIRECT_ACTIONS = new Set(["submit", "submit-order", "send-order"]);

export default function ProcurementCasePage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const { kind = "requisition", id = "" } = useParams<{ kind: string; id: string }>();
  const navigate = useNavigate();
  const root = `/companies/${companyId}`;

  const [data, setData] = useState<ProcurementCase | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CaseAction | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [receivingBranchId, setReceivingBranchId] = useState("");
  const [receivingBranches, setReceivingBranches] = useState<{ id: string; name: string }[]>([]);
  const [receivingError, setReceivingError] = useState("");
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !id) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    try {
      const next = await procurementWorkflowApi.get(companyId, kind, id, current.signal);
      if (current.signal.aborted) return;
      setData(next);
      setError("");
      // A purchase order that belongs to a requisition opens as the requisition's case.
      if (next.summary.kind !== kind || next.summary.id !== id)
        navigate(`${root}/procurement/workflow/${next.summary.kind}/${next.summary.id}`, { replace: true });
    } catch (e) {
      if (!current.signal.aborted) setError(apiError(e, "Unable to load this purchase."));
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [companyId, kind, id, navigate, root]);

  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);

  const needsSupplier = pending?.needsSupplier ?? false;
  const needsReceivingBranch = pending?.key === "receive";
  useEffect(() => {
    if (!needsReceivingBranch) return;
    let active = true;
    setReceivingBranchId("");
    setReceivingBranches([]);
    setReceivingError("");
    http.get<{ id: string; name: string }[] | { items?: { id: string; name: string }[] }>(`/companies/${companyId}/branches`)
      .then(({ data: result }) => {
        if (!active) return;
        const branches = Array.isArray(result) ? result : result.items ?? [];
        setReceivingBranches(branches);
        if (branches.length === 1) setReceivingBranchId(branches[0].id);
        if (!branches.length) setReceivingError("No receiving branches are available.");
      })
      .catch((e) => { if (active) setReceivingError(apiError(e, "Unable to load receiving branches.")); });
    return () => { active = false; };
  }, [needsReceivingBranch, companyId]);
  useEffect(() => {
    if (!needsSupplier || suppliers.length > 0) return;
    suppliersApi.lookup(companyId).then(setSuppliers).catch(() => setSuppliers([]));
  }, [needsSupplier, suppliers.length, companyId]);

  async function run(action: CaseAction, comment?: string) {
    if (action.link) {
      navigate(`${root}${action.link}`);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await procurementWorkflowApi.act(companyId, action, { comment, supplierId: action.needsSupplier ? supplierId : undefined, receivingBranchId: action.key === "receive" ? receivingBranchId : undefined });
      setPending(null);
      setSupplierId("");
      if (result.receiptId) {
        navigate(`${root}/grns/${result.receiptId}/edit`);
        return;
      }
      setNotice(result.message);
      await load();
    } catch (e) {
      if (action.key === "receive") {
        setReceivingError(apiError(e, "The goods receipt could not be prepared."));
        return;
      }
      setError(apiError(e, "The action could not be completed."));
      setPending(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function start(action: CaseAction) {
    if (action.link || (DIRECT_ACTIONS.has(action.key) && !action.commentRequired && !action.confirm)) void run(action);
    else setPending(action);
  }

  if (!data) {
    return (
      <main className="p2p-page wf-page">
        <BackButton to={`${root}/procurement/workflow`} label={tx("Purchase workflow")} />
        {error ? <StateMessage tone="error" action={<Button variant="outline" size="sm" onClick={() => void load()}>{tx("Retry")}</Button>}>{tx(error)}</StateMessage>
          : <StateMessage tone="loading">{tx("Loading...")}</StateMessage>}
      </main>
    );
  }

  const { summary, requisition } = data;
  const primary = data.actions.filter((a) => a.tone === "primary");
  const secondary = data.actions.filter((a) => a.tone === "secondary");
  const danger = data.actions.filter((a) => a.tone === "danger");
  const open = summary.stage !== "completed" && summary.stage !== "stopped";

  return (
    <main className="p2p-page wf-page">
      <BackButton to={`${root}/procurement/workflow`} label={tx("Purchase workflow")} />
      <PageHeader
        title={`${summary.reference} · ${summary.title}`}
        subtitle={[summary.branchName, summary.requesterName ? `${tx("Requested by")} ${summary.requesterName}` : null, summary.supplierName]
          .filter(Boolean).join(" · ")}
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading} aria-busy={loading}>
            <RefreshCw size={16} aria-hidden="true" className={loading ? "wf-spin" : undefined} />
            {tx("Refresh")}
          </Button>
        }
      />

      <ol className="wf-stepper" aria-label={tx("Progress")}>
        {data.steps.map((step, index) => (
          <li key={step.key} className={`wf-step is-${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
            <span className="wf-step-dot" aria-hidden="true">
              {step.state === "done" ? <Check size={14} /> : step.state === "stopped" ? <X size={14} /> : step.state === "current" ? <CircleDot size={14} /> : index + 1}
            </span>
            <span className="wf-step-text">
              <strong>{tx(step.label)}</strong>
              <small>
                {step.state === "done" && step.atUtc ? date(step.atUtc) : tx(step.state === "current" ? "In progress" : step.state === "stopped" ? "Stopped" : step.state === "done" ? "Done" : "Not started")}
              </small>
              {step.detail ? <small className="wf-step-detail">{step.detail}</small> : null}
            </span>
          </li>
        ))}
      </ol>

      {notice ? <StateMessage tone="success">{tx(notice)}</StateMessage> : null}
      {error ? <StateMessage tone="error">{tx(error)}</StateMessage> : null}

      <section className={`ui-card wf-next${summary.myAction ? " is-mine" : ""}`} aria-labelledby="wf-next-title">
        <div className="ui-card-content">
          <div className="wf-next-head">
            <div>
              <span className="wf-eyebrow">{open ? tx("Next step") : tx("Outcome")}</span>
              <h2 id="wf-next-title">{summary.nextStep}</h2>
              {open && summary.waitingOn ? (
                <p className="p2p-muted">
                  {summary.myAction ? tx("Waiting on you") : `${tx("Waiting on")} ${summary.waitingOn}`}
                  {requisition?.approvalDueUtc && summary.stage === "approval" ? ` · ${tx("Due")} ${dateTime(requisition.approvalDueUtc)}` : ""}
                </p>
              ) : null}
            </div>
            <div className="wf-next-chips">
              {summary.overdue ? <span className="p2p-chip p2p-chip--danger">{tx("Overdue")}</span> : null}
              {summary.priority !== "Normal" ? <span className="p2p-chip p2p-chip--warning">{tx(summary.priority)}</span> : null}
              <StatusChip status={summary.status} />
            </div>
          </div>
          {primary.length + secondary.length + danger.length > 0 ? (
            <div className="wf-next-actions">
              <div className="p2p-actions">
                {primary.map((a) => (
                  <Button key={`${a.targetId}:${a.key}`} onClick={() => start(a)} disabled={busy}>{tx(a.label)}</Button>
                ))}
                {secondary.map((a) => (
                  <Button key={`${a.targetId}:${a.key}`} variant="outline" onClick={() => start(a)} disabled={busy}>
                    {tx(a.label)}{a.link ? <ExternalLink size={14} aria-hidden="true" /> : null}
                  </Button>
                ))}
              </div>
              {danger.length > 0 ? (
                <div className="p2p-actions">
                  {danger.map((a) => (
                    <Button key={`${a.targetId}:${a.key}`} variant="ghost" className="wf-danger-ghost" onClick={() => start(a)} disabled={busy}>{tx(a.label)}</Button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : open ? (
            <p className="p2p-muted wf-no-actions">{tx("There is nothing for you to do on this purchase right now.")}</p>
          ) : null}
        </div>
      </section>

      <section className="p2p-metrics">
        <Metric label={requisition ? tx("Estimated") : tx("Order value")} value={money(requisition?.estimatedTotal ?? summary.amount, summary.currencyCode)} />
        <Metric label={tx("Committed on purchase orders")} value={money(data.committedTotal, summary.currencyCode)} />
        <Metric label={tx("Received value")} value={money(data.receivedValue, summary.currencyCode)} />
        <Metric label={tx("Invoiced")} value={money(data.invoicedTotal, summary.currencyCode)} />
        {summary.requiredByUtc ? <Metric label={tx("Needed by")} value={date(summary.requiredByUtc)} tone={summary.overdue ? "danger" : undefined} /> : null}
      </section>

      <div className="wf-columns">
        <div className="wf-column">
          {requisition ? (
            <section className="ui-card">
              <div className="ui-card-content">
                <div className="p2p-section-head">
                  <h2>{tx("Request")}</h2>
                  <Link className="p2p-strong-link" to={`${root}/procurement/requisitions/${requisition.id}`}>{tx("Open requisition")}</Link>
                </div>
                <div className="p2p-details wf-details">
                  <DetailItem label={tx("Category")}>{requisition.category}</DetailItem>
                  <DetailItem label={tx("Requested")}>{date(requisition.requestDateUtc)}</DetailItem>
                  <DetailItem label={tx("Deliver to")}>{requisition.deliveryLocationName ?? "-"}</DetailItem>
                  <DetailItem label={tx("Suggested supplier")}>{requisition.suggestedSupplierName ?? "-"}</DetailItem>
                  <DetailItem label={tx("Approval")}>
                    {requisition.approvalMode === "route" ? tx("Approval rule") : tx("Standard (F&B, then finance)")}
                    {requisition.approvers.length > 0 ? ` · ${requisition.approvers.join(", ")}` : ""}
                  </DetailItem>
                  <DetailItem label={tx("Purpose")} wide>{requisition.justification}</DetailItem>
                </div>
              </div>
            </section>
          ) : null}

          <section className="ui-card">
            <div className="ui-card-content">
              <div className="p2p-section-head"><h2>{tx("Items")}</h2></div>
              <div className="ui-table-scroll">
                <table className="ui-table wf-lines">
                  <thead>
                    <tr>
                      <th scope="col">{tx("Item")}</th>
                      {requisition ? <th scope="col" className="p2p-right">{tx("Requested")}</th> : null}
                      {requisition ? <th scope="col" className="p2p-right">{tx("Approved")}</th> : null}
                      <th scope="col" className="p2p-right">{tx("Ordered")}</th>
                      <th scope="col" className="p2p-right">{tx("Received")}</th>
                      <th scope="col" className="p2p-right">{tx("Still to receive")}</th>
                      <th scope="col" className="p2p-right">{tx("Unit price")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((line) => (
                      <tr key={line.lineNo}>
                        <td><strong>{line.itemName}</strong><span className="p2p-muted"> · {line.uomName}</span></td>
                        {requisition ? <td className="p2p-right">{qty(line.requested)}</td> : null}
                        {requisition ? <td className="p2p-right">{qty(line.approved)}</td> : null}
                        <td className="p2p-right">
                          {qty(line.ordered)}
                          {line.outstandingToOrder > 0 && requisition?.status !== "Closed" ? <span className="wf-sub p2p-warning-text">{qty(line.outstandingToOrder)} {tx("to order")}</span> : null}
                        </td>
                        <td className="p2p-right">{qty(line.received)}</td>
                        <td className="p2p-right">{line.outstandingToReceive > 0 ? qty(line.outstandingToReceive) : "-"}</td>
                        <td className="p2p-right">{money(line.unitPrice, summary.currencyCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="ui-card">
            <div className="ui-card-content">
              <div className="p2p-section-head"><h2>{tx("Documents")}</h2></div>
              {data.orders.length === 0 && data.receipts.length === 0 && data.invoices.length === 0 ? (
                <p className="p2p-muted">{tx("Purchase orders, goods receipts and supplier invoices raised for this request appear here.")}</p>
              ) : null}
              <ul className="wf-docs">
                {data.orders.map((o) => (
                  <li key={o.id}>
                    <span className="wf-doc-kind">{tx("Purchase order")}</span>
                    <Link className="p2p-strong-link" to={`${root}/procurement/purchase-orders/${o.id}`}>{o.poNo}{o.revision > 0 ? ` (rev ${o.revision})` : ""}</Link>
                    <span>{o.supplierName}</span>
                    <span className="p2p-muted">{date(o.orderDate)}{o.expectedDeliveryDate ? ` → ${tx("expected")} ${date(o.expectedDeliveryDate)}` : ""}</span>
                    <span className="wf-doc-end"><Progress percent={o.receivedPercent} /><strong>{money(o.grandTotal, o.currencyCode)}</strong><StatusChip status={o.status} /></span>
                  </li>
                ))}
                {data.receipts.map((g) => (
                  <li key={g.id}>
                    <span className="wf-doc-kind">{tx("Goods receipt")}</span>
                    <Link className="p2p-strong-link" to={`${root}/grns/${g.id}${g.status === "Draft" ? "/edit" : ""}`}>{g.grnNo}</Link>
                    <span>{g.poNo ?? ""}{g.locationName ? ` · ${g.locationName}` : ""}</span>
                    <span className="p2p-muted">{date(g.receivedAtUtc)} · {g.lineCount} {tx(g.lineCount === 1 ? "line" : "lines")}</span>
                    <span className="wf-doc-end"><strong>{money(g.value, summary.currencyCode)}</strong><StatusChip status={g.status} /></span>
                  </li>
                ))}
                {data.invoices.map((i) => (
                  <li key={i.id}>
                    <span className="wf-doc-kind">{tx("Supplier invoice")}</span>
                    <Link className="p2p-strong-link" to={`${root}/procurement/supplier-invoices/${i.id}`}>{i.internalNo}</Link>
                    <span>{i.supplierInvoiceNo}</span>
                    <span className="p2p-muted">{tx(i.paymentStatus.replace(/([a-z])([A-Z])/g, "$1 $2"))}</span>
                    <span className="wf-doc-end"><strong>{money(i.grandTotal, summary.currencyCode)}</strong><StatusChip status={i.status} /></span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <aside className="ui-card wf-activity" aria-labelledby="wf-activity-title">
          <div className="ui-card-content">
            <div className="p2p-section-head"><h2 id="wf-activity-title">{tx("Activity")}</h2></div>
            {data.timeline.length === 0 ? <p className="p2p-muted">{tx("No activity yet.")}</p> : (
              <ol className="p2p-timeline">
                {data.timeline.map((e, index) => (
                  <li key={`${e.atUtc}-${index}`}>
                    <strong>{tx(e.title)}</strong> <span className="p2p-muted">· {e.document}</span>
                    <p>{dateTime(e.atUtc)}{e.actor ? ` · ${e.actor}` : ""}</p>
                    {e.detail ? <p className="wf-event-detail">{e.detail}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>

      <ActionDialog
        open={pending !== null}
        title={pending ? tx(pending.label) : ""}
        message={pending ? confirmMessage(pending, tx) : undefined}
        confirmText={pending ? tx(pending.label) : ""}
        danger={pending?.tone === "danger"}
        commentLabel={commentLabelFor(pending, tx)}
        commentRequired={pending?.commentRequired}
        busy={busy}
        confirmDisabled={(needsSupplier && !supplierId) || (needsReceivingBranch && !receivingBranchId)}
        onConfirm={(comment) => pending && void run(pending, comment)}
        onClose={() => { if (!busy) { setPending(null); setSupplierId(""); } }}
      >
        {needsReceivingBranch ? (
          <>
            <LabeledSelect label={tx("Receiving branch")} required value={receivingBranchId} onChange={(e) => { setReceivingBranchId(e.target.value); setReceivingError(""); }}>
              <option value="">{tx("Choose which branch is receiving these goods")}</option>
              {receivingBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </LabeledSelect>
            <p>{tx("Choose the branch whose stock will receive this delivery. It must have receiving access to the order's delivery location.")}</p>
            {receivingError ? <p role="alert">{tx(receivingError)}</p> : null}
          </>
        ) : null}
        {needsSupplier ? (
          <LabeledSelect label={tx("Supplier")} required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{tx("Choose the supplier for lines without one")}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </LabeledSelect>
        ) : null}
      </ActionDialog>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className={`p2p-metric${tone ? ` p2p-metric--${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function commentLabelFor(action: CaseAction | null, tx: (text: string) => string): string | undefined {
  if (!action) return undefined;
  if (action.commentLabel) return tx(action.commentLabel);
  return action.key.includes("approve") ? tx("Comment (optional)") : undefined;
}

function confirmMessage(action: CaseAction, tx: (text: string) => string): string {
  if (action.confirm) return action.confirm;
  const ref = action.targetReference ?? "";
  switch (action.key) {
    case "approve":
      return `${tx("Approve")} ${ref}. ${tx("It moves to the next approver or, after the last approval, to purchasing.")}`;
    case "approve-order":
    case "finance-approve-order":
      return `${tx("Approve")} ${ref}. ${tx("Approved orders can be sent to the supplier.")}`;
    case "create-orders":
      return tx("Draft purchase orders are created for the approved quantities, one per supplier. Check prices before submitting them.");
    case "return":
    case "return-order":
      return tx("The document goes back to its preparer with your comment.");
    case "reject":
      return tx("The request is stopped. The requester sees your reason.");
    case "close":
      return tx("Remaining quantities will not be ordered or received.");
    default:
      return "";
  }
}
