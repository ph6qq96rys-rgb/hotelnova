import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, Field, GlDialog } from "../../finance/components/glShared";
import { officerApi, type ActionStatus, type Attempt, type AuditEntry, type OfficerAction } from "../api/officerApi";
import { ACTION_STATUS_LABEL, ACTION_STATUS_TONE, BranchSelect, EvidenceList, MODE_LABEL, OfficerNav, useOfficerRefs, when } from "../components/officerShared";

const FILTERS: Record<string, { label: string; statuses?: ActionStatus[] }> = {
  waiting: { label: "Waiting for a decision", statuses: ["proposed", "pendingApproval"] },
  queued: { label: "Approved or running", statuses: ["approved", "executing"] },
  problems: { label: "Failed or blocked", statuses: ["failed", "blocked"] },
  done: { label: "Done", statuses: ["executed"] },
  closed: { label: "Rejected or cancelled", statuses: ["rejected", "cancelled"] },
  all: { label: "All" },
};

type Decision = { action: OfficerAction; kind: "approve" | "reject" | "complete"; text: string };

export default function OfficerActionsPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "audit" ? "audit" : "actions";
  const canAudit = useHasPermission("aiops.audit.view");
  const canApprove = useHasPermission("aiops.actions.approve");
  const { refs } = useOfficerRefs(companyId);
  const [filter, setFilter] = useState("waiting");
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState<OfficerAction[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditType, setAuditType] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ action: OfficerAction; attempts: Attempt[] } | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "actions") setRows(await officerApi.actions(companyId, { status: FILTERS[filter].statuses, branchId: branchId || undefined, take: 300 }));
      else setAudit(await officerApi.audit(companyId, { entityType: auditType || undefined, take: 400 }));
      setError(null);
    } catch (e) { setError(apiError(e, tab === "actions" ? "Actions could not be loaded." : "The audit trail could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId, tab, filter, branchId, auditType]);
  useEffect(() => { void load(); }, [load]);

  async function open(a: OfficerAction) {
    setError(null);
    try { setDetail(await officerApi.action(companyId, a.id)); } catch (e) { setError(apiError(e, "The action could not be opened.")); }
  }

  async function decide() {
    if (!decision) return;
    const { action: a, kind, text } = decision;
    setBusy(true); setError(null);
    try {
      const updated = kind === "approve" ? await officerApi.approveAction(companyId, a.id, text || undefined, a.version)
        : kind === "reject" ? await officerApi.rejectAction(companyId, a.id, text, a.version) : await officerApi.completeAction(companyId, a.id, text, a.version);
      setDecision(null);
      setDetail(await officerApi.action(companyId, updated.id));
      await load();
    } catch (e) { setError(apiError(e, "The decision could not be saved.")); }
    finally { setBusy(false); }
  }

  async function retry(a: OfficerAction) {
    setBusy(true); setError(null);
    try { await officerApi.retryAction(companyId, a.id, a.version); setDetail(await officerApi.action(companyId, a.id)); await load(); }
    catch (e) { setError(apiError(e, "The action could not be retried.")); }
    finally { setBusy(false); }
  }

  const a = detail?.action;

  return (
    <div className="gl-page">
      <PageHeader title="Officer Actions" subtitle="Every decision the officer proposed or carried out, the authority it acted under, the checks made before it ran and the result." />
      <OfficerNav />
      <div className="gl-tabs" role="tablist">
        <Button role="tab" type="button" variant="ghost" className="gl-tab" aria-selected={tab === "actions"} onClick={() => setParams({})}>Actions</Button>
        {canAudit ? <Button role="tab" type="button" variant="ghost" className="gl-tab" aria-selected={tab === "audit"} onClick={() => setParams({ tab: "audit" })}>Audit trail</Button> : null}
      </div>
      {error && !detail && !decision ? <StateMessage tone="error">{error}</StateMessage> : null}

      {tab === "actions" ? (
        <>
          <div className="gl-toolbar">
            <Field label="Show"><Select value={filter} onChange={(e) => setFilter(e.target.value)}>{Object.entries(FILTERS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</Select></Field>
            <Field label="Branch"><BranchSelect value={branchId} onChange={setBranchId} branches={refs.branches} allLabel="All my branches" /></Field>
          </div>
          {loading ? <StateMessage tone="loading">Loading actions…</StateMessage> : null}
          <div className="gl-table-wrap gl-table-wrap--tall">
            <table className="gl-table">
              <thead><tr><th>Action</th><th>Branch</th><th>Authority</th><th>Requested</th><th>Status</th></tr></thead>
              <tbody>
                {!loading && rows.length === 0 ? <tr><td colSpan={5} className="gl-empty">No actions here.</td></tr> : null}
                {rows.map((r) => (
                  <tr key={r.id} className="gl-row" tabIndex={0} onClick={() => void open(r)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void open(r); } }}>
                    <td>{r.title}<small>{r.actionLabel}{r.executable ? "" : " · carried out by a person"}</small></td>
                    <td>{r.branchName ?? "Company"}</td>
                    <td>{MODE_LABEL[r.mode]}<small>policy v{r.policyVersion}</small></td>
                    <td>{r.requestedByName}<small>{when(r.requestedAtUtc)}</small></td>
                    <td><Chip tone={ACTION_STATUS_TONE[r.status]}>{ACTION_STATUS_LABEL[r.status]}</Chip>{r.authorityNote ? <small>{r.authorityNote}</small> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="gl-toolbar">
            <Field label="Record type">
              <Select value={auditType} onChange={(e) => setAuditType(e.target.value)}>
                <option value="">All</option>
                {["Settings", "Scope", "Policy", "Target", "Finding", "Action", "Briefing"].map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </div>
          {loading ? <StateMessage tone="loading">Loading the audit trail…</StateMessage> : null}
          <div className="gl-table-wrap gl-table-wrap--tall">
            <table className="gl-table">
              <thead><tr><th>When</th><th>Who</th><th>Record</th><th>Event</th><th>Policy</th><th>Detail</th></tr></thead>
              <tbody>
                {!loading && audit.length === 0 ? <tr><td colSpan={6} className="gl-empty">Nothing recorded yet.</td></tr> : null}
                {audit.map((x) => (
                  <tr key={x.id}><td>{when(x.atUtc)}</td><td>{x.actorName}</td><td>{x.entityType}<small>{x.entityId.slice(0, 8)}</small></td><td>{x.event}</td><td>v{x.policyVersion}</td>
                    <td className="gl-audit-detail">{x.detailJson}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {detail && a ? (
        <GlDialog open size="wide" title={a.title} confirmText="" closeText="Close" busy={busy} error={decision ? null : error} onClose={() => setDetail(null)}
          actions={<>
            {canApprove && a.canDecide ? <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setDecision({ action: a, kind: "reject", text: "" })}>Reject</Button>
              <Button type="button" disabled={busy} onClick={() => setDecision({ action: a, kind: "approve", text: "" })}>{a.status === "proposed" ? "Accept" : "Approve"}</Button>
            </> : null}
            {canApprove && a.status === "approved" && !a.executable ? <Button type="button" disabled={busy} onClick={() => setDecision({ action: a, kind: "complete", text: "" })}>Record as done</Button> : null}
            {canApprove && (a.status === "failed" || a.status === "blocked") && a.executable ? <Button type="button" variant="outline" disabled={busy} onClick={() => void retry(a)}>Retry once</Button> : null}
            {canApprove && (a.status === "approved" || a.status === "failed" || a.status === "blocked") ? <Button type="button" variant="outline" disabled={busy} onClick={() => setDecision({ action: a, kind: "reject", text: "" })}>Cancel action</Button> : null}
          </>}>
          <div className="gl-chip-row"><Chip tone={ACTION_STATUS_TONE[a.status]}>{ACTION_STATUS_LABEL[a.status]}</Chip><Chip tone="muted">{MODE_LABEL[a.mode]}</Chip><Chip tone="muted">{a.actionLabel}</Chip></div>
          {a.authorityNote ? <p className="gl-note">{a.authorityNote}</p> : null}
          {a.lastError ? <p className="gl-note gl-note--bad">Last error: {a.lastError}</p> : null}
          <dl className="gl-detail">
            <div><dt>Branch</dt><dd>{a.branchName ?? "Company"}</dd></div>
            <div><dt>Trigger</dt><dd>{a.trigger}</dd></div>
            <div><dt>Requested by</dt><dd>{a.requestedByName}, {when(a.requestedAtUtc)}</dd></div>
            <div><dt>Decided by</dt><dd>{a.decidedByName ? `${a.decidedByName}, ${when(a.decidedAtUtc)}` : "—"}</dd></div>
            <div><dt>Policy version</dt><dd>v{a.policyVersion}</dd></div>
            <div><dt>Model</dt><dd>{a.modelVersion ?? "Rules (no model)"}</dd></div>
            <div><dt>Attempts</dt><dd>{a.attempts} of {a.maxAttempts}{a.nextAttemptAtUtc && a.status === "approved" ? ` · next ${when(a.nextAttemptAtUtc)}` : ""}</dd></div>
            <div><dt>Result</dt><dd>{a.resultReference ?? "—"}{a.executedAtUtc ? ` · ${when(a.executedAtUtc)}` : ""}</dd></div>
          </dl>
          {a.reason ? <p><strong>Why:</strong> {a.reason}</p> : null}
          {a.decisionNote ? <p><strong>Decision note:</strong> {a.decisionNote}</p> : null}
          {a.evidence.length ? <><h4>Evidence</h4><EvidenceList items={a.evidence} /></> : null}
          <h4>What it does</h4>
          <pre className="oo-pre">{a.payloadJson}</pre>
          <h4>Execution attempts</h4>
          {detail.attempts.length === 0 ? <p className="gl-muted">Not run yet.</p> : (
            <div className="oo-cards">
              {detail.attempts.map((t) => (
                <div key={t.attemptNo} className="oo-card">
                  <div className="oo-card-head"><h3>Attempt {t.attemptNo}</h3><Chip tone={t.outcome === "Executed" ? "ok" : t.outcome === "Failed" ? "bad" : "warn"}>{t.outcome}</Chip></div>
                  <div className="oo-meta"><span>{when(t.startedAtUtc)}</span>{t.message ? <span>{t.message}</span> : null}</div>
                  <ul className="oo-evidence">{t.checks.map((c) => <li key={c.name}><span className="oo-evidence-type">{c.passed ? "Passed" : "Failed"}</span><strong>{c.name}</strong><span>{c.detail}</span></li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </GlDialog>
      ) : null}

      {decision ? (
        <GlDialog open busy={busy} error={error} onClose={() => setDecision(null)} onConfirm={() => void decide()} danger={decision.kind === "reject"}
          title={decision.kind === "approve" ? (decision.action.status === "proposed" ? "Accept recommendation" : "Approve action") : decision.kind === "reject" ? "Reject or cancel" : "Record as done"}
          description={decision.kind === "approve" && decision.action.executable ? "The officer checks its authority and the records again just before it runs." : decision.action.title}
          confirmText={decision.kind === "approve" ? "Approve" : decision.kind === "reject" ? "Confirm" : "Save"}
          confirmDisabled={decision.kind !== "approve" && !decision.text.trim()}>
          {decision.kind === "complete" ? <Field label="Document number or what was done"><Input value={decision.text} onChange={(e) => setDecision({ ...decision, text: e.target.value })} /></Field>
            : <Field label={decision.kind === "approve" ? "Note (optional)" : "Reason"}><Textarea rows={3} value={decision.text} onChange={(e) => setDecision({ ...decision, text: e.target.value })} /></Field>}
        </GlDialog>
      ) : null}
    </div>
  );
}
