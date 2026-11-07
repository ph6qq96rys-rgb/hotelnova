import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../../auth/AuthProvider";
import { useAppScope } from "../../../../app/useAppScope";
import { attendanceApi } from "../../api/hrApi";
import type { AttendancePolicyDto } from "../../types";
import { getApiError } from "../../utils/hrUtils";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";

type PolicyForm = {
  id: string | null;
  branchId: string | null;
  code: string;
  name: string;
  timeZoneId: string;
  standardDailyHours: string;
  mealBreakMinutes: string;
  deductMealBreakAutomatically: boolean;
  lateGraceMinutes: string;
  earlyDepartureGraceMinutes: string;
  overtimeThresholdHours: string;
  requiresOvertimeApproval: boolean;
  overtimeApprovalThresholdHours: string;
  overtimeRate: string;
  nightOvertimeRate: string;
  restDayOvertimeRate: string;
  publicHolidayOvertimeRate: string;
  maxOvertimeHoursPerDay: string;
  maxOvertimeHoursPerWeek: string;
  weeklyRestDay: string;
  workDaysPerWeek: string;
  maxSessionHours: string;
  allowSplitShifts: boolean;
  duplicateScanGuardMinutes: string;
  allowManualEntry: boolean;
  requiresManualEntryApproval: boolean;
  requireQrClocking: boolean;
  shiftPatternName: string;
  rosterGroupName: string;
  attendanceDeviceName: string;
  latePolicyName: string;
  overtimePolicyName: string;
  holidayCalendarName: string;
  mealBreakRuleName: string;
};

const defaultPolicy: PolicyForm = {
  id: null,
  branchId: null,
  code: "STANDARD",
  name: "Standard Attendance Policy",
  timeZoneId: "Africa/Addis_Ababa",
  standardDailyHours: "8",
  mealBreakMinutes: "30",
  deductMealBreakAutomatically: true,
  lateGraceMinutes: "10",
  earlyDepartureGraceMinutes: "10",
  overtimeThresholdHours: "8",
  requiresOvertimeApproval: true,
  overtimeApprovalThresholdHours: "8",
  overtimeRate: "1.5",
  nightOvertimeRate: "1.75",
  restDayOvertimeRate: "2",
  publicHolidayOvertimeRate: "2.5",
  maxOvertimeHoursPerDay: "4",
  maxOvertimeHoursPerWeek: "12",
  weeklyRestDay: "Sunday",
  workDaysPerWeek: "5",
  maxSessionHours: "16",
  allowSplitShifts: true,
  duplicateScanGuardMinutes: "5",
  allowManualEntry: true,
  requiresManualEntryApproval: true,
  requireQrClocking: true,
  shiftPatternName: "Standard",
  rosterGroupName: "Default roster",
  attendanceDeviceName: "Telegram Branch QR",
  latePolicyName: "10 minute grace",
  overtimePolicyName: "Manager approval after 8 hours",
  holidayCalendarName: "Ethiopia statutory calendar",
  mealBreakRuleName: "30 minute automatic meal break",
};

function toForm(policy?: AttendancePolicyDto | null): PolicyForm {
  if (!policy) return defaultPolicy;

  return {
    id: policy.id || null,
    branchId: policy.branchId ?? null,
    code: policy.code || defaultPolicy.code,
    name: policy.name || defaultPolicy.name,
    timeZoneId: policy.timeZoneId || defaultPolicy.timeZoneId,
    standardDailyHours: String(policy.standardDailyHours ?? 8),
    mealBreakMinutes: String(policy.mealBreakMinutes ?? 30),
    deductMealBreakAutomatically: Boolean(policy.deductMealBreakAutomatically),
    lateGraceMinutes: String(policy.lateGraceMinutes ?? 10),
    earlyDepartureGraceMinutes: String(policy.earlyDepartureGraceMinutes ?? 10),
    overtimeThresholdHours: String(policy.overtimeThresholdHours ?? 8),
    requiresOvertimeApproval: Boolean(policy.requiresOvertimeApproval),
    overtimeApprovalThresholdHours: String(policy.overtimeApprovalThresholdHours ?? 8),
    overtimeRate: String(policy.overtimeRate ?? 1.5),
    nightOvertimeRate: String(policy.nightOvertimeRate ?? 1.75),
    restDayOvertimeRate: String(policy.restDayOvertimeRate ?? 2),
    publicHolidayOvertimeRate: String(policy.publicHolidayOvertimeRate ?? 2.5),
    maxOvertimeHoursPerDay: String(policy.maxOvertimeHoursPerDay ?? 4),
    maxOvertimeHoursPerWeek: String(policy.maxOvertimeHoursPerWeek ?? 12),
    weeklyRestDay: restDayName(policy.weeklyRestDay),
    workDaysPerWeek: String(policy.workDaysPerWeek ?? 5),
    maxSessionHours: String(policy.maxSessionHours ?? 16),
    allowSplitShifts: policy.allowSplitShifts ?? true,
    duplicateScanGuardMinutes: String(policy.duplicateScanGuardMinutes ?? 5),
    allowManualEntry: Boolean(policy.allowManualEntry),
    requiresManualEntryApproval: Boolean(policy.requiresManualEntryApproval),
    requireQrClocking: Boolean(policy.requireQrClocking),
    shiftPatternName: policy.shiftPatternName || defaultPolicy.shiftPatternName,
    rosterGroupName: policy.rosterGroupName || defaultPolicy.rosterGroupName,
    attendanceDeviceName: policy.attendanceDeviceName || defaultPolicy.attendanceDeviceName,
    latePolicyName: policy.latePolicyName || defaultPolicy.latePolicyName,
    overtimePolicyName: policy.overtimePolicyName || defaultPolicy.overtimePolicyName,
    holidayCalendarName: policy.holidayCalendarName || defaultPolicy.holidayCalendarName,
    mealBreakRuleName: policy.mealBreakRuleName || defaultPolicy.mealBreakRuleName,
  };
}

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function restDayName(value: unknown): string {
  if (typeof value === "number") return WEEK_DAYS[value] ?? "Sunday";
  if (typeof value === "string" && WEEK_DAYS.includes(value)) return value;
  return "Sunday";
}

function asNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0 }}>
      {label}
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 44,
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 12px",
        background: "var(--surface)",
        fontWeight: 700,
      }}
    >
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function AttendanceConfigurationPage() {
  const { companyId, branchId, branchName, companyName } = useAppScope();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.attendance.policies.manage") || hasPermission("hr.attendance.manage");
  const generation = useRef(0);
  const scope = (companyId || "") + ":" + (branchId || "");
  const [loadedScope, setLoadedScope] = useState("");
  const [inherited, setInherited] = useState(false);
  const [form, setForm] = useState<PolicyForm>(defaultPolicy);
  const [policies, setPolicies] = useState<AttendancePolicyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;

    const current = ++generation.current;
    setLoadedScope("");
    setLoading(true);
    setError(null);
    setSaved(null);

    try {
      const [effective, list] = await Promise.all([
        attendanceApi.getEffectivePolicy(companyId, branchId || null),
        attendanceApi.listPolicies(companyId, { branchId: branchId || null, includeInactive: true }),
      ]);

      if (current !== generation.current) return;
      const selected = branchId || null;
      const editable = list.find(p => p.id === effective?.id && (p.branchId ?? null) === selected);
      setInherited(Boolean(selected && !editable));
      setForm({ ...toForm(effective), id: editable?.id ?? null, branchId: selected });
      setPolicies(list);
      setLoadedScope(scope);
    } catch (e) {
      if (current === generation.current) setError(getApiError(e, "Failed to load attendance configuration."));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [companyId, branchId, scope]);

  useEffect(() => {
    void load();
    return () => { generation.current++; };
  }, [load]);

  const update = <K extends keyof PolicyForm>(key: K, value: PolicyForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const summary = useMemo(() => {
    const standardHours = asNumber(form.standardDailyHours, 8);
    const overtimeThreshold = asNumber(form.overtimeThresholdHours, 8);
    const duplicateGuard = asNumber(form.duplicateScanGuardMinutes, 5);
    const mealBreak = asNumber(form.mealBreakMinutes, 30);

    return { standardHours, overtimeThreshold, duplicateGuard, mealBreak };
  }, [form]);

  const save = async () => {
    if (!companyId || saving || loading || loadedScope !== scope || !canManage) return;
    const limits: [keyof PolicyForm, string, number, number, boolean][] = [
      ["standardDailyHours", "Standard daily hours", 0.25, 24, false],
      ["mealBreakMinutes", "Meal break minutes", 0, 240, true],
      ["lateGraceMinutes", "Late grace minutes", 0, 240, true],
      ["earlyDepartureGraceMinutes", "Early departure grace", 0, 240, true],
      ["overtimeThresholdHours", "Overtime threshold", 0, 24, false],
      ["overtimeApprovalThresholdHours", "Approval threshold", 0, 24, false],
      ["overtimeRate", "Overtime rate", 0.01, 5, false],
      ["nightOvertimeRate", "Night overtime rate", 1, 5, false],
      ["restDayOvertimeRate", "Rest-day rate", 1, 5, false],
      ["publicHolidayOvertimeRate", "Public-holiday rate", 1, 5, false],
      ["maxOvertimeHoursPerDay", "Daily overtime limit", 0.25, 12, false],
      ["maxOvertimeHoursPerWeek", "Weekly overtime limit", 0.25, 60, false],
      ["workDaysPerWeek", "Working days per week", 5, 6, true],
      ["duplicateScanGuardMinutes", "Duplicate scan guard", 0, 120, true],
      ["maxSessionHours", "Maximum shift length", 4, 24, false],
    ];
    for (const [key, label, min, max, integer] of limits) {
      const value = String(form[key]).trim(), number = Number(value);
      if (!value || !Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
        setError(label + " must be " + (integer ? "a whole number" : "a number") + " between " + min + " and " + max + ".");
        return;
      }
    }
    if (!form.code.trim() || !form.name.trim()) { setError("Policy code and name are required."); return; }
    const current = generation.current;
    setSaving(true);
    setError(null);
    setSaved(null);

    try {
      await attendanceApi.savePolicy(companyId, {
        id: form.id || undefined,
        companyId,
        branchId: branchId || undefined,
        code: form.code.trim(),
        name: form.name.trim(),
        isDefault: true,
        timeZoneId: form.timeZoneId.trim() || "Africa/Addis_Ababa",
        standardDailyHours: asNumber(form.standardDailyHours, 8),
        mealBreakMinutes: asNumber(form.mealBreakMinutes, 30),
        deductMealBreakAutomatically: form.deductMealBreakAutomatically,
        lateGraceMinutes: asNumber(form.lateGraceMinutes, 10),
        earlyDepartureGraceMinutes: asNumber(form.earlyDepartureGraceMinutes, 10),
        overtimeThresholdHours: asNumber(form.overtimeThresholdHours, 8),
        requiresOvertimeApproval: form.requiresOvertimeApproval,
        overtimeApprovalThresholdHours: asNumber(form.overtimeApprovalThresholdHours, 8),
        overtimeRate: asNumber(form.overtimeRate, 1.5),
        nightOvertimeRate: asNumber(form.nightOvertimeRate, 1.75),
        restDayOvertimeRate: asNumber(form.restDayOvertimeRate, 2),
        publicHolidayOvertimeRate: asNumber(form.publicHolidayOvertimeRate, 2.5),
        maxOvertimeHoursPerDay: asNumber(form.maxOvertimeHoursPerDay, 4),
        maxOvertimeHoursPerWeek: asNumber(form.maxOvertimeHoursPerWeek, 12),
        weeklyRestDay: form.weeklyRestDay,
        workDaysPerWeek: asNumber(form.workDaysPerWeek, 5),
        maxSessionHours: asNumber(form.maxSessionHours, 16),
        allowSplitShifts: form.allowSplitShifts,
        duplicateScanGuardMinutes: asNumber(form.duplicateScanGuardMinutes, 5),
        allowManualEntry: form.allowManualEntry,
        requiresManualEntryApproval: true,
        requireQrClocking: form.requireQrClocking,
        shiftPatternName: form.shiftPatternName.trim(),
        rosterGroupName: form.rosterGroupName.trim(),
        attendanceDeviceName: form.attendanceDeviceName.trim(),
        latePolicyName: form.latePolicyName.trim(),
        overtimePolicyName: form.overtimePolicyName.trim(),
        holidayCalendarName: form.holidayCalendarName.trim(),
        mealBreakRuleName: form.mealBreakRuleName.trim(),
      });

      if (current !== generation.current) return;
      await load();
      if (generation.current === current + 1) setSaved("Attendance policy saved for " + (branchName || "the company default") + ".");
    } catch (e) {
      if (current === generation.current) setError(getApiError(e, "Failed to save attendance configuration."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources | Attendance Configuration</div>
          <div className="page-title">Attendance Policy Control</div>
          <div className="page-sub">
            Configure tenant-safe rules for QR clocking, manual entries, duplicate scans, late arrivals, meal breaks, overtime, and payroll readiness.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => void load()} disabled={loading || saving || !companyId}>
            <i className="ti ti-refresh" /> {loading ? "Loading..." : "Refresh"}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving || loading || loadedScope !== scope || !companyId || !canManage}>
            <i className="ti ti-device-floppy" /> {saving ? "Saving..." : "Save Policy"}
          </button>
        </div>
      </div>

      {!canManage && <div className="alert">Read-only: attendance policy management permission is required to save.</div>}
      {inherited && <div className="alert">This branch inherits its rules. Saving creates a branch override; the company default stays unchanged.</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {saved && <div className="alert alert-success">{saved}</div>}

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Scope</div>
          <div className="kpi-val" style={{ fontSize: 18 }}>{branchName || "Company"}</div>
          <div className="kpi-sub">{companyName || "Active company"} policy</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Daily Hours</div>
          <div className="kpi-val">{summary.standardHours}</div>
          <div className="kpi-sub">standard working day</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Overtime Gate</div>
          <div className="kpi-val">{summary.overtimeThreshold}</div>
          <div className="kpi-sub">worked hours before overtime</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Duplicate Guard</div>
          <div className="kpi-val">{summary.duplicateGuard}</div>
          <div className="kpi-sub">minutes between scans</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Meal Break</div>
          <div className="kpi-val">{summary.mealBreak}</div>
          <div className="kpi-sub">{form.deductMealBreakAutomatically ? "auto deducted" : "not auto deducted"}</div>
        </div>
      </div>

      <fieldset disabled={loading || saving || loadedScope !== scope || !canManage} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <section className="card" style={{ marginBottom: 18, padding: 20 }}>
        <div className="card-title">Policy Identity</div>
        <div className="card-subtitle" style={{ marginBottom: 16 }}>
          Company and branch scope are enforced by the API. A branch policy overrides the company default for employees in that branch.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <Field label="Policy Code">
            <input className="input" maxLength={40} value={form.code} onChange={(e) => update("code", e.target.value)} />
          </Field>
          <Field label="Policy Name">
            <input className="input" maxLength={160} value={form.name} onChange={(e) => update("name", e.target.value)} />
          </Field>
          <Field label="Time Zone">
            <select className="input" value={form.timeZoneId} onChange={(e) => update("timeZoneId", e.target.value)}>
              <option value="Africa/Addis_Ababa">Africa/Addis Ababa</option>
              <option value="UTC">UTC</option>
              {!["Africa/Addis_Ababa", "UTC"].includes(form.timeZoneId) && <option value={form.timeZoneId}>{form.timeZoneId}</option>}
            </select>
          </Field>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18, padding: 20 }}>
        <div className="card-title">Payroll & Compliance Rules</div>
        <div className="card-subtitle" style={{ marginBottom: 16 }}>
          Rules apply to new attendance calculations. Changing a policy does not recalculate historical records or approve overtime.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <Field label="Standard Daily Hours">
            <input className="input" type="number" min="1" max="24" step="0.25" value={form.standardDailyHours} onChange={(e) => update("standardDailyHours", e.target.value)} />
          </Field>
          <Field label="Overtime Threshold">
            <input className="input" type="number" min="0" max="24" step="0.25" value={form.overtimeThresholdHours} onChange={(e) => update("overtimeThresholdHours", e.target.value)} />
          </Field>
<Field label="Overtime Rate">
            <input className="input" type="number" min="1" max="5" step="0.1" value={form.overtimeRate} onChange={(e) => update("overtimeRate", e.target.value)} />
          </Field>
          <Field label="Late Grace Minutes">
            <input className="input" type="number" min="0" max="240" value={form.lateGraceMinutes} onChange={(e) => update("lateGraceMinutes", e.target.value)} />
          </Field>
          <Field label="Early Departure Grace">
            <input className="input" type="number" min="0" max="240" value={form.earlyDepartureGraceMinutes} onChange={(e) => update("earlyDepartureGraceMinutes", e.target.value)} />
          </Field>
          <Field label="Meal Break Minutes">
            <input className="input" type="number" min="0" max="240" value={form.mealBreakMinutes} onChange={(e) => update("mealBreakMinutes", e.target.value)} />
          </Field>
          <Field label="Duplicate Scan Guard">
            <input className="input" type="number" min="0" max="120" value={form.duplicateScanGuardMinutes} onChange={(e) => update("duplicateScanGuardMinutes", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18, padding: 20 }}>
        <div className="card-title">Overtime Premiums & Limits</div>
        <div className="card-subtitle" style={{ marginBottom: 16 }}>
          Defaults follow Labour Proclamation 1156/2019: 1.5x by day, 1.75x from 22:00 to 06:00, 2x on the weekly rest day,
          2.5x on public holidays, at most 4 hours a day and 12 hours a week. The hourly base is basic salary divided by
          the month&apos;s standard hours (daily hours x working days x 52 / 12). Confirm the rates with HR or legal before changing them.
          A clock-in left open longer than the maximum shift length counts as a missed clock-out: it gets no hours until a correction is approved.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <Field label="Night Overtime Rate">
            <Input type="number" min="1" max="5" step="0.05" value={form.nightOvertimeRate} onChange={(e) => update("nightOvertimeRate", e.target.value)} />
          </Field>
          <Field label="Rest-day Rate">
            <Input type="number" min="1" max="5" step="0.05" value={form.restDayOvertimeRate} onChange={(e) => update("restDayOvertimeRate", e.target.value)} />
          </Field>
          <Field label="Public-holiday Rate">
            <Input type="number" min="1" max="5" step="0.05" value={form.publicHolidayOvertimeRate} onChange={(e) => update("publicHolidayOvertimeRate", e.target.value)} />
          </Field>
          <Field label="Daily Overtime Limit (h)">
            <Input type="number" min="0.25" max="12" step="0.25" value={form.maxOvertimeHoursPerDay} onChange={(e) => update("maxOvertimeHoursPerDay", e.target.value)} />
          </Field>
          <Field label="Weekly Overtime Limit (h)">
            <Input type="number" min="0.25" max="60" step="0.25" value={form.maxOvertimeHoursPerWeek} onChange={(e) => update("maxOvertimeHoursPerWeek", e.target.value)} />
          </Field>
          <Field label="Weekly Rest Day">
            <Select value={form.weeklyRestDay} onChange={(e) => update("weeklyRestDay", e.target.value)}>
              {WEEK_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
            </Select>
          </Field>
          <Field label="Maximum Shift Length (h)">
            <Input type="number" min="4" max="24" step="0.5" value={form.maxSessionHours} onChange={(e) => update("maxSessionHours", e.target.value)} />
          </Field>
          <Field label="Working Days per Week">
            <Select value={form.workDaysPerWeek} onChange={(e) => update("workDaysPerWeek", e.target.value)}>
              <option value="5">5 (Monday to Friday)</option>
              <option value="6">6 (every day except the rest day)</option>
            </Select>
          </Field>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18, padding: 20 }}>
        <div className="card-title">Operational Controls</div>
        <div className="card-subtitle" style={{ marginBottom: 16 }}>
          These switches define how kitchen and branch employees can create attendance records.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
          <p>Telegram attendance uses a branch QR code. Registered PIN kiosks are managed under Attendance kiosks.</p>
          <Toggle label="Allow manual entry" checked={form.allowManualEntry} onChange={(value) => update("allowManualEntry", value)} />
          <Toggle label="Allow split shifts (clock in again the same day, e.g. lunch and dinner)" checked={form.allowSplitShifts} onChange={(value) => update("allowSplitShifts", value)} />
          <p>Manual corrections always require independent approval.</p>
          <p>Overtime is calculated as potential hours. Approval and payment follow the overtime workflow.</p>
          <Toggle label="Deduct meal break automatically" checked={form.deductMealBreakAutomatically} onChange={(value) => update("deductMealBreakAutomatically", value)} />
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18, padding: 20 }}>
        <div className="card-title">Employee Profile Labels</div>
        <div className="card-subtitle" style={{ marginBottom: 16 }}>
          These labels replace blank attendance configuration fields on employee profiles until dedicated shift, roster, device, and calendar masters are attached.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <Field label="Shift Pattern">
            <input className="input" value={form.shiftPatternName} onChange={(e) => update("shiftPatternName", e.target.value)} />
          </Field>
          <Field label="Roster Group">
            <input className="input" value={form.rosterGroupName} onChange={(e) => update("rosterGroupName", e.target.value)} />
          </Field>
          <Field label="Attendance Device">
            <input className="input" value={form.attendanceDeviceName} onChange={(e) => update("attendanceDeviceName", e.target.value)} />
          </Field>
          <Field label="Late Policy">
            <input className="input" value={form.latePolicyName} onChange={(e) => update("latePolicyName", e.target.value)} />
          </Field>
          <Field label="Overtime Policy">
            <input className="input" value={form.overtimePolicyName} onChange={(e) => update("overtimePolicyName", e.target.value)} />
          </Field>
          <Field label="Holiday Calendar">
            <input className="input" value={form.holidayCalendarName} onChange={(e) => update("holidayCalendarName", e.target.value)} />
          </Field>
          <Field label="Meal Break Rule">
            <input className="input" value={form.mealBreakRuleName} onChange={(e) => update("mealBreakRuleName", e.target.value)} />
          </Field>
        </div>
      </section>

      </fieldset>
      <section className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <div className="card-title">Configured Policies</div>
          <div className="card-subtitle">Policies visible to this company and active branch scope.</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Policy</th>
                <th>Scope</th>
                <th>Time Zone</th>
                <th>Daily Hours</th>
                <th>Overtime</th>
                <th>QR</th>
                <th>Manual</th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">No saved policies yet. The system is using the default Addis Ababa attendance policy.</td>
                </tr>
              ) : (
                policies.map((policy) => (
                  <tr key={policy.id || `${policy.companyId}-${policy.branchId || "company"}-${policy.code}`}>
                    <td>
                      <strong>{policy.name}</strong>
                      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{policy.code}</div>
                    </td>
                    <td>{policy.branchId ? "Branch" : "Company"}</td>
                    <td>{policy.timeZoneId}</td>
                    <td>{policy.standardDailyHours}</td>
                    <td>{policy.requiresOvertimeApproval ? `Approval after ${policy.overtimeApprovalThresholdHours}h` : "Tracked only"}</td>
                    <td>{policy.requireQrClocking ? "Required" : "Optional"}</td>
                    <td>{policy.allowManualEntry ? "Allowed" : "Blocked"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
