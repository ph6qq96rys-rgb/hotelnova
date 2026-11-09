import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Select } from "../../../components/ui/select";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, day, Field } from "../../finance/components/glShared";
import { officerApi, type Briefing, type BriefingListItem, type Finding } from "../api/officerApi";
import {
  ACTION_STATUS_LABEL, ACTION_STATUS_TONE, BranchSelect, EvidenceList, INSTRUCTION_STATUS_LABEL, KIND_LABEL, metricValue, OfficerNav, PROGRESS_LABEL, PROGRESS_TONE, Section,
  SeverityChip, TARGET_STATUS_LABEL, useOfficerRefs, when,
} from "../components/officerShared";

function FindingCard({ f }: { f: Finding }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="oo-card">
      <div className="oo-card-head">
        <Button type="button" variant="ghost" className="oo-card-title" aria-expanded={open} onClick={() => setOpen(!open)}>{f.title}</Button>
        <div className="gl-chip-row"><SeverityChip severity={f.severity} /><Chip tone="muted">{KIND_LABEL[f.kind]}</Chip>
          {f.kind === "forecastRisk" ? <Chip tone="info">Estimate</Chip> : f.kind === "actualMiss" || f.evidenceQuality === "strong" ? <Chip tone="ok">Verified from records</Chip> : <Chip tone="warn">Partial evidence</Chip>}</div>
      </div>
      <div className="oo-meta">
        <span>{f.branchName ?? "Company"}</span>
        <span>Owner: {f.ownerName ?? f.ownerRole ?? "not assigned"}</span>
        {f.periodStart ? <span>Period {day(f.periodStart)}{f.periodEnd && f.periodEnd !== f.periodStart ? ` – ${day(f.periodEnd)}` : ""}</span> : null}
        <span>Data as of {when(f.dataAsOfUtc)}</span>
      </div>
      {open ? <><p>{f.detail}</p><EvidenceList items={f.evidence} /></> : null}
    </article>
  );
}

export default function OfficerBriefingPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canSeeCompany = useHasPermission("aiops.view.company");
  const { refs, loaded } = useOfficerRefs(companyId);
  const [branchId, setBranchId] = useState<string>("");
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [history, setHistory] = useState<BriefingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Branch users start on their first branch; company leaders on the consolidated view.
  useEffect(() => {
    if (loaded && !canSeeCompany && !branchId && refs.branches.length > 0) setBranchId(refs.branches[0].id);
  }, [loaded, canSeeCompany, branchId, refs.branches]);

  const scope = branchId || undefined;
  const load = useCallback(async () => {
    if (!canSeeCompany && !scope) return;
    setLoading(true);
    try {
      const [b, h] = await Promise.all([officerApi.briefing(companyId, scope), officerApi.briefings(companyId, scope, 14).catch(() => [])]);
      setBriefing(b); setHistory(h); setError(null);
    } catch (e) { setError(apiError(e, "The briefing could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId, scope, canSeeCompany]);
  useEffect(() => { void load(); }, [load]);

  async function prepare() {
    setBusy(true); setError(null);
    try { setBriefing(await officerApi.prepareBriefing(companyId, scope)); setHistory(await officerApi.briefings(companyId, scope, 14)); }
    catch (e) { setError(apiError(e, "The briefing could not be prepared.")); }
    finally { setBusy(false); }
  }

  async function openStored(id: string) {
    if (!id) { void load(); return; }
    setBusy(true);
    try { setBriefing(await officerApi.storedBriefing(companyId, id)); setError(null); }
    catch (e) { setError(apiError(e, "That briefing could not be opened.")); }
    finally { setBusy(false); }
  }

  const branchName = useMemo(() => Object.fromEntries(refs.branches.map((b) => [b.id, b.name])), [refs.branches]);

  return (
    <div className="gl-page">
      <PageHeader title="Operations Officer" subtitle="Today's priorities, target progress and decisions waiting for you. Every item links to its evidence and owner." />
      <OfficerNav />
      <div className="gl-toolbar">
        <Field label="Briefing for">
          <BranchSelect value={branchId} onChange={setBranchId} branches={refs.branches} allLabel={canSeeCompany ? "Whole company" : undefined} />
        </Field>
        <Field label="Earlier briefings">
          <Select value={briefing?.id && history.some((h) => h.id === briefing.id) ? briefing.id : ""} onChange={(e) => void openStored(e.target.value)}>
            <option value="">Latest</option>
            {history.map((h) => <option key={h.id} value={h.id}>{day(h.businessDate)} · {when(h.generatedAtUtc)}</option>)}
          </Select>
        </Field>
        <span className="gl-spacer" />
        <Button variant="outline" onClick={() => void prepare()} disabled={busy || loading}><RefreshCw size={16} /> Prepare now</Button>
      </div>

      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading && !briefing ? <StateMessage tone="loading">Preparing the briefing…</StateMessage> : null}

      {briefing ? (
        <>
          {briefing.notes.length ? <div className="gl-note gl-note--warn">{briefing.notes.map((n) => <div key={n}>{n}</div>)}</div> : null}
          <p className="gl-muted">
            {briefing.scopeName} · {day(briefing.businessDate)} · prepared {when(briefing.generatedAtUtc)} · data as of {when(briefing.dataAsOfUtc)}
            {briefing.dataStale ? " · may be out of date" : ""} · authority policy v{briefing.policyVersion}
          </p>

          {briefing.narrative ? (
            <Section title="Summary" hint={`Written by ${briefing.modelVersion ?? "the model"} from the figures below. Check the figures before acting.`}>
              <p className="oo-narrative">{briefing.narrative}</p>
            </Section>
          ) : null}

          {briefing.branches.length > 1 ? (
            <Section title="Branches">
              <div className="gl-table-wrap">
                <table className="gl-table">
                  <thead><tr><th>Branch</th><th className="gl-num">Critical</th><th className="gl-num">High</th><th className="gl-num">Open findings</th><th className="gl-num">Targets at risk</th><th className="gl-num">Missed last period</th><th /></tr></thead>
                  <tbody>
                    {briefing.branches.map((b) => (
                      <tr key={b.branchId}>
                        <td>{b.branchName}</td>
                        <td className="gl-num">{b.critical || ""}</td><td className="gl-num">{b.high || ""}</td><td className="gl-num">{b.open}</td>
                        <td className="gl-num">{b.targetsAtRisk || ""}</td><td className="gl-num">{b.targetsMissed || ""}</td>
                        <td className="gl-actions"><Button size="sm" variant="ghost" onClick={() => setBranchId(b.branchId)}>Open</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          <div className="oo-two">
            <Section title="Priorities" hint="Ranked by urgency, impact and how strong the evidence is. Open one to see why and the records behind it.">
              {briefing.priorities.length === 0 ? <p className="gl-muted">Nothing needs attention.</p> : (
                <div className="oo-cards">{briefing.priorities.map((f) => <FindingCard key={f.id} f={f} />)}</div>
              )}
            </Section>

            <Section title="Decisions waiting" hint="Officer actions and targets that need a person's decision.">
              {briefing.decisions.length === 0 && briefing.targetsAwaitingApproval.length === 0 ? <p className="gl-muted">No decision is waiting.</p> : (
                <div className="oo-cards">
                  {briefing.decisions.map((a) => (
                    <article key={a.id} className="oo-card">
                      <div className="oo-card-head"><h3>{a.title}</h3><Chip tone={ACTION_STATUS_TONE[a.status]}>{ACTION_STATUS_LABEL[a.status]}</Chip></div>
                      <div className="oo-meta"><span>{a.branchName ?? "Company"}</span><span>{a.actionLabel}</span><span>{when(a.requestedAtUtc)}</span></div>
                      {a.authorityNote ? <p className="gl-muted">{a.authorityNote}</p> : null}
                    </article>
                  ))}
                  {briefing.targetsAwaitingApproval.map((t) => (
                    <article key={t.id} className="oo-card">
                      <div className="oo-card-head"><h3>Target: {t.name}{t.versionNo > 1 ? ` (amendment v${t.versionNo})` : ""}</h3><Chip tone="warn">{TARGET_STATUS_LABEL[t.status]}</Chip></div>
                      <div className="oo-meta"><span>{t.branchName ?? "Company"}</span><span>{t.metricLabel} {t.direction === "atLeast" ? "≥" : "≤"} {metricValue(t.unit, t.targetValue)}</span><span>from {day(t.startDate)}</span></div>
                    </article>
                  ))}
                </div>
              )}
            </Section>
          </div>

          <Section title="Targets" hint="Recorded results so far, an estimate of where the period ends, and the verified result of the last completed period.">
            {briefing.targets.length === 0 ? <p className="gl-muted">No active target covers today.</p> : (
              <div className="gl-table-wrap">
                <table className="gl-table">
                  <thead><tr><th>Target</th><th>Branch</th><th>Period</th><th className="gl-num">So far <span className="oo-basis">recorded</span></th><th className="gl-num">Projected <span className="oo-basis">estimate</span></th><th className="gl-num">Target</th><th>Status</th><th>Last period <span className="oo-basis">verified</span></th></tr></thead>
                  <tbody>
                    {briefing.targets.map((t) => (
                      <tr key={t.targetId}>
                        <td>{t.name}<small>{t.accountableName ?? t.accountableRole}</small></td>
                        <td>{t.branchName ?? (t.branchId ? branchName[t.branchId] : "Company")}</td>
                        <td>{day(t.periodStart)}{t.periodEnd !== t.periodStart ? ` – ${day(t.periodEnd)}` : ""}</td>
                        <td className="gl-num">{metricValue(t.unit, t.value)}</td>
                        <td className="gl-num">{metricValue(t.unit, t.projected)}</td>
                        <td className="gl-num">{t.direction === "atLeast" ? "≥ " : "≤ "}{metricValue(t.unit, t.targetValue)}</td>
                        <td><Chip tone={PROGRESS_TONE[t.status]}>{PROGRESS_LABEL[t.status]}</Chip>{t.limitations.length ? <small>{t.limitations.join(" ")}</small> : null}</td>
                        <td>{t.lastStatus ? <><Chip tone={PROGRESS_TONE[t.lastStatus]}>{PROGRESS_LABEL[t.lastStatus]}</Chip><small>{metricValue(t.unit, t.lastValue)}</small></> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {(briefing.overdueInstructions?.length ?? 0) > 0 || (briefing.blockers?.length ?? 0) > 0 ? (
            <div className="oo-two">
              <Section title="Instructions behind schedule" hint="Mandatory instructions past their deadline or not acknowledged in time.">
                {(briefing.overdueInstructions ?? []).length === 0 ? <p className="gl-muted">Every instruction is on time.</p> : (
                  <div className="oo-cards">{(briefing.overdueInstructions ?? []).map((i) => (
                    <article key={i.id} className="oo-card">
                      <div className="oo-card-head"><h3>{i.title}</h3><Chip tone={i.overdue ? "bad" : "warn"}>{i.overdue ? "Overdue" : "Not acknowledged"}</Chip></div>
                      <div className="oo-meta"><span>{i.ownerName ?? "Owner"}</span><span>Due {when(i.dueAtUtc)}</span><span>{INSTRUCTION_STATUS_LABEL[i.status]}</span>{i.escalatedAtUtc ? <span>Escalated</span> : null}</div>
                    </article>))}</div>
                )}
              </Section>
              <Section title="Blockers" hint="Reported obstacles waiting for help. Deadlines stay unless an exception is approved.">
                {(briefing.blockers ?? []).length === 0 ? <p className="gl-muted">No open blockers.</p> : (
                  <div className="oo-cards">{(briefing.blockers ?? []).map((b) => (
                    <article key={b.id} className="oo-card">
                      <div className="oo-card-head"><h3>{b.cause}</h3><Chip tone={b.status === "escalated" ? "bad" : "warn"}>{b.status === "escalated" ? "Escalated" : "Open"}</Chip></div>
                      <div className="oo-meta"><span>Reported by {b.reportedByName}, {when(b.reportedAtUtc)}</span><span>With {b.assignedName ?? b.assignedRole}</span></div>
                      {b.assistanceRequired ? <p>Help needed: {b.assistanceRequired}</p> : null}
                    </article>))}</div>
                )}
              </Section>
            </div>
          ) : null}

          <div className="oo-two">
            <Section title="Not acknowledged for over a day">
              {briefing.unacknowledged.length === 0 ? <p className="gl-muted">Every serious finding has been picked up.</p> : (
                <div className="oo-cards">{briefing.unacknowledged.map((f) => <FindingCard key={f.id} f={f} />)}</div>
              )}
            </Section>
            <Section title="Coming up" hint="Catering events in the next 7 days and deliveries due in the next 2 days.">
              {briefing.upcoming.length === 0 ? <p className="gl-muted">Nothing scheduled.</p> : (
                <ul className="oo-evidence">
                  {briefing.upcoming.map((u) => (
                    <li key={`${u.type}-${u.id}`}><span className="oo-evidence-type">{u.type === "CateringEvent" ? "Event" : "Delivery"}</span><strong>{u.reference}</strong><span>{u.label} · {when(u.dueUtc)}{u.branchName ? ` · ${u.branchName}` : ""}</span></li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {briefing.dataQuality.length || briefing.configuration.length ? (
            <Section title="Data gaps and set-up" hint="The officer draws no conclusion from incomplete data; fix these so it can.">
              <div className="oo-cards">
                {briefing.dataQuality.map((f) => <FindingCard key={f.id} f={f} />)}
                {briefing.configuration.map((c) => (
                  <div key={c.message} className={c.severity === "Error" ? "gl-note gl-note--bad" : "gl-note gl-note--warn"}>{c.message}</div>
                ))}
              </div>
            </Section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
