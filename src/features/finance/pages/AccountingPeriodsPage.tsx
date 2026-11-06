import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { useHasPermission } from "../../../auth/usePermissions";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import { financeApi, type FiscalYear, type Period, type PeriodEvent } from "../api/financeApi";
import { apiError, Chip, day, Field, GlDialog } from "../components/glShared";

/** Suggested start of the next fiscal year: the day after the latest year ends, or 8 July (Hamle 1). */
function nextStart(years: FiscalYear[]) {
  if (years.length === 0) { const y = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1; return `${y}-07-08`; }
  const end = new Date(`${years[0].endDate}T12:00:00`);
  end.setDate(end.getDate() + 1);
  return end.toISOString().slice(0, 10);
}

export default function AccountingPeriodsPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canManage = useHasPermission("finance.manage");
  const canClose = useHasPermission("finance.period.close");
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState<{ name: string; startDate: string } | null>(null);
  const [action, setAction] = useState<{ period: Period; kind: "close" | "reopen"; reason: string } | null>(null);
  const [history, setHistory] = useState<{ period: Period; events: PeriodEvent[] | null } | null>(null);
  const [yearAction, setYearAction] = useState<{ year: FiscalYear; kind: "close" | "reopen"; reason: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setYears(await financeApi.fiscalYears(companyId)); setError(null); }
    catch (e) { setError(apiError(e, "Fiscal years could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);

  async function run(work: () => Promise<unknown>, fallback: string, done: () => void) {
    setBusy(true); setError(null);
    try { await work(); done(); await load(); }
    catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  const openHistory = (period: Period) => {
    setHistory({ period, events: null });
    financeApi.periodEvents(companyId, period.id).then((events) => setHistory({ period, events })).catch(() => setHistory({ period, events: [] }));
  };

  return (
    <div className="gl-page">
      <PageHeader title="Fiscal Years & Periods" subtitle="Journals post only into open periods. Close each month once its documents are posted; reopening needs a reason and is recorded."
        actions={canManage ? <Button onClick={() => { setError(null); const start = nextStart(years); setCreating({ name: `FY ${start.slice(0, 4)}/${String(Number(start.slice(2, 4)) + 1).padStart(2, "0")}`, startDate: start }); }}>
          <Plus size={16} /> New fiscal year</Button> : null} />
      {error && !creating && !action ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">Loading periods…</StateMessage> : null}
      {!loading && years.length === 0 ? <StateMessage tone="warning">No fiscal year yet. Create one — nothing can be posted until a period covers the journal date.</StateMessage> : null}
      {years.map((y) => (
        <section key={y.id} className="gl-panel gl-year">
          <div className="gl-panel-head">
            <div><h2>{y.name}{y.status === "closed" ? " · Closed" : ""}</h2><p className="gl-muted">{day(y.startDate)} – {day(y.endDate)} · {y.periods.filter((p) => p.status === "closed").length} of {y.periods.length} periods closed{y.closedAtUtc ? ` · year closed ${formatAppDateTime(y.closedAtUtc)}` : ""}</p></div>
            {canClose && y.status !== "closed" && y.periods.every((p) => p.status === "closed") ? <Button size="sm" onClick={() => { setError(null); setYearAction({ year: y, kind: "close", reason: "" }); }}>Close year</Button> : null}
            {canClose && y.status === "closed" ? <Button size="sm" variant="ghost" onClick={() => { setError(null); setYearAction({ year: y, kind: "reopen", reason: "" }); }}>Reopen year</Button> : null}
          </div>
          <div className="gl-table-wrap">
            <table className="gl-table">
              <thead><tr><th>Period</th><th>Dates</th><th>Status</th><th>Waiting</th><th /></tr></thead>
              <tbody>
                {y.periods.map((p) => (
                  <tr key={p.id} className={p.status === "closed" ? "is-muted" : ""}>
                    <td>{p.name}</td>
                    <td>{day(p.startDate)} – {day(p.endDate)}</td>
                    <td>{p.status === "open" ? <Chip tone="ok">Open</Chip> : <Chip tone="muted">Closed{p.closedAtUtc ? ` ${day(p.closedAtUtc)}` : ""}</Chip>}</td>
                    <td>
                      <div className="gl-chip-row">
                        {p.draftJournals ? <Chip tone="warn">{p.draftJournals} draft journal{p.draftJournals === 1 ? "" : "s"}</Chip> : null}
                        {p.postingExceptions ? <Chip tone="bad">{p.postingExceptions} unposted document{p.postingExceptions === 1 ? "" : "s"}</Chip> : null}
                        {!p.draftJournals && !p.postingExceptions && p.status === "open" ? <span className="gl-muted">Nothing</span> : null}
                      </div>
                    </td>
                    <td className="gl-actions">
                      <Button size="sm" variant="ghost" onClick={() => openHistory(p)}>History</Button>
                      {canClose && p.status === "open" ? <Button size="sm" variant="outline" onClick={() => { setError(null); setAction({ period: p, kind: "close", reason: "" }); }}>Close</Button> : null}
                      {canClose && p.status === "closed" ? <Button size="sm" variant="ghost" onClick={() => { setError(null); setAction({ period: p, kind: "reopen", reason: "" }); }}>Reopen</Button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {creating ? (
        <GlDialog open title="New fiscal year" confirmText="Create year" busy={busy} error={error} onClose={() => setCreating(null)}
          description="Twelve monthly periods are created from the start date. The Ethiopian fiscal year starts on Hamle 1 (8 July)."
          onConfirm={() => void run(() => financeApi.createFiscalYear(companyId, creating.name, creating.startDate), "The fiscal year could not be created.", () => setCreating(null))}>
          <div className="gl-grid">
            <Field label="Name"><Input required maxLength={40} value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} /></Field>
            <Field label="Start date"><Input type="date" required value={creating.startDate} onChange={(e) => setCreating({ ...creating, startDate: e.target.value })} /></Field>
          </div>
        </GlDialog>
      ) : null}

      {action ? (
        <GlDialog open title={`${action.kind === "close" ? "Close" : "Reopen"} ${action.period.name}`} confirmText={action.kind === "close" ? "Close period" : "Reopen period"}
          danger={action.kind === "reopen"} busy={busy} error={error} onClose={() => setAction(null)}
          confirmDisabled={action.kind === "reopen" && action.reason.trim().length < 10}
          description={action.kind === "close"
            ? "Nothing can be posted into a closed period. Earlier periods must be closed first, and no draft journals or unposted documents may remain."
            : "Reopening lets journals post into this period again. Later closed periods must be reopened first. Your reason is kept in the period history."}
          onConfirm={() => void run(() => action.kind === "close"
            ? financeApi.closePeriod(companyId, action.period.id, action.period.version, action.reason.trim() || undefined)
            : financeApi.reopenPeriod(companyId, action.period.id, action.period.version, action.reason.trim()),
            `The period could not be ${action.kind === "close" ? "closed" : "reopened"}.`, () => setAction(null))}>
          <Field label={action.kind === "close" ? "Note (optional)" : "Reason"} hint={action.kind === "reopen" ? "At least 10 characters." : undefined}>
            <Input maxLength={500} required={action.kind === "reopen"} value={action.reason} onChange={(e) => setAction({ ...action, reason: e.target.value })} />
          </Field>
        </GlDialog>
      ) : null}

      {yearAction ? (
        <GlDialog open title={`${yearAction.kind === "close" ? "Close" : "Reopen"} ${yearAction.year.name}`} confirmText={yearAction.kind === "close" ? "Close year" : "Reopen year"}
          danger={yearAction.kind === "reopen"} busy={busy} error={error} onClose={() => setYearAction(null)}
          confirmDisabled={yearAction.kind === "reopen" && yearAction.reason.trim().length < 10}
          description={yearAction.kind === "close"
            ? "The year's revenue, cost-of-sales and expense accounts are closed into retained earnings with one journal dated the last day of the year, and the year is locked. Earlier years must be closed first."
            : "The closing journal is reversed on the same date and the year opens again. Its periods stay closed until you reopen them one by one. Later closed years must be reopened first."}
          onConfirm={() => void run(() => yearAction.kind === "close"
            ? financeApi.closeFiscalYear(companyId, yearAction.year.id, yearAction.year.version, yearAction.reason.trim() || undefined)
            : financeApi.reopenFiscalYear(companyId, yearAction.year.id, yearAction.year.version, yearAction.reason.trim()),
            `The fiscal year could not be ${yearAction.kind === "close" ? "closed" : "reopened"}.`, () => setYearAction(null))}>
          <Field label={yearAction.kind === "close" ? "Note (optional)" : "Reason"} hint={yearAction.kind === "reopen" ? "At least 10 characters." : undefined}>
            <Input maxLength={500} required={yearAction.kind === "reopen"} value={yearAction.reason} onChange={(e) => setYearAction({ ...yearAction, reason: e.target.value })} />
          </Field>
        </GlDialog>
      ) : null}

      {history ? (
        <GlDialog open title={`${history.period.name} history`} confirmText="" closeText="Close" onClose={() => setHistory(null)}>
          {history.events === null ? <StateMessage tone="loading">Loading…</StateMessage>
            : history.events.length === 0 ? <p className="gl-muted">Never closed.</p>
            : (
              <div className="gl-table-wrap">
                <table className="gl-table">
                  <thead><tr><th>When</th><th>Action</th><th>By</th><th>Reason</th></tr></thead>
                  <tbody>{history.events.map((e, i) => <tr key={i}><td>{formatAppDateTime(e.atUtc)}</td><td>{e.action}</td><td>{e.userName || "—"}</td><td>{e.reason ?? ""}</td></tr>)}</tbody>
                </table>
              </div>
            )}
        </GlDialog>
      ) : null}
    </div>
  );
}
