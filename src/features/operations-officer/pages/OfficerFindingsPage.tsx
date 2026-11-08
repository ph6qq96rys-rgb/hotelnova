import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Play } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, day, Field, GlDialog } from "../../finance/components/glShared";
import { officerApi, type Finding, type FindingKind, type FindingStatus, type Severity } from "../api/officerApi";
import {
  BranchSelect, EmployeeSelect, EvidenceList, FINDING_STATUS_LABEL, KIND_LABEL, newClientId, OfficerNav, SEVERITY_LABEL, SeverityChip, useOfficerRefs, when,
} from "../components/officerShared";

type Work = { finding: Finding; kind: "resolve" | "dismiss" | "assign" | "escalate"; text: string; employeeId: string };

export default function OfficerFindingsPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canManage = useHasPermission("aiops.findings.manage");
  const canRequest = useHasPermission("aiops.actions.request");
  const canRun = useHasPermission("aiops.configure");
  const { refs } = useOfficerRefs(companyId);
  const [status, setStatus] = useState<"active" | FindingStatus>("active");
  const [kind, setKind] = useState<"" | FindingKind>("");
  const [severity, setSeverity] = useState<"" | Severity>("");
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Finding | null>(null);
  const [work, setWork] = useState<Work | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await officerApi.findings(companyId, {
        status: status === "active" ? ["open", "acknowledged"] : [status], kind: kind ? [kind] : undefined, minSeverity: severity || undefined, branchId: branchId || undefined,
      }));
      setError(null);
    } catch (e) { setError(apiError(e, "Findings could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId, status, kind, severity, branchId]);
  useEffect(() => { void load(); }, [load]);

  async function run(job: () => Promise<unknown>, fallback: string, done?: () => void) {
    setBusy(true); setError(null);
    try { await job(); done?.(); setSelected(null); await load(); }
    catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  async function monitorNow() {
    setBusy(true); setError(null); setNotice(null);
    try {
      const r = await officerApi.runMonitor(companyId);
      setNotice(`Checked ${r.targetsChecked} target(s): ${r.opened} new, ${r.updated} still open, ${r.resolved} cleared${r.actionsProposed ? `, ${r.actionsProposed} follow-up action(s) proposed` : ""}.`);
      await load();
    } catch (e) { setError(apiError(e, "Monitoring could not run.")); }
    finally { setBusy(false); }
  }

  function confirmWork() {
    if (!work) return;
    const f = work.finding;
    if (work.kind === "resolve") void run(() => officerApi.resolve(companyId, f.id, work.text, f.version), "The finding could not be resolved.", () => setWork(null));
    else if (work.kind === "dismiss") void run(() => officerApi.dismiss(companyId, f.id, work.text, f.version), "The finding could not be dismissed.", () => setWork(null));
    else if (work.kind === "assign") void run(() => officerApi.assign(companyId, f.id, work.employeeId, f.version), "The finding could not be assigned.", () => setWork(null));
    else void run(() => officerApi.requestAction(companyId, { actionType: "finding.escalate", findingId: f.id, employeeId: work.employeeId, reason: work.text, clientRequestId: newClientId() }),
      "The escalation could not be requested.", () => { setWork(null); setNotice("Escalation requested. It runs or waits for approval according to the delegated authority."); });
  }

  const closed = (f: Finding) => f.status === "resolved" || f.status === "dismissed";

  return (
    <div className="gl-page">
      <PageHeader title="Officer Findings" subtitle="What the officer found against targets and operating rules, with the records behind each finding. Repeats update one finding; cleared conditions close on their own."
        actions={canRun ? <Button variant="outline" onClick={() => void monitorNow()} disabled={busy}><Play size={16} /> Check now</Button> : null} />
      <OfficerNav />
      <div className="gl-toolbar">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="active">Open and acknowledged</option>
            {(Object.keys(FINDING_STATUS_LABEL) as FindingStatus[]).map((s) => <option key={s} value={s}>{FINDING_STATUS_LABEL[s]}</option>)}
          </Select>
        </Field>
        <Field label="Kind">
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="">All kinds</option>
            {(Object.keys(KIND_LABEL) as FindingKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </Select>
        </Field>
        <Field label="Severity at least">
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
            <option value="">Any</option>
            {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
          </Select>
        </Field>
        <Field label="Branch"><BranchSelect value={branchId} onChange={setBranchId} branches={refs.branches} allLabel="All my branches" /></Field>
      </div>
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {error && !work ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">Loading findings…</StateMessage> : null}

      <div className="gl-table-wrap gl-table-wrap--tall">
        <table className="gl-table">
          <thead><tr><th>Finding</th><th>Severity</th><th>Kind</th><th>Branch</th><th>Owner</th><th>Detected</th><th>Status</th></tr></thead>
          <tbody>
            {!loading && rows.length === 0 ? <tr><td colSpan={7} className="gl-empty">No findings match.</td></tr> : null}
            {rows.map((f) => (
              <tr key={f.id} className="gl-row" tabIndex={0} onClick={() => setSelected(f)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(f); } }}>
                <td>{f.title}<small>{f.evidenceQuality === "strong" ? "Strong evidence" : f.evidenceQuality === "partial" ? "Partial evidence" : "Weak evidence"} · priority {f.priority}</small></td>
                <td><SeverityChip severity={f.severity} /></td>
                <td>{KIND_LABEL[f.kind]}</td>
                <td>{f.branchName ?? "Company"}</td>
                <td>{f.ownerName ?? "—"}{f.ownerRole ? <small>{f.ownerRole}</small> : null}</td>
                <td>{when(f.firstDetectedAtUtc)}{f.occurrences > 1 ? <small>seen {f.occurrences}×, last {when(f.lastDetectedAtUtc)}</small> : null}</td>
                <td><Chip tone={f.status === "open" ? "warn" : f.status === "acknowledged" ? "info" : "muted"}>{FINDING_STATUS_LABEL[f.status]}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <GlDialog open size="wide" title={selected.title} confirmText="" closeText="Close" busy={busy} error={error} onClose={() => setSelected(null)}
          actions={closed(selected) ? null : <>
            {selected.status === "open" ? <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => officerApi.acknowledge(companyId, selected.id, selected.version), "Could not acknowledge.")}>Acknowledge</Button> : null}
            {canManage ? <Button type="button" variant="outline" disabled={busy} onClick={() => setWork({ finding: selected, kind: "assign", text: "", employeeId: selected.ownerEmployeeId ?? "" })}>Assign</Button> : null}
            {canRequest ? <Button type="button" variant="outline" disabled={busy} onClick={() => setWork({ finding: selected, kind: "escalate", text: "", employeeId: "" })}>Escalate</Button> : null}
            {canManage ? <Button type="button" variant="outline" disabled={busy} onClick={() => setWork({ finding: selected, kind: "dismiss", text: "", employeeId: "" })}>Dismiss</Button> : null}
            <Button type="button" disabled={busy} onClick={() => setWork({ finding: selected, kind: "resolve", text: "", employeeId: "" })}>Resolve</Button>
          </>}>
          <div className="gl-chip-row"><SeverityChip severity={selected.severity} /><Chip tone="muted">{KIND_LABEL[selected.kind]}</Chip><Chip tone="muted">{FINDING_STATUS_LABEL[selected.status]}</Chip></div>
          <p>{selected.detail}</p>
          <dl className="gl-detail">
            <div><dt>Branch</dt><dd>{selected.branchName ?? "Company"}{selected.departmentName ? ` · ${selected.departmentName}` : ""}</dd></div>
            <div><dt>Owner</dt><dd>{selected.ownerName ?? "Not assigned"}{selected.ownerRole ? ` (${selected.ownerRole})` : ""}</dd></div>
            <div><dt>Rule</dt><dd>{selected.ruleKey}</dd></div>
            {selected.periodStart ? <div><dt>Period</dt><dd>{day(selected.periodStart)}{selected.periodEnd && selected.periodEnd !== selected.periodStart ? ` – ${day(selected.periodEnd)}` : ""}</dd></div> : null}
            {selected.actual !== null && selected.actual !== undefined ? <div><dt>{selected.kind === "forecastRisk" ? "Projected" : "Actual"}</dt><dd>{selected.actual}</dd></div> : null}
            {selected.expected !== null && selected.expected !== undefined ? <div><dt>Target</dt><dd>{selected.expected}</dd></div> : null}
            <div><dt>Data as of</dt><dd>{when(selected.dataAsOfUtc)}</dd></div>
            <div><dt>Evidence</dt><dd>{selected.evidenceQuality}</dd></div>
            <div><dt>First detected</dt><dd>{when(selected.firstDetectedAtUtc)}</dd></div>
            {selected.resolvedAtUtc ? <div><dt>Closed</dt><dd>{when(selected.resolvedAtUtc)} by {selected.resolvedByName}</dd></div> : null}
          </dl>
          {selected.resolutionNote ? <p className="gl-note">{selected.resolutionNote}</p> : null}
          <h4>Supporting records</h4>
          <EvidenceList items={selected.evidence} />
        </GlDialog>
      ) : null}

      {work ? (
        <GlDialog open title={work.kind === "resolve" ? "Resolve finding" : work.kind === "dismiss" ? "Dismiss finding" : work.kind === "assign" ? "Assign finding" : "Escalate finding"}
          description={work.finding.title} busy={busy} error={error} onClose={() => setWork(null)}
          confirmText={work.kind === "resolve" ? "Resolve" : work.kind === "dismiss" ? "Dismiss" : work.kind === "assign" ? "Assign" : "Request escalation"}
          confirmDisabled={(work.kind === "resolve" || work.kind === "dismiss") ? !work.text.trim() : !work.employeeId}
          onConfirm={confirmWork}>
          {work.kind === "assign" || work.kind === "escalate" ? (
            <Field label={work.kind === "assign" ? "Owner" : "Escalate to"}>
              <EmployeeSelect value={work.employeeId} onChange={(v) => setWork({ ...work, employeeId: v })} employees={refs.employees} branchId={work.finding.branchId ?? undefined} placeholder="Choose a person" />
            </Field>
          ) : null}
          {work.kind !== "assign" ? (
            <Field label={work.kind === "escalate" ? "Why (optional)" : work.kind === "dismiss" ? "Why it needs no action" : "What was done"}>
              <Textarea value={work.text} onChange={(e) => setWork({ ...work, text: e.target.value })} rows={3} />
            </Field>
          ) : null}
        </GlDialog>
      ) : null}
    </div>
  );
}
