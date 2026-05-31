// src/features/hr/pages/recruitment/JobPostingFormPage.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { recruitmentApi } from '../../api/hrApi';
import { getApiError } from '../../utils/hrUtils';

// =============================================================================
// Types
// =============================================================================

interface JobPostingFormValues {
  title:          string;
  departmentName: string;
  employmentType: string;
  vacancyCount:   number | '';
  closingDate:    string;
  description:    string;
  requirements:   string;
  salaryMin:      number | '';
  salaryMax:      number | '';
  location:       string;
}

type FieldErrors = Partial<Record<keyof JobPostingFormValues, string>>;

// =============================================================================
// Constants
// =============================================================================

const EMPTY: JobPostingFormValues = {
  title:          '',
  departmentName: '',
  employmentType: 'FullTime',
  vacancyCount:   '',
  closingDate:    '',
  description:    '',
  requirements:   '',
  salaryMin:      '',
  salaryMax:      '',
  location:       '',
};

const EMPLOYMENT_TYPES = ['FullTime', 'PartTime', 'Contract', 'Casual', 'Intern'];

// =============================================================================
// Validation
// =============================================================================

function validate(v: JobPostingFormValues): FieldErrors {
  const errs: FieldErrors = {};
  if (!v.title.trim())          errs.title          = 'Job title is required.';
  if (!v.departmentName.trim()) errs.departmentName = 'Department is required.';
  if (!v.employmentType)        errs.employmentType = 'Employment type is required.';
  if (v.vacancyCount === '' || Number(v.vacancyCount) < 1)
                                errs.vacancyCount   = 'At least 1 vacancy is required.';
  if (!v.closingDate)           errs.closingDate    = 'Closing date is required.';
  if (!v.description.trim())    errs.description    = 'Job description is required.';
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
      {error && (
        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function JobPostingFormPage() {
  const nav           = useNavigate();
  const { companyId, userId } = useAppScope();

  const [values,    setValues]    = useState<JobPostingFormValues>(EMPTY);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);

  function set<K extends keyof JobPostingFormValues>(key: K, value: JobPostingFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: value }));
    if (fieldErrs[key]) setFieldErrs(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  function inputStyle(key: keyof JobPostingFormValues): React.CSSProperties {
    return { width: '100%', height: 34, fontSize: 13, padding: '0 10px', ...errBorder(!!fieldErrs[key]) };
  }

  function input(key: keyof JobPostingFormValues, type = 'text') {
    return (
      <input
        type={type}
        className="input"
        value={values[key] as string}
        onChange={e => set(key, e.target.value as JobPostingFormValues[typeof key])}
        style={inputStyle(key)}
      />
    );
  }

  function selectEl(key: keyof JobPostingFormValues, options: string[]) {
    return (
      <select
        className="select"
        value={values[key] as string}
        onChange={e => set(key, e.target.value as JobPostingFormValues[typeof key])}
        style={inputStyle(key)}
      >
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  function numericInput(key: keyof JobPostingFormValues, min = 0) {
    return (
      <input
        type="number"
        className="input"
        value={values[key] as number | ''}
        onChange={e => set(key, e.target.value === '' ? '' : Number(e.target.value))}
        min={min}
        style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px', ...errBorder(!!fieldErrs[key]) }}
      />
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;

    const errs = validate(values);
    if (Object.keys(errs).length > 0) {
      setFieldErrs(errs);
      const firstKey = Object.keys(errs)[0];
      document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`)?.scrollIntoView({
        behavior: 'smooth', block: 'center',
      });
      return;
    }

    setSaving(true); setApiError(null);
    try {
      const created = await recruitmentApi.createPosting(companyId, {
        Title:          values.title,
        DepartmentName: values.departmentName,
        EmploymentType: values.employmentType,
        VacancyCount:   Number(values.vacancyCount),
        ClosingDate:    values.closingDate,
        Description:    values.description,
        Requirements:   values.requirements,
        SalaryMin:      values.salaryMin === '' ? null : Number(values.salaryMin),
        SalaryMax:      values.salaryMax === '' ? null : Number(values.salaryMax),
        Location:       values.location,
        CreatedBy:      userId,
      });
      nav(`/hr/recruitment/${created.id}`);
    } catch (e) {
      setApiError(getApiError(e, 'Failed to create job posting.'));
    } finally {
      setSaving(false);
    }
  }

  const fe = fieldErrs;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Recruitment</div>
          <div className="page-title">New Job Posting</div>
          <div className="page-sub">Create a new vacancy for applicants</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Publishing...' : 'Publish Posting'}
          </button>
          <button className="btn" onClick={() => nav('/hr/recruitment')} disabled={saving}>
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

        {/* Posting Details */}
        <FormSection title="Posting Details">
          <Field label="Job Title" required span={2} error={fe.title} fieldKey="title">
            {input('title')}
          </Field>
          <Field label="Department" required error={fe.departmentName} fieldKey="departmentName">
            {input('departmentName')}
          </Field>
          <Field label="Employment Type" required error={fe.employmentType} fieldKey="employmentType">
            {selectEl('employmentType', EMPLOYMENT_TYPES)}
          </Field>

          <Field label="Vacancies" required error={fe.vacancyCount} fieldKey="vacancyCount">
            {numericInput('vacancyCount', 1)}
          </Field>
          <Field label="Closing Date" required error={fe.closingDate} fieldKey="closingDate">
            {input('closingDate', 'date')}
          </Field>
          <Field label="Location" error={fe.location} fieldKey="location">
            {input('location')}
          </Field>
        </FormSection>

        {/* Compensation */}
        <FormSection title="Compensation (Optional)">
          <Field label="Salary Min" error={fe.salaryMin} fieldKey="salaryMin">
            {numericInput('salaryMin')}
          </Field>
          <Field label="Salary Max" error={fe.salaryMax} fieldKey="salaryMax">
            {numericInput('salaryMax')}
          </Field>
        </FormSection>

        {/* Description */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16,
          }}>
            Job Description & Requirements
          </div>

          <div style={{ marginBottom: 16 }} data-field="description">
            <label style={{
              display: 'block', fontSize: 11, marginBottom: 4,
              color: fe.description ? 'var(--danger)' : 'var(--text-muted)',
            }}>
              Description <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              className="input"
              value={values.description}
              onChange={e => set('description', e.target.value)}
              rows={6}
              placeholder="Describe the role, responsibilities, and expectations..."
              style={{
                width: '100%', fontSize: 13, padding: '8px 10px', resize: 'vertical',
                ...errBorder(!!fe.description),
              }}
            />
            {fe.description && (
              <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{fe.description}</div>
            )}
          </div>

          <div data-field="requirements">
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Requirements
            </label>
            <textarea
              className="input"
              value={values.requirements}
              onChange={e => set('requirements', e.target.value)}
              rows={4}
              placeholder="List qualifications, skills, experience required..."
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Publishing...' : 'Publish Posting'}
          </button>
          <button type="button" className="btn" onClick={() => nav('/hr/recruitment')} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}