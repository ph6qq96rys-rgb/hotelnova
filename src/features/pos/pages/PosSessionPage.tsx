import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, CheckCheck, FileText, Lock, Printer, RefreshCw, Vault } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Textarea } from "../../../components/ui/textarea";
import { useAppScope } from "../../../app/useAppScope";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { formatAppDateTime, todayLocalIsoDate } from "../../../shared/datetime/dateFormat";
import { BIRR_DENOMINATIONS, posDrawerApi, type CashMovementType, type DrawerDto, type DrawerReportDto } from "../api/posDrawerApi";
import { PosDialog } from "../components/PosDialog";
import { money } from "../components/posUi";
import { extractApiError } from "../utils/posUtils";
import "../pos-service.css";

const MOVEMENTS: Array<{ type: CashMovementType; label: string; supervisorOnly?: boolean }> = [
  { type: "paidIn", label: "Paid in" },
  { type: "safeDrop", label: "Safe drop" },
  { type: "paidOut", label: "Paid out", supervisorOnly: true },
];

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const varianceLabel: Record<string, string> = { none: "Within limit", pending: "Waiting for approval", approved: "Approved" };

/**
 * The cashier's drawer: cash movements with a reason, a blind count at close (the expected amount
 * is shown only afterwards) and the frozen Z report. Supervisors see every drawer of the branch,
 * the expected cash of open drawers, and approve differences.
 */
export function PosSessionPage() {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => ({ companyId: companyId ?? "", branchId: branchId ?? "" }), [companyId, branchId]);
  const supervisor = useHasPermission("pos.session.approve");
  const today = todayLocalIsoDate();

  const [mine, setMine] = useState<DrawerDto | null>(null);
  const [drawers, setDrawers] = useState<DrawerDto[]>([]);
  const [range, setRange] = useState({ from: today, to: today });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [movement, setMovement] = useState<{ type: CashMovementType; amount: string; reason: string } | null>(null);
  const [closing, setClosing] = useState<{ drawer: DrawerDto; counts: Record<string, string>; note: string } | null>(null);
  const [closed, setClosed] = useState<DrawerDto | null>(null);
  const [approval, setApproval] = useState<{ drawer: DrawerDto; note: string } | null>(null);
  const [report, setReport] = useState<DrawerReportDto | null>(null);

  const load = useCallback(async () => {
    if (!scope.companyId || !scope.branchId) return;
    setLoading(true);
    setError(null);
    try {
      setMine(await posDrawerApi.current(scope));
      if (supervisor) setDrawers(await posDrawerApi.list(scope, { from: range.from, to: range.to }));
    } catch (err) {
      setError(extractApiError(err, "Unable to load cash drawers."));
    } finally {
      setLoading(false);
    }
  }, [scope, supervisor, range.from, range.to]);

  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(tx(done));
      await load();
      return true;
    } catch (err) {
      setError(extractApiError(err, "The operation could not be completed. Please try again."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function openReport(drawer: DrawerDto) {
    setError(null);
    try {
      setReport(drawer.status === "Open" ? await posDrawerApi.xReport(scope, drawer.id) : await posDrawerApi.zReport(scope, drawer.id));
    } catch (err) {
      setError(extractApiError(err, "Unable to load the drawer report."));
    }
  }

  const counted = closing ? round2(BIRR_DENOMINATIONS.reduce((sum, value) => sum + value * (Number(closing.counts[String(value)]) || 0), 0)) : 0;
  const countProblem = closing && BIRR_DENOMINATIONS.some((value) => {
    const raw = closing.counts[String(value)];
    return raw !== undefined && raw !== "" && !(Number.isInteger(Number(raw)) && Number(raw) >= 0);
  }) ? "Counts must be whole numbers." : null;
  const movementAmount = Number(movement?.amount);
  const movementProblem = !movement ? null
    : !(movementAmount > 0) ? "Enter an amount greater than zero."
    : movement.reason.trim().length < 3 ? "Give a reason for the cash movement."
    : null;

  return (
    <main className="rpos-page rpos-setup ui-page">
      <PageHeader title={tx("Cash drawer")}
        subtitle={tx("Count your drawer at the end of the shift. The expected amount is shown after you close.")}
        actions={<Button type="button" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw size={14} aria-hidden="true" /> {tx("Refresh")}</Button>} />

      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {loading && !mine && drawers.length === 0 ? <StateMessage tone="loading">{tx("Loading cash drawers...")}</StateMessage> : null}

      <section className="rpos-setup-area" aria-label={tx("My drawer")}>
        <h2>{tx("My drawer")}</h2>
        {!loading && !mine ? (
          <p className="rpos-muted">
            {tx("You have no open drawer.")}{" "}
            <Link to={`/companies/${companyId}/sales/pos`}>{tx("Open one on the POS")}</Link>
          </p>
        ) : null}
        {mine ? (
          <>
            <div className="rpos-oo-tiles">
              <div className="rpos-oo-tile"><span>{tx("Till")}</span><strong>{mine.terminal ?? mine.storeName ?? "—"}</strong><small>{mine.storeName}</small></div>
              <div className="rpos-oo-tile"><span>{tx("Opened")}</span><strong>{formatAppDateTime(mine.openedAtUtc)}</strong><small>{mine.cashierName}</small></div>
              <div className="rpos-oo-tile"><span>{tx("Opening Float")}</span><strong>{money(mine.openingFloat)}</strong><small>{mine.currencyCode}</small></div>
              <div className={mine.pendingReturns ? "rpos-oo-tile is-warn" : "rpos-oo-tile"}>
                <span>{tx("Returns waiting for approval")}</span><strong>{mine.pendingReturns}</strong>
                <small>{tx(mine.pendingReturns ? "Ask a supervisor before closing" : "None")}</small>
              </div>
            </div>
            <div className="rpos-chip-row" style={{ marginTop: "var(--ui-space-3)" }}>
              {MOVEMENTS.filter((m) => !m.supervisorOnly || supervisor).map((m) => (
                <Button key={m.type} type="button" variant="outline" disabled={busy} onClick={() => { setError(null); setMovement({ type: m.type, amount: "", reason: "" }); }}>
                  {m.type === "paidIn" ? <ArrowDownToLine size={14} aria-hidden="true" /> : m.type === "safeDrop" ? <Vault size={14} aria-hidden="true" /> : <ArrowUpFromLine size={14} aria-hidden="true" />} {tx(m.label)}
                </Button>
              ))}
              <Button type="button" variant="destructive" disabled={busy || mine.pendingReturns > 0}
                onClick={() => { setError(null); setClosing({ drawer: mine, counts: {}, note: "" }); }}>
                <Lock size={14} aria-hidden="true" /> {tx("Count and close drawer")}
              </Button>
            </div>
          </>
        ) : null}
        {closed ? (
          <dl className="rpos-totals" aria-label={tx("Drawer closed")} style={{ marginTop: "var(--ui-space-3)", maxWidth: 420 }}>
            <div><dt>{tx("Counted")}</dt><dd>{money(closed.countedCash ?? 0)}</dd></div>
            <div><dt>{tx("Expected")}</dt><dd>{money(closed.expectedCash ?? 0)}</dd></div>
            <div className="rpos-grand"><dt>{tx("Difference")}</dt><dd>{money(closed.cashVariance ?? 0)}</dd></div>
            <div><dt>{tx("Status")}</dt><dd>{tx(varianceLabel[closed.varianceStatus] ?? closed.varianceStatus)}</dd></div>
            <Button type="button" variant="outline" onClick={() => void openReport(closed)}><FileText size={14} aria-hidden="true" /> {tx("Z report")}</Button>
          </dl>
        ) : null}
      </section>

      {supervisor ? (
        <section className="rpos-setup-area" aria-label={tx("Drawers")}>
          <h2>{tx("Drawers")}</h2>
          <div className="rpos-tip-filters">
            <label className="rpos-field"><span>{tx("From")}</span><Input type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></label>
            <label className="rpos-field"><span>{tx("To")}</span><Input type="date" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></label>
          </div>
          {drawers.length === 0 ? <p className="rpos-muted">{tx("No drawers in this period.")}</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Cashier")}</TableHead>
                  <TableHead>{tx("Till")}</TableHead>
                  <TableHead>{tx("Opened")}</TableHead>
                  <TableHead>{tx("Status")}</TableHead>
                  <TableHead className="rpos-num">{tx("Expected")}</TableHead>
                  <TableHead className="rpos-num">{tx("Counted")}</TableHead>
                  <TableHead className="rpos-num">{tx("Difference")}</TableHead>
                  <TableHead>{tx("Difference status")}</TableHead>
                  <TableHead><span className="sr-only">{tx("Actions")}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drawers.map((d) => (
                  <TableRow key={d.id} className={d.varianceStatus === "pending" ? "is-stale" : undefined}>
                    <TableCell>{d.cashierName}</TableCell>
                    <TableCell>{d.terminal ?? d.storeName}</TableCell>
                    <TableCell>{formatAppDateTime(d.openedAtUtc)}</TableCell>
                    <TableCell>{tx(d.status === "Open" ? "Open" : "Closed")}</TableCell>
                    <TableCell className="rpos-num">{d.expectedCash == null ? "—" : money(d.expectedCash)}</TableCell>
                    <TableCell className="rpos-num">{d.countedCash == null ? "—" : money(d.countedCash)}</TableCell>
                    <TableCell className="rpos-num">{d.cashVariance == null ? "—" : money(d.cashVariance)}</TableCell>
                    <TableCell>{d.status === "Open" ? "—" : tx(varianceLabel[d.varianceStatus] ?? d.varianceStatus)}</TableCell>
                    <TableCell className="rpos-row-actions">
                      <Button type="button" size="sm" variant="outline" onClick={() => void openReport(d)}>
                        <FileText size={14} aria-hidden="true" /> {tx(d.status === "Open" ? "X report" : "Z report")}
                      </Button>
                      {d.varianceStatus === "pending" ? (
                        <Button type="button" size="sm" disabled={busy} onClick={() => { setError(null); setApproval({ drawer: d, note: "" }); }}>
                          <CheckCheck size={14} aria-hidden="true" /> {tx("Approve difference")}
                        </Button>
                      ) : null}
                      {d.status === "Open" && d.id !== mine?.id ? (
                        <Button type="button" size="sm" variant="outline" disabled={busy || d.pendingReturns > 0}
                          onClick={() => { setError(null); setClosing({ drawer: d, counts: {}, note: "" }); }}>
                          <Lock size={14} aria-hidden="true" /> {tx("Close")}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      ) : null}

      <PosDialog open={!!movement} title={tx(MOVEMENTS.find((m) => m.type === movement?.type)?.label ?? "Cash movement")}
        confirmText={tx("Record")} busy={busy} confirmDisabled={!!movementProblem}
        onClose={() => setMovement(null)}
        onConfirm={() => void (async () => {
          if (!movement || !mine) return;
          if (await run(() => posDrawerApi.move(scope, mine.id, { type: movement.type, amount: round2(movementAmount), reason: movement.reason.trim() }), "Cash movement recorded.")) setMovement(null);
        })()}>
        {movement ? (
          <>
            <label className="rpos-field"><span>{tx("Type")}</span>
              <Select value={movement.type} onChange={(e) => setMovement({ ...movement, type: e.target.value as CashMovementType })}>
                {MOVEMENTS.filter((m) => !m.supervisorOnly || supervisor).map((m) => <option key={m.type} value={m.type}>{tx(m.label)}</option>)}
              </Select>
            </label>
            <label className="rpos-field"><span>{tx("Amount")}</span>
              <Input type="number" inputMode="decimal" min="0" step="0.01" value={movement.amount} onChange={(e) => setMovement({ ...movement, amount: e.target.value })} />
            </label>
            <label className="rpos-field"><span>{tx("Reason")}</span>
              <Textarea rows={2} maxLength={300} value={movement.reason} onChange={(e) => setMovement({ ...movement, reason: e.target.value })} />
            </label>
            {movementProblem ? <p className="rpos-muted">{tx(movementProblem)}</p> : null}
            {error ? <StateMessage tone="error">{error}</StateMessage> : null}
          </>
        ) : null}
      </PosDialog>

      <PosDialog open={!!closing} title={`${tx("Count the drawer")} · ${closing?.drawer.cashierName ?? ""}`}
        description={tx("Count every note and coin. You will see the expected amount and any difference after closing.")}
        confirmText={tx("Close drawer")} danger busy={busy} confirmDisabled={!!countProblem}
        onClose={() => setClosing(null)}
        onConfirm={() => void (async () => {
          if (!closing) return;
          setBusy(true);
          setError(null);
          try {
            const result = await posDrawerApi.close(scope, closing.drawer.id, {
              closingFloat: counted,
              denominations: BIRR_DENOMINATIONS.map((value) => ({ value, count: Number(closing.counts[String(value)]) || 0 })).filter((x) => x.count > 0),
              note: closing.note.trim() || null,
            });
            setClosing(null);
            setClosed(result);
            setNotice(tx("Drawer closed. The Z report is final."));
            await load();
          } catch (err) {
            setError(extractApiError(err, "The drawer could not be closed."));
          } finally {
            setBusy(false);
          }
        })()}>
        {closing ? (
          <>
            <div className="rpos-form-grid">
              {BIRR_DENOMINATIONS.map((value) => (
                <label key={value} className="rpos-field"><span>{value >= 1 ? `${value} ${tx("Birr")}` : `${Math.round(value * 100)} ${tx("cents")}`}</span>
                  <Input type="number" inputMode="numeric" min="0" step="1" value={closing.counts[String(value)] ?? ""}
                    onChange={(e) => setClosing({ ...closing, counts: { ...closing.counts, [String(value)]: e.target.value } })} />
                </label>
              ))}
            </div>
            <dl className="rpos-totals"><div className="rpos-grand"><dt>{tx("Counted")}</dt><dd>{money(counted)}</dd></div></dl>
            <label className="rpos-field"><span>{tx("Note (required if the count is off by more than the company limit)")}</span>
              <Textarea rows={2} maxLength={300} value={closing.note} onChange={(e) => setClosing({ ...closing, note: e.target.value })} />
            </label>
            {countProblem ? <p className="rpos-muted">{tx(countProblem)}</p> : null}
            {error ? <StateMessage tone="error">{error}</StateMessage> : null}
          </>
        ) : null}
      </PosDialog>

      <PosDialog open={!!approval} title={`${tx("Approve difference")} · ${approval?.drawer.cashierName ?? ""}`}
        description={approval ? `${tx("Counted")} ${money(approval.drawer.countedCash ?? 0)} · ${tx("Expected")} ${money(approval.drawer.expectedCash ?? 0)} · ${tx("Difference")} ${money(approval.drawer.cashVariance ?? 0)}` : undefined}
        confirmText={tx("Approve")} busy={busy} confirmDisabled={(approval?.note.trim().length ?? 0) < 3}
        onClose={() => setApproval(null)}
        onConfirm={() => void (async () => {
          if (approval && await run(() => posDrawerApi.approveVariance(scope, approval.drawer.id, approval.note.trim()), "Difference approved.")) setApproval(null);
        })()}>
        {approval ? (
          <>
            {approval.drawer.closeNote ? <p className="rpos-muted">{tx("Cashier's note")}: {approval.drawer.closeNote}</p> : null}
            <label className="rpos-field"><span>{tx("What was found")}</span>
              <Textarea rows={3} maxLength={300} value={approval.note} onChange={(e) => setApproval({ ...approval, note: e.target.value })} />
            </label>
            {error ? <StateMessage tone="error">{error}</StateMessage> : null}
          </>
        ) : null}
      </PosDialog>

      <PosDialog open={!!report} title={report ? `${tx(report.kind === "Z" ? "Z report" : "X report")} · ${report.cashierName}` : ""}
        confirmText={tx("Print")} onClose={() => setReport(null)} onConfirm={() => window.print()}>
        {report ? <DrawerReport report={report} /> : null}
      </PosDialog>
    </main>
  );
}

function DrawerReport({ report }: { report: DrawerReportDto }) {
  const { tx } = useI18n();
  const rows: Array<[string, number | null | undefined, boolean?]> = [
    ["Opening Float", report.openingFloat],
    ["Cash taken", report.cashSales],
    ["Cash tips", report.cashTips],
    ["Tips paid out", -report.cashTipPayouts],
    ["Cash refunds", -report.cashRefunds],
    ["Paid in", report.paidIn],
    ["Paid out", -report.paidOut],
    ["Safe drops", -report.safeDrops],
    ["Expected cash", report.expectedCash, true],
  ];
  return (
    <div className="rpos-oo-add">
      <p className="rpos-muted">
        {report.storeName} · {formatAppDateTime(report.openedAtUtc)}{report.closedAtUtc ? ` – ${formatAppDateTime(report.closedAtUtc)}` : ""}
        {report.closedByName ? ` · ${tx("Closed by")} ${report.closedByName}` : ""}
      </p>
      <dl className="rpos-totals">
        <div><dt>{tx("Sales")}</dt><dd>{report.saleCount}</dd></div>
        <div><dt>{tx("Net sales")}</dt><dd>{money(report.netSales)}</dd></div>
        <div><dt>{tx("Total billed")}</dt><dd>{money(report.totalSales)}</dd></div>
        <div><dt>{tx("Discounts")}</dt><dd>{money(report.totalDiscount)}</dd></div>
        <div><dt>{tx("VAT")}</dt><dd>{money(report.totalTax)}</dd></div>
        <div><dt>{tx("Returns")} ({report.returnCount})</dt><dd>{money(report.returnsTotal)}</dd></div>
        {report.paymentBreakdown.map((p) => <div key={p.method}><dt>{tx(p.method)} ({p.count})</dt><dd>{money(p.total)}</dd></div>)}
      </dl>
      <dl className="rpos-totals">
        {rows.map(([label, value, grand]) => (
          <div key={label} className={grand ? "rpos-grand" : undefined}><dt>{tx(label)}</dt><dd>{money(value ?? 0)}</dd></div>
        ))}
        {report.countedCash != null ? <div><dt>{tx("Counted")}</dt><dd>{money(report.countedCash)}</dd></div> : null}
        {report.cashVariance != null ? <div className="rpos-grand"><dt>{tx("Difference")}</dt><dd>{money(report.cashVariance)}</dd></div> : null}
      </dl>
      {report.kind === "Z" && report.cashVariance != null ? (
        <p className="rpos-muted">{tx(varianceLabel[report.varianceStatus] ?? report.varianceStatus)}
          {report.varianceApprovedByName ? ` · ${report.varianceApprovedByName}: ${report.varianceNote ?? ""}` : ""}</p>
      ) : null}
      {report.movements.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>{tx("Cash movement")}</TableHead><TableHead className="rpos-num">{tx("Amount")}</TableHead><TableHead>{tx("Reason")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {report.movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{tx(MOVEMENTS.find((x) => x.type === m.type)?.label ?? m.type)} · {m.createdByName}</TableCell>
                <TableCell className="rpos-num">{money(m.amount)}</TableCell>
                <TableCell>{m.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}

export default PosSessionPage;
