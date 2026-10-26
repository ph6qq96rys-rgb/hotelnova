import { useCallback, useEffect, useState } from "react";
import { Download, Eye, Play, RotateCcw } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import { fixedAssetsApi, type DepreciationPreview, type DepreciationRun, type JournalLine } from "../api/fixedAssetsApi";
import { apiError, downloadCsv, FaDialog, Field, METHOD_LABEL, money } from "./faShared";

const monthInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const previousMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return monthInput(d); };

/**
 * Monthly depreciation: preview what a run would post for every asset up to a month,
 * post it, and keep the history of runs with their journal and a reversal for the latest one.
 */
export function DepreciationPanel({ companyId, onPosted }: { companyId: string; onPosted: (message: string) => void }) {
  const { tx } = useI18n();
  const canPost = useHasPermission("fixedassets.depreciate");
  const [period, setPeriod] = useState(previousMonth());
  const [preview, setPreview] = useState<DepreciationPreview | null>(null);
  const [runs, setRuns] = useState<DepreciationRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmPost, setConfirmPost] = useState(false);
  const [notes, setNotes] = useState("");
  const [reverse, setReverse] = useState<DepreciationRun | null>(null);
  const [reason, setReason] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [journal, setJournal] = useState<{ run: DepreciationRun; lines: JournalLine[] } | null>(null);

  const loadRuns = useCallback(async () => {
    try { setRuns(await fixedAssetsApi.runs(companyId)); }
    catch (err) { setError(apiError(err, tx("Depreciation runs could not be loaded."))); }
  }, [companyId, tx]);

  useEffect(() => { void loadRuns(); }, [loadRuns]);

  const runPreview = async () => {
    setBusy(true); setError(null); setNotice(null);
    try { setPreview(await fixedAssetsApi.previewDepreciation(companyId, period)); }
    catch (err) { setPreview(null); setError(apiError(err, tx("The preview could not be calculated."))); }
    finally { setBusy(false); }
  };

  const post = async () => {
    setBusy(true); setDialogError(null);
    try {
      const result = await fixedAssetsApi.postDepreciation(companyId, period, notes);
      setConfirmPost(false); setNotes(""); setPreview(null);
      const message = tx("Depreciation posted up to {period}: {amount} for {count} asset(s).", { period: result.period, amount: money(result.totalAmount), count: result.assetCount });
      setNotice(message);
      onPosted(message);
      await loadRuns();
    } catch (err) {
      setDialogError(apiError(err, tx("Depreciation could not be posted.")));
    } finally { setBusy(false); }
  };

  const doReverse = async () => {
    if (!reverse) return;
    setBusy(true); setDialogError(null);
    try {
      await fixedAssetsApi.reverseRun(companyId, reverse.id, reason.trim());
      const message = tx("Run for {period} reversed.", { period: reverse.period });
      setReverse(null); setReason(""); setNotice(message); setPreview(null);
      onPosted(message);
      await loadRuns();
    } catch (err) {
      setDialogError(apiError(err, tx("The run could not be reversed.")));
    } finally { setBusy(false); }
  };

  const openJournal = async (run: DepreciationRun) => {
    setError(null);
    try { setJournal({ run, lines: await fixedAssetsApi.journal(companyId, run.id) }); }
    catch (err) { setError(apiError(err, tx("The journal could not be loaded."))); }
  };

  const exportJournal = () => {
    if (!journal) return;
    downloadCsv(`depreciation-journal-${journal.run.period}.csv`,
      ["Period", "Category", "Branch", "Debit account (expense)", "Credit account (accumulated)", "Assets", "Amount"],
      journal.lines.map((l) => [journal.run.period, l.categoryName, l.branchName ?? "", l.expenseAccountCode ?? "", l.accumulatedAccountCode ?? "", l.assetCount, l.amount.toFixed(2)]));
  };

  return (
    <div className="fa-stack">
      <section className="fa-panel">
        <header className="fa-panel-head">
          <div>
            <h2>{tx("Run depreciation")}</h2>
            <p className="fa-muted">{tx("Posts monthly depreciation for every asset in service, from its in-service month up to the month you choose. Months already posted are skipped, so a missed month is caught up automatically.")}</p>
          </div>
        </header>
        <div className="fa-toolbar">
          <Field label={tx("Up to and including")}>
            <Input type="month" value={period} max={monthInput(new Date())} onChange={(e) => { setPeriod(e.target.value); setPreview(null); }} />
          </Field>
          <Button type="button" variant="outline" disabled={busy || !period} onClick={() => void runPreview()}><Eye size={15} aria-hidden="true" /> {tx("Preview")}</Button>
          {canPost ? (
            <Button type="button" disabled={busy || !preview || preview.entryCount === 0} onClick={() => { setDialogError(null); setConfirmPost(true); }}>
              <Play size={15} aria-hidden="true" /> {tx("Post depreciation")}
            </Button>
          ) : <span className="fa-muted">{tx("Posting needs the Post Fixed Asset Depreciation permission.")}</span>}
        </div>
        {error ? <StateMessage tone="error">{error}</StateMessage> : null}
        {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}

        {preview ? (
          <>
            <div className="fa-metrics fa-metrics--compact">
              <div><span>{tx("Assets")}</span><strong>{preview.assetCount}</strong></div>
              <div><span>{tx("Monthly entries")}</span><strong>{preview.entryCount}</strong></div>
              <div><span>{tx("Total depreciation")}</span><strong>{money(preview.totalAmount)}</strong></div>
              <div><span>{tx("Skipped")}</span><strong>{preview.skipped.length}</strong></div>
            </div>
            {preview.lines.length === 0 ? <p className="fa-muted">{tx("Nothing to post up to {period}: every asset is already depreciated for these months.", { period: preview.period })}</p> : (
              <div className="fa-table-wrap">
                <table className="ui-table fa-table">
                  <thead><tr>
                    <th>{tx("Asset")}</th><th>{tx("Category")}</th><th>{tx("Months")}</th><th>{tx("Method")}</th>
                    <th className="fa-num">{tx("Opening")}</th><th className="fa-num">{tx("Depreciation")}</th><th className="fa-num">{tx("Closing")}</th>
                  </tr></thead>
                  <tbody>
                    {preview.lines.map((l) => (
                      <tr key={l.fixedAssetId}>
                        <td><strong>{l.assetNo}</strong><span>{l.name}</span></td>
                        <td>{l.categoryName}<span>{l.branchName ?? ""}</span></td>
                        <td>{l.fromPeriod === l.toPeriod ? l.toPeriod : `${l.fromPeriod} → ${l.toPeriod}`}<span>{tx("{n} month(s)", { n: l.months })}</span></td>
                        <td>{tx(METHOD_LABEL[l.method])}</td>
                        <td className="fa-num">{money(l.openingBookValue)}</td>
                        <td className="fa-num">{money(l.amount)}</td>
                        <td className="fa-num">{money(l.closingBookValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {preview.skipped.length ? (
              <details className="fa-details">
                <summary>{tx("{n} asset(s) skipped", { n: preview.skipped.length })}</summary>
                <ul>{preview.skipped.map((s) => <li key={s.fixedAssetId}><strong>{s.assetNo}</strong> {s.name}: {tx(s.reason)}</li>)}</ul>
              </details>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="fa-panel">
        <header className="fa-panel-head"><h2>{tx("Posted runs")}</h2></header>
        {runs.length === 0 ? <p className="fa-muted">{tx("No depreciation has been posted yet.")}</p> : (
          <div className="fa-table-wrap">
            <table className="ui-table fa-table">
              <thead><tr>
                <th>{tx("Up to")}</th><th>{tx("Posted")}</th><th className="fa-num">{tx("Assets")}</th><th className="fa-num">{tx("Amount")}</th><th>{tx("Status")}</th><th />
              </tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className={r.isReversed ? "is-reversed" : ""}>
                    <td><strong>{r.period}</strong>{r.notes ? <span>{r.notes}</span> : null}</td>
                    <td>{formatAppDateTime(r.runAtUtc)}<span>{r.runByName}</span></td>
                    <td className="fa-num">{r.assetCount}</td>
                    <td className="fa-num">{money(r.totalAmount)}</td>
                    <td>{r.isReversed ? <>{tx("Reversed")}<span>{r.reversedByName} · {r.reversalReason}</span></> : tx("Posted")}</td>
                    <td className="fa-row-actions">
                      {!r.isReversed ? <Button type="button" size="sm" variant="outline" onClick={() => void openJournal(r)}>{tx("Journal")}</Button> : null}
                      {r.canReverse && canPost ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setDialogError(null); setReason(""); setReverse(r); }}>
                          <RotateCcw size={14} aria-hidden="true" /> {tx("Reverse")}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {journal ? (
        <section className="fa-panel">
          <header className="fa-panel-head">
            <div>
              <h2>{tx("Journal for {period}", { period: journal.run.period })}</h2>
              <p className="fa-muted">{tx("Debit depreciation expense, credit accumulated depreciation, by category and branch. Set the account codes on each category.")}</p>
            </div>
            <div className="fa-toolbar">
              <Button type="button" size="sm" variant="outline" onClick={exportJournal}><Download size={14} aria-hidden="true" /> {tx("Export CSV")}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setJournal(null)}>{tx("Close")}</Button>
            </div>
          </header>
          <div className="fa-table-wrap">
            <table className="ui-table fa-table">
              <thead><tr><th>{tx("Category")}</th><th>{tx("Branch")}</th><th>{tx("Debit (expense)")}</th><th>{tx("Credit (accumulated)")}</th><th className="fa-num">{tx("Assets")}</th><th className="fa-num">{tx("Amount")}</th></tr></thead>
              <tbody>
                {journal.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.categoryName}</td><td>{l.branchName ?? "—"}</td>
                    <td>{l.expenseAccountCode ?? <span className="fa-warn-text">{tx("not set")}</span>}</td>
                    <td>{l.accumulatedAccountCode ?? <span className="fa-warn-text">{tx("not set")}</span>}</td>
                    <td className="fa-num">{l.assetCount}</td><td className="fa-num">{money(l.amount)}</td>
                  </tr>
                ))}
                <tr className="fa-total"><td colSpan={5}>{tx("Total")}</td><td className="fa-num">{money(journal.lines.reduce((s, l) => s + l.amount, 0))}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <FaDialog open={confirmPost} busy={busy} error={dialogError} title={tx("Post depreciation up to {period}", { period })}
        description={preview ? tx("{amount} for {count} asset(s) in {entries} monthly entries. Book values update immediately; only the latest run can be reversed.", { amount: money(preview.totalAmount), count: preview.assetCount, entries: preview.entryCount }) : undefined}
        confirmText={tx("Post")} onClose={() => setConfirmPost(false)} onConfirm={() => void post()}>
        <Field label={tx("Notes (optional)")} wide><Textarea rows={2} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} /></Field>
      </FaDialog>

      <FaDialog open={!!reverse} danger busy={busy} error={dialogError} title={tx("Reverse run for {period}", { period: reverse?.period ?? "" })}
        description={tx("Removes every entry of this run and restores the book values. Not possible if an asset in it was retired or disposed since.")}
        confirmText={tx("Reverse run")} confirmDisabled={!reason.trim()} onClose={() => setReverse(null)} onConfirm={() => void doReverse()}>
        <Field label={tx("Reason")} wide><Textarea rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></Field>
      </FaDialog>
    </div>
  );
}
