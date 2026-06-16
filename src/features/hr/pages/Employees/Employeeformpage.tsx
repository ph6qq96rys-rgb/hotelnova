// src/features/hr/pages/employees/EmployeeFormPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { branchApi, employeeApi, orgStructureApi } from "../../api/hrApi";
import type {
  DepartmentDto,
  EmployeeDetailDto,
  EmploymentStatus,
  PositionDto,
} from "../../types/index";
import { fmtDate, getApiError } from "../../utils/hrUtils";

type NullableString = string | null | undefined;

type EmployeeDetailWithOptionalFields = EmployeeDetailDto & {
  branchId?: NullableString;
  departmentId?: NullableString;
  positionId?: NullableString;
  managerId?: NullableString;
  payFrequency?: NullableString;
  tinNumber?: NullableString;
  tin?: NullableString;
  nationalId?: NullableString;
  businessLicenseNo?: NullableString;
  businessLicenceNo?: NullableString;
  businessLicenseNumber?: NullableString;
  vatNumber?: NullableString;
  pensionId?: NullableString;
};

interface BranchDto {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean | null;
}

interface EmployeeFormValues {
  branchId: string;
  firstName: string;
  fatherName: string;
  grandFatherName: string;
  gender: string;
  dateOfBirth: string;
  phoneNumber: string;
  tinNumber: string;
  nationalId: string;
  businessLicenseNo: string;
  vatNumber: string;
  pensionId: string;
  departmentId: string;
  positionId: string;
  managerId: string;
  hireDate: string;
  employmentType: string;
  payFrequency: string;
  workEmail: string;
  status: EmploymentStatus;
  basicSalary: number | "";
}

type FieldErrors = Partial<Record<keyof EmployeeFormValues, string>>;

const EMPTY: EmployeeFormValues = {
  branchId: "",
  firstName: "",
  fatherName: "",
  grandFatherName: "",
  gender: "Male",
  dateOfBirth: "",
  phoneNumber: "",
  tinNumber: "",
  nationalId: "",
  businessLicenseNo: "",
  vatNumber: "",
  pensionId: "",
  departmentId: "",
  positionId: "",
  managerId: "",
  hireDate: new Date().toISOString().slice(0, 10),
  employmentType: "FullTime",
  payFrequency: "Monthly",
  workEmail: "",
  status: "Probation",
  basicSalary: "",
};

const EMPLOYMENT_TYPES = ["FullTime", "PartTime", "Contract", "Casual", "Intern"];
const GENDERS = ["Male", "Female", "Other"];
const PAY_FREQUENCIES = ["Daily", "Weekly", "BiWeekly", "Monthly"];
const STATUS_OPTIONS: EmploymentStatus[] = ["Probation", "Active", "Suspended", "OnLeave", "Terminated"];

function cleanText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const c = value as Record<string, unknown>;

  for (const key of ["items", "data", "value", "results", "records"]) {
    if (Array.isArray(c[key])) return c[key] as T[];
  }

  return [];
}

function extractCreatedId(response: unknown): string | null {
  if (!response) return null;

  if (typeof response === "string" && response.trim().length > 0) {
    return response.trim();
  }

  if (typeof response === "object") {
    const r = response as Record<string, unknown>;
    const direct = r.id ?? r.employeeId ?? r.employee_id ?? r.Id ?? r.EmployeeId;

    if (typeof direct === "string" && direct.trim().length > 0) {
      return direct.trim();
    }

    const nested = r.data ?? r.value ?? r.result;

    if (nested && typeof nested === "object") {
      const n = nested as Record<string, unknown>;
      const nestedId = n.id ?? n.employeeId ?? n.employee_id;

      if (typeof nestedId === "string" && nestedId.trim().length > 0) {
        return nestedId.trim();
      }
    }
  }

  return null;
}

function validate(v: EmployeeFormValues): FieldErrors {
  const errs: FieldErrors = {};

  if (!v.firstName.trim()) errs.firstName = "First name is required.";
  if (!v.fatherName.trim()) errs.fatherName = "Father name is required.";
  if (!v.grandFatherName.trim()) errs.grandFatherName = "Grandfather name is required.";

  if (v.workEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.workEmail)) {
    errs.workEmail = "Enter a valid email address.";
  }

  if (v.basicSalary !== "" && Number(v.basicSalary) < 0) {
    errs.basicSalary = "Salary cannot be negative.";
  }

  return errs;
}

function fromDto(dto: EmployeeDetailDto): EmployeeFormValues {
  const source = dto as EmployeeDetailWithOptionalFields;
  const names = dto.fullName?.split(" ").filter(Boolean) ?? [];

  return {
    ...EMPTY,
    branchId: source.branchId ?? "",
    firstName: names[0] ?? "",
    fatherName: names[1] ?? "",
    grandFatherName: names.slice(2).join(" "),
    gender: dto.gender ?? "Male",
    dateOfBirth: dto.dateOfBirth ? fmtDate(dto.dateOfBirth) : "",
    phoneNumber: dto.phoneNumber ?? "",
    tinNumber: source.tinNumber ?? source.tin ?? "",
    nationalId: source.nationalId ?? "",
    businessLicenseNo:
      source.businessLicenseNo ??
      source.businessLicenceNo ??
      source.businessLicenseNumber ??
      "",
    vatNumber: source.vatNumber ?? "",
    pensionId: source.pensionId ?? "",
    departmentId: source.departmentId ?? "",
    positionId: source.positionId ?? "",
    managerId: source.managerId ?? "",
    hireDate: dto.hireDate ? fmtDate(dto.hireDate) : EMPTY.hireDate,
    employmentType: dto.employmentType ?? "FullTime",
    payFrequency: source.payFrequency ?? EMPTY.payFrequency,
    workEmail: dto.workEmail ?? "",
    status: dto.status,
    basicSalary: dto.basicSalary ?? "",
  };
}

function getFullName(v: EmployeeFormValues): string {
  return [v.firstName, v.fatherName, v.grandFatherName]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(" ");
}

const css = `
.emp-master {
  min-height: 100%;
  background: #f5f7fb;
  color: #111827;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.emp-command {
  position: sticky;
  top: 0;
  z-index: 40;
  border-bottom: 1px solid #e5e7eb;
  background: rgba(255,255,255,.96);
  backdrop-filter: blur(12px);
}

.emp-command-inner {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 28px;
}

.emp-breadcrumb {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #64748b;
}

.emp-title-line {
  display: flex;
  align-items: center;
  gap: 12px;
}

.emp-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.15;
  font-weight: 750;
  letter-spacing: -0.025em;
}

.emp-subtitle {
  margin-top: 5px;
  font-size: 13px;
  color: #64748b;
}

.emp-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.emp-btn {
  height: 38px;
  padding: 0 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 9px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #111827;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  transition: .12s ease;
}

.emp-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.emp-btn:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.emp-btn-primary {
  background: #111827;
  border-color: #111827;
  color: white;
  box-shadow: 0 10px 22px rgba(17,24,39,.16);
}

.emp-btn-primary:hover:not(:disabled) {
  background: #020617;
  border-color: #020617;
}

.emp-status {
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: white;
  font-size: 12px;
  font-weight: 700;
  color: #334155;
}

.emp-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #64748b;
}

.emp-dot.Active { background: #16a34a; }
.emp-dot.Probation { background: #f59e0b; }
.emp-dot.Suspended { background: #ef4444; }
.emp-dot.OnLeave { background: #3b82f6; }
.emp-dot.Terminated { background: #64748b; }

.emp-layout {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr) 310px;
  gap: 22px;
  padding: 24px 28px 44px;
  align-items: start;
}

.emp-left,
.emp-right {
  position: sticky;
  top: 98px;
}

.emp-card {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 30px rgba(15,23,42,.045);
  overflow: hidden;
}

.emp-card-head {
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(180deg,#fff,#f8fafc);
}

.emp-card-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #64748b;
}

.emp-nav {
  padding: 8px;
}

.emp-nav-btn {
  width: 100%;
  min-height: 38px;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #475569;
  font-size: 13px;
  font-weight: 650;
  text-align: left;
  cursor: pointer;
}

.emp-nav-btn:hover {
  background: #f1f5f9;
  color: #111827;
}

.emp-nav-btn i {
  font-size: 17px;
  color: #64748b;
}

.emp-main {
  min-width: 0;
}

.emp-section {
  margin-bottom: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 12px 30px rgba(15,23,42,.045);
  overflow: hidden;
}

.emp-section-head {
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(180deg,#fff,#fbfdff);
}

.emp-section-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #0f172a;
}

.emp-section-icon i {
  font-size: 18px;
}

.emp-section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
}

.emp-section-desc {
  margin-top: 3px;
  font-size: 12.5px;
  color: #64748b;
}

.emp-section-body {
  padding: 20px;
  display: grid;
  gap: 17px 18px;
}

.emp-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.emp-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.emp-span-2 { grid-column: span 2; }
.emp-span-3 { grid-column: span 3; }

.emp-field {
  min-width: 0;
}

.emp-label {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 7px;
  font-size: 12px;
  font-weight: 700;
  color: #374151;
}

.emp-required {
  color: #dc2626;
}

.emp-hint {
  color: #94a3b8;
  font-weight: 600;
}

.emp-input,
.emp-select {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #fff;
  color: #111827;
  font: inherit;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  transition: border-color .12s, box-shadow .12s, background .12s;
}

.emp-input::placeholder {
  color: #9ca3af;
}

.emp-input:focus,
.emp-select:focus {
  border-color: #111827;
  box-shadow: 0 0 0 3px rgba(15,23,42,.08);
}

.emp-input.error,
.emp-select.error {
  border-color: #dc2626;
  box-shadow: 0 0 0 3px rgba(220,38,38,.08);
}

.emp-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 34px;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.emp-input:disabled,
.emp-select:disabled {
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
}

.emp-error {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  font-size: 11.5px;
  font-weight: 650;
  color: #b91c1c;
}

.emp-alert {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  padding: 13px 15px;
  border-radius: 13px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  font-size: 13px;
  font-weight: 650;
}

.emp-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.emp-pill {
  height: 34px;
  padding: 0 13px;
  display: inline-flex;
  align-items: center;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #fff;
  color: #374151;
  font-size: 12.5px;
  font-weight: 750;
  cursor: pointer;
}

.emp-pill:hover {
  background: #f8fafc;
}

.emp-pill.selected {
  background: #111827;
  border-color: #111827;
  color: #fff;
}

.emp-money {
  position: relative;
}

.emp-currency {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.emp-snapshot {
  padding: 16px;
}

.emp-avatar {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  margin-bottom: 12px;
  border-radius: 18px;
  background: #111827;
  color: #fff;
  font-size: 20px;
  font-weight: 850;
}

.emp-name {
  font-size: 16px;
  font-weight: 850;
  line-height: 1.25;
}

.emp-meta {
  margin-top: 4px;
  font-size: 12.5px;
  color: #64748b;
}

.emp-divider {
  height: 1px;
  margin: 15px 0;
  background: #e5e7eb;
}

.emp-kv {
  display: grid;
  gap: 11px;
}

.emp-kv-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  font-size: 12.5px;
}

.emp-kv-label {
  color: #64748b;
}

.emp-kv-value {
  max-width: 155px;
  text-align: right;
  color: #111827;
  font-weight: 750;
}

.emp-muted {
  color: #94a3b8;
  font-weight: 650;
}

.emp-validation {
  padding: 12px 16px 16px;
}

.emp-validation-item {
  display: flex;
  gap: 7px;
  margin-bottom: 7px;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.35;
}

.emp-footer {
  position: sticky;
  bottom: 0;
  z-index: 20;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: rgba(255,255,255,.96);
  backdrop-filter: blur(12px);
  box-shadow: 0 -8px 28px rgba(15,23,42,.07);
}

.emp-footer-note {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #64748b;
  font-size: 12.5px;
  font-weight: 600;
}

.emp-skeleton {
  border-radius: 18px;
  background: #e5e7eb;
  animation: emp-pulse 1.4s ease-in-out infinite;
}

@keyframes emp-pulse {
  0%,100% { opacity: 1; }
  50% { opacity: .45; }
}

@media (max-width: 1240px) {
  .emp-layout {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .emp-right {
    display: none;
  }
}

@media (max-width: 900px) {
  .emp-command-inner {
    flex-direction: column;
    align-items: stretch;
  }

  .emp-actions {
    justify-content: flex-start;
  }

  .emp-layout {
    grid-template-columns: 1fr;
    padding: 18px;
  }

  .emp-left {
    position: static;
  }

  .emp-nav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .emp-grid-2,
  .emp-grid-3 {
    grid-template-columns: 1fr;
  }

  .emp-span-2,
  .emp-span-3 {
    grid-column: span 1;
  }

  .emp-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
`;

function Field({
  label,
  required,
  error,
  fieldKey,
  hint,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  fieldKey?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`emp-field ${className}`} data-field={fieldKey}>
      <div className="emp-label">
        {label}
        {required && <span className="emp-required">*</span>}
        {hint && !error && <span className="emp-hint">— {hint}</span>}
      </div>

      {children}

      {error && (
        <div className="emp-error">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
}

function Section({
  id,
  icon,
  title,
  description,
  gridClass = "emp-grid-3",
  children,
}: {
  id: string;
  icon: string;
  title: string;
  description: string;
  gridClass?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="emp-section" id={id}>
      <div className="emp-section-head">
        <div className="emp-section-icon">
          <i className={`ti ${icon}`} aria-hidden="true" />
        </div>

        <div>
          <h2 className="emp-section-title">{title}</h2>
          <div className="emp-section-desc">{description}</div>
        </div>
      </div>

      <div className={`emp-section-body ${gridClass}`}>{children}</div>
    </section>
  );
}

export default function EmployeeFormPage() {
  const nav = useNavigate();
  const { employeeId } = useParams<{ employeeId?: string }>();
  const { companyId } = useAppScope();

  const isEdit = Boolean(employeeId);

  const [values, setValues] = useState<EmployeeFormValues>(EMPTY);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);

  const branchOptions = useMemo(
    () =>
      ensureArray<BranchDto>(branches)
        .filter((b) => b?.id && b.isActive !== false)
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [branches],
  );

  const selectedBranch = useMemo(
    () => branchOptions.find((x) => x.id === values.branchId),
    [branchOptions, values.branchId],
  );

  const selectedDepartment = useMemo(
    () => ensureArray<DepartmentDto>(departments).find((x) => x.id === values.departmentId),
    [departments, values.departmentId],
  );

  const selectedPosition = useMemo(
    () => ensureArray<PositionDto>(positions).find((x) => x.id === values.positionId),
    [positions, values.positionId],
  );

  const fullName = getFullName(values);

  const initials = useMemo(() => {
    const parts = fullName.split(" ").filter(Boolean);
    if (parts.length === 0) return "EM";
    return parts
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("");
  }, [fullName]);

  const loadDepartments = useCallback(
    async (branchId: string) => {
      if (!companyId) return;

      const depts = await orgStructureApi.listDepartments(companyId, {
        branchId: branchId || undefined,
        activeOnly: true,
      });

      setDepartments(ensureArray<DepartmentDto>(depts));
    },
    [companyId],
  );

  const loadPositions = useCallback(
    async (departmentId: string) => {
      if (!companyId || !departmentId) {
        setPositions([]);
        return;
      }

      const pos = await orgStructureApi.listPositions(companyId, {
        departmentId,
        activeOnly: true,
      });

      setPositions(ensureArray<PositionDto>(pos));
    },
    [companyId],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!companyId) return;

      setLoading(true);
      setApiError(null);

      try {
        const [branchList, departmentList, dto] = await Promise.all([
          branchApi.list(companyId, { activeOnly: true }),
          orgStructureApi.listDepartments(companyId, { activeOnly: true }),
          isEdit && employeeId
            ? employeeApi.get(companyId, employeeId)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setBranches(ensureArray<BranchDto>(branchList));
        setDepartments(ensureArray<DepartmentDto>(departmentList));

        if (dto) {
          const fv = fromDto(dto);
          setValues(fv);

          if (fv.departmentId) {
            await loadPositions(fv.departmentId);
          }
        } else {
          setValues(EMPTY);
          setPositions([]);
        }
      } catch (e) {
        if (!cancelled) {
          setApiError(getApiError(e, "Failed to load employee master data."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [companyId, employeeId, isEdit, loadPositions]);

  function set<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));

    if (fieldErrs[key]) {
      setFieldErrs((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
    }
  }

  async function handleBranchChange(branchId: string) {
    set("branchId", branchId);
    set("departmentId", "");
    set("positionId", "");
    setPositions([]);

    try {
      await loadDepartments(branchId);
    } catch (e) {
      setApiError(getApiError(e, "Failed to load departments."));
    }
  }

  async function handleDepartmentChange(departmentId: string) {
    set("departmentId", departmentId);
    set("positionId", "");

    try {
      await loadPositions(departmentId);
    } catch (e) {
      setApiError(getApiError(e, "Failed to load positions."));
    }
  }

  function inputClass(key: keyof EmployeeFormValues): string {
    return `emp-input${fieldErrs[key] ? " error" : ""}`;
  }

  function selectClass(key: keyof EmployeeFormValues): string {
    return `emp-select${fieldErrs[key] ? " error" : ""}`;
  }

  function goBack() {
    nav(isEdit ? `/hr/employees/${employeeId}` : "/hr/employees");
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();

    if (!companyId) {
      setApiError("Company context is missing.");
      return;
    }

    const errs = validate(values);

    if (Object.keys(errs).length > 0) {
      setFieldErrs(errs);

      document
        .querySelector<HTMLElement>(`[data-field="${Object.keys(errs)[0]}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });

      return;
    }

    setSaving(true);
    setApiError(null);

    const salary = values.basicSalary === "" ? null : Number(values.basicSalary);

    const personal = {
      firstName: values.firstName.trim(),
      fatherName: values.fatherName.trim(),
      grandFatherName: values.grandFatherName.trim(),
      gender: values.gender || null,
      dateOfBirth: values.dateOfBirth || null,
      phoneNumber: cleanText(values.phoneNumber),
      tinNumber: cleanText(values.tinNumber),
      nationalId: cleanText(values.nationalId),
      businessLicenseNo: cleanText(values.businessLicenseNo),
      vatNumber: cleanText(values.vatNumber),
      pensionId: cleanText(values.pensionId),
    };

    const employment = {
      branchId: values.branchId || null,
      departmentId: values.departmentId || null,
      positionId: values.positionId || null,
      managerId: values.managerId || null,
      employmentType: values.employmentType || null,
      hireDate: values.hireDate || null,
      workEmail: cleanText(values.workEmail),
      status: values.status,
    };

    try {
      if (isEdit && employeeId) {
        await Promise.all([
          employeeApi.updatePersonalInfo(companyId, employeeId, personal),
          employeeApi.updateEmployment(companyId, employeeId, employment),
          employeeApi.updateCompensation(companyId, employeeId, {
            basicSalary: salary,
            payFrequency: values.payFrequency || null,
          }),
        ]);

        nav(`/hr/employees/${employeeId}`, { replace: true });
        return;
      }

      const response = await employeeApi.create(companyId, {
        ...personal,
        ...employment,
        basicSalary: salary,
        payFrequency: values.payFrequency || null,
      });

      const createdId = extractCreatedId(response);

      if (createdId) {
        nav(`/hr/employees/${createdId}`, { replace: true });
      } else {
        nav("/hr/employees", { replace: true });
      }
    } catch (e) {
      setApiError(getApiError(e, "Failed to save employee."));
    } finally {
      setSaving(false);
    }
  }

  const errCount = Object.keys(fieldErrs).length;

  if (loading) {
    return (
      <>
        <style>{css}</style>
        <div className="emp-master">
          <div className="emp-command">
            <div className="emp-command-inner">
              <div>
                <div className="emp-breadcrumb">Human Resources / Employees / Master Data</div>
                <h1 className="emp-title">
                  {isEdit ? "Edit Employee Master" : "Create Employee Master"}
                </h1>
                <div className="emp-subtitle">Loading employee master data…</div>
              </div>
            </div>
          </div>

          <div className="emp-layout">
            <div className="emp-skeleton" style={{ height: 260 }} />
            <div>
              {[240, 210, 280, 160].map((h, i) => (
                <div key={i} className="emp-skeleton" style={{ height: h, marginBottom: 16 }} />
              ))}
            </div>
            <div className="emp-skeleton" style={{ height: 360 }} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>

      <div className="emp-master">
        <header className="emp-command">
          <div className="emp-command-inner">
            <div>
              <div className="emp-breadcrumb">
                <i className="ti ti-building-bank" aria-hidden="true" />
                Human Resources
                <i className="ti ti-chevron-right" aria-hidden="true" />
                Employee Master
                <i className="ti ti-chevron-right" aria-hidden="true" />
                {isEdit ? "Edit" : "Create"}
              </div>

              <div className="emp-title-line">
                <h1 className="emp-title">
                  {isEdit ? "Edit Employee Master" : "Create Employee Master"}
                </h1>

                <span className="emp-status">
                  <span className={`emp-dot ${values.status}`} />
                  {values.status}
                </span>
              </div>

              <div className="emp-subtitle">
                Maintain employee identity, statutory information, organization assignment, and payroll profile.
              </div>
            </div>

            <div className="emp-actions">
              <button type="button" className="emp-btn" disabled={saving} onClick={goBack}>
                <i className="ti ti-x" aria-hidden="true" />
                Cancel
              </button>

              <button
                type="button"
                className="emp-btn emp-btn-primary"
                disabled={saving}
                onClick={() => void handleSubmit()}
              >
                {saving ? (
                  <>
                    <i className="ti ti-loader-2" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  <>
                    <i className="ti ti-device-floppy" aria-hidden="true" />
                    {isEdit ? "Save Master" : "Create Master"}
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="emp-layout">
          <aside className="emp-left">
            <div className="emp-card">
              <div className="emp-card-head">
                <div className="emp-card-title">Master Sections</div>
              </div>

              <nav className="emp-nav" aria-label="Employee master sections">
                {[
                  ["sec-identity", "ti-user", "Identity"],
                  ["sec-statutory", "ti-id", "Statutory IDs"],
                  ["sec-organization", "ti-sitemap", "Organization"],
                  ["sec-payroll", "ti-cash", "Payroll"],
                ].map(([id, icon, label]) => (
                  <button
                    key={id}
                    type="button"
                    className="emp-nav-btn"
                    onClick={() =>
                      document.getElementById(id)?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                  >
                    <i className={`ti ${icon}`} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            {errCount > 0 && (
              <div className="emp-card" style={{ marginTop: 14 }}>
                <div className="emp-card-head">
                  <div className="emp-card-title">Validation</div>
                </div>

                <div className="emp-validation">
                  {Object.values(fieldErrs).map((msg, index) => (
                    <div key={index} className="emp-validation-item">
                      <i className="ti ti-alert-triangle" aria-hidden="true" />
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <main className="emp-main">
            {apiError && (
              <div className="emp-alert" role="alert">
                <i className="ti ti-circle-x" aria-hidden="true" />
                <div>{apiError}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <Section
                id="sec-identity"
                icon="ti-user"
                title="Identity"
                description="Legal employee name, demographics, and contact information."
              >
                <Field label="First name" required error={fieldErrs.firstName} fieldKey="firstName">
                  <input
                    className={inputClass("firstName")}
                    value={values.firstName}
                    placeholder="e.g. Abebe"
                    onChange={(e) => set("firstName", e.target.value)}
                  />
                </Field>

                <Field label="Father's name" required error={fieldErrs.fatherName} fieldKey="fatherName">
                  <input
                    className={inputClass("fatherName")}
                    value={values.fatherName}
                    placeholder="e.g. Kebede"
                    onChange={(e) => set("fatherName", e.target.value)}
                  />
                </Field>

                <Field
                  label="Grandfather's name"
                  required
                  error={fieldErrs.grandFatherName}
                  fieldKey="grandFatherName"
                >
                  <input
                    className={inputClass("grandFatherName")}
                    value={values.grandFatherName}
                    placeholder="e.g. Girma"
                    onChange={(e) => set("grandFatherName", e.target.value)}
                  />
                </Field>

                <Field label="Gender" fieldKey="gender">
                  <select
                    className={selectClass("gender")}
                    value={values.gender}
                    onChange={(e) => set("gender", e.target.value)}
                  >
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Date of birth" fieldKey="dateOfBirth">
                  <input
                    type="date"
                    className={inputClass("dateOfBirth")}
                    value={values.dateOfBirth}
                    onChange={(e) => set("dateOfBirth", e.target.value)}
                  />
                </Field>

                <Field label="Phone number" hint="optional" fieldKey="phoneNumber">
                  <input
                    type="tel"
                    className={inputClass("phoneNumber")}
                    value={values.phoneNumber}
                    placeholder="+251 9xx xxx xxxx"
                    onChange={(e) => set("phoneNumber", e.target.value)}
                  />
                </Field>
              </Section>

              <Section
                id="sec-statutory"
                icon="ti-id"
                title="Statutory & Government IDs"
                description="Optional tax, pension, national ID, and registration identifiers."
              >
                <Field label="TIN number" hint="optional" fieldKey="tinNumber">
                  <input
                    className={inputClass("tinNumber")}
                    value={values.tinNumber}
                    placeholder="Taxpayer identification"
                    onChange={(e) => set("tinNumber", e.target.value)}
                  />
                </Field>

                <Field label="National ID" hint="optional" fieldKey="nationalId">
                  <input
                    className={inputClass("nationalId")}
                    value={values.nationalId}
                    placeholder="National ID number"
                    onChange={(e) => set("nationalId", e.target.value)}
                  />
                </Field>

                <Field label="Business license no." hint="optional" fieldKey="businessLicenseNo">
                  <input
                    className={inputClass("businessLicenseNo")}
                    value={values.businessLicenseNo}
                    placeholder="License number"
                    onChange={(e) => set("businessLicenseNo", e.target.value)}
                  />
                </Field>

                <Field label="VAT number" hint="optional" fieldKey="vatNumber">
                  <input
                    className={inputClass("vatNumber")}
                    value={values.vatNumber}
                    placeholder="VAT registration"
                    onChange={(e) => set("vatNumber", e.target.value)}
                  />
                </Field>

                <Field label="Pension ID" hint="optional" fieldKey="pensionId">
                  <input
                    className={inputClass("pensionId")}
                    value={values.pensionId}
                    placeholder="Pension fund ID"
                    onChange={(e) => set("pensionId", e.target.value)}
                  />
                </Field>
              </Section>

              <Section
                id="sec-organization"
                icon="ti-sitemap"
                title="Organization Assignment"
                description="Branch, department, position, hire date, employment type, and lifecycle status."
              >
                <Field label="Branch" hint="can be assigned later" fieldKey="branchId">
                  <select
                    className={selectClass("branchId")}
                    value={values.branchId}
                    onChange={(e) => void handleBranchChange(e.target.value)}
                  >
                    <option value="">No branch assigned yet</option>
                    {branchOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code ? `${b.name} (${b.code})` : b.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Department" hint="can be assigned later" fieldKey="departmentId">
                  <select
                    className={selectClass("departmentId")}
                    value={values.departmentId}
                    onChange={(e) => void handleDepartmentChange(e.target.value)}
                  >
                    <option value="">No department assigned yet</option>
                    {ensureArray<DepartmentDto>(departments).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Position"
                  hint={!values.departmentId ? "select department first" : "can be assigned later"}
                  fieldKey="positionId"
                >
                  <select
                    className={selectClass("positionId")}
                    value={values.positionId}
                    disabled={!values.departmentId}
                    onChange={(e) => set("positionId", e.target.value)}
                  >
                    <option value="">
                      {values.departmentId ? "No position assigned yet" : "Select department first"}
                    </option>
                    {ensureArray<PositionDto>(positions).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}{p.level ? ` · ${p.level}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Work email" hint="optional" className="emp-span-2" error={fieldErrs.workEmail} fieldKey="workEmail">
                  <input
                    type="email"
                    className={inputClass("workEmail")}
                    value={values.workEmail}
                    placeholder="name@company.com"
                    onChange={(e) => set("workEmail", e.target.value)}
                  />
                </Field>

                <Field label="Hire date" fieldKey="hireDate">
                  <input
                    type="date"
                    className={inputClass("hireDate")}
                    value={values.hireDate}
                    onChange={(e) => set("hireDate", e.target.value)}
                  />
                </Field>

                <Field label="Employment type" fieldKey="employmentType">
                  <select
                    className={selectClass("employmentType")}
                    value={values.employmentType}
                    onChange={(e) => set("employmentType", e.target.value)}
                  >
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Pay frequency" fieldKey="payFrequency">
                  <select
                    className={selectClass("payFrequency")}
                    value={values.payFrequency}
                    onChange={(e) => set("payFrequency", e.target.value)}
                  >
                    {PAY_FREQUENCIES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Employment status" className="emp-span-3" fieldKey="status">
                  <div className="emp-pills">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`emp-pill${values.status === s ? " selected" : ""}`}
                        onClick={() => set("status", s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Field>
              </Section>

              <Section
                id="sec-payroll"
                icon="ti-cash"
                title="Payroll Profile"
                description="Base salary used by payroll and compensation reporting."
                gridClass="emp-grid-2"
              >
                <Field label="Basic salary" hint="optional" error={fieldErrs.basicSalary} fieldKey="basicSalary">
                  <div className="emp-money">
                    <span className="emp-currency">ETB</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className={inputClass("basicSalary")}
                      value={values.basicSalary}
                      placeholder="0.00"
                      style={{ paddingLeft: 48 }}
                      onChange={(e) =>
                        set("basicSalary", e.target.value === "" ? "" : Number(e.target.value))
                      }
                    />
                  </div>
                </Field>
              </Section>

              <div className="emp-footer">
                <div className="emp-footer-note">
                  <i className="ti ti-info-circle" aria-hidden="true" />
                  Branch, department, and position are optional during enrollment.
                </div>

                <div className="emp-actions">
                  <button type="button" className="emp-btn" disabled={saving} onClick={goBack}>
                    Cancel
                  </button>

                  <button type="submit" className="emp-btn emp-btn-primary" disabled={saving}>
                    {saving ? "Saving…" : isEdit ? "Save Master" : "Create Master"}
                  </button>
                </div>
              </div>
            </form>
          </main>

          <aside className="emp-right">
            <div className="emp-card">
              <div className="emp-card-head">
                <div className="emp-card-title">Employee Snapshot</div>
              </div>

              <div className="emp-snapshot">
                <div className="emp-avatar">{initials}</div>

                <div className="emp-name">{fullName || "New employee"}</div>
                <div className="emp-meta">
                  {values.workEmail || values.phoneNumber || "Master profile in progress"}
                </div>

                <div className="emp-divider" />

                <div className="emp-kv">
                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Status</span>
                    <span className="emp-kv-value">{values.status}</span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Branch</span>
                    <span className="emp-kv-value">
                      {selectedBranch?.name || <span className="emp-muted">Unassigned</span>}
                    </span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Department</span>
                    <span className="emp-kv-value">
                      {selectedDepartment?.name || <span className="emp-muted">Unassigned</span>}
                    </span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Position</span>
                    <span className="emp-kv-value">
                      {selectedPosition?.title || <span className="emp-muted">Unassigned</span>}
                    </span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Hire date</span>
                    <span className="emp-kv-value">
                      {values.hireDate || <span className="emp-muted">Not set</span>}
                    </span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Payroll</span>
                    <span className="emp-kv-value">
                      {values.payFrequency || <span className="emp-muted">Not set</span>}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}