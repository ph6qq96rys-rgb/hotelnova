// src/features/hr/pages/employees/EmployeeDetailPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { useErpNavigate } from "../../../../routes/useErpNavigation";
import { employeeApi } from "../../api/hrApi";
import type { EmployeeDetailDto } from "../../types";
import { fmtDate, fmtMoney, getApiError } from "../../utils/hrUtils";

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

type TabKey =
  | "general"
  | "employment"
  | "organization"
  | "payroll"
  | "attendance"
  | "leave"
  | "documents"
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
  { key: "access", label: "Access", icon: "ti-shield-lock" },
  { key: "audit", label: "Audit", icon: "ti-history" },
];

function unwrapEmployee(response: unknown): EmployeeDetailView | null {
  if (!response) return null;

  const container = response as Record<string, unknown>;
  return ((container.data ?? container.value ?? container.result ?? response) as EmployeeDetailView) ?? null;
}

function valueOrDash(value: DetailValue): string | number {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
}

function safeDate(value?: string | null): string {
  return value ? fmtDate(value) : "—";
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
  return employee.employeeCode ?? employee.employeeNo ?? "—";
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

  const employeeRouteId = employee?.id ?? employeeId;
  const employeeCode = employee ? getEmployeeCode(employee) : "—";
  const position = employee ? getPosition(employee) : null;
  const isProbation = cleanStatus(employee?.status).toLowerCase() === "probation";
  const isTerminated = cleanStatus(employee?.status).toLowerCase() === "terminated";
  const missingItems = useMemo(() => (employee ? getMissingItems(employee) : []), [employee]);
  const completeness = employee ? getCompleteness(employee) : 0;

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
            { label: "Company", value: companyId },
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
      ),
      leave: (
        <DetailSection
          title="Leave Profile"
          fields={[
            { label: "Leave Group", value: (employee as any).leaveGroupName },
            { label: "Annual Leave Balance", value: (employee as any).annualLeaveBalance },
            { label: "Sick Leave Balance", value: (employee as any).sickLeaveBalance },
            { label: "Pending Requests", value: (employee as any).pendingLeaveRequests },
            { label: "Last Leave Taken", value: safeDate((employee as any).lastLeaveTakenAt ?? null) },
          ]}
        />
      ),
      documents: (
        <section className={styles.detailSection}>
          <h2>Document Register</h2>
          <div className={styles.tableWrap}>
            <table className={styles.erpTable}>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Expiry</th>
                  <th>Reference</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {["National ID", "Employment Contract", "Medical Certificate", "Food Handler License", "Work Permit", "Training Certificate"].map((doc) => (
                  <tr key={doc}>
                    <td>{doc}</td>
                    <td><span className={`${styles.badge} ${styles.badgeNeutral}`}>Not configured</span></td>
                    <td>—</td>
                    <td>—</td>
                    <td><button type="button" className={styles.linkButton} onClick={() => employeeRouteId && nav(`hr/employees/${employeeRouteId}/documents`)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ),
      access: (
        <>
          <DetailSection
            title="System Access"
            fields={[
              { label: "System User", value: employee.hasSystemAccess },
              { label: "Last Login", value: safeDate(employee.lastLoginAt ?? null) },
              { label: "Telegram Username", value: employee.telegramUserName },
              { label: "Telegram Chat ID", value: employee.telegramChatId },
              { label: "Telegram Linked At", value: safeDate(employee.telegramLinkedAtUtc ?? null) },
              { label: "ERP Role", value: (employee as any).erpRoleName },
              { label: "POS Role", value: (employee as any).posRoleName },
              { label: "Approval Limit", value: (employee as any).approvalLimit },
            ]}
          />
          {telegramToken ? (
            <section className={styles.systemMessage} role="status">
              <strong>Telegram link code:</strong> <code>{telegramToken}</code>
              {telegramTokenExpiresAt ? <span>Expires {fmtDate(telegramTokenExpiresAt)}</span> : null}
              <button type="button" className={styles.button} onClick={() => void copyTelegramInvite()}>
                Copy Invite
              </button>
            </section>
          ) : null}
          {telegramLinkError ? <div className={styles.alert}>{telegramLinkError}</div> : null}
        </>
      ),
      audit: (
        <DetailSection
          title="Audit Trail"
          fields={[
            { label: "Created At", value: safeDate(employee.createdAt ?? null) },
            { label: "Created By", value: employee.createdBy },
            { label: "Updated At", value: safeDate(employee.updatedAt ?? null) },
            { label: "Updated By", value: employee.updatedBy },
            { label: "Record ID", value: employeeRouteId, span: 2 },
          ]}
        />
      ),
    };
  }, [companyId, employee, employeeCode, employeeRouteId, nav, position, telegramLinkError, telegramToken, telegramTokenExpiresAt]);

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

  async function generateTelegramLink() {
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
      setActiveTab("access");
    } catch (e) {
      setTelegramLinkError(getApiError(e, "Failed to generate Telegram link code."));
    } finally {
      setTelegramLinkLoading(false);
    }
  }

  async function copyTelegramInvite() {
    if (!telegramToken) return;

    const message = [
      "Open HotelNova Mini App:",
      "https://t.me/hotelnova_bot/erp?startapp=ambassador",
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
        <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={goToEdit}>
          <i className="ti ti-pencil" aria-hidden="true" /> Edit
        </button>
        {isProbation ? (
          <button type="button" className={styles.button} onClick={goToConfirm}>
            <i className="ti ti-user-check" aria-hidden="true" /> Confirm
          </button>
        ) : null}
        <button type="button" className={styles.button} onClick={() => nav("hr/attendance")}>
          <i className="ti ti-clock" aria-hidden="true" /> Attendance
        </button>
        <button type="button" className={styles.button} onClick={() => employeeRouteId && nav(`hr/leave/balances/${employeeRouteId}`)}>
          <i className="ti ti-calendar" aria-hidden="true" /> Leave
        </button>
        <button type="button" className={styles.button} onClick={() => nav("hr/payroll")}>
          <i className="ti ti-cash" aria-hidden="true" /> Payroll
        </button>
        <button type="button" className={styles.button} onClick={() => employeeRouteId && nav(`hr/employees/${employeeRouteId}/documents`)}>
          <i className="ti ti-file-text" aria-hidden="true" /> Documents
        </button>
        <button type="button" className={styles.button} onClick={generateTelegramLink} disabled={telegramLinkLoading}>
          <i className="ti ti-brand-telegram" aria-hidden="true" /> {telegramLinkLoading ? "Generating…" : "Telegram"}
        </button>
        <button type="button" className={styles.button} disabled={refreshing} onClick={() => void loadEmployee(true)}>
          <i className="ti ti-refresh" aria-hidden="true" /> {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        {!isTerminated ? (
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
              <span>Updated <strong>{safeDate(employee.updatedAt ?? null)}</strong></span>
              <span>Updated By <strong>{valueOrDash(employee.updatedBy)}</strong></span>
              <span>Last Login <strong>{safeDate(employee.lastLoginAt ?? null)}</strong></span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
