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
import { apiError, Chip, Field, GlDialog } from "../../finance/components/glShared";
import {
  officerApi, type ChangeKind, type DecisionOutcome, type Finding, type Instruction, type MilestoneCategory, type MilestoneStage, type Review, type ReviewClassification,
  type ReviewCommitment, type ReviewEntry, type ReviewKind, type ReviewListItem, type ReviewMilestone, type ReviewRole,
} from "../api/officerApi";
import { BranchSelect, EmployeeSelect, EvidenceList, OfficerNav, Section, toUtcIso, useOfficerRefs, when } from "../components/officerShared";

type Tab = "mine" | "all";
type OptionDraft = { label: string; description: string; expectedImpact: string; evidence: string; value: string; contractual: boolean; recommended: boolean };
type Draft = {
  kind: ReviewKind; decisionMakerEmployeeId: string; decisionDue: string; options: OptionDraft[];
  branchId: string; title: string; purpose: string; expectedOutcome: string; language: "en" | "am"; links: string[];
  participants: { employeeId: string; role: ReviewRole; responsibility: string; restricted: boolean }[];
};
type Step =
  | { kind: "post"; replyTo?: ReviewEntry; amends?: ReviewEntry; text: string; evidence: string }
  | { kind: "commit"; ownerEmployeeId: string; deliverable: string; due: string; dependencies: string; requiredEvidence: string; type: "agreed" | "instruction" }
  | { kind: "respond"; commitment: ReviewCommitment; confirm: boolean; constraint: string }
  | { kind: "deadline"; commitment: ReviewCommitment; due: string; reason: string }
  | { kind: "humanReview" | "amend"; text: string }
  | { kind: "decide"; outcome: DecisionOutcome; optionId: string; note: string }
  | { kind: "milestone"; category: MilestoneCategory; title: string; ownerEmployeeId: string; due: string; dependencies: string; acceptanceEvidence: string; targetStage: MilestoneStage }
  | { kind: "claim" | "verify"; milestone: ReviewMilestone; stage: MilestoneStage; text: string }
  | { kind: "change"; changeKind: ChangeKind; description: string; reason: string; value: string }
  | { kind: "responsibility" | "privateNote"; employeeId: string; text: string }
  | { kind: "authorize"; parties: string; channel: string }
  | { kind: "external"; party: string; text: string };

const KIND_LABEL: Record<ReviewKind, string> = {
  operational: "Operational review", crossDepartment: "Cross-department review", implementation: "Implementation review", decision: "Decision review",
};
const STAGES: MilestoneStage[] = ["notStarted", "developed", "deployed", "accepted", "adopted"];
const STAGE_LABEL: Record<MilestoneStage, string> = { notStarted: "Not started", developed: "Developed", deployed: "Deployed", accepted: "Accepted by users", adopted: "In operational use" };
const CATEGORY_LABEL: Record<MilestoneCategory, string> = { deliverable: "Deliverable", defect: "Defect", training: "Training", configuration: "Configuration", businessDecision: "Business decision" };
const OUTCOME_LABEL: Record<DecisionOutcome, string> = { approved: "Approved", rejected: "Rejected", conditional: "Approved with conditions", moreInformation: "More information requested" };
const CHANGE_LABEL: Record<ChangeKind, string> = { scope: "Scope", budget: "Budget", release: "Release commitment" };
const emptyOption = (recommended = false): OptionDraft => ({ label: "", description: "", expectedImpact: "", evidence: "", value: "", contractual: false, recommended });

function draftReady(d: Draft) {
  if (!d.branchId || !d.title.trim() || !d.purpose.trim() || !d.expectedOutcome.trim() || !d.participants.some((p) => p.role === "accountable" && p.employeeId)) return false;
  if (d.kind === "crossDepartment") {
    const parties = d.participants.filter((p) => p.employeeId && p.role !== "observer");
    return parties.length >= 2 && parties.every((p) => p.responsibility.trim());
  }
  if (d.kind === "decision")
    return !!d.decisionMakerEmployeeId && !!d.decisionDue && d.options.length > 0 && d.options.every((o) => o.label.trim() && o.expectedImpact.trim())
      && d.options.filter((o) => o.recommended).length === 1;
  return true;
}

const CLASS_LABEL: Record<ReviewClassification, string> = { statement: "Statement", verified: "Verified", assumed: "Assumed", disputed: "Disputed", agreed: "Agreed" };
const CLASS_TONE: Record<ReviewClassification, "neutral" | "ok" | "warn" | "bad" | "info"> = { statement: "neutral", verified: "ok", assumed: "warn", disputed: "bad", agreed: "info" };
const COMMIT_LABEL: Record<ReviewCommitment["status"], string> = {
  proposed: "Awaiting confirmation", confirmed: "Confirmed", constrained: "Constraint raised", issued: "Issued as instruction", completed: "Completed", withdrawn: "Withdrawn",
};
const ENTRY_LABEL: Partial<Record<ReviewEntry["kind"], string>> = {
  opening: "Opening", question: "Question", challenge: "Clarification needed", recognition: "Constraint recognized", changes: "Changes since last review",
  humanReview: "Human review requested", escalation: "Escalated", correction: "Correction", decision: "Decision", evidence: "Evidence",
  timeline: "Timeline from the records", demoRequest: "Demonstration requested", decisionRecord: "Decision recorded",
};

export default function OfficerReviewsPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canManage = useHasPermission("aiops.reviews.manage");
  const { refs } = useOfficerRefs(canManage ? companyId : "");
  const [tab, setTab] = useState<Tab>("mine");
  const [openOnly, setOpenOnly] = useState(true);
  const [rows, setRows] = useState<ReviewListItem[]>([]);
  const [selected, setSelected] = useState<Review | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [candidates, setCandidates] = useState<{ findings: Finding[]; instructions: Instruction[] }>({ findings: [], instructions: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await officerApi.reviews(companyId, { mine: tab === "mine", open: openOnly })); setError(null); }
    catch (e) { setError(apiError(e, "Reviews could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId, tab, openOnly]);
  useEffect(() => { void load(); }, [load]);

  async function open(id: string) {
    setError(null);
    try { setSelected(await officerApi.review(companyId, id)); }
    catch (e) { setError(apiError(e, "The review could not be opened.")); }
  }

  async function run(job: () => Promise<Review>, fallback: string, message?: string) {
    setBusy(true); setError(null);
    try { const r = await job(); setSelected(r); setStep(null); setDraft(null); if (message) setNotice(message); await load(); }
    catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  async function startDraft() {
    setError(null);
    const branchId = refs.branches[0]?.id ?? "";
    setDraft({ kind: "operational", decisionMakerEmployeeId: "", decisionDue: "", options: [emptyOption(true)], branchId, title: "", purpose: "", expectedOutcome: "", language: "en", links: [], participants: [] });
    await loadCandidates(branchId);
  }

  async function loadCandidates(branchId: string) {
    if (!branchId) return;
    try {
      const [findings, instructions] = await Promise.all([
        officerApi.findings(companyId, { status: ["open", "acknowledged"], branchId }),
        officerApi.teamInstructions(companyId, true, branchId),
      ]);
      setCandidates({ findings, instructions });
    } catch { setCandidates({ findings: [], instructions: [] }); }
  }

  function submitDraft() {
    if (!draft) return;
    const links = draft.links.map((l) => { const [type, id] = l.split(":"); return { type, id }; });
    void run(() => officerApi.openReview(companyId, {
      kind: draft.kind, trigger: "request", branchId: draft.branchId,
      ...(draft.kind === "decision" ? {
        decisionMakerEmployeeId: draft.decisionMakerEmployeeId, decisionDueUtc: toUtcIso(draft.decisionDue),
        options: draft.options.map((o) => ({ label: o.label, description: o.description || undefined, expectedImpact: o.expectedImpact, evidence: o.evidence || undefined,
          value: o.value ? Number(o.value) : null, contractual: o.contractual, recommended: o.recommended })),
      } : {}), title: draft.title, purpose: draft.purpose, expectedOutcome: draft.expectedOutcome,
      language: draft.language, links, participants: draft.participants.filter((p) => p.employeeId).map((p) => ({ ...p, responsibility: p.responsibility || undefined })),
    }), "The review could not be opened.", "Review opened. The officer has stated the purpose and facts and asked its questions.");
  }

  function confirm() {
    if (!selected || !step) return;
    const r = selected;
    switch (step.kind) {
      case "post": return void run(() => officerApi.reviewStep(companyId, r.id, "entries", {
        kind: step.amends ? "correction" : step.replyTo ? "answer" : "statement", text: step.text, replyToId: step.replyTo?.id ?? null, amendsEntryId: step.amends?.id ?? null,
        evidenceReference: step.evidence || null,
      }), "The entry could not be posted.");
      case "commit": return void run(() => officerApi.reviewStep(companyId, r.id, "commitments", {
        ownerEmployeeId: step.ownerEmployeeId, deliverable: step.deliverable, dueAtUtc: toUtcIso(step.due), dependencies: step.dependencies || null,
        requiredEvidence: step.requiredEvidence, kind: step.type, sourceEntryId: null,
      }), "The commitment could not be recorded.", step.type === "agreed" ? "Commitment proposed; it counts only once the owner confirms it." : "Instruction issued under delegated authority.");
      case "respond": return void run(() => officerApi.reviewStep(companyId, r.id, `commitments/${step.commitment.id}/respond`, {
        confirm: step.confirm, constraint: step.confirm ? null : step.constraint, version: step.commitment.version,
      }), "Your response could not be saved.", step.confirm ? "Commitment confirmed." : "Constraint recorded.");
      case "deadline": return void run(() => officerApi.reviewStep(companyId, r.id, `commitments/${step.commitment.id}/deadline`, {
        dueAtUtc: toUtcIso(step.due), reason: step.reason, version: step.commitment.version,
      }), "The deadline could not be changed.", "Deadline changed; the original is kept.");
      case "humanReview": return void run(() => officerApi.reviewStep(companyId, r.id, "human-review", { text: step.text }), "The request could not be sent.", "Sent for human review.");
      case "amend": return void run(() => officerApi.reviewStep(companyId, r.id, "summary/amend", { text: step.text }), "The summary could not be amended.", "Summary amended; the earlier version is kept.");
      case "decide": return void run(() => officerApi.reviewStep(companyId, r.id, "decision", {
        outcome: step.outcome, optionId: step.optionId || null, note: step.note || null, version: r.version,
      }), "The decision could not be recorded.", "Decision recorded.");
      case "milestone": return void run(() => officerApi.reviewStep(companyId, r.id, "milestones", {
        category: step.category, title: step.title, ownerEmployeeId: step.ownerEmployeeId, dueAtUtc: toUtcIso(step.due), dependencies: step.dependencies || null,
        acceptanceEvidence: step.acceptanceEvidence, targetStage: step.targetStage,
      }), "The milestone could not be added.", "Milestone added.");
      case "claim": return void run(() => officerApi.reviewStep(companyId, r.id, `milestones/${step.milestone.id}/claim`, {
        stage: step.stage, note: step.text || null, version: step.milestone.version,
      }), "Progress could not be reported.", "Progress reported. It counts once it is demonstrated or evidenced.");
      case "verify": return void run(() => officerApi.reviewStep(companyId, r.id, `milestones/${step.milestone.id}/verify`, {
        stage: step.stage, evidence: step.text, version: step.milestone.version,
      }), "The stage could not be verified.", "Stage verified.");
      case "change": return void run(() => officerApi.reviewStep(companyId, r.id, "changes", {
        kind: step.changeKind, description: step.description, reason: step.reason, value: step.value ? Number(step.value) : null,
      }), "The change could not be proposed.", "Change proposed for approval under delegated authority.");
      case "responsibility": return void run(() => officerApi.reviewStep(companyId, r.id, "responsibility", { employeeId: step.employeeId, responsibility: step.text }),
        "The responsibility could not be recorded.", "Responsibility recorded.");
      case "privateNote": return void run(() => officerApi.reviewStep(companyId, r.id, "private-note", { employeeId: step.employeeId, text: step.text }),
        "The note could not be sent.", "Note sent to that participant only.");
      case "authorize": return void run(() => officerApi.reviewStep(companyId, r.id, "external/authorize", { parties: step.parties, channel: step.channel }),
        "External participation could not be authorized.", "External participation authorized.");
      case "external": return void run(() => officerApi.reviewStep(companyId, r.id, "external/statements", { party: step.party, text: step.text }),
        "The statement could not be recorded.", "External statement recorded.");
    }
  }

  function valid(s: Step) {
    switch (s.kind) {
      case "post": return !!s.text.trim();
      case "commit": return !!s.ownerEmployeeId && !!s.deliverable.trim() && !!s.due && !!s.requiredEvidence.trim();
      case "respond": return s.confirm || !!s.constraint.trim();
      case "deadline": return !!s.due && !!s.reason.trim();
      case "humanReview": case "amend": return !!s.text.trim();
      case "decide": return (s.outcome === "approved" || s.outcome === "conditional" ? !!s.optionId : true) && (s.outcome === "approved" || !!s.note.trim());
      case "milestone": return !!s.title.trim() && !!s.ownerEmployeeId && !!s.due && !!s.acceptanceEvidence.trim() && s.targetStage !== "notStarted";
      case "claim": return true;
      case "verify": return !!s.text.trim();
      case "change": return !!s.description.trim() && !!s.reason.trim();
      case "responsibility": case "privateNote": return !!s.employeeId && !!s.text.trim();
      case "authorize": return !!s.parties.trim() && !!s.channel.trim();
      case "external": return !!s.party.trim() && !!s.text.trim();
    }
  }

  const r = selected;
  const can = (k: string) => !!r && (r.canDo.includes(k) || (r.details?.canDo ?? []).includes(k));
  const d = r?.details;
  const latest = r?.summaries.length ? r.summaries[r.summaries.length - 1] : null;
  return (
    <div className="gl-page">
      <PageHeader title="Management Reviews"
        subtitle="Structured reviews the officer conducts with managers: purpose, facts and expected outcome, focused questions, explanations compared with the records, and commitments the owners confirm." />
      <OfficerNav />
      <div className="gl-tabs" role="tablist">
        <Button role="tab" type="button" variant="ghost" className="gl-tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")}>My reviews</Button>
        {canManage ? <Button role="tab" type="button" variant="ghost" className="gl-tab" aria-selected={tab === "all"} onClick={() => setTab("all")}>All reviews</Button> : null}
      </div>
      <div className="gl-toolbar">
        <Field label="Show">
          <Select value={openOnly ? "open" : "all"} onChange={(e) => setOpenOnly(e.target.value === "open")}>
            <option value="open">Open reviews</option><option value="all">All reviews</option>
          </Select>
        </Field>
        {canManage ? <Button type="button" onClick={() => void startDraft()}>Open a review</Button> : null}
      </div>
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {error && !r && !draft ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">Loading reviews…</StateMessage> : null}

      <div className="gl-table-wrap">
        <table className="gl-table">
          <thead><tr><th>Review</th><th>Branch</th><th>Opened</th><th>Commitments</th><th>Status</th></tr></thead>
          <tbody>
            {!loading && rows.length === 0 ? <tr><td colSpan={5} className="gl-empty">No reviews.</td></tr> : null}
            {rows.map((x) => (
              <tr key={x.id} className="gl-row" tabIndex={0} onClick={() => void open(x.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void open(x.id); } }}>
                <td>{x.reviewNo} · {x.title}<small>{x.trigger}{x.escalated ? " · escalated" : ""}</small></td>
                <td>{x.branchName ?? "Company"}</td>
                <td>{when(x.openedAtUtc)}</td>
                <td>{x.openCommitments}{x.awaitingMe > 0 ? <small>{x.awaitingMe} awaiting your confirmation</small> : null}</td>
                <td><Chip tone={x.status === "open" ? "info" : "muted"}>{x.status === "open" ? "Open" : x.status === "concluded" ? "Concluded" : "Cancelled"}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft ? (
        <GlDialog open size="wide" title="Open a review" busy={busy} error={error} onClose={() => { setDraft(null); setError(null); }} confirmText="Open review"
          confirmDisabled={!draftReady(draft)} onConfirm={submitDraft}>
          <Field label="Kind of review">
            <Select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ReviewKind })}>
              {(Object.keys(KIND_LABEL) as ReviewKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
          </Field>
          {draft.kind === "crossDepartment" ? <StateMessage>Add at least two responsible parties and say what each is responsible for. The officer builds a timeline from the records and asks each party about their part.</StateMessage> : null}
          {draft.kind === "implementation" ? <StateMessage>After opening, record milestones, defects, training and configuration items. A claimed stage counts only once it is demonstrated or evidenced.</StateMessage> : null}
          <Field label="Branch"><BranchSelect value={draft.branchId} onChange={(v) => { setDraft({ ...draft, branchId: v, links: [] }); void loadCandidates(v); }} branches={refs.branches} /></Field>
          <Field label="Title"><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="Purpose"><Textarea rows={2} value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} /></Field>
          <Field label="Expected outcome"><Textarea rows={2} value={draft.expectedOutcome} onChange={(e) => setDraft({ ...draft, expectedOutcome: e.target.value })} /></Field>
          <Field label="Language">
            <Select value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value as "en" | "am" })}>
              <option value="en">English</option><option value="am">Amharic</option>
            </Select>
          </Field>
          <fieldset className="gl-field gl-field--wide">
            <legend>Records to review</legend>
            {candidates.findings.length + candidates.instructions.length === 0 ? <small>No open findings or instructions at this branch.</small> : null}
            {[...candidates.findings.slice(0, 12).map((f) => ({ key: `OfficerFinding:${f.id}`, label: `${f.title} (${f.severity})` })),
              ...candidates.instructions.slice(0, 12).map((i) => ({ key: `OfficerInstruction:${i.id}`, label: `${i.title} — ${i.ownerName ?? ""}, due ${when(i.dueAtUtc)}${i.overdue ? ", overdue" : ""}` }))].map((c) => (
              <label key={c.key} className="gl-check"><Checkbox checked={draft.links.includes(c.key)}
                onChange={(e) => setDraft({ ...draft, links: e.target.checked ? [...draft.links, c.key] : draft.links.filter((x) => x !== c.key) })} /> {c.label}</label>
            ))}
          </fieldset>
          <fieldset className="gl-field gl-field--wide">
            <legend>Participants</legend>
            {draft.participants.map((p, n) => (
              <div key={n} className="gl-toolbar">
                <Field label="Person"><EmployeeSelect value={p.employeeId} onChange={(v) => setDraft({ ...draft, participants: draft.participants.map((x, i) => i === n ? { ...x, employeeId: v } : x) })}
                  employees={refs.employees} branchId={draft.branchId} placeholder="Choose a person" /></Field>
                <Field label="Role">
                  <Select value={p.role} onChange={(e) => setDraft({ ...draft, participants: draft.participants.map((x, i) => i === n ? { ...x, role: e.target.value as ReviewRole } : x) })}>
                    <option value="accountable">Accountable</option><option value="contributor">Contributor</option><option value="observer">Observer</option>
                  </Select>
                </Field>
                <Field label="Responsible for"><Input value={p.responsibility} onChange={(e) => setDraft({ ...draft, participants: draft.participants.map((x, i) => i === n ? { ...x, responsibility: e.target.value } : x) })} /></Field>
                <label className="gl-check"><Checkbox checked={p.restricted} onChange={(e) => setDraft({ ...draft, participants: draft.participants.map((x, i) => i === n ? { ...x, restricted: e.target.checked } : x) })} /> Restricted view</label>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setDraft({ ...draft, participants: [...draft.participants, { employeeId: "", role: draft.participants.length ? "contributor" : "accountable", responsibility: "", restricted: false }] })}>Add participant</Button>
          </fieldset>
          {draft.kind === "decision" ? <>
            <Field label="Decision-maker"><EmployeeSelect value={draft.decisionMakerEmployeeId} onChange={(v) => setDraft({ ...draft, decisionMakerEmployeeId: v })}
              employees={refs.employees} branchId={draft.branchId} placeholder="Choose the decision-maker" /></Field>
            <Field label="Decision needed by"><Input type="datetime-local" value={draft.decisionDue} onChange={(e) => setDraft({ ...draft, decisionDue: e.target.value })} /></Field>
            <fieldset className="gl-field gl-field--wide" data-testid="review-options">
              <legend>Options</legend>
              {draft.options.map((o, n) => {
                const set = (patch: Partial<OptionDraft>) => setDraft({ ...draft, options: draft.options.map((x, i) => i === n ? { ...x, ...patch } : patch.recommended ? { ...x, recommended: false } : x) });
                return (
                  <div key={n} className="gl-toolbar">
                    <Field label={`Option ${n + 1}`}><Input value={o.label} onChange={(e) => set({ label: e.target.value })} /></Field>
                    <Field label="Expected impact"><Input value={o.expectedImpact} onChange={(e) => set({ expectedImpact: e.target.value })} /></Field>
                    <Field label="Evidence"><Input value={o.evidence} onChange={(e) => set({ evidence: e.target.value })} /></Field>
                    <Field label="Value"><Input type="number" min={0} value={o.value} onChange={(e) => set({ value: e.target.value })} /></Field>
                    <label className="gl-check"><Checkbox checked={o.contractual} onChange={(e) => set({ contractual: e.target.checked })} /> Contractual</label>
                    <label className="gl-check"><Checkbox checked={o.recommended} onChange={(e) => set({ recommended: e.target.checked })} /> Recommended</label>
                  </div>
                );
              })}
              <Button type="button" variant="outline" onClick={() => setDraft({ ...draft, options: [...draft.options, emptyOption()] })}>Add option</Button>
            </fieldset>
          </> : null}
        </GlDialog>
      ) : null}

      {r && !step ? (
        <GlDialog open size="wide" title={`${r.reviewNo} · ${r.title}`} confirmText="" closeText="Close" busy={busy} error={error} onClose={() => { setSelected(null); setError(null); }}
          actions={<>
            {can("post") ? <Button type="button" onClick={() => setStep({ kind: "post", text: "", evidence: "" })}>Add a statement</Button> : null}
            {can("commit") ? <Button type="button" variant="outline" onClick={() => setStep({ kind: "commit", ownerEmployeeId: r.participants.find((p) => p.role === "accountable")?.employeeId ?? "", deliverable: "", due: "", dependencies: "", requiredEvidence: "", type: "agreed" })}>Record a commitment</Button> : null}
            {can("humanReview") ? <Button type="button" variant="outline" onClick={() => setStep({ kind: "humanReview", text: "" })}>Ask for a human review</Button> : null}
            {can("amendSummary") ? <Button type="button" variant="outline" onClick={() => setStep({ kind: "amend", text: "" })}>Amend the summary</Button> : null}
            {can("decide") ? <Button type="button" onClick={() => setStep({ kind: "decide", outcome: "approved", optionId: d?.options.find((o) => o.recommended)?.id ?? "", note: "" })}>Record the decision</Button> : null}
            {can("milestone") ? <Button type="button" variant="outline" onClick={() => setStep({ kind: "milestone", category: "deliverable", title: "", ownerEmployeeId: r.participants[0]?.employeeId ?? "", due: "", dependencies: "", acceptanceEvidence: "", targetStage: "adopted" })}>Add a milestone</Button> : null}
            {can("change") ? <Button type="button" variant="outline" onClick={() => setStep({ kind: "change", changeKind: "scope", description: "", reason: "", value: "" })}>Propose a change</Button> : null}
            {can("responsibility") ? <Button type="button" variant="ghost" onClick={() => setStep({ kind: "responsibility", employeeId: r.participants[0]?.employeeId ?? "", text: "" })}>Record a responsibility</Button> : null}
            {can("privateNote") ? <Button type="button" variant="ghost" onClick={() => setStep({ kind: "privateNote", employeeId: r.participants[0]?.employeeId ?? "", text: "" })}>Private note</Button> : null}
            {can("authorizeExternal") ? <Button type="button" variant="ghost" onClick={() => setStep({ kind: "authorize", parties: "", channel: "" })}>Authorize external parties</Button> : null}
            {can("recordExternal") ? <Button type="button" variant="ghost" onClick={() => setStep({ kind: "external", party: "", text: "" })}>Record an external statement</Button> : null}
            {can("conclude") ? <Button type="button" disabled={busy} onClick={() => void run(() => officerApi.reviewStep(companyId, r.id, "conclude"), "The review could not be concluded.", "Review concluded; the summary is ready.")}>Conclude</Button> : null}
            {can("followUp") ? <Button type="button" disabled={busy} onClick={() => void run(() => officerApi.reviewStep(companyId, r.id, "follow-up"), "The follow-up could not be opened.", "Follow-up review opened with the changes since.")}>Follow up</Button> : null}
          </>}>
          <div className="gl-chip-row">
            <Chip tone={r.status === "open" ? "info" : "muted"}>{r.status === "open" ? "Open" : "Concluded"}</Chip>
            <Chip tone="muted">{KIND_LABEL[r.kind as ReviewKind] ?? r.kind}</Chip>
            {d?.externalAuthorizedAtUtc ? <Chip tone="info">External: {d.externalParties ?? "authorized"} via {d.externalChannel}</Chip> : null}
            {r.tone === "firm" ? <Chip tone="warn">Firm</Chip> : null}
            {r.restricted ? <Chip tone="muted">Restricted view</Chip> : null}
            {r.escalatedAtUtc ? <Chip tone="bad">Escalated{r.escalatedToName ? ` to ${r.escalatedToName}` : ""}</Chip> : null}
            {r.redacted ? <Chip tone="muted">Text removed under retention</Chip> : null}
          </div>
          <dl className="gl-detail">
            <div><dt>Purpose</dt><dd>{r.purpose}</dd></div>
            <div><dt>Expected outcome</dt><dd>{r.expectedOutcome}</dd></div>
            <div><dt>Participants</dt><dd>{r.participants.map((p) => `${p.name ?? "—"} (${p.role}${d?.departments[p.employeeId] ? `, ${d.departments[p.employeeId]}` : ""}${p.restricted ? ", restricted" : ""})${p.responsibility ? `: ${p.responsibility}` : ""}`).join("; ")}</dd></div>
          </dl>
          {d && r.kind === "decision" ? (
            <Section title="Decision" hint={`Decision-maker: ${d.decisionMakerName ?? "—"}${d.decisionDueUtc ? ` · needed by ${when(d.decisionDueUtc)}` : ""}`}>
              <table className="gl-table" data-testid="review-decision">
                <thead><tr><th>Option</th><th>Expected impact</th><th>Value</th><th>Evidence</th></tr></thead>
                <tbody>
                  {d.options.map((o) => (
                    <tr key={o.id}>
                      <td>{o.label}{o.recommended ? <Chip tone="info">Recommended</Chip> : null}{o.contractual ? <small>Contractual: needs approval under delegated authority</small> : null}
                        {d.decidedOptionId === o.id ? <Chip tone="ok">Chosen</Chip> : null}</td>
                      <td>{o.expectedImpact}{o.description ? <small>{o.description}</small> : null}</td>
                      <td>{o.value != null ? o.value.toLocaleString() : "—"}</td>
                      <td>{o.evidence ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {d.decisionOutcome ? <StateMessage tone={d.decisionOutcome === "rejected" ? "error" : d.decisionOutcome === "moreInformation" ? "info" : "success"}>
                {OUTCOME_LABEL[d.decisionOutcome]} by {d.decidedByName} {d.decidedAtUtc ? when(d.decidedAtUtc) : ""}{d.decisionNote ? ` — ${d.decisionNote}` : ""}
                {d.contractActionId ? ` · Contract approval: ${d.contractStatus ?? "pending"}` : ""}
              </StateMessage> : <small>No decision recorded yet.</small>}
            </Section>
          ) : null}
          {d && r.kind === "implementation" ? (
            <Section title="Milestones" hint="Developed, deployed, accepted and in use are separate stages; a claim counts only once shown.">
              <table className="gl-table" data-testid="review-milestones">
                <thead><tr><th>Item</th><th>Owner</th><th>Due</th><th>Verified</th><th>Claimed</th><th /></tr></thead>
                <tbody>
                  {d.milestones.length === 0 ? <tr><td colSpan={6} className="gl-empty">No milestones yet.</td></tr> : null}
                  {d.milestones.map((m) => (
                    <tr key={m.id}>
                      <td>{m.title}<small>{CATEGORY_LABEL[m.category]} · target {STAGE_LABEL[m.targetStage]} · proof: {m.acceptanceEvidence}{m.dependencies ? ` · depends on ${m.dependencies}` : ""}</small></td>
                      <td>{m.ownerName}</td>
                      <td>{when(m.dueAtUtc)}{m.overdue ? <Chip tone="bad">Overdue</Chip> : null}</td>
                      <td><Chip tone={m.verifiedStage === m.targetStage ? "ok" : "neutral"}>{STAGE_LABEL[m.verifiedStage]}</Chip>
                        {m.verifications.map((v) => <small key={v.at}>{STAGE_LABEL[v.stage]}: {v.evidence} ({v.by})</small>)}</td>
                      <td>{m.awaitingProof ? <Chip tone="warn">{STAGE_LABEL[m.claimedStage]}: awaiting proof</Chip> : "—"}{m.claimNote ? <small>{m.claimNote}</small> : null}</td>
                      <td>
                        {r.status === "open" && m.verifiedStage !== m.targetStage ? <Button type="button" variant="outline"
                          onClick={() => setStep({ kind: "claim", milestone: m, stage: STAGES[Math.min(STAGES.indexOf(m.targetStage), Math.max(STAGES.indexOf(m.claimedStage), STAGES.indexOf(m.verifiedStage)) + 1)], text: "" })}>Report progress</Button> : null}
                        {r.facilitator && m.awaitingProof ? <Button type="button" variant="ghost" onClick={() => setStep({ kind: "verify", milestone: m, stage: m.claimedStage, text: "" })}>Verify</Button> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}
          {d && d.changes.length > 0 ? (
            <Section title="Change requests" hint="Scope, budget and release changes need approval under delegated authority.">
              <table className="gl-table" data-testid="review-changes">
                <thead><tr><th>Change</th><th>Reason</th><th>Value</th><th>Approval</th></tr></thead>
                <tbody>
                  {d.changes.map((c) => (
                    <tr key={c.id}>
                      <td>{CHANGE_LABEL[c.kind]}: {c.description}<small>{c.requestedByName} · {when(c.requestedAtUtc)}</small></td>
                      <td>{c.reason}</td>
                      <td>{c.value != null ? c.value.toLocaleString() : "—"}</td>
                      <td><Chip tone={c.actionStatus === "rejected" ? "bad" : c.actionStatus === "pendingApproval" ? "warn" : "info"}>{c.actionStatus ?? "—"}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}
          {r.links.length > 0 ? <Section title="Linked records"><EvidenceList items={r.links} /></Section> : null}

          <Section title="Conversation" hint="The officer's facts come from Process360; participants' statements stay statements until verified.">
            <ol className="oo-thread" data-testid="review-thread">
              {r.entries.map((e) => (
                <li key={e.id} className={e.byOfficer ? "oo-entry oo-entry--officer" : "oo-entry"}>
                  <div className="gl-chip-row">
                    <strong>{e.authorName}</strong>
                    {ENTRY_LABEL[e.kind] ? <Chip tone={e.kind === "challenge" ? "warn" : e.kind === "recognition" ? "ok" : "muted"}>{ENTRY_LABEL[e.kind]}</Chip> : null}
                    {!e.byOfficer ? <Chip tone={CLASS_TONE[e.classification]}>{CLASS_LABEL[e.classification]}</Chip> : null}
                    {e.audienceName ? <small>To {e.audienceName} only</small> : null}
                    <small>{when(e.atUtc)}</small>
                  </div>
                  <p className="oo-entry-text">{e.text}</p>
                  {e.evidence.length > 0 && e.kind !== "opening" ? <EvidenceList items={e.evidence} /> : null}
                  <div className="gl-chip-row">
                    {can("post") && e.byOfficer && (e.kind === "question" || e.kind === "challenge" || e.kind === "recognition") ? <Button type="button" variant="outline" onClick={() => setStep({ kind: "post", replyTo: e, text: "", evidence: "" })}>Answer</Button> : null}
                    {can("post") && e.kind !== "changes" ? <Button type="button" variant="ghost" onClick={() => setStep({ kind: "post", amends: e, text: "", evidence: "" })}>Correct</Button> : null}
                    {can("classify") && !e.byOfficer ? (
                      <Select aria-label={`Classify entry ${e.seq}`} value={e.classification}
                        onChange={(ev) => void run(() => officerApi.reviewStep(companyId, r.id, `entries/${e.id}/classify`, { classification: ev.target.value }), "The entry could not be classified.")}>
                        {(Object.keys(CLASS_LABEL) as ReviewClassification[]).map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
                      </Select>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {r.commitments.length > 0 ? (
            <Section title="Commitments" hint="Agreed commitments count only when the owner confirms them; instructions follow delegated authority.">
              <table className="gl-table" data-testid="review-commitments">
                <thead><tr><th>Deliverable</th><th>Owner</th><th>Deadline</th><th>Evidence</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {r.commitments.map((c) => (
                    <tr key={c.id}>
                      <td>{c.deliverable}<small>{c.kind === "agreed" ? "Agreed commitment" : "Instruction under delegated authority"}{c.dependencies ? ` · depends on ${c.dependencies}` : ""}</small></td>
                      <td>{c.ownerName}</td>
                      <td>{when(c.dueAtUtc)}{c.dueAtUtc !== c.originalDueAtUtc ? <small>Originally {when(c.originalDueAtUtc)}</small> : null}
                        {c.revisions.map((v) => <small key={v.at}>{when(v.at)}: {v.reason} ({v.by})</small>)}</td>
                      <td>{c.requiredEvidence}</td>
                      <td><Chip tone={c.status === "completed" ? "ok" : c.status === "constrained" ? "warn" : c.status === "withdrawn" ? "muted" : "info"}>{COMMIT_LABEL[c.status]}</Chip>{c.constraint ? <small>{c.constraint}</small> : null}</td>
                      <td>
                        {c.awaitingResponse ? <>
                          <Button type="button" onClick={() => setStep({ kind: "respond", commitment: c, confirm: true, constraint: "" })}>Confirm</Button>
                          <Button type="button" variant="outline" onClick={() => setStep({ kind: "respond", commitment: c, confirm: false, constraint: "" })}>Name a constraint</Button>
                        </> : null}
                        {r.facilitator && c.status !== "completed" && c.status !== "withdrawn" ? <Button type="button" variant="ghost" onClick={() => setStep({ kind: "deadline", commitment: c, due: "", reason: "" })}>Change deadline</Button> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          {latest ? (
            <Section title={`Summary v${latest.version}`} hint={`${latest.by} · ${when(latest.atUtc)}${r.summaries.length > 1 ? ` · ${r.summaries.length - 1} earlier version(s) kept` : ""}`}>
              <div data-testid="review-summary" className="gl-stack">
                {latest.amendment ? <StateMessage>Amended: {latest.amendment}</StateMessage> : null}
                {latest.decision ? <div><strong>Decision</strong><p>{latest.decision}</p></div> : null}
                {([["Agreed decisions", latest.decisions], ["Verified facts", latest.verifiedFacts], ["Statements", latest.statements], ["Assumptions", latest.assumptions],
                  ["Disputed", latest.disputed], ["Commitments", latest.commitments], ["Open issues", latest.openIssues],
                  ["Responsibilities", latest.responsibilities ?? []], ["Milestones", latest.milestones ?? []]] as [string, string[]][])
                  .filter(([, items]) => items.length > 0).map(([title, items]) => (
                    <div key={title}><strong>{title}</strong><ul className="oo-evidence">{items.map((x, i) => <li key={i}><span>{x}</span></li>)}</ul></div>
                  ))}
              </div>
            </Section>
          ) : null}
        </GlDialog>
      ) : null}

      {r && step ? (
        <GlDialog open title={STEP_TITLE[step.kind]} busy={busy} error={error} onClose={() => { setStep(null); setError(null); }} confirmText="Send" confirmDisabled={!valid(step)} onConfirm={confirm}>
          {step.kind === "post" ? <>
            {step.replyTo ? <p className="gl-note">{step.replyTo.text}</p> : null}
            {step.amends ? <p className="gl-note">Correcting: {step.amends.text}</p> : null}
            <Field label={step.amends ? "Correction" : step.replyTo ? "Your answer" : "Statement"}><Textarea rows={4} value={step.text} onChange={(e) => setStep({ ...step, text: e.target.value })} /></Field>
            <Field label="Supporting record (optional)" hint="A document number or reference, e.g. SIV-0042."><Input value={step.evidence} onChange={(e) => setStep({ ...step, evidence: e.target.value })} /></Field>
          </> : null}
          {step.kind === "commit" ? <>
            <Field label="Type">
              <Select value={step.type} onChange={(e) => setStep({ ...step, type: e.target.value as "agreed" | "instruction" })}>
                <option value="agreed">Agreed commitment (the owner confirms)</option><option value="instruction">Instruction under delegated authority</option>
              </Select>
            </Field>
            <Field label="Owner">
              <Select value={step.ownerEmployeeId} onChange={(e) => setStep({ ...step, ownerEmployeeId: e.target.value })}>
                {r.participants.map((p) => <option key={p.employeeId} value={p.employeeId}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Deliverable"><Textarea rows={2} value={step.deliverable} onChange={(e) => setStep({ ...step, deliverable: e.target.value })} /></Field>
            <Field label="Deadline"><Input type="datetime-local" value={step.due} onChange={(e) => setStep({ ...step, due: e.target.value })} /></Field>
            <Field label="Dependencies"><Input value={step.dependencies} onChange={(e) => setStep({ ...step, dependencies: e.target.value })} /></Field>
            <Field label="Evidence of completion"><Input value={step.requiredEvidence} onChange={(e) => setStep({ ...step, requiredEvidence: e.target.value })} /></Field>
          </> : null}
          {step.kind === "respond" ? <>
            <p>{step.commitment.deliverable} — by {when(step.commitment.dueAtUtc)}; evidence: {step.commitment.requiredEvidence}</p>
            {step.confirm ? <StateMessage>Confirming makes this your commitment and issues it as an instruction.</StateMessage>
              : <Field label="What prevents it as proposed"><Textarea rows={3} value={step.constraint} onChange={(e) => setStep({ ...step, constraint: e.target.value })} /></Field>}
          </> : null}
          {step.kind === "deadline" ? <>
            <p>{step.commitment.deliverable} — now due {when(step.commitment.dueAtUtc)} (originally {when(step.commitment.originalDueAtUtc)})</p>
            <Field label="New deadline"><Input type="datetime-local" value={step.due} onChange={(e) => setStep({ ...step, due: e.target.value })} /></Field>
            <Field label="Reason"><Input value={step.reason} onChange={(e) => setStep({ ...step, reason: e.target.value })} /></Field>
          </> : null}
          {step.kind === "humanReview" ? <Field label="What should a person review, and why"><Textarea rows={3} value={step.text} onChange={(e) => setStep({ ...step, text: e.target.value })} /></Field> : null}
          {step.kind === "decide" && d ? <>
            <Field label="Decision">
              <Select value={step.outcome} onChange={(e) => setStep({ ...step, outcome: e.target.value as DecisionOutcome })}>
                {(Object.keys(OUTCOME_LABEL) as DecisionOutcome[]).map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
              </Select>
            </Field>
            {step.outcome === "approved" || step.outcome === "conditional" ? <Field label="Option">
              <Select value={step.optionId} onChange={(e) => setStep({ ...step, optionId: e.target.value })}>
                <option value="">Choose an option</option>
                {d.options.map((o) => <option key={o.id} value={o.id}>{o.label}{o.recommended ? " (recommended)" : ""}</option>)}
              </Select>
            </Field> : null}
            {d.options.find((o) => o.id === step.optionId)?.contractual && step.outcome !== "rejected" && step.outcome !== "moreInformation"
              ? <StateMessage>This option is contractual. It binds the company only once approved under delegated authority; it goes to approval when you record the decision.</StateMessage> : null}
            <Field label={step.outcome === "conditional" ? "Conditions" : step.outcome === "moreInformation" ? "Information needed" : step.outcome === "rejected" ? "Reason" : "Note (optional)"}>
              <Textarea rows={3} value={step.note} onChange={(e) => setStep({ ...step, note: e.target.value })} /></Field>
          </> : null}
          {step.kind === "milestone" ? <>
            <Field label="Category">
              <Select value={step.category} onChange={(e) => setStep({ ...step, category: e.target.value as MilestoneCategory })}>
                {(Object.keys(CATEGORY_LABEL) as MilestoneCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </Select>
            </Field>
            <Field label="Title"><Input value={step.title} onChange={(e) => setStep({ ...step, title: e.target.value })} /></Field>
            <Field label="Owner">
              <Select value={step.ownerEmployeeId} onChange={(e) => setStep({ ...step, ownerEmployeeId: e.target.value })}>
                {r.participants.map((p) => <option key={p.employeeId} value={p.employeeId}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Due"><Input type="datetime-local" value={step.due} onChange={(e) => setStep({ ...step, due: e.target.value })} /></Field>
            <Field label="Dependencies"><Input value={step.dependencies} onChange={(e) => setStep({ ...step, dependencies: e.target.value })} /></Field>
            <Field label="What proves acceptance"><Input value={step.acceptanceEvidence} onChange={(e) => setStep({ ...step, acceptanceEvidence: e.target.value })} /></Field>
            <Field label="Must reach">
              <Select value={step.targetStage} onChange={(e) => setStep({ ...step, targetStage: e.target.value as MilestoneStage })}>
                {STAGES.slice(1).map((x) => <option key={x} value={x}>{STAGE_LABEL[x]}</option>)}
              </Select>
            </Field>
          </> : null}
          {step.kind === "claim" || step.kind === "verify" ? <>
            <p>{step.milestone.title} — verified: {STAGE_LABEL[step.milestone.verifiedStage]}; proof required: {step.milestone.acceptanceEvidence}</p>
            <Field label="Stage">
              <Select value={step.stage} onChange={(e) => setStep({ ...step, stage: e.target.value as MilestoneStage })}>
                {STAGES.filter((x) => STAGES.indexOf(x) > STAGES.indexOf(step.milestone.verifiedStage)
                  && STAGES.indexOf(x) <= STAGES.indexOf(step.kind === "verify" ? step.milestone.claimedStage : step.milestone.targetStage))
                  .map((x) => <option key={x} value={x}>{STAGE_LABEL[x]}</option>)}
              </Select>
            </Field>
            <Field label={step.kind === "verify" ? "Demonstration or record seen" : "Note (optional)"}><Textarea rows={3} value={step.text} onChange={(e) => setStep({ ...step, text: e.target.value })} /></Field>
            {step.kind === "claim" ? <StateMessage>The officer will ask for a demonstration or the record before this stage counts.</StateMessage> : null}
          </> : null}
          {step.kind === "change" ? <>
            <Field label="Kind of change">
              <Select value={step.changeKind} onChange={(e) => setStep({ ...step, changeKind: e.target.value as ChangeKind })}>
                {(Object.keys(CHANGE_LABEL) as ChangeKind[]).map((c) => <option key={c} value={c}>{CHANGE_LABEL[c]}</option>)}
              </Select>
            </Field>
            <Field label="Change"><Textarea rows={2} value={step.description} onChange={(e) => setStep({ ...step, description: e.target.value })} /></Field>
            <Field label="Reason"><Input value={step.reason} onChange={(e) => setStep({ ...step, reason: e.target.value })} /></Field>
            <Field label="Value (optional)"><Input type="number" min={0} value={step.value} onChange={(e) => setStep({ ...step, value: e.target.value })} /></Field>
            <StateMessage>The change goes to approval under delegated authority; nobody acts on it before then.</StateMessage>
          </> : null}
          {step.kind === "responsibility" || step.kind === "privateNote" ? <>
            <Field label="Participant">
              <Select value={step.employeeId} onChange={(e) => setStep({ ...step, employeeId: e.target.value })}>
                {r.participants.map((p) => <option key={p.employeeId} value={p.employeeId}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label={step.kind === "responsibility" ? "Responsible for" : "Note (only this participant and facilitators see it)"}>
              <Textarea rows={3} value={step.text} onChange={(e) => setStep({ ...step, text: e.target.value })} /></Field>
          </> : null}
          {step.kind === "authorize" ? <>
            <Field label="External parties"><Input value={step.parties} onChange={(e) => setStep({ ...step, parties: e.target.value })} /></Field>
            <Field label="Authorized channel" hint="e.g. a call by the purchasing manager"><Input value={step.channel} onChange={(e) => setStep({ ...step, channel: e.target.value })} /></Field>
            <StateMessage>The officer does not contact external parties; a facilitator records what they say.</StateMessage>
          </> : null}
          {step.kind === "external" ? <>
            <Field label="Party"><Input value={step.party} onChange={(e) => setStep({ ...step, party: e.target.value })} /></Field>
            <Field label="What they said"><Textarea rows={3} value={step.text} onChange={(e) => setStep({ ...step, text: e.target.value })} /></Field>
          </> : null}
          {step.kind === "amend" ? <Field label="What is wrong or missing in the summary"><Textarea rows={3} value={step.text} onChange={(e) => setStep({ ...step, text: e.target.value })} /></Field> : null}
        </GlDialog>
      ) : null}
    </div>
  );
}

const STEP_TITLE: Record<Step["kind"], string> = {
  post: "Add to the review", commit: "Record a commitment", respond: "Respond to the commitment", deadline: "Change the deadline", humanReview: "Ask for a human review",
  amend: "Amend the summary", decide: "Record the decision", milestone: "Add a milestone", claim: "Report progress", verify: "Verify a stage", change: "Propose a change",
  responsibility: "Record a responsibility", privateNote: "Private note", authorize: "Authorize external parties", external: "Record an external statement",
};
