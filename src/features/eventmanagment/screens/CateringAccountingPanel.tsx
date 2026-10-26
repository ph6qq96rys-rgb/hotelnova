import { useEffect, useState } from "react";
import { http } from "../../../api/http";
import { useHasPermission } from "../../../auth/usePermissions";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { readApiError } from "../sales/ui";

type Report = {
  eventNo: string; currency: string; invoiced: number; netCash: number; invoiceBalance: number;
  expectedEventBalance: number; storedEventBalance: number; difference: number; netStockCost: number; exceptions: string[];
  rows: { key: string; type: string; reference: string; dateUtc: string | null; net: number; tax: number; gross: number; cash: number; stockCost: number }[];
};
export function CateringAccountingPanel({ companyId, eventId }: { companyId: string; eventId: string }) {
  const canView = useHasPermission("catering.profitability.view");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const url = `/companies/${companyId}/catering/events/${eventId}/accounting`;
  useEffect(() => {
    setReport(null); setError("");
    if (!canView) return;
    const controller = new AbortController();
    http.get<Report>(url, { signal: controller.signal }).then(r => { if (!controller.signal.aborted) setReport(r.data); })
      .catch(e => { if (!controller.signal.aborted) setError(readApiError(e)); });
    return () => controller.abort();
  }, [url, canView, revision]);
  async function download() {
    setBusy(true);
    try {
      const result = await http.get<Blob>(`${url}/export`, { responseType: "blob" });
      const href = URL.createObjectURL(result.data);
      const a = document.createElement("a"); a.href = href; a.download = `catering-accounting-${eventId}.csv`; a.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) { setError(readApiError(e)); } finally { setBusy(false); }
  }
  if (!canView) return null;
  const money = (value: number) => `${report?.currency ?? ""} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return <section className="co-panel">
    <h2>Accounting reconciliation</h2>
    <p>Current source-document balances for this event. Deposits are included in receipts once. Exported documents support accounting review; they are not general-ledger postings. Stock costs are net of reversals and returns.</p>
    <div className="co-actions">
      <Button variant="outline" onClick={() => setRevision(x => x + 1)}>Refresh reconciliation</Button>
      <Button disabled={!report || busy} onClick={() => void download()}>Export accounting CSV</Button>
    </div>
    {error && <StateMessage tone="error">{error}</StateMessage>}
    {!report && !error && <StateMessage tone="loading">Loading reconciliation…</StateMessage>}
    {report && <>
      {report.exceptions.map((x, i) => <StateMessage key={i} tone="warning">{x}</StateMessage>)}
      <dl>
        <dt>Issued invoices less credits</dt><dd>{money(report.invoiced)}</dd>
        <dt>Receipts less refunds and reversals</dt><dd>{money(report.netCash)}</dd>
        <dt>Invoice balance (negative means customer advance)</dt><dd>{money(report.invoiceBalance)}</dd>
        <dt>Expected event balance</dt><dd>{money(report.expectedEventBalance)}</dd>
        <dt>Stored event balance</dt><dd>{money(report.storedEventBalance)}</dd>
        <dt>Unexplained difference</dt><dd>{money(report.difference)}</dd>
        <dt>Net inventory issue cost</dt><dd>{money(report.netStockCost)}</dd>
      </dl>
      <details><summary>Source documents ({report.rows.length})</summary>
        <ul>{report.rows.map(row => <li key={row.key}>{row.type} · {row.reference} · {money(row.gross || row.cash || row.stockCost)}</li>)}</ul>
      </details>
    </>}
  </section>;
}
