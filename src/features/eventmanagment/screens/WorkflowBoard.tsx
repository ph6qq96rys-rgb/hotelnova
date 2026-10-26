import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import {
  getCateringWorkflowBoard,
  workflowStepTarget,
  type CateringWorkflowBoard,
  type CateringWorkflowCard,
} from "../api/cateringManagementApi";
import { cateringPath } from "../components/CateringLayout";
import { formatDay, readApiError } from "../sales/ui";
import "./workflow-board.css";

const KIND_LABEL: Record<CateringWorkflowCard["kind"], string> = {
  inquiry: "Enquiry",
  quotation: "Quotation",
  event: "Event",
};

/** What each column is waiting for, in plain words. */
const STAGE_HINT: Record<string, string> = {
  enquiry: "New requests to quote",
  quotation: "Being priced, approved or with the customer",
  deposit: "Confirmed, waiting for the deposit",
  planning: "Stock, kitchen and staff to arrange",
  delivery: "Issue, dispatch and run the event",
  closeout: "Returns, final bill and payment",
};

function cardTarget(card: CateringWorkflowCard): string {
  if (card.kind === "event") return workflowStepTarget(card.id, card.nextTab);
  const doc = card.kind === "quotation" ? "quotations" : "inquiries";
  return `sales?doc=${doc}&id=${encodeURIComponent(card.id)}`;
}

/**
 * The catering workflow board: every open enquiry, quotation and event in the column of its stage, with the one
 * thing to do next. Opening a card goes straight to the place where that step is done.
 */
export function WorkflowBoard({ companyId, branchId }: { companyId: string; branchId: string }) {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const attentionOnly = params.get("attention") === "1";
  const [board, setBoard] = useState<CateringWorkflowBoard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [companyId, branchId, query]);

  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setBoard(null);
    const timer = window.setTimeout(() => { void getCateringWorkflowBoard(companyId, { branchId: branchId || null, signal: controller.signal, page, pageSize: 60, search: query.trim() })
      .then((data) => !controller.signal.aborted && setBoard(data))
      .catch((e) => !controller.signal.aborted && setError(readApiError(e)))
      .finally(() => !controller.signal.aborted && setLoading(false)); }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [companyId, branchId, revision, page, query]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const cards = useMemo(() => {
    return (board?.cards ?? []).filter(
      (c) =>
        (!attentionOnly || c.alerts.length > 0),
    );
  }, [board, query, attentionOnly]);

  const attention = (board?.cards ?? []).filter((c) => c.alerts.length > 0).length;
  const stages = board?.stages ?? [];

  return (
    <section className="co-workspace wf">
      <header className="co-heading">
        <div>
          <h1>Catering workflow</h1>
          <p>Every order from first enquiry to final payment. Each card shows what to do next; open it to do it.</p>
        </div>
        <div className="co-actions">
          <Link className="co-primary" to={cateringPath(pathname, "sales?doc=inquiries&new=1")}>
            New enquiry
          </Link>
          <Link className="ui-button ui-button--outline" to={cateringPath(pathname, "command?view=list")}>
            All orders
          </Link>
          <Button variant="outline" disabled={loading} onClick={() => setRevision((r) => r + 1)} aria-label="Refresh">
            <RefreshCw size={16} aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="wf-toolbar">
        <Input
          type="search"
          value={query}
          onChange={(e) => setParam("q", e.target.value)}
          placeholder="Search customer or number"
          maxLength={100}
          aria-label="Search orders"
        />
        <label className="wf-check">
          <Checkbox checked={attentionOnly} onChange={(e) => setParam("attention", e.target.checked ? "1" : "")} />
          Needs attention on this page{attention ? ` (${attention})` : ""}
        </label>
      </div>
      {board ? <div className="co-actions">
        <span>{board.totalCount} matching records · Page {page} of {Math.max(1, Math.ceil(board.totalCount / board.pageSize))}. Stage counts apply to this page.</span>
        <Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
        <Button variant="outline" disabled={loading || page * board.pageSize >= board.totalCount} onClick={() => setPage(p => p + 1)}>Next</Button>
      </div> : null}

      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading && !board ? <StateMessage tone="loading">Loading the workflow…</StateMessage> : null}

      {board && board.cards.length === 0 ? (
        <EmptyState
          title="No open catering orders"
          detail="Record a customer's enquiry to start. It moves across the board as you quote, confirm, plan, deliver and bill."
          action={
            <Link className="co-primary" to={cateringPath(pathname, "sales?doc=inquiries&new=1")}>
              New enquiry
            </Link>
          }
        />
      ) : null}

      {board && board.cards.length > 0 ? (
        <div className="wf-board" role="list" aria-label="Workflow stages">
          {stages.map((stage) => {
            const column = cards.filter((c) => c.stage === stage.key);
            return (
              <section key={stage.key} className="wf-column" role="listitem" aria-labelledby={`wf-${stage.key}`}>
                <header className="wf-column-head">
                  <h2 id={`wf-${stage.key}`}>
                    {stage.label} <span className="wf-count">{column.length}</span>
                  </h2>
                  <p>{STAGE_HINT[stage.key]}</p>
                </header>
                {column.length === 0 ? <p className="wf-none">Nothing here</p> : null}
                {column.map((card) => (
                  <Link key={card.kind + card.id} to={cateringPath(pathname, cardTarget(card))} className={"wf-card" + (card.alerts.length ? " wf-card--alert" : "")}>
                    <span className="wf-card-top">
                      <span className="wf-ref">{card.reference}</span>
                      <span className="wf-kind">{KIND_LABEL[card.kind]}</span>
                    </span>
                    <strong className="wf-customer">{card.customer || "Customer not set"}</strong>
                    <span className="wf-meta">
                      {card.eventDateUtc ? formatDay(card.eventDateUtc) : "Date to confirm"}
                      {card.guests ? `, ${card.guests} guests` : ""}
                      {card.value ? `, ${formatCurrency(card.value)}` : ""}
                    </span>
                    {card.totalSteps > 0 ? (
                      <span className="wf-progress" aria-label={`${card.doneSteps} of ${card.totalSteps} steps done`}>
                        <span style={{ width: `${Math.round((card.doneSteps / card.totalSteps) * 100)}%` }} />
                      </span>
                    ) : null}
                    <span className="wf-next">
                      <span>Next</span> {card.nextAction}
                    </span>
                    {card.alerts.map((alert) => (
                      <span key={alert} className="wf-alert">
                        <AlertTriangle size={13} aria-hidden="true" /> {alert}
                      </span>
                    ))}
                  </Link>
                ))}
              </section>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
