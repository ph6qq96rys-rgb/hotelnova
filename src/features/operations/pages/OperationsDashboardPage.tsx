import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { operationsApi } from "../api/operationsApi";
import type { BackOfficeEfficiencySnapshotDto, CashierShiftDto, DailyOperationPlanDto, DailyOperationPlanSummaryDto, EndOfDayReportDto, OperationsPosStoreDto, SafeDropDto, SalesSummaryDto, WorkflowReasonCodeDto } from "../api/operationsTypes";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { formatAppDateTime, todayLocalIsoDate } from "../../../shared/datetime/dateFormat";
import { useI18n } from "../../../i18n";
import "../styles/operations.css";

function getErrorText(e: unknown) {
  const err = e as any;
  return (
    err?.response?.data?.message ||
    err?.response?.data?.title ||
    err?.message ||
    "Request failed."
  );
}

type PlanForm = {
  expectedCovers: number;
  expectedSales: number;
  requiredEmployees: number;
  requiredEmployeesByPosition: string;
  requiredFoodProduction: string;
  criticalInventoryLevels: string;
  outstandingPurchaseOrders: string;
  equipmentAvailability: string;
  openOperationalIssues: string;
  salesTargets: string;
  planningInputs: string;
};

type ModalState = "openShift" | "closeShift" | "safeDrop" | "readyException" | "eodVariance" | null;

let translateOpsText = (text: string) => text;

const emptyPlan: PlanForm = {
  expectedCovers: 0,
  expectedSales: 0,
  requiredEmployees: 0,
  requiredEmployeesByPosition: "",
  requiredFoodProduction: "",
  criticalInventoryLevels: "",
  outstandingPurchaseOrders: "",
  equipmentAvailability: "",
  openOperationalIssues: "",
  salesTargets: "",
  planningInputs: "",
};

export default function OperationsDashboardPage() {
  const { tx } = useI18n();
  translateOpsText = tx;
  const { companyId, branchId, branchName } = useAppScope();
  const [businessDate, setBusinessDate] = useState(() => todayLocalIsoDate());
  const [shiftName, setShiftName] = useState("Day");
  const [registerDateTo, setRegisterDateTo] = useState(() => todayLocalIsoDate());
  const [registerDateFrom, setRegisterDateFrom] = useState(() => addDaysIso(todayLocalIsoDate(), -30));
  const [registerStatus, setRegisterStatus] = useState("");
  const [planRegister, setPlanRegister] = useState<DailyOperationPlanSummaryDto[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [plan, setPlan] = useState<DailyOperationPlanDto | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyPlan);
  const [briefingNotes, setBriefingNotes] = useState("");
  const [shift, setShift] = useState<CashierShiftDto | null>(null);
  const [drops, setDrops] = useState<SafeDropDto[]>([]);
  const [summary, setSummary] = useState<SalesSummaryDto | null>(null);
  const [backOffice, setBackOffice] = useState<BackOfficeEfficiencySnapshotDto | null>(null);
  const [eod, setEod] = useState<EndOfDayReportDto | null>(null);
  const [stores, setStores] = useState<OperationsPosStoreDto[]>([]);
  const [readinessReasons, setReadinessReasons] = useState<WorkflowReasonCodeDto[]>([]);
  const [varianceReasons, setVarianceReasons] = useState<WorkflowReasonCodeDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [shiftForm, setShiftForm] = useState({ storeId: "", cashierName: "", terminal: "POS-1", openingFloat: "0" });
  const [closeShiftForm, setCloseShiftForm] = useState({ closingCash: "0", notes: "" });
  const [safeDropForm, setSafeDropForm] = useState({ amount: "0", referenceNo: "", notes: "" });
  const [exceptionForm, setExceptionForm] = useState({ reason: "", reasonCodeId: "" });
  const [eodVarianceForm, setEodVarianceForm] = useState({ reasonCodeId: "", comment: "" });
  const activeBranchId = branchId;
  const branchOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    for (const row of planRegister) {
      map.set(row.branchId, { id: row.branchId, name: row.branchName, code: row.branchCode });
    }
    if (branchId && !map.has(branchId)) {
      map.set(branchId, { id: branchId, name: branchName || "Current branch", code: "" });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [branchId, branchName, planRegister]);
  const activeBranch = branchOptions.find((branch) => branch.id === activeBranchId);
  const activeBranchName =
    activeBranch?.name ||
    (activeBranchId === branchId ? branchName : null) ||
    "Selected branch";
  const activePlanName = `${activeBranchName} / ${businessDate} / ${shiftName}`;

  async function refresh() {
    if (!companyId || !activeBranchId) return;
    setLoadWarnings([]);

    const [
      open,
      sum,
      daily,
      snapshot,
      posStores,
      readyReasonRows,
      varianceReasonRows,
      businessDateDrops,
    ] = await Promise.allSettled([
      operationsApi.currentOpenShift(companyId, activeBranchId),
      operationsApi.salesSummaryForBusinessDate(companyId, activeBranchId, businessDate),
      operationsApi.dailyPlan(companyId, activeBranchId, businessDate, shiftName),
      operationsApi.backOfficeEfficiency(companyId, activeBranchId, businessDate),
      operationsApi.stores(companyId, activeBranchId),
      operationsApi.workflowReasons(companyId, "DailyOperation", "ReadinessException", "Ready"),
      operationsApi.workflowReasons(companyId, "DailyOperation", "EndOfDayVariance", "Close"),
      operationsApi.safeDropsForBusinessDate(companyId, activeBranchId, businessDate),
    ]);

    const warnings: string[] = [];

    if (open.status === "fulfilled") {
      setShift(open.value.data ?? null);
    } else {
      setShift(null);
      warnings.push(`${tx("Cashier shift status could not be loaded")}: ${getErrorText(open.reason)}`);
    }

    if (sum.status === "fulfilled") {
      setSummary(sum.value.data);
    } else {
      setSummary(null);
      warnings.push(`${tx("Sales summary could not be loaded")}: ${getErrorText(sum.reason)}`);
    }

    if (daily.status === "fulfilled") {
      setPlan(daily.value.data);
      setForm(planToForm(daily.value.data));
      setBriefingNotes(daily.value.data.briefingNotes || defaultBriefing(daily.value.data));
    } else {
      setPlan(null);
      warnings.push(`${tx("Daily operation plan could not be loaded")}: ${getErrorText(daily.reason)}`);
    }

    if (snapshot.status === "fulfilled") {
      setBackOffice(snapshot.value.data);
    } else {
      setBackOffice(null);
      warnings.push(`${tx("Back-office signals could not be loaded")}: ${getErrorText(snapshot.reason)}`);
    }

    if (posStores.status === "fulfilled") {
      setStores(posStores.value.data ?? []);
    } else {
      setStores([]);
      warnings.push(`${tx("POS stores could not be loaded")}: ${getErrorText(posStores.reason)}`);
    }

    if (readyReasonRows.status === "fulfilled") {
      setReadinessReasons(readyReasonRows.value.data ?? []);
    } else {
      setReadinessReasons([]);
      warnings.push(`${tx("Readiness exception reasons could not be loaded")}: ${getErrorText(readyReasonRows.reason)}`);
    }

    if (varianceReasonRows.status === "fulfilled") {
      setVarianceReasons(varianceReasonRows.value.data ?? []);
    } else {
      setVarianceReasons([]);
      warnings.push(`${tx("End-of-day variance reasons could not be loaded")}: ${getErrorText(varianceReasonRows.reason)}`);
    }

    if (businessDateDrops.status === "fulfilled") {
      setDrops(businessDateDrops.value.data ?? []);
    } else {
      setDrops([]);
      warnings.push(`${tx("Safe drops could not be loaded")}: ${getErrorText(businessDateDrops.reason)}`);
    }

    setLoadWarnings(warnings);
  }

  async function loadPlanRegister() {
    if (!companyId) return;
    setRegisterLoading(true);
    try {
      const result = await operationsApi.dailyPlanRegister(companyId, {
        branchId: branchId || null,
        dateFrom: registerDateFrom || null,
        dateTo: registerDateTo || null,
        status: registerStatus || null,
      });
      setPlanRegister(result.data ?? []);
    } catch (e) {
      setMessage(`${tx("Daily operation plans could not be loaded")}: ${getErrorText(e)}`);
      setPlanRegister([]);
    } finally {
      setRegisterLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [companyId, activeBranchId, businessDate, shiftName]);
  useEffect(() => { void loadPlanRegister(); }, [companyId, branchId, registerDateFrom, registerDateTo, registerStatus]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e?.response?.data?.title || e?.message || tx("Operation failed."));
    } finally {
      setBusy(false);
    }
  }

  async function savePlan() {
    await run(async () => {
      const saved = await operationsApi.saveDailyPlan(companyId, activeBranchId, { businessDate, shiftName, ...form });
      setPlan(saved.data);
      setForm(planToForm(saved.data));
      setMessage(saved.data.isPersisted ? tx("Daily operational plan saved.") : tx("Daily operational plan prepared."));
      await loadPlanRegister();
    });
  }

  async function recordBriefing() {
    if (!isSavedPlan(plan)) return;
    await run(async () => {
      const saved = await operationsApi.recordBriefing(companyId, activeBranchId, plan.id, briefingNotes);
      setPlan(saved.data);
      setMessage(tx("Pre-shift briefing recorded."));
      await loadPlanRegister();
    });
  }

  async function toggleChecklist(id: string, isCompleted: boolean) {
    if (!isSavedPlan(plan)) return;
    const next = plan.checklistItems.map((x) => x.id === id ? { ...x, isCompleted } : x);
    await run(async () => {
      const saved = await operationsApi.updateChecklist(companyId, activeBranchId, plan.id, next.map((x) => ({ id: x.id, isCompleted: x.isCompleted, notes: x.notes })));
      setPlan(saved.data);
      await loadPlanRegister();
    });
  }

  async function markReady() {
    if (!isSavedPlan(plan)) return;
    if (plan.criticalOpenCount > 0) {
      setExceptionForm({ reason: plan.readinessExceptionReason || "", reasonCodeId: "" });
      setModal("readyException");
      return;
    }

    await run(async () => {
      const saved = await operationsApi.markReady(companyId, activeBranchId, plan.id);
      setPlan(saved.data);
      setMessage(tx("Branch marked operationally ready."));
      await loadPlanRegister();
    });
  }

  async function submitReadyException() {
    if (!isSavedPlan(plan) || !exceptionForm.reason.trim() || !exceptionForm.reasonCodeId) return;
    await run(async () => {
      const saved = await operationsApi.markReady(
        companyId,
        activeBranchId,
        plan.id,
        exceptionForm.reason.trim(),
        exceptionForm.reasonCodeId || null,
      );
      setPlan(saved.data);
      setModal(null);
      setMessage(tx("Marked ready with manager exception."));
      await loadPlanRegister();
    });
  }

  async function openShift() {
    if (!shiftForm.storeId) return;
    await run(async () => {
      await operationsApi.openShift(companyId, activeBranchId, {
        storeId: shiftForm.storeId,
        cashierName: shiftForm.cashierName.trim(),
        terminal: shiftForm.terminal.trim() || "POS-1",
        openingFloat: Number(shiftForm.openingFloat || 0),
      });
      setModal(null);
      await refresh();
    });
  }

  async function closeShift() {
    if (!shift) return;
    await run(async () => {
      await operationsApi.closeShift(companyId, activeBranchId, shift.id, {
        closingCash: Number(closeShiftForm.closingCash || 0),
        notes: closeShiftForm.notes,
      });
      setModal(null);
      await refresh();
    });
  }

  async function safeDrop() {
    if (!shift) return;
    const amount = Number(safeDropForm.amount || 0);
    if (amount <= 0) return;
    await run(async () => {
      await operationsApi.createSafeDrop(companyId, activeBranchId, {
        cashierShiftId: shift.id,
        amount,
        method: "CASH",
        referenceNo: safeDropForm.referenceNo,
        notes: safeDropForm.notes,
      });
      setModal(null);
      await refresh();
    });
  }

  async function generateEod() {
    const variance = cashVariance(summary, drops);
    if (variance !== 0 && (!eodVarianceForm.reasonCodeId || !eodVarianceForm.comment.trim())) {
      setModal("eodVariance");
      return;
    }

    await run(async () => {
      const r = await operationsApi.generateEndOfDay(companyId, activeBranchId, {
        businessDate,
        varianceReasonCodeId: variance !== 0 ? eodVarianceForm.reasonCodeId : null,
        varianceComment: variance !== 0 ? eodVarianceForm.comment.trim() : null,
      });
      setEod(r.data);
      setModal(null);
      await loadPlanRegister();
    });
  }

  function openRegisteredPlan(row: DailyOperationPlanSummaryDto) {
    setBusinessDate(row.businessDate.slice(0, 10));
    setShiftName(row.shiftName || "Day");
    setMessage(`${tx("Opened plan")}: ${row.branchName} / ${row.shiftName} / ${row.businessDate.slice(0, 10)}.`);
  }

  const readinessPercent = plan ? Math.round((plan.checklistItems.filter((x) => x.isCompleted).length / Math.max(1, plan.checklistItems.length)) * 100) : 0;
  const savedPlan = isSavedPlan(plan);
  const planReady = plan?.status === "Ready" || plan?.status === "ReadyWithException";
  const canOpenShift = Boolean(savedPlan && planReady && stores.length > 0);
  const nextAction = getNextAction(plan, shift, eod, stores.length);
  const controlState = getControlState(plan, shift, eod);
  const workflowSteps = useMemo(
    () => buildWorkflowSteps(plan, shift, eod),
    [plan, shift, eod]
  );

  return (
    <main className="ops-page">
      <header className="ops-title">
        <div>
          <span>{tx("Daily Operations")}</span>
          <h1>{tx("Daily Operation Plan")}</h1>
          <p>{activePlanName}</p>
        </div>
        <div className="ops-toolbar">
          <label className="ops-toolbar-field"><span>{tx("Date")}</span><input className="ops-input" type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} /></label>
          <div className="ops-toolbar-field ops-toolbar-branch">
            <span>{tx("Branch")}</span>
            <b>{activeBranchName}</b>
          </div>
          <label className="ops-toolbar-field">
            <span>{tx("Shift")}</span>
            <select className="ops-input" value={shiftName} onChange={(e) => setShiftName(e.target.value)}>
              <option>Breakfast</option><option>Lunch</option><option>Day</option><option>Dinner</option><option>Night</option>
            </select>
          </label>
          <button className="ops-primary ops-primary-inline" disabled={busy} onClick={refresh}>{tx("Refresh")}</button>
        </div>
      </header>

      {message && <div className="ops-alert">{message}</div>}
      {loadWarnings.length > 0 && (
        <div className="ops-alert info">
          <b>{tx("Some operational signals need attention.")}</b>
          <ul>
            {loadWarnings.slice(0, 4).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {plan && !savedPlan && (
        <div className="ops-alert info">
          {tx("This plan is not saved yet. Save it before briefing, readiness approval, cashier control, or end-of-day close.")}
        </div>
      )}

      <section className="ops-control-panel">
        <article className="ops-control-card focus">
          <span>{tx("Opened Plan")}</span>
          <h2>{activeBranchName}</h2>
          <p>{businessDate} / {shiftName}</p>
        </article>
        <article className="ops-control-card">
          <span>{tx("Current State")}</span>
          <h2>{controlState.title}</h2>
          <p>{controlState.detail}</p>
        </article>
        <article className="ops-control-card">
          <span>{tx("Next Action")}</span>
          <h2>{nextAction.title}</h2>
          <p>{nextAction.detail}</p>
        </article>
      </section>

      <section className="ops-card ops-register">
        <div className="ops-card-head">
          <div>
            <span>{tx("Branch Plan Register")}</span>
            <h2>{tx("Open daily plans for")} {activeBranchName}</h2>
          </div>
          <button disabled={registerLoading} onClick={loadPlanRegister}>{registerLoading ? tx("Loading") : tx("Refresh")}</button>
        </div>
        <div className="ops-register-filters">
          <label className="ops-field"><span>{tx("From")}</span><input className="ops-input" type="date" value={registerDateFrom} onChange={(e) => setRegisterDateFrom(e.target.value)} /></label>
          <label className="ops-field"><span>{tx("To")}</span><input className="ops-input" type="date" value={registerDateTo} onChange={(e) => setRegisterDateTo(e.target.value)} /></label>
          <label className="ops-field">
            <span>{tx("Status")}</span>
            <select className="ops-input" value={registerStatus} onChange={(e) => setRegisterStatus(e.target.value)}>
              <option value="">{tx("All statuses")}</option>
              <option value="Draft">{tx("Draft")}</option>
              <option value="Briefed">{tx("Briefed")}</option>
              <option value="Ready">{tx("Ready")}</option>
              <option value="ReadyWithException">{tx("Ready with exception")}</option>
              <option value="Closed">{tx("Closed")}</option>
            </select>
          </label>
        </div>
        <div className="ops-register-table">
          <div className="ops-register-head">
            <span>{tx("Branch")}</span><span>{tx("Date")}</span><span>{tx("Status")}</span><span>{tx("Demand")}</span><span>{tx("Readiness")}</span><span></span>
          </div>
          {planRegister.length === 0 ? (
            <div className="ops-empty">{registerLoading ? tx("Loading daily operation plans.") : tx("No daily operation plans were found for this range.")}</div>
          ) : planRegister.map((row) => {
            const readiness = `${row.completedChecklistCount}/${Math.max(1, row.checklistCount)}`;
            return (
              <div key={row.id} className={`ops-register-row ${row.branchId === activeBranchId && row.businessDate.slice(0, 10) === businessDate && row.shiftName === shiftName ? "active" : ""}`}>
                <div><b>{row.branchName}</b><small>{row.branchCode || tx("Branch")}</small></div>
                <div><b>{row.businessDate.slice(0, 10)}</b><small>{row.shiftName}</small></div>
                <div><b className={`ops-pill ${statusClass(row.status)}`}>{row.status}</b><small>{row.readyAtUtc ? `${tx("Ready")} ${formatAppDateTime(row.readyAtUtc)}` : row.briefedAtUtc ? tx("Briefed") : tx("Not briefed")}</small></div>
                <div><b>{row.expectedCovers} {tx("covers")}</b><small>{money(row.expectedSales)} {tx("target")}</small></div>
                <div><b>{readiness}</b><small>{row.criticalOpenCount} {tx("critical open")}</small></div>
                <button disabled={busy} onClick={() => openRegisteredPlan(row)}>{tx("Open")}</button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="ops-workflow">
        {workflowSteps.map((step) => (
          <article key={step.label} className={`ops-workflow-step ${step.state}`}>
            <span>{step.eyebrow}</span>
            <b>{step.label}</b>
            <small>{step.detail}</small>
          </article>
        ))}
        <article className="ops-next-action">
          <span>{tx("Next Action")}</span>
          <b>{nextAction.title}</b>
          <small>{nextAction.detail}</small>
        </article>
      </section>

      <section className="ops-strip">
        <Kpi label="Expected Covers" value={plan?.expectedCovers ?? 0} />
        <Kpi label="Expected Sales" value={money(plan?.expectedSales ?? 0)} />
        <Kpi label="Employees Required" value={plan?.requiredEmployees ?? 0} />
        <Kpi label="Readiness" value={`${readinessPercent}%`} />
        <Kpi label="Critical Open" value={plan?.criticalOpenCount ?? 0} />
        <Kpi label="Status" value={plan?.status ?? "Draft"} />
      </section>

      {backOffice && <BackOfficeSnapshotPanel snapshot={backOffice} />}

      <section className="ops-grid ops-grid-wide">
        <div className="ops-card ops-card-span">
          <div className="ops-card-head"><div><span>{tx("Step 1")}</span><h2>{tx("Prepare Daily Plan")}</h2></div><button disabled={busy} onClick={savePlan}>{tx("Save Plan")}</button></div>
          <div className="ops-section-title">{tx("Demand and staffing")}</div>
          <div className="ops-form-grid">
            <Field label="Expected covers" type="number" value={form.expectedCovers} onChange={(v) => setForm({ ...form, expectedCovers: Number(v) })} />
            <Field label="Sales target" type="number" value={form.expectedSales} onChange={(v) => setForm({ ...form, expectedSales: Number(v) })} />
            <Field label="Required employees" type="number" value={form.requiredEmployees} onChange={(v) => setForm({ ...form, requiredEmployees: Number(v) })} />
            <TextField label="Employees by position" value={form.requiredEmployeesByPosition} onChange={(v) => setForm({ ...form, requiredEmployeesByPosition: v })} />
            <TextField label="Sales focus" value={form.salesTargets} onChange={(v) => setForm({ ...form, salesTargets: v })} />
          </div>
          <div className="ops-section-title">{tx("Food, stock, and readiness risks")}</div>
          <div className="ops-form-grid">
            <TextField label="Food production plan" value={form.requiredFoodProduction} onChange={(v) => setForm({ ...form, requiredFoodProduction: v })} />
            <TextField label="Inventory risks" value={form.criticalInventoryLevels} onChange={(v) => setForm({ ...form, criticalInventoryLevels: v })} />
            <TextField label="Outstanding purchase orders" value={form.outstandingPurchaseOrders} onChange={(v) => setForm({ ...form, outstandingPurchaseOrders: v })} />
            <TextField label="Equipment availability" value={form.equipmentAvailability} onChange={(v) => setForm({ ...form, equipmentAvailability: v })} />
            <TextField label="Open operational issues" value={form.openOperationalIssues} onChange={(v) => setForm({ ...form, openOperationalIssues: v })} />
          </div>
          <label className="ops-field">
            <span>{tx("Planning notes")}</span>
            <textarea className="ops-textarea" value={form.planningInputs} onChange={(e) => setForm({ ...form, planningInputs: e.target.value })} placeholder={tx("Reservations, catering, promotions, inventory, leave, maintenance")} />
          </label>
        </div>

        <div className="ops-card">
          <div className="ops-card-head"><div><span>{tx("Step 2")}</span><h2>{tx("Brief Team")}</h2></div><button disabled={busy || !savedPlan} onClick={recordBriefing}>{tx("Record Briefing")}</button></div>
          <textarea className="ops-textarea ops-textarea-tall" value={briefingNotes} onChange={(e) => setBriefingNotes(e.target.value)} />
          <div className="ops-detail"><b>{tx("Acknowledged:")}</b> {plan?.acknowledgements.length ?? 0} {tx("employees")}</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-head"><div><span>{tx("Cashier Control")}</span><h2>{shift ? tx("Open") : tx("No open shift")}</h2></div><b className={shift ? "ops-pill good" : "ops-pill warn"}>{shift ? tx("ACTIVE") : tx("CLOSED")}</b></div>
          {shift ? <div className="ops-detail"><p><b>{tx("Cashier:")}</b> {shift.cashierName}</p><p><b>{tx("Terminal:")}</b> {shift.terminal}</p><p><b>{tx("Opened:")}</b> {formatAppDateTime(shift.openedAtUtc)}</p></div> : <div className="ops-empty">{canOpenShift ? tx("Ready to open cashier control.") : tx("Complete readiness and configure at least one POS store before opening cashier control.")}</div>}
          <div className="ops-actions">
            {!shift && <button disabled={busy || !canOpenShift} onClick={() => setModal("openShift")}>{tx("Open Shift")}</button>}
            {shift && <button disabled={busy} onClick={() => setModal("safeDrop")}>{tx("Safe Drop")}</button>}
            {shift && <button disabled={busy} onClick={() => setModal("closeShift")}>{tx("Close Shift")}</button>}
          </div>
        </div>
      </section>

      <section className="ops-grid ops-grid-wide">
        <div className="ops-card ops-card-span">
          <div className="ops-card-head"><div><span>{tx("Step 3")}</span><h2>{tx("Operational Readiness Checklist")}</h2></div><button disabled={busy || !savedPlan} onClick={markReady}>{tx("Mark Operationally Ready")}</button></div>
          <div className="ops-checklist">
            {(plan?.checklistItems ?? []).map((item) => (
              <label key={item.id} className={`ops-check ${item.isCritical ? "critical" : ""}`}>
                <input type="checkbox" disabled={!savedPlan} checked={item.isCompleted} onChange={(e) => toggleChecklist(item.id, e.target.checked)} />
                <span><b>{item.area}</b>{item.item}</span>
                {item.isCritical && <em>{tx("Critical")}</em>}
              </label>
            ))}
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-head"><div><span>{tx("Sales Summary")}</span><h2>{money(summary?.netSales ?? 0)}</h2></div></div>
          <div className="ops-kpis">
            <Kpi label="Sales Count" value={summary?.salesCount ?? 0} />
            <Kpi label="Gross Sales" value={money(summary?.grossSales ?? 0)} />
            <Kpi label="COGS" value={money(summary?.totalCogs ?? 0)} />
            <Kpi label="Gross Profit" value={money(summary?.grossProfit ?? 0)} />
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-head"><div><span>{tx("End of Day")}</span><h2>{eod ? tx("Generated") : tx("Pending")}</h2></div></div>
          {eod ? <div className="ops-kpis"><Kpi label="Net Sales" value={money(eod.netSales)} /><Kpi label="Safe Drops" value={money(eod.totalSafeDrops)} /></div> : <div className="ops-empty">{tx("Generate after all operational activity is complete.")}</div>}
          <button className="ops-primary" disabled={busy} onClick={generateEod}>{tx("Generate End-of-Day")}</button>
          <div className="ops-detail"><b>{tx("Safe Drops:")}</b> {money(drops.reduce((s, x) => s + x.amount, 0))}</div>
        </div>
      </section>

      {modal === "openShift" && (
        <OpsModal title="Open cashier shift" onClose={() => setModal(null)}>
          <label className="ops-field">
            <span>{tx("POS store")}</span>
            <select className="ops-input" value={shiftForm.storeId} onChange={(e) => setShiftForm({ ...shiftForm, storeId: e.target.value })}>
              <option value="">{tx("Select POS store")}</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.code ? `${store.code} - ` : ""}{store.name}
                </option>
              ))}
            </select>
          </label>
          <Field label="Cashier name override (optional)" value={shiftForm.cashierName} onChange={(v) => setShiftForm({ ...shiftForm, cashierName: v })} />
          <Field label="Terminal" value={shiftForm.terminal} onChange={(v) => setShiftForm({ ...shiftForm, terminal: v })} />
          <Field label="Opening float" type="number" value={shiftForm.openingFloat} onChange={(v) => setShiftForm({ ...shiftForm, openingFloat: v })} />
          <div className="ops-modal-actions"><button onClick={() => setModal(null)}>{tx("Cancel")}</button><button disabled={busy || !shiftForm.storeId} onClick={openShift}>{tx("Open Shift")}</button></div>
        </OpsModal>
      )}

      {modal === "closeShift" && (
        <OpsModal title="Close cashier shift" onClose={() => setModal(null)}>
          <Field label="Closing cash" type="number" value={closeShiftForm.closingCash} onChange={(v) => setCloseShiftForm({ ...closeShiftForm, closingCash: v })} />
          <TextField label="Closing notes" value={closeShiftForm.notes} onChange={(v) => setCloseShiftForm({ ...closeShiftForm, notes: v })} />
          <div className="ops-modal-actions"><button onClick={() => setModal(null)}>{tx("Cancel")}</button><button disabled={busy} onClick={closeShift}>{tx("Close Shift")}</button></div>
        </OpsModal>
      )}

      {modal === "safeDrop" && (
        <OpsModal title="Record safe drop" onClose={() => setModal(null)}>
          <Field label="Amount" type="number" value={safeDropForm.amount} onChange={(v) => setSafeDropForm({ ...safeDropForm, amount: v })} />
          <Field label="Reference no" value={safeDropForm.referenceNo} onChange={(v) => setSafeDropForm({ ...safeDropForm, referenceNo: v })} />
          <TextField label="Notes" value={safeDropForm.notes} onChange={(v) => setSafeDropForm({ ...safeDropForm, notes: v })} />
          <div className="ops-modal-actions"><button onClick={() => setModal(null)}>{tx("Cancel")}</button><button disabled={busy} onClick={safeDrop}>{tx("Save Drop")}</button></div>
        </OpsModal>
      )}

      {modal === "readyException" && (
        <OpsModal title="Manager readiness exception" onClose={() => setModal(null)}>
          <div className="ops-detail">{tx("Critical checklist items are still open. A manager exception reason is required and will be audited.")}</div>
          <ReasonSelect label="Reason code" value={exceptionForm.reasonCodeId} reasons={readinessReasons} onChange={(v) => setExceptionForm({ ...exceptionForm, reasonCodeId: v })} />
          <TextField label="Exception reason" value={exceptionForm.reason} onChange={(v) => setExceptionForm({ ...exceptionForm, reason: v })} />
          <div className="ops-modal-actions"><button onClick={() => setModal(null)}>{tx("Cancel")}</button><button disabled={busy || !exceptionForm.reason.trim() || !exceptionForm.reasonCodeId} onClick={submitReadyException}>{tx("Approve Exception")}</button></div>
        </OpsModal>
      )}

      {modal === "eodVariance" && (
        <OpsModal title="Approve end-of-day variance" onClose={() => setModal(null)}>
          <div className="ops-detail">{tx("Cash payments and safe drops do not match. A controlled reason and comment are required before generating end-of-day.")}</div>
          <Kpi label="Cash variance" value={money(cashVariance(summary, drops))} />
          <ReasonSelect label="Variance reason" value={eodVarianceForm.reasonCodeId} reasons={varianceReasons} onChange={(v) => setEodVarianceForm({ ...eodVarianceForm, reasonCodeId: v })} />
          <TextField label="Variance comment" value={eodVarianceForm.comment} onChange={(v) => setEodVarianceForm({ ...eodVarianceForm, comment: v })} />
          <div className="ops-modal-actions"><button onClick={() => setModal(null)}>{tx("Cancel")}</button><button disabled={busy || !eodVarianceForm.reasonCodeId || !eodVarianceForm.comment.trim()} onClick={generateEod}>{tx("Generate End-of-Day")}</button></div>
        </OpsModal>
      )}
    </main>
  );
}

function isSavedPlan(plan: DailyOperationPlanDto | null): plan is DailyOperationPlanDto {
  return Boolean(plan?.isPersisted && plan.id && plan.id !== "00000000-0000-0000-0000-000000000000");
}

function buildWorkflowSteps(
  plan: DailyOperationPlanDto | null,
  shift: CashierShiftDto | null,
  eod: EndOfDayReportDto | null,
) {
  const saved = isSavedPlan(plan);
  const ready = plan?.status === "Ready" || plan?.status === "ReadyWithException";

  return [
    {
      eyebrow: "1",
      label: translateOpsText("Plan"),
      state: saved ? "done" : "active",
      detail: saved ? `${plan.shiftName} ${translateOpsText("plan saved")}` : translateOpsText("Save the daily plan"),
    },
    {
      eyebrow: "2",
      label: translateOpsText("Brief"),
      state: plan?.briefedAtUtc ? "done" : saved ? "active" : "pending",
      detail: plan?.briefedAtUtc ? translateOpsText("Briefing recorded") : translateOpsText("Record pre-shift notes"),
    },
    {
      eyebrow: "3",
      label: translateOpsText("Ready"),
      state: ready ? "done" : saved ? "active" : "pending",
      detail: ready ? translateOpsText(plan.status) : `${plan?.criticalOpenCount ?? 0} ${translateOpsText("critical open")}`,
    },
    {
      eyebrow: "4",
      label: translateOpsText("Cashier"),
      state: shift ? "active" : ready ? "pending" : "locked",
      detail: shift ? translateOpsText("Shift open") : translateOpsText("Open cashier control"),
    },
    {
      eyebrow: "5",
      label: translateOpsText("Close"),
      state: eod ? "done" : shift ? "pending" : ready ? "active" : "locked",
      detail: eod ? translateOpsText("EOD generated") : translateOpsText("Generate end-of-day"),
    },
  ];
}

function getNextAction(
  plan: DailyOperationPlanDto | null,
  shift: CashierShiftDto | null,
  eod: EndOfDayReportDto | null,
  storeCount: number,
) {
  if (!isSavedPlan(plan)) {
    return {
      title: translateOpsText("Save the daily operation plan"),
      detail: translateOpsText("Set expected covers, staffing, production, inventory, and operating risks."),
    };
  }

  if (!plan.briefedAtUtc) {
    return {
      title: translateOpsText("Record the pre-shift briefing"),
      detail: translateOpsText("Capture the manager briefing before readiness is approved."),
    };
  }

  if (plan.status !== "Ready" && plan.status !== "ReadyWithException") {
    return {
      title: translateOpsText("Complete readiness checks"),
      detail: plan.criticalOpenCount > 0
        ? translateOpsText("Resolve critical items or approve a manager exception.")
        : translateOpsText("Mark the branch operationally ready."),
    };
  }

  if (!shift && storeCount === 0) {
    return {
      title: translateOpsText("Configure POS store"),
      detail: translateOpsText("An active store with issue stock location is required before opening cashier control."),
    };
  }

  if (!shift) {
    return {
      title: translateOpsText("Open cashier shift"),
      detail: translateOpsText("Readiness is approved. Open the shift to start controlled sales operations."),
    };
  }

  if (!eod) {
    return {
      title: translateOpsText("Close shift and generate EOD"),
      detail: translateOpsText("Record safe drops, close cashier shift, then generate end-of-day."),
    };
  }

  return {
    title: translateOpsText("Operations closed"),
    detail: translateOpsText("End-of-day has been generated for this business date."),
  };
}

function getControlState(
  plan: DailyOperationPlanDto | null,
  shift: CashierShiftDto | null,
  eod: EndOfDayReportDto | null,
) {
  if (eod) {
    return {
      title: translateOpsText("Closed"),
      detail: `${translateOpsText("End-of-day generated by")} ${eod.generatedByName || translateOpsText("operations")}.`,
    };
  }

  if (shift) {
    return {
      title: translateOpsText("In Operation"),
      detail: `${shift.cashierName || translateOpsText("Cashier")} ${translateOpsText("is active on")} ${shift.terminal || translateOpsText("terminal")}.`,
    };
  }

  if (!isSavedPlan(plan)) {
    return {
      title: translateOpsText("Draft"),
      detail: translateOpsText("Demand, staffing, production, and risk inputs are being prepared."),
    };
  }

  if (plan.status === "Ready" || plan.status === "ReadyWithException") {
    return {
      title: plan.status === "ReadyWithException" ? translateOpsText("Ready with exception") : translateOpsText("Ready"),
      detail: plan.readyByName ? `${translateOpsText("Approved by")} ${plan.readyByName}.` : translateOpsText("Readiness approved."),
    };
  }

  if (plan.briefedAtUtc) {
    return {
      title: translateOpsText("Briefed"),
      detail: `${plan.criticalOpenCount} ${translateOpsText("critical readiness item(s) still open.")}`,
    };
  }

  return {
    title: translateOpsText("Planned"),
    detail: translateOpsText("Plan is saved and waiting for the team briefing."),
  };
}

function planToForm(plan: DailyOperationPlanDto): PlanForm {
  return {
    expectedCovers: plan.expectedCovers,
    expectedSales: plan.expectedSales,
    requiredEmployees: plan.requiredEmployees,
    requiredEmployeesByPosition: plan.requiredEmployeesByPosition || "",
    requiredFoodProduction: plan.requiredFoodProduction || "",
    criticalInventoryLevels: plan.criticalInventoryLevels || "",
    outstandingPurchaseOrders: plan.outstandingPurchaseOrders || "",
    equipmentAvailability: plan.equipmentAvailability || "",
    openOperationalIssues: plan.openOperationalIssues || "",
    salesTargets: plan.salesTargets || "",
    planningInputs: plan.planningInputs || "",
  };
}

function defaultBriefing(plan: DailyOperationPlanDto) {
  return [
    `${translateOpsText("Expected guest count:")} ${plan.expectedCovers}`,
    `${translateOpsText("Sales target:")} ${money(plan.expectedSales)}`,
    `${translateOpsText("Required employees:")} ${plan.requiredEmployees}`,
    translateOpsText("Featured menu items:"),
    translateOpsText("Unavailable menu items:"),
    translateOpsText("Large reservations / special customer requirements:"),
    translateOpsText("Employee assignments:"),
    translateOpsText("Service-quality expectations:"),
    translateOpsText("Food-safety reminders:"),
    translateOpsText("Known equipment problems:"),
    translateOpsText("Shift KPIs:"),
    translateOpsText("Previous-shift issues and corrective actions:"),
  ].join("\n");
}


function BackOfficeSnapshotPanel({ snapshot }: { snapshot: BackOfficeEfficiencySnapshotDto }) {
  const primary = snapshot.recommendations[0];
  return (
    <section className="ops-card ops-bo-card">
      <div className="ops-card-head">
        <div>
          <span>Back-Office Efficiency</span>
          <h2>{primary?.title || "Operational signals"}</h2>
        </div>
        <b className={`ops-pill ${severityClass(primary?.severity)}`}>{primary?.severity || "Good"}</b>
      </div>

      <div className="ops-bo-metrics">
        <Kpi label="Out of stock" value={snapshot.outOfStockItems} />
        <Kpi label="Low stock" value={snapshot.lowStockItems} />
        <Kpi label="Expiring lots" value={snapshot.expiringLots} />
        <Kpi label="Pending SIV" value={snapshot.pendingSivs} />
        <Kpi label="Purchase workflow" value={snapshot.pendingPurchaseRequisitions} />
        <Kpi label="Equipment issues" value={snapshot.equipmentIssues} />
      </div>

      <div className="ops-bo-columns">
        <div>
          <h3>System Recommendations</h3>
          <div className="ops-bo-list">
            {snapshot.recommendations.slice(0, 5).map((item) => (
              <article key={`${item.useCase}-${item.title}`} className={`ops-bo-row ${severityClass(item.severity)}`}>
                <div><b>{item.title}</b><small>{item.detail}</small></div>
                <p>{item.recommendedAction}</p>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h3>Inventory Attention</h3>
          <div className="ops-bo-list">
            {snapshot.inventoryAlerts.slice(0, 5).map((item) => (
              <article key={`${item.stockLocationId}-${item.itemId}`} className={`ops-bo-row ${severityClass(item.severity)}`}>
                <div><b>{item.itemName}</b><small>{item.stockLocationName} ({item.stockLocationCode})</small></div>
                <p>{qty(item.availableBaseQty)} / reorder {qty(item.reorderLevel)} {item.baseUom}. {item.recommendedAction}</p>
              </article>
            ))}
            {snapshot.inventoryAlerts.length === 0 && <div className="ops-empty">No low-stock items in assigned stock locations.</div>}
          </div>
        </div>
        <div>
          <h3>Expiring FIFO Lots</h3>
          <div className="ops-bo-list">
            {snapshot.expiringStock.slice(0, 5).map((lot) => (
              <article key={lot.lotId} className="ops-bo-row warn">
                <div><b>{lot.itemName}</b><small>{lot.stockLocationName} - {lot.batchNo || "No batch"}</small></div>
                <p>{qty(lot.qtyRemainingBase)} {lot.baseUom} expires in {lot.daysToExpiry} day(s).</p>
              </article>
            ))}
            {snapshot.expiringStock.length === 0 && <div className="ops-empty">No FIFO lots expiring in the next 7 days.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function severityClass(value?: string | null) {
  const key = (value || "").toLowerCase();
  if (key.includes("critical")) return "danger";
  if (key.includes("warning")) return "warn";
  if (key.includes("good")) return "good";
  return "info";
}

function statusClass(value?: string | null) {
  const key = (value || "").toLowerCase();
  if (key.includes("ready")) return "good";
  if (key.includes("briefed")) return "info";
  if (key.includes("closed")) return "info";
  return "warn";
}

function addDaysIso(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function qty(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value || 0);
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return <label className="ops-field"><span>{translateOpsText(label)}</span><input className="ops-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="ops-field"><span>{translateOpsText(label)}</span><textarea value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function ReasonSelect({ label, value, reasons, onChange }: { label: string; value: string; reasons: WorkflowReasonCodeDto[]; onChange: (value: string) => void }) {
  return (
    <label className="ops-field">
      <span>{translateOpsText(label)}</span>
      <select className="ops-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{translateOpsText("Select reason code")}</option>
        {reasons.map((reason) => (
          <option key={reason.id} value={reason.id}>
            {reason.code} - {reason.description}
          </option>
        ))}
      </select>
    </label>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="ops-kpi"><span>{translateOpsText(label)}</span><b>{value}</b></div>;
}

function money(v: number) {
  return formatCurrency(v);
}

function cashVariance(summary: SalesSummaryDto | null, drops: SafeDropDto[]) {
  const cash = (summary?.payments ?? [])
    .filter((x) => x.method?.toUpperCase() === "CASH")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const dropped = drops.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  return Number((cash - dropped).toFixed(2));
}

function OpsModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="ops-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="ops-modal" role="dialog" aria-modal="true" aria-label={translateOpsText(title)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="ops-card-head"><div><span>{translateOpsText("Action")}</span><h2>{translateOpsText(title)}</h2></div><button type="button" onClick={onClose}>{translateOpsText("Close")}</button></div>
        {children}
      </section>
    </div>
  );
}
