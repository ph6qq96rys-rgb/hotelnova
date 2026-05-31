// src/features/hr/pages/training/TrainingProgramDetailPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { trainingApi } from '../../api/hrApi';
import type { TrainingProgramDto, TrainingComplianceDto } from '../../types/index';
import { getApiError } from '../../utils/hrUtils';

// =============================================================================
// Sub-components
// =============================================================================

function Field({ label, value }: { label: string; value?: string | number | null | boolean }) {
  const display = typeof value === 'boolean'
    ? (value ? 'Yes' : 'No')
    : value ?? '—';
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{display as string}</div>
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function TrainingProgramDetailPage() {
  const nav             = useNavigate();
  const { programId }   = useParams<{ programId: string }>();
  const { companyId, userId } = useAppScope();

  const [program,    setProgram]    = useState<TrainingProgramDto | null>(null);
  const [compliance, setCompliance] = useState<TrainingComplianceDto[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [tab,        setTab]        = useState<'details' | 'compliance'>('details');

  // Schedule session modal state
  const [showSchedule,  setShowSchedule]  = useState(false);
  const [sessionDate,   setSessionDate]   = useState('');
  const [sessionVenue,  setSessionVenue]  = useState('');
  const [maxEnrollees,  setMaxEnrollees]  = useState<number | ''>(20);
  const [scheduling,    setScheduling]    = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !programId) return;
    setLoading(true); setError(null);
    try {
      const [programs, comp] = await Promise.all([
        trainingApi.listPrograms(companyId),
        trainingApi.getComplianceReport(companyId, { programId }),
      ]);
      setProgram(programs.find(p => p.id === programId) ?? null);
      setCompliance(comp);
    } catch (e) {
      setError(getApiError(e, 'Failed to load program.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, programId]);

  useEffect(() => { load(); }, [load]);

  async function handleScheduleSession() {
    if (!companyId || !programId || !sessionDate) {
      setScheduleError('Session date is required.');
      return;
    }
    setScheduling(true); setScheduleError(null);
    try {
      await trainingApi.scheduleSession(companyId, {
        ProgramId:    programId,
        ScheduledDate: sessionDate,
        Venue:        sessionVenue || null,
        MaxEnrollees: maxEnrollees === '' ? null : Number(maxEnrollees),
        CreatedBy:    userId,
      });
      setShowSchedule(false);
      setSessionDate(''); setSessionVenue(''); setMaxEnrollees(20);
      await load();
    } catch (e) {
      setScheduleError(getApiError(e, 'Failed to schedule session.'));
    } finally {
      setScheduling(false);
    }
  }

  if (loading && !program) {
    return <div className="page"><div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div></div>;
  }
  if (error && !program) {
    return (
      <div className="page">
        <div className="alert alert-danger">{error}</div>
        <button className="btn" onClick={() => nav('/hr/training')}>← Back</button>
      </div>
    );
  }
  if (!program) return null;

  const avgCompliance = compliance.length > 0
    ? compliance.reduce((s, c) => s + c.compliancePercent, 0) / compliance.length
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Training</div>
          <div className="page-title">{program.title}</div>
          <div className="page-sub">
            {program.code} · {program.category} · {program.mode}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {program.isMandatory && (
            <span className="badge badge-danger">Mandatory</span>
          )}
          <button className="btn btn-primary" onClick={() => setShowSchedule(true)}>
            + Schedule Session
          </button>
          <button className="btn" onClick={() => nav('/hr/training')}>← Back</button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Duration</div>
          <div className="kpi-val">{program.durationHours}h</div>
          <div className="kpi-sub">per session</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Upcoming Sessions</div>
          <div className="kpi-val" style={{ color: program.upcomingSessions > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
            {program.upcomingSessions}
          </div>
          <div className="kpi-sub">scheduled</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Avg Compliance</div>
          <div className="kpi-val" style={{
            color: avgCompliance == null ? 'var(--text-muted)'
              : avgCompliance >= 100 ? 'var(--success)'
              : avgCompliance >= 60  ? 'var(--warn)'
              : 'var(--danger)',
          }}>
            {avgCompliance != null ? `${avgCompliance.toFixed(0)}%` : '—'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Cost</div>
          <div className="kpi-val" style={{ fontSize: 15 }}>
            {program.cost != null ? `ETB ${program.cost.toLocaleString()}` : 'Free'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="toolbar" style={{ marginBottom: 0 }}>
        {(['details', 'compliance'] as const).map(t => (
          <button key={t} className={`btn${tab === t ? ' btn-primary' : ''}`}
            onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === 'details' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
          }}>
            Program Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, marginBottom: 20 }}>
            <Field label="Code"         value={program.code} />
            <Field label="Category"     value={program.category} />
            <Field label="Mode"         value={program.mode} />
            <Field label="Duration"     value={`${program.durationHours} hours`} />
            <Field label="Provider"     value={program.provider} />
            <Field label="Cost"         value={program.cost != null ? `ETB ${program.cost.toLocaleString()}` : 'Free'} />
            <Field label="Mandatory"    value={program.isMandatory} />
            <Field label="Sessions Due" value={program.upcomingSessions} />
          </div>
        </div>
      )}

      {/* Compliance tab */}
      {tab === 'compliance' && (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th style={{ textAlign: 'right' }}>Required</th>
                <th style={{ textAlign: 'right' }}>Completed</th>
                <th style={{ minWidth: 140 }}>Compliance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : compliance.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>
                  No compliance data for this program.
                </td></tr>
              ) : compliance.map(c => (
                <tr key={c.employeeId}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{c.employeeName}</td>
                  <td style={{ fontSize: 13 }}>{c.departmentName}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{c.mandatoryRequired}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{c.mandatoryCompleted}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          background: c.compliancePercent >= 100 ? 'var(--success)'
                            : c.compliancePercent >= 60  ? 'var(--warn)'
                            : 'var(--danger)',
                          width: `${Math.min(c.compliancePercent, 100)}%`,
                        }} />
                      </div>
                      <span style={{
                        fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600, minWidth: 36,
                        color: c.compliancePercent >= 100 ? 'var(--success)'
                          : c.compliancePercent >= 60  ? 'var(--warn)'
                          : 'var(--danger)',
                      }}>
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

      {/* Schedule session modal */}
      {showSchedule && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="card" style={{ width: 420, margin: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Schedule Session</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {program.title}
            </div>

            {scheduleError && (
              <div className="alert alert-danger" style={{ marginBottom: 12 }}>{scheduleError}</div>
            )}

            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Session Date & Time <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="datetime-local"
              className="input"
              value={sessionDate}
              onChange={e => setSessionDate(e.target.value)}
              style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px', marginBottom: 12 }}
            />

            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Venue / Location
            </label>
            <input
              type="text"
              className="input"
              value={sessionVenue}
              onChange={e => setSessionVenue(e.target.value)}
              placeholder="Room name, address, or online link"
              style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px', marginBottom: 12 }}
            />

            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Max Enrollees
            </label>
            <input
              type="number"
              className="input"
              value={maxEnrollees}
              onChange={e => setMaxEnrollees(e.target.value === '' ? '' : Number(e.target.value))}
              min={1}
              style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px', marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-primary"
                onClick={handleScheduleSession}
                disabled={scheduling || !sessionDate}>
                {scheduling ? 'Scheduling...' : 'Schedule'}
              </button>
              <button className="btn" onClick={() => setShowSchedule(false)} disabled={scheduling}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}