import { useState } from "react";
import { posApi } from "../api/posApi";
import { Button, Card, ensurePosStyles, Field, money } from "../components/posUi";

ensurePosStyles();

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PosOperationsPage() {
  const [fromDate, setFromDate] = useState(todayIsoDate());
  const [toDate, setToDate] = useState(todayIsoDate());
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runBulkCogs = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await posApi.postBulkCogs(fromDate, toDate);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk COGS failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#09090B", color: "#FAFAF9", minHeight: "100%", padding: 18, fontFamily: "inherit" }}>
      <Card style={{ maxWidth: 760 }}>
        <h2 style={{ marginTop: 0 }}>POS Operations</h2>
        <p style={{ color: "#A1A09A", lineHeight: 1.55 }}>
          Use this page for end-of-day catch-up tasks. Single-sale COGS is non-blocking at cashier checkout;
          this bulk job posts any unposted confirmed sales in chronological order.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <label className="erp-pos-label">From date</label>
            <input className="erp-pos-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="erp-pos-label">To date</label>
            <input className="erp-pos-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <Button variant="gold" loading={loading} onClick={runBulkCogs}>Post Bulk COGS</Button>
        </div>

        {error && <div style={{ marginTop: 14, color: "#F87171" }}>{error}</div>}

        {result && (
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            <Field label="Posted" value={result.posted ?? 0} accent />
            <Field label="Skipped" value={result.skipped ?? 0} />
            <Field label="Failed" value={result.failed ?? 0} />

            {(result.errors?.length || result.warnings?.length) && (
              <pre style={{ gridColumn: "1 / -1", whiteSpace: "pre-wrap", background: "#111113", padding: 12, borderRadius: 8, color: "#D4A853" }}>
                {[...(result.errors ?? []), ...(result.warnings ?? [])].join("\n")}
              </pre>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
