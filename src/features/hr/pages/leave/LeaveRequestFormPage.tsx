// src/features/hr/pages/leave/LeaveRequestFormPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppScope } from "../../../../app/useAppScope";
import { useErpNavigate } from "../../../../routes/useErpNavigation";
import { employeeApi, leaveApi } from "../../api/hrApi";
import type { EmployeeListDto, LeaveBalanceDto, LeaveTypeDto } from "../../types/index";
import { getApiError } from "../../utils/hrUtils";

interface LeaveRequestFormValues {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

type FieldErrors = Partial<Record<keyof LeaveRequestFormValues, string>>;

const EMPTY: LeaveRequestFormValues = {
  employeeId: "",
  leaveTypeId: "",
  startDate: "",
  endDate: "",
  reason: "",
};

function validate(v: LeaveRequestFormValues, leaveTypes: LeaveTypeDto[]): FieldErrors {
  const errs: FieldErrors = {};

  if (!v.employeeId) errs.employeeId = "Employee is required.";
  if (!v.leaveTypeId) errs.leaveTypeId = "Leave type is required.";
  if (v.leaveTypeId && !leaveTypes.some((x) => x.id === v.leaveTypeId)) {
    errs.leaveTypeId = "Select a configured leave type.";
  }
  if (!v.startDate) errs.startDate = "Start date is required.";
  if (!v.endDate) errs.endDate = "End date is required.";
  if (v.startDate && v.endDate && v.endDate < v.startDate) {
    errs.endDate = "End date must be on or after start date.";
  }
  if (!v.reason.trim()) errs.reason = "Reason is required.";

  return errs;
}

function errBorder(hasErr: boolean): React.CSSProperties {
  return hasErr ? { outline: "1.5px solid var(--danger)", borderColor: "var(--danger)" } : {};
}

function yearOf(date: string): number {
  const parsed = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(parsed) && parsed > 1900 ? parsed : new Date().getFullYear();
}

interface FieldProps {
  label: string;
  required?: boolean;
  span?: number;
  error?: string;
  fieldKey?: string;
  children: React.ReactNode;
}

function Field({ label, required, span = 1, error, fieldKey, children }: FieldProps) {
  return (
    <div style={{ gridColumn: `span ${span}` }} data-field={fieldKey}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          marginBottom: 4,
          color: error ? "var(--danger)" : "var(--text-muted)",
        }}
      >
        {label}{required && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export default function LeaveRequestFormPage() {
  const nav = useErpNavigate();
  const { companyId, branchId } = useAppScope();

  const [values, setValues] = useState<LeaveRequestFormValues>(EMPTY);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeListDto[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDto[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceDto[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === values.employeeId) ?? null,
    [employees, values.employeeId],
  );

  const selectedLeaveBalance = useMemo(
    () => leaveBalances.find((type) => type.leaveTypeId === values.leaveTypeId) ?? null,
    [leaveBalances, values.leaveTypeId],
  );

  const dayCount = values.startDate && values.endDate
    ? Math.max(0, Math.ceil(
        (new Date(values.endDate).getTime() - new Date(values.startDate).getTime()) / 86400000,
      ) + 1)
    : null;

  const loadEmployees = useCallback(async () => {
    if (!companyId) return;

    setLoadingLookups(true);
    setApiError(null);

    try {
      const rows = await employeeApi.list(companyId, {
        branchId: branchId || undefined,
        status: "Active",
        page: 1,
        pageSize: 500,
      });
      setEmployees(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setEmployees([]);
      setApiError(getApiError(error, "Unable to load employees for leave request."));
    } finally {
      setLoadingLookups(false);
    }
  }, [branchId, companyId]);

  const loadLeaveTypes = useCallback(async () => {
    if (!companyId) return;

    setLoadingBalances(true);
    setApiError(null);

    try {
      const rows = await leaveApi.listTypes(companyId);
      setLeaveTypes(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setLeaveTypes([]);
      setApiError(getApiError(error, "Unable to load configured leave types."));
    } finally {
      setLoadingBalances(false);
    }
  }, [companyId]);

  const loadBalances = useCallback(async () => {
    if (!companyId || !values.employeeId) {
      setLeaveBalances([]);
      return;
    }

    setLoadingBalances(true);
    setApiError(null);

    try {
      const rows = await leaveApi.getBalances(companyId, values.employeeId, yearOf(values.startDate));
      setLeaveBalances(Array.isArray(rows) ? rows : []);
      setValues((current) => ({
        ...current,
        leaveTypeId: leaveTypes.some((row) => row.id === current.leaveTypeId) ? current.leaveTypeId : "",
      }));
    } catch (error) {
      setLeaveBalances([]);
      setApiError(getApiError(error, "Unable to load leave balances for this employee."));
    } finally {
      setLoadingBalances(false);
    }
  }, [companyId, leaveTypes, values.employeeId, values.startDate]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    void loadLeaveTypes();
  }, [loadLeaveTypes]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  function set<K extends keyof LeaveRequestFormValues>(key: K, value: LeaveRequestFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (fieldErrs[key]) {
      setFieldErrs((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function inputStyle(key: keyof LeaveRequestFormValues): React.CSSProperties {
    return { width: "100%", height: 34, fontSize: 13, padding: "0 10px", ...errBorder(!!fieldErrs[key]) };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;

    const errs = validate(values, leaveTypes);
    if (Object.keys(errs).length > 0) {
      setFieldErrs(errs);
      document.querySelector<HTMLElement>(`[data-field="${Object.keys(errs)[0]}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSaving(true);
    setApiError(null);

    try {
      await leaveApi.submit(companyId, {
        ...(branchId ? { BranchId: branchId } : {}),
        EmployeeId: values.employeeId,
        LeaveTypeId: values.leaveTypeId,
        StartDate: values.startDate,
        EndDate: values.endDate,
        Reason: values.reason.trim(),
      });
      nav("hr/leave");
    } catch (error) {
      setApiError(getApiError(error, "Failed to submit leave request."));
    } finally {
      setSaving(false);
    }
  }

  const fe = fieldErrs;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources / Leave</div>
          <div className="page-title">New Leave Request</div>
          <div className="page-sub">Submit an employee leave application</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={saving || loadingLookups}>
            {saving ? "Submitting..." : "Submit Request"}
          </button>
          <button type="button" className="btn" onClick={() => nav("hr/leave")} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>

      {apiError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{apiError}</div>}

      {Object.keys(fe).length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          Please fix the following before submitting:
          <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
            {Object.values(fe).map((msg, i) => <li key={i}>{msg}</li>)}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Request Details
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            <Field label="Employee" required error={fe.employeeId} fieldKey="employeeId" span={2}>
              <select
                className="select"
                value={values.employeeId}
                onChange={(e) => set("employeeId", e.target.value)}
                style={inputStyle("employeeId")}
                disabled={loadingLookups}
              >
                <option value="">{loadingLookups ? "Loading employees..." : "Select employee..."}</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employeeNo} - {employee.fullName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Leave Type" required error={fe.leaveTypeId} fieldKey="leaveTypeId" span={2}>
              <select
                className="select"
                value={values.leaveTypeId}
                onChange={(e) => set("leaveTypeId", e.target.value)}
                style={inputStyle("leaveTypeId")}
                disabled={!values.employeeId || loadingBalances}
              >
                <option value="">
                  {!values.employeeId
                    ? "Select employee first..."
                    : loadingBalances
                      ? "Loading leave balances..."
                      : "Select leave type..."}
                </option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                    {(() => {
                      const balance = leaveBalances.find((row) => row.leaveTypeId === type.id);
                      if (!balance) return type.allowNegativeBalance ? " - no balance limit" : ` - ${type.defaultDaysPerYear} days/year`;
                      return ` - ${balance.available ?? balance.balance ?? 0} available`;
                    })()}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Start Date" required error={fe.startDate} fieldKey="startDate">
              <input
                type="date"
                className="input"
                value={values.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                style={inputStyle("startDate")}
              />
            </Field>

            <Field label="End Date" required error={fe.endDate} fieldKey="endDate">
              <input
                type="date"
                className="input"
                value={values.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                style={inputStyle("endDate")}
              />
            </Field>

            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 20, gridColumn: "span 2" }}>
              {dayCount !== null && (
                <div
                  style={{
                    padding: "6px 14px",
                    background: "var(--surface-2)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 600, fontFamily: "var(--mono)" }}>{dayCount}</span>
                  <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
                    {dayCount === 1 ? "day" : "days"}
                  </span>
                </div>
              )}
              {selectedLeaveBalance && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Available balance: <strong>{selectedLeaveBalance.available ?? selectedLeaveBalance.balance ?? 0}</strong>
                </div>
              )}
            </div>
          </div>

          {selectedEmployee && (
            <div style={{ marginTop: 14, color: "var(--text-muted)", fontSize: 12 }}>
              Requesting for <strong>{selectedEmployee.fullName}</strong> ({selectedEmployee.employeeNo})
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Reason
          </div>
          <div data-field="reason">
            <label
              style={{
                display: "block",
                fontSize: 11,
                marginBottom: 4,
                color: fe.reason ? "var(--danger)" : "var(--text-muted)",
              }}
            >
              Reason for Leave <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <textarea
              className="input"
              value={values.reason}
              onChange={(e) => set("reason", e.target.value)}
              rows={4}
              placeholder="Briefly describe the reason for this leave request..."
              style={{
                width: "100%",
                fontSize: 13,
                padding: "8px 10px",
                resize: "vertical",
                ...errBorder(!!fe.reason),
              }}
            />
            {fe.reason && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{fe.reason}</div>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="submit" className="btn btn-primary" disabled={saving || loadingLookups}>
            {saving ? "Submitting..." : "Submit Request"}
          </button>
          <button type="button" className="btn" onClick={() => nav("hr/leave")} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
