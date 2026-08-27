import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { attendanceApi } from "../../api/hrApi";
import type { AttendanceRecordDto, AttendanceReportDto } from "../../types";
import { fmtDate, fmtNumber, fmtTime, getApiError, todayLocalIsoDate } from "../../utils/hrUtils";

const STANDARD_SHIFT_HOURS = 8;

type GovernanceStatus = "Ready for HR" | "Manager Action" | "KPI Missing" | "Approved" | "No Overtime";

function overtimeHours(record: AttendanceRecordDto): number {
  return record.overtimeHours ?? Math.max(0, (record.workedHours ?? 0) - STANDARD_SHIFT_HOURS);
}

function hasOvertime(record: AttendanceRecordDto): boolean {
  return overtimeHours(record) > 0 || (record.workedHours ?? 0) > STANDARD_SHIFT_HOURS;
}

function hasKpiAttachment(record: AttendanceRecordDto): boolean {
  return Boolean(
    record.overtimeBusinessJustification &&
      record.overtimeExpectedOutput &&
      (record.overtimeActualOutput || record.overtimeStatus === "Pending")
  );
}

function governanceStatus(record: AttendanceRecordDto): GovernanceStatus {
  if (!hasOvertime(record)) return "No Overtime";
  if (record.overtimeStatus === "Approved" || record.overtimeStatus === "Processed") return "Approved";
  if (!hasKpiAttachment(record)) return "KPI Missing";
  if (record.managerApproved && !record.hrApproved) return "Ready for HR";
  return "Manager Action";
}

function statusClass(status: GovernanceStatus): string {
  if (status === "Approved") return "badge badge-success";
  if (status === "Ready for HR") return "badge badge-info";
  if (status === "KPI Missing") return "badge badge-danger";
  if (status === "Manager Action") return "badge badge-warn";
  return "badge badge-neutral";
}

function formatMoney(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export default function OvertimeGovernancePage() {
  const { companyId } = useAppScope();
  const today = todayLocalIsoDate();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<AttendanceReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setReport(await attendanceApi.getReport(companyId, { from, to }));
    } catch (e) {
      setError(getApiError(e, "Failed to load overtime governance data."));
    } finally {
      setLoading(false);
    }
  }, [companyId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const overtimeRecords = useMemo(
    () => (report?.records ?? []).filter(hasOvertime),
    [report]
  );

  const metrics = useMemo(() => {
    const totalHours = overtimeRecords.reduce((sum, record) => sum + overtimeHours(record), 0);
    const totalCost = overtimeRecords.reduce((sum, record) => sum + (record.overtimeLaborCost ?? 0), 0);
    const pendingManager = overtimeRecords.filter((record) => governanceStatus(record) === "Manager Action").length;
    const missingKpi = overtimeRecords.filter((record) => governanceStatus(record) === "KPI Missing").length;
    const approved = overtimeRecords.filter((record) => governanceStatus(record) === "Approved").length;
    const readyForHr = overtimeRecords.filter((record) => governanceStatus(record) === "Ready for HR").length;

    return { totalHours, totalCost, pendingManager, missingKpi, approved, readyForHr };
  }, [overtimeRecords]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Workforce Management | Overtime Governance</div>
          <div className="page-title">Overtime Approval & ROI</div>
          <div className="page-sub">
            Overtime must have business justification, manager approval, measurable output, HR validation, and payroll readiness.
          </div>
        </div>
        <button className="btn" onClick={load} disabled={loading || !companyId}>
          <i className="ti ti-refresh" /> {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Overtime Records</div>
          <div className="kpi-val">{overtimeRecords.length}</div>
          <div className="kpi-sub">work above {STANDARD_SHIFT_HOURS} hours</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Overtime Hours</div>
          <div className="kpi-val" style={{ color: metrics.totalHours > 0 ? "var(--warn)" : "var(--success)" }}>
            {fmtNumber(metrics.totalHours)}
          </div>
          <div className="kpi-sub">total in selected period</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Manager Queue</div>
          <div className="kpi-val" style={{ color: metrics.pendingManager + metrics.missingKpi > 0 ? "var(--danger)" : "var(--success)" }}>
            {metrics.pendingManager + metrics.missingKpi}
          </div>
          <div className="kpi-sub">{metrics.missingKpi} missing KPI</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Ready for HR</div>
          <div className="kpi-val">{metrics.readyForHr}</div>
          <div className="kpi-sub">manager validated</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Labor Cost</div>
          <div className="kpi-val">{formatMoney(metrics.totalCost)}</div>
          <div className="kpi-sub">reported overtime cost</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div>
            <div className="kpi-label">Approval rule</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Work above 8 hours cannot flow to payroll until KPI justification and manager approval exist.
            </div>
          </div>
          <div>
            <div className="kpi-label">Outcome rule</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Actual deliverables and effectiveness rating explain whether overtime was necessary, useful, avoidable, or wasteful.
            </div>
          </div>
          <div>
            <div className="kpi-label">Payroll rule</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              HR validates approved overtime before payroll processes overtime pay.
            </div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          From
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} style={{ height: 32, padding: "0 8px", fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          To
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} style={{ height: 32, padding: "0 8px", fontSize: 13 }} />
        </label>
        <button className="btn" onClick={load} disabled={loading}>
          Apply
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Time</th>
              <th style={{ textAlign: "right" }}>Hours</th>
              <th>Category</th>
              <th>Business Reason</th>
              <th>Expected / Actual Output</th>
              <th>Approvals</th>
              <th>Effectiveness</th>
              <th style={{ textAlign: "right" }}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>Loading...</td></tr>
            ) : overtimeRecords.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>No overtime records for this period.</td></tr>
            ) : overtimeRecords.map((record, index) => {
              const status = governanceStatus(record);
              return (
                <tr key={`${record.employeeId}-${record.date}-${index}`}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>
                    {record.employeeName}
                    <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>
                      {record.overtimeCostCenter ?? "No cost center"}
                    </div>
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{fmtDate(record.date)}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {fmtTime(record.clockIn)} - {fmtTime(record.clockOut)}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                    {fmtNumber(overtimeHours(record))}
                  </td>
                  <td>{record.overtimeCategory ?? "Unclassified"}</td>
                  <td style={{ maxWidth: 220, color: record.overtimeBusinessJustification ? "inherit" : "var(--danger)" }}>
                    {record.overtimeBusinessJustification ?? "Business justification required"}
                  </td>
                  <td style={{ maxWidth: 260 }}>
                    <div><strong>Expected:</strong> {record.overtimeExpectedOutput ?? "Required"}</div>
                    <div style={{ color: "var(--text-muted)", marginTop: 3 }}>
                      <strong>Actual:</strong> {record.overtimeActualOutput ?? "Pending employee summary"}
                    </div>
                  </td>
                  <td>
                    <span className={statusClass(status)}>{status}</span>
                    <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>
                      Manager: {record.managerApproved ? "Approved" : "Pending"} | HR: {record.hrApproved ? "Approved" : "Pending"}
                    </div>
                  </td>
                  <td>{record.overtimeEffectiveness ?? (record.overtimeEffectivenessRating ? `${record.overtimeEffectivenessRating}/5` : "Not rated")}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>{formatMoney(record.overtimeLaborCost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
