import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { http } from "../../../api/http";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { StateMessage } from "../../../components/ui/Feedback";
import { Field, apiError, day, downloadCsv, money, monthStartIso, todayIso } from "../components/glShared";

type Box = { key: string; label: string; taxable: number; vat: number; documents: number };
type Tie = { key: string; label: string; return: number; ledger: number; difference: number };
type Withholding = { documentId: string; documentType: string; certificateNo: string; internalNo: string; supplierDocumentNo: string; date: string;
  supplierId: string; supplier: string; supplierTin?: string | null; taxableAmount: number; withheld: number };
type VatReturn = { from: string; to: string; currency: string; companyName: string; companyTin?: string | null; companyVatNo?: string | null; companyAddress?: string | null;
  output: Box[]; input: Box[]; outputVat: number; inputVat: number; netVatPayable: number; tieOut: Tie[]; withholding: Withholding[]; withheldTotal: number; notes: string[] };

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escape = (text: string) => text.replace(/[&<>"']/g, c => ENTITIES[c] ?? c);

/** Opens a printable withholding certificate for one supplier document. */
function printCertificate(r: VatReturn, w: Withholding) {
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  const rows: [string, string][] = [
    ["Certificate no.", w.certificateNo], ["Date", day(w.date)],
    ["Withholding agent", r.companyName], ["Agent TIN", r.companyTin ?? "—"], ["Agent address", r.companyAddress || "—"],
    ["Supplier (withholdee)", w.supplier], ["Supplier TIN", w.supplierTin ?? "—"],
    ["Document", `${w.documentType === "CreditNote" ? "Credit note" : "Invoice"} ${w.supplierDocumentNo} (our ref. ${w.internalNo})`],
    ["Taxable amount", `${money(w.taxableAmount)} ${r.currency}`], ["Tax withheld", `${money(w.withheld)} ${r.currency}`],
  ];
  win.document.write(`<!DOCTYPE html><html><head><title>${escape(w.certificateNo)}</title><style>
    body{margin:40px} h1{font-size:20px} table{border-collapse:collapse;width:100%} td{border:1px solid;padding:8px;vertical-align:top}
    td:first-child{width:35%;font-weight:600} .sign{margin-top:60px;display:flex;justify-content:space-between} .sign div{border-top:1px solid;width:40%;padding-top:6px}
  </style></head><body><h1>Withholding tax certificate</h1>
    <table>${rows.map(([k, v]) => `<tr><td>${escape(k)}</td><td>${escape(v)}</td></tr>`).join("")}</table>
    <p>The tax above has been withheld and will be paid to the tax authority with the withholding declaration for ${escape(day(r.from))} – ${escape(day(r.to))}.</p>
    <div class="sign"><div>Prepared by</div><div>Authorised signature and stamp</div></div>
    <script>window.onload=function(){window.print();}</script></body></html>`);
  win.document.close();
}

export default function VatReturnPage() {
  const { companyId = "" } = useParams();
  const [from, setFrom] = useState(monthStartIso()); const [to, setTo] = useState(todayIso());
  const [data, setData] = useState<VatReturn | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError(""); setData(null);
    http.get<VatReturn>(`/companies/${companyId}/finance/reports/vat-return`, { params: { from, to }, signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setData(r.data); })
      .catch(e => { if (!controller.signal.aborted) setError(apiError(e, "Could not load the VAT return.")); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [companyId, from, to]);

  const exportCsv = () => data && downloadCsv(`vat-return-${from}-${to}.csv`, ["Part", "Line", "Taxable value", "VAT", "Documents"], [
    ...data.output.map(b => ["Output", b.label, b.taxable, b.vat, b.documents]),
    ["Output", "Total output VAT", "", data.outputVat, ""],
    ...data.input.map(b => ["Input", b.label, b.taxable, b.vat, b.documents]),
    ["Input", "Total input VAT", "", data.inputVat, ""],
    ["Result", data.netVatPayable >= 0 ? "VAT payable" : "VAT credit to carry forward", "", data.netVatPayable, ""],
    ...data.withholding.map(w => ["Withholding", `${w.certificateNo} ${w.supplier} (${w.supplierTin ?? "no TIN"})`, w.taxableAmount, w.withheld, 1]),
  ]);
  const boxes = (title: string, rows: Box[], total: number) => <>
    <h2>{title}</h2>
    <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Line</th><th className="gl-num">Documents</th><th className="gl-num">Taxable value</th><th className="gl-num">VAT</th></tr></thead>
      <tbody>{rows.map(b => <tr key={b.key}><td>{b.label}</td><td className="gl-num">{b.documents}</td><td className="gl-num">{money(b.taxable)}</td><td className="gl-num">{money(b.vat)}</td></tr>)}
        <tr><td colSpan={3}><strong>Total</strong></td><td className="gl-num"><strong>{money(total)}</strong></td></tr></tbody></table></div>
  </>;

  return <div className="gl-page">
    <PageHeader title="VAT return" subtitle="Monthly VAT declaration from sales, catering and supplier documents, tied out to the ledger, with the withholding schedule."
      actions={<Button variant="outline" disabled={!data || busy} onClick={exportCsv}>Export</Button>} />
    <section className="gl-panel">
      <div className="gl-toolbar">
        <Field label="From"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
      </div>
      {error && <StateMessage tone="error">{error}</StateMessage>}
      {busy && <StateMessage tone="loading">Working out the return…</StateMessage>}
      {data && <>
        <p>{data.companyName}{data.companyTin ? ` · TIN ${data.companyTin}` : ""}{data.companyVatNo ? ` · VAT reg. ${data.companyVatNo}` : ""} · {day(data.from)} – {day(data.to)} · {data.currency}</p>
        <div className="gl-metrics">
          <div><span>Output VAT</span><strong>{money(data.outputVat)}</strong></div>
          <div><span>Input VAT</span><strong>{money(data.inputVat)}</strong></div>
          <div><span>{data.netVatPayable >= 0 ? "VAT payable" : "VAT credit to carry forward"}</span><strong>{money(Math.abs(data.netVatPayable))}</strong></div>
          <div><span>Tax withheld from suppliers</span><strong>{money(data.withheldTotal)}</strong></div>
        </div>
        {boxes("Output tax (sales)", data.output, data.outputVat)}
        {boxes("Input tax (purchases)", data.input, data.inputVat)}
        <h2>Tie-out to the ledger</h2>
        {data.tieOut.some(t => t.difference !== 0) && <StateMessage tone="error">The return and the VAT accounts differ. Check timing (sessions closed after the month end, invoices approved late) and any VAT posted by manual journal before filing.</StateMessage>}
        <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Account</th><th className="gl-num">Return</th><th className="gl-num">Ledger movement</th><th className="gl-num">Difference</th></tr></thead>
          <tbody>{data.tieOut.map(t => <tr key={t.key}><td>{t.label}</td><td className="gl-num">{money(t.return)}</td><td className="gl-num">{money(t.ledger)}</td><td className="gl-num">{money(t.difference)}</td></tr>)}</tbody></table></div>
        <h2>Withholding schedule</h2>
        <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Certificate</th><th>Date</th><th>Supplier</th><th>TIN</th><th>Document</th><th className="gl-num">Taxable</th><th className="gl-num">Withheld</th><th /></tr></thead>
          <tbody>{data.withholding.map(w => <tr key={w.documentId}><td>{w.certificateNo}</td><td>{day(w.date)}</td><td>{w.supplier}</td><td>{w.supplierTin ?? "—"}</td>
            <td>{w.supplierDocumentNo}</td><td className="gl-num">{money(w.taxableAmount)}</td><td className="gl-num">{money(w.withheld)}</td>
            <td><Button size="sm" variant="outline" onClick={() => printCertificate(data, w)}>Print certificate</Button></td></tr>)}
            {!data.withholding.length && <tr><td colSpan={8}>No tax was withheld in these dates.</td></tr>}</tbody></table></div>
        {data.notes.map(n => <p key={n}>{n}</p>)}
      </>}
    </section>
  </div>;
}
