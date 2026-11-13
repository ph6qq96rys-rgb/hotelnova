import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { http } from "../../../api/http";
import { useAuth } from "../../../auth/AuthProvider";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { StateMessage } from "../../../components/ui/Feedback";
import { Chip, Field, apiError, day, downloadCsv, money, monthStartIso, todayIso } from "../components/glShared";
import { useFinanceRefs } from "../components/useFinanceRefs";

type Customer = { id: string; code: string; name: string; kind: string; tin?: string | null; vatNo?: string | null; contactName?: string | null; email?: string | null;
  phone?: string | null; address?: string | null; creditLimit: number; paymentTermsDays: number; onHold: boolean; holdReason?: string | null; isActive: boolean;
  balance: number; overdue: number; version: string };
type CustomerInput = Omit<Customer, "id" | "balance" | "overdue" | "version"> & { version?: string };
type InvoiceItem = { id: string; invoiceNo?: string | null; customerId: string; customer: string; invoiceDate: string; dueDate: string; status: string;
  total: number; balance: number; reference?: string | null; version: string };
type InvoiceLine = { description: string; quantity: number; unitPrice: number; vatRate: number; revenueAccountId?: string | null; netAmount?: number; vatAmount?: number };
type Invoice = { id: string; invoiceNo?: string | null; customerId: string; invoiceDate: string; dueDate: string; reference?: string | null; notes?: string | null; status: string;
  subtotal: number; vatTotal: number; total: number; paidAmount: number; creditedAmount: number; version: string; lines: InvoiceLine[] };
type Credit = { id: string; invoiceId: string; creditNo?: string | null; creditDate: string; kind: string; netAmount: number; vatAmount: number; total: number; reason: string; status: string; version: string };
type Receipt = { id: string; customerId: string; receiptNo: string; receiptDate: string; method: string; reference?: string | null; amount: number; allocatedAmount: number;
  status: string; reversalReason?: string | null; version: string };
type AgeingRow = { customerId: string; code: string; name: string; current: number; days1To30: number; days31To60: number; days61To90: number; over90: number;
  onAccount: number; balance: number; creditLimit: number; onHold: boolean };
type Ageing = { asOf: string; rows: AgeingRow[]; total: number; ledgerBalance: number; difference: number };
type StatementLine = { date: string; type: string; number?: string | null; reference?: string | null; debit: number; credit: number; balance: number };
type Statement = { customer: Customer; from: string; to: string; opening: number; lines: StatementLine[]; closing: number; openInvoices: InvoiceItem[] };

const KINDS = ["Corporate", "Hotel", "House", "Credit"];
const METHODS = ["BANK", "CASH", "CHEQUE", "CARD", "MOBILE"];
const blankCustomer: CustomerInput = { code: "", name: "", kind: "Corporate", tin: "", vatNo: "", contactName: "", email: "", phone: "", address: "",
  creditLimit: 0, paymentTermsDays: 30, onHold: false, holdReason: "", isActive: true };
const blankLine = (): InvoiceLine => ({ description: "", quantity: 1, unitPrice: 0, vatRate: 15 });
const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (text: string | number | null | undefined) => String(text ?? "").replace(/[&<>"']/g, c => ENTITIES[c] ?? c);

/** Opens a printable document (invoice or statement) and starts printing. */
function printDocument(title: string, head: string, table: string[][], foot: string) {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return;
  const [header, ...rows] = table;
  win.document.write(`<!DOCTYPE html><html><head><title>${esc(title)}</title><style>
    body{margin:40px} h1{font-size:22px} table{border-collapse:collapse;width:100%;margin-top:16px} th,td{border:1px solid;padding:6px;text-align:left} .num{text-align:right}
  </style></head><body><h1>${esc(title)}</h1>${head}
    <table><thead><tr>${header.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i >= r.length - 3 ? "num" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
    ${foot}<script>window.onload=function(){window.print();}</script></body></html>`);
  win.document.close();
}

export default function ReceivablesPage() {
  const { companyId = "" } = useParams(); const { hasPermission } = useAuth(); const refs = useFinanceRefs(companyId);
  const base = `/companies/${companyId}/finance/receivables`;
  const canManage = hasPermission("finance.manage"), canPrepare = hasPermission("finance.journals.create"), canApprove = hasPermission("finance.approve");
  const [tab, setTab] = useState<"customers" | "invoices" | "receipts" | "ageing">("customers");
  const [customers, setCustomers] = useState<Customer[]>([]); const [invoices, setInvoices] = useState<InvoiceItem[]>([]); const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<{ id: string | null; input: CustomerInput } | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<{ id: string | null; version?: string; customerId: string; invoiceDate: string; dueDate: string; reference: string; notes: string; lines: InvoiceLine[] } | null>(null);
  const [selected, setSelected] = useState<{ invoice: Invoice; credits: Credit[] } | null>(null);
  const [creditForm, setCreditForm] = useState({ kind: "Credit", amount: "", date: todayIso(), reason: "" });
  const [receiptForm, setReceiptForm] = useState({ customerId: "", date: todayIso(), method: "BANK", reference: "", amount: "", auto: true });
  const [reversing, setReversing] = useState<{ receipt: Receipt; reason: string; date: string } | null>(null);
  const [asOf, setAsOf] = useState(todayIso()); const [ageing, setAgeing] = useState<Ageing | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null); const [stmtRange, setStmtRange] = useState({ from: monthStartIso(), to: todayIso() });
  const [customerFilter, setCustomerFilter] = useState("");

  const load = useCallback(async () => {
    const [c, i, r] = await Promise.all([
      http.get<Customer[]>(`${base}/customers`), http.get<InvoiceItem[]>(`${base}/invoices`, { params: { customerId: customerFilter || undefined } }),
      http.get<Receipt[]>(`${base}/receipts`, { params: { customerId: customerFilter || undefined } })]);
    setCustomers(c.data); setInvoices(i.data); setReceipts(r.data);
  }, [base, customerFilter]);
  useEffect(() => { void load().catch(e => setError(apiError(e, "Could not load receivables."))); }, [load]);
  useEffect(() => {
    if (tab !== "ageing") return;
    http.get<Ageing>(`${base}/ageing`, { params: { asOf } }).then(r => setAgeing(r.data)).catch(e => setError(apiError(e, "Could not load the ageing.")));
  }, [tab, asOf, base]);

  async function run(work: () => Promise<void>, done?: string) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); await load(); if (done) setNotice(done); } catch (e) { setError(apiError(e, "The change could not be saved.")); } finally { setBusy(false); }
  }
  async function openInvoice(id: string) {
    const [inv, cr] = await Promise.all([http.get<Invoice>(`${base}/invoices/${id}`), http.get<Credit[]>(`${base}/credits`, { params: { invoiceId: id } })]);
    setSelected({ invoice: inv.data, credits: cr.data }); setCreditForm({ kind: "Credit", amount: "", date: todayIso(), reason: "" });
  }
  async function openStatement(customerId: string) {
    setStatement((await http.get<Statement>(`${base}/customers/${customerId}/statement`, { params: stmtRange })).data);
  }
  const name = (id: string) => customers.find(c => c.id === id)?.name ?? "";
  const revenueAccounts = refs.accounts.filter(a => a.type === "revenue" && a.isActive && !a.isHeader);
  const invoiceTotal = (invoiceForm?.lines ?? []).reduce((t, l) => { const net = Math.round(l.quantity * l.unitPrice * 100) / 100; return t + net + Math.round(net * l.vatRate) / 100; }, 0);

  const printInvoice = (inv: Invoice) => {
    const c = customers.find(x => x.id === inv.customerId);
    printDocument(`Invoice ${inv.invoiceNo ?? "(draft)"}`,
      `<p><strong>Bill to:</strong> ${esc(c?.name)}${c?.tin ? ` · TIN ${esc(c.tin)}` : ""}<br/>${esc(c?.address)}</p><p>Date ${esc(day(inv.invoiceDate))} · Due ${esc(day(inv.dueDate))}${inv.reference ? ` · Your ref. ${esc(inv.reference)}` : ""}</p>`,
      [["Description", "Quantity", "Unit price", "VAT %", "Net", "VAT"], ...inv.lines.map(l => [l.description, String(l.quantity), money(l.unitPrice), String(l.vatRate), money(l.netAmount), money(l.vatAmount)])],
      `<p class="num">Subtotal ${esc(money(inv.subtotal))} · VAT ${esc(money(inv.vatTotal))} · <strong>Total ${esc(money(inv.total))}</strong></p>${inv.notes ? `<p>${esc(inv.notes)}</p>` : ""}`);
  };
  const printStatement = (s: Statement) => printDocument(`Statement · ${s.customer.name}`,
    `<p>${esc(day(s.from))} – ${esc(day(s.to))}${s.customer.tin ? ` · TIN ${esc(s.customer.tin)}` : ""}</p><p>Opening balance ${esc(money(s.opening))}</p>`,
    [["Date", "Type", "Number", "Reference", "Debit", "Credit", "Balance"], ...s.lines.map(l => [day(l.date), l.type, l.number ?? "", l.reference ?? "", l.debit ? money(l.debit) : "", l.credit ? money(l.credit) : "", money(l.balance)])],
    `<p class="num"><strong>Balance due ${esc(money(s.closing))}</strong></p>`);

  return <div className="gl-page">
    <PageHeader title="Accounts receivable" subtitle="Account customers, invoices, credit notes, receipts, ageing and statements. Prepared by one person, posted by another." />
    <div className="gl-toolbar">
      {(["customers", "invoices", "receipts", "ageing"] as const).map(t => <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</Button>)}
      {tab !== "customers" && tab !== "ageing" && <Field label="Customer"><Select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}><option value="">All customers</option>{customers.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</Select></Field>}
    </div>
    {error && <StateMessage tone="error">{error}</StateMessage>}
    {notice && <StateMessage tone="success">{notice}</StateMessage>}

    {tab === "customers" && <section className="gl-panel">
      {canManage && <Button onClick={() => setEditingCustomer({ id: null, input: { ...blankCustomer } })}>New customer</Button>}
      {editingCustomer && (() => { const f = editingCustomer.input; const set = (p: Partial<CustomerInput>) => setEditingCustomer({ ...editingCustomer, input: { ...f, ...p } });
        return <div className="gl-panel"><div className="gl-toolbar">
          <Field label="Code"><Input value={f.code} maxLength={30} onChange={e => set({ code: e.target.value })} /></Field>
          <Field label="Name"><Input value={f.name} maxLength={200} onChange={e => set({ name: e.target.value })} /></Field>
          <Field label="Type"><Select value={f.kind} onChange={e => set({ kind: e.target.value })}>{KINDS.map(k => <option key={k} value={k}>{k}</option>)}</Select></Field>
          <Field label="TIN"><Input value={f.tin ?? ""} maxLength={30} onChange={e => set({ tin: e.target.value })} /></Field>
          <Field label="VAT reg. no."><Input value={f.vatNo ?? ""} maxLength={30} onChange={e => set({ vatNo: e.target.value })} /></Field>
          <Field label="Contact"><Input value={f.contactName ?? ""} maxLength={120} onChange={e => set({ contactName: e.target.value })} /></Field>
          <Field label="Email"><Input value={f.email ?? ""} maxLength={200} onChange={e => set({ email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone ?? ""} maxLength={40} onChange={e => set({ phone: e.target.value })} /></Field>
          <Field label="Address" wide><Input value={f.address ?? ""} maxLength={500} onChange={e => set({ address: e.target.value })} /></Field>
          <Field label="Credit limit (0 = none)"><Input type="number" step="0.01" min={0} value={f.creditLimit} onChange={e => set({ creditLimit: Number(e.target.value) })} /></Field>
          <Field label="Payment terms (days)"><Input type="number" min={0} max={365} value={f.paymentTermsDays} onChange={e => set({ paymentTermsDays: Number(e.target.value) })} /></Field>
          <label className="gl-check"><Checkbox checked={f.onHold} onChange={e => set({ onHold: e.target.checked })} /> On hold (no new invoices)</label>
          {f.onHold && <Field label="Hold reason" wide><Input value={f.holdReason ?? ""} maxLength={500} onChange={e => set({ holdReason: e.target.value })} /></Field>}
          <label className="gl-check"><Checkbox checked={f.isActive} onChange={e => set({ isActive: e.target.checked })} /> Active</label>
        </div>
          <Button disabled={busy} onClick={() => void run(async () => {
            if (editingCustomer.id) await http.put(`${base}/customers/${editingCustomer.id}`, f); else await http.post(`${base}/customers`, f);
            setEditingCustomer(null);
          }, "Customer saved.")}>Save customer</Button> <Button variant="outline" onClick={() => setEditingCustomer(null)}>Cancel</Button></div>; })()}
      <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>TIN</th><th className="gl-num">Credit limit</th><th className="gl-num">Balance</th><th className="gl-num">Overdue</th><th>Status</th><th /></tr></thead>
        <tbody>{customers.map(c => <tr key={c.id}><td>{c.code}</td><td>{c.name}</td><td>{c.kind}</td><td>{c.tin ?? ""}</td><td className="gl-num">{c.creditLimit ? money(c.creditLimit) : "No limit"}</td>
          <td className="gl-num">{money(c.balance)}</td><td className="gl-num">{money(c.overdue)}</td>
          <td>{!c.isActive ? <Chip tone="muted">Inactive</Chip> : c.onHold ? <Chip tone="bad">On hold</Chip> : c.creditLimit && c.balance > c.creditLimit ? <Chip tone="warn">Over limit</Chip> : <Chip tone="ok">Active</Chip>}</td>
          <td>{canManage && <Button size="sm" variant="ghost" onClick={() => setEditingCustomer({ id: c.id, input: { code: c.code, name: c.name, kind: c.kind, tin: c.tin, vatNo: c.vatNo, contactName: c.contactName, email: c.email, phone: c.phone, address: c.address, creditLimit: c.creditLimit, paymentTermsDays: c.paymentTermsDays, onHold: c.onHold, holdReason: c.holdReason, isActive: c.isActive, version: c.version } })}>Edit</Button>}
            <Button size="sm" variant="ghost" onClick={() => void openStatement(c.id).catch(e => setError(apiError(e, "Could not load the statement.")))}>Statement</Button></td></tr>)}
          {!customers.length && <tr><td colSpan={9}>No account customers yet.</td></tr>}</tbody></table></div>
      {statement && <div className="gl-panel"><h2>Statement · {statement.customer.name}</h2>
        <div className="gl-toolbar"><Field label="From"><Input type="date" value={stmtRange.from} onChange={e => setStmtRange({ ...stmtRange, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={stmtRange.to} onChange={e => setStmtRange({ ...stmtRange, to: e.target.value })} /></Field>
          <Button variant="outline" onClick={() => void openStatement(statement.customer.id).catch(e => setError(apiError(e, "Could not load the statement.")))}>Refresh</Button>
          <Button variant="outline" onClick={() => printStatement(statement)}>Print</Button><Button variant="ghost" onClick={() => setStatement(null)}>Close</Button></div>
        <p>Opening balance {money(statement.opening)} · Closing balance <strong>{money(statement.closing)}</strong></p>
        <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Date</th><th>Type</th><th>Number</th><th>Reference</th><th className="gl-num">Debit</th><th className="gl-num">Credit</th><th className="gl-num">Balance</th></tr></thead>
          <tbody>{statement.lines.map((l, i) => <tr key={i}><td>{day(l.date)}</td><td>{l.type}</td><td>{l.number}</td><td>{l.reference}</td><td className="gl-num">{l.debit ? money(l.debit) : ""}</td><td className="gl-num">{l.credit ? money(l.credit) : ""}</td><td className="gl-num">{money(l.balance)}</td></tr>)}
            {!statement.lines.length && <tr><td colSpan={7}>No transactions in these dates.</td></tr>}</tbody></table></div></div>}
    </section>}

    {tab === "invoices" && <section className="gl-panel">
      {canPrepare && <Button onClick={() => { setSelected(null); setInvoiceForm({ id: null, customerId: customerFilter, invoiceDate: todayIso(), dueDate: "", reference: "", notes: "", lines: [blankLine()] }); }}>New invoice</Button>}
      {invoiceForm && <div className="gl-panel">
        <div className="gl-toolbar">
          <Field label="Customer"><Select value={invoiceForm.customerId} onChange={e => setInvoiceForm({ ...invoiceForm, customerId: e.target.value })}><option value="">Select customer</option>{customers.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</Select></Field>
          <Field label="Invoice date"><Input type="date" value={invoiceForm.invoiceDate} onChange={e => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })} /></Field>
          <Field label="Due date" hint="Empty uses the customer's payment terms."><Input type="date" value={invoiceForm.dueDate} onChange={e => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} /></Field>
          <Field label="Customer reference"><Input value={invoiceForm.reference} maxLength={120} onChange={e => setInvoiceForm({ ...invoiceForm, reference: e.target.value })} /></Field>
        </div>
        <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>VAT %</th><th>Revenue account</th><th /></tr></thead><tbody>
          {invoiceForm.lines.map((l, i) => { const setLine = (p: Partial<InvoiceLine>) => setInvoiceForm({ ...invoiceForm, lines: invoiceForm.lines.map((x, n) => n === i ? { ...x, ...p } : x) });
            return <tr key={i}><td><Input value={l.description} maxLength={300} onChange={e => setLine({ description: e.target.value })} /></td>
              <td><Input type="number" step="0.01" min={0} value={l.quantity} onChange={e => setLine({ quantity: Number(e.target.value) })} /></td>
              <td><Input type="number" step="0.01" min={0} value={l.unitPrice} onChange={e => setLine({ unitPrice: Number(e.target.value) })} /></td>
              <td><Input type="number" step="0.01" min={0} max={100} value={l.vatRate} onChange={e => setLine({ vatRate: Number(e.target.value) })} /></td>
              <td><Select value={l.revenueAccountId ?? ""} onChange={e => setLine({ revenueAccountId: e.target.value || null })}><option value="">Sales revenue (default)</option>{revenueAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</Select></td>
              <td><Button size="sm" variant="ghost" disabled={invoiceForm.lines.length === 1} onClick={() => setInvoiceForm({ ...invoiceForm, lines: invoiceForm.lines.filter((_, n) => n !== i) })}>Remove</Button></td></tr>; })}
        </tbody></table></div>
        <Button variant="outline" onClick={() => setInvoiceForm({ ...invoiceForm, lines: [...invoiceForm.lines, blankLine()] })}>Add line</Button>
        <Field label="Notes on the invoice" wide><Textarea value={invoiceForm.notes} maxLength={1000} onChange={e => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} /></Field>
        <p>Total including VAT: <strong>{money(invoiceTotal)}</strong></p>
        <Button disabled={busy || !invoiceForm.customerId} onClick={() => void run(async () => {
          const body = { customerId: invoiceForm.customerId, branchId: null, invoiceDate: invoiceForm.invoiceDate, dueDate: invoiceForm.dueDate || null, reference: invoiceForm.reference,
            notes: invoiceForm.notes, lines: invoiceForm.lines.map(l => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, vatRate: l.vatRate, revenueAccountId: l.revenueAccountId || null })),
            version: invoiceForm.version };
          if (invoiceForm.id) await http.put(`${base}/invoices/${invoiceForm.id}`, body); else await http.post(`${base}/invoices`, body);
          setInvoiceForm(null);
        }, "Draft invoice saved. Another finance user posts it.")}>Save draft</Button> <Button variant="outline" onClick={() => setInvoiceForm(null)}>Cancel</Button>
      </div>}
      <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Number</th><th>Customer</th><th>Date</th><th>Due</th><th>Status</th><th className="gl-num">Total</th><th className="gl-num">Open</th><th /></tr></thead>
        <tbody>{invoices.map(i => <tr key={i.id}><td>{i.invoiceNo ?? "Draft"}</td><td>{i.customer}</td><td>{day(i.invoiceDate)}</td><td>{day(i.dueDate)}</td>
          <td>{i.status === "Draft" ? <Chip tone="info">Draft</Chip> : i.balance === 0 ? <Chip tone="ok">Settled</Chip> : i.dueDate < todayIso() ? <Chip tone="bad">Overdue</Chip> : <Chip tone="warn">Open</Chip>}</td>
          <td className="gl-num">{money(i.total)}</td><td className="gl-num">{money(i.balance)}</td>
          <td><Button size="sm" variant="ghost" onClick={() => void openInvoice(i.id).catch(e => setError(apiError(e, "Could not open the invoice.")))}>Open</Button></td></tr>)}
          {!invoices.length && <tr><td colSpan={8}>No invoices.</td></tr>}</tbody></table></div>
      {selected && (() => { const inv = selected.invoice; const open = inv.total - inv.paidAmount - inv.creditedAmount;
        return <div className="gl-panel"><h2>{inv.invoiceNo ?? "Draft invoice"} · {name(inv.customerId)}</h2>
          <p>Total {money(inv.total)} · Paid {money(inv.paidAmount)} · Credited {money(inv.creditedAmount)} · Open <strong>{money(open)}</strong></p>
          <div className="gl-toolbar">
            <Button variant="outline" onClick={() => printInvoice(inv)}>Print</Button>
            {inv.status === "Draft" && canPrepare && <Button variant="outline" onClick={() => setInvoiceForm({ id: inv.id, version: inv.version, customerId: inv.customerId, invoiceDate: inv.invoiceDate, dueDate: inv.dueDate,
              reference: inv.reference ?? "", notes: inv.notes ?? "", lines: inv.lines.map(l => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, vatRate: l.vatRate, revenueAccountId: l.revenueAccountId })) })}>Edit</Button>}
            {inv.status === "Draft" && canApprove && <Button disabled={busy} onClick={() => void run(async () => { await http.post(`${base}/invoices/${inv.id}/post`, { version: inv.version }); await openInvoice(inv.id); }, "Invoice posted.")}>Post invoice</Button>}
            {inv.status === "Draft" && canPrepare && <Button variant="outline" disabled={busy} onClick={() => void run(async () => { await http.delete(`${base}/invoices/${inv.id}`); setSelected(null); }, "Draft deleted.")}>Delete draft</Button>}
            <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
          </div>
          <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Description</th><th className="gl-num">Quantity</th><th className="gl-num">Unit price</th><th className="gl-num">VAT %</th><th className="gl-num">Net</th><th className="gl-num">VAT</th></tr></thead>
            <tbody>{inv.lines.map((l, i) => <tr key={i}><td>{l.description}</td><td className="gl-num">{l.quantity}</td><td className="gl-num">{money(l.unitPrice)}</td><td className="gl-num">{l.vatRate}</td><td className="gl-num">{money(l.netAmount)}</td><td className="gl-num">{money(l.vatAmount)}</td></tr>)}</tbody></table></div>
          {inv.status === "Posted" && <>
            <h3>Credit notes and write-offs</h3>
            <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Number</th><th>Date</th><th>Kind</th><th>Reason</th><th className="gl-num">Amount</th><th /></tr></thead>
              <tbody>{selected.credits.map(c => <tr key={c.id}><td>{c.creditNo ?? "Draft"}</td><td>{day(c.creditDate)}</td><td>{c.kind === "WriteOff" ? "Bad-debt write-off" : "Credit note"}</td><td>{c.reason}</td><td className="gl-num">{money(c.total)}</td>
                <td>{c.status === "Draft" && canApprove && <Button size="sm" disabled={busy} onClick={() => void run(async () => { await http.post(`${base}/credits/${c.id}/post`, { version: c.version }); await openInvoice(inv.id); }, "Credit posted.")}>Post</Button>}
                  {c.status === "Draft" && canPrepare && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => { await http.delete(`${base}/credits/${c.id}`); await openInvoice(inv.id); })}>Delete</Button>}</td></tr>)}
                {!selected.credits.length && <tr><td colSpan={6}>None.</td></tr>}</tbody></table></div>
            {canPrepare && open > 0 && <div className="gl-toolbar">
              <Field label="Kind"><Select value={creditForm.kind} onChange={e => setCreditForm({ ...creditForm, kind: e.target.value })}><option value="Credit">Credit note (reverses revenue and VAT)</option><option value="WriteOff">Bad-debt write-off</option></Select></Field>
              <Field label="Amount incl. VAT"><Input type="number" step="0.01" min={0} max={open} value={creditForm.amount} onChange={e => setCreditForm({ ...creditForm, amount: e.target.value })} /></Field>
              <Field label="Date"><Input type="date" value={creditForm.date} onChange={e => setCreditForm({ ...creditForm, date: e.target.value })} /></Field>
              <Field label="Reason" wide><Input value={creditForm.reason} maxLength={500} onChange={e => setCreditForm({ ...creditForm, reason: e.target.value })} /></Field>
              <Button disabled={busy || !creditForm.amount || creditForm.reason.trim().length < 5} onClick={() => void run(async () => {
                await http.post(`${base}/credits`, { invoiceId: inv.id, creditDate: creditForm.date, kind: creditForm.kind, amount: Number(creditForm.amount), reason: creditForm.reason });
                await openInvoice(inv.id);
              }, "Draft credit saved. Another finance user posts it.")}>Save draft credit</Button>
            </div>}
          </>}
        </div>; })()}
    </section>}

    {tab === "receipts" && <section className="gl-panel">
      {canPrepare && <div className="gl-toolbar">
        <Field label="Customer"><Select value={receiptForm.customerId} onChange={e => setReceiptForm({ ...receiptForm, customerId: e.target.value })}><option value="">Select customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</Select></Field>
        <Field label="Date"><Input type="date" value={receiptForm.date} onChange={e => setReceiptForm({ ...receiptForm, date: e.target.value })} /></Field>
        <Field label="Method"><Select value={receiptForm.method} onChange={e => setReceiptForm({ ...receiptForm, method: e.target.value })}>{METHODS.map(m => <option key={m} value={m}>{m}</option>)}</Select></Field>
        <Field label="Reference"><Input value={receiptForm.reference} maxLength={120} onChange={e => setReceiptForm({ ...receiptForm, reference: e.target.value })} /></Field>
        <Field label="Amount"><Input type="number" step="0.01" min={0} value={receiptForm.amount} onChange={e => setReceiptForm({ ...receiptForm, amount: e.target.value })} /></Field>
        <label className="gl-check"><Checkbox checked={receiptForm.auto} onChange={e => setReceiptForm({ ...receiptForm, auto: e.target.checked })} /> Allocate to the oldest invoices</label>
        <Button disabled={busy || !receiptForm.customerId || !receiptForm.amount} onClick={() => void run(async () => {
          await http.post(`${base}/receipts`, { customerId: receiptForm.customerId, receiptDate: receiptForm.date, method: receiptForm.method, reference: receiptForm.reference,
            amount: Number(receiptForm.amount), allocations: receiptForm.auto ? null : [] });
          setReceiptForm({ ...receiptForm, amount: "", reference: "" });
        }, "Receipt recorded.")}>Record receipt</Button>
      </div>}
      {reversing && <div className="gl-panel"><h3>Reverse {reversing.receipt.receiptNo}</h3><div className="gl-toolbar">
        <Field label="Date"><Input type="date" value={reversing.date} onChange={e => setReversing({ ...reversing, date: e.target.value })} /></Field>
        <Field label="Reason" wide><Input value={reversing.reason} maxLength={500} onChange={e => setReversing({ ...reversing, reason: e.target.value })} /></Field>
        <Button variant="destructive" disabled={busy || reversing.reason.trim().length < 5} onClick={() => void run(async () => {
          await http.post(`${base}/receipts/${reversing.receipt.id}/reverse`, { date: reversing.date, reason: reversing.reason, version: reversing.receipt.version }); setReversing(null);
        }, "Receipt reversed; its invoices are open again.")}>Reverse receipt</Button><Button variant="outline" onClick={() => setReversing(null)}>Cancel</Button></div></div>}
      <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Number</th><th>Customer</th><th>Date</th><th>Method</th><th>Reference</th><th>Status</th><th className="gl-num">Amount</th><th className="gl-num">Unallocated</th><th /></tr></thead>
        <tbody>{receipts.map(r => <tr key={r.id}><td>{r.receiptNo}</td><td>{name(r.customerId)}</td><td>{day(r.receiptDate)}</td><td>{r.method}</td><td>{r.reference}</td>
          <td>{r.status === "Reversed" ? <Chip tone="muted">Reversed</Chip> : <Chip tone="ok">Posted</Chip>}</td><td className="gl-num">{money(r.amount)}</td><td className="gl-num">{money(r.status === "Reversed" ? 0 : r.amount - r.allocatedAmount)}</td>
          <td>{r.status === "Posted" && r.amount > r.allocatedAmount && canPrepare && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => { await http.post(`${base}/receipts/${r.id}/allocate`, { allocations: null, version: r.version }); }, "Allocated to open invoices.")}>Allocate</Button>}
            {r.status === "Posted" && canApprove && <Button size="sm" variant="ghost" onClick={() => setReversing({ receipt: r, reason: "", date: todayIso() })}>Reverse</Button>}</td></tr>)}
          {!receipts.length && <tr><td colSpan={9}>No receipts.</td></tr>}</tbody></table></div>
    </section>}

    {tab === "ageing" && <section className="gl-panel">
      <div className="gl-toolbar"><Field label="As at"><Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} /></Field>
        <Button variant="outline" disabled={!ageing} onClick={() => ageing && downloadCsv(`ar-ageing-${asOf}.csv`, ["Code", "Customer", "Current", "1-30", "31-60", "61-90", "Over 90", "On account", "Balance"],
          ageing.rows.map(r => [r.code, r.name, r.current, r.days1To30, r.days31To60, r.days61To90, r.over90, r.onAccount, r.balance]))}>Export</Button></div>
      {ageing && <>
        <div className="gl-metrics"><div><span>Customer balances</span><strong>{money(ageing.total)}</strong></div><div><span>Receivables control account</span><strong>{money(ageing.ledgerBalance)}</strong></div>
          <div><span>Difference</span><strong>{money(ageing.difference)}</strong></div></div>
        {ageing.difference !== 0 && <StateMessage tone="error">Customer balances and the receivables control account differ. Look for manual journals to the control account.</StateMessage>}
        <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Customer</th><th className="gl-num">Current</th><th className="gl-num">1–30</th><th className="gl-num">31–60</th><th className="gl-num">61–90</th><th className="gl-num">Over 90</th><th className="gl-num">On account</th><th className="gl-num">Balance</th></tr></thead>
          <tbody>{ageing.rows.map(r => <tr key={r.customerId}><td>{r.code} — {r.name}{r.onHold ? " (on hold)" : ""}</td><td className="gl-num">{money(r.current)}</td><td className="gl-num">{money(r.days1To30)}</td><td className="gl-num">{money(r.days31To60)}</td>
            <td className="gl-num">{money(r.days61To90)}</td><td className="gl-num">{money(r.over90)}</td><td className="gl-num">{money(r.onAccount)}</td><td className="gl-num">{money(r.balance)}</td></tr>)}
            {!ageing.rows.length && <tr><td colSpan={8}>No open balances.</td></tr>}</tbody></table></div>
      </>}
    </section>}
  </div>;
}
