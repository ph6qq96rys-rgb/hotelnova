import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Play, Plus, RotateCcw } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useHasPermission } from "../../../auth/usePermissions";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import {
  ACCOUNT_TYPE_LABEL, ACTION_LABEL, financeApi, MODULE_LABEL, SOURCE_LABEL,
  type AuditEntry, type FinanceSettings, type OutboxStatus, type PostingException, type PostingRule, type ReconciliationRow,
} from "../api/financeApi";
import { AccountSelect, apiError, Chip, day, Field, GlDialog, todayIso } from "../components/glShared";
import { useFinanceRefs } from "../components/useFinanceRefs";

type Tab = "rules" | "exceptions" | "reconciliation" | "audit";
const TABS: Tab[] = ["rules", "exceptions", "reconciliation", "audit"];
const OUTBOX_LABEL: Record<OutboxStatus, [string, "warn" | "bad" | "ok" | "muted" | "info"]> = {
  pending: ["Waiting", "info"], failed: ["Failed — retrying", "warn"], deadLetter: ["Stopped", "bad"], processed: ["Posted", "ok"], skipped: ["Skipped", "muted"],
};

/**
 * Finance configuration: settings, versioned posting rules, posting exceptions (the outbox's failed and
 * waiting events), operational-to-financial reconciliation, and the financial audit log.
 */
export default function PostingSetupPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const [params, setParams] = useSearchParams();
  const canManage = useHasPermission("finance.manage");
  const refs = useFinanceRefs(companyId);
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "rules";
  const setTab = (t: Tab) => { const p = new URLSearchParams(params); if (t === "rules") p.delete("tab"); else p.set("tab", t); setParams(p, { replace: true }); };
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [rules, setRules] = useState<PostingRule[]>([]);
  const [exceptions, setExceptions] = useState<PostingException[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationRow[]>([]);
  const [audit, setAudit] = useState<{ total: number; items: AuditEntry[] } | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState<{ key: string; branchId: string; accountId: string } | null>(null);
  const [method, setMethod] = useState<{ prefix: "POS_PAYMENT:" | "AP_PAYMENT:"; name: string; accountId: string } | null>(null);
  const [history, setHistory] = useState<PostingRule | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, r, x, rec] = await Promise.all([financeApi.settings(companyId), financeApi.postingRules(companyId), financeApi.postingExceptions(companyId), financeApi.reconciliation(companyId)]);
      setSettings(s); setRules(r); setExceptions(x); setReconciliation(rec); setError(null);
    } catch (e) { setError(apiError(e, "Finance configuration could not be loaded.")); }
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (tab !== "audit") return;
    financeApi.auditLog(companyId, auditPage).then(setAudit).catch((e) => setError(apiError(e, "The audit log could not be loaded.")));
  }, [companyId, tab, auditPage]);

  async function run(work: () => Promise<unknown>, fallback: string, done?: () => void) {
    setBusy(true); setError(null); setNotice(null);
    try { await work(); done?.(); await load(); }
    catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  const groups = useMemo(() => {
    const map = new Map<string, PostingRule[]>();
    for (const r of rules) map.set(r.group, [...(map.get(r.group) ?? []), r]);
    return [...map.entries()];
  }, [rules]);
  /** Method keys fall back to their group default; everything else needs its own account. */
  const required = (key: string) => !key.includes(":") || key.endsWith(":DEFAULT") || key === "POS_PAYMENT:CASH";
  const unmapped = rules.filter((r) => required(r.key) && !r.accountId).length;
  const branchName = (id?: string | null) => (id ? refs.branches.find((b) => b.id === id)?.name ?? "Branch" : "Company");
  const accountLabel = (id?: string | null) => { const a = refs.accounts.find((x) => x.id === id); return a ? `${a.code} ${a.name}` : "—"; };
  const docLabel = (x: { documentType: string; sourceModule: string }) => SOURCE_LABEL[x.documentType] ?? `${MODULE_LABEL[x.sourceModule] ?? x.sourceModule} ${x.documentType}`;

  return (
    <div className="gl-page">
      <PageHeader title="Finance Configuration" subtitle="Operational documents are captured in the same transaction as the business change and posted to the ledger by the finance dispatcher — each exactly once."
        actions={canManage ? <Button disabled={busy || !settings?.autoPostingStartDate} onClick={() => void run(async () => {
          const r = await financeApi.runAutoPosting(companyId);
          setNotice(`${r.posted} posted, ${r.waiting} waiting, ${r.failed} failed, ${r.skipped} skipped${r.detected ? ` · reconciliation found ${r.detected} document${r.detected === 1 ? "" : "s"} without an event` : ""}.`);
        }, "Posting could not run.")}><Play size={16} /> Post now</Button> : null} />
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {error && !override && !method ? <StateMessage tone="error">{error}</StateMessage> : null}

      {settings ? (
        <section className="gl-panel">
          <div className="gl-panel-head">
            <div>
              <h2>Settings</h2>
              <p className="gl-muted">Documents dated before the start date stay in your previous books. Once journals have posted automatically, the start date can only move later.</p>
            </div>
          </div>
          <div className="gl-toolbar">
            <Field label="Posting starts on">
              <Input type="date" disabled={!canManage} value={settings.autoPostingStartDate ?? ""} onChange={(e) => setSettings({ ...settings, autoPostingStartDate: e.target.value || null })} />
            </Field>
            <Field label="Rounding tolerance" hint="Largest imbalance posted to rounding">
              <Input type="number" min="0" max="10" step="0.01" disabled={!canManage} value={settings.roundingTolerance} onChange={(e) => setSettings({ ...settings, roundingTolerance: Number(e.target.value) })} />
            </Field>
            <label className="gl-check"><Checkbox disabled={!canManage} checked={settings.autoPostingEnabled} onChange={(e) => setSettings({ ...settings, autoPostingEnabled: e.target.checked })} /> Dispatch every 15 minutes</label>
            <label className="gl-check"><Checkbox disabled={!canManage} checked={settings.requireIndependentPosting} onChange={(e) => setSettings({ ...settings, requireIndependentPosting: e.target.checked })} /> A second person posts manual journals</label>
            <span className="gl-spacer" />
            {canManage ? <Button variant="outline" disabled={busy} onClick={() => void run(() => financeApi.saveSettings(companyId, settings), "Settings could not be saved.", () => setNotice("Settings saved."))}>Save settings</Button> : null}
          </div>
          {unmapped > 0 ? <p className="gl-note gl-note--warn">{unmapped} posting rule{unmapped === 1 ? " has" : "s have"} no account. Documents that need {unmapped === 1 ? "it" : "them"} will wait under Posting exceptions.</p> : null}
        </section>
      ) : null}

      <div className="gl-tabs" role="tablist">
        <Button role="tab" type="button" variant="ghost" className="gl-tab" aria-selected={tab === "rules"} onClick={() => setTab("rules")}>Posting rules</Button>
        <Button role="tab" type="button" variant="ghost" className="gl-tab" aria-selected={tab === "exceptions"} onClick={() => setTab("exceptions")}>Posting exceptions ({exceptions.length})</Button>
        <Button role="tab" type="button" variant="ghost" className="gl-tab" aria-selected={tab === "reconciliation"} onClick={() => setTab("reconciliation")}>Reconciliation</Button>
        <Button role="tab" type="button" variant="ghost" className="gl-tab" aria-selected={tab === "audit"} onClick={() => setTab("audit")}>Audit log</Button>
      </div>

      {tab === "rules" ? (
        <section className="gl-panel">
          <div className="gl-panel-head">
            <p className="gl-muted">Rules are versioned. A change applies from its effective date; documents dated earlier keep posting to the account in force then, and every journal line records the rule version it used.</p>
            {canManage ? <div className="gl-toolbar">
              <Field label="Changes take effect from"><Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></Field>
              <Button variant="outline" size="sm" onClick={() => { setError(null); setMethod({ prefix: "POS_PAYMENT:", name: "", accountId: "" }); }}><Plus size={14} /> POS payment method</Button>
              <Button variant="outline" size="sm" onClick={() => { setError(null); setMethod({ prefix: "AP_PAYMENT:", name: "", accountId: "" }); }}><Plus size={14} /> Supplier payment method</Button>
            </div> : null}
          </div>
          {groups.map(([group, list]) => (
            <div key={group} className="gl-table-wrap">
              <table className="gl-table gl-table--rules">
                <colgroup><col className="gl-col-rule" /><col className="gl-col-key" /><col /><col className="gl-col-branches" /></colgroup>
                <thead><tr><th colSpan={2}>{group}</th><th>Account</th><th>Branch accounts</th></tr></thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.key}>
                      <td>{r.label}<small>{r.help}</small></td>
                      <td><span className="gl-code">{r.key}</span><small>Usually {ACCOUNT_TYPE_LABEL[r.expectedType].toLowerCase()}</small></td>
                      <td>
                        {canManage
                          ? <AccountSelect accounts={refs.accounts} value={r.accountId ?? ""} placeholder={required(r.key) ? "Not mapped" : "Use the group default"}
                              ariaLabel={`Account for ${r.label}`} onChange={(id) => void run(() => financeApi.savePostingRule(companyId, r.key, null, id || null, effectiveFrom), "The rule could not be saved.")} />
                          : accountLabel(r.accountId)}
                        {r.version ? <small>Version {r.version} · since {day(r.effectiveFrom)}{r.history.length > 1 ? <> · <Button variant="link" size="sm" onClick={() => setHistory(r)}>history</Button></> : null}</small> : null}
                      </td>
                      <td>
                        <div className="gl-chip-row">
                          {r.branchOverrides.map((o) => (
                            <Chip key={o.branchId} tone="info">{branchName(o.branchId)}: {refs.accounts.find((a) => a.id === o.accountId)?.code ?? "?"}
                              {canManage ? <Button variant="link" size="sm" aria-label={`End ${branchName(o.branchId)} override`} onClick={() => void run(() => financeApi.savePostingRule(companyId, r.key, o.branchId, null, effectiveFrom), "The override could not be ended.")}>×</Button> : null}
                            </Chip>
                          ))}
                          {canManage && refs.branches.length > 0 ? <Button size="sm" variant="ghost" onClick={() => { setError(null); setOverride({ key: r.key, branchId: "", accountId: "" }); }}>Add</Button> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      ) : null}

      {tab === "exceptions" ? (
        <section className="gl-panel">
          <p className="gl-muted">Documents that have not posted yet. Failed ones retry automatically with increasing delays and stop after eight attempts. Fix the cause — usually a missing account mapping or a closed period — then retry. A month cannot close while its documents are listed here.</p>
          <div className="gl-table-wrap">
            <table className="gl-table">
              <thead><tr><th>Document</th><th>Date</th><th>Status</th><th>Reason</th><th className="gl-num">Attempts</th><th>Next try</th><th /></tr></thead>
              <tbody>
                {exceptions.map((x) => (
                  <tr key={x.id}>
                    <td>{docLabel(x)} {ACTION_LABEL[x.action as keyof typeof ACTION_LABEL] ?? ""}<small>{x.documentNo ?? x.documentId}{x.origin === "Sweep" ? " · found by reconciliation" : ""}</small></td>
                    <td>{day(x.documentDate)}</td>
                    <td><Chip tone={OUTBOX_LABEL[x.status][1]}>{OUTBOX_LABEL[x.status][0]}</Chip></td>
                    <td>{x.lastError ?? ""}</td>
                    <td className="gl-num">{x.attempts}</td>
                    <td>{x.status === "deadLetter" ? "On request" : formatAppDateTime(x.nextAttemptAtUtc)}</td>
                    <td className="gl-actions">{canManage ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
                      const r = await financeApi.retryPosting(companyId, x.id);
                      setNotice(r.status === "processed" ? "Posted." : r.status === "skipped" ? `Nothing to post: ${r.lastError ?? ""}` : `Still not posted: ${r.lastError ?? ""}`);
                    }, "The retry failed.")}><RotateCcw size={14} /> Retry</Button> : null}</td>
                  </tr>
                ))}
                {exceptions.length === 0 ? <tr><td colSpan={7} className="gl-empty">Everything that was due has posted.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "reconciliation" ? (
        <section className="gl-panel">
          <p className="gl-muted">Operational-to-financial reconciliation: for each kind of document, how many have a journal and how many still owe one. “Post now” also searches for documents that never produced an outbox event.</p>
          <div className="gl-table-wrap">
            <table className="gl-table">
              <thead><tr><th>Module</th><th>Document</th><th className="gl-num">Posted</th><th className="gl-num">Waiting</th><th className="gl-num">Failed</th><th className="gl-num">Stopped</th><th className="gl-num">Skipped</th></tr></thead>
              <tbody>
                {reconciliation.map((r) => (
                  <tr key={r.sourceModule + r.documentType}>
                    <td>{MODULE_LABEL[r.sourceModule] ?? r.sourceModule}</td><td>{SOURCE_LABEL[r.documentType] ?? r.documentType}</td>
                    <td className="gl-num">{r.posted}</td><td className="gl-num">{r.waiting || ""}</td>
                    <td className="gl-num">{r.failed ? <span className="gl-diff">{r.failed}</span> : ""}</td>
                    <td className="gl-num">{r.deadLetter ? <span className="gl-diff">{r.deadLetter}</span> : ""}</td><td className="gl-num">{r.skipped || ""}</td>
                  </tr>
                ))}
                {reconciliation.length === 0 ? <tr><td colSpan={7} className="gl-empty">No operational documents have reached finance yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "audit" ? (
        <section className="gl-panel">
          <p className="gl-muted">Every change to finance configuration and every journal action: who, when and what.</p>
          <div className="gl-table-wrap">
            <table className="gl-table">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>
                {(audit?.items ?? []).map((a) => (
                  <tr key={a.id}>
                    <td>{formatAppDateTime(a.atUtc)}</td><td>{a.userName || (a.userId ? "User" : "System")}</td>
                    <td>{a.entityType}<small>{a.entityId}</small></td><td>{a.action}</td>
                    <td className="gl-audit-detail">{a.detailJson ?? ""}</td>
                  </tr>
                ))}
                {audit && audit.items.length === 0 ? <tr><td colSpan={5} className="gl-empty">Nothing recorded yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
          {audit && audit.total > 50 ? (
            <div className="gl-pager">
              <Button variant="outline" size="sm" disabled={auditPage <= 1} onClick={() => setAuditPage((p) => p - 1)}>Newer</Button>
              <span className="gl-muted">Page {auditPage} of {Math.ceil(audit.total / 50)}</span>
              <Button variant="outline" size="sm" disabled={auditPage >= Math.ceil(audit.total / 50)} onClick={() => setAuditPage((p) => p + 1)}>Older</Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {override ? (
        <GlDialog open title={`Branch account for ${rules.find((r) => r.key === override.key)?.label ?? override.key}`} confirmText="Save" busy={busy} error={error}
          confirmDisabled={!override.branchId || !override.accountId} onClose={() => setOverride(null)}
          description={`Takes effect from ${day(effectiveFrom)}.`}
          onConfirm={() => void run(() => financeApi.savePostingRule(companyId, override.key, override.branchId, override.accountId, effectiveFrom), "The override could not be saved.", () => setOverride(null))}>
          <Field label="Branch">
            <Select required value={override.branchId} onChange={(e) => setOverride({ ...override, branchId: e.target.value })}>
              <option value="">Choose branch</option>
              {refs.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Account"><AccountSelect accounts={refs.accounts} value={override.accountId} required onChange={(id) => setOverride({ ...override, accountId: id })} /></Field>
        </GlDialog>
      ) : null}

      {method ? (
        <GlDialog open title={method.prefix === "POS_PAYMENT:" ? "POS payment method account" : "Supplier payment method account"} confirmText="Save" busy={busy} error={error}
          confirmDisabled={!method.name.trim() || !method.accountId} onClose={() => setMethod(null)}
          description="Use the method name exactly as recorded on payments, for example TELEBIRR, CBE_BIRR or CHEQUE."
          onConfirm={() => void run(() => financeApi.savePostingRule(companyId, method.prefix + method.name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, ""), null, method.accountId, effectiveFrom),
            "The method could not be saved.", () => setMethod(null))}>
          <Field label="Method"><Input required maxLength={40} value={method.name} onChange={(e) => setMethod({ ...method, name: e.target.value })} /></Field>
          <Field label="Account"><AccountSelect accounts={refs.accounts} value={method.accountId} required onChange={(id) => setMethod({ ...method, accountId: id })} /></Field>
        </GlDialog>
      ) : null}

      {history ? (
        <GlDialog open title={`${history.label} — versions`} confirmText="" closeText="Close" onClose={() => setHistory(null)}>
          <div className="gl-table-wrap">
            <table className="gl-table">
              <thead><tr><th>Version</th><th>Scope</th><th>Account</th><th>From</th><th>To</th></tr></thead>
              <tbody>{history.history.map((h) => (
                <tr key={`${h.branchId ?? "c"}-${h.version}`}><td>{h.version}</td><td>{branchName(h.branchId)}</td><td>{accountLabel(h.accountId)}</td><td>{day(h.effectiveFrom)}</td><td>{h.effectiveTo ? day(h.effectiveTo) : "Open"}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </GlDialog>
      ) : null}
    </div>
  );
}
