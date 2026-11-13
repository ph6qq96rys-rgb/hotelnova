import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { http } from "../../../api/http";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { StateMessage } from "../../../components/ui/Feedback";
import { Field, apiError, downloadCsv, money, monthStartIso, todayIso } from "../components/glShared";
import { useFinanceRefs } from "../components/useFinanceRefs";

type Row = { section: string; code: string; name: string; amount: number };
type Statements = { profitAndLoss: Row[]; netProfit: number; balanceSheet: Row[]; assets: number; liabilitiesAndEquity: number;
  cashFlow: Row[]; openingCash: number; closingCash: number; unclassifiedCashMovement: number; unclassifiedJournals?: number };

/** Cash-flow rows arrive grouped by section; add each section's total after its last row. */
function withSubtotals(rows: Row[]): (Row & { subtotal?: boolean })[] {
  const out: (Row & { subtotal?: boolean })[] = [];
  rows.forEach((r, i) => {
    out.push(r);
    if (rows[i + 1]?.section !== r.section)
      out.push({ section: r.section, code: "", name: "", amount: rows.filter(x => x.section === r.section).reduce((t, x) => t + x.amount, 0), subtotal: true });
  });
  return out;
}

export default function FinancialStatementsPage() {
  const { companyId = "" } = useParams();
  const refs = useFinanceRefs(companyId);
  const [from, setFrom] = useState(monthStartIso()); const [to, setTo] = useState(todayIso());
  const [branch, setBranch] = useState(""); const [tab, setTab] = useState<"profitAndLoss" | "balanceSheet" | "cashFlow">("profitAndLoss");
  const [data, setData] = useState<Statements | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError(""); setData(null);
    http.get<Statements>(`/companies/${companyId}/finance/reports/statements`, { params: { from, to, branchId: branch || undefined }, signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setData(r.data); })
      .catch(e => { if (!controller.signal.aborted) setError(apiError(e, "Could not load financial statements.")); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [companyId, from, to, branch]);
  const rows = data?.[tab] ?? [];
  return <div className="gl-page">
    <PageHeader title="Financial statements" subtitle="Posted ledger balances and movements in the company functional currency."
      actions={<Button variant="outline" disabled={!data || busy} onClick={() => downloadCsv(`${tab}-${from}-${to}.csv`, ["Section", "Code", "Account", "Amount"], rows.map(r => [r.section, r.code, r.name, r.amount]))}>Export</Button>} />
    <section className="gl-panel">
      <div className="gl-toolbar">
        <Field label="Report"><Select value={tab} onChange={e => setTab(e.target.value as typeof tab)}><option value="profitAndLoss">Profit and loss</option><option value="balanceSheet">Balance sheet</option><option value="cashFlow">Cash flow</option></Select></Field>
        <Field label="From"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
        <Field label="Branch"><Select value={branch} onChange={e => setBranch(e.target.value)}><option value="">All branches</option>{refs.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
      </div>
      {error && <StateMessage tone="error">{error}</StateMessage>}
      {busy && <StateMessage tone="loading">Loading statements…</StateMessage>}
      {data && <>
        <div className="gl-metrics">
          {tab === "profitAndLoss" && <div><span>Net profit / (loss)</span><strong>{money(data.netProfit)}</strong></div>}
          {tab === "balanceSheet" && <><div><span>Assets</span><strong>{money(data.assets)}</strong></div><div><span>Liabilities and equity</span><strong>{money(data.liabilitiesAndEquity)}</strong></div><div><span>Difference</span><strong>{money(data.assets - data.liabilitiesAndEquity)}</strong></div></>}
          {tab === "cashFlow" && <><div><span>Opening cash and bank</span><strong>{money(data.openingCash)}</strong></div><div><span>Net movement</span><strong>{money(data.closingCash - data.openingCash)}</strong></div><div><span>Closing cash and bank</span><strong>{money(data.closingCash)}</strong></div></>}
        </div>
        {tab === "balanceSheet" && <p>Balances as at {to}, including earnings not yet closed to retained earnings.</p>}
        {tab === "cashFlow" && <p>Cash and Bank account categories define cash equivalents. Each cash movement is shown against the account on the other side of the entry, in that account's cash-flow section (set on the chart of accounts). Opening balance entries are shown separately.</p>}
        {tab === "cashFlow" && (data.unclassifiedCashMovement !== 0 || !!data.unclassifiedJournals) && <StateMessage tone="error">Unclassified cash movement: {money(data.unclassifiedCashMovement)} across {data.unclassifiedJournals ?? "unclassified"} journals. Review account categories and mixed journals before issuing this statement.</StateMessage>}
        <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Section</th><th>Code</th><th>Account</th><th className="gl-num">Amount</th></tr></thead><tbody>{(tab === "cashFlow" ? withSubtotals(rows) : rows.map(r => ({ ...r, subtotal: false }))).map((r, i) => r.subtotal
          ? <tr key={`total-${r.section}-${i}`}><td colSpan={3}><strong>Net cash from {r.section.toLowerCase()}</strong></td><td className="gl-num"><strong>{money(r.amount)}</strong></td></tr>
          : <tr key={`${r.section}-${r.code}-${i}`}><td>{r.section}</td><td>{r.code}</td><td>{r.name}</td><td className="gl-num">{money(r.amount)}</td></tr>)}{!rows.length && <tr><td colSpan={4}>No posted movements.</td></tr>}</tbody></table></div>
      </>}
    </section>
  </div>;
}
