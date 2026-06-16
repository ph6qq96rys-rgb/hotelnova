import { useState } from "react";
import { SessionGate } from "../components/SessionGate";
import { Button, Card, ensurePosStyles, Field, money, Pill } from "../components/posUi";
import { usePosSession } from "../hooks/usePosSession";

ensurePosStyles();

export function PosSessionPage() {
  const sessionState = usePosSession();
  const [closingFloat, setClosingFloat] = useState("0");
  const [message, setMessage] = useState<string | null>(null);

  const report = sessionState.xReport;

  const closeSession = async () => {
    setMessage(null);
    try {
      await sessionState.close(Number(closingFloat || 0));
      setMessage("Session closed.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to close session.");
    }
  };

  return (
    <div style={{ background: "#09090B", color: "#FAFAF9", minHeight: "100%", padding: 18, fontFamily: "inherit" }}>
      <SessionGate
        loading={sessionState.loading}
        session={sessionState.session}
        busy={sessionState.busy}
        error={sessionState.error}
        onOpen={(cashierName, terminal, openingFloat) => sessionState.open({ cashierName, terminal, openingFloat })}
        onClose={sessionState.close}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Current Session</h2>
              <Pill tone="green">OPEN</Pill>
            </div>

            {sessionState.session && (
              <>
                <Field label="Cashier" value={sessionState.session.cashierName || "—"} />
                <Field label="Terminal" value={sessionState.session.terminal || "POS-1"} />
                <Field label="Opened" value={new Date(sessionState.session.openedAtUtc).toLocaleString()} />
                <Field label="Opening Float" value={money(sessionState.session.openingFloat)} accent />
              </>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Button onClick={() => sessionState.loadXReport()}>X Report</Button>
              <Button variant="gold" onClick={() => sessionState.runZReport()}>Z Report</Button>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Close Session</h2>
            <label className="erp-pos-label">Closing cash counted</label>
            <input className="erp-pos-input" type="number" min="0" value={closingFloat} onChange={(e) => setClosingFloat(e.target.value)} />
            <Button variant="danger" loading={sessionState.busy} style={{ width: "100%", marginTop: 14 }} onClick={closeSession}>
              Close Session
            </Button>
            {message && <div style={{ marginTop: 12, fontSize: 13, color: message.includes("closed") ? "#4ADE80" : "#F87171" }}>{message}</div>}
          </Card>

          <Card style={{ gridColumn: "1 / -1" }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Session Report</h2>
            {!report ? (
              <div style={{ color: "#71717A", fontSize: 13 }}>Run X Report or Z Report to view cashier totals.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                <Field label="Sales" value={report.saleCount} />
                <Field label="Gross Sales" value={money(report.grossSales)} />
                <Field label="Total COGS" value={money(report.totalCogs)} />
                <Field label="Gross Profit" value={money(report.grossProfit)} accent />
                <Field label="Cash Sales" value={money(report.cashSales)} />
                <Field label="Card/Other" value={money(report.cardSales)} />
                <Field label="Expected Cash" value={money(report.expectedCash)} />
                <Field label="Variance" value={report.cashVariance == null ? "—" : money(report.cashVariance)} />
              </div>
            )}
          </Card>
        </div>
      </SessionGate>
    </div>
  );
}
