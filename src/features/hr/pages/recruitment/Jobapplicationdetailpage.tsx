// src/features/hr/pages/recruitment/JobApplicationDetailPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { recruitmentApi } from '../../api/hrApi';
import type { JobApplicationDto } from '../../types/index';
import { getApiError, fmtDate } from '../../utils/hrUtils';

// =============================================================================
// Types
// =============================================================================

type PipelineStage = 'New' | 'Screening' | 'Shortlisted' | 'Interview' | 'Offered' | 'Hired' | 'Rejected';

const STAGE_ORDER: PipelineStage[] = ['New', 'Screening', 'Shortlisted', 'Interview', 'Offered', 'Hired'];

const STAGE_COLORS: Record<PipelineStage, string> = {
  New:         'var(--text-muted)',
  Screening:   'var(--accent)',
  Shortlisted: 'var(--warn)',
  Interview:   'var(--accent)',
  Offered:     'var(--success)',
  Hired:       'var(--success)',
  Rejected:    'var(--danger)',
};

// =============================================================================
// Sub-components
// =============================================================================

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value ?? '—'}</div>
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function JobApplicationDetailPage() {
  const nav                 = useNavigate();
  const { postingId, applicationId } = useParams<{ postingId: string; applicationId: string }>();
  const { companyId, userId }        = useAppScope();

  const [application, setApplication] = useState<JobApplicationDto | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [working,     setWorking]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Interview scheduling modal state
  const [showInterview, setShowInterview] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');

  // Offer modal state
  const [showOffer,  setShowOffer]  = useState(false);
  const [offerSalary, setOfferSalary] = useState('');
  const [offerNotes,  setOfferNotes]  = useState('');

  const load = useCallback(async () => {
    if (!companyId || !postingId || !applicationId) return;
    setLoading(true); setError(null);
    try {
      // Applications come from the posting's application list —
      // fetch all and find the matching one.
      const apps = await recruitmentApi.getApplications(companyId, postingId);
      const found = apps.find(a => a.id === applicationId);
      if (!found) { setError('Application not found.'); return; }
      setApplication(found);
    } catch (e) {
      setError(getApiError(e, 'Failed to load application.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, postingId, applicationId]);

  useEffect(() => { load(); }, [load]);

  // Actions
  async function scheduleInterview() {
    if (!companyId || !interviewDate) return;
    setWorking(true); setError(null);
    try {
      await recruitmentApi.scheduleInterview(companyId, {
        ApplicationId: applicationId,
        PostingId:     postingId,
        InterviewDate: interviewDate,
        Notes:         interviewNotes,
        CreatedBy:     userId,
      });
      setShowInterview(false);
      setInterviewDate(''); setInterviewNotes('');
      await load();
    } catch (e) {
      setError(getApiError(e, 'Failed to schedule interview.'));
    } finally {
      setWorking(false);
    }
  }

  async function issueOffer() {
    if (!companyId || !offerSalary) return;
    setWorking(true); setError(null);
    try {
      await recruitmentApi.issueOffer(companyId, {
        ApplicationId:  applicationId,
        PostingId:      postingId,
        OfferedSalary:  Number(offerSalary),
        Notes:          offerNotes,
        CreatedBy:      userId,
      });
      setShowOffer(false);
      setOfferSalary(''); setOfferNotes('');
      await load();
    } catch (e) {
      setError(getApiError(e, 'Failed to issue offer.'));
    } finally {
      setWorking(false);
    }
  }

  // Loading / error states
  if (loading) {
    return <div className="page"><div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div></div>;
  }
  if (error && !application) {
    return (
      <div className="page">
        <div className="alert alert-danger">{error}</div>
        <button className="btn" onClick={() => nav(`/hr/recruitment/${postingId}`)}>← Back</button>
      </div>
    );
  }
  if (!application) return null;

  const stage = application.status as PipelineStage;
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const isRejected = stage === 'Rejected';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Recruitment · Applications</div>
          <div className="page-title">{application.applicantName}</div>
          <div className="page-sub">
            {application.applicationNo} · Applied {fmtDate(application.appliedOn)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 12, padding: '3px 10px', borderRadius: 20,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: STAGE_COLORS[stage], fontWeight: 600, textTransform: 'capitalize',
          }}>
            {stage}
          </span>
          <button className="btn" onClick={() => nav(`/hr/recruitment/${postingId}`)}>← Back</button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Pipeline progress bar */}
      {!isRejected && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
          }}>
            Progress
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {STAGE_ORDER.map((s, i) => {
              const done    = i <= stageIndex;
              const current = i === stageIndex;
              return (
                <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                    background: done ? 'var(--accent)' : 'var(--surface-2)',
                    color: done ? 'var(--accent-fg)' : 'var(--text-muted)',
                    border: current ? '2px solid var(--accent)' : '1px solid var(--border)',
                    zIndex: 1,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{
                    fontSize: 10, marginTop: 4, textTransform: 'capitalize',
                    color: done ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: current ? 600 : 400,
                  }}>
                    {s}
                  </div>
                  {/* Connector line */}
                  {i < STAGE_ORDER.length - 1 && (
                    <div style={{
                      position: 'absolute',
                      height: 2, background: i < stageIndex ? 'var(--accent)' : 'var(--border)',
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Applicant details */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
        }}>
          Applicant Information
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
          <Field label="Full Name"    value={application.applicantName} />
          <Field label="Email"        value={application.applicantEmail} />
          <Field label="Phone"        value={application.applicantPhone} />
          <Field label="Applied On"   value={fmtDate(application.appliedOn)} />
          <Field label="Current Stage" value={application.status} />
          <Field label="Application #" value={application.applicationNo} />
        </div>
      </div>

      {/* Actions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
        }}>
          Actions
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(stage === 'Screening' || stage === 'Shortlisted') && (
            <button className="btn btn-primary" onClick={() => setShowInterview(true)} disabled={working}>
              Schedule Interview
            </button>
          )}
          {stage === 'Interview' && (
            <button className="btn btn-primary" onClick={() => setShowOffer(true)} disabled={working}>
              Issue Offer
            </button>
          )}
          {!isRejected && stage !== 'Hired' && (
            <button
              className="btn"
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              disabled={working}
              onClick={async () => {
                if (!companyId) return;
                if (!window.confirm('Reject this application?')) return;
                setWorking(true);
                try {
                  // Move to rejected via an offer/interview with rejected status,
                  // or use the apply endpoint with status override — adjust to
                  // match your actual "reject application" API endpoint.
                  await recruitmentApi.apply(companyId, {
                    ApplicationId: applicationId,
                    Status:        'Rejected',
                    UpdatedBy:     userId,
                  });
                  await load();
                } catch (e) {
                  setError(getApiError(e, 'Failed to reject application.'));
                } finally {
                  setWorking(false);
                }
              }}
            >
              Reject
            </button>
          )}
        </div>
      </div>

      {/* Interview scheduling modal */}
      {showInterview && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="card" style={{ width: 420, margin: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Schedule Interview</div>

            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Interview Date & Time <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="datetime-local"
              className="input"
              value={interviewDate}
              onChange={e => setInterviewDate(e.target.value)}
              style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px', marginBottom: 12 }}
            />

            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Notes
            </label>
            <textarea
              className="input"
              value={interviewNotes}
              onChange={e => setInterviewNotes(e.target.value)}
              rows={3}
              placeholder="Location, format, interviewers..."
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', resize: 'vertical', marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={scheduleInterview} disabled={working || !interviewDate}>
                {working ? 'Scheduling...' : 'Schedule'}
              </button>
              <button className="btn" onClick={() => setShowInterview(false)} disabled={working}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offer modal */}
      {showOffer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="card" style={{ width: 420, margin: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Issue Offer</div>

            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Offered Salary <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="number"
              className="input"
              value={offerSalary}
              onChange={e => setOfferSalary(e.target.value)}
              min={0}
              placeholder="0.00"
              style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px', marginBottom: 12 }}
            />

            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Notes
            </label>
            <textarea
              className="input"
              value={offerNotes}
              onChange={e => setOfferNotes(e.target.value)}
              rows={3}
              placeholder="Start date, benefits, conditions..."
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', resize: 'vertical', marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={issueOffer} disabled={working || !offerSalary}>
                {working ? 'Issuing...' : 'Issue Offer'}
              </button>
              <button className="btn" onClick={() => setShowOffer(false)} disabled={working}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}