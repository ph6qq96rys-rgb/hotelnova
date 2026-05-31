// src/features/sales/pages/PosSessionPage.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { posApi, type PosSessionDto, type SessionReportDto } from "../api/posApi";

const fmt = (n: number) =>
  "$" + n.toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

export default function PosSessionPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [session,      setSession]      = useState<PosSessionDto | null>(null);
  const [report,       setReport]       = useState<SessionReportDto | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [err,          setErr]          = useState<string | null>(null);
  const [cashierName,  setCashierName]  = useState("");
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingFloat, setClosingFloat] = useState("0");

  useEffect(() => {
    if (!companyId || !branchId) return;
    setLoading(true);
    posApi
      .currentSession(companyId, branchId)
      .then(setSession)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId, branchId]);

  async function openSession() {
    if (!companyId || !branchId || !cashierName) return;
    setLoading(true); setErr(null);
    try {
      const s = await posApi.openSession(companyId, branchId, {
        cashierName,
        openingFloat: Number(openingFloat) || 0,
      });
      setSession(s);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? "Failed to open session.");
    } finally { setLoading(false); }
  }

  async function closeSession() {
    if (!companyId || !branchId || !session) return;
    setLoading(true); setErr(null);
    try {
      await posApi.closeSession(
        companyId, branchId, session.id,
        Number(closingFloat) || 0
      );
      const r = await posApi.xReport(companyId, branchId, session.id);
      setReport(r);
      const refreshed = await posApi.currentSession(companyId, branchId);
      setSession(refreshed);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? "Failed.");
    } finally { setLoading(false); }
  }

  async function generateXReport() {
    if (!companyId || !branchId || !session) return;
    setLoading(true); setErr(null);
    try {
      const r = await posApi.xReport(companyId, branchId, session.id);
      setReport(r);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? "Failed.");
    } finally { setLoading(false); }
  }

  async function generateZReport() {
    if (!companyId || !branchId || !session) return;
    if (!window.confirm("Generate Z-Report? This cannot be undone.")) return;
    setLoading(true); setErr(null);
    try {
      const r = await posApi.zReport(companyId, branchId, session.id);
      setReport(r);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? "Failed.");
    } finally { setLoading(false); }
  }

  return (
    <div className="page">
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        <div className="page-header">
          <div>
            <div className="page-title">POS session</div>
            <div className="page-sub">Open, close, and report on your shift</div>
          </div>
          {session?.status === 1 && (
            <button
              className="btn btn-primary"
              onClick={() => nav("/sales/pos")}
            >
              Go to POS
            </button>
          )}
        </div>

        {err && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            {err}
          </div>
        )}

        {/* No session — open form */}
        {!session && (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 16 }}>
              Open new session
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 12, marginBottom: 16,
            }}>
              <div className="field">
                <label>Cashier name</label>
                <input
                  className="input"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="field">
                <label>Opening float ($)</label>
                <input
                  className="input"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  inputMode="decimal"
                />
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={openSession}
              disabled={loading || !cashierName}
            >
              {loading ? "Opening…" : "Open session"}
            </button>
          </div>
        )}

        {/* Active session */}
        {session && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12, marginBottom: 16,
            }}>
              {[
                { label: "Cashier",      value: session.cashierName },
                { label: "Terminal",     value: session.terminal },
                { label: "Opened at",   value: new Date(session.openedAtUtc).toLocaleString() },
                { label: "Opening float", value: fmt(session.openingFloat) },
                { label: "Status",       value: session.status === 1 ? "Open" : "Closed" },
              ].map((f) => (
                <div key={f.label} className="kpi">
                  <div className="kpi-label">{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
                    {f.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn"
                onClick={generateXReport}
                disabled={loading}
              >
                X-Report (shift)
              </button>
              {session.status === 1 && (
                <>
                  <div className="field" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, whiteSpace: "nowrap" }}>Closing float</label>
                    <input
                      className="input"
                      value={closingFloat}
                      onChange={(e) => setClosingFloat(e.target.value)}
                      inputMode="decimal"
                      style={{ width: 100 }}
                    />
                  </div>
                  <button
                    className="btn"
                    onClick={closeSession}
                    disabled={loading}
                  >
                    Close session
                  </button>
                </>
              )}
              {session.status === 2 && !session.isZReported && (
                <button
                  className="btn btn-danger"
                  onClick={generateZReport}
                  disabled={loading}
                >
                  Z-Report (end of day)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Report */}
        {report && (
          <div className="card">
            <div style={{
              fontWeight: 500, fontSize: 15, marginBottom: 16,
              display: "flex", justifyContent: "space-between",
            }}>
              <span>{report.isZReported ? "Z-Report" : "X-Report"}</span>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {new Date(report.openedAtUtc).toLocaleString()}
                {report.closedAtUtc && ` → ${new Date(report.closedAtUtc).toLocaleString()}`}
              </span>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10, marginBottom: 20,
            }}>
              {[
                { label: "Total sales",   value: String(report.totalSales) },
                { label: "Gross sales",   value: fmt(report.grossSales) },
                { label: "Discount",      value: fmt(report.totalDiscount) },
                { label: "Tax",           value: fmt(report.totalTax) },
                { label: "COGS",          value: fmt(report.totalCogs) },
                { label: "Gross profit",  value: fmt(report.grossProfit) },
              ].map((f) => (
                <div key={f.label} className="kpi">
                  <div className="kpi-label">{f.label}</div>
                  <div style={{
                    fontSize: 16, fontWeight: 500,
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {f.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 10 }}>
              Payment breakdown
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th style={{ textAlign: "right" }}>Transactions</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.paymentBreakdown.map((p) => (
                  <tr key={p.method}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                      {p.method}
                    </td>
                    <td style={{ textAlign: "right", fontSize: 12 }}>{p.count}</td>
                    <td style={{
                      textAlign: "right",
                      fontFamily: "var(--font-mono)", fontSize: 13,
                      fontWeight: 500,
                    }}>
                      {fmt(p.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}