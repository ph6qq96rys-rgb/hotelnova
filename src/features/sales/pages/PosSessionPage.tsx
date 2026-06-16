import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { salesApi } from "../api/salesApi";
import type { PosSessionDto, SessionReportDto } from "../api/salesTypes";
import { PosSessionStatus } from "../api/salesTypes";
import {
  Alert,
  Button,
  Card,
  Field,
  Kpi,
  dateTime,
  extractApiError,
  money,
} from "../components/pos-ui";
import "../components/pos.css";

function useAppScope() {
  const companyId = localStorage.getItem("companyId") ?? "";
  const branchId = localStorage.getItem("branchId") ?? "";

  return { companyId, branchId };
}

function parseAmount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function isSessionOpen(session: PosSessionDto | null): boolean {
  return session?.status === PosSessionStatus.Open || session?.status === 1;
}

function formatReportLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (x) => x.toUpperCase())
    .trim();
}

function ReportGrid({ report }: { report: SessionReportDto }) {
  const entries = Object.entries(report).filter(([, value]) => {
    return value !== null && value !== undefined && typeof value !== "object";
  });

  if (entries.length === 0) {
    return <Alert tone="info">No report totals were returned.</Alert>;
  }

  return (
    <div className="pos-kpi-grid">
      {entries.map(([key, value]) => (
        <Kpi
          key={key}
          label={formatReportLabel(key)}
          value={typeof value === "number" ? money(value) : String(value)}
        />
      ))}
    </div>
  );
}

export default function PosSessionPage() {
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [session, setSession] = useState<PosSessionDto | null>(null);
  const [report, setReport] = useState<SessionReportDto | null>(null);

  const [cashierName, setCashierName] = useState("");
  const [terminal, setTerminal] = useState("POS-01");
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingFloat, setClosingFloat] = useState("0");

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const hasScope = Boolean(companyId && branchId);
  const isOpen = useMemo(() => isSessionOpen(session), [session]);

  const refresh = useCallback(async () => {
    if (!hasScope) {
      setSession(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await salesApi.currentSession(companyId, branchId);
      setSession(response.data ?? null);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, hasScope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleOpenSession() {
    if (!hasScope) {
      setErr("Company and branch context are required.");
      return;
    }

    const normalizedCashierName = cashierName.trim();
    const normalizedTerminal = terminal.trim() || "POS-01";

    if (!normalizedCashierName) {
      setErr("Cashier name is required.");
      return;
    }

    setBusy(true);
    setErr(null);
    setReport(null);

    try {
      const response = await salesApi.openSession(companyId, branchId, {
        cashierName: normalizedCashierName,
        terminal: normalizedTerminal,
        openingFloat: parseAmount(openingFloat),
      });

      setSession(response.data ?? response);
      setClosingFloat("0");
    } catch (e) {
      setErr(extractApiError(e, "Failed to open session."));
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseSession() {
    if (!hasScope || !session?.id) return;

    setBusy(true);
    setErr(null);

    try {
      const closeResponse = await salesApi.closeSession(companyId, branchId, session.id, {
        closingFloat: parseAmount(closingFloat),
      });

      setSession(closeResponse.data ?? closeResponse);

      const reportResponse = await salesApi.xReport(companyId, branchId, session.id);
      setReport(reportResponse.data ?? reportResponse);
    } catch (e) {
      setErr(extractApiError(e, "Failed to close session."));
    } finally {
      setBusy(false);
    }
  }

  async function handleXReport() {
    if (!hasScope || !session?.id) return;

    setBusy(true);
    setErr(null);

    try {
      const response = await salesApi.xReport(companyId, branchId, session.id);
      setReport(response.data ?? response);
    } catch (e) {
      setErr(extractApiError(e, "Failed to generate X report."));
    } finally {
      setBusy(false);
    }
  }

  async function handleZReport() {
    if (!hasScope || !session?.id) return;

    const confirmed = window.confirm(
      "Generate Z Report and finalize this POS session? This action should normally be done only at end of shift."
    );

    if (!confirmed) return;

    setBusy(true);
    setErr(null);

    try {
      const response = await salesApi.zReport(companyId, branchId, session.id);
      setReport(response.data ?? response);
      await refresh();
    } catch (e) {
      setErr(extractApiError(e, "Failed to generate Z report."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title">
          <h1>POS Session</h1>
          <p>Open, close, reconcile, and run X/Z reports.</p>
        </div>

        <div className="pos-actions">
          <Button onClick={() => navigate("/sales")}>Sales</Button>

          {isOpen && (
            <Button variant="primary" onClick={() => navigate("/sales/pos")}>
              Go to Terminal
            </Button>
          )}
        </div>
      </div>

      {!hasScope && (
        <Alert tone="danger">
          Company and branch context are missing. Please sign in again or select a branch.
        </Alert>
      )}

      {err && <Alert tone="danger">{err}</Alert>}

      {loading ? (
        <Alert tone="info">Loading current POS session...</Alert>
      ) : (
        <div className="pos-session-layout">
          <Card
            title={isOpen ? "Current Session" : "Open Session"}
            subtitle={isOpen ? "Shift is active" : "Start a cashier shift"}
          >
            {!isOpen ? (
              <div className="pos-form-grid">
                <Field label="Cashier Name">
                  <input
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    placeholder="Cashier name"
                    disabled={busy || !hasScope}
                  />
                </Field>

                <Field label="Terminal">
                  <input
                    value={terminal}
                    onChange={(e) => setTerminal(e.target.value)}
                    placeholder="POS-01"
                    disabled={busy || !hasScope}
                  />
                </Field>

                <Field label="Opening Float">
                  <input
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    inputMode="decimal"
                    disabled={busy || !hasScope}
                  />
                </Field>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleOpenSession}
                  disabled={busy || !hasScope}
                >
                  {busy ? "Opening..." : "Open Session"}
                </Button>
              </div>
            ) : (
              <div className="pos-form-grid">
                <Kpi label="Cashier" value={session?.cashierName || "—"} />
                <Kpi label="Terminal" value={session?.terminal || "—"} />
                <Kpi label="Opened" value={dateTime(session?.openedAtUtc)} />
                <Kpi label="Opening Float" value={money(session?.openingFloat)} />

                <Field label="Closing Cash Count">
                  <input
                    value={closingFloat}
                    onChange={(e) => setClosingFloat(e.target.value)}
                    inputMode="decimal"
                    disabled={busy}
                  />
                </Field>

                <div className="pos-two-column-actions">
                  <Button onClick={handleXReport} disabled={busy}>
                    X Report
                  </Button>

                  <Button variant="danger" onClick={handleCloseSession} disabled={busy}>
                    {busy ? "Processing..." : "Close Session"}
                  </Button>
                </div>

                <Button variant="primary" onClick={handleZReport} disabled={busy}>
                  Generate Z Report
                </Button>
              </div>
            )}
          </Card>

          <Card title="Session Report" subtitle="X/Z report preview">
            {report ? (
              <ReportGrid report={report} />
            ) : (
              <Alert tone="info">Generate an X Report to preview shift totals.</Alert>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}