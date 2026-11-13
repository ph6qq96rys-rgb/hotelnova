import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, ClipboardList, PackageCheck, Plus, RefreshCw, Search, ShieldCheck, ShoppingCart, Sparkles, Truck } from "lucide-react";


import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { useI18n } from "../../../i18n";
import { apiError, date, money, StatusChip, useCompanyId } from "../components/p2pShared";
import {
  procurementWorkflowApi,
  WORKFLOW_STAGES,
  type ProcurementCaseSummary,
  type ProcurementWorkflowBoard,
  type WorkflowStage,
} from "../api/procurementWorkflowApi";
import "../components/workflow.css";

const STAGE_ICON: Record<WorkflowStage, typeof ClipboardList> = {
  request: ClipboardList,
  approval: ShieldCheck,
  ordering: ShoppingCart,
  receiving: Truck,
  completed: PackageCheck,
  stopped: AlertTriangle,
};

const STAGE_HINT: Record<WorkflowStage, string> = {
  request: "Drafts and requests sent back for changes",
  approval: "Waiting for F&B, finance or assigned reviewers",
  ordering: "Approved; purchase orders to raise, approve or send",
  receiving: "Ordered; waiting for delivery and the goods receipt",
  completed: "Received in full or closed (last 30 days)",
  stopped: "Rejected or cancelled (last 30 days)",
};

const URGENT = new Set(["High", "Urgent", "Emergency"]);

export default function ProcurementWorkflowPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const root = `/companies/${companyId}`;
  const [params, setParams] = useSearchParams();
  const stage = (params.get("stage") ?? "") as WorkflowStage | "";
  const mine = params.get("mine") === "1";

  const query = params.get("q") ?? "";
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [board, setBoard] = useState<ProcurementWorkflowBoard | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const controller = useRef<AbortController | null>(null);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  // Counts come from the whole board; the stage filter is applied on the client so the pipeline always shows every stage.
  const load = useCallback(async () => {
    if (!companyId) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError("");
    try {
      const data = await procurementWorkflowApi.board(companyId, { search: query, mine }, current.signal);
      if (!current.signal.aborted) setBoard(data);
    } catch (e) {
      if (!current.signal.aborted) setError(apiError(e, "Unable to load the purchase workflow."));
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [companyId, mine, query]);

  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);


  // Search applies after a short pause in typing.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (query !== search.trim()) setParam("q", search.trim());
    }, 350);
    return () => window.clearTimeout(handle);
  }, [search, query, setParam]);

  const cases = useMemo(
    () => (board?.cases ?? []).filter((c) => !stage || c.stage === stage),
    [board, stage],
  );
  const myActions = useMemo(() => (board?.cases ?? []).filter((c) => c.myAction).length, [board]);
  const overdue = useMemo(() => (board?.cases ?? []).filter((c) => c.overdue).length, [board]);
  const stopped = board?.stages.find((s) => s.key === "stopped");

  return (
    <main className="p2p-page wf-page">
      <PageHeader
        title={tx("Purchase workflow")}
        subtitle={tx("Every purchase from request to goods receipt, with the next step and who it is waiting on.")}
        actions={
          <>
            <Button variant="outline" onClick={() => void load()} disabled={loading} aria-busy={loading}>
              <RefreshCw size={16} aria-hidden="true" className={loading ? "wf-spin" : undefined} />
              {tx("Refresh")}
            </Button>
            <Link className="wf-link-button wf-link-button--secondary" to={`${root}/procurement/requisitions/reorder`}>
              <Sparkles size={16} aria-hidden="true" />
              {tx("Request from reorder levels")}
            </Link>
            <Link className="wf-link-button" to={`${root}/procurement/requisitions/new`}>
              <Plus size={16} aria-hidden="true" />
              {tx("New purchase request")}
            </Link>
          </>
        }
      />

      <nav className="wf-pipeline" aria-label={tx("Workflow stages")}>
        <Link
          to={`?${withParam(params, "stage", "")}`}
          className={`wf-stage wf-stage--all${stage === "" ? " is-active" : ""}`}
          aria-current={stage === "" ? "true" : undefined}
        >
          <span className="wf-stage-label">{tx("All open work")}</span>
          <strong>{(board?.cases ?? []).filter((c) => c.stage !== "completed" && c.stage !== "stopped").length}</strong>
          <small>
            {myActions > 0 ? `${myActions} ${tx("need you")}` : tx("Nothing waiting on you")}
            {overdue > 0 ? ` · ${overdue} ${tx("overdue")}` : ""}
          </small>
        </Link>
        {WORKFLOW_STAGES.map((key, index) => {
          const count = board?.stages.find((s) => s.key === key);
          const Icon = STAGE_ICON[key];
          return (
            <Link
              key={key}
              to={`?${withParam(params, "stage", stage === key ? "" : key)}`}
              className={`wf-stage${stage === key ? " is-active" : ""}`}
              aria-current={stage === key ? "true" : undefined}
              title={tx(STAGE_HINT[key])}
            >
              <span className="wf-stage-label">
                <span className="wf-stage-step">{index + 1}</span>
                <Icon size={16} aria-hidden="true" />
                {tx(count?.label ?? key)}
              </span>
              <strong>{count?.count ?? 0}</strong>
              <small>{count && count.actionCount > 0 ? <span className="wf-need-you">{count.actionCount} {tx("need you")}</span> : tx(STAGE_HINT[key])}</small>
              {index < WORKFLOW_STAGES.length - 1 ? <ArrowRight size={16} aria-hidden="true" className="wf-stage-arrow" /> : null}
            </Link>
          );
        })}
      </nav>

      <section className="ui-card">
        <div className="ui-card-content wf-toolbar">
          <label className="wf-search">
            <Search size={16} aria-hidden="true" />
            <span className="wf-sr">{tx("Search")}</span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tx("Search by number, category or purpose")}
            />
          </label>
          <div className="wf-segment" role="group" aria-label={tx("Show")}>
            <Button variant={mine ? "outline" : "default"} size="sm" aria-pressed={!mine} onClick={() => setParam("mine", "")}>
              {tx("Everything I can see")}
            </Button>
            <Button variant={mine ? "default" : "outline"} size="sm" aria-pressed={mine} onClick={() => setParam("mine", "1")}>
              {tx("Mine and waiting on me")}
            </Button>
          </div>
          {stopped && stopped.count > 0 ? (
            <Link className="wf-quiet-link" to={`?${withParam(params, "stage", stage === "stopped" ? "" : "stopped")}`}>
              {stage === "stopped" ? tx("Back to open work") : `${tx("Rejected or cancelled")} (${stopped.count})`}
            </Link>
          ) : null}
        </div>
      </section>

      {error ? <StateMessage tone="error" action={<Button variant="outline" size="sm" onClick={() => void load()}>{tx("Retry")}</Button>}>{tx(error)}</StateMessage> : null}

      {!board && loading ? <StateMessage tone="loading">{tx("Loading the purchase workflow...")}</StateMessage> : null}

      {board ? (
        cases.length === 0 ? (
          <EmptyState
            title={stage ? tx("Nothing in this stage") : tx("No purchases match")}
            detail={mine ? tx("Nothing you raised or need to act on matches these filters.") : tx("Start with a purchase request; it will move through approval, ordering and receiving here.")}
            action={<Link className="wf-link-button" to={`${root}/procurement/requisitions/new`}>{tx("New purchase request")}</Link>}
          />
        ) : (
          <section className="wf-case-list" aria-label={tx("Purchases")}>
            {cases.map((c) => (
              <CaseRow key={`${c.kind}:${c.id}`} item={c} to={`${root}/procurement/workflow/${c.kind}/${c.id}`} />
            ))}
            {board.truncated ? <p className="p2p-muted">{tx("Showing the 300 most recent requests. Search or filter to find older ones.")}</p> : null}
          </section>
        )
      ) : null}
    </main>
  );
}

function CaseRow({ item, to }: { item: ProcurementCaseSummary; to: string }) {
  const { tx } = useI18n();
  const Icon = STAGE_ICON[item.stage] ?? ClipboardList;
  const open = item.stage !== "completed" && item.stage !== "stopped";
  return (
    <Link to={to} className={`wf-case${item.myAction ? " is-mine" : ""}${item.overdue ? " is-overdue" : ""}`}>
      <span className={`wf-case-icon wf-tone-${item.stage}`} aria-hidden="true"><Icon size={18} /></span>
      <span className="wf-case-main">
        <span className="wf-case-title">
          <strong>{item.reference}</strong>
          <span>{item.title}</span>
        </span>
        <span className="wf-case-next">
          {open ? <><b>{tx("Next")}:</b> {item.nextStep}{item.waitingOn ? <> · <span className="p2p-muted">{tx("Waiting on")} {item.waitingOn}</span></> : null}</> : item.nextStep}
        </span>
        <span className="wf-case-meta">
          {item.branchName ? <span>{item.branchName}</span> : null}
          {item.requesterName ? <span>{tx("Requested by")} {item.requesterName}</span> : null}
          {item.supplierName ? <span>{item.supplierName}</span> : null}
          {item.orderCount > 0 ? <span>{item.orderCount} {tx(item.orderCount === 1 ? "purchase order" : "purchase orders")}</span> : null}
          {item.receiptCount > 0 ? <span>{item.receiptCount} {tx(item.receiptCount === 1 ? "goods receipt" : "goods receipts")}</span> : null}
        </span>
      </span>
      <span className="wf-case-side">
        <span className="wf-case-chips">
          {item.myAction ? <span className="p2p-chip p2p-chip--info">{tx("Needs you")}</span> : null}
          {item.overdue ? <span className="p2p-chip p2p-chip--danger">{tx("Overdue")}</span> : null}
          {URGENT.has(item.priority) ? <span className="p2p-chip p2p-chip--warning">{tx(item.priority)}</span> : null}
          <StatusChip status={item.status} />
        </span>
        <strong className="wf-case-amount">{money(item.amount, item.currencyCode)}</strong>
        {item.requiredByUtc ? (
          <span className={item.overdue ? "p2p-danger-text wf-small" : "p2p-muted wf-small"}>{tx("Needed by")} {date(item.requiredByUtc)}</span>
        ) : null}
        {item.orderCount > 0 ? (
          <span className="wf-mini-progress" aria-label={`${tx("Ordered")} ${Math.round(item.orderedPercent)}%, ${tx("received")} ${Math.round(item.receivedPercent)}%`}>
            <span title={tx("Ordered")}><i style={{ width: `${Math.min(100, item.orderedPercent)}%` }} /></span>
            <span title={tx("Received")} className="is-received"><i style={{ width: `${Math.min(100, item.receivedPercent)}%` }} /></span>
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function withParam(params: URLSearchParams, key: string, value: string): string {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  return next.toString();
}
