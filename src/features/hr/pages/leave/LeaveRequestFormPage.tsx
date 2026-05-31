// src/features/hr/pages/leave/LeaveRequestFormPage.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { leaveApi } from '../../api/hrApi';
import { getApiError } from '../../utils/hrUtils';

// =============================================================================
// Types
// =============================================================================

interface LeaveRequestFormValues {
  employeeId:  string;
  leaveTypeId: string;
  startDate:   string;
  endDate:     string;
  reason:      string;
}

type FieldErrors = Partial<Record<keyof LeaveRequestFormValues, string>>;

const EMPTY: LeaveRequestFormValues = {
  employeeId:  '',
  leaveTypeId: '',
  startDate:   '',
  endDate:     '',
  reason:      '',
};

// Common leave types — replace with a dynamic API call if you have a leave types endpoint
const LEAVE_TYPES = [
  { id: 'annual',     label: 'Annual Leave' },
  { id: 'sick',       label: 'Sick Leave' },
  { id: 'maternity',  label: 'Maternity Leave' },
  { id: 'paternity',  label: 'Paternity Leave' },
  { id: 'emergency',  label: 'Emergency Leave' },
  { id: 'unpaid',     label: 'Unpaid Leave' },
  { id: 'study',      label: 'Study Leave' },
];

// =============================================================================
// Validation
// =============================================================================

function validate(v: LeaveRequestFormValues): FieldErrors {
  const errs: FieldErrors = {};
  if (!v.employeeId.trim())  errs.employeeId  = 'Employee is required.';
  if (!v.leaveTypeId)        errs.leaveTypeId = 'Leave type is required.';
  if (!v.startDate)          errs.startDate   = 'Start date is required.';
  if (!v.endDate)            errs.endDate     = 'End date is required.';
  if (v.startDate && v.endDate && v.endDate < v.startDate)
    errs.endDate = 'End date must be on or after start date.';
  if (!v.reason.trim())      errs.reason      = 'Reason is required.';
  return errs;
}

// =============================================================================
// Helpers
// =============================================================================

function errBorder(hasErr: boolean): React.CSSProperties {
  return hasErr ? { outline: '1.5px solid var(--danger)', borderColor: 'var(--danger)' } : {};
}

// =============================================================================
// Sub-components
// =============================================================================

interface FieldProps {
  label:     string;
  required?: boolean;
  span?:     number;
  error?:    string;
  fieldKey?: string;
  children:  React.ReactNode;
}

function Field({ label, required, span = 1, error, fieldKey, children }: FieldProps) {
  return (
    <div style={{ gridColumn: `span ${span}` }} data-field={fieldKey}>
      <label style={{
        display: 'block', fontSize: 11, marginBottom: 4,
        color: error ? 'var(--danger)' : 'var(--text-muted)',
      }}>
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function LeaveRequestFormPage() {
  const nav               = useNavigate();
  const { companyId, userId } = useAppScope();

  const [values,    setValues]    = useState<LeaveRequestFormValues>(EMPTY);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);

  // Calculate number of days between dates
  const dayCount = values.startDate && values.endDate
    ? Math.max(0, Math.ceil(
        (new Date(values.endDate).getTime() - new Date(values.startDate).getTime())
        / 86400000
      ) + 1)
    : null;

  function set<K extends keyof LeaveRequestFormValues>(key: K, value: LeaveRequestFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: value }));
    if (fieldErrs[key]) setFieldErrs(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  function inputStyle(key: keyof LeaveRequestFormValues): React.CSSProperties {
    return { width: '100%', height: 34, fontSize: 13, padding: '0 10px', ...errBorder(!!fieldErrs[key]) };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;

    const errs = validate(values);
    if (Object.keys(errs).length > 0) {
      setFieldErrs(errs);
      document.querySelector<HTMLElement>(`[data-field="${Object.keys(errs)[0]}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSaving(true); setApiError(null);
    try {
      await leaveApi.submit(companyId, {
        EmployeeId:  values.employeeId,
        LeaveTypeId: values.leaveTypeId,
        StartDate:   values.startDate,
        EndDate:     values.endDate,
        Reason:      values.reason,
        CreatedBy:   userId,
      });
      nav('/hr/leave');
    } catch (e) {
      setApiError(getApiError(e, 'Failed to submit leave request.'));
    } finally {
      setSaving(false);
    }
  }

  const fe = fieldErrs;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Leave</div>
          <div className="page-title">New Leave Request</div>
          <div className="page-sub">Submit an employee leave application</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit Request'}
          </button>
          <button className="btn" onClick={() => nav('/hr/leave')} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>

      {apiError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{apiError}</div>}

      {Object.keys(fe).length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          Please fix the following before submitting:
          <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
            {Object.values(fe).map((msg, i) => <li key={i}>{msg}</li>)}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16,
          }}>
            Request Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>

            <Field label="Employee ID" required error={fe.employeeId} fieldKey="employeeId" span={2}>
              <input
                type="text"
                className="input"
                value={values.employeeId}
                onChange={e => set('employeeId', e.target.value)}
                placeholder="Enter employee ID"
                style={inputStyle('employeeId')}
              />
            </Field>

            <Field label="Leave Type" required error={fe.leaveTypeId} fieldKey="leaveTypeId" span={2}>
              <select
                className="select"
                value={values.leaveTypeId}
                onChange={e => set('leaveTypeId', e.target.value)}
                style={inputStyle('leaveTypeId')}
              >
                <option value="">Select leave type...</option>
                {LEAVE_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Start Date" required error={fe.startDate} fieldKey="startDate">
              <input
                type="date"
                className="input"
                value={values.startDate}
                onChange={e => set('startDate', e.target.value)}
                style={inputStyle('startDate')}
              />
            </Field>

            <Field label="End Date" required error={fe.endDate} fieldKey="endDate">
              <input
                type="date"
                className="input"
                value={values.endDate}
                onChange={e => set('endDate', e.target.value)}
                style={inputStyle('endDate')}
              />
            </Field>

            {/* Day count preview */}
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20 }}>
              {dayCount !== null && (
                <div style={{
                  padding: '6px 14px', background: 'var(--surface-2)',
                  borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 13,
                }}>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{dayCount}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                    {dayCount === 1 ? 'day' : 'days'}
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Reason */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16,
          }}>
            Reason
          </div>
          <div data-field="reason">
            <label style={{
              display: 'block', fontSize: 11, marginBottom: 4,
              color: fe.reason ? 'var(--danger)' : 'var(--text-muted)',
            }}>
              Reason for Leave <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              className="input"
              value={values.reason}
              onChange={e => set('reason', e.target.value)}
              rows={4}
              placeholder="Briefly describe the reason for this leave request..."
              style={{
                width: '100%', fontSize: 13, padding: '8px 10px', resize: 'vertical',
                ...errBorder(!!fe.reason),
              }}
            />
            {fe.reason && (
              <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{fe.reason}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Submitting...' : 'Submit Request'}
          </button>
          <button type="button" className="btn" onClick={() => nav('/hr/leave')} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}