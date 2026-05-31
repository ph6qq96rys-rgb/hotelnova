// src/features/hr/pages/performance/PerformanceCycleDetailPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { performanceApi } from '../../api/hrApi';
import type { PerformanceCycleDto, PerformanceReviewDetailDto, CycleStatus } from '../../types/index';
import { CYCLE_STATUS_CLASS, fmtDate, getApiError } from '../../utils/hrUtils';

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value ?? '—'}</div>
    </div>
  );
}

// Review status badge colours
const REVIEW_STATUS_STYLE: Record<string, React.CSSProperties> = {
  NotStarted:    { background: 'color-mix(in srgb, var(--text-muted) 12%, transparent)', color: 'var(--text-muted)', border: '1px solid color-mix(in srgb, var(--text-muted) 30%, transparent)' },
  SelfReview:    { background: 'color-mix(in srgb, var(--warn) 12%, transparent)',       color: 'var(--warn)',       border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)' },
  ManagerReview: { background: 'color-mix(in srgb, var(--accent) 12%, transparent)',     color: 'var(--accent)',     border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' },
  Calibration:   { background: 'color-mix(in srgb, var(--warn) 12%, transparent)',       color: 'var(--warn)',       border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)' },
  Completed:     { background: 'color-mix(in srgb, var(--success) 12%, transparent)',    color: 'var(--success)',    border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)' },
};

export default function PerformanceCycleDetailPage() {
  const nav            = useNavigate();
  const { cycleId }    = useParams<{ cycleId: string }>();
  const { companyId }  = useAppScope();

  const [cycle,   setCycle]   = useState<PerformanceCycleDto | null>(null);
  const [reviews, setReviews] = useState<PerformanceReviewDetailDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !cycleId) return;
    setLoading(true); setError(null);
    try {
      // Fetch cycle summary from the list, and reviews for this cycle.
      const [cycles, cycleReviews] = await Promise.all([
        performanceApi.listCycles(companyId),
        // getReview is per-review — we need a cycle-level reviews list.
        // Using the cycle list to get summary, then individual reviews aren't
        // bulk-fetchable from the current API. Show what we have from the DTO.
        Promise.resolve([] as PerformanceReviewDetailDto[]),
      ]);
      const found = cycles.find(c => c.id === cycleId) ?? null;
      setCycle(found);
      setReviews(cycleReviews);
    } catch (e) {
      setError(getApiError(e, 'Failed to load cycle.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, cycleId]);

  useEffect(() => { load(); }, [load]);

  if (loading && !cycle) {
    return <div className="page"><div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div></div>;
  }

  if (error && !cycle) {
    return (
      <div className="page">
        <div className="alert alert-danger">{error}</div>
        <button className="btn" onClick={() => nav('/hr/performance')}>← Back</button>
      </div>
    );
  }

  if (!cycle) return null;

  const pct = cycle.totalReviews > 0
    ? Math.round(cycle.completedReviews / cycle.totalReviews * 100)
    : 0;

  const pending    = cycle.totalReviews - cycle.completedReviews;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Performance</div>
          <div className="page-title">{cycle.name}</div>
          <div className="page-sub">{cycle.type} · {fmtDate(cycle.startDate)} – {fmtDate(cycle.endDate)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={CYCLE_STATUS_CLASS[cycle.status as CycleStatus]}>{cycle.status}</span>
          <button className="btn" onClick={() => nav('/hr/performance')}>← Back</button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Total Reviews</div>
          <div className="kpi-val">{cycle.totalReviews}</div>
          <div className="kpi-sub">in this cycle</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Completed</div>
          <div className="kpi-val" style={{ color: 'var(--success)' }}>{cycle.completedReviews}</div>
          <div className="kpi-sub">reviews done</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pending</div>
          <div className="kpi-val" style={{ color: pending > 0 ? 'var(--warn)' : 'var(--text-muted)' }}>
            {pending}
          </div>
          <div className="kpi-sub">awaiting completion</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Progress</div>
          <div className="kpi-val" style={{ color: pct >= 100 ? 'var(--success)' : 'var(--accent)' }}>
            {pct}%
          </div>
          <div className="kpi-sub">completion rate</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
        }}>
          Overall Progress
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 10, background: 'var(--border)', borderRadius: 5 }}>
            <div style={{
              height: '100%', borderRadius: 5,
              background: pct >= 100 ? 'var(--success)' : 'var(--accent)',
              width: `${pct}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)', minWidth: 40 }}>
            {pct}%
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          <span>{cycle.completedReviews} completed</span>
          <span>{cycle.totalReviews} total</span>
        </div>
      </div>

      {/* Cycle details */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
        }}>
          Cycle Information
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
          <Field label="Cycle Name"  value={cycle.name} />
          <Field label="Type"        value={cycle.type} />
          <Field label="Start Date"  value={fmtDate(cycle.startDate)} />
          <Field label="End Date"    value={fmtDate(cycle.endDate)} />
        </div>
      </div>

      {/* Reviews table — populated when the API supports bulk listing by cycle */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Reviews
          </div>
          <button className="btn btn-sm" onClick={load} disabled={loading}>
            <i className="ti ti-refresh" /> Refresh
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Reviewer</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Score</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : reviews.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>
                No individual review data available. Use the review links when notified.
              </td></tr>
            ) : reviews.map(r => (
              <tr key={r.id} style={{ cursor: 'pointer' }}
                onClick={() => nav(`/hr/performance/reviews/${r.id}`)}>
                <td style={{ fontWeight: 500, fontSize: 13 }}>{r.employeeName}</td>
                <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.reviewerName}</td>
                <td>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    ...(REVIEW_STATUS_STYLE[r.status] ?? {}),
                  }}>
                    {r.status}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>
                  {r.finalRating != null ? r.finalRating.toFixed(1) : '—'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-sm">Open →</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}