// src/features/hr/pages/performance/PerformanceReviewPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { performanceApi } from '../../api/hrApi';
import type { PerformanceReviewDetailDto } from '../../types/index';
import { getApiError } from '../../utils/hrUtils';

// =============================================================================
// Types
// =============================================================================

interface ReviewFormValues {
  rating:   number | '';
  comments: string;
  goals:    string;
}

const EMPTY_FORM: ReviewFormValues = { rating: '', comments: '', goals: '' };

const RATINGS = [1, 2, 3, 4, 5];
const RATING_LABELS: Record<number, string> = {
  1: 'Unsatisfactory',
  2: 'Needs Improvement',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding',
};

// =============================================================================
// Sub-components
// =============================================================================

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value ?? '—'}</div>
    </div>
  );
}

function ScoreBar({ score, max = 5 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  const color = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--accent)' : pct >= 40 ? 'var(--warn)' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)', color, minWidth: 32 }}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function PerformanceReviewPage() {
  const nav             = useNavigate();
  const { reviewId }    = useParams<{ reviewId: string }>();
  const { companyId, userId } = useAppScope();

  const [review,    setReview]    = useState<PerformanceReviewDetailDto | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Which panel is open: 'self' | 'manager' | null
  const [activeForm, setActiveForm] = useState<'self' | 'manager' | null>(null);
  const [form,       setForm]       = useState<ReviewFormValues>(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !reviewId) return;
    setLoading(true); setError(null);
    try {
      setReview(await performanceApi.getReview(companyId, reviewId));
    } catch (e) {
      setError(getApiError(e, 'Failed to load review.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, reviewId]);

  useEffect(() => { load(); }, [load]);

  function openForm(type: 'self' | 'manager') {
    setActiveForm(type);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function submitReview() {
    if (!companyId || !reviewId || !activeForm) return;
    if (form.rating === '') { setFormError('Rating is required.'); return; }
    if (!form.comments.trim()) { setFormError('Comments are required.'); return; }

    setSaving(true); setFormError(null);
    try {
      const rating = Number(form.rating);
      if (activeForm === 'self') {
        await performanceApi.submitSelfReview(companyId, reviewId, {
          SelfRating:   rating,
          SelfSummary:  form.comments,
          Goals:        form.goals,
          CreatedBy:    userId,
        });
      } else {
        await performanceApi.submitManagerReview(companyId, reviewId, {
          ManagerRating:   rating,
          ManagerSummary:  form.comments,
          Goals:           form.goals,
          CreatedBy:       userId,
        });
      }
      setActiveForm(null);
      await load();
    } catch (e) {
      setFormError(getApiError(e, 'Failed to submit review.'));
    } finally {
      setSaving(false);
    }
  }

  // States
  if (loading && !review) {
    return <div className="page"><div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div></div>;
  }
  if (error && !review) {
    return (
      <div className="page">
        <div className="alert alert-danger">{error}</div>
        <button className="btn" onClick={() => nav(-1)}>← Back</button>
      </div>
    );
  }
  if (!review) return null;

  const cyclePath = review.cycleId ? `/hr/performance/cycles/${review.cycleId}` : '/hr/performance';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Performance · Review</div>
          <div className="page-title">{review.employeeName}</div>
          <div className="page-sub">
            {review.cycleName} · Reviewer: {review.reviewerName}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 12, padding: '3px 10px', borderRadius: 20,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: review.status === 'Completed'    ? 'var(--success)'
                : review.status === 'ManagerReview' ? 'var(--accent)'
                : review.status === 'SelfReview'    ? 'var(--warn)'
                : review.status === 'Calibration'   ? 'var(--warn)'
                : 'var(--text-muted)',
            fontWeight: 600,
          }}>
            {review.status}
          </span>
          <button className="btn" onClick={() => nav(cyclePath)}>← Back</button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Score KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Overall Score</div>
          <div className="kpi-val" style={{ color: 'var(--accent)' }}>
            {review.finalRating != null ? review.finalRating.toFixed(1) : '—'}
          </div>
          <div className="kpi-sub">out of 5.0</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Self Score</div>
          <div className="kpi-val" style={{ fontSize: 16 }}>
            {review.selfRating != null ? review.selfRating.toFixed(1) : 'Pending'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Manager Score</div>
          <div className="kpi-val" style={{ fontSize: 16 }}>
            {review.managerRating != null ? review.managerRating.toFixed(1) : 'Pending'}
          </div>
        </div>
      </div>

      {/* Score bars */}
      {(review.finalRating != null || review.selfRating != null || review.managerRating != null) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
          }}>
            Scores
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {review.finalRating != null && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Overall</div>
                <ScoreBar score={review.finalRating} />
              </div>
            )}
            {review.selfRating != null && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Self Assessment</div>
                <ScoreBar score={review.selfRating} />
              </div>
            )}
            {review.managerRating != null && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Manager Assessment</div>
                <ScoreBar score={review.managerRating} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
        }}>
          Review Details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
          <Field label="Employee"   value={review.employeeName} />
          <Field label="Reviewer"   value={review.reviewerName} />
          <Field label="Cycle"      value={review.cycleName} />
          <Field label="Status"     value={review.status} />
          {review.reviewDate && <Field label="Review Date" value={review.reviewDate} />}
        </div>
      </div>

      {/* Self review comments */}
      {review.selfSummary && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
          }}>
            Self Assessment Comments
          </div>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
            {review.selfSummary}
          </p>
        </div>
      )}

      {/* Manager review comments */}
      {review.managerSummary && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
          }}>
            Manager Assessment Comments
          </div>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
            {review.managerSummary}
          </p>
        </div>
      )}

      {/* Action buttons */}
      {review.status !== 'Completed' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
          }}>
            Submit Review
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {review.status === 'SelfReview' && (
              <button className="btn btn-primary" onClick={() => openForm('self')}>
                Submit Self Review
              </button>
            )}
            {review.status === 'ManagerReview' && (
              <button className="btn btn-primary" onClick={() => openForm('manager')}>
                Submit Manager Review
              </button>
            )}
            {review.status === 'Calibration' && (
              <button className="btn" onClick={() => openForm('manager')}>
                Submit Calibration
              </button>
            )}
          </div>
        </div>
      )}

      {/* Inline review form */}
      {activeForm && (
        <div className="card" style={{ marginBottom: 16, border: '1.5px solid var(--accent)' }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--accent)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16,
          }}>
            {activeForm === 'self' ? 'Self Assessment' : 'Manager Assessment'}
          </div>

          {formError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{formError}</div>}

          {/* Star rating */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Rating <span style={{ color: 'var(--danger)' }}>*</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {RATINGS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, rating: r }))}
                  style={{
                    width: 44, height: 44, borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                    background: form.rating === r ? 'var(--accent)' : 'var(--surface-2)',
                    color: form.rating === r ? 'var(--accent-fg)' : 'var(--text)',
                    border: `1px solid ${form.rating === r ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {r}
                </button>
              ))}
              {form.rating !== '' && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 8 }}>
                  {RATING_LABELS[form.rating as number]}
                </span>
              )}
            </div>
          </div>

          {/* Comments */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Comments <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              className="input"
              value={form.comments}
              onChange={e => setForm(prev => ({ ...prev, comments: e.target.value }))}
              rows={4}
              placeholder="Describe performance, achievements, and areas observed..."
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', resize: 'vertical' }}
            />
          </div>

          {/* Goals */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Goals for Next Period
            </label>
            <textarea
              className="input"
              value={form.goals}
              onChange={e => setForm(prev => ({ ...prev, goals: e.target.value }))}
              rows={3}
              placeholder="List objectives and development goals..."
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={submitReview} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit'}
            </button>
            <button className="btn" onClick={() => setActiveForm(null)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}