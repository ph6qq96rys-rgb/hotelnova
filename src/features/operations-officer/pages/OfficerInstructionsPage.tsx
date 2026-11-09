import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, Field, GlDialog } from "../../finance/components/glShared";
import { officerApi, type CompletionMode, type Instruction, type InstructionChange, type InstructionPriority } from "../api/officerApi";
import {
  BranchSelect, EmployeeSelect, INSTRUCTION_STATUS_LABEL, INSTRUCTION_STATUS_TONE, newClientId, OfficerNav, OPEN_INSTRUCTION, PRIORITY_LABEL, toLocalInput,
  toUtcIso, useOfficerRefs, when,
} from "../components/officerShared";

type Tab = "mine" | "team";
type WorkKind = "progress" | "evidence" | "blocker" | "exception" | "review" | "reassign" | "cancel" | "resolveBlocker" | "decideException";
type Work = {
  kind: WorkKind; instruction: Instruction; text: string; text2: string; text3: string; percent: string; employeeId: string; due: string; waive: boolean;
  accept: boolean; targetId: string;
};
type Draft = {
  branchId: string; ownerEmployeeId: string; title: string; actionText: string; reason: string; priority: InstructionPriority; due: string; requiredEvidence: string;
  completionMode: CompletionMode; completionRef: string; mandatory: boolean;
};

const blankWork = (kind: WorkKind, instruction: Instruction, extra: Partial<Work> = {}): Work => ({
  kind, instruction, text: "", text2: "", text3: "", percent: String(instruction.progressPercent), employeeId: "", due: "", waive: false, accept: true, targetId: "", ...extra,
});

export default function OfficerInstructionsPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canView = useHasPermission("aiops.view");
  const canManage = useHasPermission("aiops.instructions.manage");
  const canApprove = useHasPermission("aiops.actions.approve");
  const canRequest = useHasPermission("aiops.actions.request");
  const { refs } = useOfficerRefs(canView ? companyId : "");
  const [tab, setTab] = useState<Tab>("mine");
  const [openOnly, setOpenOnly] = useState(true);
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Instruction | null>(null);
  const [work, setWork] = useState<Work | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [changes, setChanges] = useState<InstructionChange[]>([]);

  useEffect(() => {
    let live = true;
    officerApi.myInstructionChanges(companyId).then((c) => { if (live) setChanges(c); }).catch(() => { if (live) setChanges([]); });
    return () => { live = false; };
  }, [companyId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(tab === "mine" ? await officerApi.myInstructions(companyId, openOnly) : await officerApi.teamInstructions(companyId, openOnly, branchId || undefined));
      setError(null);
    } catch (e) { setError(apiError(e, "Instructions could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId, tab, openOnly, branchId]);
  useEffect(() => { void load(); }, [load]);

  async function open(id: string) {
    setError(null);
    try { setSelected(await officerApi.instruction(companyId, id)); }
    catch (e) { setError(apiError(e, "The instruction could not be opened.")); }
  }

  async function run(job: () => Promise<unknown>, fallback: string, message?: string) {
    setBusy(true); setError(null);
    try {
      await job();
      setWork(null);
      if (message) setNotice(message);
      if (selected) setSelected(await officerApi.instruction(companyId, selected.id));
      await load();
    } catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  function confirmWork() {
    if (!work) return;
    const i = work.instruction;
    switch (work.kind) {
      case "progress": return void run(() => officerApi.progressInstruction(companyId, i.id, Number(work.percent), work.text, i.version), "Progress could not be saved.");
      case "evidence": return void run(() => officerApi.submitEvidence(companyId, i.id, work.text, work.text2, i.version), "The evidence could not be submitted.",
        i.completionMode === "transaction" ? "Submitted. The officer completes it when the record in Process360 shows it." : "Submitted for review.");
      case "blocker": return void run(() => officerApi.reportBlocker(companyId, i.id, { cause: work.text, impact: work.text2, assistanceRequired: work.text3 }),
        "The blocker could not be reported.", "Blocker reported. The deadline stays unless an exception is approved.");
      case "exception": return void run(() => officerApi.requestException(companyId, i.id, { newDueAtUtc: work.waive ? null : toUtcIso(work.due), waive: work.waive, reason: work.text }),
        "The exception could not be requested.", "Exception requested. Someone with approval rights decides it.");
      case "review": return void run(() => officerApi.reviewInstruction(companyId, i.id, work.accept, work.text, i.version), "The review could not be saved.");
      case "reassign": return void run(() => officerApi.reassignInstruction(companyId, i.id, work.employeeId, work.text, i.version), "The instruction could not be reassigned.");
      case "cancel": return void run(() => officerApi.cancelInstruction(companyId, i.id, work.text, i.version), "The instruction could not be cancelled.");
      case "resolveBlocker": return void run(() => officerApi.resolveBlocker(companyId, work.targetId, work.text), "The blocker could not be resolved.");
      case "decideException": return void run(() => officerApi.decideException(companyId, work.targetId, work.accept, work.text), "The decision could not be saved.");
    }
  }

  function workValid(w: Work) {
    switch (w.kind) {
      case "progress": { const n = Number(w.percent); return Number.isInteger(n) && n >= 0 && n <= 99; }
      case "evidence": return !!(w.text.trim() || w.text2.trim());
      case "exception": return !!w.text.trim() && (w.waive || !!w.due);
      case "review": case "decideException": return w.accept || !!w.text.trim();
      case "reassign": return !!w.employeeId && !!w.text.trim();
      default: return !!w.text.trim();
    }
  }

  function submitDraft() {
    if (!draft) return;
    void run(() => officerApi.requestInstruction(companyId, {
      branchId: draft.branchId, ownerEmployeeId: draft.ownerEmployeeId, title: draft.title, actionText: draft.actionText, reason: draft.reason, priority: draft.priority,
      dueAtUtc: toUtcIso(draft.due), requiredEvidence: draft.requiredEvidence, completionMode: draft.completionMode,
      completionRef: draft.completionMode === "transaction" ? draft.completionRef : null, mandatory: draft.mandatory, clientRequestId: newClientId(),
    }).then((a) => { setDraft(null); setNotice(a.status === "executed" ? "Instruction issued." : `Requested. ${a.authorityNote ?? "It waits for a decision under the delegated authority."}`); }),
    "The instruction could not be requested.");
  }

  const s = selected;
  const isOpen = s ? OPEN_INSTRUCTION.includes(s.status) : false;

  return (
    <div className="gl-page">
      <PageHeader title="Officer Instructions"
        subtitle="Mandatory work the officer directed, with deadlines and the evidence required. Acknowledge, report progress, raise blockers or ask for an exception; completion is checked against Process360 records."
        actions={canRequest && canView ? <Button onClick={() => setDraft({
          branchId: refs.branches[0]?.id ?? "", ownerEmployeeId: "", title: "", actionText: "", reason: "", priority: "normal", due: "", requiredEvidence: "",
          completionMode: "evidence", completionRef: "", mandatory: true,
        })}><Plus size={16} /> New instruction</Button> : null} />
      {canView ? <OfficerNav /> : null}
      <div className="gl-toolbar">
        {canView ? (
          <Field label="Show">
            <Select value={tab} onChange={(e) => setTab(e.target.value as Tab)}>
              <option value="mine">Assigned to me</option>
              <option value="team">My branches</option>
            </Select>
          </Field>
        ) : null}
        <Field label="Status">
          <Select value={openOnly ? "open" : "all"} onChange={(e) => setOpenOnly(e.target.value === "open")}>
            <option value="open">Open</option>
            <option value="all">All</option>
          </Select>
        </Field>
        {tab === "team" ? <Field label="Branch"><BranchSelect value={branchId} onChange={setBranchId} branches={refs.branches} allLabel="All my branches" /></Field> : null}
      </div>
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {tab === "mine" && changes.length > 0 ? (
        <section className="oo-changes" data-testid="instruction-changes" aria-label="Changes to your instructions">
          <StateMessage tone="warning">
            <strong>Plans were revised.</strong> Work from your current instructions; these changed in the last three days:
            <ul className="oo-evidence">
              {changes.map((c) => (
                <li key={`${c.instructionId}-${c.atUtc}`}><span>{c.title}: {c.event === "Revised" ? "deadline changed" : c.event === "Superseded" ? "replaced, stop work on it" : "cancelled"}. {c.note}</span><small>{when(c.atUtc)}</small></li>
              ))}
            </ul>
          </StateMessage>
        </section>
      ) : null}
      {error && !work && !draft && !selected ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">Loading instructions…</StateMessage> : null}

      <div className="oo-cards">
        {!loading && rows.length === 0 ? <p className="gl-muted">{tab === "mine" ? "Nothing is assigned to you." : "No instructions match."}</p> : null}
        {rows.map((i) => (
          <article key={i.id} className="oo-card">
            <div className="oo-card-head">
              <Button variant="ghost" className="oo-card-title" onClick={() => void open(i.id)}>{i.title}</Button>
              <div className="gl-chip-row">
                {i.kind === "mandatory" ? <Chip tone="neutral">Mandatory</Chip> : <Chip tone="muted">Recommended</Chip>}
                <Chip tone={INSTRUCTION_STATUS_TONE[i.status]}>{INSTRUCTION_STATUS_LABEL[i.status]}</Chip>
                {i.overdue ? <Chip tone="bad">Overdue</Chip> : i.acknowledgementOverdue ? <Chip tone="warn">Not acknowledged</Chip> : null}
              </div>
            </div>
            <p>{i.actionText}</p>
            <div className="oo-meta">
              <span>Due {when(i.dueAtUtc)}</span>
              <span>{i.ownerName ?? "Owner"}{i.ownerRole ? ` · ${i.ownerRole}` : ""}</span>
              <span>{i.branchName ?? ""}</span>
              <span>{PRIORITY_LABEL[i.priority]} priority</span>
              {i.progressPercent > 0 && OPEN_INSTRUCTION.includes(i.status) ? <span>{i.progressPercent}% done</span> : null}
            </div>
            {i.isMine && i.status === "issued" ? (
              <div className="gl-toolbar">
                <Button size="sm" disabled={busy} onClick={() => void run(() => officerApi.acknowledgeInstruction(companyId, i.id, i.version), "Could not acknowledge.", "Acknowledged.")}>Acknowledge</Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {s && !work ? (
        <GlDialog open size="wide" title={s.title} confirmText="" closeText="Close" busy={busy} error={error} onClose={() => { setSelected(null); setError(null); }}
          actions={isOpen ? <>
            {s.isMine && s.status === "issued" ? <Button type="button" disabled={busy} onClick={() => void run(() => officerApi.acknowledgeInstruction(companyId, s.id, s.version), "Could not acknowledge.")}>Acknowledge</Button> : null}
            {s.isMine ? <Button type="button" variant="outline" disabled={busy} onClick={() => setWork(blankWork("progress", s))}>Progress</Button> : null}
            {s.isMine ? <Button type="button" variant="outline" disabled={busy} onClick={() => setWork(blankWork("blocker", s))}>Report blocker</Button> : null}
            {s.isMine && !s.exceptions.some((e) => e.status === "pending") ? <Button type="button" variant="outline" disabled={busy} onClick={() => setWork(blankWork("exception", s, { due: toLocalInput(s.dueAtUtc) }))}>Ask for exception</Button> : null}
            {s.isMine && s.status !== "awaitingReview" ? <Button type="button" disabled={busy} onClick={() => setWork(blankWork("evidence", s))}>Submit completion</Button> : null}
            {canManage && !s.isMine && s.status === "awaitingReview" ? <Button type="button" disabled={busy} onClick={() => setWork(blankWork("review", s))}>Review evidence</Button> : null}
            {canManage ? <Button type="button" variant="outline" disabled={busy} onClick={() => setWork(blankWork("reassign", s))}>Reassign</Button> : null}
            {canManage ? <Button type="button" variant="outline" disabled={busy} onClick={() => setWork(blankWork("cancel", s))}>Cancel</Button> : null}
          </> : null}>
          <div className="gl-chip-row">
            <Chip tone={INSTRUCTION_STATUS_TONE[s.status]}>{INSTRUCTION_STATUS_LABEL[s.status]}</Chip>
            {s.kind === "mandatory" ? <Chip tone="neutral">Mandatory</Chip> : <Chip tone="muted">Recommended</Chip>}
            <Chip tone="muted">{PRIORITY_LABEL[s.priority]} priority</Chip>
            {s.overdue ? <Chip tone="bad">Overdue</Chip> : null}
          </div>
          <p>{s.actionText}</p>
          <dl className="gl-detail">
            <div><dt>Why</dt><dd>{s.reason || "—"}</dd></div>
            <div><dt>Authority</dt><dd>{s.authority}</dd></div>
            <div><dt>Owner</dt><dd>{s.ownerName ?? "—"}{s.ownerRole ? ` (${s.ownerRole})` : ""}</dd></div>
            <div><dt>Branch</dt><dd>{s.branchName ?? "—"}{s.departmentName ? ` · ${s.departmentName}` : ""}</dd></div>
            <div><dt>Deadline</dt><dd>{when(s.dueAtUtc)}</dd></div>
            <div><dt>Acknowledge by</dt><dd>{when(s.acknowledgeByUtc)}{s.acknowledgedAtUtc ? ` · done ${when(s.acknowledgedAtUtc)}` : ""}</dd></div>
            <div><dt>Evidence required</dt><dd>{s.requiredEvidence || "—"}</dd></div>
            <div><dt>Completion</dt><dd>{s.completionMode === "transaction" ? `Checked in Process360 (${s.completionRef ?? "record"})` : "Reviewed by an authorized person"}</dd></div>
            {s.progressNote ? <div><dt>Progress</dt><dd>{s.progressPercent}% · {s.progressNote}</dd></div> : null}
            {s.evidenceText || s.evidenceReference ? <div><dt>Submitted</dt><dd>{[s.evidenceText, s.evidenceReference].filter(Boolean).join(" · ")}</dd></div> : null}
            {s.completedAtUtc ? <div><dt>Completed</dt><dd>{when(s.completedAtUtc)} by {s.completedByName}</dd></div> : null}
            {s.escalatedAtUtc ? <div><dt>Escalated</dt><dd>{when(s.escalatedAtUtc)} to {s.escalatedToName ?? "the escalation contact"}</dd></div> : null}
            <div><dt>Issued</dt><dd>{when(s.issuedAtUtc)} by {s.issuedByName}</dd></div>
          </dl>
          {s.completionNote ? <p className="gl-note">{s.completionNote}</p> : null}

          {s.blockers.length > 0 ? <>
            <h4>Blockers</h4>
            <div className="oo-cards">
              {s.blockers.map((b) => (
                <div key={b.id} className="oo-card">
                  <div className="oo-card-head"><strong>{b.cause}</strong><Chip tone={b.status === "resolved" ? "ok" : b.status === "escalated" ? "bad" : "warn"}>{b.status === "resolved" ? "Resolved" : b.status === "escalated" ? "Escalated" : "Open"}</Chip></div>
                  {b.impact ? <p>Impact: {b.impact}</p> : null}
                  {b.assistanceRequired ? <p>Help needed: {b.assistanceRequired}</p> : null}
                  <div className="oo-meta"><span>{b.reportedByName}, {when(b.reportedAtUtc)}{b.reportedBeforeDue ? "" : " (after the deadline)"}</span><span>With {b.assignedName ?? b.assignedRole}</span></div>
                  {b.resolution ? <p className="gl-muted">{b.resolution} — {b.resolvedByName}</p> : null}
                  {b.status !== "resolved" && (canManage || b.assignedEmployeeId) ? (
                    <div className="gl-toolbar"><Button size="sm" variant="outline" disabled={busy} onClick={() => setWork(blankWork("resolveBlocker", s, { targetId: b.id }))}>Mark resolved</Button></div>
                  ) : null}
                </div>
              ))}
            </div>
          </> : null}

          {s.exceptions.length > 0 ? <>
            <h4>Exception requests</h4>
            <div className="oo-cards">
              {s.exceptions.map((x) => (
                <div key={x.id} className="oo-card">
                  <div className="oo-card-head"><strong>{x.waive ? "Release from the instruction" : `New deadline ${when(x.requestedDueAtUtc)}`}</strong>
                    <Chip tone={x.status === "approved" ? "ok" : x.status === "rejected" ? "bad" : "warn"}>{x.status === "approved" ? "Approved" : x.status === "rejected" ? "Rejected" : "Pending"}</Chip></div>
                  <p>{x.reason}</p>
                  <div className="oo-meta"><span>{x.requestedByName}, {when(x.requestedAtUtc)}</span><span>Original deadline {when(x.originalDueAtUtc)}</span>{x.decidedByName ? <span>Decided by {x.decidedByName}</span> : null}</div>
                  {x.decisionNote ? <p className="gl-muted">{x.decisionNote}</p> : null}
                  {x.status === "pending" && canApprove && !s.isMine ? (
                    <div className="gl-toolbar"><Button size="sm" variant="outline" disabled={busy} onClick={() => setWork(blankWork("decideException", s, { targetId: x.id }))}>Decide</Button></div>
                  ) : null}
                </div>
              ))}
            </div>
          </> : null}

          <h4>History</h4>
          <ul className="oo-evidence">
            {s.history.map((h, n) => (
              <li key={`${h.atUtc}-${n}`}>
                <span className="oo-evidence-type">{h.event}</span>
                <span>{when(h.atUtc)} · {h.actorName}{h.fromName || h.toName ? ` · ${h.fromName ?? "—"} → ${h.toName ?? "—"}` : ""}</span>
                {h.note ? <span>{h.note}</span> : null}
              </li>
            ))}
          </ul>
        </GlDialog>
      ) : null}

      {work ? (
        <GlDialog open title={{
          progress: "Report progress", evidence: "Submit completion", blocker: "Report a blocker", exception: "Ask for an exception", review: "Review evidence",
          reassign: "Reassign instruction", cancel: "Cancel instruction", resolveBlocker: "Resolve blocker", decideException: "Decide exception",
        }[work.kind]} description={work.instruction.title} busy={busy} error={error} onClose={() => { setWork(null); setError(null); }}
          confirmText={work.kind === "cancel" ? "Cancel instruction" : work.kind === "evidence" ? "Submit" : "Save"} danger={work.kind === "cancel"}
          confirmDisabled={!workValid(work)} onConfirm={confirmWork}>
          {work.kind === "progress" ? <>
            <Field label="Done so far (%)" hint="0–99. Completion is shown by evidence or by the record."><Input type="number" min={0} max={99} value={work.percent} onChange={(e) => setWork({ ...work, percent: e.target.value })} /></Field>
            <Field label="Note"><Textarea rows={3} value={work.text} onChange={(e) => setWork({ ...work, text: e.target.value })} /></Field>
          </> : null}
          {work.kind === "evidence" ? <>
            <p className="gl-muted">Required: {work.instruction.requiredEvidence || "a short note"}</p>
            <Field label="What was done"><Textarea rows={3} value={work.text} onChange={(e) => setWork({ ...work, text: e.target.value })} /></Field>
            <Field label="Document number (optional)"><Input value={work.text2} onChange={(e) => setWork({ ...work, text2: e.target.value })} /></Field>
          </> : null}
          {work.kind === "blocker" ? <>
            <p className="gl-muted">The deadline stays as it is. Ask for an exception if it cannot be met.</p>
            <Field label="What is blocking the work"><Textarea rows={3} value={work.text} onChange={(e) => setWork({ ...work, text: e.target.value })} /></Field>
            <Field label="Impact (optional)"><Input value={work.text2} onChange={(e) => setWork({ ...work, text2: e.target.value })} /></Field>
            <Field label="Help needed (optional)"><Input value={work.text3} onChange={(e) => setWork({ ...work, text3: e.target.value })} /></Field>
          </> : null}
          {work.kind === "exception" ? <>
            <Field label="Request">
              <Select value={work.waive ? "waive" : "extend"} onChange={(e) => setWork({ ...work, waive: e.target.value === "waive" })}>
                <option value="extend">A later deadline</option>
                <option value="waive">Release from the instruction</option>
              </Select>
            </Field>
            {!work.waive ? <Field label="New deadline"><Input type="datetime-local" value={work.due} onChange={(e) => setWork({ ...work, due: e.target.value })} /></Field> : null}
            <Field label="Why"><Textarea rows={3} value={work.text} onChange={(e) => setWork({ ...work, text: e.target.value })} /></Field>
          </> : null}
          {work.kind === "review" || work.kind === "decideException" ? <>
            <Field label="Decision">
              <Select value={work.accept ? "yes" : "no"} onChange={(e) => setWork({ ...work, accept: e.target.value === "yes" })}>
                <option value="yes">{work.kind === "review" ? "Accept — the work is complete" : "Approve"}</option>
                <option value="no">{work.kind === "review" ? "Return — something is missing" : "Reject"}</option>
              </Select>
            </Field>
            <Field label={work.accept ? "Note (optional)" : "Reason"}><Textarea rows={3} value={work.text} onChange={(e) => setWork({ ...work, text: e.target.value })} /></Field>
          </> : null}
          {work.kind === "reassign" ? <>
            <Field label="New owner"><EmployeeSelect value={work.employeeId} onChange={(v) => setWork({ ...work, employeeId: v })} employees={refs.employees} branchId={work.instruction.branchId} placeholder="Choose a person" /></Field>
            <Field label="Reason"><Textarea rows={2} value={work.text} onChange={(e) => setWork({ ...work, text: e.target.value })} /></Field>
          </> : null}
          {work.kind === "cancel" || work.kind === "resolveBlocker" ? (
            <Field label={work.kind === "cancel" ? "Reason" : "How it was resolved"}><Textarea rows={3} value={work.text} onChange={(e) => setWork({ ...work, text: e.target.value })} /></Field>
          ) : null}
        </GlDialog>
      ) : null}

      {draft ? (
        <GlDialog open size="wide" title="New instruction" description="The request passes the officer's delegated authority: it is issued at once or waits for approval."
          busy={busy} error={error} onClose={() => { setDraft(null); setError(null); }} confirmText="Request"
          confirmDisabled={!draft.branchId || !draft.ownerEmployeeId || !draft.title.trim() || !draft.actionText.trim() || !draft.due || (draft.completionMode === "transaction" && !draft.completionRef.trim())}
          onConfirm={submitDraft}>
          <div className="gl-grid">
            <Field label="Branch"><BranchSelect value={draft.branchId} onChange={(v) => setDraft({ ...draft, branchId: v })} branches={refs.branches} /></Field>
            <Field label="Owner"><EmployeeSelect value={draft.ownerEmployeeId} onChange={(v) => setDraft({ ...draft, ownerEmployeeId: v })} employees={refs.employees} branchId={draft.branchId} placeholder="Choose a person" /></Field>
            <Field label="Title" wide><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label="Action to take" wide><Textarea rows={3} value={draft.actionText} onChange={(e) => setDraft({ ...draft, actionText: e.target.value })} /></Field>
            <Field label="Why" wide><Input value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></Field>
            <Field label="Deadline"><Input type="datetime-local" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></Field>
            <Field label="Priority">
              <Select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as InstructionPriority })}>
                {(Object.keys(PRIORITY_LABEL) as InstructionPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </Select>
            </Field>
            <Field label="Type">
              <Select value={draft.mandatory ? "m" : "r"} onChange={(e) => setDraft({ ...draft, mandatory: e.target.value === "m" })}>
                <option value="m">Mandatory</option>
                <option value="r">Recommendation</option>
              </Select>
            </Field>
            <Field label="Completion shown by">
              <Select value={draft.completionMode} onChange={(e) => setDraft({ ...draft, completionMode: e.target.value as CompletionMode })}>
                <option value="evidence">Evidence reviewed by a person</option>
                <option value="transaction">A record in Process360</option>
              </Select>
            </Field>
            {draft.completionMode === "transaction" ? (
              <Field label="Record" hint="Type:id, e.g. PurchaseOrder:…, Siv:…, Grn:…, PosSession:… or Finding:…" wide>
                <Input value={draft.completionRef} onChange={(e) => setDraft({ ...draft, completionRef: e.target.value })} />
              </Field>
            ) : null}
            <Field label="Evidence required" wide><Input value={draft.requiredEvidence} onChange={(e) => setDraft({ ...draft, requiredEvidence: e.target.value })} /></Field>
          </div>
        </GlDialog>
      ) : null}
    </div>
  );
}
