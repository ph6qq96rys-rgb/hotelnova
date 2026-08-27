// src/features/hr/pages/payroll/PayrollListPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppScope } from "../../../../app/useAppScope";
import { useErpNavigate } from "../../../../routes/useErpNavigation";
import { formatAppDateTime } from "../../../../shared/datetime/dateFormat";

import { payrollApi } from "../../api/hrApi";
import type { PayrollRunDto } from "../../types";
import {
  PAYROLL_STATUS_CLASS,
  fmtDate,
  fmtMoney,
  getApiError,
} from "../../utils/hrUtils";

type PayrollAction = "process" | "approve" | "pay";

export default function PayrollListPage() {
  const { companyId } = useAppScope();
  const erpNav = useErpNavigate();

  const currentYear = new Date().getFullYear();
  const printedAt = useMemo(() => formatAppDateTime(new Date()), []);

  const [items, setItems] = useState<PayrollRunDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(currentYear);

  const years = useMemo(
    () => Array.from({ length: 7 }, (_, i) => currentYear - 3 + i),
    [currentYear],
  );

  const paths = useMemo(() => {
    const base = companyId
      ? `/companies/${companyId}/hr/payroll`
      : "/hr/payroll";

    return {
      list: base,
      create: `${base}/new`,
      detail: (id: string) => `${base}/runs/${id}`,
    };
  }, [companyId]);

  const load = useCallback(async () => {
    if (!companyId) {
      setItems([]);
      setError("Missing company context.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await payrollApi.listRuns(companyId, year);
      setItems(data);
    } catch (e) {
      setError(getApiError(e, "Failed to load payroll runs."));
    } finally {
      setLoading(false);
    }
  }, [companyId, year]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () => ({
      gross: items.reduce((sum, run) => sum + run.totalGross, 0),
      deductions: items.reduce((sum, run) => sum + run.totalDeductions, 0),
      net: items.reduce((sum, run) => sum + run.totalNet, 0),
      employees: items.reduce((sum, run) => sum + run.employeeCount, 0),
      pending: items.filter(
        (run) => run.status === "Draft" || run.status === "Pending",
      ).length,
    }),
    [items],
  );

  async function executeAction(id: string, action: PayrollAction) {
    if (!companyId) return;

    setWorking(id);
    setError(null);

    try {
      if (action === "process") {
        await payrollApi.processRun(companyId, id, "HR");
      }

      if (action === "approve") {
        await payrollApi.approveRun(companyId, id, "HR");
      }

      if (action === "pay") {
        await payrollApi.markPaid(companyId, id, "HR");
      }

      await load();
    } catch (e) {
      setError(getApiError(e, "Payroll action failed."));
    } finally {
      setWorking(null);
    }
  }

  function goToCreate() {
    erpNav(paths.create);
  }

  function goToDetail(id: string) {
    erpNav(paths.detail(id));
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <div className="page-kicker">Human Resources '- Payroll</div>
          <h1 className="page-title">Payroll Management</h1>
          <p className="page-sub">
            Process, approve, and settle company payroll runs.
          </p>
        </div>

        <div
          className="payroll-screen-actions"
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <select
            className="select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            disabled={loading || !!working}
            style={{ height: 36, padding: "0 10px", fontSize: 13 }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-primary"
            onClick={goToCreate}
            disabled={!companyId || loading || !!working}
          >
            + New Payroll Run
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => window.print()}
            disabled={loading}
          >
            <i className="ti ti-printer" aria-hidden="true" /> Print
          </button>
        </div>
      </header>

      <section className="payroll-print-only payroll-print-title">
        <div>
          <div className="payroll-print-kicker">Human Resources / Payroll</div>
          <h1>Payroll Run Register</h1>
          <p>Payroll year: {year}</p>
        </div>
        <div className="payroll-print-meta">
          <span>Printed</span>
          <strong>{printedAt}</strong>
        </div>
      </section>

      <section
        className="kpi-grid payroll-print-summary"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          marginBottom: 20,
        }}
      >
        <div className="kpi">
          <div className="kpi-label">Runs This Year</div>
          <div className="kpi-val">{items.length}</div>
          <div className="kpi-sub">{year} payroll runs</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Total Gross</div>
          <div className="kpi-val" style={{ fontSize: 15 }}>
            {fmtMoney(totals.gross)}
          </div>
          <div className="kpi-sub">year to date</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Total Net</div>
          <div className="kpi-val" style={{ fontSize: 15 }}>
            {fmtMoney(totals.net)}
          </div>
          <div className="kpi-sub">after deductions</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Pending Actions</div>
          <div className="kpi-val">{totals.pending}</div>
          <div className="kpi-sub">draft or pending approval</div>
        </div>
      </section>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <section className="card payroll-print-card" style={{ padding: 0 }}>
        <table className="table payroll-print-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Date Range</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Employees</th>
              <th style={{ textAlign: "right" }}>Gross Pay</th>
              <th style={{ textAlign: "right" }}>Deductions</th>
              <th style={{ textAlign: "right" }}>Net Pay</th>
              <th className="payroll-screen-only" style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 48,
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  Loading payroll runs...
                </td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 48,
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--text)" }}>
                    No payroll runs found
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Create the first payroll run for {year}.
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary payroll-screen-only"
                    style={{ marginTop: 16 }}
                    onClick={goToCreate}
                    disabled={!companyId}
                  >
                    Create Payroll Run
                  </button>
                </td>
              </tr>
            )}

            {!loading &&
              items.map((run) => (
                <tr key={run.id}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>
                    {run.periodName}
                  </td>

                  <td
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontFamily: "var(--mono)",
                    }}
                  >
                    {fmtDate(run.periodStart)} '" {fmtDate(run.periodEnd)}
                  </td>

                  <td>
                    <span className={PAYROLL_STATUS_CLASS[run.status]}>
                      {run.status}
                    </span>
                  </td>

                  <td style={numberCell}>{run.employeeCount}</td>
                  <td style={numberCell}>{fmtMoney(run.totalGross)}</td>

                  <td style={{ ...numberCell, color: "var(--danger)" }}>
                    ({fmtMoney(run.totalDeductions)})
                  </td>

                  <td style={{ ...numberCell, fontWeight: 700 }}>
                    {fmtMoney(run.totalNet)}
                  </td>

                  <td className="payroll-screen-only" style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "flex-end",
                        flexWrap: "wrap",
                      }}
                    >
                      {run.status === "Draft" && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={working === run.id}
                          onClick={() => executeAction(run.id, "process")}
                        >
                          Process
                        </button>
                      )}

                      {run.status === "Pending" && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={working === run.id}
                          onClick={() => executeAction(run.id, "approve")}
                        >
                          Approve
                        </button>
                      )}

                      {run.status === "Approved" && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={working === run.id}
                          onClick={() => executeAction(run.id, "pay")}
                        >
                          Mark Paid
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={working === run.id}
                        onClick={() => goToDetail(run.id)}
                      >
                        View  '
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <div className="payroll-print-only payroll-print-footer">
        <span>Prepared by HR Payroll</span>
        <span>Reviewed by ____________________</span>
        <span>Approved by ____________________</span>
      </div>

      <PayrollPrintStyles />
    </main>
  );
}

const numberCell: React.CSSProperties = {
  textAlign: "right",
  fontFamily: "var(--mono)",
  fontSize: 12,
};

function PayrollPrintStyles() {
  return (
    <style>{`
      .payroll-print-only {
        display: none;
      }

      @media print {
        @page {
          size: A4 landscape;
          margin: 12mm;
        }

        body {
          background: #fff !important;
          color: #111827 !important;
        }

        body * {
          visibility: hidden;
        }

        .page,
        .page * {
          visibility: visible;
        }

        .page {
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
        }

        .page-header,
        .payroll-screen-only,
        .payroll-screen-actions,
        .alert {
          display: none !important;
        }

        .payroll-print-only {
          display: flex !important;
        }

        .payroll-print-title {
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 2px solid #111827;
          padding-bottom: 10px;
          margin-bottom: 12px;
        }

        .payroll-print-title h1 {
          margin: 2px 0 4px;
          font-size: 22px;
          line-height: 1.2;
        }

        .payroll-print-title p,
        .payroll-print-kicker,
        .payroll-print-meta {
          margin: 0;
          color: #4b5563;
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .payroll-print-meta {
          text-align: right;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .payroll-print-meta strong {
          color: #111827;
          font-size: 12px;
          letter-spacing: 0;
          text-transform: none;
        }

        .payroll-print-summary {
          display: grid !important;
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 8px !important;
          margin-bottom: 12px !important;
        }

        .payroll-print-summary .kpi {
          border: 1px solid #d1d5db !important;
          box-shadow: none !important;
          padding: 8px 10px !important;
          break-inside: avoid;
        }

        .payroll-print-summary .kpi-label,
        .payroll-print-summary .kpi-sub {
          color: #4b5563 !important;
          font-size: 9px !important;
        }

        .payroll-print-summary .kpi-val {
          color: #111827 !important;
          font-size: 14px !important;
        }

        .payroll-print-card {
          border: 0 !important;
          box-shadow: none !important;
          background: #fff !important;
        }

        .payroll-print-table {
          width: 100% !important;
          border-collapse: collapse !important;
          font-size: 10px !important;
        }

        .payroll-print-table th,
        .payroll-print-table td {
          border: 1px solid #d1d5db !important;
          padding: 6px 7px !important;
          color: #111827 !important;
          background: #fff !important;
        }

        .payroll-print-table th {
          background: #f3f4f6 !important;
          font-size: 9px !important;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .payroll-print-table tr {
          break-inside: avoid;
        }

        .payroll-print-footer {
          justify-content: space-between;
          gap: 18px;
          border-top: 1px solid #d1d5db;
          margin-top: 18px;
          padding-top: 12px;
          font-size: 10px;
          color: #374151;
        }
      }
    `}</style>
  );
}
