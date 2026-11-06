import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { financeApi, type Branch, type CostCenter, type GlAccount, type JournalDetail, type JournalDraftInput } from "../api/financeApi";
import { AccountSelect, apiError, Field, GlDialog, money, todayIso } from "./glShared";

type Line = { key: number; accountId: string; debit: string; credit: string; costCenterId: string; description: string };
let nextKey = 1;
const blank = (): Line => ({ key: nextKey++, accountId: "", debit: "", credit: "", costCenterId: "", description: "" });
const num = (v: string) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };

/** Prepare or correct a manual journal draft. Posting happens separately, by another person. */
export function JournalEditor({ companyId, journal, accounts, costCenters, branches, defaultBranchId, onClose, onSaved }: {
  companyId: string; journal: JournalDetail | null; accounts: GlAccount[]; costCenters: CostCenter[]; branches: Branch[];
  defaultBranchId?: string | null; onClose: () => void; onSaved: (j: JournalDetail) => void;
}) {
  const [entryDate, setEntryDate] = useState(journal?.entryDate ?? todayIso());
  const [branchId, setBranchId] = useState(journal?.branchId ?? defaultBranchId ?? "");
  const [description, setDescription] = useState(journal?.description ?? "");
  const [reference, setReference] = useState(journal?.reference ?? "");
  const [type, setType] = useState<"manual" | "adjustment" | "openingBalance">(journal?.type === "adjustment" || journal?.type === "openingBalance" ? journal.type : "manual");
  const [lines, setLines] = useState<Line[]>(() => journal?.lines.length
    ? journal.lines.map((l) => ({ key: nextKey++, accountId: l.accountId, debit: l.debit ? String(l.debit) : "", credit: l.credit ? String(l.credit) : "",
        costCenterId: l.costCenterId ?? "", description: l.description ?? "" }))
    : [blank(), blank()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debit = useMemo(() => lines.reduce((s, l) => s + num(l.debit), 0), [lines]);
  const credit = useMemo(() => lines.reduce((s, l) => s + num(l.credit), 0), [lines]);
  const difference = Math.round((debit - credit) * 100) / 100;
  const needsCenter = (accountId: string) => accounts.find((a) => a.id === accountId)?.requiresCostCenter ?? false;
  const update = (key: number, patch: Partial<Line>) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function save() {
    setError(null);
    const used = lines.filter((l) => l.accountId || num(l.debit) || num(l.credit));
    if (used.some((l) => !l.accountId)) { setError("Choose an account on every line with an amount."); return; }
    if (used.some((l) => num(l.debit) > 0 && num(l.credit) > 0)) { setError("A line carries either a debit or a credit, not both."); return; }
    const input: JournalDraftInput = {
      entryDate, branchId: branchId || null, description, reference: reference || null, type, version: journal?.version ?? null,
      lines: used.map((l) => ({ accountId: l.accountId, debit: num(l.debit), credit: num(l.credit), costCenterId: l.costCenterId || null, description: l.description || null })),
    };
    setBusy(true);
    try { onSaved(await financeApi.saveJournal(companyId, journal?.id ?? null, input)); }
    catch (e) { setError(apiError(e, "The journal could not be saved.")); }
    finally { setBusy(false); }
  }

  return (
    <GlDialog open size="full" title={journal ? `Edit draft journal` : "New manual journal"} confirmText="Save draft" busy={busy} error={error}
      onClose={onClose} onConfirm={() => void save()}
      description="Drafts can be saved unbalanced. Posting needs equal debits and credits, an open period, and a second person when your company requires it.">
      <div className="gl-grid">
        <Field label="Date"><Input type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as "manual" | "adjustment" | "openingBalance")}>
            <option value="manual">Manual journal</option>
            <option value="adjustment">Adjusting entry</option>
            <option value="openingBalance">Opening balance (on or before the posting start date; may use control accounts)</option>
          </Select>
        </Field>
        <Field label="Branch">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Company level</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Reference"><Input value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} placeholder="Voucher or document no." /></Field>
        <Field label="Description" wide><Input required value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="What this journal records" /></Field>
      </div>
      <div className="gl-table-wrap">
        <table className="gl-table gl-table--lines">
          <thead><tr><th>#</th><th className="gl-col-account">Account</th><th className="gl-num">Debit</th><th className="gl-num">Credit</th><th>Cost center</th><th>Line note</th><th /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.key}>
                <td>{i + 1}</td>
                <td><AccountSelect accounts={accounts} manualOnly value={l.accountId} ariaLabel={`Account, line ${i + 1}`} onChange={(id) => update(l.key, { accountId: id })} /></td>
                <td><Input aria-label={`Debit, line ${i + 1}`} inputMode="decimal" type="number" min="0" step="0.01" value={l.debit}
                  onChange={(e) => update(l.key, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} /></td>
                <td><Input aria-label={`Credit, line ${i + 1}`} inputMode="decimal" type="number" min="0" step="0.01" value={l.credit}
                  onChange={(e) => update(l.key, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} /></td>
                <td>
                  <Select aria-label={`Cost center, line ${i + 1}`} value={l.costCenterId} required={needsCenter(l.accountId)} onChange={(e) => update(l.key, { costCenterId: e.target.value })}>
                    <option value="">{needsCenter(l.accountId) ? "Required" : "None"}</option>
                    {costCenters.filter((c) => c.isActive || c.id === l.costCenterId).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                  </Select>
                </td>
                <td><Input aria-label={`Note, line ${i + 1}`} value={l.description} maxLength={300} onChange={(e) => update(l.key, { description: e.target.value })} /></td>
                <td className="gl-actions">
                  <Button type="button" variant="ghost" size="sm" aria-label={`Remove line ${i + 1}`} disabled={lines.length <= 2}
                    onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))}><Trash2 size={16} /></Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((all) => [...all, blank()])}><Plus size={16} /> Add line</Button>
              </td>
              <td className="gl-num">{money(debit)}</td>
              <td className="gl-num">{money(credit)}</td>
              <td colSpan={3} aria-live="polite">
                {difference === 0 && debit > 0 ? <span className="gl-balanced">Balanced</span>
                  : debit + credit > 0 ? <span className="gl-diff">Out of balance by {money(Math.abs(difference))}</span> : null}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </GlDialog>
  );
}
