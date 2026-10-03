// src/features/hr/pages/employees/EmployeeFormPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../../../i18n";
import type React from "react";
import { useParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { useErpNavigate } from "../../../../routes/useErpNavigation";
import {
  employeeApi,
  orgStructureApi,
  type EmployeeManagerLookupDto,
} from "../../api/hrApi";
import type {
  DepartmentDto,
  EmployeeDetailDto,
  EmploymentStatus,
  PositionDto,
} from "../../types/index";
import { getApiError } from "../../utils/hrUtils";

import styles from "./EmployeeFormPage.module.css";

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
  bankName?: NullableString;
  bankAccountNo?: NullableString;
  bankBranch?: NullableString;
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
  bankName: string;
  bankAccountNo: string;
  bankBranch: string;
  workEmail: string;
  status: EmploymentStatus;
  basicSalary: number | "";
}

type FieldErrors = Partial<Record<keyof EmployeeFormValues, string>>;
type SectionKey = "identity" | "statutory" | "organization" | "payroll" | "review";

type WorkflowState = "done" | "active" | "blocked" | "pending";

let translateHrText = (text: string) => text;

const todayIso = () => new Date().toISOString().slice(0, 10);

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
  hireDate: todayIso(),
  employmentType: "FullTime",
  payFrequency: "Monthly",
  bankName: "",
  bankAccountNo: "",
  bankBranch: "",
  workEmail: "",
  status: "Probation",
  basicSalary: "",
};

const EMPLOYMENT_TYPES = ["FullTime", "PartTime", "Contract", "Casual", "Intern"];
const GENDERS = ["Male", "Female", "Other"];
const PAY_FREQUENCIES = ["Daily", "Weekly", "BiWeekly", "Monthly"];
const STATUS_OPTIONS: EmploymentStatus[] = [
  "Probation",
  "Active",
  "Suspended",
  "OnLeave",
  "Terminated",
];

const SECTIONS: Array<{ key: SectionKey; label: string; icon: string }> = [
  { key: "identity", label: "General", icon: "ti-user" },
  { key: "statutory", label: "Statutory", icon: "ti-id" },
  { key: "organization", label: "Organization", icon: "ti-sitemap" },
  { key: "payroll", label: "Payroll", icon: "ti-cash" },
  { key: "review", label: "Workflow", icon: "ti-route" },
];

const SECTION_ORDER: SectionKey[] = SECTIONS.map((section) => section.key);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+()\-\s0-9]{7,25}$/;

function cleanText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];

  const keys = ["items", "data", "value", "result", "results", "records"];
  const container = value as Record<string, unknown>;

  for (const key of keys) {
    const direct = container[key];
    if (Array.isArray(direct)) return direct as T[];

    if (direct && typeof direct === "object") {
      const nested = direct as Record<string, unknown>;
      for (const nestedKey of keys) {
        if (Array.isArray(nested[nestedKey])) return nested[nestedKey] as T[];
      }
    }
  }

  return [];
}

function extractCreatedId(response: unknown): string | null {
  if (!response) return null;
  if (typeof response === "string" && response.trim()) return response.trim();
  if (typeof response !== "object") return null;

  const root = response as Record<string, unknown>;
  const direct = root.id ?? root.employeeId ?? root.employee_id ?? root.Id ?? root.EmployeeId;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const nested = root.data ?? root.value ?? root.result;
  if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    const nestedId = n.id ?? n.employeeId ?? n.employee_id ?? n.Id ?? n.EmployeeId;
    if (typeof nestedId === "string" && nestedId.trim()) return nestedId.trim();
  }
  return null;
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(value?: string | null): string {
  if (!value) return "";

  const trimmed = value.trim();
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;

  const slashDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (slashDate) return `${slashDate[3]}-${slashDate[2]}-${slashDate[1]}`;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toISOString().slice(0, 10);
}

function ageOn(dateOfBirth: string, onDate = new Date()): number | null {
  const dob = parseIsoDate(dateOfBirth);
  if (!dob) return null;
  let age = onDate.getFullYear() - dob.getFullYear();
  const monthDiff = onDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && onDate.getDate() < dob.getDate())) age -= 1;
  return age;
}

function validate(values: EmployeeFormValues): FieldErrors {
  const errors: FieldErrors = {};
  const firstName = values.firstName.trim();
  const fatherName = values.fatherName.trim();
  const grandFatherName = values.grandFatherName.trim();
  const hireDate = parseIsoDate(values.hireDate);
  const dob = parseIsoDate(values.dateOfBirth);
  const salary = values.basicSalary === "" ? null : Number(values.basicSalary);

  if (!firstName) errors.firstName = "First name is required.";
  if (!fatherName) errors.fatherName = "Father name is required.";
  if (!grandFatherName) errors.grandFatherName = "Grandfather name is required.";
  if (firstName.length > 80) errors.firstName = "First name cannot exceed 80 characters.";
  if (fatherName.length > 80) errors.fatherName = "Father name cannot exceed 80 characters.";
  if (grandFatherName.length > 80) errors.grandFatherName = "Grandfather name cannot exceed 80 characters.";
  if (!values.gender) errors.gender = "Gender is required.";

  if (values.dateOfBirth) {
    if (!dob) errors.dateOfBirth = "Enter a valid date of birth.";
    else if (dob > new Date()) errors.dateOfBirth = "Date of birth cannot be in the future.";
    else if ((ageOn(values.dateOfBirth) ?? 99) < 14) errors.dateOfBirth = "Employee must be at least 14 years old.";
  }

  if (values.phoneNumber.trim() && !PHONE_REGEX.test(values.phoneNumber.trim())) errors.phoneNumber = "Enter a valid phone number.";
  if (values.workEmail.trim() && !EMAIL_REGEX.test(values.workEmail.trim())) errors.workEmail = "Enter a valid work email address.";
  if (!values.branchId) errors.branchId = "Branch assignment is required.";
  if (!values.departmentId) errors.departmentId = "Department assignment is required.";
  if (!values.positionId) errors.positionId = "Position assignment is required.";
  if (!values.hireDate) errors.hireDate = "Hire date is required.";
  else if (!hireDate) errors.hireDate = "Enter a valid hire date.";
  if (dob && hireDate && hireDate < dob) errors.hireDate = "Hire date cannot be before date of birth.";
  if (!values.employmentType) errors.employmentType = "Employment type is required.";
  if (!values.payFrequency) errors.payFrequency = "Pay frequency is required.";
  if (!values.status) errors.status = "Employment status is required.";
  if (salary === null) errors.basicSalary = "Basic salary is required for payroll enrollment.";
  else if (!Number.isFinite(salary)) errors.basicSalary = "Enter a valid salary amount.";
  else if (salary < 0) errors.basicSalary = "Salary cannot be negative.";
  return errors;
}

function fromDto(dto: EmployeeDetailDto): EmployeeFormValues {
  const source = dto as EmployeeDetailWithOptionalFields;
  const names = dto.fullName?.split(" ").filter(Boolean) ?? [];
  const hasNameParts = Boolean(dto.firstName || dto.fatherName || dto.grandFatherName);
  return {
    ...EMPTY,
    branchId: source.branchId ?? "",
    firstName: hasNameParts ? dto.firstName ?? "" : names[0] ?? "",
    fatherName: hasNameParts ? dto.fatherName ?? "" : names[1] ?? "",
    grandFatherName: hasNameParts ? dto.grandFatherName ?? "" : names.slice(2).join(" "),
    gender: dto.gender ?? EMPTY.gender,
    dateOfBirth: toDateInputValue(dto.dateOfBirth),
    phoneNumber: dto.phoneNumber ?? "",
    tinNumber: source.tinNumber ?? source.tin ?? dto.taxId ?? "",
    nationalId: source.nationalId ?? "",
    businessLicenseNo: source.businessLicenseNo ?? source.businessLicenceNo ?? source.businessLicenseNumber ?? "",
    vatNumber: source.vatNumber ?? "",
    pensionId: source.pensionId ?? "",
    departmentId: source.departmentId ?? "",
    positionId: source.positionId ?? "",
    managerId: source.managerId ?? "",
    hireDate: toDateInputValue(dto.hireDate) || EMPTY.hireDate,
    employmentType: dto.employmentType ?? EMPTY.employmentType,
    payFrequency: source.payFrequency ?? EMPTY.payFrequency,
    bankName: source.bankName ?? "",
    bankAccountNo: source.bankAccountNo ?? "",
    bankBranch: source.bankBranch ?? "",
    workEmail: dto.workEmail ?? "",
    status: dto.status ?? EMPTY.status,
    basicSalary: dto.basicSalary ?? "",
  };
}

function managerName(manager: EmployeeManagerLookupDto): string {
  return manager.name ?? manager.fullName ?? "Unnamed manager";
}

function managerEmployeeNo(manager: EmployeeManagerLookupDto): string | null {
  return manager.employeeNo ?? manager.employeeCode ?? null;
}

function getFullName(values: EmployeeFormValues): string {
  return [values.firstName, values.fatherName, values.grandFatherName].map((p) => p.trim()).filter(Boolean).join(" ");
}

function labelize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function sectionForField(field: keyof EmployeeFormValues): SectionKey {
  if (["firstName", "fatherName", "grandFatherName", "gender", "dateOfBirth", "phoneNumber", "workEmail"].includes(field)) return "identity";
  if (["tinNumber", "nationalId", "businessLicenseNo", "vatNumber", "pensionId"].includes(field)) return "statutory";
  if (["branchId", "departmentId", "positionId", "managerId", "hireDate", "employmentType", "status"].includes(field)) return "organization";
  return "payroll";
}

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
  fieldKey?: keyof EmployeeFormValues;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.field} ${className}`} data-field={fieldKey}>
      <label className={`${styles.label} ${error ? styles.labelError : ""}`}>
        {label}
        {required ? <span className={styles.required}>*</span> : null}
        {hint && !error ? <span className={styles.hint}>- {hint}</span> : null}
      </label>
      {children}
      {error ? (
        <div className={styles.error} role="alert">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {translateHrText(error)}
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className={styles.detailRow}>
      <span>{translateHrText(label)}</span>
      <strong className={warn ? styles.warnText : ""}>{typeof value === "string" ? translateHrText(value) : value || "-"}</strong>
    </div>
  );
}

export default function EmployeeFormPage() {
  const { tx } = useI18n();
  translateHrText = tx;
  const erpNav = useErpNavigate();
  const { companyId: routeCompanyId, employeeId } = useParams<{ companyId?: string; employeeId?: string }>();
  const { companyId: scopedCompanyId } = useAppScope();

  const companyId = scopedCompanyId || routeCompanyId || "";
  const isEdit = Boolean(employeeId);

  const [values, setValues] = useState<EmployeeFormValues>(EMPTY);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("identity");

  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [managers, setManagers] = useState<EmployeeManagerLookupDto[]>([]);

  const branchOptions = useMemo(() => ensureArray<BranchDto>(branches).filter((b) => b?.id && b.isActive !== false).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")), [branches]);
  const departmentOptions = useMemo(() => ensureArray<DepartmentDto>(departments).sort((a, b) => a.name.localeCompare(b.name)), [departments]);
  const positionOptions = useMemo(() => ensureArray<PositionDto>(positions).sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? ""))), [positions]);
  const managerOptions = useMemo(
    () =>
      ensureArray<EmployeeManagerLookupDto>(managers)
        .filter((manager) => manager?.id && manager.id !== employeeId)
        .sort((a, b) => managerName(a).localeCompare(managerName(b))),
    [employeeId, managers]
  );
  const selectedBranch = useMemo(() => branchOptions.find((x) => x.id === values.branchId), [branchOptions, values.branchId]);
  const selectedDepartment = useMemo(() => departmentOptions.find((x) => x.id === values.departmentId), [departmentOptions, values.departmentId]);
  const selectedPosition = useMemo(() => positionOptions.find((x) => x.id === values.positionId), [positionOptions, values.positionId]);
  const selectedManager = useMemo(() => managerOptions.find((x) => x.id === values.managerId), [managerOptions, values.managerId]);
  const fullName = getFullName(values);

  const validationBySection = useMemo(() => {
    const result: Record<SectionKey, number> = { identity: 0, statutory: 0, organization: 0, payroll: 0, review: 0 };
    for (const key of Object.keys(fieldErrs) as Array<keyof EmployeeFormValues>) result[sectionForField(key)] += 1;
    result.review = Object.keys(fieldErrs).length;
    return result;
  }, [fieldErrs]);

  const workflow = useMemo<Array<{ key: string; label: string; note: string; state: WorkflowState }>>(() => {
    const identityReady = Boolean(values.firstName.trim() && values.fatherName.trim() && values.grandFatherName.trim() && values.gender);
    const orgReady = Boolean(values.branchId && values.departmentId && values.positionId && values.hireDate && values.employmentType && values.status);
    const payrollReady = values.basicSalary !== "" && Number(values.basicSalary) >= 0 && Boolean(values.payFrequency);
    return [
      { key: "draft", label: "Draft", note: isEdit ? "Existing record" : "New enrollment", state: "done" },
      { key: "identity", label: "Identity", note: identityReady ? "Legal identity ready" : "Complete identity", state: identityReady ? "done" : "active" },
      { key: "assignment", label: "Assignment", note: orgReady ? "Organization ready" : "Assign branch, department, position", state: !identityReady ? "pending" : orgReady ? "done" : "active" },
      { key: "payroll", label: "Payroll", note: payrollReady ? "Payroll ready" : "Enter salary and frequency", state: !orgReady ? "pending" : payrollReady ? "done" : "active" },
      { key: "review", label: "Review", note: identityReady && orgReady && payrollReady ? "Ready to save" : "Business rules pending", state: identityReady && orgReady && payrollReady ? "active" : "blocked" },
    ];
  }, [isEdit, values]);

  const errEntries = Object.entries(fieldErrs) as Array<[keyof EmployeeFormValues, string]>;
  const errCount = errEntries.length;

  const scrollToField = useCallback((field: keyof EmployeeFormValues) => {
    const section = sectionForField(field);
    setActiveSection(section);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-field="${field}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
  }, []);

  const loadDepartments = useCallback(async (branchId: string) => {
    if (!companyId) return;

    const scopedDepartments = branchId
      ? await orgStructureApi.listDepartments(companyId, { branchId, activeOnly: true })
      : [];

    if (!branchId || ensureArray<DepartmentDto>(scopedDepartments).length > 0) {
      setDepartments(ensureArray<DepartmentDto>(scopedDepartments));
      return;
    }

    const companyDepartments = await orgStructureApi.listDepartments(companyId, { activeOnly: true });
    setDepartments(ensureArray<DepartmentDto>(companyDepartments));
  }, [companyId]);

  const loadPositions = useCallback(async (departmentId: string) => {
    if (!companyId || !departmentId) {
      setPositions([]);
      return;
    }
    const response = await orgStructureApi.listPositions(companyId, { departmentId, activeOnly: true });
    setPositions(ensureArray<PositionDto>(response));
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!companyId) return;
      setLoading(true);
      setApiError(null);
      setFieldErrs({});
      try {
        const [lookupResponse, departmentList, dto] = await Promise.all([
          employeeApi.registrationLookups(companyId, {
            includeManagers: true,
            pageSize: 200,
          }),
          orgStructureApi.listDepartments(companyId, { activeOnly: true }),
          isEdit && employeeId ? employeeApi.get(companyId, employeeId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setBranches(ensureArray<BranchDto>(lookupResponse.branches).map((branch) => ({
          id: branch.id,
          name: branch.name,
          code: branch.code,
          isActive: true,
        })));
        setDepartments(ensureArray<DepartmentDto>(departmentList));
        setManagers(lookupResponse.managers ?? []);
        if (dto) {
          const formValues = fromDto(dto);
          setValues(formValues);
          if (formValues.departmentId) await loadPositions(formValues.departmentId);
        } else {
          setValues({ ...EMPTY, hireDate: todayIso() });
          setPositions([]);
        }
      } catch (error) {
        if (!cancelled) setApiError(getApiError(error, tx("Failed to load employee enrollment data.")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [companyId, employeeId, isEdit, loadPositions]);

  function set<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    if (fieldErrs[key]) {
      setFieldErrs((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
    }
  }

  async function handleBranchChange(branchId: string) {
    set("branchId", branchId);
    set("departmentId", "");
    set("positionId", "");
    setPositions([]);
    try { await loadDepartments(branchId); }
    catch (error) { setApiError(getApiError(error, tx("Failed to load departments for selected branch."))); }
  }

  async function handleDepartmentChange(departmentId: string) {
    set("departmentId", departmentId);
    set("positionId", "");
    try { await loadPositions(departmentId); }
    catch (error) { setApiError(getApiError(error, tx("Failed to load positions for selected department."))); }
  }

  function inputClass(key: keyof EmployeeFormValues): string {
    return `${styles.input} ${fieldErrs[key] ? styles.inputError : ""}`;
  }

  function selectClass(key: keyof EmployeeFormValues): string {
    return `${styles.select} ${fieldErrs[key] ? styles.inputError : ""}`;
  }

  function getSectionIndex(section: SectionKey): number {
    return Math.max(0, SECTION_ORDER.indexOf(section));
  }

  function goToNextSection() {
    const nextIndex = Math.min(SECTION_ORDER.length - 1, getSectionIndex(activeSection) + 1);
    setActiveSection(SECTION_ORDER[nextIndex]);
  }

  function goToPreviousSection() {
    const previousIndex = Math.max(0, getSectionIndex(activeSection) - 1);
    setActiveSection(SECTION_ORDER[previousIndex]);
  }

  function goToReview() {
    setFieldErrs(validate(values));
    setActiveSection("review");
  }

  function goBack() {
    erpNav(isEdit && employeeId ? `hr/employees/${employeeId}` : "hr/employees");
  }

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!companyId) {
      setApiError(tx("Company context is missing."));
      return;
    }
    const errors = validate(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrs(errors);
      setApiError(tx("Please correct the highlighted fields before saving."));
      scrollToField(Object.keys(errors)[0] as keyof EmployeeFormValues);
      return;
    }

    setSaving(true);
    setApiError(null);
    const salary = Number(values.basicSalary || 0);

    const personalPayload = {
      firstName: values.firstName.trim(),
      fatherName: values.fatherName.trim(),
      grandFatherName: values.grandFatherName.trim(),
      gender: values.gender || null,
      dateOfBirth: values.dateOfBirth || null,
      phoneNumber: cleanText(values.phoneNumber),
      tin: cleanText(values.tinNumber),
      tinNumber: cleanText(values.tinNumber),
      taxId: cleanText(values.tinNumber),
      nationalId: cleanText(values.nationalId),
      businessLicenseNo: cleanText(values.businessLicenseNo),
      vatNumber: cleanText(values.vatNumber),
      pensionId: cleanText(values.pensionId),
    };

    const employmentPayload = {
      branchId: values.branchId,
      departmentId: values.departmentId,
      positionId: values.positionId,
      managerId: cleanText(values.managerId),
      employmentType: values.employmentType,
      hireDate: values.hireDate,
      workEmail: cleanText(values.workEmail),
      status: values.status,
    };

    const compensationPayload = {
      basicSalary: salary,
      payFrequency: values.payFrequency,
      bankName: cleanText(values.bankName),
      bankAccountNo: cleanText(values.bankAccountNo),
      bankBranch: cleanText(values.bankBranch),
    };

    try {
      if (isEdit && employeeId) {
        await employeeApi.updateRegistration(companyId, employeeId, { ...personalPayload, ...employmentPayload, ...compensationPayload });
        erpNav(`hr/employees/${employeeId}`, { replace: true });
        return;
      }

      const response = await employeeApi.create(companyId, { ...personalPayload, ...employmentPayload, ...compensationPayload });
      const createdId = extractCreatedId(response);
      erpNav(createdId ? `hr/employees/${createdId}` : "hr/employees", { replace: true });
    } catch (error) {
      setApiError(getApiError(error, tx("Failed to save employee enrollment.")));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.commandBar}>
          <div className={styles.skeletonLine} style={{ width: 300 }} />
          <div className={styles.skeletonLine} style={{ width: 160 }} />
        </div>
        <div className={styles.layout}>
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <header className={styles.commandBar}>
        <div className={styles.commandTop}>
          <div>
            <div className={styles.breadcrumb}>
              <i className="ti ti-building-bank" aria-hidden="true" />
              {tx("Human Resources")}
              <i className="ti ti-chevron-right" aria-hidden="true" />
              {tx("Employee Master")}
              <i className="ti ti-chevron-right" aria-hidden="true" />
              {isEdit ? tx("Edit") : tx("Create")}
            </div>
            <div className={styles.titleRow}>
              <h1>{isEdit ? `${tx("Edit")} ${tx("Employee Master")}` : `${tx("Create")} ${tx("Employee Master")}`}</h1>
              <span className={styles.statusBadge}>{labelize(values.status)}</span>
              {errCount > 0 ? <span className={styles.errorBadge}>{errCount} {tx("issues")}</span> : <span className={styles.readyBadge}>{tx("Ready")}</span>}
            </div>
            <div className={styles.entityLine}>
              <strong>{fullName || tx("New employee")}</strong>
              <span>{selectedBranch?.name || tx("No branch")}</span>
              <span>{selectedDepartment?.name || tx("No department")}</span>
              <span>{selectedPosition?.title || tx("No position")}</span>
            </div>
          </div>
          <div className={styles.commandActions}>
            <button type="button" className={styles.btn} disabled={saving} onClick={goBack}>{tx("Cancel")}</button>
            <button type="button" className={styles.btn} disabled={saving} onClick={() => setFieldErrs(validate(values))}>
              {tx("Validate")}
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving} onClick={goToReview}>
              <i className="ti ti-route" aria-hidden="true" />
              {tx("Review & Submit")}
            </button>
          </div>
        </div>

        <div className={styles.ribbon}>
          {workflow.map((step, index) => (
            <div key={step.key} className={`${styles.workflowStep} ${styles[`step_${step.state}`]}`}>
              <span className={styles.stepNo}>{index + 1}</span>
              <span><strong>{step.label}</strong><small>{step.note}</small></span>
            </div>
          ))}
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label={tx("Employee master functional areas")}>
        {SECTIONS.map((section) => (
          <button
            key={section.key}
            type="button"
            role="tab"
            aria-selected={activeSection === section.key}
            className={`${styles.tab} ${activeSection === section.key ? styles.tabActive : ""}`}
            onClick={() => setActiveSection(section.key)}
          >
            <i className={`ti ${section.icon}`} aria-hidden="true" />
            {tx(section.label)}
            {validationBySection[section.key] > 0 ? <span>{validationBySection[section.key]}</span> : null}
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        <main className={styles.main}>
          {apiError ? <div className={styles.alert} role="alert">{apiError}</div> : null}
          <form onSubmit={handleSubmit} noValidate>
            {activeSection === "identity" ? (
              <section className={styles.panel}>
                <header className={styles.panelHeader}><h2>{tx("General Information")}</h2><p>{tx("Legal employee identity and contact information.")}</p></header>
                <div className={styles.formGrid3}>
                  <Field label="First name" required error={fieldErrs.firstName} fieldKey="firstName"><input className={inputClass("firstName")} value={values.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
                  <Field label="Father's name" required error={fieldErrs.fatherName} fieldKey="fatherName"><input className={inputClass("fatherName")} value={values.fatherName} onChange={(e) => set("fatherName", e.target.value)} /></Field>
                  <Field label="Grandfather's name" required error={fieldErrs.grandFatherName} fieldKey="grandFatherName"><input className={inputClass("grandFatherName")} value={values.grandFatherName} onChange={(e) => set("grandFatherName", e.target.value)} /></Field>
                  <Field label="Gender" required error={fieldErrs.gender} fieldKey="gender"><select className={selectClass("gender")} value={values.gender} onChange={(e) => set("gender", e.target.value)}>{GENDERS.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
                  <Field label="Date of birth" error={fieldErrs.dateOfBirth} fieldKey="dateOfBirth"><input type="date" className={inputClass("dateOfBirth")} value={values.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} /></Field>
                  <Field label="Phone number" hint="optional" error={fieldErrs.phoneNumber} fieldKey="phoneNumber"><input type="tel" className={inputClass("phoneNumber")} value={values.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} /></Field>
                  <Field label="Work email" hint="optional" error={fieldErrs.workEmail} fieldKey="workEmail" className={styles.span2}><input type="email" className={inputClass("workEmail")} value={values.workEmail} onChange={(e) => set("workEmail", e.target.value)} /></Field>
                </div>
              </section>
            ) : null}

            {activeSection === "statutory" ? (
              <section className={styles.panel}>
                <header className={styles.panelHeader}><h2>{tx("Statutory & Government IDs")}</h2><p>{tx("Compliance identifiers used for tax, pension, and reporting.")}</p></header>
                <div className={styles.formGrid3}>
                  <Field label="TIN number" hint="optional" fieldKey="tinNumber"><input className={inputClass("tinNumber")} value={values.tinNumber} onChange={(e) => set("tinNumber", e.target.value)} /></Field>
                  <Field label="National ID" hint="optional" fieldKey="nationalId"><input className={inputClass("nationalId")} value={values.nationalId} onChange={(e) => set("nationalId", e.target.value)} /></Field>
                  <Field label="Pension ID" hint="optional" fieldKey="pensionId"><input className={inputClass("pensionId")} value={values.pensionId} onChange={(e) => set("pensionId", e.target.value)} /></Field>
                  <Field label="Business license no." hint="optional" fieldKey="businessLicenseNo"><input className={inputClass("businessLicenseNo")} value={values.businessLicenseNo} onChange={(e) => set("businessLicenseNo", e.target.value)} /></Field>
                  <Field label="VAT number" hint="optional" fieldKey="vatNumber"><input className={inputClass("vatNumber")} value={values.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} /></Field>
                </div>
              </section>
            ) : null}

            {activeSection === "organization" ? (
              <section className={styles.panel}>
                <header className={styles.panelHeader}><h2>{tx("Organization Assignment")}</h2><p>{tx("Branch, department, position, reporting, and employment lifecycle.")}</p></header>
                <div className={styles.formGrid3}>
                  <Field label="Branch" required error={fieldErrs.branchId} fieldKey="branchId"><select className={selectClass("branchId")} value={values.branchId} onChange={(e) => void handleBranchChange(e.target.value)}><option value="">- Select branch -</option>{branchOptions.map((b) => <option key={b.id} value={b.id}>{b.code ? `${b.name} (${b.code})` : b.name}</option>)}</select></Field>
                  <Field label="Department" required error={fieldErrs.departmentId} fieldKey="departmentId"><select className={selectClass("departmentId")} value={values.departmentId} onChange={(e) => void handleDepartmentChange(e.target.value)}><option value="">- Select department -</option>{departmentOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
                  <Field label="Position" required error={fieldErrs.positionId} hint={!values.departmentId ? "select department first" : undefined} fieldKey="positionId"><select className={selectClass("positionId")} value={values.positionId} disabled={!values.departmentId} onChange={(e) => set("positionId", e.target.value)}><option value="">{values.departmentId ? "- Select position -" : "Select department first"}</option>{positionOptions.map((p) => <option key={p.id} value={p.id}>{p.title}{(p as any).level ? ` - ${(p as any).level}` : ""}</option>)}</select></Field>
                  <Field label="Reporting manager" hint="optional" fieldKey="managerId">
                    <select className={selectClass("managerId")} value={values.managerId} onChange={(e) => set("managerId", e.target.value)}>
                      <option value="">No reporting manager</option>
                      {managerOptions.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {[managerEmployeeNo(manager), managerName(manager), manager.departmentName].filter(Boolean).join(" - ")}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Hire date" required error={fieldErrs.hireDate} fieldKey="hireDate"><input type="date" className={inputClass("hireDate")} value={values.hireDate} onChange={(e) => set("hireDate", e.target.value)} /></Field>
                  <Field label="Employment type" required error={fieldErrs.employmentType} fieldKey="employmentType"><select className={selectClass("employmentType")} value={values.employmentType} onChange={(e) => set("employmentType", e.target.value)}>{EMPLOYMENT_TYPES.map((x) => <option key={x} value={x}>{labelize(x)}</option>)}</select></Field>
                  <Field label="Employment status" required error={fieldErrs.status} fieldKey="status" className={styles.span3}><div className={styles.statusRow}>{STATUS_OPTIONS.map((x) => <button key={x} type="button" className={`${styles.statusPill} ${values.status === x ? styles.statusPillActive : ""}`} onClick={() => set("status", x)}>{labelize(x)}</button>)}</div></Field>
                </div>
              </section>
            ) : null}

            {activeSection === "payroll" ? (
              <section className={styles.panel}>
                <header className={styles.panelHeader}><h2>{tx("Payroll Profile")}</h2><p>{tx("Salary, payment account, and payroll control attributes.")}</p></header>
                <div className={styles.formGrid2}>
                  <Field label="Basic salary" required error={fieldErrs.basicSalary} fieldKey="basicSalary"><div className={styles.moneyWrap}><span>ETB</span><input type="number" min={0} step={0.01} className={inputClass("basicSalary")} value={values.basicSalary} onChange={(e) => set("basicSalary", e.target.value === "" ? "" : Number(e.target.value))} /></div></Field>
                  <Field label="Pay frequency" required error={fieldErrs.payFrequency} fieldKey="payFrequency"><select className={selectClass("payFrequency")} value={values.payFrequency} onChange={(e) => set("payFrequency", e.target.value)}>{PAY_FREQUENCIES.map((x) => <option key={x} value={x}>{labelize(x)}</option>)}</select></Field>
                  <Field label="Bank name" hint="optional" fieldKey="bankName"><input className={inputClass("bankName")} value={values.bankName} onChange={(e) => set("bankName", e.target.value)} /></Field>
                  <Field label="Bank account no." hint="optional" fieldKey="bankAccountNo"><input className={inputClass("bankAccountNo")} value={values.bankAccountNo} onChange={(e) => set("bankAccountNo", e.target.value)} /></Field>
                  <Field label="Bank branch" hint="optional" fieldKey="bankBranch"><input className={inputClass("bankBranch")} value={values.bankBranch} onChange={(e) => set("bankBranch", e.target.value)} /></Field>
                </div>
              </section>
            ) : null}

            {activeSection === "review" ? (
              <section className={styles.panel}>
                <header className={styles.panelHeader}><h2>{tx("Review & Workflow")}</h2><p>{tx("Resolve business rules, then save or create the employee master record.")}</p></header>
                <div className={styles.reviewGrid}>
                  <div className={styles.reviewCard}><h3>{tx("Workflow")}</h3>{workflow.map((s) => <DetailRow key={s.key} label={s.label} value={s.note} warn={s.state === "blocked" || s.state === "active"} />)}</div>
                  <div className={styles.reviewCard}><h3>{tx("Validation")}</h3>{errCount ? errEntries.map(([field, msg]) => <button key={field} type="button" className={styles.validationLink} onClick={() => scrollToField(field)}>{msg}</button>) : <p className={styles.successText}>{tx("All required business rules passed.")}</p>}</div>
                </div>
              </section>
            ) : null}

            <footer className={styles.footerBar}>
              <span>
                {activeSection === "review"
                  ? errCount
                    ? `${errCount} validation issue${errCount === 1 ? "" : "s"} must be resolved before submission.`
                    : tx("Review complete. Employee master is ready to submit.")
                  : tx("Complete this functional area, then continue to the next step.")}
              </span>

              <div className={styles.commandActions}>
                {activeSection === "review" ? (
                  <button type="button" className={styles.btn} disabled={saving} onClick={goToPreviousSection}>
                    Back
                  </button>
                ) : (
                  <button type="button" className={styles.btn} disabled={saving} onClick={goBack}>
                    Cancel
                  </button>
                )}

                {activeSection === "review" ? (
                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
                    {saving ? tx("Submitting...") : isEdit ? tx("Submit Changes") : tx("Submit Employee")}
                  </button>
                ) : (
                  <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving} onClick={goToNextSection}>
                    {tx("Next")}
                    <i className="ti ti-arrow-right" aria-hidden="true" />
                  </button>
                )}
              </div>
            </footer>
          </form>
        </main>

        <aside className={styles.sidebar}>
          <section className={styles.sideCard}>
            <h3>{tx("Operational Snapshot")}</h3>
            <DetailRow label="Employee" value={fullName || tx("New employee")} />
            <DetailRow label="Status" value={labelize(values.status)} />
            <DetailRow label="Branch" value={selectedBranch?.name || "Required"} warn={!selectedBranch} />
            <DetailRow label="Department" value={selectedDepartment?.name || "Required"} warn={!selectedDepartment} />
            <DetailRow label="Position" value={selectedPosition?.title || "Required"} warn={!selectedPosition} />
            <DetailRow label="Manager" value={selectedManager ? `${managerEmployeeNo(selectedManager) ? `${managerEmployeeNo(selectedManager)} - ` : ""}${managerName(selectedManager)}` : "No manager assigned"} />
            <DetailRow label="Payroll" value={values.basicSalary !== "" ? `${values.basicSalary} / ${labelize(values.payFrequency)}` : "Required"} warn={values.basicSalary === ""} />
          </section>
          <section className={styles.sideCard}>
            <h3>{tx("Business Rules")}</h3>
            {errCount ? errEntries.map(([field, message]) => <button type="button" key={field} className={styles.ruleItem} onClick={() => scrollToField(field)}><i className="ti ti-alert-triangle" />{message}</button>) : <div className={styles.ruleOk}><i className="ti ti-circle-check" />{tx("Ready for save")}</div>}
          </section>
        </aside>
      </div>
    </div>
  );
}
