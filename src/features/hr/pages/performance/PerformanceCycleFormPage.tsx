// src/features/hr/pages/performance/PerformanceCycleFormPage.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { performanceApi } from '../../api/hrApi';
import { getApiError } from '../../utils/hrUtils';

// =============================================================================
// Types
// =============================================================================

interface CycleFormValues {
  name:      string;
  type:      string;
  startDate: string;
  endDate:   string;
}

type FieldErrors = Partial<Record<keyof CycleFormValues, string>>;

const EMPTY: CycleFormValues = {
  name:      '',
  type:      'Annual',
  startDate: '',
  endDate:   '',
};

const CYCLE_TYPES = ['Annual', 'BiAnnual', 'Quarterly', 'Probation', 'Custom'];

// =============================================================================
// Validation
// =============================================================================

function validate(v: CycleFormValues): FieldErrors {
  const errs: FieldErrors = {};
  if (!v.name.trim())  errs.name      = 'Cycle name is required.';
  if (!v.type)         errs.type      = 'Cycle type is required.';
  if (!v.startDate)    errs.startDate = 'Start date is required.';
  if (!v.endDate)      errs.endDate   = 'End date is required.';
  if (v.startDate && v.endDate && v.endDate <= v.startDate)
    errs.endDate = 'End date must be after start date.';
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

export default function PerformanceCycleFormPage() {
  const nav               = useNavigate();
  const { companyId, userId } = useAppScope();

  const [values,    setValues]    = useState<CycleFormValues>(EMPTY);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);

  function set<K extends keyof CycleFormValues>(key: K, value: CycleFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: value }));
    if (fieldErrs[key]) setFieldErrs(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  function inputStyle(key: keyof CycleFormValues): React.CSSProperties {
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
      const created = await performanceApi.createCycle(companyId, {
        Name:      values.name,
        Type:      values.type,
        StartDate: values.startDate,
        EndDate:   values.endDate,
        CreatedBy: userId,
      });
      nav(`/hr/performance/cycles/${created.id}`);
    } catch (e) {
      setApiError(getApiError(e, 'Failed to create cycle.'));
    } finally {
      setSaving(false);
    }
  }

  const fe = fieldErrs;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Performance</div>
          <div className="page-title">New Review Cycle</div>
          <div className="page-sub">Set up a performance review period</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating...' : 'Create Cycle'}
          </button>
          <button className="btn" onClick={() => nav('/hr/performance')} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>

      {apiError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{apiError}</div>}

      {Object.keys(fe).length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          Please fix the following before saving:
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
            Cycle Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>

            <div style={{ gridColumn: 'span 2' }}>
              <Field label="Cycle Name" required error={fe.name} fieldKey="name">
                <input
                  type="text"
                  className="input"
                  value={values.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Annual Review 2025"
                  style={inputStyle('name')}
                />
              </Field>
            </div>

            <Field label="Cycle Type" required error={fe.type} fieldKey="type">
              <select
                className="select"
                value={values.type}
                onChange={e => set('type', e.target.value)}
                style={inputStyle('type')}
              >
                {CYCLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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

          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create Cycle'}
          </button>
          <button type="button" className="btn" onClick={() => nav('/hr/performance')} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}