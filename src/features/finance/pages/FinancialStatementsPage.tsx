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
type TableLine = { kind: "heading" | "account" | "subtotal" | "total"; label: string; code?: string | null; values: number[] };
type Table = { columns: string[]; lines: TableLine[] };
type Statements = { profitAndLoss: Row[]; netProfit: number; balanceSheet: Row[]; assets: number; liabilitiesAndEquity: number;
  cashFlow: Row[]; openingCash: number; closingCash: number; unclassifiedCashMovement: number; unclassifiedJournals?: number;
  profitAndLossTable?: Table | null; balanceSheetTable?: Table | null };

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (text: string) => text.replace(/[&<>"']/g, c => ENTITIES[c] ?? c);

/** Opens the formatted statement in a printable page (print or save as PDF). */
function printStatement(title: string, subtitle: string, table: Table) {
  const win = window.open("", "_blank", "width=1000,height=1000");
  if (!win) return;
  const row = (l: TableLine) => {
    const label = l.kind === "account" ? `<td class="indent">${l.code ? esc(l.code) + " " : ""}${esc(l.label)}</td>` : `<td>${esc(l.label)}</td>`;
    const cells = l.kind === "heading" ? `<td colspan="${table.columns.length}"></td>` : l.values.map(v => `<td class="num">${esc(money(v))}</td>`).join("");
    return `<tr class="${l.kind}">${label}${cells}</tr>`;
  };
  win.document.write(`<!DOCTYPE html><html><head><title>${esc(title)}</title><style>
    body{margin:40px} h1{font-size:22px;margin:0} p{margin:4px 0 18px} table{border-collapse:collapse;width:100%} th,td{padding:5px 8px;text-align:left}
    th{border-bottom:2px solid} .num{text-align:right} .indent{padding-left:24px} tr.heading td{font-weight:700;padding-top:14px}
    tr.subtotal td{border-top:1px solid;font-weight:600} tr.total td{border-top:2px solid;border-bottom:2px solid;font-weight:700}
  </style></head><body><h1>${esc(title)}</h1><p>${esc(subtitle)}</p><table><thead><tr><th></th>${table.columns.map(c => `<th class="num">${esc(c)}</th>`).join("")}</tr></thead>
    <tbody>${table.lines.map(row).join("")}</tbody></table><script>window.onload=function(){window.print();}</script></body></html>`);
  win.document.close();
}

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
  const [branch, setBranch] = useState(""); const [costCenter, setCostCenter] = useState(""); const [tab, setTab] = useState<"profitAndLoss" | "balanceSheet" | "cashFlow">("profitAndLoss");
  const [data, setData] = useState<Statements | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError(""); setData(null);
    http.get<Statements>(`/companies/${companyId}/finance/reports/statements`, { params: { from, to, branchId: branch || undefined, costCenterId: costCenter || undefined }, signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setData(r.data); })
      .catch(e => { if (!controller.signal.aborted) setError(apiError(e, "Could not load financial statements.")); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [companyId, from, to, branch, costCenter]);
  const rows = data?.[tab] ?? [];
  const table = tab === "profitAndLoss" ? data?.profitAndLossTable : tab === "balanceSheet" ? data?.balanceSheetTable : null;
  const title = tab === "profitAndLoss" ? "Profit and loss" : tab === "balanceSheet" ? "Balance sheet" : "Cash flow";
  const scope = [refs.branches.find(b => b.id === branch)?.name, refs.costCenters.find(c => c.id === costCenter)?.name].filter(Boolean).join(" · ");
  const subtitle = (tab === "balanceSheet" ? `As at ${to}` : `${from} to ${to}`) + (scope ? ` · ${scope}` : "");
  const exportCsv = () => table
    ? downloadCsv(`${tab}-${from}-${to}.csv`, ["Line", "Code", ...table.columns], table.lines.filter(l => l.kind !== "heading").map(l => [l.label, l.code ?? "", ...l.values]))
    : downloadCsv(`${tab}-${from}-${to}.csv`, ["Section", "Code", "Account", "Amount"], rows.map(r => [r.section, r.code, r.name, r.amount]));
  return <div className="gl-page">
    <PageHeader title="Financial statements" subtitle="Posted ledger balances and movements in the company functional currency."
      actions={<><Button variant="outline" disabled={!data || busy} onClick={exportCsv}>Export CSV</Button>
        <Button variant="outline" disabled={!table || busy} onClick={() => table && printStatement(title, subtitle, table)}>Print / PDF</Button></>} />
    <section className="gl-panel">
      <div className="gl-toolbar">
        <Field label="Report"><Select value={tab} onChange={e => setTab(e.target.value as typeof tab)}><option value="profitAndLoss">Profit and loss</option><option value="balanceSheet">Balance sheet</option><option value="cashFlow">Cash flow</option></Select></Field>
        <Field label="From"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
        <Field label="Branch"><Select value={branch} onChange={e => setBranch(e.target.value)}><option value="">All branches</option>{refs.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
        <Field label="Cost centre"><Select value={costCenter} onChange={e => setCostCenter(e.target.value)}><option value="">All cost centres</option>{refs.costCenters.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</Select></Field>
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
        {table && <div className="gl-table-wrap"><table className="gl-table gl-statement"><thead><tr><th>{title}</th>{table.columns.map(c => <th key={c} className="gl-num">{c}</th>)}</tr></thead>
          <tbody>{table.lines.map((l, i) => l.kind === "heading"
            ? <tr key={i}><td colSpan={table.columns.length + 1}><strong>{l.label}</strong></td></tr>
            : <tr key={i}>
                <td>{l.kind === "account" ? <span className="gl-indent">{l.code ? `${l.code} ` : ""}{l.label}</span> : <strong>{l.label}</strong>}</td>
                {l.values.map((v, n) => <td key={n} className="gl-num">{l.kind === "account" ? money(v) : <strong>{money(v)}</strong>}</td>)}
              </tr>)}
            {!table.lines.some(l => l.kind === "account") && <tr><td colSpan={table.columns.length + 1}>No posted movements.</td></tr>}</tbody></table></div>}
        {!table && <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Section</th><th>Code</th><th>Account</th><th className="gl-num">Amount</th></tr></thead><tbody>{(tab === "cashFlow" ? withSubtotals(rows) : rows.map(r => ({ ...r, subtotal: false }))).map((r, i) => r.subtotal
          ? <tr key={`total-${r.section}-${i}`}><td colSpan={3}><strong>Net cash from {r.section.toLowerCase()}</strong></td><td className="gl-num"><strong>{money(r.amount)}</strong></td></tr>
          : <tr key={`${r.section}-${r.code}-${i}`}><td>{r.section}</td><td>{r.code}</td><td>{r.name}</td><td className="gl-num">{money(r.amount)}</td></tr>)}{!rows.length && <tr><td colSpan={4}>No posted movements.</td></tr>}</tbody></table></div>}
      </>}
    </section>
  </div>;
}
