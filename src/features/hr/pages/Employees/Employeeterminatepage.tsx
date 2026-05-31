// src/features/hr/pages/employees/EmployeeTerminatePage.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { employeeApi } from '../../api/hrApi';
import type { EmployeeDetailDto } from '../../types/index';
import { EMPLOYMENT_STATUS_CLASS, fmtDate, fmtMoney, getApiError } from '../../utils/hrUtils';

const TERMINATION_REASONS = [
  'Resignation',
  'End of Contract',
  'Redundancy',
  'Misconduct',
  'Performance',
  'Retirement',
  'Death',
  'Other',
];

export default function EmployeeTerminatePage() {
  const nav            = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const { companyId }  = useAppScope();

  const [employee,         setEmployee]         = useState<EmployeeDetailDto | null>(null);
  const [terminationDate,  setTerminationDate]  = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [reason,    setReason]    = useState('');
  const [notes,     setNotes]     = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // ── Load employee ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!companyId || !employeeId) return;
    setLoading(true); setError(null);
    try {
      const dto = await employeeApi.get(companyId, employeeId);
      if (dto.status === 'Terminated') {
        setError('This employee has already been terminated.');
      }
      setEmployee(dto);
    } catch (e) {
      setError(getApiError(e, 'Failed to load employee.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => { load(); }, [load]);

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleTerminate() {
    if (!companyId || !employeeId || !employee) return;
    if (!terminationDate) { setError('Termination date is required.');  return; }
    if (!reason)          { setError('Termination reason is required.'); return; }
    if (!confirmed)       { setError('Please confirm you understand this action is irreversible.'); return; }

    setSaving(true); setError(null);
    try {
      await employeeApi.terminate(companyId, employeeId, {
        terminationDate,
        reason: notes ? `${reason} — ${notes}` : reason,
      });
      nav(`/hr/employees/${employeeId}`);
    } catch (e) {
      setError(getApiError(e, 'Failed to terminate employee.'));
    } finally {
      setSaving(false);
    }
  }

  // ── States ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page">
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading…
        </div>
      </div>
    );
  }

  if (!employee && error) {
    return (
      <div className="page">
        <div className="alert alert-danger">{error}</div>
        <button className="btn" onClick={() => nav(`/hr/employees/${employeeId}`)}>
          ← Back to Employee
        </button>
      </div>
    );
  }

  if (!employee) return null;

  const canTerminate = employee.status !== 'Terminated';

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Employees</div>
          <div className="page-title">Terminate Employee</div>
          <div className="page-sub">
            {employee.fullName} · {employee.employeeNo} · {employee.positionTitle}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            style={{
              color: canTerminate ? 'var(--danger)' : undefined,
              borderColor: canTerminate ? 'var(--danger)' : undefined,
              opacity: saving || !canTerminate || !confirmed ? 0.5 : 1,
            }}
            onClick={handleTerminate}
            disabled={saving || !canTerminate || !confirmed}
          >
            {saving ? 'Terminating…' : 'Terminate Employment'}
          </button>
          <button
            className="btn"
            onClick={() => nav(`/hr/employees/${employeeId}`)}
            disabled={saving}
          >
            ← Cancel
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── Employee summary ────────────────────────────────────────────── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Current Status</div>
          <div className="kpi-val" style={{ fontSize: 14 }}>
            <span className={EMPLOYMENT_STATUS_CLASS[employee.status]}>
              {employee.status}
            </span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Hire Date</div>
          <div className="kpi-val" style={{ fontSize: 14 }}>{fmtDate(employee.hireDate)}</div>
          <div className="kpi-sub">{employee.yearsOfService}y service</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Department</div>
          <div className="kpi-val" style={{ fontSize: 14 }}>{employee.departmentName}</div>
          <div className="kpi-sub">{employee.positionTitle}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Basic Salary</div>
          <div className="kpi-val" style={{ fontSize: 14 }}>{fmtMoney(employee.basicSalary)}</div>
          <div className="kpi-sub">per month</div>
        </div>
      </div>

      {/* ── Termination form ────────────────────────────────────────────── */}
      <div className="card" style={{ maxWidth: 520 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16,
        }}>
          Termination Details
        </div>

        {/* Termination date */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Termination Date <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            type="date"
            className="input"
            value={terminationDate}
            onChange={e => setTerminationDate(e.target.value)}
            disabled={!canTerminate || saving}
            style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px' }}
          />
        </div>

        {/* Reason */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Reason <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <select
            className="select"
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={!canTerminate || saving}
            style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px' }}
          >
            <option value="">— Select reason —</option>
            {TERMINATION_REASONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Additional Notes
          </label>
          <textarea
            className="input"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={!canTerminate || saving}
            rows={3}
            placeholder="Optional — any additional context or notes"
            style={{ width: '100%', fontSize: 13, padding: '8px 10px', resize: 'vertical' }}
          />
        </div>

        {/* Warning callout */}
        <div style={{
          padding: '12px 14px',
          background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--text)',
          lineHeight: 1.6,
          marginBottom: 16,
        }}>
          Terminating <strong>{employee.fullName}</strong> will permanently change their
          status to <strong>Terminated</strong> effective{' '}
          <strong>{terminationDate ? fmtDate(terminationDate) : '—'}</strong>.
          This action cannot be undone.
        </div>

        {/* Confirmation checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            disabled={!canTerminate || saving}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          I understand this action is irreversible and have the authority to terminate this employee.
        </label>
      </div>
    </div>
  );
}