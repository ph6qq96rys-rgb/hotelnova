// src/features/hr/pages/recruitment/JobPostingDetailPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { recruitmentApi } from '../../api/hrApi';
import type { JobPostingDto, JobApplicationDto, RecruitmentPipelineDto, ApplicationStatus } from '../../types/index';
import { JOB_STATUS_CLASS, getApiError, fmtDate } from '../../utils/hrUtils';

const PIPELINE_STAGES = ['New', 'Screening', 'Shortlisted', 'Interview', 'Offered', 'Hired', 'Rejected'] as const;
const STATUS_OPTIONS: ApplicationStatus[] = ['New', 'Screening', 'Shortlisted', 'Interview', 'Offered', 'Hired', 'Rejected'];

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value ?? '—'}</div>
    </div>
  );
}

export default function JobPostingDetailPage() {
  const nav             = useNavigate();
  const { postingId }   = useParams<{ postingId: string }>();
  const { companyId }   = useAppScope();

  const [posting,      setPosting]      = useState<JobPostingDto | null>(null);
  const [applications, setApplications] = useState<JobApplicationDto[]>([]);
  const [pipeline,     setPipeline]     = useState<RecruitmentPipelineDto | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('');

  const load = useCallback(async () => {
    if (!companyId || !postingId) return;
    setLoading(true); setError(null);
    try {
      const [apps, pipe] = await Promise.all([
        recruitmentApi.getApplications(companyId, postingId, statusFilter as ApplicationStatus || undefined),
        recruitmentApi.getPipeline(companyId, postingId),
      ]);
      setApplications(apps);
      setPipeline(pipe);
    } catch (e) {
      setError(getApiError(e, 'Failed to load posting.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, postingId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Load the posting summary separately — it comes from the list,
  // so we re-fetch by filtering the postings list for this id.
  useEffect(() => {
    if (!companyId || !postingId) return;
    recruitmentApi.listPostings(companyId)
      .then(list => setPosting(list.find(p => p.id === postingId) ?? null))
      .catch(() => {});
  }, [companyId, postingId]);

  if (loading && !posting) {
    return <div className="page"><div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Recruitment</div>
          <div className="page-title">{posting?.title ?? 'Job Posting'}</div>
          <div className="page-sub">
            {posting ? `${posting.postingNo} · ${posting.departmentName} · ${posting.employmentType}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {posting && <span className={JOB_STATUS_CLASS[posting.status]}>{posting.status}</span>}
          <button className="btn btn-primary" onClick={() => nav(`/hr/recruitment/new`)}>
            + New Posting
          </button>
          <button className="btn" onClick={() => nav('/hr/recruitment')}>← Back</button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Vacancies</div>
          <div className="kpi-val">{posting?.vacancyCount ?? '—'}</div>
          <div className="kpi-sub">open positions</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Applications</div>
          <div className="kpi-val">{posting?.applicationCount ?? applications.length}</div>
          <div className="kpi-sub">total received</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Closing Date</div>
          <div className="kpi-val" style={{ fontSize: 14 }}>
            {posting ? fmtDate(posting.closingDate) : '—'}
          </div>
          <div className="kpi-sub">
            {posting ? (() => {
              const days = Math.ceil((new Date(posting.closingDate).getTime() - Date.now()) / 86400000);
              return days > 0 ? `${days} days left` : 'Closed';
            })() : ''}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Hired</div>
          <div className="kpi-val" style={{ color: 'var(--success)' }}>
            {pipeline?.hired ?? 0}
          </div>
          <div className="kpi-sub">of {posting?.vacancyCount ?? '—'} vacancies</div>
        </div>
      </div>

      {/* Pipeline strip */}
      {pipeline && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
          }}>
            Pipeline
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {PIPELINE_STAGES.map(stage => (
              <div
                key={stage}
                onClick={() => setStatusFilter(stage as ApplicationStatus)}
                style={{
                  flex: 1, background: statusFilter === stage ? 'var(--accent)' : 'var(--surface-2)',
                  borderRadius: 8, padding: '10px 12px', textAlign: 'center',
                  border: `1px solid ${statusFilter === stage ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
              >
                <div style={{
                  fontSize: 11, textTransform: 'capitalize',
                  color: statusFilter === stage ? 'var(--accent-fg)' : 'var(--text-muted)',
                }}>
                  {stage}
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 700,
                  color: statusFilter === stage ? 'var(--accent-fg)' : 'var(--text)',
                }}>
                  {pipeline[stage as keyof RecruitmentPipelineDto] as number}
                </div>
              </div>
            ))}
          </div>
          {statusFilter && (
            <button
              className="btn btn-sm"
              onClick={() => setStatusFilter('')}
              style={{ marginTop: 10 }}
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Posting info */}
      {posting && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
          }}>
            Posting Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, marginBottom: 16 }}>
            <Field label="Posting #"       value={posting.postingNo} />
            <Field label="Department"      value={posting.departmentName} />
            <Field label="Employment Type" value={posting.employmentType} />
            <Field label="Closing Date"    value={fmtDate(posting.closingDate)} />
          </div>
        </div>
      )}

      {/* Applications table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Applications {statusFilter && `· ${statusFilter}`}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <select
              className="select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as ApplicationStatus | '')}
              style={{ height: 30, fontSize: 12, padding: '0 8px' }}
            >
              <option value="">All stages</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
            </select>
            <button className="btn btn-sm" onClick={load} disabled={loading}>
              <i className="ti ti-refresh" /> {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Application #</th>
              <th>Applicant</th>
              <th>Email</th>
              <th>Applied On</th>
              <th>Stage</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : applications.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 56, textAlign: 'center', color: 'var(--text-soft)' }}>
                No applications {statusFilter ? `in "${statusFilter}"` : 'yet'}.
              </td></tr>
            ) : applications.map(a => (
              <tr key={a.id} style={{ cursor: 'pointer' }}
                onClick={() => nav(`/hr/recruitment/${postingId}/applications/${a.id}`)}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                  {a.applicationNo}
                </td>
                <td style={{ fontWeight: 500, fontSize: 13 }}>{a.applicantName}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.applicantEmail}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                  {fmtDate(a.appliedOn)}
                </td>
                <td>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: 'var(--surface-2)', textTransform: 'capitalize',
                    border: '1px solid var(--border)',
                  }}>
                    {a.status}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-sm"
                    onClick={e => { e.stopPropagation(); nav(`/hr/recruitment/${postingId}/applications/${a.id}`); }}>
                    Open →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}