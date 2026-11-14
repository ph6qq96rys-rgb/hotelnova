import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { http } from "../../../api/http";
import { useAuth } from "../../../auth/AuthProvider";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { StateMessage } from "../../../components/ui/Feedback";
import { apiError, Chip, Field, money, todayIso } from "../components/glShared";

type BankAccount = { id?: string | null; glAccountId: string; code: string; name: string; bankName?: string | null; accountNumber?: string | null;
  branchName?: string | null; currency?: string | null; swiftCode?: string | null; signatories?: string | null; isActive: boolean;
  ledgerBalance: number; reconciledTo?: string | null; version?: string | null };
type Details = { glAccountId: string; bankName: string; accountNumber: string; branchName: string; currency: string; swiftCode: string; signatories: string; isActive: boolean; version?: string | null };

/** Bank and cash accounts with their bank details and balances, and transfers between them (cash banked, bank to bank, petty cash). */
export default function BankAccountsPage() {
  const { companyId = "" } = useParams(); const { hasPermission } = useAuth();
  const base = `/companies/${companyId}/finance`;
  const [accounts, setAccounts] = useState<BankAccount[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Details | null>(null);
  const [transfer, setTransfer] = useState({ fromAccountId: "", toAccountId: "", date: todayIso(), amount: "", fee: "", reference: "", description: "" });
  const load = useCallback(async () => setAccounts((await http.get<BankAccount[]>(`${base}/bank-accounts`)).data), [base]);
  useEffect(() => { void load().catch(e => setError(apiError(e, "Could not load bank accounts."))); }, [load]);
  async function run(work: () => Promise<void>, done: string) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); await load(); setNotice(done); } catch (e) { setError(apiError(e, "The change could not be saved.")); } finally { setBusy(false); }
  }
  const banks = accounts.filter(a => a.bankName !== undefined);

  return <div className="gl-page">
    <PageHeader title="Bank accounts & transfers" subtitle="Bank details of each bank account, balances and last reconciliation, and transfers between cash and bank."
      actions={<Link className="gl-link-button" to={`${base}/bank-reconciliation`}>Bank reconciliation</Link>} />
    {error && <StateMessage tone="error">{error}</StateMessage>}
    {notice && <StateMessage tone="success">{notice}</StateMessage>}
    <section className="gl-panel">
      <h2>Accounts</h2>
      <div className="gl-table-wrap"><table className="gl-table"><thead><tr><th>Account</th><th>Bank</th><th>Account number</th><th>Currency</th><th className="gl-num">Ledger balance</th><th>Reconciled to</th><th /></tr></thead>
        <tbody>{banks.map(a => <tr key={a.glAccountId}><td>{a.code} — {a.name}</td><td>{a.bankName ?? <Chip tone="muted">Cash / no details</Chip>}{a.branchName ? ` · ${a.branchName}` : ""}</td>
          <td>{a.accountNumber ?? ""}</td><td>{a.currency ?? ""}</td><td className="gl-num">{money(a.ledgerBalance)}</td><td>{a.reconciledTo ?? <Chip tone="warn">Never</Chip>}</td>
          <td>{hasPermission("finance.manage") && <Button size="sm" variant="ghost" onClick={() => setEditing({ glAccountId: a.glAccountId, bankName: a.bankName ?? "", accountNumber: a.accountNumber ?? "",
            branchName: a.branchName ?? "", currency: a.currency ?? "", swiftCode: a.swiftCode ?? "", signatories: a.signatories ?? "", isActive: a.isActive, version: a.version })}>Bank details</Button>}</td></tr>)}
          {!banks.length && <tr><td colSpan={7}>No accounts with category Bank or Cash in the chart of accounts.</td></tr>}</tbody></table></div>
      {editing && <div className="gl-panel"><h3>Bank details · {accounts.find(a => a.glAccountId === editing.glAccountId)?.name}</h3><div className="gl-toolbar">
        <Field label="Bank"><Input value={editing.bankName} maxLength={120} onChange={e => setEditing({ ...editing, bankName: e.target.value })} /></Field>
        <Field label="Account number"><Input value={editing.accountNumber} maxLength={60} onChange={e => setEditing({ ...editing, accountNumber: e.target.value })} /></Field>
        <Field label="Bank branch"><Input value={editing.branchName} maxLength={120} onChange={e => setEditing({ ...editing, branchName: e.target.value })} /></Field>
        <Field label="Currency" hint="Empty uses the company currency."><Input value={editing.currency} maxLength={3} onChange={e => setEditing({ ...editing, currency: e.target.value.toUpperCase() })} /></Field>
        <Field label="SWIFT / BIC"><Input value={editing.swiftCode} maxLength={20} onChange={e => setEditing({ ...editing, swiftCode: e.target.value })} /></Field>
        <Field label="Signatories" wide><Input value={editing.signatories} maxLength={500} onChange={e => setEditing({ ...editing, signatories: e.target.value })} /></Field>
        <label className="gl-check"><Checkbox checked={editing.isActive} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} /> In use</label>
      </div>
        <Button disabled={busy || !editing.bankName.trim() || !editing.accountNumber.trim()} onClick={() => void run(async () => { await http.put(`${base}/bank-accounts`, editing); setEditing(null); }, "Bank details saved.")}>Save</Button>{" "}
        <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div>}
    </section>

    {hasPermission("finance.journals.create") && <section className="gl-panel">
      <h2>Transfer between accounts</h2>
      <p>Cash banked, bank to bank, or a petty cash top-up. The transfer is saved as a draft journal; another finance user posts it from Journals.</p>
      <div className="gl-toolbar">
        <Field label="From"><Select value={transfer.fromAccountId} onChange={e => setTransfer({ ...transfer, fromAccountId: e.target.value })}><option value="">Select account</option>{banks.map(a => <option key={a.glAccountId} value={a.glAccountId}>{a.code} — {a.name} ({money(a.ledgerBalance)})</option>)}</Select></Field>
        <Field label="To"><Select value={transfer.toAccountId} onChange={e => setTransfer({ ...transfer, toAccountId: e.target.value })}><option value="">Select account</option>{banks.filter(a => a.glAccountId !== transfer.fromAccountId).map(a => <option key={a.glAccountId} value={a.glAccountId}>{a.code} — {a.name}</option>)}</Select></Field>
        <Field label="Date"><Input type="date" value={transfer.date} onChange={e => setTransfer({ ...transfer, date: e.target.value })} /></Field>
        <Field label="Amount"><Input type="number" step="0.01" min={0} value={transfer.amount} onChange={e => setTransfer({ ...transfer, amount: e.target.value })} /></Field>
        <Field label="Bank fee (optional)"><Input type="number" step="0.01" min={0} value={transfer.fee} onChange={e => setTransfer({ ...transfer, fee: e.target.value })} /></Field>
        <Field label="Reference"><Input value={transfer.reference} maxLength={60} onChange={e => setTransfer({ ...transfer, reference: e.target.value })} placeholder="Deposit slip or transfer no." /></Field>
        <Field label="Description" wide><Input value={transfer.description} maxLength={300} onChange={e => setTransfer({ ...transfer, description: e.target.value })} /></Field>
      </div>
      <Button disabled={busy || !transfer.fromAccountId || !transfer.toAccountId || !(Number(transfer.amount) > 0) || !transfer.reference.trim()} onClick={() => void run(async () => {
        await http.post(`${base}/bank-transfers`, { ...transfer, amount: Number(transfer.amount), fee: Number(transfer.fee || 0), description: transfer.description || null });
        setTransfer({ ...transfer, amount: "", fee: "", reference: "", description: "" });
      }, "Draft transfer journal created. Another finance user posts it from Journals.")}>Create transfer</Button>
    </section>}
  </div>;
}
