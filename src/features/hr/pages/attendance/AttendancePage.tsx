import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { attendanceApi } from "../../api/hrApi";
import type { AttendanceRecordDto, AttendanceReportDto } from "../../types/index";
import { ATTENDANCE_STATUS_CLASS, fmtDate, fmtNumber, fmtTimeInTimeZone, getApiError, todayLocalIsoDate } from "../../utils/hrUtils";

const STANDARD_SHIFT_HOURS = 8;
const ATTENDANCE_TIME_ZONE = "Africa/Addis_Ababa";

function recordNeedsOvertimeApproval(record: AttendanceRecordDto): boolean {
  const workedHours = record.workedHours ?? 0;
  const overtimeHours = record.overtimeHours ?? Math.max(0, workedHours - STANDARD_SHIFT_HOURS);
  const approvalRequired = record.approvalRequired ?? (overtimeHours > 0 || workedHours > STANDARD_SHIFT_HOURS);
  return approvalRequired && record.overtimeStatus !== "Approved" && record.overtimeStatus !== "Processed";
}

function approvalLabel(record: AttendanceRecordDto): string {
  if (!recordNeedsOvertimeApproval(record)) {
    return record.overtimeStatus === "Approved" || record.overtimeStatus === "Processed"
      ? "Approved"
      : "Not required";
  }

  if (record.overtimeBusinessJustification && record.overtimeExpectedOutput) {
    return "Manager approval required";
  }

  return "KPI required";
}

function approvalClass(record: AttendanceRecordDto): string {
  if (recordNeedsOvertimeApproval(record)) return "badge badge-warn";
  if (record.overtimeStatus === "Approved" || record.overtimeStatus === "Processed") return "badge badge-success";
  return "badge badge-neutral";
}

function isMissingPunch(record: AttendanceRecordDto): boolean {
  return record.status === "MissingPunch" || Boolean(record.clockIn && !record.clockOut);
}

export default function AttendancePage() {
  const { companyId } = useAppScope();
  const [report, setReport] = useState<AttendanceReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayLocalIsoDate();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setReport(await attendanceApi.getReport(companyId, { from, to }));
    } catch (e) {
      setError(getApiError(e, "Failed to load attendance."));
    } finally {
      setLoading(false);
    }
  }, [companyId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const records = report?.records ?? [];

  const workforceStats = useMemo(() => {
    const overtimeRecords = records.filter((record) => (record.overtimeHours ?? 0) > 0 || (record.workedHours ?? 0) > STANDARD_SHIFT_HOURS);
    const approvalRequired = records.filter(recordNeedsOvertimeApproval);
    const missingPunches = records.filter(isMissingPunch);
    const lateOrEarly = records.filter((record) => (record.lateMinutes ?? 0) > 0 || record.status === "EarlyDeparture");
    const totalOvertimeHours = overtimeRecords.reduce((sum, record) => {
      const inferred = Math.max(0, (record.workedHours ?? 0) - STANDARD_SHIFT_HOURS);
      return sum + (record.overtimeHours ?? inferred);
    }, 0);
    const payrollBlocked = approvalRequired.length + missingPunches.length;

    return {
      overtimeRecords,
      approvalRequired,
      missingPunches,
      lateOrEarly,
      totalOvertimeHours,
      payrollBlocked,
    };
  }, [records]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Workforce Management | Attendance Control</div>
          <div className="page-title">Attendance Command Center</div>
          <div className="page-sub">
            Attendance is the payroll source of truth. Resolve missing punches, late exceptions, and overtime approvals before payroll processing.
          </div>
          <div className="page-sub" style={{ marginTop: 4 }}>
            Times shown in Addis Ababa local time.
          </div>
        </div>
      </div>

      {report && (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 20 }}>
            <div className="kpi">
              <div className="kpi-label">Present</div>
              <div className="kpi-val" style={{ color: "var(--success)" }}>{report.presentToday}</div>
              <div className="kpi-sub">of {report.totalEmployees} employees</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Absent</div>
              <div className="kpi-val" style={{ color: "var(--danger)" }}>{report.absentToday}</div>
              <div className="kpi-sub">requires review</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Attendance Rate</div>
              <div className="kpi-val">{report.averageAttendancePercent.toFixed(1)}%</div>
              <div className="kpi-sub">{report.onLeave} on leave</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Overtime Hours</div>
              <div className="kpi-val" style={{ color: workforceStats.totalOvertimeHours > 0 ? "var(--warn)" : "var(--success)" }}>
                {fmtNumber(workforceStats.totalOvertimeHours)}
              </div>
              <div className="kpi-sub">{workforceStats.approvalRequired.length} approval required</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Payroll Readiness</div>
              <div className="kpi-val" style={{ color: workforceStats.payrollBlocked > 0 ? "var(--danger)" : "var(--success)" }}>
                {workforceStats.payrollBlocked > 0 ? "Blocked" : "Ready"}
              </div>
              <div className="kpi-sub">{workforceStats.payrollBlocked} unresolved exceptions</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div>
                <div className="kpi-label">Manager action queue</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  {workforceStats.approvalRequired.length} overtime records need manager approval with KPI/business output attached.
                </div>
              </div>
              <div>
                <div className="kpi-label">Payroll control</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Missing punches and unapproved overtime should be resolved before payroll generation.
                </div>
              </div>
              <div>
                <div className="kpi-label">Compliance watch</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  {workforceStats.lateOrEarly.length} late or early-departure records require policy validation.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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
          <i className="ti ti-refresh" /> {loading ? "Loading..." : "Apply"}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th style={{ textAlign: "right" }}>Worked Hrs</th>
              <th style={{ textAlign: "right" }}>Overtime</th>
              <th>Overtime Approval</th>
              <th>KPI / Output</th>
              <th style={{ textAlign: "right" }}>Late (min)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>Loading...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>No attendance records for this period.</td></tr>
            ) : records.map((record, index) => {
              const overtimeHours = record.overtimeHours ?? Math.max(0, (record.workedHours ?? 0) - STANDARD_SHIFT_HOURS);
              const hasKpi = Boolean(record.overtimeExpectedOutput || record.overtimeActualOutput || record.overtimeBusinessJustification);
              const statusClass = ATTENDANCE_STATUS_CLASS[record.status] ?? "badge badge-neutral";

              return (
                <tr key={`${record.employeeId}-${record.date}-${index}`}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>
                    {record.employeeName}
                    {record.geofenceVerified === false && (
                      <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 2 }}>Geofence failed</div>
                    )}
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-muted)" }}>{fmtDate(record.date)}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{fmtTimeInTimeZone(record.clockIn, ATTENDANCE_TIME_ZONE)}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{fmtTimeInTimeZone(record.clockOut, ATTENDANCE_TIME_ZONE)}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                    {record.workedHours ? fmtNumber(record.workedHours) : "-"}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12, color: overtimeHours > 0 ? "var(--warn)" : undefined }}>
                    {overtimeHours > 0 ? fmtNumber(overtimeHours) : "-"}
                  </td>
                  <td><span className={approvalClass(record)}>{approvalLabel(record)}</span></td>
                  <td style={{ maxWidth: 260, fontSize: 12, color: !hasKpi && recordNeedsOvertimeApproval(record) ? "var(--danger)" : "var(--text-muted)" }}>
                    {hasKpi ? (
                      <>
                        <div><strong>Reason:</strong> {record.overtimeBusinessJustification ?? "Required"}</div>
                        <div><strong>Expected:</strong> {record.overtimeExpectedOutput ?? "Required"}</div>
                        <div><strong>Actual:</strong> {record.overtimeActualOutput ?? "Pending employee summary"}</div>
                      </>
                    ) : (
                      "Not attached"
                    )}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12, color: (record.lateMinutes ?? 0) > 0 ? "var(--danger)" : undefined }}>
                    {record.lateMinutes ? fmtNumber(record.lateMinutes, 0) : "-"}
                  </td>
                  <td><span className={statusClass}>{record.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
