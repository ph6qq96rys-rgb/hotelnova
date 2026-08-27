import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { attendanceApi } from "../../api/hrApi";
import type { AttendancePolicyDto } from "../../types";
import { getApiError } from "../../utils/hrUtils";

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
  const [form, setForm] = useState<PolicyForm>(defaultPolicy);
  const [policies, setPolicies] = useState<AttendancePolicyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);
    setSaved(null);

    try {
      const [effective, list] = await Promise.all([
        attendanceApi.getEffectivePolicy(companyId, branchId || null),
        attendanceApi.listPolicies(companyId, { branchId: branchId || null, includeInactive: true }),
      ]);

      setForm(toForm(effective));
      setPolicies(list);
    } catch (e) {
      setError(getApiError(e, "Failed to load attendance configuration."));
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  useEffect(() => {
    void load();
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
    if (!companyId) return;

    setSaving(true);
    setError(null);
    setSaved(null);

    try {
      await attendanceApi.savePolicy(companyId, {
        id: form.id || undefined,
        companyId,
        branchId: branchId || form.branchId || undefined,
        code: form.code.trim(),
        name: form.name.trim(),
        isDefault: true,
        isActive: true,
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
        duplicateScanGuardMinutes: asNumber(form.duplicateScanGuardMinutes, 5),
        allowManualEntry: form.allowManualEntry,
        requiresManualEntryApproval: form.requiresManualEntryApproval,
        requireQrClocking: form.requireQrClocking,
        shiftPatternName: form.shiftPatternName.trim(),
        rosterGroupName: form.rosterGroupName.trim(),
        attendanceDeviceName: form.attendanceDeviceName.trim(),
        latePolicyName: form.latePolicyName.trim(),
        overtimePolicyName: form.overtimePolicyName.trim(),
        holidayCalendarName: form.holidayCalendarName.trim(),
        mealBreakRuleName: form.mealBreakRuleName.trim(),
      });

      setSaved("Attendance policy saved for the active company and branch scope.");
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to save attendance configuration."));
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
          <button className="btn" onClick={load} disabled={loading || !companyId}>
            <i className="ti ti-refresh" /> {loading ? "Loading..." : "Refresh"}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !companyId}>
            <i className="ti ti-device-floppy" /> {saving ? "Saving..." : "Save Policy"}
          </button>
        </div>
      </div>

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
          <div className="kpi-sub">standard payable day</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Overtime Gate</div>
          <div className="kpi-val">{summary.overtimeThreshold}</div>
          <div className="kpi-sub">hours before approval</div>
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

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Policy Identity</div>
        <div className="card-subtitle" style={{ marginBottom: 16 }}>
          Company and branch scope are enforced by the API. A branch policy overrides the company default for employees in that branch.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <Field label="Policy Code">
            <input className="input" value={form.code} onChange={(e) => update("code", e.target.value)} />
          </Field>
          <Field label="Policy Name">
            <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} />
          </Field>
          <Field label="Time Zone">
            <select className="input" value={form.timeZoneId} onChange={(e) => update("timeZoneId", e.target.value)}>
              <option value="Africa/Addis_Ababa">Africa/Addis Ababa</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Payroll & Compliance Rules</div>
        <div className="card-subtitle" style={{ marginBottom: 16 }}>
          These values drive attendance calculation, overtime flags, and payroll blocking behavior.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <Field label="Standard Daily Hours">
            <input className="input" type="number" min="1" max="24" step="0.25" value={form.standardDailyHours} onChange={(e) => update("standardDailyHours", e.target.value)} />
          </Field>
          <Field label="Overtime Threshold">
            <input className="input" type="number" min="1" max="24" step="0.25" value={form.overtimeThresholdHours} onChange={(e) => update("overtimeThresholdHours", e.target.value)} />
          </Field>
          <Field label="Approval Threshold">
            <input className="input" type="number" min="1" max="24" step="0.25" value={form.overtimeApprovalThresholdHours} onChange={(e) => update("overtimeApprovalThresholdHours", e.target.value)} />
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

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Operational Controls</div>
        <div className="card-subtitle" style={{ marginBottom: 16 }}>
          These switches define how kitchen and branch employees can create attendance records.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
          <Toggle label="Require QR clocking" checked={form.requireQrClocking} onChange={(value) => update("requireQrClocking", value)} />
          <Toggle label="Allow manual entry" checked={form.allowManualEntry} onChange={(value) => update("allowManualEntry", value)} />
          <Toggle label="Manual entry requires approval" checked={form.requiresManualEntryApproval} onChange={(value) => update("requiresManualEntryApproval", value)} />
          <Toggle label="Overtime requires manager approval" checked={form.requiresOvertimeApproval} onChange={(value) => update("requiresOvertimeApproval", value)} />
          <Toggle label="Deduct meal break automatically" checked={form.deductMealBreakAutomatically} onChange={(value) => update("deductMealBreakAutomatically", value)} />
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
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
