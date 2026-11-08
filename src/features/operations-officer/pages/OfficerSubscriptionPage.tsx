import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, day, Field, GlDialog } from "../../finance/components/glShared";
import { officerApi, type Package, type PackageDefinition, type Subscription, type SubscriptionStatus } from "../api/officerApi";
import { OfficerNav, Section, when } from "../components/officerShared";

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  notSubscribed: "Not subscribed", trial: "Trial", active: "Active", suspended: "Suspended", cancelled: "Cancelled", expired: "Expired",
};
const KIND_LABEL: Record<string, string> = {
  MonitorRun: "Monitoring runs", Briefing: "Briefings", Narrative: "Plain-language summaries", ActionExecution: "Executed actions", Question: "Questions",
};
const CAPABILITY_LABEL: Record<string, string> = {
  monitoring: "Monitoring", briefings: "Briefings", questions: "Questions", recommendations: "Recommendations", planning: "Planning",
  coordination: "Coordination", instructions: "Mandatory instructions", conversations: "Management conversations", targets: "Targets",
  accountability: "Accountability", scorecards: "Scorecards", delegatedExecution: "Delegated execution",
};
const RANK: Record<Package, number> = { none: 0, insights: 1, operations: 2, leadership: 3 };

type Choice = { definition: PackageDefinition; units: string; price: string; overagePrice: string; currency: string; trial: boolean; accept: boolean; endsOn: string };

export default function OfficerSubscriptionPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canManage = useHasPermission("aiops.subscription.manage");
  const [sub, setSub] = useState<Subscription | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [overage, setOverage] = useState<{ budget: string; accept: boolean } | null>(null);
  const [ending, setEnding] = useState<{ kind: "suspend" | "cancel"; reason: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const s = await officerApi.subscription(companyId); setSub(s); setBranches(s.branches.filter((b) => b.active).map((b) => b.branchId)); setError(null); }
    catch (e) { setError(apiError(e, "The subscription could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);

  async function run(job: () => Promise<unknown>, fallback: string, done?: () => void, message?: string) {
    setBusy(true); setError(null); setSaved(null);
    try { await job(); done?.(); if (message) setSaved(message); await load(); }
    catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const s = sub;
  const allowance = s ? s.includedUnitsPerMonth + (s.overageAuthorized ? s.overageBudgetUnits ?? 0 : 0) : 0;
  const share = s && allowance > 0 ? Math.min(100, Math.round((s.usedUnits / allowance) * 100)) : 0;
  const changedBranches = !!s && (branches.length !== s.branches.filter((b) => b.active).length || s.branches.some((b) => b.active !== branches.includes(b.branchId)));

  return (
    <div className="gl-page">
      <PageHeader title="AI COO Subscription" subtitle="Which AI COO package the company has, the branches it covers and how much AI work it may use. Access only: what the officer may decide is still set by permissions and delegated authority." />
      <OfficerNav />
      {error && !choice && !overage && !ending ? <StateMessage tone="error">{error}</StateMessage> : null}
      {saved ? <StateMessage tone="success">{saved}</StateMessage> : null}
      {loading && !s ? <StateMessage tone="loading">Loading…</StateMessage> : null}

      {s ? (
        <>
          <Section title="Current subscription"
            actions={canManage && (s.status === "active" || s.status === "trial") ? <>
              <Button variant="outline" onClick={() => setEnding({ kind: "suspend", reason: "" })}>Suspend</Button>
              <Button variant="destructive" onClick={() => setEnding({ kind: "cancel", reason: "" })}>Cancel subscription</Button>
            </> : null}>
            <div className="gl-chip-row">
              <Chip tone={s.active ? "ok" : "bad"}>{STATUS_LABEL[s.status]}</Chip>
              <Chip tone="info">{s.packages.find((p) => p.package === s.package)?.label ?? "No package"}</Chip>
            </div>
            {s.issues.map((i) => <div key={i} className="gl-note gl-note--warn">{i}</div>)}
            <dl className="gl-detail">
              <div><dt>Period</dt><dd>{s.startsOn ? `${day(s.startsOn)} – ${s.endsOn ? day(s.endsOn) : "open-ended"}` : "—"}</dd></div>
              <div><dt>Charges</dt><dd>{s.monthlyPrice !== null && s.monthlyPrice !== undefined ? `${s.monthlyPrice} ${s.currency} / month` : "Not set"}{s.overagePricePerUnit ? ` · extra units ${s.overagePricePerUnit} ${s.currency}` : ""}</dd></div>
              <div><dt>Charges accepted</dt><dd>{s.chargesAcceptedByName ? `${s.chargesAcceptedByName}, ${when(s.chargesAcceptedAtUtc)}` : "—"}</dd></div>
              <div><dt>Capabilities</dt><dd>{s.capabilities.length ? s.capabilities.map((c) => CAPABILITY_LABEL[c] ?? c).join(", ") : "None"}</dd></div>
            </dl>
          </Section>

          <Section title={`Usage in ${String(s.period).slice(0, 4)}-${String(s.period).slice(4)}`} hint="Units counted: monitoring run 1, briefing 1, executed action 2, plain-language summary 5, question 5."
            actions={canManage && s.active ? <Button variant="outline" onClick={() => setOverage({ budget: String(s.overageBudgetUnits ?? Math.round(s.includedUnitsPerMonth / 2)), accept: false })}>
              {s.overageAuthorized ? "Change extra usage" : "Allow extra usage"}</Button> : null}>
            <div className="oo-meter" role="meter" aria-valuemin={0} aria-valuemax={allowance} aria-valuenow={s.usedUnits} aria-label="Units used this month">
              <span className={s.exhausted ? "is-bad" : s.warning ? "is-warn" : ""} style={{ width: `${share}%` }} />
            </div>
            <p className="gl-muted">{s.usedUnits} of {s.includedUnitsPerMonth} included units used{s.overageAuthorized ? ` · up to ${s.overageBudgetUnits} extra authorized by ${s.overageAuthorizedByName}` : " · extra usage not authorized"}{s.remainingUnits !== null && s.remainingUnits !== undefined ? ` · ${s.remainingUnits} left` : ""}</p>
            <div className="gl-table-wrap">
              <table className="gl-table">
                <thead><tr><th>Work</th><th className="gl-num">Count</th><th className="gl-num">Units</th></tr></thead>
                <tbody>{s.usage.map((u) => <tr key={u.kind}><td>{KIND_LABEL[u.kind] ?? u.kind}</td><td className="gl-num">{u.count}</td><td className="gl-num">{u.units}</td></tr>)}</tbody>
              </table>
            </div>
          </Section>

          <Section title="Packages" hint="Each package includes the ones before it. Prices are agreed with the company; the names and allowances are proposals.">
            <div className="oo-two">
              {s.packages.map((p) => (
                <article key={p.package} className="oo-card">
                  <div className="oo-card-head"><h3>{p.label}</h3>{p.package === s.package && s.active ? <Chip tone="ok">Current</Chip> : null}</div>
                  <p>{p.description}</p>
                  <div className="oo-meta"><span>{p.defaultIncludedUnits.toLocaleString()} units / month included</span><span>Needs: {p.dependencies.join(", ")}</span></div>
                  {canManage ? <div><Button size="sm" variant={p.package === s.package && s.active ? "outline" : "default"} onClick={() => setChoice({
                    definition: p, units: String(p.package === s.package ? s.includedUnitsPerMonth : p.defaultIncludedUnits), price: s.monthlyPrice?.toString() ?? "",
                    overagePrice: s.overagePricePerUnit?.toString() ?? "", currency: s.currency || "ETB", trial: false, accept: false, endsOn: s.endsOn ?? "",
                  })}>{p.package === s.package && s.active ? "Renew or change terms" : RANK[p.package] < RANK[s.package] && s.active ? "Downgrade" : "Choose"}</Button></div> : null}
                </article>
              ))}
            </div>
          </Section>

          <Section title="Branches covered" hint="The officer monitors, briefs and acts only in activated branches. Deactivating a branch hands its queued work to people."
            actions={canManage ? <Button disabled={busy || !changedBranches} onClick={() => void run(() => officerApi.setSubscriptionBranches(companyId, branches), "The branches could not be saved.", undefined, "Branches saved.")}>Save branches</Button> : null}>
            <div className="oo-cards">
              {s.branches.map((b) => (
                <label key={b.branchId} className="gl-check">
                  <Checkbox disabled={!canManage} checked={branches.includes(b.branchId)} onChange={(e) => setBranches(e.target.checked ? [...branches, b.branchId] : branches.filter((x) => x !== b.branchId))} />
                  {b.branchName}{b.active && b.activatedByName ? <small className="gl-muted"> · since {when(b.activatedAtUtc)} by {b.activatedByName}</small> : null}
                </label>
              ))}
            </div>
          </Section>
        </>
      ) : null}

      {choice && s ? (
        <GlDialog open title={`${choice.definition.label}`} busy={busy} error={error} onClose={() => setChoice(null)} confirmText={choice.trial ? "Start trial" : "Subscribe"}
          description={RANK[choice.definition.package] < RANK[s.package] && s.active ? "A downgrade stops capabilities the new package does not include and hands queued work to people at once." : choice.definition.description}
          confirmDisabled={!choice.accept && !(choice.trial && !num(choice.price) && !num(choice.overagePrice))}
          onConfirm={() => void run(() => officerApi.subscribe(companyId, {
            package: choice.definition.package, acceptCharges: choice.accept, includedUnitsPerMonth: num(choice.units), monthlyPrice: num(choice.price),
            overagePricePerUnit: num(choice.overagePrice), currency: choice.currency, trial: choice.trial, endsOn: choice.endsOn || null, version: s.version ?? null,
          }), "The subscription could not be saved.", () => setChoice(null), "Subscription saved.")}>
          <div className="gl-grid">
            <Field label="Included units per month"><Input type="number" min={0} value={choice.units} onChange={(e) => setChoice({ ...choice, units: e.target.value })} /></Field>
            <Field label="Monthly price (optional)"><Input type="number" min={0} step="any" value={choice.price} onChange={(e) => setChoice({ ...choice, price: e.target.value })} /></Field>
            <Field label="Price per extra unit (optional)"><Input type="number" min={0} step="any" value={choice.overagePrice} onChange={(e) => setChoice({ ...choice, overagePrice: e.target.value })} /></Field>
            <Field label="Currency"><Input value={choice.currency} onChange={(e) => setChoice({ ...choice, currency: e.target.value })} /></Field>
            <Field label="Ends on (optional)"><Input type="date" value={choice.endsOn} onChange={(e) => setChoice({ ...choice, endsOn: e.target.value })} /></Field>
          </div>
          <label className="gl-check"><Checkbox checked={choice.trial} onChange={(e) => setChoice({ ...choice, trial: e.target.checked })} /> Trial</label>
          <label className="gl-check"><Checkbox checked={choice.accept} onChange={(e) => setChoice({ ...choice, accept: e.target.checked })} /> I accept this package and its charges for the company</label>
        </GlDialog>
      ) : null}

      {overage && s ? (
        <GlDialog open title="Extra usage" busy={busy} error={error} onClose={() => setOverage(null)} confirmText="Authorize"
          description={`Beyond the ${s.includedUnitsPerMonth} included units, each unit is charged${s.overagePricePerUnit ? ` ${s.overagePricePerUnit} ${s.currency}` : ""}. New AI work stops when the budget is used up.`}
          confirmDisabled={!overage.accept || !(Number(overage.budget) > 0)}
          onConfirm={() => void run(() => officerApi.setOverage(companyId, true, Number(overage.budget), true), "Could not authorize extra usage.", () => setOverage(null), "Extra usage authorized.")}
          actions={s.overageAuthorized ? <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => officerApi.setOverage(companyId, false, null, false), "Could not withdraw.", () => setOverage(null), "Extra usage withdrawn.")}>Withdraw</Button> : null}>
          <Field label="Extra units allowed per month"><Input type="number" min={1} value={overage.budget} onChange={(e) => setOverage({ ...overage, budget: e.target.value })} /></Field>
          <label className="gl-check"><Checkbox checked={overage.accept} onChange={(e) => setOverage({ ...overage, accept: e.target.checked })} /> I authorize these charges</label>
        </GlDialog>
      ) : null}

      {ending ? (
        <GlDialog open danger title={ending.kind === "cancel" ? "Cancel AI COO" : "Suspend AI COO"} busy={busy} error={error} onClose={() => setEnding(null)}
          description="New AI work stops at once and queued actions are handed to people. Findings, briefings, targets and the audit trail are kept."
          confirmText={ending.kind === "cancel" ? "Cancel subscription" : "Suspend"} confirmDisabled={!ending.reason.trim()}
          onConfirm={() => void run(() => (ending.kind === "cancel" ? officerApi.cancelSubscription(companyId, ending.reason) : officerApi.suspendSubscription(companyId, ending.reason)),
            "The subscription could not be changed.", () => setEnding(null), "Done. Review the handed-over work under Actions.")}>
          <Field label="Reason"><Textarea rows={3} value={ending.reason} onChange={(e) => setEnding({ ...ending, reason: e.target.value })} /></Field>
        </GlDialog>
      ) : null}
    </div>
  );
}
