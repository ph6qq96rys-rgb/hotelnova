import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { getButcheryWorkflowBoard, type ButcheryWorkflowBoard, type ButcheryWorkflowCard } from "../api/butcheryManagementApi";
import { cateringPath } from "../components/CateringLayout";
import { formatDay, readApiError } from "../sales/ui";
import "./workflow-board.css";

/** What each column is waiting for, in plain words. */
const STAGE_HINT: Record<string, string> = {
  demand: "Catering orders short of cut meat",
  prepare: "Cutting orders to submit",
  approve: "Waiting for a supervisor",
  cut: "On the block: weigh every cut",
  post: "Weighed and balanced, ready for stock",
  done: "Posted in the last 7 days",
};

function cardTarget(card: ButcheryWorkflowCard): string {
  return card.kind === "batch" ? `butchery?view=yield&batch=${encodeURIComponent(card.id)}` : "butchery?view=production";
}

/**
 * The butchery workflow board: catering demand and every cutting order in the column of its stage, with the next
 * step. Opening a card goes to the order (or to the production plan for demand).
 */
export function ButcheryBoard({ companyId, branchId }: { companyId: string; branchId: string }) {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const attentionOnly = params.get("attention") === "1";
  const [board, setBoard] = useState<ButcheryWorkflowBoard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getButcheryWorkflowBoard(companyId, branchId || null, controller.signal)
      .then((data) => !controller.signal.aborted && setBoard(data))
      .catch((e) => !controller.signal.aborted && setError(readApiError(e)))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [companyId, branchId, revision]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const cards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (board?.cards ?? []).filter(
      (c) =>
        (!attentionOnly || c.alerts.length > 0) &&
        (!needle || [c.reference, c.title, c.subtitle ?? "", c.nextAction].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [board, query, attentionOnly]);
  const attention = (board?.cards ?? []).filter((c) => c.alerts.length > 0).length;

  return (
    <section className="co-workspace wf">
      <header className="co-heading">
        <div>
          <h1>Butchery workflow</h1>
          <p>From catering demand to cuts in stock. Each card shows what to do next; open it to do it.</p>
        </div>
        <div className="co-actions">
          <Link className="co-primary" to={cateringPath(pathname, "butchery?view=batches&new=1")}>
            New cutting order
          </Link>
          <Link className="ui-button ui-button--outline" to={cateringPath(pathname, "butchery?view=batches")}>
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
          placeholder="Search order, cut or next step"
          aria-label="Search cutting orders"
        />
        <label className="wf-check">
          <Checkbox checked={attentionOnly} onChange={(e) => setParam("attention", e.target.checked ? "1" : "")} />
          Needs attention only{attention ? ` (${attention})` : ""}
        </label>
      </div>

      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading && !board ? <StateMessage tone="loading">Loading the workflow…</StateMessage> : null}

      {board && board.cards.length === 0 ? (
        <EmptyState
          title="Nothing on the block"
          detail="Create a cutting order from a received carcass, or generate demand from a catering event. It moves across the board as it is approved, cut, weighed and posted."
          action={
            <Link className="co-primary" to={cateringPath(pathname, "butchery?view=batches&new=1")}>
              New cutting order
            </Link>
          }
        />
      ) : null}

      {board && board.cards.length > 0 ? (
        <div className="wf-board" role="list" aria-label="Workflow stages">
          {board.stages.map((stage) => {
            const column = cards.filter((c) => c.stage === stage.key);
            return (
              <section key={stage.key} className="wf-column" role="listitem" aria-labelledby={`bwf-${stage.key}`}>
                <header className="wf-column-head">
                  <h2 id={`bwf-${stage.key}`}>
                    {stage.label} <span className="wf-count">{column.length}</span>
                  </h2>
                  <p>{STAGE_HINT[stage.key]}</p>
                </header>
                {column.length === 0 ? <p className="wf-none">Nothing here</p> : null}
                {column.map((card) => (
                  <Link
                    key={card.kind + card.id}
                    to={cateringPath(pathname, cardTarget(card))}
                    className={"wf-card" + (card.alerts.length ? " wf-card--alert" : "")}
                  >
                    <span className="wf-card-top">
                      <span className="wf-ref">{card.reference}</span>
                      <span className="wf-kind">{card.kind === "batch" ? "Cutting order" : "Demand"}</span>
                    </span>
                    <strong className="wf-customer">{card.title}</strong>
                    <span className="wf-meta">
                      {[card.subtitle, card.dateUtc ? formatDay(card.dateUtc) : null, card.weightKg ? `${card.weightKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg` : null]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                    {card.kind === "batch" ? (
                      <span className="wf-progress" aria-label={`${card.doneSteps} of ${card.totalSteps} steps done`}>
                        <span style={{ width: `${Math.round((card.doneSteps / card.totalSteps) * 100)}%` }} />
                      </span>
                    ) : null}
                    <span className="wf-next">
                      <span>{card.stage === "done" ? "Then" : "Next"}</span> {card.nextAction}
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
