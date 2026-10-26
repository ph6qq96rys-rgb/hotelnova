import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { ACCOUNT_TYPE_LABEL, financeApi, SOURCE_LABEL, type AccountLedger, type TrialBalance } from "../api/financeApi";
import { amount, apiError, day, downloadCsv, Field, money, monthStartIso, todayIso } from "../components/glShared";
import { useFinanceRefs } from "../components/useFinanceRefs";

/** Balances on each account's normal side: debit for assets, costs and expenses; credit for liabilities, equity and revenue. */
export default function TrialBalancePage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const refs = useFinanceRefs(companyId);
  const [from, setFrom] = useState(params.get("from") ?? monthStartIso());
  const [to, setTo] = useState(params.get("to") ?? todayIso());
  const [branchId, setBranchId] = useState(params.get("branch") ?? "");
  const [tb, setTb] = useState<TrialBalance | null>(null);
  const [ledger, setLedger] = useState<AccountLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const accountId = params.get("account");

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true); setError(null);
    try {
      if (accountId) { setLedger(await financeApi.accountLedger(companyId, accountId, from, to, branchId || undefined)); setTb(null); }
      else { setTb(await financeApi.trialBalance(companyId, from, to, branchId || undefined)); setLedger(null); }
    } catch (e) { setError(apiError(e, "The report could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId, from, to, branchId, accountId]);
  useEffect(() => { void load(); }, [load]);

  const showAccount = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set("account", id); else p.delete("account");
    setParams(p);
  };
  const balanced = tb ? Math.abs(tb.totalDebit - tb.totalCredit) < 0.005 && Math.abs(tb.closingDebit - tb.closingCredit) < 0.005 : true;
  const branchLabel = branchId ? refs.branches.find((b) => b.id === branchId)?.name ?? "Branch" : "All branches";

  return (
    <div className="gl-page">
      <PageHeader title={ledger ? `Ledger · ${ledger.code} ${ledger.name}` : "Trial Balance"}
        subtitle={ledger ? "Every posted line on this account, with its running balance." : "Opening balance, movements and closing balance of every account with activity. Select an account to see its ledger."}
        actions={<>
          {ledger ? <Button variant="outline" onClick={() => showAccount(null)}>Back to trial balance</Button> : null}
          <Button variant="outline" disabled={!tb && !ledger} onClick={() => {
            if (tb) downloadCsv(`trial-balance-${from}-${to}.csv`, ["Code", "Account", "Type", "Opening", "Debit", "Credit", "Closing"],
              tb.rows.map((r) => [r.code, r.name, ACCOUNT_TYPE_LABEL[r.type], r.openingBalance, r.debit, r.credit, r.closingBalance]));
            else if (ledger) downloadCsv(`ledger-${ledger.code}-${from}-${to}.csv`, ["Date", "Journal", "Description", "Source", "Debit", "Credit", "Balance"],
              ledger.lines.map((l) => [l.entryDate, l.entryNo, l.lineDescription ?? l.description, l.sourceNo, l.debit, l.credit, l.balance]));
          }}><Download size={16} /> Export</Button>
        </>} />
      <section className="gl-panel">
        <div className="gl-toolbar">
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Branch">
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">All branches</option>
              {refs.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          {ledger ? (
            <Field label="Account">
              <Select value={accountId ?? ""} onChange={(e) => showAccount(e.target.value || null)}>
                {refs.accounts.filter((a) => !a.isHeader).map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </Select>
            </Field>
          ) : null}
        </div>
        {error ? <StateMessage tone="error">{error}</StateMessage> : null}
        {loading ? <StateMessage tone="loading">Loading…</StateMessage> : null}

        {tb ? (
          <>
            <div className="gl-metrics">
              <div><span>Period debits</span><strong>{money(tb.totalDebit)}</strong></div>
              <div><span>Period credits</span><strong>{money(tb.totalCredit)}</strong></div>
              <div className={balanced ? "is-ok" : "is-bad"}><span>Ledger</span><strong>{balanced ? "Balanced" : "Out of balance"}</strong></div>
              <div><span>Scope</span><strong>{branchLabel}</strong></div>
            </div>
            <div className="gl-table-wrap gl-table-wrap--tall">
              <table className="gl-table">
                <thead><tr><th>Code</th><th>Account</th><th>Type</th><th className="gl-num">Opening</th><th className="gl-num">Debit</th><th className="gl-num">Credit</th><th className="gl-num">Closing</th></tr></thead>
                <tbody>
                  {tb.rows.map((r) => (
                    <tr key={r.accountId} className="gl-row" tabIndex={0} onClick={() => showAccount(r.accountId)}
                      onKeyDown={(e) => { if (e.key === "Enter") showAccount(r.accountId); }}>
                      <td className="gl-code">{r.code}</td><td>{r.name}</td><td>{ACCOUNT_TYPE_LABEL[r.type]}</td>
                      <td className="gl-num">{money(r.openingBalance)}</td><td className="gl-num">{amount(r.debit)}</td>
                      <td className="gl-num">{amount(r.credit)}</td><td className="gl-num">{money(r.closingBalance)}</td>
                    </tr>
                  ))}
                  {tb.rows.length === 0 ? <tr><td colSpan={7} className="gl-empty">No postings up to {day(to)}.</td></tr> : null}
                </tbody>
                <tfoot><tr><td colSpan={4}>Total</td><td className="gl-num">{money(tb.totalDebit)}</td><td className="gl-num">{money(tb.totalCredit)}</td><td /></tr></tfoot>
              </table>
            </div>
          </>
        ) : null}

        {ledger ? (
          <>
            <div className="gl-metrics">
              <div><span>Opening {day(ledger.from)}</span><strong>{money(ledger.openingBalance)}</strong></div>
              <div><span>Closing {day(ledger.to)}</span><strong>{money(ledger.closingBalance)}</strong></div>
              <div><span>Lines</span><strong>{ledger.lines.length}</strong></div>
            </div>
            <div className="gl-table-wrap gl-table-wrap--tall">
              <table className="gl-table">
                <thead><tr><th>Date</th><th>Journal</th><th>Description</th><th>Source</th><th className="gl-num">Debit</th><th className="gl-num">Credit</th><th className="gl-num">Balance</th></tr></thead>
                <tbody>
                  {ledger.lines.map((l, i) => (
                    <tr key={`${l.entryId}-${i}`} className="gl-row" tabIndex={0}
                      onClick={() => navigate(`/companies/${companyId}/finance/journals?journal=${l.entryId}`)}
                      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/companies/${companyId}/finance/journals?journal=${l.entryId}`); }}>
                      <td>{day(l.entryDate)}</td><td className="gl-code">{l.entryNo}</td>
                      <td>{l.description}{l.lineDescription ? <small>{l.lineDescription}</small> : null}</td>
                      <td>{l.sourceType ? <>{SOURCE_LABEL[l.sourceType] ?? l.sourceType}<small>{l.sourceNo}</small></> : "—"}</td>
                      <td className="gl-num">{amount(l.debit)}</td><td className="gl-num">{amount(l.credit)}</td><td className="gl-num">{money(l.balance)}</td>
                    </tr>
                  ))}
                  {ledger.lines.length === 0 ? <tr><td colSpan={7} className="gl-empty">No postings in this range.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
