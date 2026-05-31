import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { salesApi } from "../api/salesApi";
import type { PosSessionDto, SessionReportDto } from "../api/salesTypes";
import { PosSessionStatus } from "../api/salesTypes";
import { Alert, Button, Card, Field, Kpi, dateTime, extractApiError, money } from "../components/pos-ui";
import "../components/pos.css";

function useAppScope() {
  return {
    companyId: localStorage.getItem("companyId") ?? "",
    branchId: localStorage.getItem("branchId") ?? "",
  };
}

function ReportGrid({ report }: { report: SessionReportDto }) {
  const entries = Object.entries(report).filter(([, v]) => typeof v !== "object" && v !== null && v !== undefined);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
      {entries.map(([key, value]) => (
        <Kpi
          key={key}
          label={key.replace(/([A-Z])/g, " $1")}
          value={typeof value === "number" ? money(value) : String(value)}
        />
      ))}
    </div>
  );
}

export default function PosSessionPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [session, setSession] = useState<PosSessionDto | null>(null);
  const [report, setReport] = useState<SessionReportDto | null>(null);
  const [cashierName, setCashierName] = useState("");
  const [terminal, setTerminal] = useState("POS-01");
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingFloat, setClosingFloat] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isOpen = session?.status === PosSessionStatus.Open || session?.status === 1;

  async function refresh() {
    if (!companyId || !branchId) return;
    const response = await salesApi.currentSession(companyId, branchId);
    setSession((response as any).data ?? response);
  }

  useEffect(() => {
    refresh().catch(() => setSession(null));
  }, [companyId, branchId]);

  async function open() {
    if (!cashierName.trim()) {
      setErr("Cashier name is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const response = await salesApi.openSession(companyId, branchId, {
        cashierName: cashierName.trim(),
        terminal: terminal.trim() || "POS-01",
        openingFloat: Number(openingFloat) || 0,
      });
      setSession((response as any).data ?? response);
    } catch (e) {
      setErr(extractApiError(e, "Failed to open session."));
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (!session) return;
    setBusy(true);
    setErr(null);
    try {
      const closeResponse = await salesApi.closeSession(companyId, branchId, session.id, {
        closingFloat: Number(closingFloat) || 0,
      });
      setSession((closeResponse as any).data ?? closeResponse);
      const reportResponse = await salesApi.xReport(companyId, branchId, session.id);
      setReport((reportResponse as any).data ?? reportResponse);
    } catch (e) {
      setErr(extractApiError(e, "Failed to close session."));
    } finally {
      setBusy(false);
    }
  }

  async function xReport() {
    if (!session) return;
    setBusy(true);
    setErr(null);
    try {
      const response = await salesApi.xReport(companyId, branchId, session.id);
      setReport((response as any).data ?? response);
    } catch (e) {
      setErr(extractApiError(e, "Failed to generate X report."));
    } finally {
      setBusy(false);
    }
  }

  async function zReport() {
    if (!session) return;
    if (!window.confirm("Generate Z Report and finalize this session?")) return;
    setBusy(true);
    setErr(null);
    try {
      const response = await salesApi.zReport(companyId, branchId, session.id);
      setReport((response as any).data ?? response);
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
          <Button onClick={() => nav("/sales")}>Sales</Button>
          {isOpen && <Button variant="primary" onClick={() => nav("/sales/pos")}>Go to Terminal</Button>}
        </div>
      </div>

      {err && <Alert tone="danger">{err}</Alert>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 440px) 1fr", gap: 16, alignItems: "start" }}>
        <Card title={isOpen ? "Current Session" : "Open Session"} subtitle={isOpen ? "Shift is active" : "Start a cashier shift"}>
          {!isOpen ? (
            <div style={{ display: "grid", gap: 14 }}>
              <Field label="Cashier Name">
                <input value={cashierName} onChange={(e) => setCashierName(e.target.value)} placeholder="Cashier name" />
              </Field>
              <Field label="Terminal">
                <input value={terminal} onChange={(e) => setTerminal(e.target.value)} placeholder="POS-01" />
              </Field>
              <Field label="Opening Float">
                <input value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} inputMode="decimal" />
              </Field>
              <Button variant="primary" size="lg" onClick={open} disabled={busy}>{busy ? "Opening..." : "Open Session"}</Button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <Kpi label="Cashier" value={session?.cashierName || "—"} />
              <Kpi label="Opened" value={dateTime(session?.openedAtUtc)} />
              <Kpi label="Opening Float" value={money(session?.openingFloat)} />
              <Field label="Closing Cash Count">
                <input value={closingFloat} onChange={(e) => setClosingFloat(e.target.value)} inputMode="decimal" />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Button onClick={xReport} disabled={busy}>X Report</Button>
                <Button variant="danger" onClick={close} disabled={busy}>{busy ? "Closing..." : "Close Session"}</Button>
              </div>
              <Button variant="primary" onClick={zReport} disabled={busy}>Generate Z Report</Button>
            </div>
          )}
        </Card>

        <Card title="Session Report" subtitle="X/Z report preview">
          {report ? <ReportGrid report={report} /> : <Alert tone="info">Generate an X Report to preview shift totals.</Alert>}
        </Card>
      </div>
    </div>
  );
}
