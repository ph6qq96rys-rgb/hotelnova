import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { leaveApi } from '../../api/hrApi';
import type { LeaveRequestDto, LeaveRequestStatus } from '../../types';
import { LEAVE_STATUS_CLASS, fmtDate, getApiError } from '../../utils/hrUtils';

const STATUS_OPTIONS: LeaveRequestStatus[] = ['Pending', 'Approved', 'Rejected', 'Cancelled', 'Taken'];

export default function LeaveListPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();
  const [items,   setItems]   = useState<LeaveRequestDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [status,  setStatus]  = useState('Pending');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true); setError(null);
    try {
      setItems(await leaveApi.listRequests(companyId, {
        status: status as LeaveRequestStatus || undefined,
        year: new Date().getFullYear(),
      }));
    } catch (e) { setError(getApiError(e, 'Failed to load leave requests.')); }
    finally { setLoading(false); }
  }, [companyId, status]);

  useEffect(() => { load(); }, [load]);

  async function approve(id: string) {
    if (!companyId) return;
    setWorking(id);
    try { await leaveApi.approve(companyId, id, 'MANAGER'); await load(); }
    catch (e) { setError(getApiError(e, 'Approval failed.')); }
    finally { setWorking(null); }
  }

  async function reject(id: string) {
    if (!companyId) return;
    const reason = window.prompt('Rejection reason?');
    if (!reason) return;
    setWorking(id);
    try { await leaveApi.reject(companyId, id, 'MANAGER', reason); await load(); }
    catch (e) { setError(getApiError(e, 'Rejection failed.')); }
    finally { setWorking(null); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources</div>
          <div className="page-title">Leave Requests</div>
          <div className="page-sub">Review and approve employee leave</div>
        </div>
        <button className="btn btn-primary" onClick={() => nav('/hr/leave/new')}>
          + New Request
        </button>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        {STATUS_OPTIONS.map(s => (
          <div className="kpi" key={s} style={{ cursor: 'pointer' }} onClick={() => setStatus(s)}>
            <div className="kpi-label">{s}</div>
            <div className="kpi-val">{items.filter(i => i.status === s).length}</div>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Status
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}
            style={{ width: 140, height: 32, fontSize: 13, padding: '0 8px' }}>
            <option value="">All</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button className="btn" onClick={load} disabled={loading}>
          <i className="ti ti-refresh" /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Request #</th>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>Period</th>
              <th style={{ textAlign: 'right' }}>Days</th>
              <th>Status</th>
              <th>Reason</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
            ) : items.map(r => (
              <tr key={r.id}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>{r.requestNo}</td>
                <td style={{ fontWeight: 500, fontSize: 13 }}>{r.employeeName}</td>
                <td style={{ fontSize: 13 }}>{r.leaveTypeName}</td>
                <td style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                  {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 500 }}>
                  {r.numberOfDays}
                </td>
                <td><span className={LEAVE_STATUS_CLASS[r.status]}>{r.status}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text-soft)', maxWidth: 180,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={r.reason}>{r.reason}</td>
                <td style={{ textAlign: 'right' }}>
                  {r.status === 'Pending' && (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm" disabled={working === r.id}
                        style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                        onClick={() => approve(r.id)}>Approve</button>
                      <button className="btn btn-sm" disabled={working === r.id}
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        onClick={() => reject(r.id)}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}