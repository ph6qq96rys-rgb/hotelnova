import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useHasPermission } from "../../../auth/usePermissions";
import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPES, financeApi, type CostCenter, type GlAccount, type GlAccountInput } from "../api/financeApi";
import { apiError, Chip, Field, GlDialog } from "../components/glShared";
import { useFinanceRefs } from "../components/useFinanceRefs";

type Tab = "accounts" | "centers";
const emptyAccount: GlAccountInput = { code: "", name: "", type: "expense", parentId: null, isHeader: false, isActive: true, allowManualPosting: true, requiresCostCenter: false, description: "", accountCategory: "", cashFlowActivity: null };
const CATEGORIES = ["Cash", "Bank", "Clearing", "Receivables", "Inventory", "Tax", "Fixed assets", "Accumulated depreciation", "Payables", "Accrued liabilities", "Capital", "Retained earnings", "Sales", "Other income", "COGS", "Payroll", "Occupancy", "Operating", "Depreciation"];

/** Ordered as a tree: each header followed by its sub-accounts, with their depth. */
function tree(accounts: GlAccount[]) {
  const children = new Map<string | null, GlAccount[]>();
  for (const a of accounts) {
    const key = a.parentId && accounts.some((p) => p.id === a.parentId) ? a.parentId : null;
    children.set(key, [...(children.get(key) ?? []), a]);
  }
  const out: { account: GlAccount; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const a of (children.get(parent) ?? []).sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true }))) {
      out.push({ account: a, depth });
      walk(a.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export default function ChartOfAccountsPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const canManage = useHasPermission("finance.manage");
  const refs = useFinanceRefs(companyId);
  const [tab, setTab] = useState<Tab>("accounts");
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; input: GlAccountInput } | null>(null);
  const [center, setCenter] = useState<{ id: string | null; input: Omit<CostCenter, "id"> } | null>(null);
  const [deleting, setDeleting] = useState<GlAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = tree(refs.accounts);
    const q = filter.trim().toLowerCase();
    return all.filter(({ account: a }) => (!typeFilter || a.type === typeFilter) && (!q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)));
  }, [refs.accounts, filter, typeFilter]);
  const headers = refs.accounts.filter((a) => a.isHeader);

  async function run(action: () => Promise<unknown>, fallback: string, done?: () => void) {
    setBusy(true); setError(null);
    try { await action(); await refs.reload(); done?.(); }
    catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  const ledgerLink = (a: GlAccount) => navigate(`/companies/${companyId}/finance/trial-balance?account=${a.id}`);

  return (
    <div className="gl-page">
      <PageHeader title="Chart of Accounts" subtitle="This company's ledger accounts. Automatic postings use the posting rules mapped to these accounts, never fixed account numbers."
        actions={canManage ? (tab === "accounts"
          ? <Button onClick={() => { setError(null); setEditing({ id: null, input: { ...emptyAccount } }); }}><Plus size={16} /> New account</Button>
          : <Button onClick={() => { setError(null); setCenter({ id: null, input: { code: "", name: "", branchId: null, isActive: true } }); }}><Plus size={16} /> New cost center</Button>) : null} />
      <div className="gl-tabs" role="tablist">
        <Button role="tab" type="button" variant="ghost" className="gl-tab" aria-selected={tab === "accounts"} onClick={() => setTab("accounts")}>Accounts ({refs.accounts.length})</Button>
        <Button role="tab" type="button" variant="ghost" className="gl-tab" aria-selected={tab === "centers"} onClick={() => setTab("centers")}>Cost centers ({refs.costCenters.length})</Button>
      </div>
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {error && !editing && !center && !deleting ? <StateMessage tone="error">{error}</StateMessage> : null}

      {tab === "accounts" ? (
        <section className="gl-panel">
          {refs.loaded && refs.accounts.length === 0 ? (
            <div className="gl-note">
              <p>No accounts yet. Start from the standard hospitality chart — about 40 accounts with every posting rule already mapped — and adapt it, or add your own accounts one by one.</p>
              {canManage ? <Button disabled={busy} onClick={() => void run(async () => {
                const r = await financeApi.applyTemplate(companyId); setNotice(`Created ${r.created} accounts and mapped the posting rules.`);
              }, "The standard chart could not be created.")}>Use the standard chart</Button> : null}
            </div>
          ) : null}
          <div className="gl-toolbar">
            <Field label="Search"><Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Code or name" /></Field>
            <Field label="Type">
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All types</option>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>)}
              </Select>
            </Field>
          </div>
          <div className="gl-table-wrap gl-table-wrap--tall">
            <table className="gl-table">
              <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Category</th><th>Normal balance</th><th>Posting</th><th /></tr></thead>
              <tbody>
                {rows.map(({ account: a, depth }) => (
                  <tr key={a.id} className={a.isHeader ? "is-header" : a.isActive ? "" : "is-muted"}>
                    <td className="gl-code"><span className="gl-indent" style={{ width: depth * 16 }} />{a.code}</td>
                    <td>{a.name}{a.description ? <small>{a.description}</small> : null}</td>
                    <td>{ACCOUNT_TYPE_LABEL[a.type]}</td>
                    <td>{a.accountCategory ?? ""}</td>
                    <td>{a.normalBalance}</td>
                    <td>
                      <div className="gl-chip-row">
                        {a.isHeader ? <Chip tone="muted">Header</Chip> : a.allowManualPosting ? <Chip>Manual & automatic</Chip> : <Chip tone="info">Automatic only</Chip>}
                        {a.requiresCostCenter ? <Chip tone="info">Cost center</Chip> : null}
                        {!a.isActive ? <Chip tone="warn">Inactive</Chip> : null}
                      </div>
                    </td>
                    <td className="gl-actions">
                      {!a.isHeader ? <Button size="sm" variant="ghost" onClick={() => ledgerLink(a)}>Ledger</Button> : null}
                      {canManage ? <Button size="sm" variant="ghost" onClick={() => { setError(null); setEditing({ id: a.id, input: { code: a.code, name: a.name, type: a.type, parentId: a.parentId, isHeader: a.isHeader, isActive: a.isActive, allowManualPosting: a.allowManualPosting, requiresCostCenter: a.requiresCostCenter, description: a.description, accountCategory: a.accountCategory, cashFlowActivity: a.cashFlowActivity ?? null } }); }}>Edit</Button> : null}
                      {canManage && !a.hasPostings ? <Button size="sm" variant="ghost" onClick={() => { setError(null); setDeleting(a); }}>Delete</Button> : null}
                    </td>
                  </tr>
                ))}
                {refs.loaded && rows.length === 0 && refs.accounts.length > 0 ? <tr><td colSpan={7} className="gl-empty">No accounts match.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="gl-panel">
          <p className="gl-muted">Cost centers tag journal lines for departmental reporting. An account can require one on every line.</p>
          <div className="gl-table-wrap">
            <table className="gl-table">
              <thead><tr><th>Code</th><th>Name</th><th>Branch</th><th>Status</th><th /></tr></thead>
              <tbody>
                {refs.costCenters.map((c) => (
                  <tr key={c.id} className={c.isActive ? "" : "is-muted"}>
                    <td className="gl-code">{c.code}</td><td>{c.name}</td>
                    <td>{c.branchId ? refs.branches.find((b) => b.id === c.branchId)?.name ?? "Branch" : "All branches"}</td>
                    <td>{c.isActive ? <Chip tone="ok">Active</Chip> : <Chip tone="muted">Inactive</Chip>}</td>
                    <td className="gl-actions">{canManage ? <Button size="sm" variant="ghost" onClick={() => { setError(null); setCenter({ id: c.id, input: { ...c } }); }}>Edit</Button> : null}</td>
                  </tr>
                ))}
                {refs.loaded && refs.costCenters.length === 0 ? <tr><td colSpan={5} className="gl-empty">No cost centers yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing ? (
        <GlDialog open title={editing.id ? `Edit account ${editing.input.code}` : "New account"} confirmText="Save account" busy={busy} error={error} size="wide"
          onClose={() => setEditing(null)}
          onConfirm={() => void run(() => financeApi.saveAccount(companyId, editing.id, editing.input), "The account could not be saved.", () => setEditing(null))}>
          {(() => {
            const set = (patch: Partial<GlAccountInput>) => setEditing({ ...editing, input: { ...editing.input, ...patch } });
            const used = refs.accounts.find((a) => a.id === editing.id)?.hasPostings;
            return (
              <div className="gl-grid">
                <Field label="Code"><Input required maxLength={30} value={editing.input.code} onChange={(e) => set({ code: e.target.value })} /></Field>
                <Field label="Name"><Input required maxLength={200} value={editing.input.name} onChange={(e) => set({ name: e.target.value })} /></Field>
                <Field label="Type" hint={used ? "Fixed: the account already has postings." : undefined}>
                  <Select value={editing.input.type} disabled={!!used} onChange={(e) => set({ type: e.target.value as GlAccountInput["type"], parentId: null })}>
                    {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>)}
                  </Select>
                </Field>
                <Field label="Parent (header)">
                  <Select value={editing.input.parentId ?? ""} onChange={(e) => set({ parentId: e.target.value || null })}>
                    <option value="">Top level</option>
                    {headers.filter((h) => h.type === editing.input.type && h.id !== editing.id).map((h) => <option key={h.id} value={h.id}>{h.code} — {h.name}</option>)}
                  </Select>
                </Field>
                <Field label="Category" hint="For reporting: Cash, Bank, Payables, COGS…">
                  <Input list="gl-categories" maxLength={50} value={editing.input.accountCategory ?? ""} onChange={(e) => set({ accountCategory: e.target.value })} />
                </Field>
                <datalist id="gl-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
                <Field label="Cash-flow section" hint="Where cash paid or received against this account appears in the cash-flow statement.">
                  <Select value={editing.input.cashFlowActivity ?? ""} onChange={(e) => set({ cashFlowActivity: (e.target.value || null) as GlAccountInput["cashFlowActivity"] })}>
                    <option value="">Automatic{editing.id ? ` (${refs.accounts.find((x) => x.id === editing.id)?.defaultCashFlowActivity ?? "Operating"})` : ""}</option>
                    <option value="Operating">Operating</option>
                    <option value="Investing">Investing</option>
                    <option value="Financing">Financing</option>
                  </Select>
                </Field>
                <Field label="Description" wide><Input maxLength={500} value={editing.input.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
                <label className="gl-check"><Checkbox checked={editing.input.isHeader} disabled={!!used} onChange={(e) => set({ isHeader: e.target.checked })} /> Header (groups accounts, never posted to)</label>
                <label className="gl-check"><Checkbox checked={editing.input.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Active</label>
                <label className="gl-check"><Checkbox checked={editing.input.allowManualPosting} onChange={(e) => set({ allowManualPosting: e.target.checked })} /> Allow manual journals</label>
                <label className="gl-check"><Checkbox checked={editing.input.requiresCostCenter} onChange={(e) => set({ requiresCostCenter: e.target.checked })} /> Require a cost center</label>
              </div>
            );
          })()}
          <p className="gl-muted">Control accounts such as payables, goods received not invoiced and inventory should only receive automatic postings, so they always agree with their subledgers. Allow manual journals temporarily to enter opening balances.</p>
        </GlDialog>
      ) : null}

      {center ? (
        <GlDialog open title={center.id ? `Edit cost center ${center.input.code}` : "New cost center"} confirmText="Save" busy={busy} error={error}
          onClose={() => setCenter(null)}
          onConfirm={() => void run(() => financeApi.saveCostCenter(companyId, center.id, center.input), "The cost center could not be saved.", () => setCenter(null))}>
          <div className="gl-grid">
            <Field label="Code"><Input required maxLength={30} value={center.input.code} onChange={(e) => setCenter({ ...center, input: { ...center.input, code: e.target.value } })} /></Field>
            <Field label="Name"><Input required maxLength={160} value={center.input.name} onChange={(e) => setCenter({ ...center, input: { ...center.input, name: e.target.value } })} /></Field>
            <Field label="Branch">
              <Select value={center.input.branchId ?? ""} onChange={(e) => setCenter({ ...center, input: { ...center.input, branchId: e.target.value || null } })}>
                <option value="">All branches</option>
                {refs.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <label className="gl-check"><Checkbox checked={center.input.isActive} onChange={(e) => setCenter({ ...center, input: { ...center.input, isActive: e.target.checked } })} /> Active</label>
          </div>
        </GlDialog>
      ) : null}

      <GlDialog open={!!deleting} title={`Delete account ${deleting?.code ?? ""}?`} confirmText="Delete account" danger busy={busy} error={error}
        description="Only accounts without postings, sub-accounts or posting rules can be deleted. Accounts with history can be made inactive instead."
        onClose={() => setDeleting(null)}
        onConfirm={() => void run(() => financeApi.deleteAccount(companyId, deleting!.id), "The account could not be deleted.", () => setDeleting(null))} />
    </div>
  );
}
