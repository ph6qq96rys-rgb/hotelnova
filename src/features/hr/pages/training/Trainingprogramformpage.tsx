// src/features/hr/pages/training/TrainingProgramFormPage.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { trainingApi } from '../../api/hrApi';
import { getApiError } from '../../utils/hrUtils';

// =============================================================================
// Types
// =============================================================================

interface ProgramFormValues {
  code:          string;
  title:         string;
  category:      string;
  mode:          string;
  durationHours: number | '';
  isMandatory:   boolean;
  provider:      string;
  cost:          number | '';
  description:   string;
  objectives:    string;
}

type FieldErrors = Partial<Record<keyof ProgramFormValues, string>>;

const EMPTY: ProgramFormValues = {
  code:          '',
  title:         '',
  category:      '',
  mode:          'InPerson',
  durationHours: '',
  isMandatory:   false,
  provider:      '',
  cost:          '',
  description:   '',
  objectives:    '',
};

const CATEGORIES = ['Technical', 'Soft Skills', 'Compliance', 'Leadership', 'Safety', 'Onboarding', 'Other'];
const MODES      = ['InPerson', 'Online', 'Hybrid', 'SelfPaced'];

// =============================================================================
// Validation
// =============================================================================

function validate(v: ProgramFormValues): FieldErrors {
  const errs: FieldErrors = {};
  if (!v.code.trim())                                    errs.code          = 'Code is required.';
  if (!v.title.trim())                                   errs.title         = 'Title is required.';
  if (!v.category)                                       errs.category      = 'Category is required.';
  if (!v.mode)                                           errs.mode          = 'Mode is required.';
  if (v.durationHours === '' || Number(v.durationHours) <= 0)
                                                         errs.durationHours = 'Duration must be greater than 0.';
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

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16,
      }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

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

export default function TrainingProgramFormPage() {
  const nav               = useNavigate();
  const { companyId, userId } = useAppScope();

  const [values,    setValues]    = useState<ProgramFormValues>(EMPTY);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);

  function set<K extends keyof ProgramFormValues>(key: K, value: ProgramFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: value }));
    if (fieldErrs[key]) setFieldErrs(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  function inputStyle(key: keyof ProgramFormValues): React.CSSProperties {
    return { width: '100%', height: 34, fontSize: 13, padding: '0 10px', ...errBorder(!!fieldErrs[key]) };
  }

  function input(key: keyof ProgramFormValues, type = 'text') {
    return (
      <input
        type={type}
        className="input"
        value={values[key] as string}
        onChange={e => set(key, e.target.value as ProgramFormValues[typeof key])}
        style={inputStyle(key)}
      />
    );
  }

  function selectEl(key: keyof ProgramFormValues, options: string[]) {
    return (
      <select
        className="select"
        value={values[key] as string}
        onChange={e => set(key, e.target.value as ProgramFormValues[typeof key])}
        style={inputStyle(key)}
      >
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
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
      const created = await trainingApi.createProgram(companyId, {
        Code:          values.code,
        Title:         values.title,
        Category:      values.category,
        Mode:          values.mode,
        DurationHours: Number(values.durationHours),
        IsMandatory:   values.isMandatory,
        Provider:      values.provider || null,
        Cost:          values.cost === '' ? null : Number(values.cost),
        Description:   values.description || null,
        Objectives:    values.objectives || null,
        CreatedBy:     userId,
      });
      nav(`/hr/training/programs/${created.id}`);
    } catch (e) {
      setApiError(getApiError(e, 'Failed to create training program.'));
    } finally {
      setSaving(false);
    }
  }

  const fe = fieldErrs;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Training</div>
          <div className="page-title">New Training Program</div>
          <div className="page-sub">Define a reusable training program for scheduling</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating...' : 'Create Program'}
          </button>
          <button className="btn" onClick={() => nav('/hr/training')} disabled={saving}>
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

        {/* Program Details */}
        <FormSection title="Program Details">
          <Field label="Program Code" required error={fe.code} fieldKey="code">
            {input('code')}
          </Field>
          <Field label="Title" required span={2} error={fe.title} fieldKey="title">
            {input('title')}
          </Field>
          <Field label="Category" required error={fe.category} fieldKey="category">
            {selectEl('category', CATEGORIES)}
          </Field>

          <Field label="Mode" required error={fe.mode} fieldKey="mode">
            {selectEl('mode', MODES)}
          </Field>
          <Field label="Duration (hours)" required error={fe.durationHours} fieldKey="durationHours">
            <input
              type="number"
              className="input"
              value={values.durationHours}
              onChange={e => set('durationHours', e.target.value === '' ? '' : Number(e.target.value))}
              min={0.5}
              step={0.5}
              style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px', ...errBorder(!!fe.durationHours) }}
            />
          </Field>
          <Field label="Provider" error={fe.provider} fieldKey="provider">
            {input('provider')}
          </Field>
          <Field label="Cost (ETB)" error={fe.cost} fieldKey="cost">
            <input
              type="number"
              className="input"
              value={values.cost}
              onChange={e => set('cost', e.target.value === '' ? '' : Number(e.target.value))}
              min={0}
              step={0.01}
              placeholder="0.00"
              style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px', ...errBorder(!!fe.cost) }}
            />
          </Field>

          {/* Mandatory toggle */}
          <div style={{ gridColumn: 'span 4' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={values.isMandatory}
                onChange={e => set('isMandatory', e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span>
                <strong>Mandatory</strong>
                <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>
                  All active employees will be required to complete this program
                </span>
              </span>
            </label>
          </div>
        </FormSection>

        {/* Description & Objectives */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16,
          }}>
            Description & Objectives
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                Description
              </label>
              <textarea
                className="input"
                value={values.description}
                onChange={e => set('description', e.target.value)}
                rows={4}
                placeholder="Describe the program content, target audience, and prerequisites..."
                style={{ width: '100%', fontSize: 13, padding: '8px 10px', resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                Learning Objectives
              </label>
              <textarea
                className="input"
                value={values.objectives}
                onChange={e => set('objectives', e.target.value)}
                rows={3}
                placeholder="List the key skills and knowledge participants will gain..."
                style={{ width: '100%', fontSize: 13, padding: '8px 10px', resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create Program'}
          </button>
          <button type="button" className="btn" onClick={() => nav('/hr/training')} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}