// src/features/hr/pages/Employees/EmployeeListPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { hrLinks } from "../../../../routes/hrRoutes";
import { employeeApi } from "../../api/hrApi";
import type { EmployeeListDto, EmploymentStatus } from "../../types/index";
import {
  EMPLOYMENT_STATUS_CLASS,
  fmtDate,
  getApiError,
} from "../../utils/hrUtils";

const STATUS_OPTIONS: EmploymentStatus[] = [
  "Probation",
  "Active",
  "Suspended",
  "OnLeave",
  "Terminated",
];

export default function EmployeeListPage() {
  const nav = useNavigate();

  const { companyId: routeCompanyId } = useParams<{
    companyId: string;
  }>();

  const { companyId: scopeCompanyId, branchId } = useAppScope();

  const companyId = routeCompanyId || scopeCompanyId || "";

  const [items, setItems] = useState<EmployeeListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const canNavigate = Boolean(companyId);

  const employeeNewUrl = useMemo(
    () => (companyId ? hrLinks.employeeNew(companyId) : "/"),
    [companyId]
  );

  const employeeDetailUrl = useCallback(
    (employeeId: string) =>
      companyId ? hrLinks.employeeDetail(companyId, employeeId) : "/",
    [companyId]
  );

  const load = useCallback(async () => {
    if (!companyId) {
      setError("Missing company context. Please select a company.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await employeeApi.list(companyId, {
        branchId: branchId || undefined,
        search: search || undefined,
        status: status ? (status as EmploymentStatus) : undefined,
      });

      setItems(result);
    } catch (e) {
      setError(getApiError(e, "Failed to load employees."));
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      Active: items.filter((i) => i.status === "Active").length,
      Probation: items.filter((i) => i.status === "Probation").length,
      OnLeave: items.filter((i) => i.status === "OnLeave").length,
      Terminated: items.filter((i) => i.status === "Terminated").length,
    }),
    [items]
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources</div>
          <div className="page-title">Employees</div>
          <div className="page-sub">Manage workforce records and profiles</div>
        </div>

        <button
          className="btn btn-primary"
          disabled={!canNavigate}
          onClick={() => nav(employeeNewUrl)}
        >
          + New Employee
        </button>
      </div>

      {!canNavigate && (
        <div className="alert alert-danger">
          Missing company route context. Open this page through:
          <br />
          <strong>/companies/:companyId/hr/employees</strong>
        </div>
      )}

      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}
      >
        {(["Active", "Probation", "OnLeave", "Terminated"] as EmploymentStatus[]).map(
          (s) => (
            <div className="kpi" key={s}>
              <div className="kpi-label">{s}</div>
              <div className="kpi-val">{counts[s as keyof typeof counts]}</div>
              <div className="kpi-sub">employees</div>
            </div>
          )
        )}
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Search name, email, number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260, height: 32, fontSize: 13 }}
        />

        <label
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Status
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              width: 140,
              fontSize: 13,
              height: 32,
              padding: "0 8px",
            }}
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <button className="btn" onClick={() => void load()} disabled={loading}>
          <i className="ti ti-refresh" /> {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Employee #</th>
              <th>Name</th>
              <th>Department</th>
              <th>Position</th>
              <th>Type</th>
              <th>Status</th>
              <th>Hire Date</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 48,
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 56,
                    textAlign: "center",
                    color: "var(--text-soft)",
                  }}
                >
                  No employees found.{" "}
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!canNavigate}
                    onClick={() => nav(employeeNewUrl)}
                  >
                    Add one
                  </button>
                </td>
              </tr>
            ) : (
              items.map((emp) => (
                <tr
                  key={emp.id}
                  style={{ cursor: canNavigate ? "pointer" : "default" }}
                  onClick={() => {
                    if (canNavigate) nav(employeeDetailUrl(emp.id));
                  }}
                >
                  <td
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    {emp.employeeNo}
                  </td>

                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>
                      {emp.fullName}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-soft)" }}>
                      {emp.workEmail}
                    </div>
                  </td>

                  <td style={{ fontSize: 13 }}>{emp.departmentName}</td>
                  <td style={{ fontSize: 13 }}>{emp.positionTitle}</td>

                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {emp.employmentType}
                  </td>

                  <td>
                    <span className={EMPLOYMENT_STATUS_CLASS[emp.status]}>
                      {emp.status}
                    </span>
                  </td>

                  <td
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    {fmtDate(emp.hireDate)}
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-sm"
                      disabled={!canNavigate}
                      onClick={(e) => {
                        e.stopPropagation();
                        nav(employeeDetailUrl(emp.id));
                      }}
                    >
                      Open →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}