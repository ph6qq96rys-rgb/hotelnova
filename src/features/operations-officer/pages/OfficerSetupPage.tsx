import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Pause, Play, Plus } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, day, Field, GlDialog, todayIso } from "../../finance/components/glShared";
import { officerApi, type AuthorityMode, type ConfigurationIssue, type Policy, type PolicyInput, type Scope, type ScopeInput, type Settings, type SettingsInput } from "../api/officerApi";
import { BranchSelect, EmployeeSelect, MODE_LABEL, OfficerNav, Section, useOfficerRefs, when } from "../components/officerShared";

const NUMBER_FIELDS: { key: keyof SettingsInput; label: string; hint: string }[] = [
  { key: "monitorIntervalMinutes", label: "Check every (minutes)", hint: "How often findings are refreshed." },
  { key: "briefingHour", label: "Briefing hour", hint: "Local hour the daily briefings are prepared." },
  { key: "unpaidSaleHours", label: "Unpaid order after (hours)", hint: "Confirmed orders not fully paid." },
  { key: "posCloseHours", label: "Drawer open longer than (hours)", hint: "POS drawers not closed." },
  { key: "sivPendingHours", label: "SIV waiting longer than (hours)", hint: "Requisitions not approved or issued." },
  { key: "grnDraftHours", label: "GRN not posted after (hours)", hint: "Receipts started but not posted." },
  { key: "poOverdueDays", label: "PO overdue after (days)", hint: "Days past the expected delivery." },
  { key: "adjustmentPendingHours", label: "Adjustment waiting longer than (hours)", hint: "Stock adjustments awaiting approval." },
  { key: "dataFreshnessHours", label: "Data stale after (hours)", hint: "Older data is reported, not used for conclusions." },
  { key: "forecastTolerancePercent", label: "Forecast tolerance (%)", hint: "Projected misses within this margin are not raised." },
];

type ScopeEditor = ScopeInput & { title: string };
type PolicyEditor = { id: string | null; input: PolicyInput };

export default function OfficerSetupPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canConfigure = useHasPermission("aiops.configure");
  const canAuthority = useHasPermission("aiops.authority.manage");
  const canPause = useHasPermission("aiops.automation.pause");
  const { refs } = useOfficerRefs(companyId);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [issues, setIssues] = useState<ConfigurationIssue[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [scopeEditor, setScopeEditor] = useState<ScopeEditor | null>(null);
  const [policyEditor, setPolicyEditor] = useState<PolicyEditor | null>(null);
  const [pause, setPause] = useState<{ kind: "pause" | "resume"; reason: string } | null>(null);
  const [retire, setRetire] = useState<{ policy: Policy; reason: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sc, p, i] = await Promise.all([officerApi.settings(companyId), officerApi.scopes(companyId, showHistory), officerApi.policies(companyId, showHistory), officerApi.configurationIssues(companyId)]);
      setSettings(s); setScopes(sc); setPolicies(p); setIssues(i); setError(null);
    } catch (e) { setError(apiError(e, "The officer's set-up could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId, showHistory]);
  useEffect(() => { void load(); }, [load]);

  async function run(job: () => Promise<unknown>, fallback: string, done?: () => void, message?: string) {
    setBusy(true); setError(null); setSaved(null);
    try { await job(); done?.(); if (message) setSaved(message); await load(); }
    catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  const actionLabel = useMemo(() => Object.fromEntries(refs.actionTypes.map((t) => [t.key, t])), [refs.actionTypes]);
  const editingType = policyEditor ? actionLabel[policyEditor.input.actionType] : undefined;

  function saveSettings() {
    if (!settings) return;
    const input: SettingsInput = {
      enabled: settings.enabled, monitorIntervalMinutes: settings.monitorIntervalMinutes, briefingHour: settings.briefingHour, narrativeEnabled: settings.narrativeEnabled,
      unpaidSaleHours: settings.unpaidSaleHours, posCloseHours: settings.posCloseHours, sivPendingHours: settings.sivPendingHours, grnDraftHours: settings.grnDraftHours,
      poOverdueDays: settings.poOverdueDays, adjustmentPendingHours: settings.adjustmentPendingHours, dataFreshnessHours: settings.dataFreshnessHours,
      forecastTolerancePercent: settings.forecastTolerancePercent, version: settings.version ?? null,
    };
    void run(() => officerApi.saveSettings(companyId, input), "The settings could not be saved.", undefined, "Settings saved.");
  }

  const s = settings;
  return (
    <div className="gl-page">
      <PageHeader title="Officer Setup & Authority" subtitle="What the officer manages, who is responsible there, and which decisions it may recommend, prepare or carry out on its own." />
      <OfficerNav />
      {error && !scopeEditor && !policyEditor && !pause && !retire ? <StateMessage tone="error">{error}</StateMessage> : null}
      {saved ? <StateMessage tone="success">{saved}</StateMessage> : null}
      {loading && !s ? <StateMessage tone="loading">Loading…</StateMessage> : null}

      {s ? (
        <div className={s.automationPaused ? "gl-note gl-note--bad oo-paused" : "gl-note oo-paused"}>
          <span>{s.automationPaused ? `Automation is paused since ${when(s.pausedAtUtc)} by ${s.pausedByName}: ${s.pauseReason}. Nothing executes; pending actions stay visible.`
            : `Automation is running. Authority policy version ${s.policyVersion}. Last check ${when(s.lastMonitoredAtUtc)}.`}</span>
          {canPause ? (s.automationPaused
            ? <Button size="sm" onClick={() => setPause({ kind: "resume", reason: "" })}><Play size={16} /> Resume</Button>
            : <Button size="sm" variant="destructive" onClick={() => setPause({ kind: "pause", reason: "" })}><Pause size={16} /> Pause now</Button>) : null}
        </div>
      ) : null}

      {issues.length ? (
        <Section title="Set-up issues" hint="Missing responsibilities mean findings would have no owner.">
          {issues.map((i) => <div key={i.message} className={i.severity === "Error" ? "gl-note gl-note--bad" : i.severity === "Warning" ? "gl-note gl-note--warn" : "gl-note"}>{i.message}</div>)}
        </Section>
      ) : null}

      {s ? (
        <Section title="Settings" actions={canConfigure ? <Button onClick={saveSettings} disabled={busy}>Save settings</Button> : null}>
          <div className="gl-toolbar">
            <label className="gl-check"><Checkbox disabled={!canConfigure} checked={s.enabled} onChange={(e) => setSettings({ ...s, enabled: e.target.checked })} /> Officer switched on (monitors, briefs and acts)</label>
            <label className="gl-check"><Checkbox disabled={!canConfigure || !s.narrativeAvailable} checked={s.narrativeEnabled} onChange={(e) => setSettings({ ...s, narrativeEnabled: e.target.checked })} />
              Plain-language summary in briefings{s.narrativeAvailable ? " (sends briefing figures to the model provider)" : " (no model configured)"}</label>
          </div>
          <div className="gl-grid">
            {NUMBER_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <Input type="number" disabled={!canConfigure} value={String(s[f.key as keyof Settings] ?? "")}
                  onChange={(e) => setSettings({ ...s, [f.key]: Number(e.target.value) })} />
              </Field>
            ))}
          </div>
        </Section>
      ) : null}

      <div className="gl-toolbar"><label className="gl-check"><Checkbox checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} /> Show history (ended scope rows and replaced policies)</label></div>

      <Section title="Managed scope" hint="Branches the officer directs, and the departments and stock locations within them. Changes take effect today or later and are never backdated."
        actions={canConfigure ? <Button variant="outline" onClick={() => { setError(null); setScopeEditor({ title: "Add to scope", branchId: refs.branches[0]?.id ?? "", isManaged: true, effectiveFrom: todayIso() }); }}><Plus size={16} /> Add</Button> : null}>
        <div className="gl-table-wrap">
          <table className="gl-table">
            <thead><tr><th>Branch / unit</th><th>Managed</th><th>Responsible</th><th>Escalation</th><th>Effective</th><th /></tr></thead>
            <tbody>
              {scopes.length === 0 ? <tr><td colSpan={6} className="gl-empty">Nothing is managed yet.</td></tr> : null}
              {scopes.map((x) => (
                <tr key={x.id} className={x.effectiveTo && x.effectiveTo < todayIso() ? "is-muted" : ""}>
                  <td>{x.level === "branch" ? <strong>{x.branchName}</strong> : <>{x.departmentName ?? x.stockLocationName}<small>{x.branchName} · {x.level === "department" ? "department" : "stock location"}</small></>}</td>
                  <td>{x.isManaged ? <Chip tone="ok">Managed</Chip> : <Chip tone="muted">Not managed</Chip>}</td>
                  <td>{x.responsibleName ?? <Chip tone="bad">Missing</Chip>}</td>
                  <td>{x.escalationName ?? "—"}</td>
                  <td>{day(x.effectiveFrom)}{x.effectiveTo ? ` – ${day(x.effectiveTo)}` : ""}<small>{x.createdByName}</small></td>
                  <td className="gl-actions">{canConfigure && (!x.effectiveTo || x.effectiveTo >= todayIso()) ? <Button size="sm" variant="ghost" onClick={() => setScopeEditor({
                    title: "Change responsibility", branchId: x.branchId, departmentId: x.departmentId, stockLocationId: x.stockLocationId, isManaged: x.isManaged,
                    responsibleEmployeeId: x.responsibleEmployeeId, escalationEmployeeId: x.escalationEmployeeId, effectiveFrom: todayIso(), notes: "",
                  })}>Change</Button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Delegated authority" hint="Without a policy the officer only recommends. Limits move execution to approval; actions are checked again just before they run, and the officer never approves its own requests."
        actions={canAuthority ? <Button variant="outline" onClick={() => { setError(null); setPolicyEditor({ id: null, input: { actionType: refs.actionTypes[0]?.key ?? "finding.assign", mode: "recommend", requiresIndependentApproval: true } }); }}><Plus size={16} /> Add policy</Button> : null}>
        <div className="gl-table-wrap">
          <table className="gl-table">
            <thead><tr><th>Action</th><th>Mode</th><th>Applies to</th><th>Limits</th><th>Version</th><th /></tr></thead>
            <tbody>
              {policies.length === 0 ? <tr><td colSpan={6} className="gl-empty">No delegated authority yet: the officer only recommends.</td></tr> : null}
              {policies.map((p) => (
                <tr key={p.id} className={p.isActive ? "" : "is-muted"}>
                  <td>{p.actionLabel}<small>{p.notes}</small></td>
                  <td>{MODE_LABEL[p.mode]}{p.requiresIndependentApproval ? <small>independent approver</small> : null}</td>
                  <td>{p.branchName ?? "All branches"}{p.category ? <small>Category {p.category}</small> : null}</td>
                  <td>{p.maxValue !== null && p.maxValue !== undefined ? `Up to ${p.maxValue}` : "No value limit"}{p.allowedFromHour !== null && p.allowedFromHour !== undefined ? <small>{p.allowedFromHour}:00–{p.allowedToHour}:00</small> : null}</td>
                  <td>v{p.policyVersion}<small>{p.createdByName} · {when(p.effectiveFromUtc)}{p.effectiveToUtc ? ` → ${when(p.effectiveToUtc)}` : ""}</small></td>
                  <td className="gl-actions">{canAuthority && p.isActive ? <>
                    <Button size="sm" variant="ghost" onClick={() => setPolicyEditor({ id: p.id, input: {
                      actionType: p.actionType, mode: p.mode, branchId: p.branchId, category: p.category, supplierId: p.supplierId, maxValue: p.maxValue,
                      allowedFromHour: p.allowedFromHour, allowedToHour: p.allowedToHour, requiresIndependentApproval: p.requiresIndependentApproval,
                      approverPermission: p.approverPermission, notes: p.notes, version: p.version,
                    } })}>Change</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRetire({ policy: p, reason: "" })}>Remove</Button>
                  </> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {scopeEditor ? (
        <GlDialog open title={scopeEditor.title} busy={busy} error={error} onClose={() => setScopeEditor(null)} confirmText="Save" confirmDisabled={!scopeEditor.branchId}
          onConfirm={() => { const { title, ...input } = scopeEditor; void title; void run(() => officerApi.saveScope(companyId, input), "The scope could not be saved.", () => setScopeEditor(null), "Scope saved."); }}>
          <div className="gl-grid">
            <Field label="Branch"><BranchSelect value={scopeEditor.branchId} onChange={(v) => setScopeEditor({ ...scopeEditor, branchId: v, departmentId: null, stockLocationId: null })} branches={refs.branches} /></Field>
            <Field label="Unit" hint="Leave on the whole branch, or pick a department or stock location within it.">
              <Select value={scopeEditor.departmentId ? `d:${scopeEditor.departmentId}` : scopeEditor.stockLocationId ? `l:${scopeEditor.stockLocationId}` : ""}
                onChange={(e) => { const v = e.target.value; setScopeEditor({ ...scopeEditor, departmentId: v.startsWith("d:") ? v.slice(2) : null, stockLocationId: v.startsWith("l:") ? v.slice(2) : null }); }}>
                <option value="">Whole branch</option>
                <optgroup label="Departments">{refs.departments.filter((d) => d.branchId === scopeEditor.branchId).map((d) => <option key={d.id} value={`d:${d.id}`}>{d.name}</option>)}</optgroup>
                <optgroup label="Stock locations">{refs.locations.filter((l) => l.branchId === scopeEditor.branchId).map((l) => <option key={l.id} value={`l:${l.id}`}>{l.name}</option>)}</optgroup>
              </Select>
            </Field>
            <Field label="Responsible manager"><EmployeeSelect value={scopeEditor.responsibleEmployeeId ?? ""} onChange={(v) => setScopeEditor({ ...scopeEditor, responsibleEmployeeId: v || null })} employees={refs.employees} branchId={scopeEditor.branchId} /></Field>
            <Field label="Escalation contact"><EmployeeSelect value={scopeEditor.escalationEmployeeId ?? ""} onChange={(v) => setScopeEditor({ ...scopeEditor, escalationEmployeeId: v || null })} employees={refs.employees} branchId={scopeEditor.branchId} /></Field>
            <Field label="Effective from" hint="Today or later."><Input type="date" min={todayIso()} value={scopeEditor.effectiveFrom ?? todayIso()} onChange={(e) => setScopeEditor({ ...scopeEditor, effectiveFrom: e.target.value })} /></Field>
            <Field label="Notes (optional)" wide><Input value={scopeEditor.notes ?? ""} onChange={(e) => setScopeEditor({ ...scopeEditor, notes: e.target.value })} /></Field>
          </div>
          <label className="gl-check"><Checkbox checked={scopeEditor.isManaged} onChange={(e) => setScopeEditor({ ...scopeEditor, isManaged: e.target.checked })} /> Managed by the officer</label>
        </GlDialog>
      ) : null}

      {policyEditor ? (
        <GlDialog open size="wide" title={policyEditor.id ? "Change policy" : "Add policy"} busy={busy} error={error} onClose={() => setPolicyEditor(null)} confirmText="Save policy"
          description={policyEditor.id ? "The current policy is kept as history and the company's policy version goes up." : undefined}
          onConfirm={() => void run(() => officerApi.savePolicy(companyId, policyEditor.id, policyEditor.input), "The policy could not be saved.", () => setPolicyEditor(null), "Policy saved.")}>
          <div className="gl-grid">
            <Field label="Action" hint={editingType?.description}>
              <Select value={policyEditor.input.actionType} disabled={!!policyEditor.id} onChange={(e) => setPolicyEditor({ ...policyEditor, input: { ...policyEditor.input, actionType: e.target.value, mode: "recommend" } })}>
                {refs.actionTypes.map((t) => <option key={t.key} value={t.key}>{t.label}{t.executable ? "" : ` (${t.availableFrom ?? "recommend only"})`}</option>)}
              </Select>
            </Field>
            <Field label="Mode">
              <Select value={policyEditor.input.mode} onChange={(e) => setPolicyEditor({ ...policyEditor, input: { ...policyEditor.input, mode: e.target.value as AuthorityMode } })}>
                {(Object.keys(MODE_LABEL) as AuthorityMode[]).map((m) => <option key={m} value={m} disabled={m === "executeWithinPolicy" && !editingType?.executable}>{MODE_LABEL[m]}</option>)}
              </Select>
            </Field>
            <Field label="Branch"><BranchSelect value={policyEditor.input.branchId ?? ""} onChange={(v) => setPolicyEditor({ ...policyEditor, input: { ...policyEditor.input, branchId: v || null } })} branches={refs.branches} allLabel="All branches" /></Field>
            <Field label="Category (optional)"><Input value={policyEditor.input.category ?? ""} onChange={(e) => setPolicyEditor({ ...policyEditor, input: { ...policyEditor.input, category: e.target.value || null } })} /></Field>
            <Field label="Value limit (optional)" hint="Above it the action needs approval."><Input type="number" step="any" value={policyEditor.input.maxValue ?? ""} onChange={(e) => setPolicyEditor({ ...policyEditor, input: { ...policyEditor.input, maxValue: e.target.value === "" ? null : Number(e.target.value) } })} /></Field>
            <Field label="Allowed from hour (optional)"><Input type="number" min={0} max={23} value={policyEditor.input.allowedFromHour ?? ""} onChange={(e) => setPolicyEditor({ ...policyEditor, input: { ...policyEditor.input, allowedFromHour: e.target.value === "" ? null : Number(e.target.value) } })} /></Field>
            <Field label="Allowed until hour (optional)"><Input type="number" min={1} max={24} value={policyEditor.input.allowedToHour ?? ""} onChange={(e) => setPolicyEditor({ ...policyEditor, input: { ...policyEditor.input, allowedToHour: e.target.value === "" ? null : Number(e.target.value) } })} /></Field>
            <Field label="Approver also needs permission (optional)" hint={editingType?.approverPermission ? `Default: ${editingType.approverPermission}` : undefined}>
              <Input value={policyEditor.input.approverPermission ?? ""} onChange={(e) => setPolicyEditor({ ...policyEditor, input: { ...policyEditor.input, approverPermission: e.target.value || null } })} />
            </Field>
            <Field label="Notes (optional)" wide><Textarea rows={2} value={policyEditor.input.notes ?? ""} onChange={(e) => setPolicyEditor({ ...policyEditor, input: { ...policyEditor.input, notes: e.target.value } })} /></Field>
          </div>
          <label className="gl-check"><Checkbox checked={policyEditor.input.requiresIndependentApproval} onChange={(e) => setPolicyEditor({ ...policyEditor, input: { ...policyEditor.input, requiresIndependentApproval: e.target.checked } })} /> The person who requests an action cannot approve it</label>
        </GlDialog>
      ) : null}

      {pause ? (
        <GlDialog open title={pause.kind === "pause" ? "Pause the officer" : "Resume the officer"} busy={busy} error={error} onClose={() => setPause(null)}
          danger={pause.kind === "pause"} confirmText={pause.kind === "pause" ? "Pause now" : "Resume"} confirmDisabled={pause.kind === "pause" && !pause.reason.trim()}
          description={pause.kind === "pause" ? "Nothing executes while paused. Monitoring and briefings continue; pending and approved actions wait, visibly." : "Approved actions that are due will run."}
          onConfirm={() => void run(() => (pause.kind === "pause" ? officerApi.pause(companyId, pause.reason) : officerApi.resume(companyId, pause.reason)), "Could not change automation.", () => setPause(null))}>
          <Field label={pause.kind === "pause" ? "Reason" : "Note (optional)"}><Textarea rows={3} value={pause.reason} onChange={(e) => setPause({ ...pause, reason: e.target.value })} /></Field>
        </GlDialog>
      ) : null}

      {retire ? (
        <GlDialog open title="Remove policy" busy={busy} error={error} onClose={() => setRetire(null)} danger confirmText="Remove" confirmDisabled={!retire.reason.trim()}
          description={`${retire.policy.actionLabel}: the officer falls back to the next matching policy, or to recommending.`}
          onConfirm={() => void run(() => officerApi.retirePolicy(companyId, retire.policy.id, retire.reason), "The policy could not be removed.", () => setRetire(null))}>
          <Field label="Reason"><Textarea rows={3} value={retire.reason} onChange={(e) => setRetire({ ...retire, reason: e.target.value })} /></Field>
        </GlDialog>
      ) : null}
    </div>
  );
}
