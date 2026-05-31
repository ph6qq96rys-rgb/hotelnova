// src/features/hr/pages/employees/EmployeeConfirmPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { employeeApi } from '../../api/hrApi';
import type { EmployeeDetailDto } from '../../types/index';
import { EMPLOYMENT_STATUS_CLASS, fmtDate, fmtMoney, getApiError } from '../../utils/hrUtils';

export default function EmployeeConfirmPage() {
  const nav            = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const { companyId }  = useAppScope();

  const [employee,         setEmployee]         = useState<EmployeeDetailDto | null>(null);
  const [confirmationDate, setConfirmationDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Load employee ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!companyId || !employeeId) return;
    setLoading(true); setError(null);
    try {
      const dto = await employeeApi.get(companyId, employeeId);
      // Guard: only probationary employees can be confirmed
      if (dto.status !== 'Probation') {
        setError(`This employee is "${dto.status}" and cannot be confirmed.`);
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

  async function handleConfirm() {
    if (!companyId || !employeeId || !employee) return;
    if (!confirmationDate) { setError('Confirmation date is required.'); return; }

    setSaving(true); setError(null);
    try {
      await employeeApi.confirm(companyId, employeeId, confirmationDate);
      nav(`/hr/employees/${employeeId}`);
    } catch (e) {
      setError(getApiError(e, 'Failed to confirm employee.'));
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

  const canConfirm = employee.status === 'Probation' && !error;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Employees</div>
          <div className="page-title">Confirm Employee</div>
          <div className="page-sub">
            {employee.fullName} · {employee.employeeNo} · {employee.positionTitle}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={saving || !canConfirm}
          >
            {saving ? 'Confirming…' : 'Confirm Employment'}
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

      {/* ── Confirmation form ───────────────────────────────────────────── */}
      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16,
        }}>
          Confirmation Details
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Confirmation Date <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            type="date"
            className="input"
            value={confirmationDate}
            onChange={e => setConfirmationDate(e.target.value)}
            disabled={!canConfirm || saving}
            style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px' }}
          />
        </div>

        {/* Confirmation summary callout */}
        <div style={{
          padding: '12px 14px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          Confirming <strong style={{ color: 'var(--text)' }}>{employee.fullName}</strong> will
          change their status from <strong>Probation</strong> to <strong>Active</strong> and
          record {confirmationDate ? fmtDate(confirmationDate) : '—'} as their confirmation date.
          This action cannot be undone.
        </div>
      </div>
    </div>
  );
}