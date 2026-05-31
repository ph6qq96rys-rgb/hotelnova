
import { useNavigate } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { useCallback, useEffect, useState } from 'react';
import { performanceApi } from '../../api/hrApi';
import type { PerformanceCycleDto } from '../../types/index';
import { CYCLE_STATUS_CLASS, fmtDate, getApiError } from '../../utils/hrUtils';

export default function PerformancePage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();
  const [cycles,  setCycles]  = useState<PerformanceCycleDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true); setError(null);
    try { setCycles(await performanceApi.listCycles(companyId)); }
    catch (e) { setError(getApiError(e, 'Failed to load cycles.')); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources</div>
          <div className="page-title">Performance</div>
          <div className="page-sub">Review cycles, goals and competencies</div>
        </div>
        <button className="btn btn-primary" onClick={() => nav('/hr/performance/cycles/new')}>
          + New Cycle
        </button>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <div className="kpi"><div className="kpi-label">Active Cycles</div>
          <div className="kpi-val">{cycles.filter(c => c.status === 'Active').length}</div></div>
        <div className="kpi"><div className="kpi-label">Total Reviews</div>
          <div className="kpi-val">{cycles.reduce((s,c) => s + c.totalReviews, 0)}</div></div>
        <div className="kpi"><div className="kpi-label">Completed</div>
          <div className="kpi-val">{cycles.reduce((s,c) => s + c.completedReviews, 0)}</div></div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Cycle Name</th>
              <th>Type</th>
              <th>Period</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Reviews</th>
              <th style={{ textAlign: 'right' }}>Completed</th>
              <th style={{ textAlign: 'right' }}>Progress</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
            ) : cycles.map(c => {
              const pct = c.totalReviews > 0 ? c.completedReviews / c.totalReviews * 100 : 0;
              return (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/hr/performance/cycles/${c.id}`)}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.type}</td>
                  <td style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                    {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                  </td>
                  <td><span className={CYCLE_STATUS_CLASS[c.status]}>{c.status}</span></td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{c.totalReviews}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{c.completedReviews}</td>
                  <td style={{ textAlign: 'right', minWidth: 120 }}>
                    <div style={{ fontSize: 11, marginBottom: 3, color: 'var(--text-muted)' }}>
                      {pct.toFixed(0)}%
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                      <div style={{ height: '100%', borderRadius: 2, background: pct >= 100 ? 'var(--success)' : 'var(--accent)', width: `${pct}%` }} />
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm">Open →</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}