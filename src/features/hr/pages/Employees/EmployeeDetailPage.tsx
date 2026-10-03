// src/features/hr/pages/employees/EmployeeDetailPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { useAuth } from "../../../../auth/AuthProvider";
import { useErpNavigate } from "../../../../routes/useErpNavigation";
import { employeeApi } from "../../api/hrApi";
import type { EmployeeDetailDto, EmployeeDocumentDto } from "../../types";
import { fmtDate, fmtDateTime, fmtMoney, getApiError } from "../../utils/hrUtils";

import styles from "./EmployeeDetailPage.module.css";

type Maybe<T> = T | null | undefined;

type EmployeeDetailView = EmployeeDetailDto & {
  id?: string;
  employeeNo?: Maybe<string>;
  employeeCode?: Maybe<string>;
  preferredName?: Maybe<string>;
  branchName?: Maybe<string>;
  departmentName?: Maybe<string>;
  positionTitle?: Maybe<string>;
  positionName?: Maybe<string>;
  managerName?: Maybe<string>;
  employmentType?: Maybe<string>;
  workSchedule?: Maybe<string>;
  workEmail?: Maybe<string>;
  personalEmail?: Maybe<string>;
  phoneNumber?: Maybe<string>;
  address?: Maybe<string>;
  city?: Maybe<string>;
  nationalId?: Maybe<string>;
  taxId?: Maybe<string>;
  tinNumber?: Maybe<string>;
  tin?: Maybe<string>;
  pensionId?: Maybe<string>;
  bankName?: Maybe<string>;
  bankAccountNo?: Maybe<string>;
  bankBranch?: Maybe<string>;
  basicSalary?: Maybe<number>;
  payFrequency?: Maybe<string>;
  yearsOfService?: Maybe<number | string>;
  confirmationDate?: Maybe<string>;
  terminationDate?: Maybe<string>;
  terminationReason?: Maybe<string>;
  telegramChatId?: Maybe<string>;
  telegramUserName?: Maybe<string>;
  telegramLinkedAtUtc?: Maybe<string>;
  hasSystemAccess?: Maybe<boolean>;
  lastLoginAt?: Maybe<string>;
  createdAt?: Maybe<string>;
  createdBy?: Maybe<string>;
  updatedAt?: Maybe<string>;
  updatedBy?: Maybe<string>;
  emergencyContactName?: Maybe<string>;
  emergencyContactPhone?: Maybe<string>;
  emergencyContactRelation?: Maybe<string>;
};

type EmployeeDocumentFormState = {
  documentType: string;
  fileName: string;
  expiryDate: string;
  file: File | null;
};

const defaultDocumentForm: EmployeeDocumentFormState = {
  documentType: "Employment Contract",
  fileName: "",
  expiryDate: "",
  file: null,
};

const documentTypeOptions = [
  "National ID",
  "Employment Contract",
  "Medical Certificate",
  "Food Handler License",
  "Work Permit",
  "Training Certificate",
  "Payroll Document",
  "Other",
];

type TabKey =
  | "general"
  | "employment"
  | "organization"
  | "payroll"
  | "attendance"
  | "leave"
  | "documents"
  | "telegram"
  | "access"
  | "audit";

type DetailValue = string | number | boolean | null | undefined;

type FieldConfig = {
  label: string;
  value: DetailValue;
  span?: 1 | 2;
};

type TabConfig = {
  key: TabKey;
  label: string;
  icon: string;
};

const tabs: TabConfig[] = [
  { key: "general", label: "General", icon: "ti-user" },
  { key: "employment", label: "Employment", icon: "ti-briefcase" },
  { key: "organization", label: "Organization", icon: "ti-sitemap" },
  { key: "payroll", label: "Payroll", icon: "ti-cash-banknote" },
  { key: "attendance", label: "Attendance", icon: "ti-clock" },
  { key: "leave", label: "Leave", icon: "ti-calendar" },
  { key: "documents", label: "Documents", icon: "ti-file-text" },
  { key: "telegram", label: "Telegram", icon: "ti-brand-telegram" },
  { key: "access", label: "Access", icon: "ti-shield-lock" },
  { key: "audit", label: "Audit", icon: "ti-history" },
];

function unwrapEmployee(response: unknown): EmployeeDetailView | null {
  if (!response) return null;

  const container = response as Record<string, unknown>;
  return ((container.data ?? container.value ?? container.result ?? response) as EmployeeDetailView) ?? null;
}

function valueOrDash(value: DetailValue): string | number {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
}

function safeDate(value?: string | null): string {
  return value ? fmtDate(value) : "-";
}

function safeDateTime(value?: string | null): string {
  return value ? fmtDateTime(value) : "-";
}

function cleanStatus(status?: string | null): string {
  return status || "Unknown";
}

function getStatusClass(status?: string | null): string {
  const normalized = cleanStatus(status).toLowerCase();

  if (normalized === "active" || normalized === "confirmed") return styles.badgeSuccess;
  if (normalized === "probation") return styles.badgeWarning;
  if (normalized === "suspended" || normalized === "terminated") return styles.badgeDanger;
  if (normalized === "onleave" || normalized === "on leave") return styles.badgeInfo;

  return styles.badgeNeutral;
}

function getTaxId(employee: EmployeeDetailView): Maybe<string> {
  return employee.taxId ?? employee.tinNumber ?? employee.tin ?? null;
}

function getEmployeeCode(employee: EmployeeDetailView): string {
  return employee.employeeCode ?? employee.employeeNo ?? "-";
}

function getPosition(employee: EmployeeDetailView): string | null {
  return employee.positionTitle ?? employee.positionName ?? null;
}

function getCompleteness(employee: EmployeeDetailView): number {
  const checks = [
    employee.fullName,
    employee.phoneNumber,
    employee.workEmail,
    employee.branchName,
    employee.departmentName,
    getPosition(employee),
    employee.hireDate,
    employee.basicSalary,
    getTaxId(employee),
    employee.pensionId,
  ];

  const completed = checks.filter((x) => x !== null && x !== undefined && x !== "").length;
  return Math.round((completed / checks.length) * 100);
}

function getMissingItems(employee: EmployeeDetailView): string[] {
  const items = [
    ["Work email", employee.workEmail],
    ["Phone number", employee.phoneNumber],
    ["Department", employee.departmentName],
    ["Position", getPosition(employee)],
    ["Basic salary", employee.basicSalary],
    ["Tax ID / TIN", getTaxId(employee)],
    ["Pension ID", employee.pensionId],
    ["Bank account", employee.bankAccountNo],
    ["Emergency contact", employee.emergencyContactName],
  ] as const;

  return items.filter(([, value]) => value === null || value === undefined || value === "").map(([label]) => label);
}

function getTelegramStartParam(): string {
  if (typeof window === "undefined") return "ambassador";

  const host = window.location.hostname.toLowerCase();
  const rootDomains = ["fnbnova.com", "www.fnbnova.com", "localhost", "127.0.0.1"];

  if (rootDomains.includes(host)) return "ambassador";

  const [subdomain] = host.split(".");
  return subdomain || "ambassador";
}

function DetailField({ field }: { field: FieldConfig }) {
  return (
    <div className={`${styles.detailField} ${field.span === 2 ? styles.detailFieldWide : ""}`}>
      <dt>{field.label}</dt>
      <dd>{valueOrDash(field.value)}</dd>
    </div>
  );
}

function DetailSection({ title, fields }: { title: string; fields: FieldConfig[] }) {
  return (
    <section className={styles.detailSection}>
      <h2>{title}</h2>
      <dl className={styles.detailGrid}>
        {fields.map((field) => (
          <DetailField key={`${title}-${field.label}`} field={field} />
        ))}
      </dl>
    </section>
  );
}

function getDocumentStatus(document: EmployeeDocumentDto): { label: string; className: string } {
  if (!document.expiryDate) return { label: "On file", className: styles.badgeSuccess };

  const expiry = new Date(document.expiryDate);
  if (Number.isNaN(expiry.getTime())) return { label: "On file", className: styles.badgeSuccess };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (expiry < today) return { label: "Expired", className: styles.badgeDanger };

  const warningDate = new Date(today);
  warningDate.setDate(warningDate.getDate() + 30);

  if (expiry <= warningDate) return { label: "Expiring soon", className: styles.badgeWarning };
  return { label: "On file", className: styles.badgeSuccess };
}

function StatusPill({ status }: { status?: string | null }) {
  return <span className={`${styles.badge} ${getStatusClass(status)}`}>{cleanStatus(status)}</span>;
}

function LoadingState() {
  return (
    <div className={styles.root}>
      <div className={styles.skeletonHeader} />
      <div className={styles.skeletonTabs} />
      <div className={styles.skeletonBody} />
    </div>
  );
}

function EmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className={styles.root}>
      <section className={styles.emptyState}>
        <i className="ti ti-user-question" aria-hidden="true" />
        <h1>Employee not found</h1>
        <p>The employee profile may have been removed or is outside the current company scope.</p>
        <button type="button" className={styles.button} onClick={onBack}>
          Back to Employees
        </button>
      </section>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const nav = useErpNavigate();
  const { hasPermission } = useAuth();
  const { companyId: scopedCompanyId } = useAppScope();
  const { companyId: routeCompanyId, employeeId } = useParams<{
    companyId?: string;
    employeeId?: string;
  }>();

  const companyId = scopedCompanyId ?? routeCompanyId ?? null;

  const [employee, setEmployee] = useState<EmployeeDetailView | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telegramToken, setTelegramToken] = useState<string | null>(null);
  const [telegramTokenExpiresAt, setTelegramTokenExpiresAt] = useState<string | null>(null);
  const [telegramLinkLoading, setTelegramLinkLoading] = useState(false);
  const [telegramLinkError, setTelegramLinkError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocumentDto[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentForm, setDocumentForm] = useState<EmployeeDocumentFormState>(defaultDocumentForm);
  const loadEmployee = useCallback(
    async (silent = false) => {
      if (!companyId || !employeeId) {
        setError("Missing company or employee route information.");
        setLoading(false);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);

      setError(null);

      try {
        const response = await employeeApi.get(companyId, employeeId);
        setEmployee(unwrapEmployee(response));
      } catch (e) {
        setError(getApiError(e, "Failed to load employee."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId, employeeId],
  );

  useEffect(() => {
    void loadEmployee();
  }, [loadEmployee]);

  const loadDocuments = useCallback(async () => {
    if (!companyId || !employeeId) return;

    setDocumentsLoading(true);
    setDocumentsError(null);

    try {
      const rows = await employeeApi.listDocuments(companyId, employeeId);
      setDocuments(rows);
    } catch (e) {
      setDocumentsError(getApiError(e, "Failed to load employee documents."));
    } finally {
      setDocumentsLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    if (activeTab === "documents") {
      void loadDocuments();
    }
  }, [activeTab, loadDocuments]);

  const employeeRouteId = employee?.id ?? employeeId;
  const employeeCode = employee ? getEmployeeCode(employee) : "-";
  const position = employee ? getPosition(employee) : null;
  const isProbation = cleanStatus(employee?.status).toLowerCase() === "probation";
  const isTerminated = cleanStatus(employee?.status).toLowerCase() === "terminated";
  const missingItems = useMemo(() => (employee ? getMissingItems(employee) : []), [employee]);
  const completeness = employee ? getCompleteness(employee) : 0;
  const canManageEmployee = hasPermission("hr.employees.update");

  const tabSections = useMemo(() => {
    if (!employee) return {} as Record<TabKey, React.ReactNode>;

    const taxId = getTaxId(employee);

    return {
      general: (
        <>
          <DetailSection
            title="Identity"
            fields={[
              { label: "Employee Code", value: employeeCode },
              { label: "Full Name", value: employee.fullName },
              { label: "Preferred Name", value: employee.preferredName },
              { label: "Gender", value: employee.gender },
              { label: "Date of Birth", value: safeDate(employee.dateOfBirth) },
              { label: "Marital Status", value: employee.maritalStatus },
              { label: "Nationality", value: (employee as any).nationality },
            ]}
          />
          <DetailSection
            title="Contact"
            fields={[
              { label: "Phone Number", value: employee.phoneNumber },
              { label: "Work Email", value: employee.workEmail },
              { label: "Personal Email", value: employee.personalEmail },
              { label: "City", value: employee.city },
              { label: "Address", value: employee.address, span: 2 },
            ]}
          />
          <DetailSection
            title="Emergency Contact"
            fields={[
              { label: "Contact Name", value: employee.emergencyContactName },
              { label: "Phone", value: employee.emergencyContactPhone },
              { label: "Relationship", value: employee.emergencyContactRelation },
            ]}
          />
        </>
      ),
      employment: (
        <DetailSection
          title="Employment Control"
          fields={[
            { label: "Status", value: cleanStatus(employee.status) },
            { label: "Employment Type", value: employee.employmentType },
            { label: "Work Schedule", value: employee.workSchedule },
            { label: "Hire Date", value: safeDate(employee.hireDate) },
            { label: "Confirmation Date", value: employee.confirmationDate ? fmtDate(employee.confirmationDate) : "Pending" },
            { label: "Years of Service", value: employee.yearsOfService },
            { label: "Termination Date", value: safeDate(employee.terminationDate ?? null) },
            { label: "Termination Reason", value: employee.terminationReason, span: 2 },
          ]}
        />
      ),
      organization: (
        <DetailSection
          title="Organization Assignment"
          fields={[
            { label: "Branch", value: employee.branchName },
            { label: "Department", value: employee.departmentName },
            { label: "Position", value: position },
            { label: "Manager", value: employee.managerName ?? "No manager assigned" },
            { label: "Cost Center", value: (employee as any).costCenterName ?? (employee as any).costCenterCode },
            { label: "Profit Center", value: (employee as any).profitCenterName ?? (employee as any).profitCenterCode },
            { label: "Business Unit", value: (employee as any).businessUnitName },
            { label: "Outlet", value: (employee as any).outletName },
            { label: "Kitchen / Work Area", value: (employee as any).workAreaName ?? (employee as any).kitchenName },
          ]}
        />
      ),
      payroll: (
        <>
          <DetailSection
            title="Compensation"
            fields={[
              { label: "Basic Salary", value: fmtMoney(employee.basicSalary) },
              { label: "Pay Frequency", value: employee.payFrequency },
              { label: "Payroll Group", value: (employee as any).payrollGroupName },
              { label: "Salary Structure", value: (employee as any).salaryStructureName },
              { label: "Currency", value: (employee as any).currencyCode },
              { label: "Payment Method", value: (employee as any).paymentMethod },
            ]}
          />
          <DetailSection
            title="Statutory & Banking"
            fields={[
              { label: "National ID", value: employee.nationalId },
              { label: "Tax ID / TIN", value: taxId },
              { label: "Pension ID", value: employee.pensionId },
              { label: "Bank Name", value: employee.bankName },
              { label: "Bank Branch", value: employee.bankBranch },
              { label: "Bank Account No.", value: employee.bankAccountNo },
            ]}
          />
        </>
      ),
      attendance: (
        <>
          <DetailSection
            title="Attendance Configuration"
            fields={[
              { label: "Shift Pattern", value: (employee as any).shiftPatternName ?? employee.workSchedule },
              { label: "Roster Group", value: (employee as any).rosterGroupName },
              { label: "Attendance Device", value: (employee as any).attendanceDeviceName },
              { label: "Biometric ID", value: (employee as any).biometricId },
              { label: "Overtime Policy", value: (employee as any).overtimePolicyName },
              { label: "Late Policy", value: (employee as any).latePolicyName },
              { label: "Holiday Calendar", value: (employee as any).holidayCalendarName },
              { label: "Meal Break Rule", value: (employee as any).mealBreakRuleName },
            ]}
          />
          {canManageEmployee && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" className={styles.button} onClick={() => nav("hr/attendance/configuration")}>
                Open Attendance Configuration
              </button>
            </div>
          )}
        </>
      ),
      leave: (
        <DetailSection
          title="Leave Profile"
          fields={[
            { label: "Leave Group", value: (employee as any).leaveGroupName },
            { label: "Annual Leave Balance", value: (employee as any).annualLeaveBalance },
            { label: "Sick Leave Balance", value: (employee as any).sickLeaveBalance },
            { label: "Pending Requests", value: (employee as any).pendingLeaveRequests },
            { label: "Last Leave Taken", value: safeDateTime((employee as any).lastLeaveTakenAt ?? null) },
          ]}
        />
      ),
      documents: (
        <section className={styles.detailSection}>
          <div className={styles.sectionHeaderRow}>
            <h2>Document Register</h2>
            <button type="button" className={styles.button} onClick={() => void loadDocuments()} disabled={documentsLoading}>
              <i className="ti ti-refresh" aria-hidden="true" /> {documentsLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {canManageEmployee ? (
            <form className={styles.documentForm} onSubmit={submitDocument}>
              <label>
                Type
                <select value={documentForm.documentType} onChange={(e) => setDocumentForm((x) => ({ ...x, documentType: e.target.value }))}>
                  {documentTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label>
                Document name
                <input value={documentForm.fileName} onChange={(e) => setDocumentForm((x) => ({ ...x, fileName: e.target.value }))} placeholder="Signed contract, ID scan, certificate" />
              </label>
              <label>
                File
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setDocumentForm((x) => ({ ...x, file: e.target.files?.[0] ?? null }))}
                />
              </label>
              <label>
                Expiry
                <input type="date" value={documentForm.expiryDate} onChange={(e) => setDocumentForm((x) => ({ ...x, expiryDate: e.target.value }))} />
              </label>
              <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={documentSaving}>
                <i className="ti ti-plus" aria-hidden="true" /> {documentSaving ? "Saving..." : "Add document"}
              </button>
            </form>
          ) : null}

          {documentsError ? <div className={styles.alert}>{documentsError}</div> : null}

          <div className={styles.tableWrap}>
            <table className={styles.erpTable}>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Expiry</th>
                  <th>Uploaded</th>
                  <th>Uploaded By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.emptyCell}>{documentsLoading ? "Loading documents..." : "No employee documents have been registered yet."}</td>
                  </tr>
                ) : documents.map((document) => {
                  const status = getDocumentStatus(document);
                  return (
                    <tr key={document.id}>
                      <td><strong>{document.documentType}</strong><span className={styles.tableSubtext}>{document.fileName}</span></td>
                      <td><span className={`${styles.badge} ${status.className}`}>{status.label}</span></td>
                      <td>{safeDate(document.expiryDate ?? null)}</td>
                      <td>{safeDateTime(document.uploadedAt)}</td>
                      <td>{valueOrDash(document.uploadedBy)}</td>
                      <td>
                        <button type="button" className={styles.linkButton} onClick={() => void downloadDocument(document)}>
                          Download
                        </button>
                        {canManageEmployee ? (
                          <button type="button" className={styles.linkButtonDanger} onClick={() => void deleteDocument(document.id)}>
                            Delete
                          </button>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ),
      telegram: (
        <>
          <DetailSection
            title="Telegram Link"
            fields={[
              { label: "Telegram Username", value: employee.telegramUserName },
              { label: "Telegram Chat ID", value: employee.telegramChatId },
              { label: "Telegram Linked At", value: safeDateTime(employee.telegramLinkedAtUtc ?? null) },
            ]}
          />
          <section className={styles.telegramPanel}>
            <div>
              <h2>Employee Mini App Access</h2>
              <p className={styles.muted}>
                Generate a temporary HR link code and send it to the employee with the Telegram Mini App invite.
              </p>
            </div>
            {canManageEmployee ? (
              <div>
                <button type="button" className={styles.button} onClick={generateTelegramLink} disabled={telegramLinkLoading || !!employee.telegramChatId}>
                  <i className="ti ti-brand-telegram" aria-hidden="true" /> Generate link code
                </button>
                <button type="button" className={styles.button} onClick={() => void unlinkEmployeeTelegram(false)} disabled={telegramLinkLoading}>
                  Unlink Telegram
                </button>
                {employee.telegramChatId ? (
                  <button type="button" className={styles.button} onClick={() => void unlinkEmployeeTelegram(true)} disabled={telegramLinkLoading}>
                    Relink Telegram
                  </button>
                ) : null}
                {telegramLinkLoading ? <span role="status">Updating Telegram link...</span> : null}
              </div>
            ) : null}
          </section>
          {telegramToken ? (
            <section className={styles.systemMessage} role="status">
              <strong>Telegram link code:</strong> <code>{telegramToken}</code>
              {telegramTokenExpiresAt ? <span>Expires {fmtDateTime(telegramTokenExpiresAt)}</span> : null}
              <button type="button" className={styles.button} onClick={() => void copyTelegramInvite()}>
                Copy Invite
              </button>
            </section>
          ) : null}
          {telegramLinkError ? <div className={styles.alert}>{telegramLinkError}</div> : null}
        </>
      ),
      access: (
        <DetailSection
          title="System Access"
          fields={[
            { label: "System User", value: employee.hasSystemAccess },
            { label: "Last Login", value: safeDateTime(employee.lastLoginAt ?? null) },
            { label: "ERP Role", value: (employee as any).erpRoleName },
            { label: "POS Role", value: (employee as any).posRoleName },
            { label: "Approval Limit", value: (employee as any).approvalLimit },
          ]}
        />
      ),
      audit: (
        <DetailSection
          title="Audit Trail"
          fields={[
            { label: "Created At", value: safeDateTime(employee.createdAt ?? null) },
            { label: "Created By", value: employee.createdBy },
            { label: "Updated At", value: safeDateTime(employee.updatedAt ?? null) },
            { label: "Updated By", value: employee.updatedBy },
            { label: "Employee Record", value: employeeCode, span: 2 },
          ]}
        />
      ),
    };
  }, [canManageEmployee, documentForm, documentSaving, documents, documentsError, documentsLoading, employee, employeeCode, employeeRouteId, loadDocuments, nav, position, telegramLinkError, telegramLinkLoading, telegramToken, telegramTokenExpiresAt]);

  function goToEmployees() {
    nav("hr/employees");
  }

  function goToEdit() {
    if (!employeeRouteId) return;
    nav(`hr/employees/${employeeRouteId}/edit`);
  }

  function goToConfirm() {
    if (!employeeRouteId) return;
    nav(`hr/employees/${employeeRouteId}/confirm`);
  }

  function goToTerminate() {
    if (!employeeRouteId) return;
    nav(`hr/employees/${employeeRouteId}/terminate`);
  }

  async function submitDocument(event: { preventDefault: () => void }) {
    event.preventDefault();

    if (!companyId || !employeeRouteId) {
      setDocumentsError("Missing company or employee information.");
      return;
    }

    if (!documentForm.file) {
      setDocumentsError("Upload a document file before saving.");
      return;
    }

    setDocumentSaving(true);
    setDocumentsError(null);

    try {
      await employeeApi.createDocument(companyId, employeeRouteId, {
        documentType: documentForm.documentType,
        fileName: documentForm.fileName || documentForm.file.name,
        expiryDate: documentForm.expiryDate || null,
        file: documentForm.file,
      });

      setDocumentForm(defaultDocumentForm);
      await loadDocuments();
    } catch (e) {
      setDocumentsError(getApiError(e, "Failed to save employee document."));
    } finally {
      setDocumentSaving(false);
    }
  }

  async function downloadDocument(document: EmployeeDocumentDto) {
    if (!companyId || !employeeRouteId) return;

    setDocumentsError(null);

    try {
      const blob = await employeeApi.downloadDocument(companyId, employeeRouteId, document.id);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.fileName || "employee-document";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDocumentsError(getApiError(e, "Failed to download employee document."));
    }
  }

  async function deleteDocument(documentId: string) {
    if (!companyId || !employeeRouteId) return;

    setDocumentsError(null);

    try {
      await employeeApi.deleteDocument(companyId, employeeRouteId, documentId);
      await loadDocuments();
    } catch (e) {
      setDocumentsError(getApiError(e, "Failed to delete employee document."));
    }
  }

  async function unlinkEmployeeTelegram(relink: boolean) {
    if (!companyId || !employeeRouteId || telegramLinkLoading) return;
    if (!window.confirm(relink
      ? "Disconnect this employee's Telegram account and generate a new link code? The employee must use the new code to reconnect."
      : "Disconnect this employee's Telegram account? Existing unused link codes will also be invalidated.")) return;

    setTelegramLinkLoading(true);
    setTelegramLinkError(null);
    setTelegramToken(null);
    setTelegramTokenExpiresAt(null);
    try {
      await employeeApi.unlinkTelegram(companyId, employeeRouteId);
      await loadEmployee(true);
      if (relink) await generateTelegramLink();
    } catch (e) {
      setTelegramLinkError(getApiError(e, "Failed to unlink Telegram. Please retry."));
    } finally {
      setTelegramLinkLoading(false);
    }
  }

  async function generateTelegramLink() {
    setActiveTab("telegram");

    if (!companyId || !employeeRouteId) {
      setTelegramLinkError("Missing company or employee information.");
      return;
    }

    setTelegramLinkLoading(true);
    setTelegramLinkError(null);
    setTelegramToken(null);
    setTelegramTokenExpiresAt(null);

    try {
      const response = await employeeApi.generateTelegramLinkToken(companyId, employeeRouteId);
      const payload = (response as any)?.data ?? (response as any)?.value ?? response;
      const token = payload?.token ?? payload?.linkToken ?? payload?.code ?? null;
      const expiresAt = payload?.expiresAtUtc ?? payload?.expiresAt ?? null;

      if (!token) throw new Error("The server did not return a Telegram link code.");

      setTelegramToken(String(token));
      setTelegramTokenExpiresAt(expiresAt ? String(expiresAt) : null);
      setActiveTab("telegram");
    } catch (e) {
      setTelegramLinkError(getApiError(e, "Failed to generate Telegram link code."));
    } finally {
      setTelegramLinkLoading(false);
    }
  }

  async function copyTelegramInvite() {
    if (!telegramToken) return;

    const message = [
      "Open Hotel Nova Mini App:",
      `https://t.me/hotelnova_bot/erp?startapp=${getTelegramStartParam()}`,
      "",
      "Your HR link code:",
      telegramToken,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(message);
    } catch {
      setTelegramLinkError("Unable to copy. Please copy the code manually.");
    }
  }

  if (loading) return <LoadingState />;

  if (error && !employee) {
    return (
      <div className={styles.root}>
        <div className={styles.alert} role="alert">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          <span>{error}</span>
        </div>
        <button type="button" className={styles.button} onClick={goToEmployees}>
          Back to Employees
        </button>
      </div>
    );
  }

  if (!employee) return <EmptyState onBack={goToEmployees} />;

  return (
    <div className={styles.root}>
      <header className={styles.masterHeader}>
        <div className={styles.breadcrumb}>Human Resources / Employee Master / {employeeCode}</div>

        <div className={styles.headerGrid}>
          <div>
            <div className={styles.entityCode}>{employeeCode}</div>
            <h1>{employee.fullName}</h1>
          </div>

          <div className={styles.headerFacts}>
            <span><strong>Branch</strong>{valueOrDash(employee.branchName)}</span>
            <span><strong>Department</strong>{valueOrDash(employee.departmentName)}</span>
            <span><strong>Position</strong>{valueOrDash(position)}</span>
            <span><strong>Payroll</strong>{valueOrDash(employee.payFrequency)}</span>
          </div>

          <div className={styles.headerStatus}>
            <StatusPill status={employee.status} />
            <span>Hired {safeDate(employee.hireDate)}</span>
          </div>
        </div>
      </header>

      <nav className={styles.commandRibbon} aria-label="Employee actions">
        {canManageEmployee && <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={goToEdit}>
          <i className="ti ti-pencil" aria-hidden="true" /> Edit
        </button>}
        {canManageEmployee && isProbation ? (
          <button type="button" className={styles.button} onClick={goToConfirm}>
            <i className="ti ti-user-check" aria-hidden="true" /> Confirm
          </button>
        ) : null}
        <button type="button" className={styles.button} disabled={refreshing} onClick={() => void loadEmployee(true)}>
          <i className="ti ti-refresh" aria-hidden="true" /> {refreshing ? "Refreshing..." : "Refresh"}
        </button>
        {canManageEmployee && !isTerminated ? (
          <button type="button" className={`${styles.button} ${styles.buttonDanger}`} onClick={goToTerminate}>
            <i className="ti ti-user-x" aria-hidden="true" /> Terminate
          </button>
        ) : null}
        <button type="button" className={styles.button} onClick={goToEmployees}>Back</button>
      </nav>

      {error ? (
        <div className={styles.alert} role="alert">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className={styles.tabs} role="tablist" aria-label="Employee detail sections">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <i className={`ti ${tab.icon}`} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.workspace}>
        <main className={styles.contentPanel}>{tabSections[activeTab]}</main>

        <aside className={styles.sidePanel}>
          <section className={styles.sideSection}>
            <h2>Operational Status</h2>
            <div className={styles.statusRows}>
              <span>Status <strong>{cleanStatus(employee.status)}</strong></span>
              <span>Payroll <strong>{employee.basicSalary && employee.bankAccountNo ? "Ready" : "Incomplete"}</strong></span>
              <span>Attendance <strong>{employee.workSchedule ? "Configured" : "Missing"}</strong></span>
              <span>Access <strong>{employee.hasSystemAccess ? "Enabled" : "Not linked"}</strong></span>
              <span>Completeness <strong>{completeness}%</strong></span>
            </div>
          </section>

          <section className={styles.sideSection}>
            <h2>Missing Information</h2>
            {missingItems.length ? (
              <ul className={styles.validationList}>
                {missingItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p className={styles.muted}>No required gaps detected.</p>
            )}
          </section>

          <section className={styles.sideSection}>
            <h2>Recent Activity</h2>
            <div className={styles.statusRows}>
              <span>Updated <strong>{safeDateTime(employee.updatedAt ?? null)}</strong></span>
              <span>Updated By <strong>{valueOrDash(employee.updatedBy)}</strong></span>
              <span>Last Login <strong>{safeDateTime(employee.lastLoginAt ?? null)}</strong></span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
