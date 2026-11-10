import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { StateMessage } from "../../../components/ui/Feedback";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, Field } from "../../finance/components/glShared";
import { officerApi, type DailyCycle, type BranchDay, type DayMetric, type Plan, type PlanListItem } from "../api/officerApi";
import { OfficerNav, Section, EvidenceList } from "../components/officerShared";

const zone = "Africa/Addis_Ababa";
const addis = (value?: string | null) => value ? new Intl.DateTimeFormat("en-GB", { timeZone: zone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const amount = (v?: number | null) => v == null ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: 2 });

function Metrics({ rows }: { rows: DayMetric[] }) {
  return <div className="oo-cards">{rows.map((m) => <div className="oo-card" key={m.name}>
    <div className="oo-card-head"><h3>{m.name}</h3><Chip tone={m.status === "Missed" ? "bad" : m.status === "Met" ? "ok" : "warn"}>{m.status}</Chip></div>
    <p>Actual <strong>{amount(m.actual)}{m.unit === "percent" ? "%" : ""}</strong> · Target <strong>{amount(m.target)}{m.unit === "percent" ? "%" : ""}</strong></p>
    <p className="gl-muted">{m.from} – {m.to} · Data as of {addis(m.dataAsOfUtc)}</p>
    <details><summary>Calculation, evidence and guidance</summary><p>{m.calculation}</p><ul>{m.guidance.map((g, i) => <li key={i}>{g}</li>)}</ul><EvidenceList items={m.evidence} /></details>
  </div>)}</div>;
}

function DayCard({ companyId, row, reload }: { companyId: string; row: BranchDay; reload: () => Promise<void> }) {
  const [plans, setPlans] = useState<PlanListItem[]>([]);
  const [planId, setPlanId] = useState(row.planId ?? "");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [salesPlan, setSales] = useState(row.salesPlan);
  const [foodCostPlan, setFood] = useState(row.foodCostPlan);
  const [wastePlan, setWaste] = useState(row.wastePlan);
  const [staffingPlan, setStaff] = useState(row.staffingPlan);
  const [explanation, setExplanation] = useState(row.explanation ?? "");
  const [correctivePlan, setCorrection] = useState(row.correctivePlan ?? "");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = `/companies/${companyId}/operations-officer`;
  useEffect(() => {
    let live = true;
    if (row.canSubmit) void officerApi.plans(companyId, row.branchId, true).then(p => { if (live) setPlans(p.filter(x => x.kind === "daily" && x.businessDate === row.businessDate)); }).catch(e => { if (live) setError(apiError(e, "Could not load plans.")); });
    return () => { live = false; };
  }, [companyId, row.branchId, row.businessDate, row.canSubmit]);
  useEffect(() => {
    let live = true; setPlan(null);
    if (planId) void officerApi.plan(companyId, planId).then(p => { if (live) setPlan(p); }).catch(e => { if (live) setError(apiError(e, "Could not open the plan.")); });
    return () => { live = false; };
  }, [companyId, planId]);
  async function run(work: () => Promise<unknown>) { setBusy(true); setError(null); try { await work(); await reload(); } catch(e) { setError(apiError(e, "Could not save. Reload and check your permissions and the record version.")); } finally { setBusy(false); } }
  return <Section title={row.branchName ?? "Branch"} hint={`Responsible manager: ${row.managerName ?? "Not assigned"}`}>
    <div className="gl-chip-row"><Chip tone={row.status === "Validated" ? "ok" : "warn"}>{row.status}</Chip>{row.late ? <Chip tone="warn">Late / past deadline</Chip> : null}</div>
    <p>Opened {addis(row.openedAtUtc)} · Plan due {addis(row.planDueAtUtc)} · Submitted {addis(row.submittedAtUtc)}</p>
    {row.validation.length ? <StateMessage tone="warning"><ul>{row.validation.map((v, i) => <li key={i}>{v}</li>)}</ul></StateMessage> : null}
    <h3>Opening review — yesterday / last completed target period</h3><Metrics rows={row.yesterday} />
    <h3>Today's targets and progress</h3><Metrics rows={row.today} />
    <details><summary>Manager's daily plan</summary>
      <p>Prepare activities in <Link to={`${root}/plans`}>Officer Plans</Link>, then submit the current version here. Validation checks completeness and approved targets; plan activation follows its own authority workflow.</p>
      {row.canSubmit ? <form onSubmit={e => { e.preventDefault(); if (plan) void run(() => officerApi.submitDailyPlan(companyId, row.id, { planId: plan.id, planVersion: plan.version, salesPlan, foodCostPlan, wastePlan, staffingPlan, version: row.version })); }}>
        <Field label="Daily plan"><Select aria-label="Daily plan" value={planId} onChange={e => setPlanId(e.target.value)}><option value="">Choose today's daily plan</option>{plans.map(p => <option key={p.id} value={p.id}>{p.title} · v{p.versionNo} · {p.status}</option>)}</Select></Field>
        {plan ? <p>{plan.activities.length} activities · {plan.status}{plan.issues.length ? ` · ${plan.issues.join(" ")}` : ""}</p> : null}
        <Field label="Sales actions and expected outcomes"><Textarea aria-label="Sales actions and expected outcomes" required maxLength={2000} value={salesPlan} onChange={e => setSales(e.target.value)} /></Field>
        <Field label="Food-cost controls"><Textarea aria-label="Food-cost controls" required maxLength={2000} value={foodCostPlan} onChange={e => setFood(e.target.value)} /></Field>
        <Field label="Wastage prevention"><Textarea aria-label="Wastage prevention" required maxLength={2000} value={wastePlan} onChange={e => setWaste(e.target.value)} /></Field>
        <Field label="Staffing, stock readiness and constraints"><Textarea aria-label="Staffing, stock readiness and constraints" required maxLength={2000} value={staffingPlan} onChange={e => setStaff(e.target.value)} /></Field>
        <Button disabled={busy || !plan} type="submit">Submit for validation</Button>
      </form> : <dl className="gl-detail"><div><dt>Sales</dt><dd>{row.salesPlan || "Not submitted"}</dd></div><div><dt>Food cost</dt><dd>{row.foodCostPlan || "Not submitted"}</dd></div><div><dt>Wastage</dt><dd>{row.wastePlan || "Not submitted"}</dd></div><div><dt>Readiness</dt><dd>{row.staffingPlan || "Not submitted"}</dd></div></dl>}
    </details>
    {row.explanationRequired ? <div className="gl-note gl-note--warn"><h3>Explanation and corrective plan required</h3><p>Response due {addis(row.explanationDueAtUtc)}</p>
      <p>Explain the verified variance, identify causes within your control and external blockers, and state the corrective actions and evidence of improvement.</p>
      {row.canRespond && !row.correctionActionId ? <form onSubmit={e => { e.preventDefault(); void run(() => officerApi.respondDailyCycle(companyId, row.id, { explanation, correctivePlan, dueAtUtc: new Date(`${due}:00+03:00`).toISOString(), version: row.version })); }}>
        <Field label="Cause, evidence and prior blockers"><Textarea aria-label="Cause, evidence and prior blockers" required maxLength={2000} value={explanation} onChange={e => setExplanation(e.target.value)} /></Field>
        <Field label="Corrective actions and measurable recovery"><Textarea aria-label="Corrective actions and measurable recovery" required maxLength={2000} value={correctivePlan} onChange={e => setCorrection(e.target.value)} /></Field>
        <Field label="Completion deadline — Addis Ababa time"><Input aria-label="Completion deadline — Addis Ababa time" required type="datetime-local" value={due} onChange={e => setDue(e.target.value)} /></Field>
        <Button type="submit" disabled={busy || !due}>Submit corrective plan</Button>
      </form> : <><p>{row.explanation || "Awaiting manager explanation."}</p><p>{row.correctivePlan}</p><p>Due {addis(row.correctionDueAtUtc)} · Follow-up: {row.correctionStatus ?? "Awaiting instruction proposal"}</p><Link to={`${root}/actions`}>Review corrective action</Link> · <Link to={`${root}/instructions`}>Track instruction and evidence</Link></>}
    </div> : null}
    {error ? <StateMessage tone="error">{error}</StateMessage> : null}
  </Section>;
}

export default function OfficerDailyCyclePage() {
  const { companyId = "" } = useParams();
  const configure = useHasPermission("aiops.configure");
  const [date, setDate] = useState(today);
  const [data, setData] = useState<DailyCycle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await officerApi.dailyCycle(companyId, date)); setError(null); } catch(e) { setData(null); setError(apiError(e, "Could not load the daily cycle.")); } }, [companyId, date]);
  useEffect(() => { void load(); }, [load]);
  async function run(work: () => Promise<unknown>) { setBusy(true); try { await work(); await load(); } catch(e) { setError(apiError(e, "The daily-cycle operation failed.")); } finally { setBusy(false); } }
  return <div className="gl-page"><PageHeader title="Daily Cycle" subtitle="Open each branch's management day at 07:00, review yesterday's results and validate managers' plans due at 08:00. All times use Africa/Addis_Ababa (UTC+3)." /><OfficerNav />
    <div className="gl-toolbar"><Field label="Business date"><Input aria-label="Business date" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Button variant="outline" disabled={busy} onClick={() => void load()}>Refresh</Button>
      {configure && data ? <><Button variant="outline" disabled={busy} onClick={() => void run(() => officerApi.setDailyCycle(companyId, !data.enabled))}>{data.enabled ? "Disable daily cycle" : "Enable daily cycle"}</Button><Button disabled={busy || !data.enabled} onClick={() => void run(() => officerApi.runDailyCycle(companyId))}>Run scheduled opening check</Button></> : null}
    </div>
    {error ? <StateMessage tone="error">{error}</StateMessage> : null}
    {data && !data.enabled ? <StateMessage>The daily cycle is disabled. An authorized administrator can enable it. Leadership subscription, activated branches, managed scope and responsible managers are required.</StateMessage> : null}
    {data?.branches.length === 0 ? <StateMessage>No branch days are available for this date and your access. Opening starts at 07:00 when the officer and daily cycle are enabled, automation is not paused, and allowance is available.</StateMessage> : null}
    {data ? <p>{data.branches.length} branches · {data.branches.filter(x => x.status === "Validated").length} validated · {data.branches.filter(x => x.status === "Missing").length} missing · {data.branches.filter(x => x.explanationRequired && !x.explanation).length} explanations outstanding</p> : null}
    {data?.branches.map(row => <DayCard key={`${row.id}:${row.version}`} companyId={companyId} row={row} reload={load} />)}
  </div>;
}
