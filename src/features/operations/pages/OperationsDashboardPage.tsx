import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { resolveBranchId, resolveCompanyId } from "../../../api/http";
import { operationsApi } from "../api/operationsApi";
import type { BackOfficeEfficiencySnapshotDto, CashierShiftDto, DailyOperationPlanDto, EndOfDayReportDto, OperationsPosStoreDto, SafeDropDto, SalesSummaryDto, WorkflowReasonCodeDto } from "../api/operationsTypes";
import { formatAppDateTime, todayLocalIsoDate } from "../../../shared/datetime/dateFormat";
import "../styles/operations.css";

function useAppScope() {
  return {
    companyId: resolveCompanyId() || "",
    branchId: resolveBranchId() || "",
  };
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
  const { companyId, branchId } = useAppScope();
  const [businessDate, setBusinessDate] = useState(() => todayLocalIsoDate());
  const [shiftName, setShiftName] = useState("Day");
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
  const [modal, setModal] = useState<ModalState>(null);
  const [shiftForm, setShiftForm] = useState({ storeId: "", cashierName: "", terminal: "POS-1", openingFloat: "0" });
  const [closeShiftForm, setCloseShiftForm] = useState({ closingCash: "0", notes: "" });
  const [safeDropForm, setSafeDropForm] = useState({ amount: "0", referenceNo: "", notes: "" });
  const [exceptionForm, setExceptionForm] = useState({ reason: "", reasonCodeId: "" });
  const [eodVarianceForm, setEodVarianceForm] = useState({ reasonCodeId: "", comment: "" });

  const range = useMemo(() => {
    const from = new Date(`${businessDate}T00:00:00+03:00`);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
    return { fromUtc: from.toISOString(), toUtc: to.toISOString() };
  }, [businessDate]);

  async function refresh() {
    if (!companyId || !branchId) return;
    const [open, sum, daily, snapshot, posStores, readyReasonRows, varianceReasonRows] = await Promise.all([
      operationsApi.currentOpenShift(companyId, branchId),
      operationsApi.salesSummary(companyId, branchId, range.fromUtc, range.toUtc),
      operationsApi.dailyPlan(companyId, branchId, businessDate, shiftName),
      operationsApi.backOfficeEfficiency(companyId, branchId, businessDate),
      operationsApi.stores(companyId, branchId),
      operationsApi.workflowReasons(companyId, "DailyOperation", "ReadinessException", "Ready"),
      operationsApi.workflowReasons(companyId, "DailyOperation", "EndOfDayVariance", "Close"),
    ]);

    setShift(open.data ?? null);
    setSummary(sum.data);
    setPlan(daily.data);
    setBackOffice(snapshot.data);
    setStores(posStores.data ?? []);
    setReadinessReasons(readyReasonRows.data ?? []);
    setVarianceReasons(varianceReasonRows.data ?? []);
    setForm(planToForm(daily.data));
    setBriefingNotes(daily.data.briefingNotes || defaultBriefing(daily.data));

    if (open.data?.id) {
      const d = await operationsApi.safeDrops(companyId, branchId, open.data.id);
      setDrops(d.data ?? []);
    } else {
      setDrops([]);
    }
  }

  useEffect(() => { void refresh(); }, [companyId, branchId, businessDate, shiftName]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e?.response?.data?.title || e?.message || "Operation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function savePlan() {
    await run(async () => {
      const saved = await operationsApi.saveDailyPlan(companyId, branchId, { businessDate, shiftName, ...form });
      setPlan(saved.data);
      setForm(planToForm(saved.data));
      setMessage(saved.data.isPersisted ? "Daily operational plan saved." : "Daily operational plan prepared.");
    });
  }

  async function recordBriefing() {
    if (!isSavedPlan(plan)) return;
    await run(async () => {
      const saved = await operationsApi.recordBriefing(companyId, branchId, plan.id, briefingNotes);
      setPlan(saved.data);
      setMessage("Pre-shift briefing recorded.");
    });
  }

  async function toggleChecklist(id: string, isCompleted: boolean) {
    if (!isSavedPlan(plan)) return;
    const next = plan.checklistItems.map((x) => x.id === id ? { ...x, isCompleted } : x);
    await run(async () => {
      const saved = await operationsApi.updateChecklist(companyId, branchId, plan.id, next.map((x) => ({ id: x.id, isCompleted: x.isCompleted, notes: x.notes })));
      setPlan(saved.data);
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
      const saved = await operationsApi.markReady(companyId, branchId, plan.id);
      setPlan(saved.data);
      setMessage("Branch marked operationally ready.");
    });
  }

  async function submitReadyException() {
    if (!isSavedPlan(plan) || !exceptionForm.reason.trim() || !exceptionForm.reasonCodeId) return;
    await run(async () => {
      const saved = await operationsApi.markReady(
        companyId,
        branchId,
        plan.id,
        exceptionForm.reason.trim(),
        exceptionForm.reasonCodeId || null,
      );
      setPlan(saved.data);
      setModal(null);
      setMessage("Marked ready with manager exception.");
    });
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
    });
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
    });
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
      const r = await operationsApi.generateEndOfDay(companyId, branchId, {
        businessDate,
        varianceReasonCodeId: variance !== 0 ? eodVarianceForm.reasonCodeId : null,
        varianceComment: variance !== 0 ? eodVarianceForm.comment.trim() : null,
      });
      setEod(r.data);
      setModal(null);
    });
  }

  const readinessPercent = plan ? Math.round((plan.checklistItems.filter((x) => x.isCompleted).length / Math.max(1, plan.checklistItems.length)) * 100) : 0;
  const savedPlan = isSavedPlan(plan);

  return (
    <main className="ops-page">
      <header className="ops-title">
        <div>
          <span>Branch Operations</span>
          <h1>Daily Operational Control Center</h1>
          <p>Plan the shift, brief employees, verify readiness, then open controlled operations.</p>
        </div>
        <div className="ops-toolbar">
          <input className="ops-input" type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          <select className="ops-input" value={shiftName} onChange={(e) => setShiftName(e.target.value)}>
            <option>Breakfast</option><option>Lunch</option><option>Day</option><option>Dinner</option><option>Night</option>
          </select>
          <button className="ops-primary ops-primary-inline" disabled={busy} onClick={refresh}>Refresh</button>
        </div>
      </header>

      {message && <div className="ops-alert">{message}</div>}
      {plan && !savedPlan && (
        <div className="ops-alert info">
          This operational plan is a preview. Save the plan before recording briefing, checklist, readiness, or acknowledgement activity.
        </div>
      )}

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
          <div className="ops-card-head"><div><span>Step 1</span><h2>Plan Daily Operations</h2></div><button disabled={busy} onClick={savePlan}>Save Plan</button></div>
          <div className="ops-form-grid">
            <Field label="Expected covers" type="number" value={form.expectedCovers} onChange={(v) => setForm({ ...form, expectedCovers: Number(v) })} />
            <Field label="Expected sales" type="number" value={form.expectedSales} onChange={(v) => setForm({ ...form, expectedSales: Number(v) })} />
            <Field label="Required employees" type="number" value={form.requiredEmployees} onChange={(v) => setForm({ ...form, requiredEmployees: Number(v) })} />
            <TextField label="Sales targets" value={form.salesTargets} onChange={(v) => setForm({ ...form, salesTargets: v })} />
            <TextField label="Employees by position" value={form.requiredEmployeesByPosition} onChange={(v) => setForm({ ...form, requiredEmployeesByPosition: v })} />
            <TextField label="Required food production" value={form.requiredFoodProduction} onChange={(v) => setForm({ ...form, requiredFoodProduction: v })} />
            <TextField label="Critical inventory levels" value={form.criticalInventoryLevels} onChange={(v) => setForm({ ...form, criticalInventoryLevels: v })} />
            <TextField label="Outstanding purchase orders" value={form.outstandingPurchaseOrders} onChange={(v) => setForm({ ...form, outstandingPurchaseOrders: v })} />
            <TextField label="Equipment availability" value={form.equipmentAvailability} onChange={(v) => setForm({ ...form, equipmentAvailability: v })} />
            <TextField label="Open operational issues" value={form.openOperationalIssues} onChange={(v) => setForm({ ...form, openOperationalIssues: v })} />
          </div>
          <textarea className="ops-textarea" value={form.planningInputs} onChange={(e) => setForm({ ...form, planningInputs: e.target.value })} placeholder="Reservations, guest count, sales history, holidays, weather, catering, promotions, inventory, leave, maintenance" />
        </div>

        <div className="ops-card">
          <div className="ops-card-head"><div><span>Step 2</span><h2>Pre-Shift Briefing</h2></div><button disabled={busy || !savedPlan} onClick={recordBriefing}>Record</button></div>
          <textarea className="ops-textarea ops-textarea-tall" value={briefingNotes} onChange={(e) => setBriefingNotes(e.target.value)} />
          <div className="ops-detail"><b>Acknowledged:</b> {plan?.acknowledgements.length ?? 0} employees</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-head"><div><span>Cashier Control</span><h2>{shift ? "Open" : "No open shift"}</h2></div><b className={shift ? "ops-pill good" : "ops-pill warn"}>{shift ? "ACTIVE" : "CLOSED"}</b></div>
          {shift ? <div className="ops-detail"><p><b>Cashier:</b> {shift.cashierName}</p><p><b>Terminal:</b> {shift.terminal}</p><p><b>Opened:</b> {formatAppDateTime(shift.openedAtUtc)}</p></div> : <div className="ops-empty">Open a cashier shift after readiness is approved.</div>}
          <div className="ops-actions">
            {!shift && <button disabled={busy} onClick={() => setModal("openShift")}>Open Shift</button>}
            {shift && <button disabled={busy} onClick={() => setModal("safeDrop")}>Safe Drop</button>}
            {shift && <button disabled={busy} onClick={() => setModal("closeShift")}>Close Shift</button>}
          </div>
        </div>
      </section>

      <section className="ops-grid ops-grid-wide">
        <div className="ops-card ops-card-span">
          <div className="ops-card-head"><div><span>Step 3</span><h2>Operational Readiness Checklist</h2></div><button disabled={busy || !savedPlan} onClick={markReady}>Mark Operationally Ready</button></div>
          <div className="ops-checklist">
            {(plan?.checklistItems ?? []).map((item) => (
              <label key={item.id} className={`ops-check ${item.isCritical ? "critical" : ""}`}>
                <input type="checkbox" disabled={!savedPlan} checked={item.isCompleted} onChange={(e) => toggleChecklist(item.id, e.target.checked)} />
                <span><b>{item.area}</b>{item.item}</span>
                {item.isCritical && <em>Critical</em>}
              </label>
            ))}
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-head"><div><span>Sales Summary</span><h2>{money(summary?.netSales ?? 0)}</h2></div></div>
          <div className="ops-kpis">
            <Kpi label="Sales Count" value={summary?.salesCount ?? 0} />
            <Kpi label="Gross Sales" value={money(summary?.grossSales ?? 0)} />
            <Kpi label="COGS" value={money(summary?.totalCogs ?? 0)} />
            <Kpi label="Gross Profit" value={money(summary?.grossProfit ?? 0)} />
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-head"><div><span>End of Day</span><h2>{eod ? "Generated" : "Pending"}</h2></div></div>
          {eod ? <div className="ops-kpis"><Kpi label="Net Sales" value={money(eod.netSales)} /><Kpi label="Safe Drops" value={money(eod.totalSafeDrops)} /></div> : <div className="ops-empty">Generate after all operational activity is complete.</div>}
          <button className="ops-primary" disabled={busy} onClick={generateEod}>Generate End-of-Day</button>
          <div className="ops-detail"><b>Safe Drops:</b> {money(drops.reduce((s, x) => s + x.amount, 0))}</div>
        </div>
      </section>

      {modal === "openShift" && (
        <OpsModal title="Open cashier shift" onClose={() => setModal(null)}>
          <label className="ops-field">
            <span>POS store</span>
            <select className="ops-input" value={shiftForm.storeId} onChange={(e) => setShiftForm({ ...shiftForm, storeId: e.target.value })}>
              <option value="">Select POS store</option>
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
          <div className="ops-modal-actions"><button onClick={() => setModal(null)}>Cancel</button><button disabled={busy || !shiftForm.storeId} onClick={openShift}>Open Shift</button></div>
        </OpsModal>
      )}

      {modal === "closeShift" && (
        <OpsModal title="Close cashier shift" onClose={() => setModal(null)}>
          <Field label="Closing cash" type="number" value={closeShiftForm.closingCash} onChange={(v) => setCloseShiftForm({ ...closeShiftForm, closingCash: v })} />
          <TextField label="Closing notes" value={closeShiftForm.notes} onChange={(v) => setCloseShiftForm({ ...closeShiftForm, notes: v })} />
          <div className="ops-modal-actions"><button onClick={() => setModal(null)}>Cancel</button><button disabled={busy} onClick={closeShift}>Close Shift</button></div>
        </OpsModal>
      )}

      {modal === "safeDrop" && (
        <OpsModal title="Record safe drop" onClose={() => setModal(null)}>
          <Field label="Amount" type="number" value={safeDropForm.amount} onChange={(v) => setSafeDropForm({ ...safeDropForm, amount: v })} />
          <Field label="Reference no" value={safeDropForm.referenceNo} onChange={(v) => setSafeDropForm({ ...safeDropForm, referenceNo: v })} />
          <TextField label="Notes" value={safeDropForm.notes} onChange={(v) => setSafeDropForm({ ...safeDropForm, notes: v })} />
          <div className="ops-modal-actions"><button onClick={() => setModal(null)}>Cancel</button><button disabled={busy} onClick={safeDrop}>Save Drop</button></div>
        </OpsModal>
      )}

      {modal === "readyException" && (
        <OpsModal title="Manager readiness exception" onClose={() => setModal(null)}>
          <div className="ops-detail">Critical checklist items are still open. A manager exception reason is required and will be audited.</div>
          <ReasonSelect label="Reason code" value={exceptionForm.reasonCodeId} reasons={readinessReasons} onChange={(v) => setExceptionForm({ ...exceptionForm, reasonCodeId: v })} />
          <TextField label="Exception reason" value={exceptionForm.reason} onChange={(v) => setExceptionForm({ ...exceptionForm, reason: v })} />
          <div className="ops-modal-actions"><button onClick={() => setModal(null)}>Cancel</button><button disabled={busy || !exceptionForm.reason.trim() || !exceptionForm.reasonCodeId} onClick={submitReadyException}>Approve Exception</button></div>
        </OpsModal>
      )}

      {modal === "eodVariance" && (
        <OpsModal title="Approve end-of-day variance" onClose={() => setModal(null)}>
          <div className="ops-detail">Cash payments and safe drops do not match. A controlled reason and comment are required before generating end-of-day.</div>
          <Kpi label="Cash variance" value={money(cashVariance(summary, drops))} />
          <ReasonSelect label="Variance reason" value={eodVarianceForm.reasonCodeId} reasons={varianceReasons} onChange={(v) => setEodVarianceForm({ ...eodVarianceForm, reasonCodeId: v })} />
          <TextField label="Variance comment" value={eodVarianceForm.comment} onChange={(v) => setEodVarianceForm({ ...eodVarianceForm, comment: v })} />
          <div className="ops-modal-actions"><button onClick={() => setModal(null)}>Cancel</button><button disabled={busy || !eodVarianceForm.reasonCodeId || !eodVarianceForm.comment.trim()} onClick={generateEod}>Generate End-of-Day</button></div>
        </OpsModal>
      )}
    </main>
  );
}

function isSavedPlan(plan: DailyOperationPlanDto | null): plan is DailyOperationPlanDto {
  return Boolean(plan?.isPersisted && plan.id && plan.id !== "00000000-0000-0000-0000-000000000000");
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
    `Expected guest count: ${plan.expectedCovers}`,
    `Sales target: ${money(plan.expectedSales)}`,
    `Required employees: ${plan.requiredEmployees}`,
    "Featured menu items:",
    "Unavailable menu items:",
    "Large reservations / special customer requirements:",
    "Employee assignments:",
    "Service-quality expectations:",
    "Food-safety reminders:",
    "Known equipment problems:",
    "Shift KPIs:",
    "Previous-shift issues and corrective actions:",
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

function qty(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value || 0);
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return <label className="ops-field"><span>{label}</span><input className="ops-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="ops-field"><span>{label}</span><textarea value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function ReasonSelect({ label, value, reasons, onChange }: { label: string; value: string; reasons: WorkflowReasonCodeDto[]; onChange: (value: string) => void }) {
  return (
    <label className="ops-field">
      <span>{label}</span>
      <select className="ops-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select reason code</option>
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
  return <div className="ops-kpi"><span>{label}</span><b>{value}</b></div>;
}

function money(v: number) {
  return new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(v || 0);
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
      <section className="ops-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="ops-card-head"><div><span>Action</span><h2>{title}</h2></div><button type="button" onClick={onClose}>Close</button></div>
        {children}
      </section>
    </div>
  );
}
