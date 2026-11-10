import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, day, Field, GlDialog } from "../../finance/components/glShared";
import {
  officerApi, type CaseCorrection, type CaseDetail, type CaseListItem, type CaseStatus, type FailureType, type PersonnelDecision, type Responsibility, type ReviewDecision,
} from "../api/officerApi";
import { BranchSelect, EmployeeSelect, EvidenceList, OfficerNav, Section, SeverityChip, toUtcIso, useOfficerRefs, when } from "../components/officerShared";

type Tab = "mine" | "all";
type Step =
  | { kind: "explain"; causes: string; mitigation: string; priorBlockers: string; proposedCorrection: string }
  | { kind: "challenge"; challenge: string; evidence: string }
  | { kind: "data"; resolution: string }
  | { kind: "assess"; responsibility: Responsibility; failureType: FailureType; dependencies: string[]; mitigationReasonable: string; uncertainty: string; note: string }
  | { kind: "review"; decision: ReviewDecision; note: string; responsibility: Responsibility }
  | { kind: "correct"; action: string; ownerEmployeeId: string; due: string; support: string; recoveryMeasure: string; spend: string; policyException: boolean }
  | { kind: "verify"; correction: CaseCorrection; effective: boolean; note: string }
  | { kind: "close" | "withdraw"; outcome: string }
  | { kind: "decide"; decision: PersonnelDecision; note: string };

const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  awaitingExplanation: "Awaiting explanation", awaitingAssessment: "Awaiting assessment", assessed: "Assessed", challenged: "Challenged",
  final: "Final", closed: "Closed", withdrawn: "Withdrawn",
};
const CASE_STATUS_TONE: Record<CaseStatus, "neutral" | "ok" | "warn" | "bad" | "info" | "muted"> = {
  awaitingExplanation: "warn", awaitingAssessment: "info", assessed: "info", challenged: "bad", final: "neutral", closed: "ok", withdrawn: "muted",
};
const RESPONSIBILITY_LABEL: Record<Responsibility, string> = {
  managerControlled: "Within the manager's control", shared: "Shared", externalDependency: "External dependency", insufficientEvidence: "Insufficient evidence",
};
const FAILURE_LABEL: Record<FailureType, string> = { resultMissed: "Result missed", instructionNotFollowed: "Instruction not followed", both: "Both" };
const DECISION_LABEL: Record<PersonnelDecision, string> = {
  noAction: "No action", coaching: "Coaching", formalWarning: "Formal warning", deduction: "Deduction", suspension: "Suspension", termination: "Termination",
};
const CORRECTION_LABEL: Record<CaseCorrection["status"], string> = {
  proposed: "Awaiting approval", instructed: "Instructed", done: "Done, to verify", verified: "Verified", notEffective: "Not effective", cancelled: "Cancelled",
};
const DEPENDENCIES = ["Approval", "Supplier", "Warehouse", "Outage", "Capacity", "Management"];

export default function OfficerCasesPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canManage = useHasPermission("aiops.cases.manage");
  const canReview = useHasPermission("aiops.cases.review");
  const canDecide = useHasPermission("aiops.cases.decide");
  const canSeeAll = canManage || canReview || canDecide;
  const { refs } = useOfficerRefs(canSeeAll ? companyId : "");
  const [tab, setTab] = useState<Tab>("mine");
  const [openOnly, setOpenOnly] = useState(true);
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState<CaseListItem[]>([]);
  const [selected, setSelected] = useState<CaseDetail | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await officerApi.cases(companyId, { mine: tab === "mine", open: openOnly, branchId: tab === "all" ? branchId || undefined : undefined })); setError(null); }
    catch (e) { setError(apiError(e, "Cases could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId, tab, openOnly, branchId]);
  useEffect(() => { void load(); }, [load]);

  async function open(id: string) {
    setError(null);
    try { setSelected(await officerApi.caseDetail(companyId, id)); }
    catch (e) { setError(apiError(e, "The case could not be opened.")); }
  }

  async function run(job: () => Promise<CaseDetail>, fallback: string, message: string) {
    setBusy(true); setError(null);
    try { const c = await job(); setSelected(c); setStep(null); setNotice(message); await load(); }
    catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  function confirm() {
    if (!selected || !step) return;
    const c = selected; const v = c.version;
    switch (step.kind) {
      case "explain": return void run(() => officerApi.caseStep(companyId, c.id, "explain", { causes: step.causes, mitigation: step.mitigation, priorBlockers: step.priorBlockers, proposedCorrection: step.proposedCorrection, version: v }), "The explanation could not be saved.", "Explanation sent.");
      case "challenge": return void run(() => officerApi.caseStep(companyId, c.id, "challenge", { challenge: step.challenge, evidence: step.evidence, version: v }), "The challenge could not be sent.", "Challenge sent to an independent reviewer.");
      case "data": return void run(() => officerApi.caseStep(companyId, c.id, "data", { resolution: step.resolution, version: v }), "The data limitation could not be resolved.", "Data limitation resolved.");
      case "assess": return void run(() => officerApi.caseStep(companyId, c.id, "assess", {
        responsibility: step.responsibility, failureType: step.failureType, dependencies: step.dependencies,
        mitigationReasonable: step.mitigationReasonable === "" ? null : step.mitigationReasonable === "yes", uncertainty: step.uncertainty, note: step.note, version: v,
      }), "The assessment could not be saved.", "Assessed. The responsible person can accept or challenge it.");
      case "review": return void run(() => officerApi.caseStep(companyId, c.id, "review", {
        decision: step.decision, note: step.note, responsibility: step.decision === "amended" ? step.responsibility : null, failureType: null, version: v,
      }), "The review could not be saved.", "Review recorded.");
      case "correct": return void run(() => officerApi.caseStep(companyId, c.id, "corrections", {
        action: step.action, ownerEmployeeId: step.ownerEmployeeId, dueAtUtc: toUtcIso(step.due), support: step.support, recoveryMeasure: step.recoveryMeasure,
        spendAmount: step.spend ? Number(step.spend) : null, policyException: step.policyException,
      }), "The correction could not be set.", "Correction set. It is issued as an instruction under the delegated authority.");
      case "verify": return void run(() => officerApi.verifyCorrection(companyId, c.id, step.correction.id, { effective: step.effective, note: step.note, version: step.correction.version }),
        "The correction could not be verified.", "Correction verified.");
      case "close": return void run(() => officerApi.caseStep(companyId, c.id, "close", { outcome: step.outcome, version: v }), "The case could not be closed.", "Case closed.");
      case "withdraw": return void run(() => officerApi.caseStep(companyId, c.id, "withdraw", { outcome: step.outcome, version: v }), "The case could not be withdrawn.", "Case withdrawn.");
      case "decide": return void run(() => officerApi.caseStep(companyId, c.id, "decisions", { decision: step.decision, note: step.note }), "The decision could not be recorded.", "Decision recorded. Carry it out through HR.");
    }
  }

  function valid(s: Step) {
    switch (s.kind) {
      case "explain": return !!s.causes.trim() && !!s.proposedCorrection.trim();
      case "challenge": return !!s.challenge.trim();
      case "data": return !!s.resolution.trim();
      case "assess": return s.responsibility === "managerControlled" || ((!!s.uncertainty.trim() || !!s.note.trim()) && (s.responsibility === "insufficientEvidence" || s.dependencies.length > 0));
      case "review": return !!s.note.trim();
      case "correct": return !!s.action.trim() && !!s.ownerEmployeeId && !!s.due && !!s.recoveryMeasure.trim();
      case "verify": return !!s.note.trim();
      case "close": case "withdraw": return !!s.outcome.trim();
      case "decide": return !!s.note.trim();
    }
  }

  const c = selected;
  const can = (k: string) => !!c && c.canDo.includes(k);
  return (
    <div className="gl-page">
      <PageHeader title="Accountability Cases"
        subtitle="Formal reviews of confirmed missed targets and instructions not followed: the responsible manager explains, a person assesses who controlled the outcome, challenges go to an independent reviewer, and corrections are verified before closure." />
      <OfficerNav />
      <div className="gl-tabs" role="tablist">
        <Button role="tab" type="button" variant="ghost" className="gl-tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")}>My cases</Button>
        {canSeeAll ? <Button role="tab" type="button" variant="ghost" className="gl-tab" aria-selected={tab === "all"} onClick={() => setTab("all")}>All cases</Button> : null}
      </div>
      <div className="gl-toolbar">
        {tab === "all" ? <Field label="Branch"><BranchSelect value={branchId} onChange={setBranchId} branches={refs.branches} allLabel="All branches" /></Field> : null}
        <Field label="Show">
          <Select value={openOnly ? "open" : "all"} onChange={(e) => setOpenOnly(e.target.value === "open")}>
            <option value="open">Open cases</option>
            <option value="all">All cases</option>
          </Select>
        </Field>
      </div>
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {error && !c ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">Loading cases…</StateMessage> : null}

      <div className="gl-table-wrap">
        <table className="gl-table">
          <thead><tr><th>Case</th><th>Responsible</th><th>Severity</th><th>Status</th><th>Explanation due</th></tr></thead>
          <tbody>
            {!loading && rows.length === 0 ? <tr><td colSpan={5} className="gl-empty">{tab === "mine" ? "No cases for you." : "No cases."}</td></tr> : null}
            {rows.map((r) => (
              <tr key={r.id} className="gl-row" tabIndex={0} onClick={() => void open(r.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void open(r.id); } }}>
                <td>{r.caseNo} · {r.title}<small>{r.branchName}{r.recurrenceNo > 1 ? ` · repeat ${r.recurrenceNo}` : ""}{r.escalated ? " · escalated" : ""}{r.dataLimited ? " · data to resolve" : ""}</small></td>
                <td>{r.subjectName ?? "—"}</td>
                <td><SeverityChip severity={r.severity} /></td>
                <td><Chip tone={CASE_STATUS_TONE[r.status]}>{CASE_STATUS_LABEL[r.status]}</Chip></td>
                <td>{r.status === "awaitingExplanation" ? <>{when(r.explanationDueUtc)}{r.explanationOverdue ? <small>Overdue</small> : null}</> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {c && !step ? (
        <GlDialog open size="wide" title={`${c.caseNo} · ${c.title}`} confirmText="" closeText="Close" busy={busy} error={error} onClose={() => { setSelected(null); setError(null); }}
          actions={<>
            {can("explain") ? <Button type="button" onClick={() => setStep({ kind: "explain", causes: "", mitigation: "", priorBlockers: "", proposedCorrection: "" })}>Explain</Button> : null}
            {can("accept") ? <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => officerApi.acceptCase(companyId, c.id, c.version), "The assessment could not be accepted.", "Assessment accepted.")}>Accept assessment</Button> : null}
            {can("challenge") ? <Button type="button" variant="outline" onClick={() => setStep({ kind: "challenge", challenge: "", evidence: "" })}>Challenge</Button> : null}
            {can("resolveData") ? <Button type="button" variant="outline" onClick={() => setStep({ kind: "data", resolution: "" })}>Resolve data</Button> : null}
            {can("assess") ? <Button type="button" onClick={() => setStep({
              kind: "assess", responsibility: c.suggestion?.responsibility ?? "managerControlled", failureType: c.suggestion?.failureType ?? "resultMissed",
              dependencies: c.suggestion?.dependencies ?? [], mitigationReasonable: c.suggestion?.mitigationReasonable == null ? "" : c.suggestion.mitigationReasonable ? "yes" : "no",
              uncertainty: "", note: "",
            })}>Assess</Button> : null}
            {can("review") ? <Button type="button" onClick={() => setStep({ kind: "review", decision: "upheld", note: "", responsibility: c.responsibility ?? "shared" })}>Review challenge</Button> : null}
            {can("correct") ? <Button type="button" variant="outline" onClick={() => setStep({ kind: "correct", action: c.proposedCorrection ?? "", ownerEmployeeId: c.subjectEmployeeId, due: "", support: "", recoveryMeasure: "", spend: "", policyException: false })}>Add correction</Button> : null}
            {can("decide") ? <Button type="button" variant="outline" onClick={() => setStep({ kind: "decide", decision: "noAction", note: "" })}>Record decision</Button> : null}
            {can("close") ? <Button type="button" onClick={() => setStep({ kind: "close", outcome: "" })}>Close case</Button> : null}
            {can("withdraw") ? <Button type="button" variant="outline" onClick={() => setStep({ kind: "withdraw", outcome: "" })}>Withdraw</Button> : null}
          </>}>
          <div className="gl-chip-row" data-testid="case-status">
            <Chip tone={CASE_STATUS_TONE[c.status]}>{CASE_STATUS_LABEL[c.status]}</Chip>
            <SeverityChip severity={c.severity} />
            {c.recurrenceNo > 1 ? <Chip tone="warn">Repeat {c.recurrenceNo}</Chip> : null}
            {c.escalatedAtUtc || c.nonResponseEscalatedAtUtc ? <Chip tone="bad">Escalated{c.escalatedToName ? ` to ${c.escalatedToName}` : ""}</Chip> : null}
          </div>
          {c.isMine && c.status === "awaitingExplanation" ? <StateMessage tone="warning">Please explain by {when(c.explanationDueUtc)}: the causes, what you did to limit the impact, any earlier blockers, and the correction you propose.</StateMessage> : null}
          {c.dataLimitation && !c.dataResolvedAtUtc ? <StateMessage tone="warning">Data limitation: {c.dataLimitation} No finding against the manager is made until this is resolved.</StateMessage> : null}
          <dl className="gl-detail">
            <div><dt>Responsible</dt><dd>{c.subjectName}{c.departmentName ? ` · ${c.departmentName}` : ""} · {c.branchName}</dd></div>
            {c.expected != null ? <div><dt>Expected / actual</dt><dd>{c.expected.toLocaleString()} / {c.actual?.toLocaleString() ?? "—"}{c.periodStart ? ` (${day(c.periodStart)}${c.periodEnd && c.periodEnd !== c.periodStart ? ` – ${day(c.periodEnd)}` : ""})` : ""}</dd></div> : null}
            {c.dueAtUtc ? <div><dt>Instruction deadline</dt><dd>{when(c.dueAtUtc)}</dd></div> : null}
            <div><dt>Opened</dt><dd>{when(c.openedAtUtc)} by {c.openedByName}</dd></div>
            {c.escalationReason ? <div><dt>Escalation</dt><dd>{c.escalationReason}</dd></div> : null}
          </dl>
          <p>{c.summary}</p>
          <Section title="Results, instructions and evidence"><EvidenceList items={c.evidence} /></Section>

          {c.explainedAtUtc ? (
            <Section title="Explanation" hint={`${c.explainedByName} · ${when(c.explainedAtUtc)}`}>
              <dl className="gl-detail">
                <div><dt>Causes</dt><dd>{c.causes}</dd></div>
                {c.mitigation ? <div><dt>Mitigation</dt><dd>{c.mitigation}</dd></div> : null}
                {c.priorBlockers ? <div><dt>Earlier blockers</dt><dd>{c.priorBlockers}</dd></div> : null}
                <div><dt>Proposed correction</dt><dd>{c.proposedCorrection}</dd></div>
              </dl>
            </Section>
          ) : c.nonResponseEscalatedAtUtc ? <StateMessage tone="error">No explanation was given by {when(c.explanationDueUtc)}; this was escalated separately.</StateMessage> : null}

          {c.suggestion && !c.assessedAtUtc && !c.isMine ? (
            <Section title="The officer's suggestion" hint="From the records; a person assesses.">
              <p data-testid="case-suggestion"><strong>{RESPONSIBILITY_LABEL[c.suggestion.responsibility]}</strong> · {FAILURE_LABEL[c.suggestion.failureType]}{c.suggestion.dependencies.length ? ` · dependencies: ${c.suggestion.dependencies.join(", ")}` : ""}</p>
              <ul className="oo-evidence">{c.suggestion.reasons.map((r) => <li key={r}><span>{r}</span></li>)}</ul>
            </Section>
          ) : null}

          {c.responsibility ? (
            <Section title="Assessment" hint={`${c.assessedByName ?? ""} · ${when(c.assessedAtUtc)}${c.status === "assessed" && c.challengeByUtc ? ` · can be challenged until ${when(c.challengeByUtc)}` : ""}`}>
              <p data-testid="case-assessment"><strong>{RESPONSIBILITY_LABEL[c.responsibility]}</strong>{c.failureType ? ` · ${FAILURE_LABEL[c.failureType]}` : ""}{c.dependencies.length ? ` · dependencies: ${c.dependencies.join(", ")}` : ""}
                {c.mitigationReasonable != null ? ` · mitigation ${c.mitigationReasonable ? "reasonable" : "not reasonable"}` : ""}</p>
              {c.uncertainty ? <p className="gl-note">Uncertainty: {c.uncertainty}</p> : null}
              {c.assessmentNote ? <p>{c.assessmentNote}</p> : null}
              {c.challenge ? <p><strong>Challenge:</strong> {c.challenge}{c.challengeEvidence ? ` (evidence: ${c.challengeEvidence})` : ""}</p> : null}
              {c.reviewDecision ? <p><strong>Review ({c.reviewDecision}):</strong> {c.reviewNote} — {c.reviewedByName}, {when(c.reviewedAtUtc)}</p> : null}
            </Section>
          ) : null}

          {c.corrections.length > 0 ? (
            <Section title="Corrections">
              <table className="gl-table">
                <thead><tr><th>Action</th><th>Owner</th><th>Deadline</th><th>Recovery measure</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {c.corrections.map((x) => (
                    <tr key={x.id}>
                      <td>{x.action}{x.support ? <small>Support: {x.support}</small> : null}{x.spendAmount ? <small>Spending {x.spendAmount.toLocaleString()}{x.policyException ? " · policy exception" : ""}</small> : null}</td>
                      <td>{x.ownerName}</td>
                      <td>{when(x.dueAtUtc)}</td>
                      <td>{x.recoveryMeasure}{x.verificationNote ? <small>{x.verificationNote}</small> : null}</td>
                      <td><Chip tone={x.status === "verified" ? "ok" : x.status === "notEffective" || x.status === "cancelled" ? "bad" : "info"}>{CORRECTION_LABEL[x.status]}</Chip>{x.status === "proposed" && x.authorityNote ? <small>{x.authorityNote}</small> : null}</td>
                      <td>{x.status === "done" && can("correct") ? <Button type="button" variant="outline" onClick={() => setStep({ kind: "verify", correction: x, effective: true, note: "" })}>Verify</Button> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          {c.recommendation ? <p className="gl-note">Officer's recommendation (a person decides): {c.recommendation}</p> : null}
          {c.decisions.length > 0 ? (
            <Section title="Personnel decisions" hint="Taken and carried out by people through HR.">
              <ul className="oo-evidence">{c.decisions.map((d) => <li key={d.decidedAtUtc}><strong>{DECISION_LABEL[d.decision]}</strong><span>{d.note} — {d.decidedByName}, {when(d.decidedAtUtc)}</span></li>)}</ul>
            </Section>
          ) : null}
          {c.outcome ? <Section title="Outcome"><p>{c.outcome}</p></Section> : null}
          <Section title="History">
            <ul className="oo-evidence">{c.events.map((e, i) => <li key={`${e.atUtc}-${i}`}><span className="oo-evidence-type">{e.event}</span><span>{e.note ?? ""} — {e.actorName}, {when(e.atUtc)}</span></li>)}</ul>
          </Section>
        </GlDialog>
      ) : null}

      {c && step ? (
        <GlDialog open title={STEP_TITLE[step.kind]} busy={busy} error={error} onClose={() => { setStep(null); setError(null); }} confirmText="Save" confirmDisabled={!valid(step)} onConfirm={confirm}
          danger={step.kind === "withdraw"}>
          {step.kind === "explain" ? <>
            <Field label="Causes"><Textarea rows={3} value={step.causes} onChange={(e) => setStep({ ...step, causes: e.target.value })} /></Field>
            <Field label="What you did to limit the impact"><Textarea rows={2} value={step.mitigation} onChange={(e) => setStep({ ...step, mitigation: e.target.value })} /></Field>
            <Field label="Blockers reported earlier"><Textarea rows={2} value={step.priorBlockers} onChange={(e) => setStep({ ...step, priorBlockers: e.target.value })} /></Field>
            <Field label="Correction you propose"><Textarea rows={2} value={step.proposedCorrection} onChange={(e) => setStep({ ...step, proposedCorrection: e.target.value })} /></Field>
          </> : null}
          {step.kind === "challenge" ? <>
            <Field label="What is wrong with the assessment"><Textarea rows={3} value={step.challenge} onChange={(e) => setStep({ ...step, challenge: e.target.value })} /></Field>
            <Field label="Additional evidence"><Textarea rows={2} value={step.evidence} onChange={(e) => setStep({ ...step, evidence: e.target.value })} /></Field>
          </> : null}
          {step.kind === "data" ? <Field label="How the data limitation was resolved"><Textarea rows={3} value={step.resolution} onChange={(e) => setStep({ ...step, resolution: e.target.value })} /></Field> : null}
          {step.kind === "assess" ? <>
            <Field label="Who controlled the outcome">
              <Select value={step.responsibility} onChange={(e) => setStep({ ...step, responsibility: e.target.value as Responsibility })}>
                {(Object.keys(RESPONSIBILITY_LABEL) as Responsibility[]).map((r) => <option key={r} value={r}>{RESPONSIBILITY_LABEL[r]}</option>)}
              </Select>
            </Field>
            <Field label="What failed">
              <Select value={step.failureType} onChange={(e) => setStep({ ...step, failureType: e.target.value as FailureType })}>
                {(Object.keys(FAILURE_LABEL) as FailureType[]).map((r) => <option key={r} value={r}>{FAILURE_LABEL[r]}</option>)}
              </Select>
            </Field>
            <fieldset className="gl-field gl-field--wide">
              <legend>Dependencies</legend>
              <div className="gl-chip-row">
                {DEPENDENCIES.map((d) => (
                  <label key={d} className="gl-check"><Checkbox checked={step.dependencies.includes(d)}
                    onChange={(e) => setStep({ ...step, dependencies: e.target.checked ? [...step.dependencies, d] : step.dependencies.filter((x) => x !== d) })} /> {d}</label>
                ))}
              </div>
            </fieldset>
            <Field label="Mitigation">
              <Select value={step.mitigationReasonable} onChange={(e) => setStep({ ...step, mitigationReasonable: e.target.value })}>
                <option value="">Not assessed</option><option value="yes">Reasonable</option><option value="no">Not reasonable</option>
              </Select>
            </Field>
            <Field label="Uncertainty and evidence relied on"><Textarea rows={2} value={step.uncertainty} onChange={(e) => setStep({ ...step, uncertainty: e.target.value })} /></Field>
            <Field label="Assessment note"><Textarea rows={2} value={step.note} onChange={(e) => setStep({ ...step, note: e.target.value })} /></Field>
          </> : null}
          {step.kind === "review" ? <>
            <Field label="Decision">
              <Select value={step.decision} onChange={(e) => setStep({ ...step, decision: e.target.value as ReviewDecision })}>
                <option value="upheld">Uphold the assessment</option><option value="amended">Amend it</option><option value="withdrawn">Withdraw the case</option>
              </Select>
            </Field>
            {step.decision === "amended" ? <Field label="Amended responsibility">
              <Select value={step.responsibility} onChange={(e) => setStep({ ...step, responsibility: e.target.value as Responsibility })}>
                {(Object.keys(RESPONSIBILITY_LABEL) as Responsibility[]).map((r) => <option key={r} value={r}>{RESPONSIBILITY_LABEL[r]}</option>)}
              </Select>
            </Field> : null}
            <Field label="Reasons"><Textarea rows={3} value={step.note} onChange={(e) => setStep({ ...step, note: e.target.value })} /></Field>
          </> : null}
          {step.kind === "correct" ? <>
            <Field label="Corrective action"><Textarea rows={2} value={step.action} onChange={(e) => setStep({ ...step, action: e.target.value })} /></Field>
            <Field label="Owner"><EmployeeSelect value={step.ownerEmployeeId} onChange={(v) => setStep({ ...step, ownerEmployeeId: v })} employees={refs.employees} branchId={c.branchId} placeholder="Choose a person" /></Field>
            <Field label="Deadline"><Input type="datetime-local" value={step.due} onChange={(e) => setStep({ ...step, due: e.target.value })} /></Field>
            <Field label="Support given"><Input value={step.support} onChange={(e) => setStep({ ...step, support: e.target.value })} /></Field>
            <Field label="Recovery measure"><Input value={step.recoveryMeasure} onChange={(e) => setStep({ ...step, recoveryMeasure: e.target.value })} /></Field>
            <Field label="Spending needed" hint="Spending or a policy exception routes the correction for approval."><Input type="number" min="0" value={step.spend} onChange={(e) => setStep({ ...step, spend: e.target.value })} /></Field>
            <label className="gl-check"><Checkbox checked={step.policyException} onChange={(e) => setStep({ ...step, policyException: e.target.checked })} /> Needs a policy exception</label>
          </> : null}
          {step.kind === "verify" ? <>
            <p>{step.correction.action} — recovery measure: {step.correction.recoveryMeasure}</p>
            <Field label="Result">
              <Select value={step.effective ? "yes" : "no"} onChange={(e) => setStep({ ...step, effective: e.target.value === "yes" })}>
                <option value="yes">Effective</option><option value="no">Not effective</option>
              </Select>
            </Field>
            <Field label="What the recovery measure shows"><Textarea rows={2} value={step.note} onChange={(e) => setStep({ ...step, note: e.target.value })} /></Field>
          </> : null}
          {step.kind === "close" || step.kind === "withdraw" ? <Field label={step.kind === "close" ? "Outcome reviewed" : "Why the case is withdrawn"}><Textarea rows={3} value={step.outcome} onChange={(e) => setStep({ ...step, outcome: e.target.value })} /></Field> : null}
          {step.kind === "decide" ? <>
            <StateMessage>Personnel decisions are taken by you and carried out through HR. The officer records them; it does not change HR or payroll.</StateMessage>
            <Field label="Decision">
              <Select value={step.decision} onChange={(e) => setStep({ ...step, decision: e.target.value as PersonnelDecision })}>
                {(Object.keys(DECISION_LABEL) as PersonnelDecision[]).map((d) => <option key={d} value={d}>{DECISION_LABEL[d]}</option>)}
              </Select>
            </Field>
            <Field label="Reasons and HR reference"><Textarea rows={3} value={step.note} onChange={(e) => setStep({ ...step, note: e.target.value })} /></Field>
          </> : null}
        </GlDialog>
      ) : null}
    </div>
  );
}

const STEP_TITLE: Record<Step["kind"], string> = {
  explain: "Explain the case", challenge: "Challenge the assessment", data: "Resolve the data limitation", assess: "Assess responsibility", review: "Review the challenge",
  correct: "Add a correction", verify: "Verify the correction", close: "Close the case", withdraw: "Withdraw the case", decide: "Record a personnel decision",
};
