// src/features/hr/pages/HRDashboardPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../../i18n";

import { useAppScope } from "../../../app/useAppScope";
import { useErpNavigate } from "../../../routes/useErpNavigation";
import { hrDashboardApi } from "../api/hrApi";
import type { HRDashboardDto } from "../types/index";
import { fmtPercent, getApiError } from "../utils/hrUtils";

type QuickAccessItem = {
  label: string;
  sub: string;
  path: string;
  icon: string;
};

export default function HRDashboardPage() {
  const { tx } = useI18n();
  const erpNav = useErpNavigate();
  const { companyId, branchId } = useAppScope();

  const [data, setData] = useState<HRDashboardDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setData(null);
      setError(tx("Missing company context. Please select a company first."));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setData(await hrDashboardApi.get(companyId, branchId));
    } catch (e) {
      setError(getApiError(e, tx("Failed to load HR dashboard.")));
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, tx]);

  useEffect(() => {
    load();
  }, [load]);

  const quickAccessItems = useMemo<QuickAccessItem[]>(() => {
    if (!data) return [];

    return [
      {
        label: tx("Employees"),
        sub: `${data.activeEmployees} ${tx("active")}`,
        path: "hr/employees",
        icon: "ti-users",
      },
      {
        label: tx("Leave"),
        sub: `${data.pendingLeaveRequests} ${tx("pending")}`,
        path: "hr/leave",
        icon: "ti-calendar-off",
      },
      {
        label: tx("Attendance"),
        sub: `${fmtPercent(data.averageAttendancePercent)} ${tx("today")}`,
        path: "hr/attendance",
        icon: "ti-clock",
      },
      {
        label: tx("Payroll"),
        sub: tx("Process & approve"),
        path: "hr/payroll",
        icon: "ti-credit-card",
      },
      {
        label: tx("Recruitment"),
        sub: `${data.openPositions} ${tx("open positions")}`,
        path: "hr/recruitment",
        icon: "ti-briefcase",
      },
      {
        label: tx("Performance"),
        sub: `${data.upcomingReviews} ${tx("reviews due")}`,
        path: "hr/performance",
        icon: "ti-star",
      },
      {
        label: tx("Training"),
        sub: `${data.trainingsDue} ${tx("due soon")}`,
        path: "hr/training",
        icon: "ti-school",
      },
    ];
  }, [data, tx]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">{tx("Human Resources")}</div>
          <div className="page-title">{tx("HR Dashboard")}</div>
          <div className="page-sub">{tx("Workforce overview and key metrics")}</div>
        </div>

        <button className="btn" onClick={load} disabled={loading || !companyId}>
          <i className="ti ti-refresh" /> {loading ? tx("Loading...") : tx("Refresh")}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {data && (
        <>
          <div
            className="kpi-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              marginBottom: 20,
            }}
          >
            <div className="kpi">
              <div className="kpi-label">{tx("Total Employees")}</div>
              <div className="kpi-val">{data.totalEmployees}</div>
              <div className="kpi-sub">{data.activeEmployees} {tx("active")}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">{tx("New Hires")}</div>
              <div className="kpi-val" style={{ color: "var(--success)" }}>
                +{data.newHiresThisMonth}
              </div>
              <div className="kpi-sub">{tx("this month")}</div>
              {data.terminationsThisMonth > 0 && (
                <div className="kpi-badge badge-danger">
                  {data.terminationsThisMonth} {tx("terminations")}
                </div>
              )}
            </div>

            <div className="kpi">
              <div className="kpi-label">{tx("Attendance")}</div>
              <div
                className="kpi-val"
                style={{
                  color:
                    data.averageAttendancePercent >= 90
                      ? "var(--success)"
                      : data.averageAttendancePercent >= 75
                        ? "var(--warn)"
                        : "var(--danger)",
                }}
              >
                {fmtPercent(data.averageAttendancePercent)}
              </div>
              <div className="kpi-sub">{tx("today's rate")}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">{tx("Pending Actions")}</div>
              <div className="kpi-val">
                {data.pendingLeaveRequests + data.pendingOvertimeRequests}
              </div>
              <div className="kpi-sub">{tx("leave & overtime")}</div>
              {data.pendingLeaveRequests > 0 && (
                <div className="kpi-badge badge-warn">
                  {data.pendingLeaveRequests} {tx("leave requests")}
                </div>
              )}
            </div>

            <div className="kpi">
              <div className="kpi-label">{tx("Open Positions")}</div>
              <div className="kpi-val">{data.openPositions}</div>
              <div className="kpi-sub">{tx("active vacancies")}</div>
              {data.upcomingReviews > 0 && (
                <div className="kpi-badge badge-warn">
                  {data.upcomingReviews} {tx("reviews due")}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div className="card">
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                {tx("Headcount by Department")}
              </div>

              {data.headcountByDept.length === 0 ? (
                <div className="page-sub">{tx("No department headcount data yet.")}</div>
              ) : (
                data.headcountByDept.map((d) => {
                  const pct = data.totalEmployees > 0
                    ? Math.round((d.count / data.totalEmployees) * 100)
                    : 0;

                  return (
                    <div key={d.departmentName} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 13,
                          marginBottom: 4,
                        }}
                      >
                        <span>{d.departmentName}</span>
                        <span style={{ fontWeight: 600, fontFamily: "var(--mono)" }}>
                          {d.count}
                        </span>
                      </div>
                      <div style={{ height: 6, background: "var(--border)", borderRadius: 3 }}>
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 3,
                            background: "var(--accent)",
                            width: `${pct}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="card">
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                {tx("Quick Access")}
              </div>

              {quickAccessItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => erpNav(item.path)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 0",
                    cursor: "pointer",
                    border: 0,
                    borderBottom: "1px solid var(--border)",
                    background: "transparent",
                    color: "inherit",
                    textAlign: "left",
                  }}
                >
                  <i
                    className={`ti ${item.icon}`}
                    style={{
                      fontSize: 18,
                      color: "var(--accent)",
                      width: 24,
                      textAlign: "center",
                    }}
                  />
                  <span>
                    <span style={{ display: "block", fontWeight: 500, fontSize: 13 }}>
                      {item.label}
                    </span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>
                      {item.sub}
                    </span>
                  </span>
                  <span style={{ marginLeft: "auto", color: "var(--text-soft)" }}>{tx("Open")}</span>
                </button>
              ))}
            </div>
          </div>

          {data.leaveStatusSummary.length > 0 && (
            <div className="card">
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                {tx("On Leave Today")}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {data.leaveStatusSummary.map((l) => (
                  <div
                    key={l.leaveType}
                    style={{
                      padding: "6px 14px",
                      background: "var(--surface-2)",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{l.onLeaveToday}</span>
                    <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
                      {l.leaveType}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
