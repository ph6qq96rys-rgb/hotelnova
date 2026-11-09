import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarPlus, ChefHat, Plus } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, day, Field, GlDialog } from "../../finance/components/glShared";
import { officerApi, type Commitment, type Plan, type PlanActivity, type PlanChanges, type PlanListItem, type ProductionRequirements } from "../api/officerApi";
import {
  ACTION_STATUS_LABEL, BranchSelect, EmployeeSelect, INSTRUCTION_STATUS_LABEL, INSTRUCTION_STATUS_TONE, OfficerNav, PLAN_STATUS_LABEL, PLAN_STATUS_TONE, Section,
  toLocalInput, toUtcIso, useOfficerRefs, when,
} from "../components/officerShared";

type Prepare = { kind: Plan["kind"]; date: string; eventId: string; reason: string };
const KIND_LABEL: Record<Plan["kind"], string> = { daily: "Daily", event: "Event", production: "Production" };
const CHANGE_LABEL: Record<PlanChanges["changes"][number]["change"], string> = { added: "Added", removed: "Withdrawn", changed: "Changed", unchanged: "Unchanged", completed: "Done, kept" };
const CHANGE_TONE: Record<PlanChanges["changes"][number]["change"], "ok" | "bad" | "warn" | "muted" | "neutral"> = { added: "ok", removed: "bad", changed: "warn", unchanged: "muted", completed: "neutral" };
const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });
type Edit = { activity: PlanActivity | null; title: string; detail: string; ownerEmployeeId: string; due: string; criteria: string };

const ACTIVITY_LABEL: Record<PlanActivity["status"], string> = { planned: "Planned", instructed: "Instructed", done: "Done", cancelled: "Removed" };

export default function OfficerPlansPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canManage = useHasPermission("aiops.plans.manage");
  const { refs, loaded } = useOfficerRefs(companyId);
  const [branchId, setBranchId] = useState("");
  const [currentOnly, setCurrentOnly] = useState(true);
  const [rows, setRows] = useState<PlanListItem[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [events, setEvents] = useState<Commitment[]>([]);
  const [production, setProduction] = useState<ProductionRequirements | null>(null);
  const [productionError, setProductionError] = useState<string | null>(null);
  const [changes, setChanges] = useState<PlanChanges | null>(null);
  const [prepare, setPrepare] = useState<Prepare | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { if (loaded && !branchId && refs.branches.length > 0) setBranchId(refs.branches[0].id); }, [loaded, branchId, refs.branches]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await officerApi.plans(companyId, branchId || undefined, currentOnly)); setError(null); }
    catch (e) { setError(apiError(e, "Plans could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId, branchId, currentOnly]);
  useEffect(() => { void load(); }, [load]);

  async function run<T>(job: () => Promise<T>, fallback: string, after?: (result: T) => void) {
    setBusy(true); setError(null);
    try { const r = await job(); after?.(r); await load(); }
    catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  const changesKey = plan?.supersedesPlanId ? `${plan.id}|${plan.version}` : null;
  useEffect(() => {
    if (!changesKey) { setChanges(null); return; }
    let live = true;
    officerApi.planChanges(companyId, changesKey.split("|")[0]).then((c) => { if (live) setChanges(c); }).catch(() => { if (live) setChanges(null); });
    return () => { live = false; };
  }, [companyId, changesKey]);

  const productionKey = prepare?.kind === "production" ? `${branchId}|${prepare.date}` : null;
  useEffect(() => {
    if (!productionKey || !branchId) { setProduction(null); return; }
    let live = true;
    setProduction(null); setProductionError(null);
    officerApi.productionRequirements(companyId, branchId, productionKey.split("|")[1] || null)
      .then((r) => { if (live) setProduction(r); })
      .catch((e) => { if (live) setProductionError(apiError(e, "Production requirements could not be calculated.")); });
    return () => { live = false; };
  }, [companyId, branchId, productionKey]);

  async function openPrepare(kind: Plan["kind"]) {
    setError(null);
    if (kind === "event" && branchId) {
      try { setEvents((await officerApi.liveBriefing(companyId, branchId)).upcoming.filter((u) => u.type === "CateringEvent")); }
      catch { setEvents([]); }
    }
    setPrepare({ kind, date: "", eventId: "", reason: "" });
  }

  function submitPrepare() {
    if (!prepare) return;
    void run(() => prepare.kind === "daily"
      ? officerApi.prepareDailyPlan(companyId, branchId, prepare.date || null, prepare.reason)
      : prepare.kind === "production"
        ? officerApi.prepareProductionPlan(companyId, branchId, prepare.date || null, prepare.reason)
        : officerApi.prepareEventPlan(companyId, prepare.eventId, prepare.reason),
    "The plan could not be prepared.", (p) => { setPrepare(null); setPlan(p); });
  }

  function submitEdit() {
    if (!plan || !edit) return;
    const due = toUtcIso(edit.due);
    void run(() => edit.activity
      ? officerApi.updateActivity(companyId, plan.id, edit.activity.id, { ownerEmployeeId: edit.ownerEmployeeId || null, dueAtUtc: due || null, title: edit.title, detail: edit.detail, version: plan.version })
      : officerApi.addActivity(companyId, plan.id, { title: edit.title, detail: edit.detail || null, ownerEmployeeId: edit.ownerEmployeeId || null, dueAtUtc: due, completionCriteria: edit.criteria, version: plan.version }),
    "The activity could not be saved.", (p) => { setEdit(null); setPlan(p); });
  }

  const draft = plan?.status === "draft" && canManage;

  return (
    <div className="gl-page">
      <PageHeader title="Officer Plans"
        subtitle="Daily, production and event operating plans drafted from today's priorities, expected sales, deliveries, events and stock. Adjust a draft, then activate it: each activity becomes an instruction to its owner."
        actions={canManage ? <>
          <Button variant="outline" disabled={!branchId || busy} onClick={() => void openPrepare("production")}><ChefHat size={16} /> Production plan</Button>
          <Button variant="outline" disabled={!branchId || busy} onClick={() => void openPrepare("event")}><CalendarPlus size={16} /> Event plan</Button>
          <Button disabled={!branchId || busy} onClick={() => void openPrepare("daily")}><Plus size={16} /> Daily plan</Button>
        </> : null} />
      <OfficerNav />
      <div className="gl-toolbar">
        <Field label="Branch"><BranchSelect value={branchId} onChange={setBranchId} branches={refs.branches} /></Field>
        <Field label="Show">
          <Select value={currentOnly ? "current" : "all"} onChange={(e) => setCurrentOnly(e.target.value === "current")}>
            <option value="current">Drafts and active plans</option>
            <option value="all">All versions</option>
          </Select>
        </Field>
      </div>
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {error && !plan && !prepare ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">Loading plans…</StateMessage> : null}

      <div className="gl-table-wrap">
        <table className="gl-table">
          <thead><tr><th>Plan</th><th>Day</th><th>Version</th><th>Activities</th><th>Status</th></tr></thead>
          <tbody>
            {!loading && rows.length === 0 ? <tr><td colSpan={5} className="gl-empty">No plans yet.</td></tr> : null}
            {rows.map((p) => (
              <tr key={p.id} className="gl-row" tabIndex={0} onClick={() => void run(() => officerApi.plan(companyId, p.id), "The plan could not be opened.", setPlan)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void run(() => officerApi.plan(companyId, p.id), "The plan could not be opened.", setPlan); } }}>
                <td>{p.title}<small>{KIND_LABEL[p.kind] ?? p.kind} · {p.branchName}</small></td>
                <td>{day(p.businessDate)}</td>
                <td>v{p.versionNo}</td>
                <td>{p.done}/{p.activities} done</td>
                <td><Chip tone={PLAN_STATUS_TONE[p.status]}>{PLAN_STATUS_LABEL[p.status]}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plan && !edit && !prepare && cancelReason === null ? (
        <GlDialog open size="wide" title={`${plan.title} · v${plan.versionNo}`} confirmText="" closeText="Close" busy={busy} error={error} onClose={() => { setPlan(null); setError(null); }}
          actions={canManage ? <>
            {draft ? <Button type="button" variant="outline" disabled={busy} onClick={() => setEdit({ activity: null, title: "", detail: "", ownerEmployeeId: "", due: "", criteria: "" })}><Plus size={16} /> Activity</Button> : null}
            {plan.status === "active" ? <Button type="button" variant="outline" disabled={busy} onClick={() => setPrepare({ kind: plan.kind, date: plan.businessDate, eventId: plan.cateringEventId ?? "", reason: "" })}>Revise</Button> : null}
            {plan.status === "draft" || plan.status === "pendingActivation" || plan.status === "active" ? <Button type="button" variant="outline" disabled={busy} onClick={() => setCancelReason("")}>Cancel plan</Button> : null}
            {draft ? <Button type="button" disabled={busy || plan.issues.length > 0} onClick={() => void run(() => officerApi.activatePlan(companyId, plan.id, plan.version), "The plan could not be activated.", (p) => {
              setPlan(p); setNotice(p.status === "active" ? "Plan active. Instructions were issued to the owners." : "Activation requested. It waits for approval under the delegated authority.");
            })}>Activate</Button> : null}
          </> : null}>
          <div className="gl-chip-row">
            <Chip tone={PLAN_STATUS_TONE[plan.status]}>{PLAN_STATUS_LABEL[plan.status]}</Chip>
            {plan.activationStatus ? <Chip tone="muted">Activation: {ACTION_STATUS_LABEL[plan.activationStatus]}</Chip> : null}
          </div>
          {plan.activationNote && plan.status === "pendingActivation" ? <p className="gl-note">{plan.activationNote}</p> : null}
          {plan.issues.length > 0 ? <StateMessage tone="error">{plan.issues.join(" ")}</StateMessage> : null}
          <dl className="gl-detail">
            <div><dt>Branch</dt><dd>{plan.branchName}</dd></div>
            <div><dt>Day</dt><dd>{day(plan.businessDate)}</dd></div>
            <div><dt>Prepared</dt><dd>{when(plan.createdAtUtc)} by {plan.createdByName}</dd></div>
            {plan.activatedAtUtc ? <div><dt>Activated</dt><dd>{when(plan.activatedAtUtc)} by {plan.activatedByName}</dd></div> : null}
            {plan.revisionReason ? <div><dt>Why revised</dt><dd>{plan.revisionReason}</dd></div> : null}
          </dl>
          {plan.assumptions ? <Section title="Assumptions"><ul className="oo-evidence">{plan.assumptions.split("\n").map((a) => <li key={a}><span>{a}</span></li>)}</ul></Section> : null}
          {plan.constraints ? <Section title="Constraints and gaps"><ul className="oo-evidence">{plan.constraints.split("\n").map((a) => <li key={a}><span>{a}</span></li>)}</ul></Section> : null}
          {changes && changes.comparedVersionNo ? (
            <Section title={`Changes from v${changes.comparedVersionNo}`}>
              <div data-testid="plan-changes">
                {changes.material
                  ? <StateMessage tone="warning">Material change: {changes.materialReasons.join("; ")}. Activation follows the delegated authority for revisions.</StateMessage>
                  : <StateMessage>Not a material change: open instructions are kept and new work is added.</StateMessage>}
                {changes.costChange != null ? <p className="gl-note">Stock cost of the quantity changes: {changes.costChange >= 0 ? "+" : ""}{changes.costChange.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p> : null}
                <table className="gl-table">
                  <thead><tr><th>Activity</th><th>Change</th><th>Owner</th><th>Deadline</th><th>Quantity</th><th>Instruction</th></tr></thead>
                  <tbody>
                    {changes.changes.map((c) => (
                      <tr key={c.activityKey}>
                        <td>{c.title}{c.previousTitle && c.previousTitle !== c.title ? <small>was {c.previousTitle}</small> : null}{c.dependsOn !== c.previousDependsOn && c.change === "changed" ? <small>after {c.dependsOn ?? "nothing"} (was {c.previousDependsOn ?? "nothing"})</small> : null}</td>
                        <td><Chip tone={CHANGE_TONE[c.change]}>{CHANGE_LABEL[c.change]}</Chip></td>
                        <td>{c.ownerName ?? "—"}{c.previousOwnerName && c.previousOwnerName !== c.ownerName ? <small>was {c.previousOwnerName}</small> : null}</td>
                        <td>{c.dueAtUtc ? when(c.dueAtUtc) : "—"}{c.previousDueAtUtc && c.previousDueAtUtc !== c.dueAtUtc ? <small>was {when(c.previousDueAtUtc)}</small> : null}</td>
                        <td>{c.quantity != null || c.previousQuantity != null ? <>{c.quantity != null ? qty(c.quantity) : "—"} {c.unit}{c.previousQuantity != null && c.previousQuantity !== c.quantity ? <small>was {qty(c.previousQuantity)}</small> : null}</> : "—"}</td>
                        <td>{c.instructionEffect}{c.costChange ? <small>Cost {c.costChange > 0 ? "+" : ""}{c.costChange.toLocaleString(undefined, { maximumFractionDigits: 2 })}</small> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}
          <h4>Activities</h4>
          <div className="oo-cards">
            {plan.activities.map((a) => (
              <article key={a.id} className="oo-card">
                <div className="oo-card-head">
                  <h3>{a.sortOrder}. {a.title}</h3>
                  <div className="gl-chip-row">
                    {a.instructionStatus ? <Chip tone={INSTRUCTION_STATUS_TONE[a.instructionStatus]}>{INSTRUCTION_STATUS_LABEL[a.instructionStatus]}</Chip> : <Chip tone={a.status === "cancelled" ? "muted" : "neutral"}>{ACTIVITY_LABEL[a.status]}</Chip>}
                    <Chip tone="muted">{a.completionMode === "transaction" ? "Checked in Process360" : "Evidence"}</Chip>
                  </div>
                </div>
                {a.detail ? <p>{a.detail}</p> : null}
                <div className="oo-meta">
                  <span>Owner: {a.ownerName ?? <strong>not assigned</strong>} ({a.ownerRole})</span>
                  <span>Due {when(a.dueAtUtc)}</span>
                  {a.dependsOn ? <span>After: {plan.activities.find((x) => x.activityKey === a.dependsOn)?.title ?? a.dependsOn}</span> : null}
                  {a.linkedDocNo ? <span>{a.linkedDocNo}</span> : null}
                </div>
                <p className="gl-muted">Done when: {a.completionCriteria}</p>
                {draft && a.status === "planned" ? (
                  <div className="gl-toolbar">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setEdit({ activity: a, title: a.title, detail: a.detail ?? "", ownerEmployeeId: a.ownerEmployeeId ?? "", due: toLocalInput(a.dueAtUtc), criteria: a.completionCriteria })}>Change</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => officerApi.removeActivity(companyId, plan.id, a.id, plan.version), "The activity could not be removed.", setPlan)}>Remove</Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </GlDialog>
      ) : null}

      {prepare ? (
        <GlDialog open title={prepare.kind === "daily" ? (plan?.status === "active" ? "Revise the daily plan" : "Prepare a daily plan")
            : prepare.kind === "production" ? (plan?.status === "active" ? "Revise the production plan" : "Prepare a production plan") : "Prepare an event plan"}
          description="The officer drafts the plan from Process360 records. Nothing is issued until the plan is activated."
          busy={busy} error={error} onClose={() => { setPrepare(null); setError(null); }} confirmText="Prepare"
          confirmDisabled={(prepare.kind === "event" && !prepare.eventId) || (prepare.kind === "production" && (!production || production.lines.length === 0))} onConfirm={submitPrepare}>
          {prepare.kind !== "event" ? (
            <Field label="Day" hint="Today if left empty."><Input type="date" value={prepare.date} onChange={(e) => setPrepare({ ...prepare, date: e.target.value })} /></Field>
          ) : null}
          {prepare.kind === "production" ? (
            <div className="gl-stack" data-testid="production-preview">
              {productionError ? <StateMessage tone="error">{productionError}</StateMessage> : null}
              {!production && !productionError ? <StateMessage tone="loading">Calculating from recipes, expected sales and stock…</StateMessage> : null}
              {production ? <>
                {production.lines.length === 0 ? <StateMessage>Nothing needs to be prepared for this day.</StateMessage> : (
                  <table className="gl-table">
                    <thead><tr><th>Prepared item</th><th>Needed</th><th>Usable stock</th><th>Batches</th><th>Where / who</th><th>Ingredients short</th></tr></thead>
                    <tbody>
                      {production.lines.map((l) => (
                        <tr key={l.itemId}>
                          <td>{l.itemName}<small>{l.demandFrom.slice(0, 3).join(", ")}</small></td>
                          <td>{qty(l.demand)} {l.baseUnit}</td>
                          <td>{qty(l.usableStock)}</td>
                          <td>{l.batches} × {qty(l.yieldPerBatch)} = {qty(l.plannedQuantity)}<small>Ready by {when(l.readyByUtc)}</small></td>
                          <td>{l.locationName ?? "No location"}<small>{l.supervisorName ?? "No supervisor set"}</small></td>
                          <td>{l.ingredients.filter((i) => i.short > 0).map((i) => `${i.itemName} ${qty(i.short)} ${i.baseUnit}`).join(", ") || "None"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {production.blocked.length > 0 ? <StateMessage tone="warning">Left out until fixed: {production.blocked.join("; ")}</StateMessage> : null}
                {production.assumptions.map((a) => <small key={a}>{a}</small>)}
              </> : null}
            </div>
          ) : null}
          {prepare.kind === "event" ? (
            <Field label="Catering event" hint={events.length === 0 && !prepare.eventId ? "No events in the next 7 days." : undefined}>
              <Select value={prepare.eventId} onChange={(e) => setPrepare({ ...prepare, eventId: e.target.value })}>
                <option value="">Choose an event</option>
                {events.map((ev) => <option key={ev.id ?? ev.reference} value={ev.id ?? ""}>{ev.reference} · {when(ev.dueUtc)} · {ev.label}</option>)}
                {prepare.eventId && !events.some((ev) => ev.id === prepare.eventId) ? <option value={prepare.eventId}>This plan's event</option> : null}
              </Select>
            </Field>
          ) : null}
          <Field label="Reason for revision" hint="Needed when a plan for this day or event is already active.">
            <Textarea rows={2} value={prepare.reason} onChange={(e) => setPrepare({ ...prepare, reason: e.target.value })} />
          </Field>
        </GlDialog>
      ) : null}

      {edit && plan ? (
        <GlDialog open title={edit.activity ? "Change activity" : "Add activity"} busy={busy} error={error} onClose={() => { setEdit(null); setError(null); }} confirmText="Save"
          confirmDisabled={!edit.title.trim() || (!edit.activity && (!edit.due || !edit.criteria.trim()))} onConfirm={submitEdit}>
          <Field label="Title"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <Field label="Detail"><Textarea rows={2} value={edit.detail} onChange={(e) => setEdit({ ...edit, detail: e.target.value })} /></Field>
          <Field label="Owner"><EmployeeSelect value={edit.ownerEmployeeId} onChange={(v) => setEdit({ ...edit, ownerEmployeeId: v })} employees={refs.employees} branchId={plan.branchId} placeholder="Choose a person" /></Field>
          <Field label="Deadline"><Input type="datetime-local" value={edit.due} onChange={(e) => setEdit({ ...edit, due: e.target.value })} /></Field>
          {!edit.activity ? <Field label="Done when"><Input value={edit.criteria} onChange={(e) => setEdit({ ...edit, criteria: e.target.value })} /></Field> : null}
        </GlDialog>
      ) : null}

      {cancelReason !== null && plan ? (
        <GlDialog open title="Cancel plan" description={plan.status === "active" ? "Its open instructions are cancelled too." : plan.title} busy={busy} error={error} danger
          onClose={() => setCancelReason(null)} confirmText="Cancel plan" confirmDisabled={!cancelReason.trim()}
          onConfirm={() => void run(() => officerApi.cancelPlan(companyId, plan.id, cancelReason, plan.version), "The plan could not be cancelled.", () => { setCancelReason(null); setPlan(null); })}>
          <Field label="Reason"><Textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></Field>
        </GlDialog>
      ) : null}
    </div>
  );
}
