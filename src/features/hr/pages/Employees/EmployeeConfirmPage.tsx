// src/features/hr/pages/employees/EmployeeConfirmPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { useErpNavigate } from "../../../../routes/useErpNavigation";

import { employeeApi } from "../../api/hrApi";
import type { EmployeeDetailDto } from "../../types";
import {
  EMPLOYMENT_STATUS_CLASS,
  fmtDate,
  fmtMoney,
  getApiError,
} from "../../utils/hrUtils";

export default function EmployeeConfirmPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { companyId } = useAppScope();
  const erpNav = useErpNavigate();

  const [employee, setEmployee] = useState<EmployeeDetailDto | null>(null);
  const [confirmationDate, setConfirmationDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeeDetailPath = useMemo(() => {
    if (!companyId || !employeeId) return "/hr/employees";
    return `/companies/${companyId}/hr/employees/${employeeId}`;
  }, [companyId, employeeId]);

  const employeesPath = useMemo(() => {
    if (!companyId) return "/hr/employees";
    return `/companies/${companyId}/hr/employees`;
  }, [companyId]);

  const goToEmployee = useCallback(() => {
    erpNav(employeeDetailPath);
  }, [erpNav, employeeDetailPath]);

  const goToEmployees = useCallback(() => {
    erpNav(employeesPath);
  }, [erpNav, employeesPath]);

  const loadEmployee = useCallback(async () => {
    if (!companyId || !employeeId) {
      setLoading(false);
      setError("Missing company or employee context.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const dto = await employeeApi.get(companyId, employeeId);
      setEmployee(dto);

      if (dto.status !== "Probation") {
        setError(`This employee is "${dto.status}" and cannot be confirmed.`);
      }
    } catch (e) {
      setError(getApiError(e, "Failed to load employee."));
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

  const canConfirm = employee?.status === "Probation" && !saving;

  async function handleConfirm() {
    if (!companyId || !employeeId || !employee) return;

    if (!confirmationDate) {
      setError("Confirmation date is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await employeeApi.confirm(companyId, employeeId, confirmationDate);
      goToEmployee();
    } catch (e) {
      setError(getApiError(e, "Failed to confirm employee."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <section className="card" style={{ padding: 32, textAlign: "center" }}>
          <div className="page-sub">Loading employee confirmation...</div>
        </section>
      </main>
    );
  }

  if (!employee) {
    return (
      <main className="page">
        <section className="card">
          <div className="alert alert-danger">
            {error ?? "Employee could not be loaded."}
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn" onClick={goToEmployees}>
              ← Back to Employees
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Employees</div>
          <h1 className="page-title">Confirm Employee</h1>
          <p className="page-sub">
            {employee.fullName} · {employee.employeeNo} ·{" "}
            {employee.positionTitle || "No position assigned"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn"
            onClick={goToEmployee}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {saving ? "Confirming..." : "Confirm Employment"}
          </button>
        </div>
      </header>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <section
        className="kpi-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 20,
        }}
      >
        <div className="kpi">
          <div className="kpi-label">Current Status</div>
          <div className="kpi-val" style={{ fontSize: 14 }}>
            <span className={EMPLOYMENT_STATUS_CLASS[employee.status]}>
              {employee.status}
            </span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Hire Date</div>
          <div className="kpi-val" style={{ fontSize: 14 }}>
            {fmtDate(employee.hireDate)}
          </div>
          <div className="kpi-sub">{employee.yearsOfService}y service</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Department</div>
          <div className="kpi-val" style={{ fontSize: 14 }}>
            {employee.departmentName || "Not assigned"}
          </div>
          <div className="kpi-sub">
            {employee.positionTitle || "No position assigned"}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Basic Salary</div>
          <div className="kpi-val" style={{ fontSize: 14 }}>
            {fmtMoney(employee.basicSalary)}
          </div>
          <div className="kpi-sub">per month</div>
        </div>
      </section>

      <section className="card" style={{ maxWidth: 560 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Confirmation Details
        </div>

        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: 6,
          }}
        >
          Confirmation Date <span style={{ color: "var(--danger)" }}>*</span>
        </label>

        <input
          type="date"
          className="input"
          value={confirmationDate}
          onChange={(e) => setConfirmationDate(e.target.value)}
          disabled={!canConfirm}
          style={{
            width: "100%",
            height: 38,
            fontSize: 13,
            padding: "0 10px",
            marginBottom: 18,
          }}
        />

        <div
          style={{
            padding: "14px 16px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          Confirming{" "}
          <strong style={{ color: "var(--text)" }}>{employee.fullName}</strong>{" "}
          will change the employee status from{" "}
          <strong style={{ color: "var(--text)" }}>Probation</strong> to{" "}
          <strong style={{ color: "var(--text)" }}>Active</strong> and record{" "}
          <strong style={{ color: "var(--text)" }}>
            {confirmationDate ? fmtDate(confirmationDate) : "—"}
          </strong>{" "}
          as the confirmation date.
        </div>
      </section>
    </main>
  );
}