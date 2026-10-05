import { useCallback, useEffect, useMemo, useState } from "react";
import { HandCoins, History, PencilLine, RefreshCw } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Textarea } from "../../../components/ui/textarea";
import { useAppScope } from "../../../app/useAppScope";
import { useI18n } from "../../../i18n";
import { formatAppDateTime, todayLocalIsoDate } from "../../../shared/datetime/dateFormat";
import { posServiceApi, waiterKey, type DiningAreaDto, type PosWaiterDto } from "../api/posServiceApi";
import { posTipsApi, type TipDetailDto, type TipPayoutMethod, type TipReportDto, type TipReportRowDto } from "../api/posTipsApi";
import { PosDialog } from "../components/PosDialog";
import { money } from "../components/posUi";
import { extractApiError } from "../utils/posUtils";
import "../pos-service.css";

type Filters = { from: string; to: string; waiter: string; method: string; session: string; table: string };

const METHODS = ["CASH", "CARD", "MOBILE", "TRANSFER"];
const PAYOUT_METHODS: Array<{ value: TipPayoutMethod; label: string }> = [
  { value: "cashDrawer", label: "Cash from the drawer" },
  { value: "payroll", label: "Payroll" },
  { value: "bankTransfer", label: "Bank transfer" },
];

function parseWaiter(key: string) {
  if (key.startsWith("e:")) return { waiterEmployeeId: key.slice(2), waiterUserId: null };
  if (key.startsWith("u:")) return { waiterEmployeeId: null, waiterUserId: key.slice(2) };
  return { waiterEmployeeId: null, waiterUserId: null };
}

const rowKey = (row: Pick<TipReportRowDto, "waiterEmployeeId" | "waiterUserId">) =>
  row.waiterEmployeeId ? `e:${row.waiterEmployeeId}` : `u:${row.waiterUserId ?? ""}`;

/**
 * Tips by server for a period: cash, card and other tips, payouts and what is still owed.
 * Managers correct a tip with a reason (kept as an audit trail) and record payouts.
 */
export function PosTipsReportPage() {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => ({ companyId: companyId ?? "", branchId: branchId ?? "" }), [companyId, branchId]);
  const today = todayLocalIsoDate();
  const [filters, setFilters] = useState<Filters>({ from: today, to: today, waiter: "", method: "", session: "", table: "" });
  const [report, setReport] = useState<TipReportDto | null>(null);
  const [waiters, setWaiters] = useState<PosWaiterDto[]>([]);
  const [areas, setAreas] = useState<DiningAreaDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<TipDetailDto | null>(null);
  const [adjust, setAdjust] = useState<{ tip: TipDetailDto; amount: string; waiter: string; reason: string } | null>(null);
  const [payout, setPayout] = useState<{ row: TipReportRowDto; amount: string; method: TipPayoutMethod; note: string } | null>(null);

  const load = useCallback(async () => {
    if (!scope.companyId || !scope.branchId) return;
    if (filters.to < filters.from) { setError(tx("'To' date cannot be earlier than 'From' date.")); return; }
    setLoading(true);
    try {
      setReport(await posTipsApi.report(scope, {
        from: filters.from, to: filters.to, ...parseWaiter(filters.waiter),
        method: filters.method || null, posSessionId: filters.session || null, tableId: filters.table || null,
      }));
      setError(null);
    } catch (err) {
      setError(extractApiError(err, tx("The tips report could not be loaded.")));
    } finally {
      setLoading(false);
    }
  }, [filters, scope, tx]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!scope.companyId || !scope.branchId) return;
    posServiceApi.waiters(scope).then(setWaiters).catch(() => setWaiters([]));
    posServiceApi.areas(scope, true).then(setAreas).catch(() => setAreas([]));
  }, [scope]);

  const set = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await action();
      setNotice(tx(success));
      await load();
      return true;
    } catch (err) {
      setError(extractApiError(err, tx("The change could not be saved.")));
      if ((err as { response?: { status?: number } })?.response?.status === 409) await load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveAdjust = async () => {
    if (!adjust) return;
    const waiter = adjust.waiter && adjust.waiter !== rowKey(adjust.tip) ? parseWaiter(adjust.waiter) : { waiterEmployeeId: null, waiterUserId: null };
    const ok = await run(() => posTipsApi.adjust(scope, adjust.tip.id, {
      version: adjust.tip.version, amount: Number(adjust.amount), ...waiter, reason: adjust.reason.trim(),
    }), "Tip corrected.");
    if (ok) setAdjust(null);
  };

  const savePayout = async () => {
    if (!payout) return;
    const ok = await run(() => posTipsApi.payout(scope, {
      waiterEmployeeId: payout.row.waiterEmployeeId ?? null,
      waiterUserId: payout.row.waiterEmployeeId ? null : payout.row.waiterUserId ?? null,
      amount: Number(payout.amount), method: payout.method, note: payout.note.trim() || null,
    }), "Tip payout recorded.");
    if (ok) setPayout(null);
  };

  const adjustAmount = Number(adjust?.amount);
  const adjustProblem = !adjust ? null
    : !(adjustAmount >= 0) ? "Enter a valid tip amount."
    : adjustAmount > adjust.tip.basisAmount ? "A tip cannot exceed the payer's share of the bill."
    : adjust.reason.trim().length < 3 ? "Give a reason for the tip correction."
    : adjustAmount === adjust.tip.amount && (!adjust.waiter || adjust.waiter === rowKey(adjust.tip)) ? "Change the amount or the server to record a correction."
    : null;
  const payoutAmount = Number(payout?.amount);
  const payoutProblem = !payout ? null
    : !(payoutAmount > 0) ? "Payout amount must be greater than zero."
    : payoutAmount > payout.row.outstanding + 0.001 ? "The payout is more than the server's outstanding tips."
    : null;

  const tables = areas.flatMap((area) => area.tables.map((table) => ({ ...table, area: area.name })));
  const totals = report?.totals;

  return (
    <main className="rpos-page rpos-setup ui-page">
      <PageHeader title={tx("Tips Report")}
        subtitle={tx("Tips by server. Tips are not sales revenue; outstanding is what the server is still owed.")}
        actions={<Button type="button" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw size={14} aria-hidden="true" /> {tx("Refresh")}</Button>} />

      <section className="rpos-setup-area rpos-tip-filters" aria-label={tx("Filters")}>
        <label className="rpos-field"><span>{tx("From")}</span><Input type="date" value={filters.from} max={filters.to} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="rpos-field"><span>{tx("To")}</span><Input type="date" value={filters.to} min={filters.from} onChange={(e) => set({ to: e.target.value })} /></label>
        <label className="rpos-field"><span>{tx("Waiter")}</span>
          <Select value={filters.waiter} onChange={(e) => set({ waiter: e.target.value })}>
            <option value="">{tx("All servers")}</option>
            {waiters.map((waiter) => <option key={waiterKey(waiter)} value={waiterKey(waiter)}>{waiter.name}</option>)}
          </Select>
        </label>
        <label className="rpos-field"><span>{tx("Payment method")}</span>
          <Select value={filters.method} onChange={(e) => set({ method: e.target.value })}>
            <option value="">{tx("All methods")}</option>
            {METHODS.map((method) => <option key={method} value={method}>{tx(method)}</option>)}
          </Select>
        </label>
        <label className="rpos-field"><span>{tx("Shift / POS session")}</span>
          <Select value={filters.session} onChange={(e) => set({ session: e.target.value })}>
            <option value="">{tx("All sessions")}</option>
            {(report?.sessions ?? []).map((session) => (
              <option key={session.id} value={session.id}>{formatAppDateTime(session.openedAtUtc)} · {session.cashierName} · {session.terminal}</option>
            ))}
          </Select>
        </label>
        <label className="rpos-field"><span>{tx("Table")}</span>
          <Select value={filters.table} onChange={(e) => set({ table: e.target.value })}>
            <option value="">{tx("All tables")}</option>
            {tables.map((table) => <option key={table.id} value={table.id}>{table.number} · {table.area}</option>)}
          </Select>
        </label>
      </section>

      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {loading && !report ? <StateMessage tone="loading">{tx("Loading tips...")}</StateMessage> : null}

      {report ? (
        <>
          <section className="rpos-setup-area" aria-label={tx("Tips by server")}>
            <h2>{tx("Tips by server")}</h2>
            {report.rows.length === 0 ? <p className="rpos-muted">{tx("No tips or served tables in this period.")}</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Employee")}</TableHead>
                    <TableHead className="rpos-num">{tx("Tables Served")}</TableHead>
                    <TableHead className="rpos-num">{tx("Sales")}</TableHead>
                    <TableHead className="rpos-num">{tx("Cash Tips")}</TableHead>
                    <TableHead className="rpos-num">{tx("Card Tips")}</TableHead>
                    <TableHead className="rpos-num">{tx("Other Tips")}</TableHead>
                    <TableHead className="rpos-num">{tx("Total Tips")}</TableHead>
                    <TableHead className="rpos-num">{tx("Paid Out")}</TableHead>
                    <TableHead className="rpos-num">{tx("Outstanding")}</TableHead>
                    <TableHead><span className="sr-only">{tx("Actions")}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row) => (
                    <TableRow key={rowKey(row)}>
                      <TableCell>{row.waiterName}</TableCell>
                      <TableCell className="rpos-num">{row.tablesServed}</TableCell>
                      <TableCell className="rpos-num">{money(row.sales)}</TableCell>
                      <TableCell className="rpos-num">{money(row.cashTips)}</TableCell>
                      <TableCell className="rpos-num">{money(row.cardTips)}</TableCell>
                      <TableCell className="rpos-num">{money(row.otherTips)}</TableCell>
                      <TableCell className="rpos-num"><strong>{money(row.totalTips)}</strong></TableCell>
                      <TableCell className="rpos-num">{money(row.paidOut)}</TableCell>
                      <TableCell className="rpos-num"><strong>{money(row.outstanding)}</strong></TableCell>
                      <TableCell className="rpos-row-actions">
                        <Button type="button" size="sm" variant="outline" disabled={busy || row.outstanding <= 0}
                          onClick={() => setPayout({ row, amount: row.outstanding.toFixed(2), method: "cashDrawer", note: "" })}>
                          <HandCoins size={14} aria-hidden="true" /> {tx("Pay out")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {totals ? (
                    <TableRow className="rpos-total-row">
                      <TableCell>{tx("Total")}</TableCell>
                      <TableCell className="rpos-num">{totals.tablesServed}</TableCell>
                      <TableCell className="rpos-num">{money(totals.sales)}</TableCell>
                      <TableCell className="rpos-num">{money(totals.cashTips)}</TableCell>
                      <TableCell className="rpos-num">{money(totals.cardTips)}</TableCell>
                      <TableCell className="rpos-num">{money(totals.otherTips)}</TableCell>
                      <TableCell className="rpos-num">{money(totals.totalTips)}</TableCell>
                      <TableCell className="rpos-num">{money(totals.paidOut)}</TableCell>
                      <TableCell className="rpos-num">{money(totals.outstanding)}</TableCell>
                      <TableCell />
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
            <p className="rpos-muted">{tx("Times are in {zone}. Outstanding covers all tips and payouts to date, not only this period.", { zone: report.timeZone })}</p>
          </section>

          <section className="rpos-setup-area" aria-label={tx("Tip records")}>
            <h2>{tx("Tip records")}</h2>
            {report.tips.length === 0 ? <p className="rpos-muted">{tx("No tips in this period.")}</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Time")}</TableHead>
                    <TableHead>{tx("Sale")}</TableHead>
                    <TableHead>{tx("Table")}</TableHead>
                    <TableHead>{tx("Server")}</TableHead>
                    <TableHead>{tx("Method")}</TableHead>
                    <TableHead className="rpos-num">{tx("Bill share")}</TableHead>
                    <TableHead className="rpos-num">{tx("Tip")}</TableHead>
                    <TableHead>{tx("Status")}</TableHead>
                    <TableHead><span className="sr-only">{tx("Actions")}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.tips.map((tip) => (
                    <TableRow key={tip.id} className={tip.status === "voided" ? "is-voided" : undefined}>
                      <TableCell>{formatAppDateTime(tip.createdAtUtc)}</TableCell>
                      <TableCell>{tip.saleNo}</TableCell>
                      <TableCell>{tip.tableLabel ?? "—"}</TableCell>
                      <TableCell>{tip.waiterName}</TableCell>
                      <TableCell>{tx(tip.method)}</TableCell>
                      <TableCell className="rpos-num">{money(tip.basisAmount)}</TableCell>
                      <TableCell className="rpos-num">{money(tip.amount)}{tip.percent ? ` (${tip.percent}%)` : ""}</TableCell>
                      <TableCell>
                        {tx(tip.status === "voided" ? "Voided with the sale" : tip.adjustments.length ? "Corrected" : "Recorded")}
                      </TableCell>
                      <TableCell className="rpos-row-actions">
                        {tip.adjustments.length ? (
                          <Button type="button" size="sm" variant="ghost" onClick={() => setHistory(tip)} aria-label={`${tx("Correction history")} ${tip.saleNo}`}>
                            <History size={14} aria-hidden="true" />
                          </Button>
                        ) : null}
                        {tip.status === "recorded" ? (
                          <Button type="button" size="sm" variant="outline" disabled={busy}
                            onClick={() => setAdjust({ tip, amount: tip.amount.toFixed(2), waiter: rowKey(tip), reason: "" })}>
                            <PencilLine size={14} aria-hidden="true" /> {tx("Correct")}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          {report.payouts.length ? (
            <section className="rpos-setup-area" aria-label={tx("Payouts")}>
              <h2>{tx("Payouts")}</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Time")}</TableHead>
                    <TableHead>{tx("Server")}</TableHead>
                    <TableHead>{tx("Method")}</TableHead>
                    <TableHead className="rpos-num">{tx("Amount")}</TableHead>
                    <TableHead>{tx("Paid by")}</TableHead>
                    <TableHead>{tx("Note")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.payouts.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell>{formatAppDateTime(x.paidAtUtc)}</TableCell>
                      <TableCell>{x.waiterName}</TableCell>
                      <TableCell>{tx(PAYOUT_METHODS.find((m) => m.value === x.method)?.label ?? x.method)}</TableCell>
                      <TableCell className="rpos-num">{money(x.amount)}</TableCell>
                      <TableCell>{x.paidByName}</TableCell>
                      <TableCell>{x.note ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ) : null}
        </>
      ) : null}

      <PosDialog open={!!adjust} title={`${tx("Correct tip")} · ${adjust?.tip.saleNo ?? ""}`} confirmText={tx("Save correction")} busy={busy}
        description={tx("Corrections are kept with the reason, your name and the time.")}
        confirmDisabled={!!adjustProblem} onConfirm={() => void saveAdjust()} onClose={() => setAdjust(null)}>
        {adjust ? (
          <div className="rpos-form-grid">
            <label className="rpos-field">
              <span>{tx("Tip amount")}</span>
              <Input type="number" inputMode="decimal" min={0} step="0.01" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} />
            </label>
            <label className="rpos-field">
              <span>{tx("Server")}</span>
              <Select value={adjust.waiter} onChange={(e) => setAdjust({ ...adjust, waiter: e.target.value })}>
                {!waiters.some((w) => waiterKey(w) === rowKey(adjust.tip)) ? <option value={rowKey(adjust.tip)}>{adjust.tip.waiterName}</option> : null}
                {waiters.map((waiter) => <option key={waiterKey(waiter)} value={waiterKey(waiter)}>{waiter.name}</option>)}
              </Select>
            </label>
            <label className="rpos-field rpos-span-all">
              <span>{tx("Reason")}</span>
              <Textarea rows={2} maxLength={500} value={adjust.reason} required onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} />
            </label>
            <p className="rpos-muted rpos-span-all">{tx("Payer's share of the bill: {amount}", { amount: money(adjust.tip.basisAmount) })}</p>
            {adjustProblem ? <p className="rpos-muted rpos-span-all">{tx(adjustProblem)}</p> : null}
          </div>
        ) : null}
      </PosDialog>

      <PosDialog open={!!payout} title={`${tx("Pay out tips")} · ${payout?.row.waiterName ?? ""}`} confirmText={tx("Record payout")} busy={busy}
        description={tx("Outstanding: {amount}", { amount: money(payout?.row.outstanding ?? 0) })}
        confirmDisabled={!!payoutProblem} onConfirm={() => void savePayout()} onClose={() => setPayout(null)}>
        {payout ? (
          <div className="rpos-form-grid">
            <label className="rpos-field">
              <span>{tx("Amount")}</span>
              <Input type="number" inputMode="decimal" min={0} step="0.01" value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: e.target.value })} />
            </label>
            <label className="rpos-field">
              <span>{tx("Paid as")}</span>
              <Select value={payout.method} onChange={(e) => setPayout({ ...payout, method: e.target.value as TipPayoutMethod })}>
                {PAYOUT_METHODS.map((m) => <option key={m.value} value={m.value}>{tx(m.label)}</option>)}
              </Select>
            </label>
            <label className="rpos-field rpos-span-all">
              <span>{tx("Note")}</span>
              <Input value={payout.note} maxLength={500} onChange={(e) => setPayout({ ...payout, note: e.target.value })} />
            </label>
            {payout.method === "cashDrawer" ? <p className="rpos-muted rpos-span-all">{tx("The cash leaves your open drawer and lowers its expected cash.")}</p> : null}
            {payoutProblem ? <p className="rpos-muted rpos-span-all">{tx(payoutProblem)}</p> : null}
          </div>
        ) : null}
      </PosDialog>

      <PosDialog open={!!history} title={`${tx("Correction history")} · ${history?.saleNo ?? ""}`} confirmText={tx("Close")}
        onConfirm={() => setHistory(null)} onClose={() => setHistory(null)}>
        <ul className="rpos-tip-history">
          {history?.adjustments.map((a, i) => (
            <li key={i}>
              <strong>{formatAppDateTime(a.adjustedAtUtc)} · {a.adjustedByName}</strong>
              <span>{money(a.oldAmount)} → {money(a.newAmount)}{a.oldWaiterName !== a.newWaiterName ? ` · ${a.oldWaiterName} → ${a.newWaiterName}` : ""}</span>
              <span className="rpos-muted">{a.reason}</span>
            </li>
          ))}
        </ul>
      </PosDialog>
    </main>
  );
}
