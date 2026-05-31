// src/features/hr/pages/Employees/EmployeeDetailPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { employeeApi } from "../../api/hrApi";
import type { EmployeeDetailDto } from "../../types";
import {
  EMPLOYMENT_STATUS_CLASS,
  fmtDate,
  fmtMoney,
  getApiError,
} from "../../utils/hrUtils";
import "./Employee-style.css";

function valueOrDash(value?: string | number | null) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="erp-profile-field">
      <div className="erp-profile-field__label">{label}</div>
      <div className="erp-profile-field__value">{valueOrDash(value)}</div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="erp-section">
      <div className="erp-section__header">
        <div>
          <div className="erp-section__title">{title}</div>
          {subtitle && <div className="erp-section__subtitle">{subtitle}</div>}
        </div>
      </div>

      <div className="erp-section__grid">{children}</div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="erp-kpi">
      <div className="erp-kpi__label">{label}</div>
      <div className="erp-kpi__value">{value}</div>
      {hint && <div className="erp-kpi__hint">{hint}</div>}
    </div>
  );
}

export default function EmployeeDetailPage() {
  const nav = useNavigate();

  const { tenantSlug, companyId, employeeId } = useParams<{
    tenantSlug: string;
    companyId: string;
    employeeId: string;
  }>();

  const [item, setItem] = useState<EmployeeDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hrUrl = useCallback(
    (path = "") => {
      if (!tenantSlug || !companyId) return "/";

      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      return `/${tenantSlug}/companies/${companyId}/hr${cleanPath}`;
    },
    [tenantSlug, companyId]
  );

  const load = useCallback(async () => {
    if (!companyId || !employeeId) {
      setError("Missing company or employee route information.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await employeeApi.get(companyId, employeeId);
      setItem((res as any)?.data ?? res);
    } catch (e) {
      setError(getApiError(e, "Failed to load employee."));
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeCode = useMemo(
    () => item?.employeeCode ?? (item as any)?.employeeNo ?? "—",
    [item]
  );

  if (loading) {
    return (
      <div className="page">
        <div className="erp-loading">Loading employee profile…</div>
      </div>
    );
  }

  if (error && !item) {
    return (
      <div className="page">
        <div className="alert alert-danger">{error}</div>

        <button className="btn" onClick={() => nav(hrUrl("/employees"))}>
          ← Back to Employees
        </button>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page">
        <div className="erp-empty">Employee not found.</div>

        <button className="btn" onClick={() => nav(hrUrl("/employees"))}>
          ← Back to Employees
        </button>
      </div>
    );
  }

  const statusClass =
    EMPLOYMENT_STATUS_CLASS[
      item.status as keyof typeof EMPLOYMENT_STATUS_CLASS
    ] ?? "badge";

  const isTerminated = item.status === "Terminated";
  const isProbation = item.status === "Probation";

  return (
    <div className="page erp-profile-page">
      <div className="erp-profile-hero">
        <div className="erp-profile-hero__main">
          <div className="erp-avatar" aria-hidden="true">
            {item.fullName
              ?.split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((x) => x[0])
              .join("")
              .toUpperCase() || "E"}
          </div>

          <div>
            <div className="page-kicker">Human Resources · Employee Profile</div>
            <div className="erp-profile-title">{item.fullName}</div>

            <div className="erp-profile-tags">
              <span className="erp-chip">{employeeCode}</span>
              <span className="erp-chip">{item.departmentName}</span>
              <span className="erp-chip">{item.positionTitle}</span>
              <span className={statusClass}>{item.status}</span>
            </div>
          </div>
        </div>

        <div className="erp-profile-actions">
          <button
            className="btn btn-primary"
            onClick={() => nav(hrUrl(`/employees/${item.id}/edit`))}
          >
            Edit Profile
          </button>

          <button className="btn" onClick={() => void load()}>
            Refresh
          </button>

          <button className="btn" onClick={() => nav(hrUrl("/employees"))}>
            ← Back
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="erp-kpi-grid">
        <KpiCard
          label="Years of Service"
          value={item.yearsOfService}
          hint={`Since ${fmtDate(item.hireDate)}`}
        />

        <KpiCard
          label="Monthly Salary"
          value={fmtMoney(item.basicSalary)}
          hint="Current basic salary"
        />

        <KpiCard
          label="Employment Type"
          value={item.employmentType}
          hint={item.workEmail}
        />

        <KpiCard
          label="Confirmation"
          value={
            item.confirmationDate ? fmtDate(item.confirmationDate) : "Pending"
          }
          hint={isProbation ? "On probation" : "Confirmed / processed"}
        />
      </div>

      <div className="erp-profile-layout">
        <div className="erp-profile-main">
          <Section
            title="Personal Information"
            subtitle="Legal identity and contact information"
          >
            <Field label="Full Name" value={item.fullName} />
            <Field label="Gender" value={item.gender} />
            <Field label="Date of Birth" value={fmtDate(item.dateOfBirth)} />
            <Field label="Marital Status" value={item.maritalStatus} />
            <Field label="Phone Number" value={item.phoneNumber} />
            <Field label="Address" value={item.address} />
            <Field label="National ID" value={item.nationalId} />
            <Field label="Tax ID" value={item.taxId} />
            <Field label="Pension ID" value={item.pensionId} />
          </Section>

          <Section
            title="Employment Details"
            subtitle="Organizational assignment and employment lifecycle"
          >
            <Field label="Employee Code" value={employeeCode} />
            <Field label="Department" value={item.departmentName} />
            <Field label="Position" value={item.positionTitle} />
            <Field
              label="Manager"
              value={item.managerName ?? "No manager assigned"}
            />
            <Field label="Employment Type" value={item.employmentType} />
            <Field label="Status" value={item.status} />
            <Field label="Hire Date" value={fmtDate(item.hireDate)} />
            <Field
              label="Confirmation Date"
              value={
                item.confirmationDate
                  ? fmtDate(item.confirmationDate)
                  : "Pending"
              }
            />
            <Field label="Work Email" value={item.workEmail} />
          </Section>

          <Section
            title="Compensation & Banking"
            subtitle="Payroll source information"
          >
            <Field label="Basic Salary" value={fmtMoney(item.basicSalary)} />
            <Field label="Bank Name" value={item.bankName} />
            <Field label="Bank Account No." value={item.bankAccountNo} />
          </Section>
        </div>

        <aside className="erp-profile-side">
          <section className="erp-side-card">
            <div className="erp-side-card__title">Employee Snapshot</div>

            <div className="erp-snapshot-row">
              <span>Employee Code</span>
              <strong>{employeeCode}</strong>
            </div>

            <div className="erp-snapshot-row">
              <span>Status</span>
              <strong>{item.status}</strong>
            </div>

            <div className="erp-snapshot-row">
              <span>Department</span>
              <strong>{item.departmentName}</strong>
            </div>

            <div className="erp-snapshot-row">
              <span>Position</span>
              <strong>{item.positionTitle}</strong>
            </div>

            <div className="erp-snapshot-row">
              <span>Manager</span>
              <strong>{item.managerName ?? "—"}</strong>
            </div>
          </section>

          <section className="erp-side-card">
            <div className="erp-side-card__title">Quick Actions</div>

            {isProbation && (
              <button
                className="btn btn-primary erp-side-action"
                onClick={() => nav(hrUrl(`/employees/${item.id}/confirm`))}
              >
                Confirm Employee
              </button>
            )}

            <button
              className="btn erp-side-action"
              onClick={() => nav(hrUrl("/attendance"))}
            >
              Attendance
            </button>

            <button
              className="btn erp-side-action"
              onClick={() => nav(hrUrl(`/leave/balances/${item.id}`))}
            >
              Leave Balances
            </button>

            <button
              className="btn erp-side-action"
              onClick={() => nav(hrUrl("/payroll"))}
            >
              Payroll
            </button>

            {!isTerminated && (
              <button
                className="btn erp-side-action erp-danger-action"
                onClick={() => nav(hrUrl(`/employees/${item.id}/terminate`))}
              >
                Terminate Employee
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}