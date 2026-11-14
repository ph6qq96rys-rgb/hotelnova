import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { http } from "../../../api/http";
import { useAuth } from "../../../auth/AuthProvider";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { StateMessage } from "../../../components/ui/Feedback";
import { Checkbox } from "../../../components/ui/checkbox";
import { apiError, Chip, Field, money, monthStartIso, todayIso } from "../components/glShared";
import { useFinanceRefs } from "../components/useFinanceRefs";
import { guessMapping, mapBankRows, parseCsvRows, type BankCsvLine, type BankCsvMapping, type DateFormat } from "../components/bankCsv";

export { parseBankCsv } from "../components/bankCsv";

type Line = { id: string; date: string; reference: string; amount: number; journalLineId?: string | null; matchGroupId?: string | null };
type GroupMatch = { groupId: string; journalLineId: string; amount: number };
type Statement = { id: string; accountId: string; reference: string; from: string; to: string; status: string; version: string; closingBalance: number;
  lines: Line[]; groupMatches?: GroupMatch[]; reopenCount?: number };
type Candidate = { id: string; date: string; entryNo: string; description: string; amount: number };
type OpeningCandidates = { before: string; ledgerOpening: number; lines: Candidate[]; truncated: boolean };
type Review = { statement: Statement; candidates: Candidate[]; ledgerClosing: number; outstanding: number; difference: number };

const round = (v: number) => Math.round(v * 100) / 100;

export default function BankReconciliationPage() {
  const { companyId = "" } = useParams(); const { hasPermission } = useAuth(); const refs = useFinanceRefs(companyId);
  const base = `/companies/${companyId}/finance/bank-reconciliations`;
  const [rows, setRows] = useState<Statement[]>([]); const [review, setReview] = useState<Review | null>(null);
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [account, setAccount] = useState(""); const [reference, setReference] = useState("");
  const [from, setFrom] = useState(monthStartIso()); const [to, setTo] = useState(todayIso());
  const [opening, setOpening] = useState("0"); const [closing, setClosing] = useState("0"); const [csv, setCsv] = useState("");
  const [mapping, setMapping] = useState<BankCsvMapping | null>(null);
  const [openingItems, setOpeningItems] = useState<OpeningCandidates | null>(null); const [outstanding, setOutstanding] = useState<string[]>([]);
  const [pickBank, setPickBank] = useState<string[]>([]); const [pickLedger, setPickLedger] = useState<string[]>([]);
  const [undoReason, setUndoReason] = useState<string | null>(null);

  // CSV: any bank's layout, mapped to date, reference and amount (or money out / money in).
  const csvRows = useMemo(() => { try { return csv.trim() ? parseCsvRows(csv) : []; } catch { return []; } }, [csv]);
  useEffect(() => { setMapping(csvRows.length ? guessMapping(csvRows) : null); }, [csvRows]);
  const parsed = useMemo((): { lines: BankCsvLine[]; error: string } => {
    if (!csv.trim()) return { lines: [], error: "" };
    try { parseCsvRows(csv); } catch (e) { return { lines: [], error: e instanceof Error ? e.message : String(e) }; }
    if (!mapping) return { lines: [], error: "" };
    try { return { lines: mapBankRows(csvRows, mapping), error: "" }; } catch (e) { return { lines: [], error: e instanceof Error ? e.message : String(e) }; }
  }, [csv, csvRows, mapping]);
  const movement = round(parsed.lines.reduce((t, l) => t + l.amount, 0));
  const columns = (csvRows[0] ?? []).map((h, i) => ({ i, label: mapping?.hasHeader ? h || `Column ${i + 1}` : `Column ${i + 1}${h ? ` (${h})` : ""}` }));

  // The first statement of a bank account starts from the ledger: the user marks the posted items the bank had not yet cleared.
  const firstStatement = !!account && !rows.some(r => r.accountId === account);
  useEffect(() => {
    setOpeningItems(null); setOutstanding([]);
    if (!creating || !firstStatement || !from) return;
    let live = true;
    http.get<OpeningCandidates>(`${base}/opening-candidates`, { params: { accountId: account, before: from } })
      .then(r => { if (live) setOpeningItems(r.data); }).catch(e => { if (live) setError(apiError(e, "Could not load the ledger before the statement.")); });
    return () => { live = false; };
  }, [creating, firstStatement, account, from, base]);
  const outstandingTotal = (openingItems?.lines ?? []).filter(l => outstanding.includes(l.id)).reduce((t, l) => t + l.amount, 0);
  const openingGap = openingItems ? round(openingItems.ledgerOpening - outstandingTotal - Number(opening)) : 0;

  const load = useCallback(async () => { const r = await http.get<Statement[]>(base); setRows(r.data); }, [base]);
  useEffect(() => { setReview(null); void load().catch(e => setError(apiError(e, "Could not load bank statements."))); }, [load]);
  async function action(work: () => Promise<void>, done?: string) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); if (done) setNotice(done); } catch (e) { setError(apiError(e, "The bank reconciliation could not be saved.")); } finally { setBusy(false); }
  }
  async function open(id: string) { setReview((await http.get<Review>(`${base}/${id}`)).data); setCreating(false); setPickBank([]); setPickLedger([]); setUndoReason(null); }

  const editable = review?.statement.status === "Draft" && hasPermission("finance.journals.create");
  const s = review?.statement;
  const groups = s?.groupMatches ?? [];
  const usedLedger = new Set([...(s?.lines ?? []).map(l => l.journalLineId).filter((x): x is string => !!x), ...groups.map(g => g.journalLineId)]);
  const freeLedger = (review?.candidates ?? []).filter(c => !usedLedger.has(c.id));
  const bankPicked = round((s?.lines ?? []).filter(l => pickBank.includes(l.id)).reduce((t, l) => t + l.amount, 0));
  const ledgerPicked = round(freeLedger.filter(c => pickLedger.includes(c.id)).reduce((t, c) => t + c.amount, 0));
  const isLatest = !!s && !rows.some(r => r.accountId === s.accountId && r.from > s.to);
  const describe = (id: string) => { const c = review?.candidates.find(x => x.id === id); return c ? `${c.date} · ${c.entryNo} · ${c.description}` : "Ledger line"; };
  const toggle = (list: string[], id: string, on: boolean) => on ? [...list, id] : list.filter(x => x !== id);

  return <div className="gl-page"><PageHeader title="Bank reconciliation" subtitle="Import the bank statement, match it to the ledger (one to one, in groups, or automatically), post fees and interest, and have someone else approve it."
    actions={<>{review && <Button variant="outline" onClick={() => setReview(null)}>Back to statements</Button>}
      <Link className="gl-link-button" to={`/companies/${companyId}/finance/bank-accounts`}>Bank accounts &amp; transfers</Link>
      {hasPermission("finance.journals.create") && <Button onClick={() => { setReview(null); setCreating(true); }}>Import statement</Button>}</>} />
    {error && <StateMessage tone="error">{error}</StateMessage>}
    {notice && <StateMessage tone="success">{notice}</StateMessage>}

    {creating && <section className="gl-panel"><div className="gl-toolbar">
      <Field label="Bank account"><Select value={account} onChange={e => setAccount(e.target.value)}><option value="">Select bank account</option>{refs.accounts.filter(a => a.isActive && !a.isHeader && a.accountCategory === "Bank").map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</Select></Field>
      <Field label="Statement reference"><Input value={reference} onChange={e => setReference(e.target.value)} /></Field>
      <Field label="From"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field><Field label="To"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
      <Field label="Opening balance"><Input type="number" step="0.01" value={opening} onChange={e => setOpening(e.target.value)} /></Field><Field label="Closing balance"><Input type="number" step="0.01" value={closing} onChange={e => setClosing(e.target.value)} /></Field>
    </div>
      <Field label="Bank statement CSV (as exported by the bank)"><Input type="file" accept=".csv,text/csv,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) void action(async () => { if (f.size > 5000000) throw new Error("Use a CSV smaller than 5 MB."); setCsv(await f.text()); }); }} /></Field>
      <Field label="Or paste it here"><Textarea value={csv} onChange={e => setCsv(e.target.value)} rows={5} placeholder="Date,Description,Debit,Credit,Balance" /></Field>
      {mapping && <div className="gl-panel">
        <h3>Which column is which</h3>
        <div className="gl-toolbar">
          <label className="gl-check"><Checkbox checked={mapping.hasHeader} onChange={e => setMapping({ ...mapping, hasHeader: e.target.checked })} /> First row is a header</label>
          <Field label="Date"><Select value={mapping.date} onChange={e => setMapping({ ...mapping, date: Number(e.target.value) })}>{columns.map(c => <option key={c.i} value={c.i}>{c.label}</option>)}</Select></Field>
          <Field label="Date format"><Select value={mapping.dateFormat} onChange={e => setMapping({ ...mapping, dateFormat: e.target.value as DateFormat })}><option value="YYYY-MM-DD">2026-10-31</option><option value="DD/MM/YYYY">31/10/2026</option><option value="MM/DD/YYYY">10/31/2026</option></Select></Field>
          <Field label="Description"><Select value={mapping.reference[0] ?? 0} onChange={e => setMapping({ ...mapping, reference: [Number(e.target.value)] })}>{columns.map(c => <option key={c.i} value={c.i}>{c.label}</option>)}</Select></Field>
          <Field label="Amounts"><Select value={mapping.amountMode} onChange={e => setMapping({ ...mapping, amountMode: e.target.value as BankCsvMapping["amountMode"] })}><option value="single">One column (withdrawals negative)</option><option value="split">Money out and money in columns</option></Select></Field>
          {mapping.amountMode === "single"
            ? <Field label="Amount"><Select value={mapping.amount} onChange={e => setMapping({ ...mapping, amount: Number(e.target.value) })}>{columns.map(c => <option key={c.i} value={c.i}>{c.label}</option>)}</Select></Field>
            : <><Field label="Money out (debit)"><Select value={mapping.moneyOut} onChange={e => setMapping({ ...mapping, moneyOut: Number(e.target.value) })}>{columns.map(c => <option key={c.i} value={c.i}>{c.label}</option>)}</Select></Field>
              <Field label="Money in (credit)"><Select value={mapping.moneyIn} onChange={e => setMapping({ ...mapping, moneyIn: Number(e.target.value) })}>{columns.map(c => <option key={c.i} value={c.i}>{c.label}</option>)}</Select></Field></>}
        </div>
        {parsed.error ? <StateMessage tone="error">{parsed.error}</StateMessage> : <>
          <p>{parsed.lines.length} lines · movement {money(movement)} · opening {money(Number(opening))} + movement = {money(round(Number(opening) + movement))}
            {round(Number(opening) + movement) === round(Number(closing)) ? " — matches the closing balance." : ` — the closing balance is ${money(Number(closing))}.`}</p>
          <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Date</th><th>Description</th><th className="gl-num">Amount</th></tr></thead>
            <tbody>{parsed.lines.slice(0, 5).map((l, i) => <tr key={i}><td>{l.date}</td><td>{l.reference}</td><td className="gl-num">{money(l.amount)}</td></tr>)}</tbody></table></div>
        </>}
      </div>}
      {firstStatement && openingItems && <div className="gl-panel">
        <h3>Outstanding at the start</h3>
        <p>This is the first statement for this account. The ledger balance on the day before {from} is <strong>{money(openingItems.ledgerOpening)}</strong>.
          Tick the cheques and deposits in the ledger that the bank had not cleared by then; a later statement line clears each one.</p>
        <p>Bank opening {money(Number(opening))} + outstanding {money(outstandingTotal)} = {money(Number(opening) + outstandingTotal)}
          {openingGap === 0 ? " — matches the ledger." : ` — ${money(openingGap)} still to explain.`}</p>
        {openingItems.truncated && <StateMessage tone="error">Only the latest 2,000 ledger lines are listed. Start reconciliation from a later date if older items are still outstanding.</StateMessage>}
        <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Outstanding</th><th>Date</th><th>Entry</th><th>Description</th><th className="gl-num">Amount</th></tr></thead><tbody>
          {openingItems.lines.map(l => <tr key={l.id}><td><Checkbox aria-label={`Outstanding: ${l.entryNo} ${l.description}`} checked={outstanding.includes(l.id)}
            onChange={e => setOutstanding(toggle(outstanding, l.id, e.target.checked))} /></td>
            <td>{l.date}</td><td>{l.entryNo}</td><td>{l.description}</td><td className="gl-num">{money(l.amount)}</td></tr>)}
          {!openingItems.lines.length && <tr><td colSpan={5}>No posted ledger lines before this date.</td></tr>}
        </tbody></table></div>
      </div>}
      <Button disabled={busy || !account || !reference || !from || !to || !!parsed.error || (firstStatement && (!openingItems || openingGap !== 0))} onClick={() => void action(async () => {
        const r = await http.post<{ id: string }>(base, { accountId: account, reference, from, to, openingBalance: Number(opening), closingBalance: Number(closing), lines: parsed.lines,
          openingOutstandingLineIds: firstStatement ? outstanding : [] }); await load(); await open(r.data.id);
      })}>Save statement</Button>
    </section>}

    {review && s ? <section className="gl-panel"><h2>{s.reference} · {s.status}{s.reopenCount ? ` · reopened ${s.reopenCount}×` : ""}</h2>
      <div className="gl-metrics"><div><span>Bank closing</span><strong>{money(s.closingBalance)}</strong></div><div><span>Outstanding ledger movements</span><strong>{money(review.outstanding)}</strong></div><div><span>Ledger closing</span><strong>{money(review.ledgerClosing)}</strong></div><div><span>Difference</span><strong>{money(review.difference)}</strong></div></div>
      <div className="gl-toolbar">
        <Button variant="outline" disabled={busy} onClick={() => void action(() => open(s.id))}>Refresh</Button>
        {editable && <Button variant="outline" disabled={busy} onClick={() => void action(async () => {
          const r = await http.post<{ matched: number; unmatched: number }>(`${base}/${s.id}/auto-match`, { version: s.version }); await open(s.id);
          setNotice(`Matched ${r.data.matched} line(s) automatically; ${r.data.unmatched} left for you.`);
        })}>Auto-match</Button>}
        {editable && <Button variant="outline" disabled={busy} onClick={() => void action(async () => { await http.delete(`${base}/${s.id}`); setReview(null); await load(); })}>Delete draft statement</Button>}
        {s.status === "Reconciled" && isLatest && hasPermission("finance.approve") && undoReason === null && <Button variant="outline" onClick={() => setUndoReason("")}>Reopen (undo reconciliation)</Button>}
      </div>
      {undoReason !== null && <div className="gl-toolbar">
        <Field label="Why reopen it?" wide><Input value={undoReason} maxLength={500} onChange={e => setUndoReason(e.target.value)} placeholder="e.g. the bank corrected a fee after approval" /></Field>
        <Button variant="destructive" disabled={busy || undoReason.trim().length < 10} onClick={() => void action(async () => { await http.post(`${base}/${s.id}/undo`, { reason: undoReason, version: s.version }); await load(); await open(s.id); }, "Reopened. It must be approved again.")}>Reopen</Button>
        <Button variant="outline" onClick={() => setUndoReason(null)}>Cancel</Button>
      </div>}

      <div className="gl-table-wrap"><table className="gl-table"><thead><tr>{editable && <th>Group</th>}<th>Date</th><th>Reference</th><th className="gl-num">Amount</th><th>Ledger match</th><th /></tr></thead><tbody>
        {s.lines.map(l => { const grouped = !!l.matchGroupId; const matched = grouped || !!l.journalLineId;
          return <tr key={l.id}>
            {editable && <td>{!matched && <Checkbox aria-label={`Select ${l.reference} for a group match`} checked={pickBank.includes(l.id)} onChange={e => setPickBank(toggle(pickBank, l.id, e.target.checked))} />}</td>}
            <td>{l.date}</td><td>{l.reference}</td><td className="gl-num">{money(l.amount)}</td>
            <td>{grouped
              ? <><Chip tone="info">Group</Chip> {groups.filter(g => g.groupId === l.matchGroupId).map(g => describe(g.journalLineId)).join("; ")}</>
              : <Select aria-label={`Match ${l.reference}`} disabled={!editable || busy} value={l.journalLineId ?? ""} onChange={e => void action(async () => { await http.put(`${base}/${s.id}/match`, { lineId: l.id, journalLineId: e.target.value || null, version: s.version }); await open(s.id); })}>
                  <option value="">Unmatched</option>
                  {review.candidates.filter(c => c.amount === l.amount && (c.id === l.journalLineId || !usedLedger.has(c.id))).map(c => <option key={c.id} value={c.id}>{c.date} · {c.entryNo} · {c.description}</option>)}
                </Select>}</td>
            <td>{editable && grouped && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void action(async () => { await http.post(`${base}/${s.id}/group-unmatch`, { groupId: l.matchGroupId, version: s.version }); await open(s.id); })}>Unmatch group</Button>}
              {editable && !matched && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void action(async () => { await http.post(`${base}/${s.id}/charge`, { lineId: l.id, version: s.version }); await open(s.id); }, l.amount < 0 ? "Bank fee posted and matched." : "Interest posted and matched.")}>
                {l.amount < 0 ? "Post as bank fee" : "Post as interest"}</Button>}</td>
          </tr>; })}
      </tbody></table></div>

      {editable && freeLedger.length > 0 && <div className="gl-panel">
        <h3>Match several lines together</h3>
        <p>Tick bank lines above and ledger lines below whose totals are equal, e.g. one deposit of several days' takings. Bank {money(bankPicked)} · Ledger {money(ledgerPicked)}
          {pickBank.length && pickLedger.length ? (bankPicked === ledgerPicked ? " — equal." : ` — differ by ${money(round(bankPicked - ledgerPicked))}.`) : ""}</p>
        <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th /><th>Date</th><th>Entry</th><th>Description</th><th className="gl-num">Amount</th></tr></thead><tbody>
          {freeLedger.map(c => <tr key={c.id}><td><Checkbox aria-label={`Select ledger ${c.entryNo}`} checked={pickLedger.includes(c.id)} onChange={e => setPickLedger(toggle(pickLedger, c.id, e.target.checked))} /></td>
            <td>{c.date}</td><td>{c.entryNo}</td><td>{c.description}</td><td className="gl-num">{money(c.amount)}</td></tr>)}
        </tbody></table></div>
        <Button disabled={busy || !pickBank.length || !pickLedger.length || pickBank.length + pickLedger.length < 3 || bankPicked !== ledgerPicked}
          onClick={() => void action(async () => { await http.post(`${base}/${s.id}/group-match`, { statementLineIds: pickBank, journalLineIds: pickLedger, version: s.version }); await open(s.id); }, "Matched as a group.")}>
          Match selected as a group</Button>
      </div>}

      {s.status === "Draft" && hasPermission("finance.approve") && <Button disabled={busy || review.difference !== 0 || s.lines.some(l => !l.journalLineId && !l.matchGroupId)} onClick={() => void action(async () => { await http.post(`${base}/${s.id}/complete`, { version: s.version }); await load(); await open(s.id); }, "Reconciliation approved.")}>Approve reconciliation</Button>}
    </section> : !creating && <section className="gl-panel"><table className="gl-table"><thead><tr><th>Statement</th><th>Account</th><th>Period</th><th>Status</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.reference}</td><td>{refs.accounts.find(a => a.id === r.accountId)?.name ?? ""}</td><td>{r.from} – {r.to}</td><td>{r.status}</td><td><Button variant="outline" onClick={() => void action(() => open(r.id))}>Open</Button></td></tr>)}{!rows.length && <tr><td colSpan={5}>No bank statements imported.</td></tr>}</tbody></table></section>}
  </div>;
}
