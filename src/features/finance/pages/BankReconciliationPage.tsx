import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { http } from "../../../api/http";
import { useAuth } from "../../../auth/AuthProvider";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { StateMessage } from "../../../components/ui/Feedback";
import { apiError, Field, money, monthStartIso, todayIso } from "../components/glShared";
import { useFinanceRefs } from "../components/useFinanceRefs";

type Line = { id: string; date: string; reference: string; amount: number; journalLineId?: string | null };
type Statement = { id: string; reference: string; from: string; to: string; status: string; version: string; closingBalance: number; lines: Line[] };
type Review = { statement: Statement; candidates: { id: string; date: string; entryNo: string; description: string; amount: number }[]; ledgerClosing: number; outstanding: number; difference: number };

export function parseBankCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(value.trim()); value = ""; }
    else if (c === '\n' && !quoted) { row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = ""; }
    else value += c;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quote.");
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows[0]?.[0].replace(/^\uFEFF/, "").toLowerCase() === "date") rows.shift();
  return rows.map((r, i) => {
    const amount = Number(r[2]);
    if (r.length !== 3 || !/^\d{4}-\d{2}-\d{2}$/.test(r[0]) || !r[2] || !Number.isFinite(amount) || amount === 0)
      throw new Error(`CSV line ${i + 1}: use Date (YYYY-MM-DD), Reference, Amount; receipts positive and withdrawals negative.`);
    return { date: r[0], reference: r[1], amount };
  });
}

export default function BankReconciliationPage() {
  const { companyId = "" } = useParams(); const { hasPermission } = useAuth(); const refs = useFinanceRefs(companyId);
  const base = `/companies/${companyId}/finance/bank-reconciliations`;
  const [rows, setRows] = useState<Statement[]>([]); const [review, setReview] = useState<Review | null>(null);
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [account, setAccount] = useState(""); const [reference, setReference] = useState("");
  const [from, setFrom] = useState(monthStartIso()); const [to, setTo] = useState(todayIso());
  const [opening, setOpening] = useState("0"); const [closing, setClosing] = useState("0"); const [csv, setCsv] = useState("");
  const load = useCallback(async () => { const r = await http.get<Statement[]>(base); setRows(r.data); }, [base]);
  useEffect(() => { setReview(null); void load().catch(e => setError(apiError(e, "Could not load bank statements."))); }, [load]);
  async function action(work: () => Promise<void>) { setBusy(true); setError(""); try { await work(); } catch (e) { setError(apiError(e, "The bank reconciliation could not be saved.")); } finally { setBusy(false); } }
  async function open(id: string) { setReview((await http.get<Review>(`${base}/${id}`)).data); setCreating(false); }
  const editable = review?.statement.status === "Draft" && hasPermission("finance.journals.create");
  return <div className="gl-page"><PageHeader title="Bank reconciliation" subtitle="Import functional-currency bank statements, match posted ledger lines, and submit for independent approval."
    actions={<>{review && <Button variant="outline" onClick={() => setReview(null)}>Back to statements</Button>}{hasPermission("finance.journals.create") && <Button onClick={() => { setReview(null); setCreating(true); }}>Import statement</Button>}</>} />
    {error && <StateMessage tone="error">{error}</StateMessage>}
    {creating && <section className="gl-panel"><div className="gl-toolbar">
      <Field label="Bank account"><Select value={account} onChange={e => setAccount(e.target.value)}><option value="">Select bank account</option>{refs.accounts.filter(a => a.isActive && !a.isHeader && a.accountCategory === "Bank").map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</Select></Field>
      <Field label="Statement reference"><Input value={reference} onChange={e => setReference(e.target.value)} /></Field>
      <Field label="From"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field><Field label="To"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
      <Field label="Opening balance"><Input type="number" step="0.01" value={opening} onChange={e => setOpening(e.target.value)} /></Field><Field label="Closing balance"><Input type="number" step="0.01" value={closing} onChange={e => setClosing(e.target.value)} /></Field>
    </div><p>CSV columns: Date,Reference,Amount. Dates use YYYY-MM-DD. Receipts are positive; withdrawals are negative. The first statement opening must match the ledger opening; later statements continue without date gaps.</p>
      <Field label="CSV file"><Input type="file" accept=".csv,text/csv" onChange={e => { const f = e.target.files?.[0]; if (f) void action(async () => { if (f.size > 5000000) throw new Error("Use a CSV smaller than 5 MB."); setCsv(await f.text()); }); }} /></Field>
      <Field label="Statement CSV"><Textarea value={csv} onChange={e => setCsv(e.target.value)} rows={7} placeholder="Date,Reference,Amount" /></Field>
      <Button disabled={busy || !account || !reference || !from || !to} onClick={() => void action(async () => {
        const r = await http.post<{ id: string }>(base, { accountId: account, reference, from, to, openingBalance: Number(opening), closingBalance: Number(closing), lines: parseBankCsv(csv) }); await load(); await open(r.data.id);
      })}>Save statement</Button>
    </section>}
    {review ? <section className="gl-panel"><h2>{review.statement.reference} · {review.statement.status}</h2><div className="gl-metrics"><div><span>Bank closing</span><strong>{money(review.statement.closingBalance)}</strong></div><div><span>Outstanding ledger movements</span><strong>{money(review.outstanding)}</strong></div><div><span>Ledger closing</span><strong>{money(review.ledgerClosing)}</strong></div><div><span>Difference</span><strong>{money(review.difference)}</strong></div></div>
      <p>Match exact amounts. Enter bank fees and corrections through an independently posted journal, then refresh.</p>
      <Button variant="outline" disabled={busy} onClick={() => void action(() => open(review.statement.id))}>Refresh</Button>
      {editable && <Button variant="outline" disabled={busy} onClick={() => void action(async () => { await http.delete(`${base}/${review.statement.id}`); setReview(null); await load(); })}>Delete draft statement</Button>}
      <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Date</th><th>Reference</th><th>Amount</th><th>Ledger match</th></tr></thead><tbody>{review.statement.lines.map(l => <tr key={l.id}><td>{l.date}</td><td>{l.reference}</td><td>{money(l.amount)}</td><td><Select aria-label={`Match ${l.reference}`} disabled={!editable || busy} value={l.journalLineId ?? ""} onChange={e => void action(async () => { await http.put(`${base}/${review.statement.id}/match`, { lineId: l.id, journalLineId: e.target.value || null, version: review.statement.version }); await open(review.statement.id); })}><option value="">Unmatched</option>{review.candidates.filter(c => c.amount === l.amount && !review.statement.lines.some(other => other.id !== l.id && other.journalLineId === c.id)).map(c => <option key={c.id} value={c.id}>{c.date} · {c.entryNo} · {c.description}</option>)}</Select></td></tr>)}</tbody></table></div>
      {review.statement.status === "Draft" && hasPermission("finance.approve") && <Button disabled={busy || review.difference !== 0 || review.statement.lines.some(l => !l.journalLineId)} onClick={() => void action(async () => { await http.post(`${base}/${review.statement.id}/complete`, { version: review.statement.version }); await load(); await open(review.statement.id); })}>Approve reconciliation</Button>}
    </section> : !creating && <section className="gl-panel"><table className="gl-table"><thead><tr><th>Statement</th><th>Period</th><th>Status</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.reference}</td><td>{r.from} – {r.to}</td><td>{r.status}</td><td><Button variant="outline" onClick={() => void action(() => open(r.id))}>Open</Button></td></tr>)}{!rows.length && <tr><td colSpan={4}>No bank statements imported.</td></tr>}</tbody></table></section>}
  </div>;
}
