import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, day, Field, GlDialog } from "../../finance/components/glShared";
import { officerApi, type ScoreComponent, type Scorecard } from "../api/officerApi";
import { BranchSelect, OfficerNav, Section, useOfficerRefs, when } from "../components/officerShared";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const pct = (v?: number | null) => (v == null ? "—" : `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`);

export default function OfficerScorecardsPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canViewAll = useHasPermission("aiops.scorecards.view");
  const { refs } = useOfficerRefs(canViewAll ? companyId : "");
  const yesterday = new Date(Date.now() - 86400000);
  const [from, setFrom] = useState(iso(new Date(yesterday.getFullYear(), yesterday.getMonth(), 1)));
  const [to, setTo] = useState(iso(yesterday));
  const [branchId, setBranchId] = useState("");
  const [cards, setCards] = useState<Scorecard[]>([]);
  const [detail, setDetail] = useState<{ card: Scorecard; component: ScoreComponent } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCards(await officerApi.scorecards(companyId, { from, to, branchId: branchId || undefined })); setError(null); }
    catch (e) { setError(apiError(e, "Scorecards could not be calculated.")); setCards([]); }
    finally { setLoading(false); }
  }, [companyId, from, to, branchId]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="gl-page">
      <PageHeader title="Manager Scorecards"
        subtitle="Branch and department scorecards from the records: target achievement, instruction compliance, reporting timeliness and correction completion, each shown separately with its items. Weights are the approved settings." />
      <OfficerNav />
      <div className="gl-toolbar">
        <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        {canViewAll ? <Field label="Branch"><BranchSelect value={branchId} onChange={setBranchId} branches={refs.branches} allLabel="All branches" /></Field> : null}
      </div>
      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">Calculating scorecards…</StateMessage> : null}
      {!loading && !error && cards.length === 0 ? <StateMessage>No scorecard for this selection.</StateMessage> : null}

      {cards.map((card) => (
        <Section key={`${card.branchId}-${card.departmentId ?? ""}`} title={`${card.branchName ?? "Branch"}${card.departmentName ? ` · ${card.departmentName}` : ""}`}
          hint={`${card.subjectName ?? "No responsible manager"} · ${day(card.from)} – ${day(card.to)}`}>
          <div data-testid="scorecard" className="gl-stack">
            <div className="gl-chip-row">
              {card.withheld
                ? <Chip tone="warn">Overall withheld</Chip>
                : <span className="oo-score" aria-label="Overall score">{pct(card.overall)}</span>}
              {card.disputes > 0 ? <Chip tone="bad">{card.disputes} disputed</Chip> : null}
            </div>
            {card.withheld && card.withheldReason ? <StateMessage tone="warning">Personnel assessment withheld until review: {card.withheldReason}</StateMessage> : null}
            <div className="oo-components">
              {card.components.map((c) => (
                <article key={c.key} className="oo-card">
                  <div className="oo-card-head">
                    <h3>{c.label}</h3>
                    <Chip tone="muted">Weight {c.weight}</Chip>
                  </div>
                  <p><strong>{c.rated ? pct(c.score) : "Not rated"}</strong> · {c.met} of {c.counted} counted{!c.rated ? " (too few items)" : ""}</p>
                  <Button type="button" variant="outline" onClick={() => setDetail({ card, component: c })}>Items and rule</Button>
                </article>
              ))}
            </div>
            <ul className="oo-evidence">
              {card.context.map((x) => <li key={x}><span>{x}</span></li>)}
              <li><span className="oo-evidence-type">Calculation</span><span>{card.calculation}</span></li>
              <li><span className="oo-evidence-type">Calculated</span><span>{when(card.calculatedAtUtc)}</span></li>
            </ul>
          </div>
        </Section>
      ))}

      {detail ? (
        <GlDialog open size="wide" title={`${detail.component.label} · ${detail.card.branchName ?? ""}`} confirmText="" closeText="Close" onClose={() => setDetail(null)}>
          <p className="gl-note">{detail.component.rule}</p>
          {detail.component.notes.map((n) => <StateMessage key={n}>{n}</StateMessage>)}
          <div className="gl-table-wrap">
            <table className="gl-table" data-testid="score-items">
              <thead><tr><th>Item</th><th>Due</th><th>Result</th><th>Counts as</th></tr></thead>
              <tbody>
                {detail.component.items.length === 0 ? <tr><td colSpan={4} className="gl-empty">No items in the period.</td></tr> : null}
                {detail.component.items.map((i, n) => (
                  <tr key={`${i.id ?? n}-${n}`}>
                    <td>{i.label}<small>{i.type}</small></td>
                    <td>{i.dueAtUtc ? when(i.dueAtUtc) : "—"}</td>
                    <td>{i.result}</td>
                    <td>{i.met == null ? <Chip tone="muted">Not counted</Chip> : i.met ? <Chip tone="ok">Met</Chip> : <Chip tone="bad">Missed</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlDialog>
      ) : null}
    </div>
  );
}
