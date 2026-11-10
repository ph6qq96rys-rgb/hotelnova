import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { StateMessage } from "../../../components/ui/Feedback";
import { useHasPermission } from "../../../auth/usePermissions";
import { financeApi, type CloseControl, type CloseReview, type Period } from "../api/financeApi";
import { apiError, Field, GlDialog } from "./glShared";

export function CloseReviewPanel({ companyId, period, onClose }: { companyId: string; period: Period; onClose: () => void }) {
  const canPrepare = useHasPermission("finance.journals.create");
  const [report, setReport] = useState<CloseReview | null>(null);
  const [selected, setSelected] = useState<CloseControl | null>(null);
  const [balance, setBalance] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try { setReport(await financeApi.closeReview(companyId, period.id)); }
    catch (e) { setError(apiError(e, "Close review could not be loaded.")); }
    finally { setBusy(false); }
  }, [companyId, period.id]);
  useEffect(() => { void load(); }, [load]);
  async function save() {
    if (!report || !selected || balance.trim() === "" || !Number.isFinite(Number(balance))) return;
    setBusy(true); setError(null);
    try {
      await financeApi.closeEvidence(companyId, period.id, { key: selected.key, balance: Number(balance), reference, note, fingerprint: report.fingerprint });
      setSelected(null); await load();
    } catch (e) { setError(apiError(e, "Supporting schedule could not be saved.")); }
    finally { setBusy(false); }
  }
  const money = (v: number | null) => v == null ? "—" : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <GlDialog open size="full" busy={busy} title={`${period.name} — Close review`} confirmText="" closeText="Close" onClose={onClose}>
    <p>Company-wide balances at {period.endDate}. Debit balances are positive; credit balances are negative. Use the functional currency ({report?.currency ?? "…"}).</p>
    <p>Inventory is calculated from posted stock movements. Other schedules must come from the relevant subledger, asset register, payroll register, cash count or tax working paper. Include opening balances and reversals. A different finance user must review and close the period.</p>
    <p><Link to={`/companies/${companyId}/procurement/payables`}>Payables reports</Link> · <Link to={`/companies/${companyId}/finance/bank-reconciliation`}>Bank reconciliation</Link> · <Link to={`/companies/${companyId}/finance/statements`}>Financial statements</Link></p>
    <Button disabled={busy} onClick={() => { setSelected(null); void load(); }}>Refresh review</Button>
    {error && <StateMessage tone="error">{error}</StateMessage>}
    {busy && <StateMessage tone="loading">Checking close controls…</StateMessage>}
    {report && <>
      <StateMessage tone={report.ready ? "success" : "warning"}>{report.ready ? (period.status === "closed" ? "Retained verification from the successful close." : "Ready for this user to close. Checks will run again when closing.") : `${report.blockers.length} checks need attention. Closing is blocked until they are resolved.`}</StateMessage>
      <details><summary>All close checks</summary><ul>{report.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul></details>
      <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Control</th><th>GL balance</th><th>Supporting balance</th><th>Difference</th><th>Status / evidence</th><th /></tr></thead>
        <tbody>{report.controls.map(c => <tr key={c.key}><td>{c.name}<div className="gl-muted">{c.method}</div></td><td>{money(c.ledgerBalance)}</td><td>{money(c.supportingBalance)}</td><td>{money(c.difference)}</td><td>{c.status}<div className="gl-muted">{c.reference}</div>{c.note && <div>{c.note}</div>}{c.preparedBy && <small>Preparer: {c.preparedBy}</small>}</td><td>{canPrepare && period.status === "open" && c.method === "Supporting schedule" && <Button size="sm" disabled={busy} onClick={() => { setSelected(c); setBalance(""); setReference(""); setNote(""); }}>Provide schedule</Button>}</td></tr>)}</tbody>
      </table></div>
      {selected && <section className="gl-panel">
        <h3>{selected.name}</h3><p>Enter the independently calculated supporting balance; do not copy the GL balance to clear a difference. A revised submission preserves prior evidence in the audit log.</p>
        <Field label="Supporting balance"><Input aria-label="Supporting balance" type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} /></Field>
        <Field label="Report or document reference"><Input aria-label="Report or document reference" maxLength={500} value={reference} onChange={e => setReference(e.target.value)} /></Field>
        <Field label="Source, cutoff and reconciliation explanation"><Input aria-label="Source, cutoff and reconciliation explanation" maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></Field>
        <Button disabled={busy || balance.trim() === "" || !reference.trim() || !note.trim()} onClick={() => void save()}>Save supporting evidence</Button>
      </section>}
    </>}
  </GlDialog>;
}
