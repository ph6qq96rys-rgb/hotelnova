import { trainingApi } from '../../api/hrApi';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { getApiError } from '../../utils/hrUtils';
import type { TrainingProgramDto, TrainingComplianceDto } from '../../types/index';

export default function TrainingPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();
  const [programs,    setPrograms]    = useState<TrainingProgramDto[]>([]);
  const [compliance,  setCompliance]  = useState<TrainingComplianceDto[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [tab,         setTab]         = useState<'programs' | 'compliance'>('programs');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true); setError(null);
    try {
      const [p, c] = await Promise.all([
        trainingApi.listPrograms(companyId),
        trainingApi.getComplianceReport(companyId),
      ]);
      setPrograms(p); setCompliance(c);
    } catch (e) { setError(getApiError(e, 'Failed to load training data.')); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources</div>
          <div className="page-title">Training</div>
          <div className="page-sub">Programs, sessions and compliance tracking</div>
        </div>
        <button className="btn btn-primary" onClick={() => nav('/hr/training/programs/new')}>
          + New Program
        </button>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div className="kpi"><div className="kpi-label">Programs</div>
          <div className="kpi-val">{programs.length}</div></div>
        <div className="kpi"><div className="kpi-label">Mandatory</div>
          <div className="kpi-val">{programs.filter(p => p.isMandatory).length}</div></div>
        <div className="kpi"><div className="kpi-label">Avg Compliance</div>
          <div className="kpi-val">
            {compliance.length > 0
              ? (compliance.reduce((s,c) => s + c.compliancePercent, 0) / compliance.length).toFixed(0)
              : 0}%
          </div></div>
        <div className="kpi"><div className="kpi-label">Upcoming Sessions</div>
          <div className="kpi-val">{programs.reduce((s,p) => s + p.upcomingSessions, 0)}</div></div>
      </div>

      <div className="toolbar" style={{ marginBottom: 0 }}>
        {(['programs','compliance'] as const).map(t => (
          <button key={t} className={`btn${tab === t ? ' btn-primary' : ''}`}
            onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {tab === 'programs' && (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Code</th><th>Title</th><th>Category</th><th>Mode</th>
                <th style={{ textAlign: 'right' }}>Hours</th>
                <th style={{ textAlign: 'right' }}>Sessions</th>
                <th>Mandatory</th><th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
              ) : programs.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/hr/training/programs/${p.id}`)}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>{p.code}</td>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>
                    {p.title}
                    {p.provider && <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{p.provider}</div>}
                  </td>
                  <td style={{ fontSize: 12 }}>{p.category}</td>
                  <td style={{ fontSize: 12 }}>{p.mode}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{p.durationHours}h</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{p.upcomingSessions}</td>
                  <td>{p.isMandatory ? <span className="badge badge-danger">Required</span> : <span className="badge badge-neutral">Optional</span>}</td>
                  <td style={{ textAlign: 'right' }}><button className="btn btn-sm">Open →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'compliance' && (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th><th>Department</th>
                <th style={{ textAlign: 'right' }}>Required</th>
                <th style={{ textAlign: 'right' }}>Completed</th>
                <th style={{ textAlign: 'right' }}>Compliance</th>
              </tr>
            </thead>
            <tbody>
              {compliance.map(c => (
                <tr key={c.employeeId}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{c.employeeName}</td>
                  <td style={{ fontSize: 13 }}>{c.departmentName}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{c.mandatoryRequired}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{c.mandatoryCompleted}</td>
                  <td style={{ textAlign: 'right', minWidth: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }}>
                        <div style={{ height: '100%', borderRadius: 3,
                          background: c.compliancePercent >= 100 ? 'var(--success)'
                            : c.compliancePercent >= 60 ? 'var(--warn)' : 'var(--danger)',
                          width: `${Math.min(c.compliancePercent, 100)}%`,
                        }} />
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600, width: 40, textAlign: 'right',
                        color: c.compliancePercent >= 100 ? 'var(--success)' : c.compliancePercent >= 60 ? 'var(--warn)' : 'var(--danger)' }}>
                        {c.compliancePercent.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
