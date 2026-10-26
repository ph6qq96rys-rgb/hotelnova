import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  History,
  Lock,
  Megaphone,
  RefreshCw,
  Signal,
  Wallet,
} from "lucide-react";
import { useAppScope } from "../../../app/useAppScope";
import { useAuth } from "../../../auth/AuthProvider";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { StateMessage } from "../../../components/ui/Feedback";
import { useDialogFocus } from "../../../components/ui/useDialogFocus";
import { operationsApi } from "../api/operationsApi";
import type {
  BackOfficeEfficiencySnapshotDto,
  CashierShiftDto,
  DailyOperationChecklistItemDto,
  DailyOperationPlanDto,
  DailyOperationPlanSummaryDto,
  EndOfDayReportDto,
  OperationsPosStoreDto,
  SafeDropDto,
  SalesSummaryDto,
  WorkflowReasonCodeDto,
} from "../api/operationsTypes";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { formatAppDateTime, formatAppTime, todayLocalIsoDate } from "../../../shared/datetime/dateFormat";
import { useI18n } from "../../../i18n";
import "../styles/operations.css";

/*
 * Daily Operation Plan
 *
 * One business date and shift at a time, worked through five steps:
 *   1 Plan  →  2 Brief  →  3 Ready  →  4 Trade (cashier shifts)  →  5 Close (end-of-day)
 * The header always shows where the plan stands and offers the single next action.
 * Everything else lives in tabs so a manager never scrolls past unrelated panels.
 */

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

type Tab = "plan" | "briefing" | "readiness" | "cash" | "signals" | "history";
type ModalState = "openShift" | "closeShift" | "safeDrop" | "readyException" | "eodVariance" | "discard" | null;
type StepState = "done" | "current" | "todo" | "blocked";
type Notice = { tone: "success" | "error" | "warning" | "info"; text: string; reload?: boolean };

const SHIFTS = ["Breakfast", "Lunch", "Day", "Dinner", "Night"];
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

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

let t = (text: string) => text;

export default function OperationsDashboardPage() {
  const { tx } = useI18n();
  t = tx;
  const { companyId, branchId, branchName } = useAppScope();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("operations.manage");
  const canSell = hasPermission("pos.sell");
  const canCloseShift = hasPermission("pos.close");

  // What is open
  const [businessDate, setBusinessDate] = useState(() => todayLocalIsoDate());
  const [shiftName, setShiftName] = useState("Day");
  const [tab, setTab] = useState<Tab>("plan");

  // Loaded data
  const [plan, setPlan] = useState<DailyOperationPlanDto | null>(null);
  const [shift, setShift] = useState<CashierShiftDto | null>(null);
  const [branchOpenShifts, setBranchOpenShifts] = useState<CashierShiftDto[]>([]);
  const [drops, setDrops] = useState<SafeDropDto[]>([]);
  const [summary, setSummary] = useState<SalesSummaryDto | null>(null);
  const [backOffice, setBackOffice] = useState<BackOfficeEfficiencySnapshotDto | null>(null);
  const [eod, setEod] = useState<EndOfDayReportDto | null>(null);
  const [stores, setStores] = useState<OperationsPosStoreDto[]>([]);
  const [readinessReasons, setReadinessReasons] = useState<WorkflowReasonCodeDto[]>([]);
  const [varianceReasons, setVarianceReasons] = useState<WorkflowReasonCodeDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);

  // Register (history)
  const [registerDateTo, setRegisterDateTo] = useState(() => todayLocalIsoDate());
  const [registerDateFrom, setRegisterDateFrom] = useState(() => addDaysIso(todayLocalIsoDate(), -30));
  const [registerStatus, setRegisterStatus] = useState("");
  const [planRegister, setPlanRegister] = useState<DailyOperationPlanSummaryDto[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);

  // Editing
  const [form, setForm] = useState<PlanForm>(emptyPlan);
  const [savedForm, setSavedForm] = useState<PlanForm>(emptyPlan);
  const [briefingNotes, setBriefingNotes] = useState("");
  const [checklistFilter, setChecklistFilter] = useState<"all" | "open" | "critical">("all");
  const [busy, setBusy] = useState(false);
  const [checklistSaving, setChecklistSaving] = useState(false);
  const checklistSaveInFlight = useRef(false);
  const loadVersion = useRef(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [pendingOpen, setPendingOpen] = useState<{ date: string; shift: string } | null>(null);
  const [shiftForm, setShiftForm] = useState({ storeId: "", cashierName: "", terminal: "POS-1", openingFloat: "0" });
  const [closeShiftForm, setCloseShiftForm] = useState({ closingCash: "0", notes: "" });
  const [safeDropForm, setSafeDropForm] = useState({ amount: "0", referenceNo: "", notes: "" });
  const [exceptionForm, setExceptionForm] = useState({ reason: "", reasonCodeId: "" });
  const [eodVarianceForm, setEodVarianceForm] = useState({ reasonCodeId: "", comment: "" });

  useDialogFocus(modal !== null, busy, () => setModal(null));

  const savedPlan = isSavedPlan(plan);
  const locked = Boolean(plan?.isLocked || plan?.status === "Closed" || eod);
  const readOnly = locked || !canManage;
  const dirty = !readOnly && JSON.stringify(form) !== JSON.stringify(savedForm);
  const planReady = plan?.status === "Ready" || plan?.status === "ReadyWithException";
  const variance = cashVariance(summary, drops);
  const shiftOptions = useMemo(() => {
    const names = new Set(SHIFTS);
    planRegister.forEach((row) => row.shiftName && names.add(row.shiftName));
    names.add(shiftName);
    return [...names];
  }, [planRegister, shiftName]);

  const refresh = useCallback(async () => {
    if (!companyId || !branchId) return;
    const version = ++loadVersion.current;
    setLoading(true);
    const windowFrom = new Date(`${addDaysIso(businessDate, -2)}T00:00:00Z`).toISOString();
    const windowTo = new Date(`${addDaysIso(businessDate, 2)}T00:00:00Z`).toISOString();

    const [open, sum, daily, snapshot, posStores, readyReasonRows, varianceReasonRows, dateDrops, report, shifts] =
      await Promise.allSettled([
        operationsApi.currentOpenShift(companyId, branchId),
        operationsApi.salesSummaryForBusinessDate(companyId, branchId, businessDate),
        operationsApi.dailyPlan(companyId, branchId, businessDate, shiftName).then((result) => {
          if (version === loadVersion.current) applyPlan(result.data);
          return result;
        }),
        operationsApi.backOfficeEfficiency(companyId, branchId, businessDate),
        operationsApi.stores(companyId, branchId),
        operationsApi.workflowReasons(companyId, "DailyOperation", "ReadinessException", "Ready"),
        operationsApi.workflowReasons(companyId, "DailyOperation", "EndOfDayVariance", "Close"),
        operationsApi.safeDropsForBusinessDate(companyId, branchId, businessDate),
        operationsApi.endOfDay(companyId, branchId, businessDate),
        operationsApi.shifts(companyId, branchId, windowFrom, windowTo),
      ]);

    if (version !== loadVersion.current) return;
    const warnings: string[] = [];
    // Each signal loads on its own; one failing does not hide the others.
    const take = <T,>(result: PromiseSettledResult<T>, label: string): T | undefined => {
      if (result.status === "fulfilled") return result.value;
      warnings.push(`${t(label)}: ${errorText(result.reason)}`);
      return undefined;
    };

    setShift(take(open, "Your cashier shift could not be loaded")?.data ?? null);
    setSummary(take(sum, "Sales summary could not be loaded")?.data ?? null);
    setBackOffice(take(snapshot, "Back-office signals could not be loaded")?.data ?? null);
    setStores(take(posStores, "POS stores could not be loaded")?.data ?? []);
    setReadinessReasons(take(readyReasonRows, "Readiness exception reasons could not be loaded")?.data ?? []);
    setVarianceReasons(take(varianceReasonRows, "End-of-day variance reasons could not be loaded")?.data ?? []);
    setDrops(take(dateDrops, "Safe drops could not be loaded")?.data ?? []);
    setEod(take(report, "End-of-day status could not be loaded") ?? null);
    setBranchOpenShifts((take(shifts, "Branch cashier shifts could not be loaded")?.data ?? []).filter((x) => !x.closedAtUtc));

    if (daily.status === "rejected") {
      setPlan(null);
      warnings.push(`${t("Daily operation plan could not be loaded")}: ${errorText(daily.reason)}`);
    }

    setLoadWarnings(warnings);
    setLoading(false);
  }, [companyId, branchId, businessDate, shiftName]);

  const loadPlanRegister = useCallback(async () => {
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
      setNotice({ tone: "error", text: `${t("Daily operation plans could not be loaded")}: ${errorText(e)}` });
      setPlanRegister([]);
    } finally {
      setRegisterLoading(false);
    }
  }, [companyId, branchId, registerDateFrom, registerDateTo, registerStatus]);

  useEffect(() => {
    setPlan(null);
    void refresh();
    return () => { loadVersion.current += 1; };
  }, [refresh]);
  useEffect(() => { if (tab === "history") void loadPlanRegister(); }, [loadPlanRegister, tab]);

  // Warn before leaving the page with unsaved plan changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function applyPlan(next: DailyOperationPlanDto) {
    setPlan(next);
    const nextForm = planToForm(next);
    setForm(nextForm);
    setSavedForm(nextForm);
    setBriefingNotes(next.briefingNotes || "");
  }

  async function run(action: () => Promise<void>, success?: string) {
    if (checklistSaveInFlight.current) return;
    setBusy(true);
    setNotice(null);
    try {
      await action();
      if (success) setNotice({ tone: "success", text: t(success) });
    } catch (e) {
      const text = errorText(e);
      setNotice({ tone: "error", text, reload: /someone else saved|changed|reload/i.test(text) });
    } finally {
      setBusy(false);
    }
  }

  /** Switch date or shift, asking first when the plan has unsaved changes. */
  function openPlan(date: string, nextShift: string) {
    if (date === businessDate && nextShift === shiftName) return;
    if (dirty) {
      setPendingOpen({ date, shift: nextShift });
      setModal("discard");
      return;
    }
    setBusinessDate(date);
    setShiftName(nextShift);
    setNotice(null);
  }

  async function savePlan() {
    const wasReady = planReady;
    await run(async () => {
      const saved = await operationsApi.saveDailyPlan(companyId, branchId, {
        businessDate,
        shiftName,
        ...form,
        expectedUpdatedAtUtc: savedPlan ? plan?.updatedAtUtc ?? null : null,
      });
      applyPlan(saved.data);
      const resetReadiness = wasReady && saved.data.status !== "Ready" && saved.data.status !== "ReadyWithException";
      setNotice(resetReadiness
        ? { tone: "warning", text: t("Plan saved. Because it changed, readiness must be approved again.") }
        : { tone: "success", text: t("Plan saved.") });
      await loadPlanRegister();
    });
  }

  async function recordBriefing() {
    if (!isSavedPlan(plan)) return;
    await run(async () => {
      const saved = await operationsApi.recordBriefing(companyId, branchId, plan.id, briefingNotes);
      applyPlan(saved.data);
      await loadPlanRegister();
    }, "Pre-shift briefing recorded.");
  }

  async function toggleChecklist(item: DailyOperationChecklistItemDto, isCompleted: boolean) {
    if (!isSavedPlan(plan) || readOnly || busy || checklistSaveInFlight.current) return;
    const previous = plan;
    const version = loadVersion.current;
    checklistSaveInFlight.current = true;
    setChecklistSaving(true);
    setNotice(null);
    const items = plan.checklistItems.map((x) => x.id === item.id ? { ...x, isCompleted } : x);
    setPlan({ ...plan, checklistItems: items, criticalOpenCount: items.filter(x => x.isCritical && !x.isCompleted).length });
    try {
      const saved = await operationsApi.updateChecklist(companyId, branchId, plan.id, [{ id: item.id, isCompleted, notes: null }]);
      if (version !== loadVersion.current) return;
      setPlan(saved.data);
      // Keep the cached history row current without refetching the entire register.
      setPlanRegister(rows => rows.map(row => row.id === saved.data.id ? {
        ...row, status: saved.data.status, updatedAtUtc: saved.data.updatedAtUtc,
        criticalOpenCount: saved.data.criticalOpenCount,
        completedChecklistCount: saved.data.checklistItems.filter(x => x.isCompleted).length,
      } : row));
      if (previous.status === "Ready" && saved.data.status !== "Ready")
        setNotice({ tone: "warning", text: t("A critical item was reopened, so readiness was withdrawn. Approve readiness again when it is resolved.") });
    } catch (e) {
      if (version !== loadVersion.current) return;
      setPlan(previous);
      const text = errorText(e);
      setNotice({ tone: "error", text, reload: /someone else saved|changed|reload/i.test(text) });
    } finally {
      checklistSaveInFlight.current = false;
      setChecklistSaving(false);
    }
  }

  async function markReady() {
    if (!isSavedPlan(plan)) return;
    if (plan.criticalOpenCount > 0) {
      setExceptionForm({ reason: plan.readinessExceptionReason || "", reasonCodeId: "" });
      setModal("readyException");
      return;
    }
    await run(async () => {
      applyPlan((await operationsApi.markReady(companyId, branchId, plan.id)).data);
      await loadPlanRegister();
    }, "Branch marked operationally ready.");
  }

  async function submitReadyException() {
    if (!isSavedPlan(plan) || !exceptionForm.reason.trim() || !exceptionForm.reasonCodeId) return;
    await run(async () => {
      applyPlan((await operationsApi.markReady(companyId, branchId, plan.id, exceptionForm.reason.trim(), exceptionForm.reasonCodeId)).data);
      setModal(null);
      await loadPlanRegister();
    }, "Marked ready with a manager exception.");
  }

  async function openShift() {
    if (!shiftForm.storeId) return;
    await run(async () => {
      await operationsApi.openShift(companyId, branchId, {
        storeId: shiftForm.storeId,
        cashierName: shiftForm.cashierName.trim(),
        terminal: shiftForm.terminal.trim() || "POS-1",
        openingFloat: Number(shiftForm.openingFloat || 0),
      });
      setModal(null);
      await refresh();
    }, "Cashier shift opened.");
  }

  async function closeShift() {
    if (!shift) return;
    await run(async () => {
      await operationsApi.closeShift(companyId, branchId, shift.id, {
        closingCash: Number(closeShiftForm.closingCash || 0),
        notes: closeShiftForm.notes,
      });
      setModal(null);
      await refresh();
    }, "Cashier shift closed.");
  }

  async function safeDrop() {
    if (!shift) return;
    const amount = Number(safeDropForm.amount || 0);
    if (amount <= 0) return;
    await run(async () => {
      await operationsApi.createSafeDrop(companyId, branchId, {
        cashierShiftId: shift.id,
        amount,
        method: "CASH",
        referenceNo: safeDropForm.referenceNo,
        notes: safeDropForm.notes,
      });
      setSafeDropForm({ amount: "0", referenceNo: "", notes: "" });
      setModal(null);
      await refresh();
    }, "Safe drop recorded.");
  }

  async function generateEod() {
    if (variance !== 0 && (!eodVarianceForm.reasonCodeId || !eodVarianceForm.comment.trim())) {
      setModal("eodVariance");
      return;
    }
    await run(async () => {
      const report = await operationsApi.generateEndOfDay(companyId, branchId, {
        businessDate,
        varianceReasonCodeId: variance !== 0 ? eodVarianceForm.reasonCodeId : null,
        varianceComment: variance !== 0 ? eodVarianceForm.comment.trim() : null,
      });
      setEod(report.data);
      setModal(null);
      await refresh();
      await loadPlanRegister();
    }, "End-of-day generated. The business date is now closed.");
  }

  // Derived state for the header
  const checklist = plan?.checklistItems ?? [];
  const completed = checklist.filter((x) => x.isCompleted).length;
  const readinessPercent = checklist.length ? Math.round((completed / checklist.length) * 100) : 0;
  const eodBlockers = endOfDayBlockers(plan, branchOpenShifts);
  const steps = buildSteps(plan, shift, branchOpenShifts, eod);
  const next = nextAction(plan, shift, eod, stores.length, branchOpenShifts.length, summary?.salesCount ?? 0, dirty);

  function runNextAction() {
    switch (next.action) {
      case "save": setTab("plan"); void savePlan(); break;
      case "brief": setTab("briefing"); break;
      case "ready": setTab("readiness"); break;
      case "openShift": setTab("cash"); setModal("openShift"); break;
      case "close": setTab("cash"); break;
      case "eod": setTab("cash"); void generateEod(); break;
      default: break;
    }
  }

  const salesProgress = plan && plan.expectedSales > 0 ? Math.min(100, Math.round(((summary?.netSales ?? 0) / plan.expectedSales) * 100)) : null;
  const signalCount = backOffice
    ? backOffice.outOfStockItems + backOffice.lowStockItems + backOffice.expiringLots + backOffice.equipmentIssues
    : 0;

  return (
    <main className="ops-page">
      <header className="ops-head">
        <div className="ops-head-title">
          <span className="ops-eyebrow">{t("Daily operations")}</span>
          <h1>{t("Daily Operation Plan")}</h1>
          <p>
            {branchName || t("Selected branch")} · {weekdayLabel(businessDate)} · {t(shiftName)}
          </p>
        </div>
        <div className="ops-head-tools" aria-label={t("Plan selection")}>
          <div className="ops-date">
            <Button variant="outline" size="icon" aria-label={t("Previous day")} disabled={busy} onClick={() => openPlan(addDaysIso(businessDate, -1), shiftName)}>
              <ChevronLeft size={16} />
            </Button>
            <Input
              type="date"
              aria-label={t("Business date")}
              value={businessDate}
              onChange={(e) => e.target.value && openPlan(e.target.value, shiftName)}
            />
            <Button variant="outline" size="icon" aria-label={t("Next day")} disabled={busy} onClick={() => openPlan(addDaysIso(businessDate, 1), shiftName)}>
              <ChevronRight size={16} />
            </Button>
            {businessDate !== todayLocalIsoDate() && (
              <Button variant="outline" disabled={busy} onClick={() => openPlan(todayLocalIsoDate(), shiftName)}>
                <CalendarDays size={16} /> {t("Today")}
              </Button>
            )}
          </div>
          <Select aria-label={t("Shift")} value={shiftName} onChange={(e) => openPlan(businessDate, e.target.value)}>
            {shiftOptions.map((name) => <option key={name} value={name}>{t(name)}</option>)}
          </Select>
          <Button variant="outline" disabled={busy || checklistSaving || loading} onClick={() => void refresh()} aria-label={t("Refresh")}>
            <RefreshCw size={16} className={loading ? "ops-spin" : undefined} /> {t("Refresh")}
          </Button>
        </div>
      </header>

      {/* Where the plan stands, and the one thing to do next */}
      <section className="ops-status" aria-label={t("Plan progress")}>
        <ol className="ops-steps">
          {steps.map((step, index) => (
            <li key={step.label} className={`ops-step ops-step--${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
              <span className="ops-step-dot">{step.state === "done" ? <CheckCircle2 size={16} /> : index + 1}</span>
              <span className="ops-step-text">
                <b>{step.label}</b>
                <small>{step.detail}</small>
              </span>
            </li>
          ))}
        </ol>
        <div className="ops-next">
          <span className="ops-eyebrow">{t("Next step")}</span>
          <b>{next.title}</b>
          <small>{next.detail}</small>
          {next.action !== "none" && (
            <Button
              disabled={
                busy ||
                ((next.action === "save" || next.action === "eod") && !canManage) ||
                (next.action === "openShift" && !canSell) ||
                (next.action === "eod" && eodBlockers.length > 0)
              }
              onClick={runNextAction}
            >
              {next.button}
            </Button>
          )}
        </div>
      </section>

      {notice && (
        <StateMessage
          tone={notice.tone}
          action={
            <span className="ops-notice-actions">
              {notice.reload && <Button size="sm" variant="outline" onClick={() => void refresh()}>{t("Reload plan")}</Button>}
              <Button size="sm" variant="ghost" aria-label={t("Dismiss")} onClick={() => setNotice(null)}>×</Button>
            </span>
          }
        >
          {notice.text}
        </StateMessage>
      )}
      {locked && (
        <StateMessage tone="info">
          <Lock size={14} /> {eod
            ? `${t("End-of-day was generated by")} ${eod.generatedByName || t("operations")} ${t("at")} ${formatAppDateTime(eod.generatedAtUtc)}. ${t("This business date is closed and read-only.")}`
            : t("This plan is closed and read-only.")}
        </StateMessage>
      )}
      {!locked && !canManage && (
        <StateMessage tone="info">{t("You can view this plan. Changing it needs the operations.manage permission.")}</StateMessage>
      )}
      {loadWarnings.length > 0 && (
        <details className="ops-warnings">
          <summary><AlertTriangle size={14} /> {loadWarnings.length} {t("operational signals could not be loaded")}</summary>
          <ul>{loadWarnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </details>
      )}

      <section className="ops-kpis" aria-label={t("Key figures")}>
        <Kpi label="Expected covers" value={String(plan?.expectedCovers ?? 0)} />
        <Kpi
          label="Net sales vs target"
          value={money(summary?.netSales ?? 0)}
          hint={plan?.expectedSales ? `${t("Target")} ${money(plan.expectedSales)}` : t("No sales target set")}
          progress={salesProgress}
        />
        <Kpi label="Staff required" value={String(plan?.requiredEmployees ?? 0)} />
        <Kpi
          label="Readiness"
          value={`${readinessPercent}%`}
          hint={`${plan?.criticalOpenCount ?? 0} ${t("critical open")}`}
          progress={readinessPercent}
          tone={plan && plan.criticalOpenCount > 0 ? "warn" : "good"}
        />
        <Kpi
          label="Cash variance"
          value={money(variance)}
          hint={t("Cash payments less safe drops")}
          tone={variance === 0 ? "good" : "warn"}
        />
      </section>

      <nav className="ops-tabs" role="tablist" aria-label={t("Plan sections")}>
        <TabButton id="plan" tab={tab} setTab={setTab} icon={<ClipboardCheck size={16} />} label="Plan" badge={dirty ? "•" : undefined} />
        <TabButton id="briefing" tab={tab} setTab={setTab} icon={<Megaphone size={16} />} label="Briefing" badge={plan?.briefedAtUtc ? "✓" : undefined} />
        <TabButton id="readiness" tab={tab} setTab={setTab} icon={<CheckCircle2 size={16} />} label="Readiness" badge={plan && plan.criticalOpenCount > 0 ? String(plan.criticalOpenCount) : undefined} />
        <TabButton id="cash" tab={tab} setTab={setTab} icon={<Wallet size={16} />} label="Cash & close" badge={branchOpenShifts.length ? String(branchOpenShifts.length) : undefined} />
        <TabButton id="signals" tab={tab} setTab={setTab} icon={<Signal size={16} />} label="Signals" badge={signalCount ? String(signalCount) : undefined} />
        <TabButton id="history" tab={tab} setTab={setTab} icon={<History size={16} />} label="History" />
      </nav>

      {loading && !plan ? (
        <StateMessage tone="loading">{t("Loading the plan…")}</StateMessage>
      ) : (
        <section className="ops-panel" role="tabpanel" aria-label={t(tabLabel(tab))}>
          {tab === "plan" && (
            <form
              onSubmit={(e) => { e.preventDefault(); if (dirty || !savedPlan) void savePlan(); }}
              className="ops-plan-form"
            >
              <div className="ops-panel-head">
                <div>
                  <h2>{t("Demand, staffing and risks")}</h2>
                  <p>{t("What the branch expects for this shift. The briefing and readiness checks build on it.")}</p>
                </div>
                <div className="ops-panel-actions">
                  {dirty && <span className="ops-chip ops-chip--warn">{t("Unsaved changes")}</span>}
                  {dirty && <Button type="button" variant="outline" disabled={busy} onClick={() => setForm(savedForm)}>{t("Discard changes")}</Button>}
                  <Button type="submit" disabled={busy || readOnly || (savedPlan && !dirty)}>
                    {busy ? t("Saving…") : savedPlan ? t("Save plan") : t("Create plan")}
                  </Button>
                </div>
              </div>
              {!savedPlan && !readOnly && (
                <StateMessage tone="info">{t("This plan has not been created yet. Fill in what you expect and create it; the briefing and checklist open after that.")}</StateMessage>
              )}
              {planReady && dirty && (
                <StateMessage tone="warning">{t("Readiness is approved. Saving these changes withdraws the approval until it is given again.")}</StateMessage>
              )}
              <fieldset disabled={readOnly || busy} className="ops-fieldset">
                <legend>{t("Demand and staffing")}</legend>
                <div className="ops-form-grid">
                  <NumberField label="Expected covers" value={form.expectedCovers} onChange={(v) => setForm({ ...form, expectedCovers: v })} step={1} />
                  <NumberField label="Sales target" value={form.expectedSales} onChange={(v) => setForm({ ...form, expectedSales: v })} step={0.01} />
                  <NumberField label="Required employees" value={form.requiredEmployees} onChange={(v) => setForm({ ...form, requiredEmployees: v })} step={1} />
                </div>
                <div className="ops-form-grid ops-form-grid--two">
                  <TextField label="Employees by position" placeholder="e.g. 4 waiters, 2 cooks, 1 cashier" value={form.requiredEmployeesByPosition} onChange={(v) => setForm({ ...form, requiredEmployeesByPosition: v })} />
                  <TextField label="Sales focus" placeholder="Dishes to promote, upsell targets" value={form.salesTargets} onChange={(v) => setForm({ ...form, salesTargets: v })} />
                </div>
              </fieldset>
              <fieldset disabled={readOnly || busy} className="ops-fieldset">
                <legend>{t("Food, stock and equipment")}</legend>
                <div className="ops-form-grid ops-form-grid--two">
                  <TextField label="Food production plan" value={form.requiredFoodProduction} onChange={(v) => setForm({ ...form, requiredFoodProduction: v })} />
                  <TextField label="Inventory risks" value={form.criticalInventoryLevels} onChange={(v) => setForm({ ...form, criticalInventoryLevels: v })} />
                  <TextField label="Outstanding purchase orders" value={form.outstandingPurchaseOrders} onChange={(v) => setForm({ ...form, outstandingPurchaseOrders: v })} />
                  <TextField label="Equipment availability" value={form.equipmentAvailability} onChange={(v) => setForm({ ...form, equipmentAvailability: v })} />
                  <TextField label="Open operational issues" value={form.openOperationalIssues} onChange={(v) => setForm({ ...form, openOperationalIssues: v })} />
                  <TextField label="Planning notes" placeholder="Reservations, catering, promotions, leave, maintenance" value={form.planningInputs} onChange={(v) => setForm({ ...form, planningInputs: v })} />
                </div>
              </fieldset>
              {savedPlan && plan?.updatedAtUtc && (
                <p className="ops-meta">{t("Last saved")} {formatAppDateTime(plan.updatedAtUtc)}</p>
              )}
            </form>
          )}

          {tab === "briefing" && (
            <div>
              <div className="ops-panel-head">
                <div>
                  <h2>{t("Pre-shift briefing")}</h2>
                  <p>{t("What the team needs to hear before service. Recording it is required before readiness can be approved.")}</p>
                </div>
                <div className="ops-panel-actions">
                  {!readOnly && plan && (
                    <Button variant="outline" disabled={busy || !savedPlan} onClick={() => setBriefingNotes(defaultBriefing(plan, briefingNotes))}>
                      {t("Insert template")}
                    </Button>
                  )}
                  <Button disabled={busy || readOnly || !savedPlan || !briefingNotes.trim()} onClick={() => void recordBriefing()}>
                    {plan?.briefedAtUtc ? t("Update briefing") : t("Record briefing")}
                  </Button>
                </div>
              </div>
              {!savedPlan && <StateMessage tone="info">{t("Create the plan first.")}</StateMessage>}
              {plan?.briefedAtUtc && (
                <p className="ops-meta">
                  {t("Recorded by")} {plan.briefedByName || t("a manager")} {t("at")} {formatAppDateTime(plan.briefedAtUtc)}
                </p>
              )}
              <Textarea
                className="ops-briefing"
                aria-label={t("Briefing notes")}
                disabled={readOnly || !savedPlan || busy}
                value={briefingNotes}
                placeholder={t("Guest count, featured and unavailable dishes, large reservations, assignments, food-safety reminders, equipment issues…")}
                onChange={(e) => setBriefingNotes(e.target.value)}
              />
              <h3 className="ops-subhead">{t("Acknowledged by")} ({plan?.acknowledgements.length ?? 0})</h3>
              {plan?.acknowledgements.length ? (
                <ul className="ops-list">
                  {plan.acknowledgements.map((a) => (
                    <li key={a.id}><b>{a.employeeName}</b><small>{a.channel} · {formatAppDateTime(a.acknowledgedAtUtc)}</small></li>
                  ))}
                </ul>
              ) : (
                <p className="ops-empty">{t("No employee has acknowledged the briefing yet. Staff acknowledge it from their own account or Telegram.")}</p>
              )}
            </div>
          )}

          {tab === "readiness" && (
            <div>
              <div className="ops-panel-head">
                <div>
                  <h2>{t("Operational readiness")}</h2>
                  <p>{completed}/{checklist.length} {t("checks done")} · {plan?.criticalOpenCount ?? 0} {t("critical open")}</p>
                </div>
                <div className="ops-panel-actions">
                  <Select aria-label={t("Show checks")} value={checklistFilter} onChange={(e) => setChecklistFilter(e.target.value as typeof checklistFilter)}>
                    <option value="all">{t("All checks")}</option>
                    <option value="open">{t("Open checks")}</option>
                    <option value="critical">{t("Critical open")}</option>
                  </Select>
                  <Button disabled={busy || checklistSaving || readOnly || !savedPlan || !plan?.briefedAtUtc || plan?.status === "Ready"} onClick={() => void markReady()}>
                    {plan && plan.criticalOpenCount > 0 ? t("Approve with exception…") : t("Mark ready")}
                  </Button>
                </div>
              </div>
              <Progress value={readinessPercent} label={t("Readiness")} />
              {!savedPlan && <StateMessage tone="info">{t("Create the plan first.")}</StateMessage>}
              {savedPlan && !plan?.briefedAtUtc && (
                <StateMessage tone="info">{t("Record the pre-shift briefing before approving readiness. You can tick checks now.")}</StateMessage>
              )}
              {planReady && (
                <StateMessage tone={plan?.status === "ReadyWithException" ? "warning" : "success"}>
                  {plan?.status === "ReadyWithException"
                    ? `${t("Ready with a manager exception")}: ${plan?.readinessExceptionReason}`
                    : t("Readiness approved")}
                  {plan?.readyByName ? ` · ${plan.readyByName}` : ""}
                  {plan?.readyAtUtc ? ` · ${formatAppDateTime(plan.readyAtUtc)}` : ""}
                </StateMessage>
              )}
              <div className="ops-areas">
                {groupByArea(checklist, checklistFilter).map(([area, items, done, total]) => (
                  <section key={area} className="ops-area">
                    <header>
                      <h3>{t(area)}</h3>
                      <span className="ops-chip">{done}/{total}</span>
                    </header>
                    {items.length === 0 ? (
                      <p className="ops-empty">{t("Nothing open in this area.")}</p>
                    ) : items.map((item) => (
                      <label key={item.id} className={`ops-check${item.isCritical ? " ops-check--critical" : ""}${item.isCompleted ? " ops-check--done" : ""}`}>
                        <Checkbox
                          disabled={readOnly || !savedPlan || busy || checklistSaving}
                          checked={item.isCompleted}
                          onChange={(e) => void toggleChecklist(item, e.target.checked)}
                        />
                        <span>
                          {t(item.item)}
                          {item.isCompleted && item.completedAtUtc && <small>{t("Done")} {formatAppTime(item.completedAtUtc)}</small>}
                        </span>
                        {item.isCritical && <em>{t("Critical")}</em>}
                      </label>
                    ))}
                  </section>
                ))}
              </div>
            </div>
          )}

          {tab === "cash" && (
            <div className="ops-cash">
              <section className="ops-box">
                <header className="ops-box-head">
                  <h2>{t("Your cashier shift")}</h2>
                  <span className={`ops-chip ${shift ? "ops-chip--good" : ""}`}>{shift ? t("Open") : t("Not open")}</span>
                </header>
                {shift ? (
                  <dl className="ops-dl">
                    <div><dt>{t("Cashier")}</dt><dd>{shift.cashierName}</dd></div>
                    <div><dt>{t("Terminal")}</dt><dd>{shift.terminal}</dd></div>
                    <div><dt>{t("Opened")}</dt><dd>{formatAppDateTime(shift.openedAtUtc)}</dd></div>
                    <div><dt>{t("Opening float")}</dt><dd>{money(shift.openingFloat)}</dd></div>
                  </dl>
                ) : (
                  <p className="ops-empty">
                    {!planReady
                      ? t("Cashier shifts open after readiness is approved.")
                      : stores.length === 0
                        ? t("Set up an active POS store with an issue stock location first.")
                        : locked ? t("This business date is closed.") : t("Readiness is approved. You can open your shift.")}
                  </p>
                )}
                <div className="ops-box-actions">
                  {!shift && (
                    <Button disabled={busy || locked || !planReady || stores.length === 0 || !canSell} onClick={() => setModal("openShift")}>{t("Open shift")}</Button>
                  )}
                  {shift && <Button variant="outline" disabled={busy || !canManage} onClick={() => setModal("safeDrop")}>{t("Record safe drop")}</Button>}
                  {shift && <Button variant="outline" disabled={busy || !canCloseShift} onClick={() => setModal("closeShift")}>{t("Close shift")}</Button>}
                </div>
              </section>

              <section className="ops-box">
                <header className="ops-box-head">
                  <h2>{t("Shifts still open in this branch")}</h2>
                  <span className={`ops-chip ${branchOpenShifts.length ? "ops-chip--warn" : "ops-chip--good"}`}>{branchOpenShifts.length}</span>
                </header>
                {branchOpenShifts.length === 0 ? (
                  <p className="ops-empty">{t("All cashier shifts are closed.")}</p>
                ) : (
                  <ul className="ops-list">
                    {branchOpenShifts.map((s) => (
                      <li key={s.id}><b>{s.cashierName}</b><small>{s.terminal} · {t("opened")} {formatAppDateTime(s.openedAtUtc)}</small></li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="ops-box">
                <header className="ops-box-head">
                  <h2>{t("Sales for the day")}</h2>
                  <span className="ops-chip">{summary?.salesCount ?? 0} {t("sales")}</span>
                </header>
                <dl className="ops-dl">
                  <div><dt>{t("Gross sales")}</dt><dd>{money(summary?.grossSales ?? 0)}</dd></div>
                  <div><dt>{t("Net sales")}</dt><dd>{money(summary?.netSales ?? 0)}</dd></div>
                  <div><dt>{t("Cost of goods")}</dt><dd>{money(summary?.totalCogs ?? 0)}</dd></div>
                  <div><dt>{t("Gross profit")}</dt><dd>{money(summary?.grossProfit ?? 0)}</dd></div>
                </dl>
                {summary && summary.payments.length > 0 && (
                  <>
                    <h3 className="ops-subhead">{t("Payments")}</h3>
                    <ul className="ops-list">
                      {summary.payments.map((p) => <li key={p.method}><b>{p.method}</b><small>{p.count} · {money(p.amount)}</small></li>)}
                    </ul>
                  </>
                )}
              </section>

              <section className="ops-box">
                <header className="ops-box-head">
                  <h2>{t("Safe drops")}</h2>
                  <span className="ops-chip">{money(drops.reduce((s, x) => s + x.amount, 0))}</span>
                </header>
                {drops.length === 0 ? (
                  <p className="ops-empty">{t("No safe drops recorded for this date.")}</p>
                ) : (
                  <ul className="ops-list">
                    {drops.map((d) => <li key={d.id}><b>{money(d.amount)}</b><small>{d.droppedByName} · {formatAppTime(d.droppedAtUtc)}{d.referenceNo ? ` · ${d.referenceNo}` : ""}</small></li>)}
                  </ul>
                )}
              </section>

              <section className="ops-box ops-box--wide">
                <header className="ops-box-head">
                  <h2>{t("End of day")}</h2>
                  <span className={`ops-chip ${eod ? "ops-chip--good" : ""}`}>{eod ? t("Generated") : t("Pending")}</span>
                </header>
                {eod ? (
                  <dl className="ops-dl">
                    <div><dt>{t("Net sales")}</dt><dd>{money(eod.netSales)}</dd></div>
                    <div><dt>{t("Payments")}</dt><dd>{money(eod.totalPayments)}</dd></div>
                    <div><dt>{t("Safe drops")}</dt><dd>{money(eod.totalSafeDrops)}</dd></div>
                    <div><dt>{t("Cash variance")}</dt><dd>{money(eod.cashVariance)}</dd></div>
                    <div><dt>{t("Generated")}</dt><dd>{eod.generatedByName} · {formatAppDateTime(eod.generatedAtUtc)}</dd></div>
                  </dl>
                ) : (
                  <>
                    <ul className="ops-gates">
                      <Gate ok={planReady || plan?.status === "Closed"} text={t("Every shift plan for the date is ready")} />
                      <Gate ok={branchOpenShifts.length === 0} text={t("All cashier shifts are closed")} />
                      <Gate ok={variance === 0} warn text={variance === 0 ? t("Cash payments match safe drops") : `${t("Cash variance of")} ${money(variance)} ${t("needs a reason")}`} />
                    </ul>
                    <p className="ops-meta">{t("Generating end-of-day closes the business date. Plans, briefings and checklists become read-only.")}</p>
                    <Button disabled={busy || !canManage || eodBlockers.length > 0} onClick={() => void generateEod()}>{t("Generate end-of-day")}</Button>
                  </>
                )}
              </section>
            </div>
          )}

          {tab === "signals" && (
            backOffice ? <BackOfficeSnapshotPanel snapshot={backOffice} /> : <p className="ops-empty">{t("Back-office signals are not available.")}</p>
          )}

          {tab === "history" && (
            <div>
              <div className="ops-panel-head">
                <div>
                  <h2>{t("Plan history")}</h2>
                  <p>{t("Plans for this branch. Open one to review or continue it.")}</p>
                </div>
                <Button variant="outline" disabled={registerLoading} onClick={() => void loadPlanRegister()}>
                  <RefreshCw size={16} /> {registerLoading ? t("Loading…") : t("Refresh")}
                </Button>
              </div>
              <div className="ops-filters">
                <label className="ops-field"><span>{t("From")}</span><Input type="date" value={registerDateFrom} onChange={(e) => setRegisterDateFrom(e.target.value)} /></label>
                <label className="ops-field"><span>{t("To")}</span><Input type="date" value={registerDateTo} onChange={(e) => setRegisterDateTo(e.target.value)} /></label>
                <label className="ops-field">
                  <span>{t("Status")}</span>
                  <Select value={registerStatus} onChange={(e) => setRegisterStatus(e.target.value)}>
                    <option value="">{t("All statuses")}</option>
                    {["Draft", "Briefed", "Ready", "ReadyWithException", "Closed"].map((s) => <option key={s} value={s}>{t(statusLabel(s))}</option>)}
                  </Select>
                </label>
              </div>
              {planRegister.length === 0 ? (
                <p className="ops-empty">{registerLoading ? t("Loading plans…") : t("No plans in this date range.")}</p>
              ) : (
                <div className="ops-table-wrap">
                  <table className="ops-table">
                    <thead>
                      <tr>
                        <th>{t("Date")}</th><th>{t("Shift")}</th><th>{t("Status")}</th><th className="num">{t("Covers")}</th>
                        <th className="num">{t("Sales target")}</th><th>{t("Readiness")}</th><th><span className="ops-sr">{t("Open")}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {planRegister.map((row) => {
                        const date = row.businessDate.slice(0, 10);
                        const current = date === businessDate && row.shiftName === shiftName;
                        return (
                          <tr key={row.id} className={current ? "is-current" : undefined}>
                            <td>{weekdayLabel(date)}</td>
                            <td>{t(row.shiftName)}</td>
                            <td><span className={`ops-chip ${statusTone(row.status)}`}>{t(statusLabel(row.status))}</span></td>
                            <td className="num">{row.expectedCovers}</td>
                            <td className="num">{money(row.expectedSales)}</td>
                            <td>{row.completedChecklistCount}/{row.checklistCount}{row.criticalOpenCount > 0 ? ` · ${row.criticalOpenCount} ${t("critical open")}` : ""}</td>
                            <td className="ops-table-action">
                              <Button size="sm" variant={current ? "secondary" : "outline"} disabled={busy || current} onClick={() => { openPlan(date, row.shiftName); setTab("plan"); }}>
                                {current ? t("Open now") : t("Open")}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {modal === "openShift" && (
        <OpsModal title="Open cashier shift" onClose={() => setModal(null)}
          actions={<><Button variant="outline" onClick={() => setModal(null)}>{t("Cancel")}</Button><Button disabled={busy || !shiftForm.storeId} onClick={() => void openShift()}>{t("Open shift")}</Button></>}>
          <label className="ops-field">
            <span>{t("POS store")}</span>
            <Select value={shiftForm.storeId} onChange={(e) => setShiftForm({ ...shiftForm, storeId: e.target.value })}>
              <option value="">{t("Select POS store")}</option>
              {stores.map((store) => <option key={store.id} value={store.id}>{store.code ? `${store.code} - ` : ""}{store.name}</option>)}
            </Select>
          </label>
          <TextInput label="Terminal" value={shiftForm.terminal} onChange={(v) => setShiftForm({ ...shiftForm, terminal: v })} />
          <TextInput label="Opening float" type="number" value={shiftForm.openingFloat} onChange={(v) => setShiftForm({ ...shiftForm, openingFloat: v })} />
          <TextInput label="Cashier name (only if your account has no employee name)" value={shiftForm.cashierName} onChange={(v) => setShiftForm({ ...shiftForm, cashierName: v })} />
        </OpsModal>
      )}

      {modal === "closeShift" && (
        <OpsModal title="Close cashier shift" onClose={() => setModal(null)}
          actions={<><Button variant="outline" onClick={() => setModal(null)}>{t("Cancel")}</Button><Button disabled={busy} onClick={() => void closeShift()}>{t("Close shift")}</Button></>}>
          <TextInput label="Counted closing cash" type="number" value={closeShiftForm.closingCash} onChange={(v) => setCloseShiftForm({ ...closeShiftForm, closingCash: v })} />
          <TextField label="Closing notes" value={closeShiftForm.notes} onChange={(v) => setCloseShiftForm({ ...closeShiftForm, notes: v })} />
        </OpsModal>
      )}

      {modal === "safeDrop" && (
        <OpsModal title="Record safe drop" onClose={() => setModal(null)}
          actions={<><Button variant="outline" onClick={() => setModal(null)}>{t("Cancel")}</Button><Button disabled={busy || Number(safeDropForm.amount) <= 0} onClick={() => void safeDrop()}>{t("Save drop")}</Button></>}>
          <TextInput label="Amount" type="number" value={safeDropForm.amount} onChange={(v) => setSafeDropForm({ ...safeDropForm, amount: v })} />
          <TextInput label="Reference no." value={safeDropForm.referenceNo} onChange={(v) => setSafeDropForm({ ...safeDropForm, referenceNo: v })} />
          <TextField label="Notes" value={safeDropForm.notes} onChange={(v) => setSafeDropForm({ ...safeDropForm, notes: v })} />
        </OpsModal>
      )}

      {modal === "readyException" && (
        <OpsModal title="Approve readiness with an exception" onClose={() => setModal(null)}
          actions={<><Button variant="outline" onClick={() => setModal(null)}>{t("Cancel")}</Button><Button disabled={busy || !exceptionForm.reason.trim() || !exceptionForm.reasonCodeId} onClick={() => void submitReadyException()}>{t("Approve exception")}</Button></>}>
          <p>{plan?.criticalOpenCount ?? 0} {t("critical checks are still open. Only a manager can approve, and the reason is audited.")}</p>
          <ul className="ops-list ops-list--compact">
            {checklist.filter((x) => x.isCritical && !x.isCompleted).map((x) => <li key={x.id}><b>{t(x.area)}</b><small>{t(x.item)}</small></li>)}
          </ul>
          <ReasonSelect label="Reason code" value={exceptionForm.reasonCodeId} reasons={readinessReasons} onChange={(v) => setExceptionForm({ ...exceptionForm, reasonCodeId: v })} />
          <TextField label="Why the branch can still open" value={exceptionForm.reason} onChange={(v) => setExceptionForm({ ...exceptionForm, reason: v })} />
        </OpsModal>
      )}

      {modal === "eodVariance" && (
        <OpsModal title="Explain the cash variance" onClose={() => setModal(null)}
          actions={<><Button variant="outline" onClick={() => setModal(null)}>{t("Cancel")}</Button><Button disabled={busy || !eodVarianceForm.reasonCodeId || !eodVarianceForm.comment.trim()} onClick={() => void generateEod()}>{t("Generate end-of-day")}</Button></>}>
          <p>{t("Cash payments and safe drops differ by")} <b>{money(variance)}</b>. {t("A reason code and comment are required before closing the day.")}</p>
          <ReasonSelect label="Variance reason" value={eodVarianceForm.reasonCodeId} reasons={varianceReasons} onChange={(v) => setEodVarianceForm({ ...eodVarianceForm, reasonCodeId: v })} />
          <TextField label="Comment" value={eodVarianceForm.comment} onChange={(v) => setEodVarianceForm({ ...eodVarianceForm, comment: v })} />
        </OpsModal>
      )}

      {modal === "discard" && pendingOpen && (
        <OpsModal title="Discard unsaved changes?" onClose={() => { setModal(null); setPendingOpen(null); }}
          actions={
            <>
              <Button variant="outline" onClick={() => { setModal(null); setPendingOpen(null); }}>{t("Keep editing")}</Button>
              <Button variant="destructive" onClick={() => {
                setForm(savedForm);
                setBusinessDate(pendingOpen.date);
                setShiftName(pendingOpen.shift);
                setPendingOpen(null);
                setModal(null);
              }}>{t("Discard and open")}</Button>
            </>
          }>
          <p>{t("The plan for")} {weekdayLabel(businessDate)} · {t(shiftName)} {t("has changes that are not saved.")}</p>
        </OpsModal>
      )}
    </main>
  );
}

/* ───────────────────────── workflow ───────────────────────── */

function isSavedPlan(plan: DailyOperationPlanDto | null): plan is DailyOperationPlanDto {
  return Boolean(plan?.isPersisted && plan.id && plan.id !== EMPTY_GUID);
}

function buildSteps(
  plan: DailyOperationPlanDto | null,
  shift: CashierShiftDto | null,
  openShifts: CashierShiftDto[],
  eod: EndOfDayReportDto | null,
): { label: string; detail: string; state: StepState }[] {
  const saved = isSavedPlan(plan);
  const briefed = Boolean(plan?.briefedAtUtc);
  const ready = plan?.status === "Ready" || plan?.status === "ReadyWithException" || plan?.status === "Closed";
  const closed = Boolean(eod) || plan?.status === "Closed";
  const trading = Boolean(shift) || openShifts.length > 0;
  const stateOf = (done: boolean, available: boolean, isCurrent: boolean): StepState =>
    done ? "done" : isCurrent ? "current" : available ? "todo" : "blocked";

  return [
    { label: t("Plan"), detail: saved ? t("Saved") : t("Not created"), state: stateOf(saved, true, !saved) },
    { label: t("Brief"), detail: briefed ? t("Recorded") : t("Not recorded"), state: stateOf(briefed, saved, saved && !briefed) },
    {
      label: t("Ready"),
      detail: ready ? t(statusLabel(plan?.status === "Closed" ? "Ready" : plan?.status ?? "")) : `${plan?.criticalOpenCount ?? 0} ${t("critical open")}`,
      state: stateOf(ready, briefed, briefed && !ready),
    },
    {
      label: t("Trade"),
      detail: closed ? t("Finished") : trading ? `${openShifts.length || 1} ${t("shift(s) open")}` : t("No shift open"),
      state: stateOf(closed, ready, ready && !closed && trading),
    },
    { label: t("Close"), detail: closed ? t("End-of-day done") : t("Pending"), state: stateOf(closed, ready, ready && !closed && !trading) },
  ];
}

type NextAction = { title: string; detail: string; button: string; action: "save" | "brief" | "ready" | "openShift" | "close" | "eod" | "none" };

function nextAction(
  plan: DailyOperationPlanDto | null,
  shift: CashierShiftDto | null,
  eod: EndOfDayReportDto | null,
  storeCount: number,
  openShiftCount: number,
  salesCount: number,
  dirty: boolean,
): NextAction {
  if (eod || plan?.status === "Closed")
    return { title: t("Day closed"), detail: t("End-of-day has been generated for this business date."), button: "", action: "none" };
  if (!isSavedPlan(plan))
    return { title: t("Create the plan"), detail: t("Enter expected covers, sales target and staffing for this shift."), button: t("Create plan"), action: "save" };
  if (dirty)
    return { title: t("Save your changes"), detail: t("The plan has changes that are not saved yet."), button: t("Save plan"), action: "save" };
  if (!plan.briefedAtUtc)
    return { title: t("Brief the team"), detail: t("Record the pre-shift briefing before readiness can be approved."), button: t("Go to briefing"), action: "brief" };
  if (plan.status !== "Ready" && plan.status !== "ReadyWithException")
    return {
      title: t("Approve readiness"),
      detail: plan.criticalOpenCount > 0
        ? `${plan.criticalOpenCount} ${t("critical checks open. Resolve them or approve a manager exception.")}`
        : t("All critical checks are done. Mark the branch ready."),
      button: t("Go to checklist"),
      action: "ready",
    };
  if (openShiftCount > 0 || shift)
    return {
      title: t("Trade, then close shifts"),
      detail: `${openShiftCount || 1} ${t("cashier shift(s) open. Record safe drops and close every shift before end-of-day.")}`,
      button: t("Go to cash & close"),
      action: "close",
    };
  if (salesCount === 0 && storeCount === 0)
    return { title: t("Set up a POS store"), detail: t("An active store with an issue stock location is needed before cashier shifts can open."), button: "", action: "none" };
  if (salesCount === 0)
    return { title: t("Open a cashier shift"), detail: t("Readiness is approved. Open your shift to start trading."), button: t("Open shift"), action: "openShift" };
  return { title: t("Close the day"), detail: t("All shifts are closed. Generate end-of-day to lock the business date."), button: t("Generate end-of-day"), action: "eod" };
}

/** What still stops end-of-day (mirrors the server checks so the button explains itself). */
function endOfDayBlockers(plan: DailyOperationPlanDto | null, openShifts: CashierShiftDto[]): string[] {
  const blockers: string[] = [];
  if (!isSavedPlan(plan)) blockers.push(t("The plan has not been created."));
  else if (plan.status !== "Ready" && plan.status !== "ReadyWithException") blockers.push(t("Readiness has not been approved."));
  if (openShifts.length > 0) blockers.push(`${openShifts.length} ${t("cashier shift(s) are still open.")}`);
  return blockers;
}

function groupByArea(items: DailyOperationChecklistItemDto[], filter: "all" | "open" | "critical") {
  const areas = new Map<string, DailyOperationChecklistItemDto[]>();
  items.forEach((item) => areas.set(item.area, [...(areas.get(item.area) ?? []), item]));
  return [...areas.entries()].map(([area, all]) => {
    const visible = all
      .filter((x) => filter === "all" || (!x.isCompleted && (filter === "open" || x.isCritical)))
      .sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted) || Number(b.isCritical) - Number(a.isCritical));
    return [area, visible, all.filter((x) => x.isCompleted).length, all.length] as const;
  });
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

function defaultBriefing(plan: DailyOperationPlanDto, current: string) {
  const template = [
    `${t("Expected guest count:")} ${plan.expectedCovers}`,
    `${t("Sales target:")} ${money(plan.expectedSales)}`,
    `${t("Required employees:")} ${plan.requiredEmployees}`,
    `${t("Featured menu items:")} `,
    `${t("Unavailable menu items:")} `,
    `${t("Large reservations / special requests:")} `,
    `${t("Employee assignments:")} ${plan.requiredEmployeesByPosition || ""}`,
    `${t("Food-safety reminders:")} `,
    `${t("Known equipment problems:")} ${plan.equipmentAvailability || ""}`,
    `${t("Previous-shift issues and corrective actions:")} `,
  ].join("\n");
  return current.trim() ? `${current.trim()}\n\n${template}` : template;
}

/* ───────────────────────── panels & controls ───────────────────────── */

function BackOfficeSnapshotPanel({ snapshot }: { snapshot: BackOfficeEfficiencySnapshotDto }) {
  return (
    <div>
      <div className="ops-panel-head">
        <div>
          <h2>{t("Back-office signals")}</h2>
          <p>{t("Stock, requests and equipment that may affect this shift.")} {t("Updated")} {formatAppDateTime(snapshot.generatedAtUtc)}</p>
        </div>
      </div>
      <div className="ops-kpis ops-kpis--six">
        <Kpi label="Out of stock" value={String(snapshot.outOfStockItems)} tone={snapshot.outOfStockItems ? "danger" : undefined} />
        <Kpi label="Low stock" value={String(snapshot.lowStockItems)} tone={snapshot.lowStockItems ? "warn" : undefined} />
        <Kpi label="Expiring lots" value={String(snapshot.expiringLots)} tone={snapshot.expiringLots ? "warn" : undefined} />
        <Kpi label="Pending SIVs" value={String(snapshot.pendingSivs)} />
        <Kpi label="Purchase requests" value={String(snapshot.pendingPurchaseRequisitions)} />
        <Kpi label="Equipment issues" value={String(snapshot.equipmentIssues)} tone={snapshot.equipmentIssues ? "warn" : undefined} />
      </div>
      <div className="ops-signal-columns">
        <section>
          <h3 className="ops-subhead">{t("Recommended actions")}</h3>
          {snapshot.recommendations.length === 0 ? <p className="ops-empty">{t("Nothing needs attention.")}</p> : (
            <ul className="ops-list">
              {snapshot.recommendations.slice(0, 6).map((item) => (
                <li key={`${item.useCase}-${item.title}`} className={`ops-signal ops-signal--${severityTone(item.severity)}`}>
                  <b>{item.title}</b><small>{item.detail}</small><small>{item.recommendedAction}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="ops-subhead">{t("Low stock")}</h3>
          {snapshot.inventoryAlerts.length === 0 ? <p className="ops-empty">{t("No low-stock items in the branch's stock locations.")}</p> : (
            <ul className="ops-list">
              {snapshot.inventoryAlerts.slice(0, 6).map((item) => (
                <li key={`${item.stockLocationId}-${item.itemId}`} className={`ops-signal ops-signal--${severityTone(item.severity)}`}>
                  <b>{item.itemName}</b>
                  <small>{item.stockLocationName} · {qty(item.availableBaseQty)} / {t("reorder at")} {qty(item.reorderLevel)} {item.baseUom}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="ops-subhead">{t("Expiring in 7 days")}</h3>
          {snapshot.expiringStock.length === 0 ? <p className="ops-empty">{t("No lots expiring in the next 7 days.")}</p> : (
            <ul className="ops-list">
              {snapshot.expiringStock.slice(0, 6).map((lot) => (
                <li key={lot.lotId} className="ops-signal ops-signal--warn">
                  <b>{lot.itemName}</b>
                  <small>{lot.stockLocationName} · {qty(lot.qtyRemainingBase)} {lot.baseUom} · {lot.daysToExpiry} {t("day(s)")}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function TabButton({ id, tab, setTab, icon, label, badge }: { id: Tab; tab: Tab; setTab: (tab: Tab) => void; icon: ReactNode; label: string; badge?: string }) {
  return (
    <Button
      role="tab"
      variant="ghost"
      aria-selected={tab === id}
      className={`ops-tab${tab === id ? " is-active" : ""}`}
      onClick={() => setTab(id)}
    >
      {icon}
      {t(label)}
      {badge && <span className="ops-tab-badge">{badge}</span>}
    </Button>
  );
}

function Kpi({ label, value, hint, progress, tone }: { label: string; value: string; hint?: string; progress?: number | null; tone?: "good" | "warn" | "danger" }) {
  return (
    <div className={`ops-kpi${tone ? ` ops-kpi--${tone}` : ""}`}>
      <span>{t(label)}</span>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
      {progress != null && <Progress value={progress} label={t(label)} />}
    </div>
  );
}

function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="ops-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function Gate({ ok, text, warn }: { ok: boolean; text: string; warn?: boolean }) {
  return (
    <li className={ok ? "is-ok" : warn ? "is-warn" : "is-blocked"}>
      {ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {text}
    </li>
  );
}

function NumberField({ label, value, onChange, step }: { label: string; value: number; onChange: (value: number) => void; step: number }) {
  return (
    <label className="ops-field">
      <span>{t(label)}</span>
      <Input type="number" min={0} step={step} inputMode="decimal" value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
    </label>
  );
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="ops-field">
      <span>{t(label)}</span>
      <Input type={type} min={type === "number" ? 0 : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="ops-field">
      <span>{t(label)}</span>
      <Textarea value={value} placeholder={placeholder ? t(placeholder) : undefined} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function ReasonSelect({ label, value, reasons, onChange }: { label: string; value: string; reasons: WorkflowReasonCodeDto[]; onChange: (value: string) => void }) {
  return (
    <label className="ops-field">
      <span>{t(label)}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{reasons.length ? t("Select a reason") : t("No reason codes are set up")}</option>
        {reasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.code} - {reason.description}</option>)}
      </Select>
    </label>
  );
}

function OpsModal({ title, children, onClose, actions }: { title: string; children: ReactNode; onClose: () => void; actions: ReactNode }) {
  return (
    <div className="ui-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="ui-dialog ops-dialog" role="dialog" aria-modal="true" aria-label={t(title)} onMouseDown={(e) => e.stopPropagation()}>
        <header className="ui-dialog-header"><h3>{t(title)}</h3></header>
        <div className="ui-dialog-body">{children}</div>
        <footer className="ui-dialog-actions">{actions}</footer>
      </section>
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function errorText(e: unknown) {
  const err = e as { response?: { data?: { message?: string; error?: string; title?: string; detail?: string } }; message?: string };
  return err?.response?.data?.message || err?.response?.data?.error || err?.response?.data?.detail || err?.response?.data?.title || err?.message || t("Request failed.");
}

function statusLabel(value: string) {
  return value === "ReadyWithException" ? "Ready with exception" : value;
}

function statusTone(value?: string | null) {
  if (value === "Ready" || value === "Closed") return "ops-chip--good";
  if (value === "ReadyWithException") return "ops-chip--warn";
  return "";
}

function severityTone(value?: string | null) {
  const key = (value || "").toLowerCase();
  if (key.includes("critical")) return "danger";
  if (key.includes("warning")) return "warn";
  return "info";
}

function tabLabel(tab: Tab) {
  return { plan: "Plan", briefing: "Briefing", readiness: "Readiness", cash: "Cash & close", signals: "Signals", history: "History" }[tab];
}

function weekdayLabel(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(date);
}

function addDaysIso(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function qty(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value || 0);
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
