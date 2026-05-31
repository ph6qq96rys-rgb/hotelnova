// src/features/hr/pages/payroll/PayrollRunDetailPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { payrollApi } from '../../api/hrApi';
import type { PayrollRunDto, PaySlipSummaryDto } from '../../types/index';
import { PAYROLL_STATUS_CLASS, fmtDate, fmtMoney, getApiError } from '../../utils/hrUtils';

// Workflow: Draft → Pending → Approved → Paid
const WORKFLOW_STEPS = ['Draft', 'Pending', 'Approved', 'Paid'] as const;

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value ?? '—'}</div>
    </div>
  );
}

export default function PayrollRunDetailPage() {
  const nav           = useNavigate();
  const { runId }     = useParams<{ runId: string }>();
  const { companyId, userId } = useAppScope();

  const [run,      setRun]      = useState<PayrollRunDto | null>(null);
  const [payslips, setPayslips] = useState<PaySlipSummaryDto[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [working,  setWorking]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !runId) return;
    setLoading(true); setError(null);
    try {
      // Fetch run from the list, find by ID
      const runs = await payrollApi.listRuns(companyId, new Date().getFullYear());
      const found = runs.find(r => r.id === runId) ?? null;
      setRun(found);

      // Fetch payslips if the run has an employeeId (use run's year)
      // Since API provides getEmployeePaySlips, we load all via the run
      // When a bulk payslip list endpoint exists, replace this.
      setPayslips([]);
    } catch (e) {
      setError(getApiError(e, 'Failed to load payroll run.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, runId]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(action: 'process' | 'approve' | 'pay') {
    if (!companyId || !runId) return;
    setWorking(true); setError(null);
    try {
      if (action === 'process') await payrollApi.processRun(companyId, runId, userId ?? 'HR');
      if (action === 'approve') await payrollApi.approveRun(companyId, runId, userId ?? 'HR');
      if (action === 'pay')     await payrollApi.markPaid(companyId, runId, userId ?? 'HR');
      await load();
    } catch (e) {
      setError(getApiError(e, 'Action failed.'));
    } finally {
      setWorking(false);
    }
  }

  if (loading && !run) {
    return <div className="page"><div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div></div>;
  }
  if (error && !run) {
    return (
      <div className="page">
        <div className="alert alert-danger">{error}</div>
        <button className="btn" onClick={() => nav('/hr/payroll')}>← Back</button>
      </div>
    );
  }
  if (!run) return null;

  const stepIndex = WORKFLOW_STEPS.indexOf(run.status as typeof WORKFLOW_STEPS[number]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Payroll</div>
          <div className="page-title">{run.periodName}</div>
          <div className="page-sub">
            {fmtDate(run.periodStart)} – {fmtDate(run.periodEnd)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={PAYROLL_STATUS_CLASS[run.status]}>{run.status}</span>
          {run.status === 'Draft' && (
            <button className="btn btn-primary" onClick={() => handleAction('process')} disabled={working}>
              {working ? 'Processing...' : 'Process Run'}
            </button>
          )}
          {run.status === 'Pending' && (
            <button className="btn btn-primary" onClick={() => handleAction('approve')} disabled={working}>
              {working ? 'Approving...' : 'Approve Run'}
            </button>
          )}
          {run.status === 'Approved' && (
            <button className="btn btn-primary" onClick={() => handleAction('pay')} disabled={working}>
              {working ? 'Marking...' : 'Mark as Paid'}
            </button>
          )}
          <button className="btn" onClick={() => nav('/hr/payroll')}>← Back</button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Workflow progress */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
        }}>
          Workflow
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {WORKFLOW_STEPS.map((step, i) => {
            const done    = i <= stepIndex;
            const current = i === stepIndex;
            return (
              <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {/* Connector line */}
                {i > 0 && (
                  <div style={{
                    position: 'absolute', top: 14, right: '50%', left: '-50%',
                    height: 2, background: i <= stepIndex ? 'var(--accent)' : 'var(--border)',
                  }} />
                )}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', zIndex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  background: done ? 'var(--accent)' : 'var(--surface-2)',
                  color: done ? 'var(--accent-fg)' : 'var(--text-muted)',
                  border: current ? '2px solid var(--accent)' : '1px solid var(--border)',
                }}>
                  {i + 1}
                </div>
                <div style={{
                  fontSize: 11, marginTop: 6, fontWeight: current ? 600 : 400,
                  color: done ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                  {step}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Employees</div>
          <div className="kpi-val">{run.employeeCount}</div>
          <div className="kpi-sub">on this run</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Gross Pay</div>
          <div className="kpi-val" style={{ fontSize: 15 }}>{fmtMoney(run.totalGross)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Deductions</div>
          <div className="kpi-val" style={{ fontSize: 15, color: 'var(--danger)' }}>
            ({fmtMoney(run.totalDeductions)})
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Net Pay</div>
          <div className="kpi-val" style={{ fontSize: 15, color: 'var(--success)' }}>
            {fmtMoney(run.totalNet)}
          </div>
        </div>
      </div>

      {/* Run details */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
        }}>
          Run Details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
          <Field label="Period"      value={run.periodName} />
          <Field label="Start Date"  value={fmtDate(run.periodStart)} />
          <Field label="End Date"    value={fmtDate(run.periodEnd)} />
          <Field label="Status"      value={run.status} />
        </div>
      </div>

      {/* Pay slips table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Pay Slips
          </div>
          <button className="btn btn-sm" onClick={load} disabled={loading}>
            <i className="ti ti-refresh" /> Refresh
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th style={{ textAlign: 'right' }}>Gross Pay</th>
              <th style={{ textAlign: 'right' }}>Net Pay</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : payslips.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>
                {run.status === 'Draft'
                  ? 'Process this run to generate pay slips.'
                  : 'No pay slips available.'}
              </td></tr>
            ) : payslips.map(p => (
              <tr key={p.id} style={{ cursor: 'pointer' }}
                onClick={() => nav(`/hr/payroll/payslips/${p.id}`)}>
                <td style={{ fontSize: 13, fontWeight: 500 }}>{p.periodName}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>
                  {fmtMoney(p.grossPay)}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>
                  {fmtMoney(p.netPay)}
                </td>
                <td>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                  }}>
                    {p.status}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-sm"
                    onClick={e => { e.stopPropagation(); nav(`/hr/payroll/payslips/${p.id}`); }}>
                    View →
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