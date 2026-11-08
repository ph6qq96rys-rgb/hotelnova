import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, day, Field, GlDialog, todayIso } from "../../finance/components/glShared";
import { officerApi, type Metric, type PeriodType, type Target, type TargetInput } from "../api/officerApi";
import { BranchSelect, EmployeeSelect, metricValue, OfficerNav, TARGET_STATUS_LABEL, TARGET_STATUS_TONE, useOfficerRefs, when } from "../components/officerShared";

const PERIOD_LABEL: Record<PeriodType, string> = { daily: "Daily", weekly: "Weekly (Mon–Sun)", monthly: "Monthly", custom: "Whole date range" };

type Editor = { mode: "create" | "edit" | "amend"; target?: Target; input: TargetInput };
type Decision = { target: Target; kind: "approve" | "reject" | "retire"; text: string };

const plusDays = (iso: string, days: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

function toInput(t: Target): TargetInput {
  return {
    name: t.name, metric: t.metric, direction: t.direction, branchId: t.branchId ?? null, departmentId: t.departmentId ?? null, baseline: t.baseline ?? null,
    targetValue: t.targetValue, periodType: t.periodType, startDate: t.startDate, endDate: t.endDate, accountableRole: t.accountableRole,
    accountableEmployeeId: t.accountableEmployeeId ?? null, dependencies: t.dependencies ?? "", constraints: t.constraints ?? "", amendmentReason: t.amendmentReason ?? "",
    appliesRetroactively: t.appliesRetroactively, retroactiveDecision: t.retroactiveDecision ?? "", version: t.version,
  };
}

export default function OfficerTargetsPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canManage = useHasPermission("aiops.targets.manage");
  const canApprove = useHasPermission("aiops.targets.approve");
  const { refs } = useOfficerRefs(companyId);
  const [history, setHistory] = useState(false);
  const [rows, setRows] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [selected, setSelected] = useState<Target | null>(null);
  const [versions, setVersions] = useState<Target[] | null>(null);
  const [concern, setConcern] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await officerApi.targets(companyId, history)); setError(null); }
    catch (e) { setError(apiError(e, "Targets could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId, history]);
  useEffect(() => { void load(); }, [load]);

  const metric = useMemo(() => Object.fromEntries(refs.metrics.map((m) => [m.metric, m])), [refs.metrics]);

  async function run(job: () => Promise<unknown>, fallback: string, done?: () => void) {
    setBusy(true); setError(null);
    try { await job(); done?.(); await load(); }
    catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  function openNew() {
    const start = todayIso();
    setError(null);
    setEditor({ mode: "create", input: {
      name: "", metric: "netSales", direction: null, branchId: null, departmentId: null, baseline: null, targetValue: 0, periodType: "daily", startDate: start,
      endDate: plusDays(start, 90), accountableRole: "Branch manager", accountableEmployeeId: null, dependencies: "", constraints: "", amendmentReason: "",
      appliesRetroactively: false, retroactiveDecision: "", version: null,
    } });
  }

  async function openTarget(t: Target) {
    setSelected(t); setVersions(null); setConcern(""); setError(null);
    try { setVersions(await officerApi.targetVersions(companyId, t.targetGroupId)); } catch { setVersions([]); }
  }

  function save() {
    if (!editor) return;
    const input = { ...editor.input, direction: editor.input.direction || null };
    if (editor.mode === "create") void run(() => officerApi.createTarget(companyId, input), "The target could not be saved.", () => setEditor(null));
    else if (editor.mode === "edit") void run(() => officerApi.updateTarget(companyId, editor.target!.id, input), "The target could not be saved.", () => setEditor(null));
    else void run(() => officerApi.amendTarget(companyId, editor.target!.id, input), "The amendment could not be saved.", () => setEditor(null));
  }

  function decide() {
    if (!decision) return;
    const { target: t, kind, text } = decision;
    const job = kind === "approve" ? () => officerApi.approveTarget(companyId, t.id, text || undefined, t.version)
      : kind === "reject" ? () => officerApi.rejectTarget(companyId, t.id, text, t.version) : () => officerApi.retireTarget(companyId, t.id, text, t.version);
    void run(job, "The decision could not be saved.", () => { setDecision(null); setSelected(null); });
  }

  const e = editor?.input;
  const def = e ? metric[e.metric] : undefined;
  const pastStart = !!e && e.startDate < todayIso();
  const set = (patch: Partial<TargetInput>) => editor && setEditor({ ...editor, input: { ...editor.input, ...patch } });

  return (
    <div className="gl-page">
      <PageHeader title="Officer Targets" subtitle="Measurable results each branch is responsible for. A target takes effect once someone other than its author approves it; changes are new versions and never rewrite the past."
        actions={canManage ? <Button onClick={openNew}><Plus size={16} /> New target</Button> : null} />
      <OfficerNav />
      <div className="gl-toolbar"><label className="gl-check"><Checkbox checked={history} onChange={(ev) => setHistory(ev.target.checked)} /> Show superseded and retired versions</label></div>
      {error && !editor && !decision && !selected ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">Loading targets…</StateMessage> : null}

      <div className="gl-table-wrap">
        <table className="gl-table">
          <thead><tr><th>Target</th><th>Branch</th><th className="gl-num">Value</th><th>Period</th><th>Dates</th><th>Accountable</th><th>Status</th></tr></thead>
          <tbody>
            {!loading && rows.length === 0 ? <tr><td colSpan={7} className="gl-empty">No targets yet.</td></tr> : null}
            {rows.map((t) => (
              <tr key={t.id} className={t.status === "superseded" || t.status === "retired" ? "gl-row is-muted" : "gl-row"} tabIndex={0} onClick={() => void openTarget(t)}
                onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); void openTarget(t); } }}>
                <td>{t.name}<small>{t.metricLabel}{t.versionNo > 1 ? ` · v${t.versionNo}` : ""}{t.concerns.some((c) => !c.response) ? " · open concern" : ""}</small></td>
                <td>{t.branchName ?? "Company"}{t.departmentName ? <small>{t.departmentName}</small> : null}</td>
                <td className="gl-num">{t.direction === "atLeast" ? "≥ " : "≤ "}{metricValue(t.unit, t.targetValue)}</td>
                <td>{PERIOD_LABEL[t.periodType]}</td>
                <td>{day(t.startDate)} – {day(t.endDate)}</td>
                <td>{t.accountableName ?? t.accountableRole}</td>
                <td><Chip tone={TARGET_STATUS_TONE[t.status]}>{TARGET_STATUS_LABEL[t.status]}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <GlDialog open size="wide" title={`${selected.name}${selected.versionNo > 1 ? ` · v${selected.versionNo}` : ""}`} confirmText="" closeText="Close" busy={busy} error={error}
          onClose={() => setSelected(null)}
          actions={<>
            {canManage && (selected.status === "draft" || selected.status === "rejected") ? <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => { setEditor({ mode: "edit", target: selected, input: toInput(selected) }); setSelected(null); }}>Edit</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => officerApi.deleteTarget(companyId, selected.id), "The draft could not be discarded.", () => setSelected(null))}>Discard</Button>
            </> : null}
            {canManage && selected.status === "draft" ? <Button type="button" disabled={busy} onClick={() => void run(() => officerApi.submitTarget(companyId, selected.id, selected.version), "The target could not be submitted.", () => setSelected(null))}>Submit for approval</Button> : null}
            {canApprove && selected.status === "pendingApproval" ? <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setDecision({ target: selected, kind: "reject", text: "" })}>Reject</Button>
              <Button type="button" disabled={busy} onClick={() => setDecision({ target: selected, kind: "approve", text: "" })}>Approve</Button>
            </> : null}
            {canManage && selected.status === "active" ? <Button type="button" variant="outline" disabled={busy} onClick={() => {
              const start = plusDays(todayIso(), 1);
              setEditor({ mode: "amend", target: selected, input: { ...toInput(selected), startDate: selected.startDate >= start ? plusDays(selected.startDate, 1) : start, amendmentReason: "", appliesRetroactively: false, retroactiveDecision: "" } });
              setSelected(null);
            }}>Amend</Button> : null}
            {canApprove && selected.status === "active" ? <Button type="button" variant="outline" disabled={busy} onClick={() => setDecision({ target: selected, kind: "retire", text: "" })}>Retire</Button> : null}
          </>}>
          <dl className="gl-detail">
            <div><dt>Metric</dt><dd>{selected.metricLabel}</dd></div>
            <div><dt>Target</dt><dd>{selected.direction === "atLeast" ? "At least " : "At most "}{metricValue(selected.unit, selected.targetValue)}</dd></div>
            <div><dt>Baseline</dt><dd>{metricValue(selected.unit, selected.baseline)}</dd></div>
            <div><dt>Period</dt><dd>{PERIOD_LABEL[selected.periodType]}</dd></div>
            <div><dt>Dates</dt><dd>{day(selected.startDate)} – {day(selected.endDate)}</dd></div>
            <div><dt>Scope</dt><dd>{selected.branchName ?? "Whole company"}{selected.departmentName ? ` · ${selected.departmentName}` : ""}</dd></div>
            <div><dt>Accountable</dt><dd>{selected.accountableRole}{selected.accountableName ? ` · ${selected.accountableName}` : ""}</dd></div>
            <div><dt>Data source</dt><dd>{selected.dataSource}</dd></div>
            <div><dt>Status</dt><dd>{TARGET_STATUS_LABEL[selected.status]}{selected.decidedByName ? ` · ${selected.decidedByName}, ${when(selected.decidedAtUtc)}` : ""}</dd></div>
          </dl>
          <p className="gl-muted">Calculation: {selected.calculation}</p>
          {selected.dependencies ? <p><strong>Depends on:</strong> {selected.dependencies}</p> : null}
          {selected.constraints ? <p><strong>Operating constraints:</strong> {selected.constraints}</p> : null}
          {selected.amendmentReason ? <p><strong>Why amended:</strong> {selected.amendmentReason}</p> : null}
          {selected.appliesRetroactively ? <p className="gl-note gl-note--warn">Applies from a past date by decision: {selected.retroactiveDecision}</p> : null}
          {selected.decisionNote ? <p className="gl-note">{selected.decisionNote}</p> : null}

          <h4>Concerns</h4>
          {selected.concerns.length === 0 ? <p className="gl-muted">No concerns recorded.</p> : (
            <div className="oo-cards">
              {selected.concerns.map((c) => (
                <div key={c.id} className="oo-card">
                  <p>{c.text}</p>
                  <div className="oo-meta"><span>{c.raisedByName}</span><span>{when(c.raisedAtUtc)}</span></div>
                  {c.response ? <p className="gl-note">{c.response} — {c.respondedByName}, {when(c.respondedAtUtc)}</p> : canManage ? (
                    <div className="gl-toolbar">
                      <Input className="gl-grow" placeholder="Reply" value={replies[c.id] ?? ""} onChange={(ev) => setReplies({ ...replies, [c.id]: ev.target.value })} />
                      <Button type="button" size="sm" disabled={busy || !(replies[c.id] ?? "").trim()} onClick={() => void run(() => officerApi.respondConcern(companyId, c.id, replies[c.id]), "The reply could not be saved.", () => setSelected(null))}>Reply</Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <div className="gl-toolbar">
            <Input className="gl-grow" placeholder="Record a concern about this target" value={concern} onChange={(ev) => setConcern(ev.target.value)} />
            <Button type="button" variant="outline" size="sm" disabled={busy || !concern.trim()} onClick={() => void run(() => officerApi.raiseConcern(companyId, selected.id, concern), "The concern could not be saved.", () => setSelected(null))}>Record concern</Button>
          </div>

          <h4>Versions</h4>
          {versions === null ? <p className="gl-muted">Loading…</p> : (
            <div className="gl-table-wrap">
              <table className="gl-table">
                <thead><tr><th>Version</th><th className="gl-num">Target</th><th>Dates</th><th>Status</th><th>By</th></tr></thead>
                <tbody>{versions.map((v) => (
                  <tr key={v.id}><td>v{v.versionNo}</td><td className="gl-num">{metricValue(v.unit, v.targetValue)}</td><td>{day(v.startDate)} – {day(v.endDate)}</td>
                    <td><Chip tone={TARGET_STATUS_TONE[v.status]}>{TARGET_STATUS_LABEL[v.status]}</Chip></td><td>{v.createdByName}<small>{v.decidedByName ? `approved by ${v.decidedByName}` : ""}</small></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </GlDialog>
      ) : null}

      {editor && e ? (
        <GlDialog open size="wide" busy={busy} error={error} onClose={() => setEditor(null)} onConfirm={save}
          title={editor.mode === "create" ? "New target" : editor.mode === "edit" ? "Edit target" : `Amend ${editor.target?.name}`}
          description={editor.mode === "amend" ? "The current version stays in force until this amendment is approved; it then ends the day before the amendment starts." : undefined}
          confirmText={editor.mode === "amend" ? "Save amendment" : "Save draft"}
          confirmDisabled={!e.name.trim() || !e.accountableRole.trim() || (editor.mode === "amend" && !e.amendmentReason?.trim()) || (pastStart && (!e.appliesRetroactively || !e.retroactiveDecision?.trim()))}>
          <div className="gl-grid">
            <Field label="Name" wide><Input value={e.name} onChange={(ev) => set({ name: ev.target.value })} required /></Field>
            <Field label="Metric" hint={def?.calculation}>
              <Select value={e.metric} disabled={editor.mode === "amend"} onChange={(ev) => set({ metric: ev.target.value as Metric, direction: null })}>
                {refs.metrics.map((m) => <option key={m.metric} value={m.metric}>{m.label}</option>)}
              </Select>
            </Field>
            <Field label="Direction">
              <Select value={e.direction ?? def?.defaultDirection ?? "atLeast"} onChange={(ev) => set({ direction: ev.target.value as TargetInput["direction"] })}>
                <option value="atLeast">At least</option><option value="atMost">At most</option>
              </Select>
            </Field>
            <Field label={def?.unit === "percent" ? "Target (%)" : "Target"}><Input type="number" step="any" value={e.targetValue} onChange={(ev) => set({ targetValue: Number(ev.target.value) })} /></Field>
            <Field label="Baseline (optional)"><Input type="number" step="any" value={e.baseline ?? ""} onChange={(ev) => set({ baseline: ev.target.value === "" ? null : Number(ev.target.value) })} /></Field>
            <Field label="Branch">
              <BranchSelect value={e.branchId ?? ""} onChange={(v) => set({ branchId: v || null, departmentId: null })} branches={refs.branches.filter((b) => b.isActive)} allLabel="Whole company" />
            </Field>
            {editor.mode !== "amend" && e.branchId ? (
              <Field label="Department (optional)">
                <Select value={e.departmentId ?? ""} onChange={(ev) => set({ departmentId: ev.target.value || null })}>
                  <option value="">Whole branch</option>
                  {refs.departments.filter((d) => d.branchId === e.branchId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
            ) : null}
            <Field label="Measured" hint={def?.pointInTime ? "This metric is measured as it stands now." : undefined}>
              <Select value={e.periodType} onChange={(ev) => set({ periodType: ev.target.value as PeriodType })}>
                {(Object.keys(PERIOD_LABEL) as PeriodType[]).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
              </Select>
            </Field>
            <Field label="From"><Input type="date" value={e.startDate} onChange={(ev) => set({ startDate: ev.target.value })} /></Field>
            <Field label="To"><Input type="date" value={e.endDate} onChange={(ev) => set({ endDate: ev.target.value })} /></Field>
            <Field label="Accountable role"><Input value={e.accountableRole} onChange={(ev) => set({ accountableRole: ev.target.value })} /></Field>
            <Field label="Accountable person (optional)">
              <EmployeeSelect value={e.accountableEmployeeId ?? ""} onChange={(v) => set({ accountableEmployeeId: v || null })} employees={refs.employees} branchId={e.branchId ?? undefined} />
            </Field>
            <Field label="Depends on (optional)" wide hint="Teams or suppliers this result depends on."><Textarea rows={2} value={e.dependencies ?? ""} onChange={(ev) => set({ dependencies: ev.target.value })} /></Field>
            <Field label="Operating constraints (optional)" wide><Textarea rows={2} value={e.constraints ?? ""} onChange={(ev) => set({ constraints: ev.target.value })} /></Field>
            {editor.mode === "amend" ? <Field label="Why the target changes" wide><Textarea rows={2} value={e.amendmentReason ?? ""} onChange={(ev) => set({ amendmentReason: ev.target.value })} /></Field> : null}
          </div>
          {pastStart ? (
            <div className="gl-note gl-note--warn">
              <label className="gl-check"><Checkbox checked={e.appliesRetroactively} onChange={(ev) => set({ appliesRetroactively: ev.target.checked })} /> Judge past days against this target</label>
              {e.appliesRetroactively ? <Field label="Recorded decision (who decided, when, why)" wide><Textarea rows={2} value={e.retroactiveDecision ?? ""} onChange={(ev) => set({ retroactiveDecision: ev.target.value })} /></Field>
                : <p className="gl-muted">A target cannot start in the past without an explicit, recorded decision. Move the start date to today or later.</p>}
            </div>
          ) : null}
        </GlDialog>
      ) : null}

      {decision ? (
        <GlDialog open busy={busy} error={error} onClose={() => setDecision(null)} onConfirm={decide} danger={decision.kind !== "approve"}
          title={decision.kind === "approve" ? "Approve target" : decision.kind === "reject" ? "Reject target" : "Retire target"}
          description={decision.kind === "retire" ? "The target ends today. Past days stay judged against it." : decision.target.name}
          confirmText={decision.kind === "approve" ? "Approve" : decision.kind === "reject" ? "Reject" : "Retire"}
          confirmDisabled={decision.kind !== "approve" && !decision.text.trim()}>
          <Field label={decision.kind === "approve" ? "Note (optional)" : "Reason"}><Textarea rows={3} value={decision.text} onChange={(ev) => setDecision({ ...decision, text: ev.target.value })} /></Field>
        </GlDialog>
      ) : null}
    </div>
  );
}
