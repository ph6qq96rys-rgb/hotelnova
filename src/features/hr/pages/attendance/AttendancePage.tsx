import { useCallback, useEffect, useState } from 'react';
import { attendanceApi } from '../../api/hrApi';
import type { AttendanceReportDto } from '../../types/index';
import { ATTENDANCE_STATUS_CLASS, fmtDate, fmtTime, fmtNumber, getApiError } from '../../utils/hrUtils';
import { useAppScope } from '../../../../app/useAppScope';

export default function AttendancePage() {
  const { companyId } = useAppScope();
  const [report,  setReport]  = useState<AttendanceReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to,   setTo]   = useState(today);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true); setError(null);
    try { setReport(await attendanceApi.getReport(companyId, { from, to })); }
    catch (e) { setError(getApiError(e, 'Failed to load attendance.')); }
    finally { setLoading(false); }
  }, [companyId, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources</div>
          <div className="page-title">Attendance</div>
          <div className="page-sub">Daily clock-in/out and attendance records</div>
        </div>
      </div>

      {report && (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
          <div className="kpi">
            <div className="kpi-label">Present</div>
            <div className="kpi-val" style={{ color: 'var(--success)' }}>{report.presentToday}</div>
            <div className="kpi-sub">of {report.totalEmployees}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Absent</div>
            <div className="kpi-val" style={{ color: 'var(--danger)' }}>{report.absentToday}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">On Leave</div>
            <div className="kpi-val" style={{ color: 'var(--accent)' }}>{report.onLeave}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Avg Attendance</div>
            <div className="kpi-val">{report.averageAttendancePercent.toFixed(1)}%</div>
          </div>
        </div>
      )}

      <div className="toolbar">
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          From <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)}
            style={{ height: 32, padding: '0 8px', fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          To <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)}
            style={{ height: 32, padding: '0 8px', fontSize: 13 }} />
        </label>
        <button className="btn" onClick={load} disabled={loading}>
          <i className="ti ti-refresh" /> {loading ? 'Loading…' : 'Apply'}
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
              <th style={{ textAlign: 'right' }}>Worked Hrs</th>
              <th style={{ textAlign: 'right' }}>Overtime</th>
              <th style={{ textAlign: 'right' }}>Late (min)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
            ) : (report?.records ?? []).map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500, fontSize: 13 }}>{r.employeeName}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                  {fmtDate(r.date)}
                </td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtTime(r.clockIn)}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtTime(r.clockOut)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>
                  {r.workedHours ? fmtNumber(r.workedHours) : '—'}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12,
                  color: (r.overtimeHours ?? 0) > 0 ? 'var(--warn)' : undefined }}>
                  {r.overtimeHours ? fmtNumber(r.overtimeHours) : '—'}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12,
                  color: (r.lateMinutes ?? 0) > 0 ? 'var(--danger)' : undefined }}>
                  {r.lateMinutes ? fmtNumber(r.lateMinutes, 0) : '—'}
                </td>
                <td><span className={ATTENDANCE_STATUS_CLASS[r.status]}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}