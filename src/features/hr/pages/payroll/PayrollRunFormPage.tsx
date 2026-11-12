// src/features/hr/pages/payroll/PayrollRunFormPage.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { payrollApi } from '../../api/hrApi';
import { getApiError } from '../../utils/hrUtils';

// =============================================================================
// Types
// =============================================================================

interface PayrollRunFormValues {
  periodName:  string;
  periodStart: string;
  periodEnd:   string;
  notes:       string;
}

type FieldErrors = Partial<Record<keyof PayrollRunFormValues, string>>;

const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth(); // 0-indexed

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// A payroll run covers one whole calendar month. Dates are built as text, not through toISOString(),
// which shifts them a day back in time zones east of UTC (Addis Ababa: 1 Oct became 30 Sep).
function monthPeriod(year: number, monthIndex: number) {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    periodStart: `${year}-${mm}-01`,
    periodEnd: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
    periodName: `${MONTH_NAMES[monthIndex]} ${year}`,
  };
}
const { periodStart: defaultStart, periodEnd: defaultEnd, periodName: defaultName } = monthPeriod(currentYear, currentMonth);

const EMPTY: PayrollRunFormValues = {
  periodName:  defaultName,
  periodStart: defaultStart,
  periodEnd:   defaultEnd,
  notes:       '',
};

// =============================================================================
// Validation
// =============================================================================

function validate(v: PayrollRunFormValues): FieldErrors {
  const errs: FieldErrors = {};
  if (!v.periodName.trim())  errs.periodName  = 'Period name is required.';
  if (!v.periodStart)        errs.periodStart = 'Start date is required.';
  if (!v.periodEnd)          errs.periodEnd   = 'End date is required.';
  if (v.periodStart && v.periodEnd && v.periodEnd < v.periodStart)
    errs.periodEnd = 'End date must be after start date.';
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
  error?:    string;
  fieldKey?: string;
  children:  React.ReactNode;
}

function Field({ label, required, error, fieldKey, children }: FieldProps) {
  return (
    <div data-field={fieldKey}>
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

export default function PayrollRunFormPage() {
  const nav               = useNavigate();
  const { companyId, userId } = useAppScope();

  const [values,    setValues]    = useState<PayrollRunFormValues>(EMPTY);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);

  function set<K extends keyof PayrollRunFormValues>(key: K, value: string) {
    setValues(prev => ({ ...prev, [key]: value }));
    if (fieldErrs[key]) setFieldErrs(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  function inputStyle(key: keyof PayrollRunFormValues): React.CSSProperties {
    return { width: '100%', height: 34, fontSize: 13, padding: '0 10px', ...errBorder(!!fieldErrs[key]) };
  }

  // Choosing the month sets the whole-month period and its name.
  function handleMonthChange(value: string) {
    const [y, m] = value.split('-').map(Number);
    if (!y || !m) return;
    const period = monthPeriod(y, m - 1);
    set('periodStart', period.periodStart);
    set('periodEnd', period.periodEnd);
    set('periodName', period.periodName);
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
      const created = await payrollApi.createRun(companyId, {
        PeriodName:  values.periodName,
        PeriodStart: values.periodStart,
        PeriodEnd:   values.periodEnd,
        Notes:       values.notes,
        CreatedBy:   userId,
      });
      nav(`/hr/payroll/runs/${created.id}`);
    } catch (e) {
      setApiError(getApiError(e, 'Failed to create payroll run.'));
    } finally {
      setSaving(false);
    }
  }

  const fe = fieldErrs;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources - Payroll</div>
          <div className="page-title">New Payroll Run</div>
          <div className="page-sub">Create a payroll run for a pay period</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating...' : 'Create Run'}
          </button>
          <button className="btn" onClick={() => nav('/hr/payroll')} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>

      {apiError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{apiError}</div>}
      {Object.keys(fe).length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          Please fix the following:
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
            Pay Period
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>

            <div style={{ gridColumn: 'span 2' }}>
              <Field label="Period Name" required error={fe.periodName} fieldKey="periodName">
                <input
                  type="text"
                  className="input"
                  value={values.periodName}
                  onChange={e => set('periodName', e.target.value)}
                  placeholder="e.g. January 2026"
                  style={inputStyle('periodName')}
                />
              </Field>
            </div>

            <Field label="Month" required error={fe.periodStart} fieldKey="periodStart">
              <input
                type="month"
                className="input"
                aria-label="Payroll month"
                value={values.periodStart.slice(0, 7)}
                onChange={e => handleMonthChange(e.target.value)}
                style={inputStyle('periodStart')}
              />
            </Field>

            <Field label="Period" fieldKey="periodEnd">
              <div style={{ fontSize: 13, padding: '8px 0' }}>
                {values.periodStart} to {values.periodEnd} (salaries are paid for the whole month, pro-rated by days worked)
              </div>
            </Field>

          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16,
          }}>
            Notes (Optional)
          </div>
          <textarea
            className="input"
            value={values.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Any additional notes for this payroll run..."
            style={{ width: '100%', fontSize: 13, padding: '8px 10px', resize: 'vertical' }}
          />
        </div>

        {/* Info callout */}
        <div style={{
          padding: '12px 16px', background: 'var(--surface-2)',
          border: '1px solid var(--border)', borderRadius: 8,
          fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6,
        }}>
          Creating this run will generate payslips for all active employees in the
          period <strong style={{ color: 'var(--text)' }}>{values.periodName || '-'}</strong>.
          The run starts in <strong>Draft</strong> status - you can review before processing.
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create Run'}
          </button>
          <button type="button" className="btn" onClick={() => nav('/hr/payroll')} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}