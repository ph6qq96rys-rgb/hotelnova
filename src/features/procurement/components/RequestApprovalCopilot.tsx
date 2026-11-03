import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { useI18n } from "../../../i18n";
import {
  findingKey, requestCopilotApi,
  type CopilotAnalysis, type CopilotAnswer, type CopilotDecision, type CopilotEvidence, type CopilotFinding, type CopilotLine, type CopilotRecommendation,
} from "../api/requestCopilotApi";
import { apiError, dateTime, money, qty } from "./p2pShared";
import "./requestCopilot.css";

/** What the page needs to record an F&B decision against the reviewed analysis. */
export type CopilotReviewState = CopilotDecision & { ready: boolean; blockers: string[]; missing: string[]; required: boolean };

const recommendationLabel: Record<CopilotRecommendation, string> = {
  Approve: "Approve", ReviewRequired: "Review required", ReturnForRevision: "Return for revision",
};
const actionLabel: Record<string, string> = { Warn: "Informational", Review: "Justification required", Block: "Blocks approval" };
const questions = [
  "Why is this quantity flagged?",
  "What stock can we transfer from the main warehouse?",
  "How does this price compare with the last 90 days?",
  "Does this request cover the confirmed catering events?",
];

function evidenceLink(companyId: string, e: CopilotEvidence): string | null {
  if (!e.id) return null;
  switch (e.kind) {
    case "PurchaseOrder": return `/companies/${companyId}/procurement/purchase-orders/${e.id}`;
    case "PurchaseRequest": return `/companies/${companyId}/procurement/requisitions/${e.id}`;
    case "GoodsReceipt": return `/companies/${companyId}/grns/${e.id}`;
    case "StockTransfer": return `/companies/${companyId}/inventory/stock-transfers/${e.id}`;
    case "CateringEvent": return `/companies/${companyId}/catering/events/${e.id}`;
    default: return null;
  }
}

function Num({ value, unit, suffix }: { value?: number | null; unit?: string; suffix?: string }) {
  const { tx } = useI18n();
  if (value === null || value === undefined) return <span className="rqc-missing" title={tx("Not available")}>{tx("n/a")}</span>;
  return <>{qty(value)}{unit ? ` ${unit}` : ""}{suffix ?? ""}</>;
}

function EvidenceList({ companyId, items }: { companyId: string; items: CopilotEvidence[] }) {
  const { tx } = useI18n();
  if (items.length === 0) return <p className="rqc-muted">{tx("No supporting records.")}</p>;
  return <ul className="rqc-evidence">{items.map(e => {
    const to = evidenceLink(companyId, e);
    return <li key={e.ref} className={e.counted ? "is-counted" : undefined}>
      <span className="rqc-evidence-kind">{tx(e.kind)}</span>
      {to ? <Link to={to}>{e.label}</Link> : <strong>{e.label}</strong>}
      {e.quantity !== null && e.quantity !== undefined && <span> · {qty(e.quantity)} {e.unit ?? ""}</span>}
      {e.date && <span> · {dateTime(e.date)}</span>}
      {e.status && <span> · {e.status}</span>}
      {e.note && <span className="rqc-muted"> — {e.note}</span>}
    </li>;
  })}</ul>;
}

function Findings({ lines, findings, overrides, onOverride, editable }: {
  lines: string; findings: CopilotFinding[]; overrides: Record<string, string>; onOverride: (key: string, value: string) => void; editable: boolean;
}) {
  const { tx } = useI18n();
  return <ul className="rqc-findings">{findings.map(f => {
    const key = findingKey(lines, f.code);
    return <li key={key} className={`rqc-finding rqc-finding--${f.action.toLowerCase()}`}>
      <div><strong>{tx(actionLabel[f.action] ?? f.action)}</strong> · <span className="rqc-code">{tx(f.code)}</span>
        {f.ruleName && <span className="rqc-muted"> · {f.ruleName} ({tx("Revision")} {f.revision})</span>}</div>
      <p>{f.explanation}</p>
      {f.action === "Review" && editable && <label className="rqc-justify">{tx("Justification")}
        <Textarea value={overrides[key] ?? ""} maxLength={500} onChange={e => onOverride(key, e.target.value)} placeholder={tx("Why is approval appropriate despite this finding?")} />
      </label>}
    </li>;
  })}</ul>;
}

export default function RequestApprovalCopilot({ companyId, id, version, canDecide, onReview, onSuggest }: {
  companyId: string; id: string; version?: string | null; canDecide: boolean;
  onReview: (state: CopilotReviewState) => void;
  onSuggest?: (lineId: string, quantity: number) => void;
}) {
  const { tx } = useI18n();
  const [analysis, setAnalysis] = useState<CopilotAnalysis | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<CopilotAnswer[]>([]);
  const [asking, setAsking] = useState(false);
  const request = useRef(0);

  async function analyze() {
    const token = ++request.current;
    setBusy(true); setError("");
    try {
      const result = await requestCopilotApi.analyze(companyId, id);
      if (token !== request.current) return;
      setAnalysis(result); setOverrides({}); setAcknowledged(false); setAnswers([]);
    } catch (e) { if (token === request.current) setError(apiError(e, "Unable to analyze the purchase request.")); }
    finally { if (token === request.current) setBusy(false); }
  }

  useEffect(() => {
    const token = ++request.current;
    setLoaded(false); setError("");
    void (async () => {
      try {
        const latest = await requestCopilotApi.latest(companyId, id);
        if (token !== request.current) return;
        const current = latest && latest.requisitionVersion === version && !latest.isStale && latest.status !== "Superseded";
        setAnalysis(latest); setLoaded(true);
        // AC1: at the F&B stage the approver sees an analysis of the current request version without asking for it.
        if (!current && canDecide && (latest?.atFnbStage ?? true)) await analyze();
        else if (latest?.assistantAvailable && latest.snapshot) setAnswers(await requestCopilotApi.messages(companyId, id));
      } catch (e) {
        if (token === request.current) { setLoaded(true); setError(apiError(e, "Unable to load the approval copilot.")); }
      }
    })();
    return () => { request.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, id, version, canDecide]);

  const snapshot = analysis?.snapshot ?? null;
  const failed = analysis?.status === "Failed";
  const stale = !!analysis && (analysis.isStale || analysis.requisitionVersion !== version);

  const review = useMemo<CopilotReviewState>(() => {
    const required = !!analysis?.requireReviewAtApproval;
    const all = snapshot ? [
      ...snapshot.lines.flatMap(l => l.findings.map(f => ({ key: findingKey(l.lines, f.code), f }))),
      ...snapshot.requestFindings.map(f => ({ key: findingKey("request", f.code), f })),
    ] : [];
    const blockers = all.filter(x => x.f.action === "Block").map(x => x.f.code);
    const missing = all.filter(x => x.f.action === "Review" && !(overrides[x.key] ?? "").trim()).map(x => x.key);
    const cleaned = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
    const ready = !required || (!!analysis && !stale && (failed ? acknowledged : blockers.length === 0 && missing.length === 0));
    return { analysisId: analysis?.id ?? null, overrides: cleaned, acknowledgeAnalysisUnavailable: failed && acknowledged, ready, blockers, missing, required };
  }, [analysis, snapshot, overrides, acknowledged, stale, failed]);

  useEffect(() => { onReview(review); }, [review, onReview]);

  async function ask(text: string) {
    if (!analysis || asking || !text.trim()) return;
    setAsking(true); setError("");
    try {
      const answer = await requestCopilotApi.ask(companyId, id, analysis.id, text.trim());
      setAnswers(a => [...a, answer]); setQuestion("");
    } catch (e) { setError(apiError(e, "The assistant could not answer.")); }
    finally { setAsking(false); }
  }

  const setOverride = (key: string, value: string) => setOverrides(o => ({ ...o, [key]: value }));
  const tone = (r: CopilotRecommendation) => r === "Approve" ? "approve" : r === "ReturnForRevision" ? "return" : "review";

  return <section className="prq-panel rqc" aria-labelledby="rqc-title">
    <div className="rqc-head">
      <div>
        <h2 id="rqc-title">{tx("Approval copilot")}</h2>
        <p className="rqc-muted">{tx("Advice only: the copilot does not approve, reject or change this request.")}</p>
      </div>
      <Button variant="secondary" disabled={busy} onClick={() => void analyze()}>{tx(busy ? "Analyzing..." : analysis ? "Refresh analysis" : "Analyze request")}</Button>
    </div>

    {!loaded && <StateMessage tone="loading">{tx("Loading approval copilot...")}</StateMessage>}
    {busy && loaded && <StateMessage tone="loading">{tx("Checking stock, consumption, pending supply, demand, prices and budget...")}</StateMessage>}
    {error && <StateMessage tone="error">{tx(error)}</StateMessage>}
    {loaded && !analysis && !busy && !error && <StateMessage tone="info">{tx("No analysis yet. Analyze the request to see stock coverage, price variance and exceptions.")}</StateMessage>}

    {analysis && stale && <StateMessage tone="warning" action={<Button size="sm" variant="outline" disabled={busy} onClick={() => void analyze()}>{tx("Refresh")}</Button>}>
      {tx(analysis.staleReason ?? "The request changed after this analysis.")} {tx("Refresh before approving.")}
    </StateMessage>}

    {analysis && failed && <div className="rqc-failed">
      <StateMessage tone="error">{tx("Analysis unavailable")}: {tx(analysis.error ?? "The analysis service failed.")} {tx("No check in this analysis has passed.")}</StateMessage>
      {canDecide && <label className="rqc-ack"><Checkbox checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />
        {tx("I am approving without the copilot analysis. I will explain why in the decision comment.")}</label>}
    </div>}

    {snapshot && <>
      <div className={`rqc-banner rqc-banner--${tone(snapshot.recommendation)}`}>
        <div>
          <span className="rqc-kicker">{tx("Suggested action")}</span>
          <strong>{tx(recommendationLabel[snapshot.recommendation])}</strong>
        </div>
        <p>{snapshot.summary}</p>
        <span className="rqc-muted">{tx("Analyzed")} {dateTime(analysis!.analyzedAtUtc)}</span>
      </div>

      <dl className="rqc-facts">
        <div><dt>{tx("Request")}</dt><dd>{snapshot.request.requisitionNo}</dd></div>
        <div><dt>{tx("Requester")}</dt><dd>{snapshot.request.requester}</dd></div>
        <div><dt>{tx("Branch")}</dt><dd>{snapshot.request.branch ?? tx("n/a")}</dd></div>
        <div><dt>{tx("Destination")}</dt><dd>{snapshot.request.destination ?? tx("n/a")}</dd></div>
        <div><dt>{tx("Required by")}</dt><dd>{dateTime(snapshot.request.requiredByDateUtc)}</dd></div>
        <div><dt>{tx("Estimated total")}</dt><dd>{money(snapshot.request.estimatedTotal, snapshot.request.currency)}{snapshot.request.missingPrices > 0 && <span className="rqc-missing"> · {snapshot.request.missingPrices} {tx("missing price(s)")}</span>}</dd></div>
        <div className="rqc-wide"><dt>{tx("Justification")}</dt><dd>{snapshot.request.justification || tx("None given")}</dd></div>
        {snapshot.budget && <div className="rqc-wide"><dt>{tx("Budget")}</dt><dd>{tx(snapshot.budget.status)} · {tx("Request value")} {money(snapshot.budget.requestValue, snapshot.request.currency)}
          {snapshot.budget.budgets.map(b => <span key={b.id}> · {b.name}: {tx("available")} {money(b.available, snapshot.request.currency)}</span>)}</dd></div>}
      </dl>

      <ul className="rqc-areas" aria-label={tx("Review areas")}>
        {snapshot.areas.map(a => <li key={a.name} className={`rqc-area rqc-area--${a.status.toLowerCase()}`} title={a.detail ?? undefined}>
          {tx(a.name)}: {tx(a.status === "Checked" ? "Checked" : a.status === "Failed" ? "Failed" : "Unavailable")}</li>)}
      </ul>

      <div className="rqc-table-wrap">
        <table className="rqc-table">
          <thead><tr>
            <th>{tx("Line")}</th><th>{tx("Item")}</th><th className="rqc-right">{tx("Requested")}</th><th className="rqc-right">{tx("Suggested")}</th>
            <th className="rqc-right">{tx("Coverage (days)")}</th><th className="rqc-right">{tx("Price variance")}</th><th>{tx("Exceptions")}</th><th>{tx("Suggested action")}</th>
          </tr></thead>
          <tbody>{snapshot.lines.map(line => <LineRow key={line.lines} companyId={companyId} line={line} overrides={overrides} onOverride={setOverride}
            editable={canDecide && !stale} onSuggest={onSuggest} tone={tone(line.recommendation)} />)}</tbody>
        </table>
      </div>

      {snapshot.requestFindings.length > 0 && <div className="rqc-block"><h3>{tx("Request-level findings")}</h3>
        <Findings lines="request" findings={snapshot.requestFindings} overrides={overrides} onOverride={setOverride} editable={canDecide && !stale} /></div>}

      <details className="rqc-block">
        <summary>{tx("Limitations and calculation")}</summary>
        <ul>{snapshot.limitations.map(l => <li key={l}>{l}</li>)}</ul>
        <p className="rqc-muted">{snapshot.calculationNote}</p>
        <p className="rqc-muted">{tx("Settings")}: {tx("consumption")} {snapshot.settings.consumptionLookbackDays} {tx("days")} · {tx("default coverage")} {snapshot.settings.defaultCoverageDays} {tx("days")} · {tx("duplicate window")} ±{snapshot.settings.duplicateWindowDays} {tx("days")} · {tx("price threshold")} {snapshot.settings.priceIncreaseThresholdPercent}%</p>
      </details>

      {canDecide && review.required && !stale && !failed && (review.blockers.length > 0
        ? <StateMessage tone="error">{tx("Approval is blocked by")}: {review.blockers.map(b => tx(b)).join(", ")}. {tx("Return the request for revision.")}</StateMessage>
        : review.missing.length > 0
          ? <StateMessage tone="warning">{tx("Add a justification for each finding marked 'Justification required' before approving")} ({review.missing.length}).</StateMessage>
          : <StateMessage tone="success">{tx("Review complete. Your decision will be recorded against this analysis.")}</StateMessage>)}

      {analysis!.assistantAvailable && !stale && <div className="rqc-block rqc-chat">
        <h3>{tx("Ask about this request")}</h3>
        <p className="rqc-muted">{tx("Answers use only this analysis's evidence and state its limitations.")}</p>
        <div className="rqc-chips">{questions.map(q => <Button key={q} size="sm" variant="outline" disabled={asking} onClick={() => void ask(q)}>{tx(q)}</Button>)}</div>
        <form className="rqc-ask" onSubmit={e => { e.preventDefault(); void ask(question); }}>
          <Input value={question} maxLength={500} onChange={e => setQuestion(e.target.value)} placeholder={tx("Ask a question about the evidence")} aria-label={tx("Question")} />
          <Button type="submit" disabled={asking || question.trim().length < 3}>{tx(asking ? "Asking..." : "Ask")}</Button>
        </form>
        {answers.map(a => <div key={a.id} className={`rqc-answer rqc-answer--${a.status.toLowerCase()}`}>
          <p className="rqc-q">{a.question}</p>
          <p>{a.answer}</p>
          {a.citations.length > 0 && <EvidenceList companyId={companyId} items={a.citations} />}
          {a.limitations.length > 0 && <p className="rqc-muted">{tx("Limitations")}: {a.limitations.join(" ")}</p>}
        </div>)}
      </div>}
    </>}
  </section>;
}

function LineRow({ companyId, line, overrides, onOverride, editable, onSuggest, tone }: {
  companyId: string; line: CopilotLine; overrides: Record<string, string>; onOverride: (key: string, value: string) => void;
  editable: boolean; onSuggest?: (lineId: string, quantity: number) => void; tone: string;
}) {
  const { tx } = useI18n();
  const exceptions = line.findings.filter(f => f.action !== "Warn" || ["PriceUnavailable", "LowCoverage", "QuantityBelowNeed"].includes(f.code));
  const canSuggest = editable && !!onSuggest && line.lineIds.length === 1 && line.suggestedRequestUnits !== null && line.suggestedRequestUnits !== undefined
    && line.suggestedRequestUnits < line.requestedQuantity;
  return <>
    <tr className={`rqc-row rqc-row--${tone}`}>
      <td>{line.lines}</td>
      <td>{line.itemName}</td>
      <td className="rqc-right">{qty(line.requestedQuantity)} {line.requestUnit}</td>
      <td className="rqc-right"><Num value={line.suggestedRequestUnits ?? line.suggestedBase} unit={line.suggestedRequestUnits !== null && line.suggestedRequestUnits !== undefined ? line.requestUnit : line.baseUnit} /></td>
      <td className="rqc-right"><Num value={line.coverageDaysNow} />{line.coverageDaysAfter !== null && line.coverageDaysAfter !== undefined && <span className="rqc-muted"> → {qty(line.coverageDaysAfter)}</span>}</td>
      <td className="rqc-right">{line.priceVariancePercent === null || line.priceVariancePercent === undefined ? <span className="rqc-missing">{tx("Unavailable")}</span> : `${line.priceVariancePercent > 0 ? "+" : ""}${qty(line.priceVariancePercent)}%`}</td>
      <td>{exceptions.length === 0 ? tx("None") : exceptions.map(f => tx(f.code)).join(", ")}</td>
      <td><span className={`rqc-pill rqc-pill--${tone}`}>{tx(recommendationLabel[line.recommendation])}</span></td>
    </tr>
    <tr className="rqc-detail"><td colSpan={8}>
      <details>
        <summary>{tx("Findings and evidence")}</summary>
        <p>{line.summary}</p>
        <dl className="rqc-facts rqc-facts--compact">
          <div><dt>{tx("Usable stock")}</dt><dd><Num value={line.usableBase} unit={line.baseUnit} /></dd></div>
          <div><dt>{tx("Incoming orders")}</dt><dd><Num value={line.incomingOrdersBase} unit={line.baseUnit} /></dd></div>
          <div><dt>{tx("In transit")}</dt><dd><Num value={line.inTransitBase} unit={line.baseUnit} /></dd></div>
          <div><dt>{tx("Average daily use")}</dt><dd><Num value={line.dailyConsumption} unit={line.baseUnit} /></dd></div>
          <div><dt>{tx("Demand")}</dt><dd><Num value={line.demandBase} unit={line.baseUnit} /></dd></div>
          <div><dt>{tx("Safety stock")}</dt><dd><Num value={line.safetyStockBase} unit={line.baseUnit} /></dd></div>
          <div><dt>{tx("Target")}</dt><dd><Num value={line.targetBase} unit={line.baseUnit} /></dd></div>
          <div><dt>{tx("Proposed / baseline price")}</dt><dd><Num value={line.proposedBasePrice} /> / <Num value={line.baselineBasePrice} /></dd></div>
        </dl>
        <Findings lines={line.lines} findings={line.findings} overrides={overrides} onOverride={onOverride} editable={editable} />
        {canSuggest && <Button size="sm" variant="outline" onClick={() => onSuggest!(line.lineIds[0], line.suggestedRequestUnits!)}>
          {tx("Use suggested quantity")} ({qty(line.suggestedRequestUnits!)} {line.requestUnit})</Button>}
        <h4>{tx("Evidence")}</h4>
        <EvidenceList companyId={companyId} items={line.evidence} />
        {line.assumptions.length > 0 && <ul className="rqc-muted">{line.assumptions.map(a => <li key={a}>{a}</li>)}</ul>}
      </details>
    </td></tr>
  </>;
}
