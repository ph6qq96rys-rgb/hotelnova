import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../api/http";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../../i18n";
import { apiError, qty, dateTime } from "./p2pShared";

export type RequestEvaluation = {
  recommendation: string;
  suggestedBaseQuantity: number | null;
  findings: { code: string; action: string; explanation: string; ruleName?: string; revision?: number }[];
};
type Report = {
  recommendation: string; evaluatedAtUtc: string; budgetStatus: string; notice: string;
  lines: { lines: string; itemName: string; unit: string; evaluation: RequestEvaluation;
    availability?: { requisitions: { id: string; reference: string }[];
      transferable: { locationId: string; locationName: string; availableBaseQuantity: number }[] } }[];
};
const labels: Record<string, string> = {
  Hold: "Hold recommendation", Review: "Needs review", Purchase: "Purchase gap identified",
  NoPurchase: "No additional purchase indicated", NoAction: "No further action",
};
export function EvaluationFindings({ evaluation }: { evaluation: RequestEvaluation }) {
  const { tx } = useI18n();
  return <div><h3>{tx(labels[evaluation.recommendation] ?? evaluation.recommendation)}</h3>
    <ul>{evaluation.findings.map(f => <li key={f.code}><strong>{tx(f.action)}</strong>: {f.explanation}
      {f.ruleName && <span> · {f.ruleName} ({tx("Revision")} {f.revision})</span>}</li>)}</ul>
  </div>;
}

export default function PurchaseRequestEvaluation({ companyId, id, version }: { companyId: string; id: string; version?: string | null }) {
  const { tx } = useI18n();
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => { request.current++; setReport(null); setError(""); setBusy(false); return () => { request.current++; }; }, [companyId, id, version]);
  async function evaluate() {
    const token = ++request.current;
    setBusy(true); setError(""); setReport(null);
    try {
      const result = await http.get<Report>(`/companies/${companyId}/procurement/requisitions/${id}/evaluation`);
      if (token === request.current) setReport(result.data);
    } catch (e) { if (token === request.current) setError(apiError(e, "Unable to evaluate purchase request.")); }
    finally { if (token === request.current) setBusy(false); }
  }
  return <section className="prq-panel"><h2>{tx("Purchase request evaluation")}</h2>
    <p>{tx("Check stock, incoming orders, duplicate requests, transfer alternatives and budget before deciding.")}</p>
    <Button variant="secondary" disabled={busy} onClick={() => void evaluate()}>{tx(busy ? "Evaluating..." : "Evaluate request")}</Button>
    {error && <p role="alert">{tx(error)}</p>}
    {report && <div aria-live="polite"><h3>{tx(labels[report.recommendation] ?? report.recommendation)}</h3>
      <p>{dateTime(report.evaluatedAtUtc)} · {tx("Budget")}: {tx(report.budgetStatus)}</p><p>{report.notice}</p>
      {report.lines.map(line => <section key={line.lines}><h4>{tx("Line")}: {line.lines} · {line.itemName}</h4>
        {line.evaluation.suggestedBaseQuantity !== null && <p>{tx("Sourcing gap")}: {qty(line.evaluation.suggestedBaseQuantity)} {line.unit}</p>}
        <EvaluationFindings evaluation={line.evaluation} />
        {line.availability?.requisitions.map((r, i) => <p key={`${r.id}-${i}`}><Link to={`/companies/${companyId}/procurement/requisitions/${r.id}`}>{r.reference}</Link></p>)}
        {line.availability?.transferable.map(t => <p key={t.locationId}>{t.locationName}: {qty(t.availableBaseQuantity)} {line.unit} {tx("available for transfer review")}</p>)}
      </section>)}
    </div>}
  </section>;
}
