import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import { financeApi, JOURNAL_TYPE_LABEL, MODULE_LABEL, SOURCE_LABEL, STATUS_LABEL, type Branch, type CostCenter, type JournalDetail } from "../api/financeApi";
import { amount, apiError, Chip, day, Field, GlDialog, money } from "./glShared";

/** One journal with its lines, where it came from, who prepared and posted it, and its reversal link. */
export function JournalDetailDialog({ companyId, journalId, branches, costCenters, canCreate, canPost, onClose, onChanged, onEdit, onOpen }: {
  companyId: string; journalId: string; branches: Branch[]; costCenters: CostCenter[]; canCreate: boolean; canPost: boolean;
  onClose: () => void; onChanged: () => void; onEdit: (j: JournalDetail) => void; onOpen: (id: string) => void;
}) {
  const [journal, setJournal] = useState<JournalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState("");
  const [reverseDate, setReverseDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let live = true;
    setJournal(null); setError(null);
    financeApi.journal(companyId, journalId).then((j) => { if (live) setJournal(j); }).catch((e) => { if (live) setError(apiError(e, "The journal could not be loaded.")); });
    return () => { live = false; };
  }, [companyId, journalId]);

  const branchName = (id?: string | null) => (id ? branches.find((b) => b.id === id)?.name ?? "Branch" : "Company level");
  const centerName = (id?: string | null) => (id ? costCenters.find((c) => c.id === id)?.code ?? "—" : "");

  async function act(action: () => Promise<JournalDetail | void>, fallback: string) {
    setBusy(true); setError(null);
    try {
      const result = await action();
      onChanged();
      if (result) { if (result.id !== journalId) onOpen(result.id); else setJournal(result); }
      return true;
    } catch (e) { setError(apiError(e, fallback)); return false; }
    finally { setBusy(false); }
  }

  const j = journal;
  const showBranch = !!j?.lines.some((l) => l.branchId && l.branchId !== j.branchId);
  const showCenter = !!j?.lines.some((l) => l.costCenterId);
  return (
    <>
      <GlDialog open size="wide" title={j ? `${j.entryNo ?? "Draft journal"} · ${day(j.entryDate)}` : "Journal"} confirmText="" closeText="Close" busy={busy} error={reversing || confirmDelete ? null : error} onClose={onClose}
        actions={j ? <>
              {j.status === "draft" && canCreate ? <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete draft</Button> : null}
              {j.status === "draft" && canCreate ? <Button type="button" variant="outline" disabled={busy} onClick={() => onEdit(j)}>Edit</Button> : null}
              {j.status === "draft" && canPost ? <Button type="button" disabled={busy} onClick={() => void act(() => financeApi.postJournal(companyId, j.id, j.version), "The journal could not be posted.")}>Post journal</Button> : null}
              {j.status === "posted" && canPost && !j.reversesEntryId && j.type !== "automatic" && j.type !== "yearEndClose"
                ? <Button type="button" variant="outline" disabled={busy} onClick={() => { setReason(""); setReverseDate(""); setReversing(true); }}>Reverse…</Button> : null}
        </> : null}>
        {!j && !error ? <StateMessage tone="loading">Loading journal…</StateMessage> : null}
        {j ? (
          <>
            <div className="gl-chip-row">
              <Chip tone={j.status === "draft" ? "warn" : j.status === "reversed" ? "muted" : "ok"}>{STATUS_LABEL[j.status]}</Chip>
              <Chip tone="info">{JOURNAL_TYPE_LABEL[j.type]}</Chip>

            </div>
            <p>{j.description}</p>
            <dl className="gl-detail">
              <div><dt>Period</dt><dd>{j.periodName ?? "—"}</dd></div>
              <div><dt>Branch</dt><dd>{branchName(j.branchId)}</dd></div>
              <div><dt>Reference</dt><dd>{j.reference ?? "—"}</dd></div>
              {j.sourceType ? <div><dt>Source</dt><dd>{MODULE_LABEL[j.sourceModule ?? ""] ? `${MODULE_LABEL[j.sourceModule ?? ""]} · ` : ""}{SOURCE_LABEL[j.sourceType] ?? j.sourceType} {j.sourceNo ?? ""}</dd></div> : null}
              <div><dt>Currency</dt><dd>{j.currencyCode}{j.exchangeRate !== 1 ? ` at ${j.exchangeRate}` : ""}</dd></div>
              {j.postingRuleVersion ? <div><dt>Posting rules</dt><dd>Version {j.postingRuleVersion}</dd></div> : null}
              <div><dt>Prepared by</dt><dd>{j.createdByName || (j.type === "automatic" ? "Automatic posting" : "—")}</dd></div>
              <div><dt>Posted by</dt><dd>{j.postedByName || j.postedBy || (j.postedAtUtc ? "User not recorded" : "—")}</dd></div>
              <div><dt>Posted at</dt><dd>{j.postedAtUtc ? formatAppDateTime(j.postedAtUtc) : "Not yet"}</dd></div>
              {j.reversesEntryId ? <div><dt>Reverses</dt><dd><Button type="button" variant="link" onClick={() => onOpen(j.reversesEntryId!)}>{j.reversesEntryNo}</Button></dd></div> : null}
              {j.reversedByEntryId ? <div><dt>Reversed by</dt><dd><Button type="button" variant="link" onClick={() => onOpen(j.reversedByEntryId!)}>{j.reversedByEntryNo}</Button></dd></div> : null}
              {j.reversalReason ? <div><dt>Reversal reason</dt><dd>{j.reversalReason}</dd></div> : null}
            </dl>
            <div className="gl-table-wrap">
              <table className="gl-table">
                <thead><tr><th>Account</th><th>Note</th>{showBranch ? <th>Branch</th> : null}{showCenter ? <th>Cost center</th> : null}<th className="gl-num">Debit</th><th className="gl-num">Credit</th></tr></thead>
                <tbody>
                  {j.lines.map((l) => (
                    <tr key={l.lineNo}>
                      <td><span className="gl-code">{l.accountCode}</span> {l.accountName}</td>
                      <td>{l.description ?? ""}</td>
                      {showBranch ? <td>{l.branchId && l.branchId !== j.branchId ? branchName(l.branchId) : ""}</td> : null}
                      {showCenter ? <td>{centerName(l.costCenterId)}</td> : null}
                      <td className="gl-num">{amount(l.debit)}</td>
                      <td className="gl-num">{amount(l.credit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={2 + (showBranch ? 1 : 0) + (showCenter ? 1 : 0)}>Total</td><td className="gl-num">{money(j.totalDebit)}</td><td className="gl-num">{money(j.totalCredit)}</td></tr></tfoot>
              </table>
            </div>
          </>
        ) : null}
      </GlDialog>
      <GlDialog open={reversing} title={`Reverse ${j?.entryNo ?? "journal"}`} confirmText="Post reversal" danger busy={busy} error={reversing ? error : null}
        confirmDisabled={reason.trim().length < 5} onClose={() => setReversing(false)}
        description="A new journal with every debit and credit swapped is posted and linked to this one. The original stays in the ledger unchanged."
        onConfirm={() => void act(() => financeApi.reverseJournal(companyId, j!.id, reason.trim(), reverseDate), "The journal could not be reversed.").then((ok) => { if (ok) setReversing(false); })}>
        <Field label="Reason" hint="Kept with both journals for the audit trail."><Input required value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></Field>
        <Field label="Reversal date" hint="Leave empty to use the original date. Use an open period if the original one is closed.">
          <Input type="date" value={reverseDate} onChange={(e) => setReverseDate(e.target.value)} />
        </Field>
      </GlDialog>
      <GlDialog open={confirmDelete} title="Delete this draft?" confirmText="Delete draft" danger busy={busy} error={confirmDelete ? error : null} onClose={() => setConfirmDelete(false)}
        description="The draft has never been posted, so deleting it leaves no trace in the ledger."
        onConfirm={() => void act(() => financeApi.deleteJournal(companyId, j!.id).then(() => undefined), "The draft could not be deleted.").then((ok) => { if (ok) { setConfirmDelete(false); onClose(); } })} />
    </>
  );
}
