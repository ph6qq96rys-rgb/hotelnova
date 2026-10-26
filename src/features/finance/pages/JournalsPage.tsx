import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { resolveBranchId } from "../../../api/http";
import { useHasPermission } from "../../../auth/usePermissions";
import { financeApi, JOURNAL_TYPE_LABEL, SOURCE_LABEL, STATUS_LABEL, type JournalDetail, type JournalListItem } from "../api/financeApi";
import { apiError, Chip, day, Field, money } from "../components/glShared";
import { JournalDetailDialog } from "../components/JournalDetailDialog";
import { JournalEditor } from "../components/JournalEditor";
import { useFinanceRefs } from "../components/useFinanceRefs";

const PAGE_SIZE = 50;

/** Every journal in the ledger — automatic and manual — with drafts waiting to be posted. */
export default function JournalsPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const [params, setParams] = useSearchParams();
  const canCreate = useHasPermission("finance.journals.create");
  const canPost = useHasPermission("finance.approve");
  const refs = useFinanceRefs(companyId);
  const [rows, setRows] = useState<JournalListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [type, setType] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<JournalDetail | "new" | null>(null);
  const openId = params.get("journal");
  const accountId = params.get("account") ?? undefined;

  const open = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set("journal", id); else p.delete("journal");
    setParams(p, { replace: true });
  };

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true); setError(null);
    try {
      const data = await financeApi.journals(companyId, {
        from: from || undefined, to: to || undefined, status: status || undefined, type: type || undefined,
        sourceType: sourceType || undefined, search: search.trim() || undefined, accountId, page, pageSize: PAGE_SIZE,
      });
      setRows(data.items); setTotal(data.total);
    } catch (e) { setError(apiError(e, "Journals could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId, from, to, status, type, sourceType, search, accountId, page]);

  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const accountName = accountId ? refs.accounts.find((a) => a.id === accountId) : undefined;

  return (
    <div className="gl-page">
      <PageHeader title="General Ledger & Journals" subtitle="Every posting in the general ledger. Automatic journals come from goods receipts, supplier invoices and payments, and closed POS drawers."
        actions={<>
          <Button variant="outline" onClick={() => void load()} aria-label="Refresh"><RefreshCw size={16} /></Button>
          {canCreate ? <Button onClick={() => setEditing("new")} disabled={!refs.loaded || refs.accounts.length === 0}><Plus size={16} /> New journal</Button> : null}
        </>} />
      {refs.loaded && refs.accounts.length === 0
        ? <StateMessage tone="warning">This company has no chart of accounts yet. Set one up under Chart of Accounts before entering journals.</StateMessage> : null}
      {accountName ? (
        <p className="gl-note">Showing journals that touch {accountName.code} {accountName.name}.{" "}
          <Button variant="link" onClick={() => { const p = new URLSearchParams(params); p.delete("account"); setParams(p, { replace: true }); }}>Show all</Button></p>
      ) : null}
      <section className="gl-panel">
        <div className="gl-toolbar">
          <Field label="Search"><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Number, description, document" /></Field>
          <Field label="From"><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option><option value="draft">Drafts</option><option value="posted">Posted</option><option value="reversed">Reversed</option>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {Object.entries(JOURNAL_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Source">
            <Select value={sourceType} onChange={(e) => { setSourceType(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
        </div>
        {error ? <StateMessage tone="error">{error}</StateMessage> : null}
        <div className="gl-table-wrap">
          <table className="gl-table">
            <thead><tr><th>Number</th><th>Date</th><th>Description</th><th>Source</th><th>Type</th><th>Status</th><th className="gl-num">Amount</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.isReversed ? "gl-row is-muted" : "gl-row"} tabIndex={0} onClick={() => open(r.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(r.id); } }}>
                  <td className="gl-code">{r.entryNo ?? "—"}</td>
                  <td>{day(r.entryDate)}</td>
                  <td>{r.description}{r.reference ? <small>{r.reference}</small> : null}</td>
                  <td>{r.sourceType ? <>{SOURCE_LABEL[r.sourceType] ?? r.sourceType}<small>{r.sourceNo}</small></> : "—"}</td>
                  <td>{JOURNAL_TYPE_LABEL[r.type]}</td>
                  <td>
                    <div className="gl-chip-row">
                      <Chip tone={r.status === "draft" ? "warn" : r.status === "reversed" ? "muted" : "ok"}>{STATUS_LABEL[r.status]}</Chip>
                    </div>
                  </td>
                  <td className="gl-num">{money(r.totalDebit)}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? <tr><td colSpan={7} className="gl-empty">No journals match these filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="gl-pager">
          <span className="gl-muted">{total} journal{total === 1 ? "" : "s"}</span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="gl-muted">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </section>
      {openId ? (
        <JournalDetailDialog companyId={companyId} journalId={openId} branches={refs.branches} costCenters={refs.costCenters} canCreate={canCreate} canPost={canPost}
          onClose={() => open(null)} onChanged={() => void load()} onOpen={(id) => open(id)} onEdit={(j) => { open(null); setEditing(j); }} />
      ) : null}
      {editing ? (
        <JournalEditor companyId={companyId} journal={editing === "new" ? null : editing} accounts={refs.accounts} costCenters={refs.costCenters} branches={refs.branches}
          defaultBranchId={resolveBranchId()} onClose={() => setEditing(null)}
          onSaved={(j) => { setEditing(null); void load(); open(j.id); }} />
      ) : null}
    </div>
  );
}
