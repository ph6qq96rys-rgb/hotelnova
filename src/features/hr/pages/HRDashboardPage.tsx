// src/features/hr/pages/HRDashboardPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppScope } from '../../../app/useAppScope';
import { hrDashboardApi } from '../api/hrApi';
import type { HRDashboardDto } from '../types/index';
import { fmtPercent, getApiError } from '../utils/hrUtils';

export default function HRDashboardPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();
  const [data,    setData]    = useState<HRDashboardDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true); setError(null);
    try { setData(await hrDashboardApi.get(companyId, branchId)); }
    catch (e) { setError(getApiError(e, 'Failed to load HR dashboard.')); }
    finally { setLoading(false); }
  }, [companyId, branchId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources</div>
          <div className="page-title">HR Dashboard</div>
          <div className="page-sub">Workforce overview and key metrics</div>
        </div>
        <button className="btn" onClick={load} disabled={loading}>
          <i className="ti ti-refresh" /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {data && (
        <>
          {/* KPI Strip */}
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 20 }}>
            <div className="kpi">
              <div className="kpi-label">Total Employees</div>
              <div className="kpi-val">{data.totalEmployees}</div>
              <div className="kpi-sub">{data.activeEmployees} active</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">New Hires</div>
              <div className="kpi-val" style={{ color: 'var(--success)' }}>
                +{data.newHiresThisMonth}
              </div>
              <div className="kpi-sub">this month</div>
              {data.terminationsThisMonth > 0 && (
                <div className="kpi-badge badge-danger">
                  {data.terminationsThisMonth} terminations
                </div>
              )}
            </div>
            <div className="kpi">
              <div className="kpi-label">Attendance</div>
              <div className="kpi-val" style={{
                color: data.averageAttendancePercent >= 90
                  ? 'var(--success)'
                  : data.averageAttendancePercent >= 75
                  ? 'var(--warn)' : 'var(--danger)',
              }}>
                {fmtPercent(data.averageAttendancePercent)}
              </div>
              <div className="kpi-sub">today's rate</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Pending Actions</div>
              <div className="kpi-val">{data.pendingLeaveRequests + data.pendingOvertimeRequests}</div>
              <div className="kpi-sub">leave & overtime</div>
              {data.pendingLeaveRequests > 0 && (
                <div className="kpi-badge badge-warn">
                  {data.pendingLeaveRequests} leave requests
                </div>
              )}
            </div>
            <div className="kpi">
              <div className="kpi-label">Open Positions</div>
              <div className="kpi-val">{data.openPositions}</div>
              <div className="kpi-sub">active vacancies</div>
              {data.upcomingReviews > 0 && (
                <div className="kpi-badge badge-warn">
                  {data.upcomingReviews} reviews due
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Headcount by Department */}
            <div className="card">
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                Headcount by Department
              </div>
              {data.headcountByDept.map(d => (
                <div key={d.departmentName} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 13, marginBottom: 4 }}>
                    <span>{d.departmentName}</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>
                      {d.count}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: 'var(--accent)',
                      width: `${(d.count / data.totalEmployees) * 100}%`,
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Navigation */}
            <div className="card">
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                Quick Access
              </div>
              {[
                { label: 'Employees',   sub: `${data.activeEmployees} active`,        path: '/hr/employees',   icon: 'ti-users' },
                { label: 'Leave',       sub: `${data.pendingLeaveRequests} pending`,   path: '/hr/leave',       icon: 'ti-calendar-off' },
                { label: 'Attendance',  sub: `${fmtPercent(data.averageAttendancePercent)} today`, path: '/hr/attendance', icon: 'ti-clock' },
                { label: 'Payroll',     sub: 'Process & approve',                      path: '/hr/payroll',     icon: 'ti-credit-card' },
                { label: 'Recruitment', sub: `${data.openPositions} open positions`,   path: '/hr/recruitment', icon: 'ti-briefcase' },
                { label: 'Performance', sub: `${data.upcomingReviews} reviews due`,    path: '/hr/performance', icon: 'ti-star' },
                { label: 'Training',    sub: `${data.trainingsDue} due soon`,          path: '/hr/training',    icon: 'ti-school' },
              ].map(item => (
                <div key={item.path}
                  onClick={() => nav(item.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                >
                  <i className={`ti ${item.icon}`}
                    style={{ fontSize: 18, color: 'var(--accent)', width: 24, textAlign: 'center' }} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.sub}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-soft)' }}>→</span>
                </div>
              ))}
            </div>
          </div>

          {/* On Leave Today */}
          {data.leaveStatusSummary.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                On Leave Today
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {data.leaveStatusSummary.map(l => (
                  <div key={l.leaveType} style={{ padding: '6px 14px',
                    background: 'var(--surface-2)', borderRadius: 8,
                    border: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{l.onLeaveToday}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{l.leaveType}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
