// src/features/hr/pages/employees/EmployeeFormPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { employeeApi, orgStructureApi } from '../../api/hrApi';
import type { EmployeeDetailDto, DepartmentDto,PositionDto,EmploymentStatus } from '../../types/index';
import { getApiError, fmtDate } from '../../utils/hrUtils';

// =============================================================================
// Types
// =============================================================================

interface EmployeeFormValues {
  // Personal
  firstName:       string;
  fatherName:      string;
  grandFatherName: string;
  gender:          string;
  dateOfBirth:     string;
  maritalStatus:   string;
  phoneNumber:     string;
  address:         string;
  nationalId:      string;
  taxId:           string;
  pensionId:       string;
  // Employment — IDs sent to server, names shown in UI
  departmentId:    string;
  positionId:      string;
  managerId:       string;
  hireDate:        string;
  employmentType:  string;
  workEmail:       string;
  status:          EmploymentStatus;
  // Compensation
  basicSalary:     number | '';
  bankName:        string;
  bankAccountNo:   string;
}

type FieldErrors = Partial<Record<keyof EmployeeFormValues, string>>;

// =============================================================================
// Constants
// =============================================================================

const EMPTY: EmployeeFormValues = {
  firstName:       '',
  fatherName:      '',
  grandFatherName: '',
  gender:          '',
  dateOfBirth:     '',
  maritalStatus:   '',
  phoneNumber:     '',
  address:         '',
  nationalId:      '',
  taxId:           '',
  pensionId:       '',
  departmentId:    '',
  positionId:      '',
  managerId:       '',
  hireDate:        new Date().toISOString().slice(0, 10),
  employmentType:  'FullTime',
  workEmail:       '',
  status:          'Probation',
  basicSalary:     '',
  bankName:        '',
  bankAccountNo:   '',
};

const EMPLOYMENT_TYPES = ['FullTime', 'PartTime', 'Contract', 'Casual', 'Intern'];
const GENDERS          = ['Male', 'Female', 'Other'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];
const STATUS_OPTIONS: EmploymentStatus[] = ['Probation', 'Active', 'Suspended', 'OnLeave', 'Terminated'];

// =============================================================================
// Validation
// =============================================================================

function validate(v: EmployeeFormValues): FieldErrors {
  const errs: FieldErrors = {};
  if (!v.firstName.trim())        errs.firstName       = 'First name is required.';
  if (!v.fatherName.trim())       errs.fatherName      = "Father's name is required.";
  if (!v.grandFatherName.trim())  errs.grandFatherName = "Grandfather's name is required.";
  if (!v.workEmail.trim())        errs.workEmail       = 'Work email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.workEmail))
                                  errs.workEmail       = 'Enter a valid email address.';
  if (!v.hireDate)                errs.hireDate        = 'Hire date is required.';
  if (!v.departmentId)            errs.departmentId    = 'Department is required.';
  if (!v.positionId)              errs.positionId      = 'Position is required.';
  if (!v.employmentType)          errs.employmentType  = 'Employment type is required.';
  if (!v.status)                  errs.status          = 'Status is required.';
  if (v.basicSalary === '' || Number(v.basicSalary) < 0)
                                  errs.basicSalary     = 'Enter a valid salary.';
  return errs;
}

// =============================================================================
// Helpers
// =============================================================================

function fromDto(
  dto: EmployeeDetailDto,
  departments: DepartmentDto[],
  positions: PositionDto[]
): EmployeeFormValues {
  // Match names back to IDs for edit mode
  const dept = departments.find(d => d.name === dto.departmentName);
  const pos  = positions.find(p => p.title === dto.positionTitle);
  return {
    firstName:       dto.fullName?.split(' ')[0]             ?? '',
    fatherName:      dto.fullName?.split(' ')[1]             ?? '',
    grandFatherName: dto.fullName?.split(' ').slice(2).join(' ') ?? '',
    gender:          dto.gender        ?? '',
    dateOfBirth:     dto.dateOfBirth   ? fmtDate(dto.dateOfBirth) : '',
    maritalStatus:   dto.maritalStatus ?? '',
    phoneNumber:     dto.phoneNumber   ?? '',
    address:         dto.address       ?? '',
    nationalId:      dto.nationalId    ?? '',
    taxId:           dto.taxId         ?? '',
    pensionId:       dto.pensionId     ?? '',
    departmentId:    dept?.id          ?? '',
    positionId:      pos?.id           ?? '',
    managerId:       '',   // manager lookup requires separate query
    hireDate:        dto.hireDate ? fmtDate(dto.hireDate) : '',
    employmentType:  dto.employmentType ?? 'FullTime',
    workEmail:       dto.workEmail      ?? '',
    status:          dto.status,
    basicSalary:     dto.basicSalary    ?? '',
    bankName:        dto.bankName       ?? '',
    bankAccountNo:   dto.bankAccountNo  ?? '',
  };
}

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
        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4, lineHeight: 1.4 }}>
          {error}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function EmployeeFormPage() {
  const nav = useNavigate();
  const { employeeId }              = useParams<{ employeeId?: string }>();
  const { companyId, branchId, userId } = useAppScope();
  const isEdit = Boolean(employeeId);

  const [values,      setValues]      = useState<EmployeeFormValues>(EMPTY);
  const [fieldErrs,   setFieldErrs]   = useState<FieldErrors>({});
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [positions,   setPositions]   = useState<PositionDto[]>([]);
  const [allPositions, setAllPositions] = useState<PositionDto[]>([]);

  // ── Load reference data ──────────────────────────────────────────────────



  // ── Load existing employee in edit mode ──────────────────────────────────

  const loadEmployee = useCallback(async (depts: DepartmentDto[], pos: PositionDto[]) => {
    if (!isEdit || !companyId || !employeeId) return;
    setLoading(true); setApiError(null);
    try {
      const dto = await employeeApi.get(companyId, employeeId);
      setValues(fromDto(dto, depts, pos));
    } catch (e) {
      setApiError(getApiError(e, 'Failed to load employee.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId, isEdit]);

  useEffect(() => {
    (async () => {
      if (!companyId) return;
      const [depts, pos] = await Promise.all([
        orgStructureApi.listDepartments(companyId, { branchId: branchId ?? undefined }),
        orgStructureApi.listPositions(companyId),
      ]);
      setDepartments(depts);
      setAllPositions(pos);
      setPositions(pos);
      if (isEdit) await loadEmployee(depts, pos);
    })();
  }, [companyId, branchId, isEdit, loadEmployee]);

  // ── Field helpers ────────────────────────────────────────────────────────

  function set<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: value }));
    if (fieldErrs[key]) setFieldErrs(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  // When department changes — cascade positions and clear positionId
  function handleDepartmentChange(deptId: string) {
    set('departmentId', deptId);
    set('positionId', '');
    setPositions(deptId
      ? allPositions.filter(p => p.departmentId === deptId)
      : allPositions);
  }

  function inputStyle(key: keyof EmployeeFormValues): React.CSSProperties {
    return { width: '100%', height: 34, fontSize: 13, padding: '0 10px', ...errBorder(!!fieldErrs[key]) };
  }

  function input(key: keyof EmployeeFormValues, type = 'text') {
    return (
      <input
        type={type}
        className="input"
        value={values[key] as string}
        onChange={e => set(key, e.target.value as EmployeeFormValues[typeof key])}
        style={inputStyle(key)}
      />
    );
  }

  function selectEl(key: keyof EmployeeFormValues, options: { value: string; label: string }[]) {
    return (
      <select
        className="select"
        value={values[key] as string}
        onChange={e => set(key, e.target.value as EmployeeFormValues[typeof key])}
        style={inputStyle(key)}
      >
        <option value="">Select...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  function simpleSelect(key: keyof EmployeeFormValues, options: string[]) {
    return selectEl(key, options.map(o => ({ value: o, label: o })));
  }

  // ── Submit ───────────────────────────────────────────────────────────────

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
      const salary = values.basicSalary === '' ? 0 : Number(values.basicSalary);

      if (isEdit && employeeId) {
        await Promise.all([
          employeeApi.updatePersonalInfo(companyId, employeeId, {
            FirstName:       values.firstName,
            FatherName:      values.fatherName,
            GrandFatherName: values.grandFatherName,
            Gender:          values.gender,
            DateOfBirth:     values.dateOfBirth,
            MaritalStatus:   values.maritalStatus,
            PhoneNumber:     values.phoneNumber,
            Address:         values.address,
            NationalId:      values.nationalId,
            TaxId:           values.taxId,
            PensionId:       values.pensionId,
            UpdatedBy:       userId,
          }),
          employeeApi.updateEmployment(companyId, employeeId, {
            DepartmentId:   values.departmentId,
            PositionId:     values.positionId,
            ManagerId:      values.managerId || null,
            HireDate:       values.hireDate,
            EmploymentType: values.employmentType,
            WorkEmail:      values.workEmail,
            Status:         values.status,
            UpdatedBy:      userId,
          }),
          employeeApi.updateCompensation(companyId, employeeId, {
            BasicSalary:   salary,
            BankName:      values.bankName,
            BankAccountNo: values.bankAccountNo,
            UpdatedBy:     userId,
          }),
        ]);
        nav(`/hr/employees/${employeeId}`);
      } else {
        const created = await employeeApi.create(companyId, {
          BranchId:        branchId,
          FirstName:       values.firstName,
          FatherName:      values.fatherName,
          GrandFatherName: values.grandFatherName,
          Gender:          values.gender,
          DateOfBirth:     values.dateOfBirth,
          MaritalStatus:   values.maritalStatus,
          PhoneNumber:     values.phoneNumber,
          Address:         values.address,
          NationalId:      values.nationalId,
          TaxId:           values.taxId,
          PensionId:       values.pensionId,
          DepartmentId:    values.departmentId,
          PositionId:      values.positionId,
          ManagerId:       values.managerId || null,
          HireDate:        values.hireDate,
          EmploymentType:  values.employmentType,
          WorkEmail:       values.workEmail,
          Status:          values.status,
          BasicSalary:     salary,
          BankName:        values.bankName,
          BankAccountNo:   values.bankAccountNo,
        });
        nav(`/hr/employees/${created.id}`);
      }
    } catch (e) {
      setApiError(getApiError(e, 'Failed to save employee.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    );
  }

  const fe = fieldErrs;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Employees</div>
          <div className="page-title">{isEdit ? 'Edit Employee' : 'New Employee'}</div>
          <div className="page-sub">
            {isEdit ? 'Update employee information' : 'Create a new employee record'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Employee'}
          </button>
          <button className="btn" disabled={saving}
            onClick={() => nav(isEdit ? `/hr/employees/${employeeId}` : '/hr/employees')}>
            Cancel
          </button>
        </div>
      </div>

      {apiError && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>{apiError}</div>
      )}
      {Object.keys(fe).length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          Please fix the following before saving:
          <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
            {Object.values(fe).map((msg, i) => <li key={i}>{msg}</li>)}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>

        {/* Personal Information */}
        <FormSection title="Personal Information">
          <Field label="First Name" required error={fe.firstName} fieldKey="firstName">
            {input('firstName')}
          </Field>
          <Field label="Father's Name" required error={fe.fatherName} fieldKey="fatherName">
            {input('fatherName')}
          </Field>
          <Field label="Grandfather's Name" required error={fe.grandFatherName} fieldKey="grandFatherName">
            {input('grandFatherName')}
          </Field>
          <Field label="Gender" error={fe.gender} fieldKey="gender">
            {simpleSelect('gender', GENDERS)}
          </Field>

          <Field label="Date of Birth" error={fe.dateOfBirth} fieldKey="dateOfBirth">
            {input('dateOfBirth', 'date')}
          </Field>
          <Field label="Marital Status" error={fe.maritalStatus} fieldKey="maritalStatus">
            {simpleSelect('maritalStatus', MARITAL_STATUSES)}
          </Field>
          <Field label="Phone Number" error={fe.phoneNumber} fieldKey="phoneNumber">
            {input('phoneNumber', 'tel')}
          </Field>
          <Field label="National ID" error={fe.nationalId} fieldKey="nationalId">
            {input('nationalId')}
          </Field>

          <Field label="Tax ID" error={fe.taxId} fieldKey="taxId">
            {input('taxId')}
          </Field>
          <Field label="Pension ID" error={fe.pensionId} fieldKey="pensionId">
            {input('pensionId')}
          </Field>
          <Field label="Address" span={2} error={fe.address} fieldKey="address">
            {input('address')}
          </Field>
        </FormSection>

        {/* Employment Details */}
        <FormSection title="Employment Details">
          <Field label="Work Email" required span={2} error={fe.workEmail} fieldKey="workEmail">
            {input('workEmail', 'email')}
          </Field>
          <Field label="Employment Type" required error={fe.employmentType} fieldKey="employmentType">
            {simpleSelect('employmentType', EMPLOYMENT_TYPES)}
          </Field>
          <Field label="Status" required error={fe.status} fieldKey="status">
            {simpleSelect('status', STATUS_OPTIONS)}
          </Field>

          {/* Cascading: Department → Position */}
          <Field label="Department" required error={fe.departmentId} fieldKey="departmentId">
            <select
              className="select"
              value={values.departmentId}
              onChange={e => handleDepartmentChange(e.target.value)}
              style={inputStyle('departmentId')}
            >
              <option value="">Select department...</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Position" required error={fe.positionId} fieldKey="positionId">
            <select
              className="select"
              value={values.positionId}
              onChange={e => set('positionId', e.target.value)}
              disabled={!values.departmentId}
              style={{
                ...inputStyle('positionId'),
                opacity: !values.departmentId ? 0.5 : 1,
              }}
            >
              <option value="">
                {values.departmentId ? 'Select position...' : 'Select department first'}
              </option>
              {positions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title}{p.level ? ` (${p.level})` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Hire Date" required error={fe.hireDate} fieldKey="hireDate">
            {input('hireDate', 'date')}
          </Field>
        </FormSection>

        {/* Compensation & Banking */}
        <FormSection title="Compensation & Banking">
          <Field label="Basic Salary" required error={fe.basicSalary} fieldKey="basicSalary">
            <input
              type="number"
              className="input"
              value={values.basicSalary}
              onChange={e => set('basicSalary', e.target.value === '' ? '' : Number(e.target.value))}
              min={0}
              step={0.01}
              style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px', ...errBorder(!!fe.basicSalary) }}
            />
          </Field>
          <Field label="Bank Name" error={fe.bankName} fieldKey="bankName">
            {input('bankName')}
          </Field>
          <Field label="Bank Account No" span={2} error={fe.bankAccountNo} fieldKey="bankAccountNo">
            {input('bankAccountNo')}
          </Field>
        </FormSection>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Employee'}
          </button>
          <button type="button" className="btn" disabled={saving}
            onClick={() => nav(isEdit ? `/hr/employees/${employeeId}` : '/hr/employees')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}