import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { FormField } from "../../../components/ui/FormField";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { suppliersApi, type SupplierLookup } from "../api/purchasingApi";
import {
  payablesApi, type ApAgingReport, type ApReconciliation, type FxRevaluation, type FxRevaluationLine, type GrniReport, type PaymentCandidate,
  type PaymentRun, type PendingPayment, type SupplierAdvance, type SupplierStatement,
} from "../api/payablesApi";
import { ActionDialog, LabeledSelect, Metric, StatusChip, apiError, date, money, qty, todayIso, useCompanyId } from "../components/p2pShared";

type Tab = "approvals" | "runs" | "advances" | "reports" | "revaluation";
const METHODS = ["BankTransfer", "Cheque", "Cash", "MobileMoney", "Other"];

/** Accounts payable workspace: second-person approvals, payment runs, supplier advances, month-end reports and FX revaluation. */
export default function PayablesPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const canManage = useHasPermission("finance.payables.manage");
  const canApprove = useHasPermission("finance.payables.approve");
  const [tab, setTab] = useState<Tab>("approvals");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "approvals", label: "Approvals", show: true },
    { key: "runs", label: "Payment runs", show: true },
    { key: "advances", label: "Supplier advances", show: true },
    { key: "reports", label: "Reports", show: true },
    { key: "revaluation", label: "FX revaluation", show: canApprove },
  ];
  return (
    <main className="p2p-page">
      <PageHeader title={tx("Payables")} subtitle={tx("Every payment, advance and credit is recorded by one person and approved by another before it reaches the ledger.")} />
      <div className="prq-actions" role="tablist">
        {tabs.filter(t => t.show).map(t => (
          <Button key={t.key} role="tab" aria-selected={tab === t.key} variant={tab === t.key ? "default" : "outline"} onClick={() => { setTab(t.key); setError(null); setNotice(null); }}>{tx(t.label)}</Button>
        ))}
      </div>
      {error && <StateMessage tone="error">{tx(error)}</StateMessage>}
      {notice && <StateMessage tone="success">{tx(notice)}</StateMessage>}
      {tab === "approvals" && <Approvals companyId={companyId} canApprove={canApprove} onError={setError} onNotice={setNotice} />}
      {tab === "runs" && <Runs companyId={companyId} canManage={canManage} onError={setError} onNotice={setNotice} />}
      {tab === "advances" && <Advances companyId={companyId} canManage={canManage} canApprove={canApprove} onError={setError} onNotice={setNotice} />}
      {tab === "reports" && <Reports companyId={companyId} onError={setError} />}
      {tab === "revaluation" && <Revaluation companyId={companyId} onError={setError} onNotice={setNotice} />}
    </main>
  );
}

type Props = { companyId: string; onError: (e: string | null) => void; onNotice?: (n: string | null) => void };

function Approvals({ companyId, canApprove, onError, onNotice }: Props & { canApprove: boolean }) {
  const { tx } = useI18n();
  const [rows, setRows] = useState<PendingPayment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<PendingPayment | null>(null);
  async function load() {
    try { setRows(await payablesApi.pendingPayments(companyId)); } catch (e) { onError(apiError(e, "Unable to load payments awaiting approval.")); setRows([]); }
  }
  useEffect(() => { void load(); }, [companyId]);
  async function decide(row: PendingPayment, approve: boolean, reason?: string) {
    setBusy(true); onError(null);
    try {
      if (approve) await payablesApi.approvePayment(companyId, row.invoiceId, row.paymentId, { version: row.invoiceVersion });
      else await payablesApi.rejectPayment(companyId, row.invoiceId, row.paymentId, { version: row.invoiceVersion, reason });
      onNotice?.(approve ? "Payment approved. It posts to the ledger on its payment date." : "Payment rejected.");
    } catch (e) { onError(apiError(e, "Unable to decide the payment.")); }
    finally { setBusy(false); setRejecting(null); await load(); }
  }
  if (!rows) return <StateMessage tone="loading">{tx("Loading...")}</StateMessage>;
  return <Card>
    <CardHeader><CardTitle>{tx("Payments awaiting approval")}</CardTitle></CardHeader>
    <CardContent>
      {rows.length === 0 ? <EmptyState title={tx("Nothing waiting")} detail={tx("Recorded payments appear here until a second person approves them.")} /> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>{tx("Invoice")}</TableHead><TableHead>{tx("Supplier")}</TableHead><TableHead>{tx("Paid on")}</TableHead><TableHead>{tx("Method")}</TableHead>
            <TableHead>{tx("Recorded by")}</TableHead><TableHead className="p2p-right">{tx("Amount")}</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>{rows.map(r => (
            <TableRow key={r.paymentId}>
              <TableCell><Link to={`/companies/${companyId}/procurement/supplier-invoices/${r.invoiceId}`}>{r.internalNo}</Link><div className="p2p-muted">{r.supplierInvoiceNo}</div></TableCell>
              <TableCell>{r.supplier}{r.supplierBankStatus === "PendingVerification" && <div><StatusChip status="Bank not verified" /></div>}</TableCell>
              <TableCell>{date(r.paidOn)}</TableCell>
              <TableCell>{r.method ? tx(r.method) : "-"}{r.reference ? ` · ${r.reference}` : ""}</TableCell>
              <TableCell>{r.recordedBy ?? "-"}</TableCell>
              <TableCell className="p2p-right">{money(r.amount, r.currencyCode)}</TableCell>
              <TableCell className="p2p-right">{canApprove && r.canDecide ? <>
                <Button size="sm" disabled={busy} onClick={() => void decide(r, true)}>{tx("Approve")}</Button>{" "}
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting(r)}>{tx("Reject")}</Button>
              </> : <span className="p2p-muted">{tx("Another approver decides")}</span>}</TableCell>
            </TableRow>))}
          </TableBody>
        </Table>
      )}
      <ActionDialog open={!!rejecting} title={tx("Reject payment")} confirmText={tx("Reject")} danger commentLabel={tx("Reason")} commentRequired busy={busy}
        onConfirm={(reason) => rejecting && void decide(rejecting, false, reason)} onClose={() => setRejecting(null)} />
    </CardContent>
  </Card>;
}

function Runs({ companyId, canManage, onError, onNotice }: Props & { canManage: boolean }) {
  const { tx } = useI18n();
  const [runs, setRuns] = useState<PaymentRun[] | null>(null);
  const [dueBy, setDueBy] = useState(todayIso(7));
  const [candidates, setCandidates] = useState<PaymentCandidate[] | null>(null);
  const [selected, setSelected] = useState<Record<string, { amount: string; rate: string }>>({});
  const [header, setHeader] = useState({ paymentDate: todayIso(), method: "BankTransfer", reference: "" });
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState<{ run: PaymentRun; approve: boolean } | null>(null);
  async function load() { try { setRuns(await payablesApi.runs(companyId)); } catch (e) { onError(apiError(e, "Unable to load payment runs.")); setRuns([]); } }
  useEffect(() => { void load(); }, [companyId]);
  async function propose() {
    setBusy(true); onError(null);
    try { const rows = await payablesApi.proposal(companyId, dueBy); setCandidates(rows); setSelected({}); }
    catch (e) { onError(apiError(e, "Unable to list invoices due.")); }
    finally { setBusy(false); }
  }
  const chosen = (candidates ?? []).filter(c => selected[c.invoiceId]);
  async function create() {
    setBusy(true); onError(null);
    try {
      await payablesApi.createRun(companyId, {
        paymentDate: header.paymentDate, method: header.method, reference: header.reference.trim() || null,
        items: chosen.map(c => ({ invoiceId: c.invoiceId, version: c.version, amount: Number(selected[c.invoiceId].amount), exchangeRate: c.exchangeRate !== 1 ? Number(selected[c.invoiceId].rate) || 0 : 0 })),
      });
      onNotice?.("Payment run submitted. A second person approves it before the payments post.");
      setCandidates(null); setSelected({}); await load();
    } catch (e) { onError(apiError(e, "Unable to create the payment run.")); }
    finally { setBusy(false); }
  }
  async function decide(note: string) {
    if (!deciding) return;
    setBusy(true); onError(null);
    try { await payablesApi.decideRun(companyId, deciding.run.id, { version: deciding.run.version, approve: deciding.approve, note: note || null }); onNotice?.(deciding.approve ? "Payment run approved." : "Payment run rejected."); }
    catch (e) { onError(apiError(e, "Unable to decide the payment run.")); }
    finally { setBusy(false); setDeciding(null); await load(); }
  }
  return <>
    {canManage && <Card>
      <CardHeader><CardTitle>{tx("New payment run")}</CardTitle></CardHeader>
      <CardContent>
        <div className="p2p-grid">
          <FormField label={tx("Invoices due by")} type="date" value={dueBy} onChange={e => setDueBy(e.target.value)} />
          <div className="prq-actions"><Button variant="outline" disabled={busy} onClick={() => void propose()}>{tx("List invoices due")}</Button></div>
        </div>
        {candidates && (candidates.length === 0 ? <EmptyState title={tx("Nothing due")} detail={tx("No approved invoice with a payable balance is due by that date.")} /> : <>
          <Table>
            <TableHeader><TableRow>
              <TableHead /><TableHead>{tx("Invoice")}</TableHead><TableHead>{tx("Supplier")}</TableHead><TableHead>{tx("Due")}</TableHead>
              <TableHead className="p2p-right">{tx("Available to pay")}</TableHead><TableHead>{tx("Pay")}</TableHead><TableHead>{tx("Rate")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>{candidates.map(c => {
              const pick = selected[c.invoiceId];
              return <TableRow key={c.invoiceId}>
                <TableCell><Checkbox aria-label={c.internalNo} checked={!!pick} onChange={e => setSelected(s => {
                  const next = { ...s };
                  if (e.target.checked) next[c.invoiceId] = { amount: String(c.availableToPay), rate: String(c.exchangeRate) }; else delete next[c.invoiceId];
                  return next;
                })} /></TableCell>
                <TableCell>{c.internalNo}<div className="p2p-muted">{c.supplierInvoiceNo}</div></TableCell>
                <TableCell>{c.supplier}{c.supplierBankStatus === "PendingVerification" && <div><StatusChip status="Bank not verified" /></div>}</TableCell>
                <TableCell>{date(c.dueDate)}</TableCell>
                <TableCell className="p2p-right">{money(c.availableToPay, c.currencyCode)}</TableCell>
                <TableCell>{pick && <FormField label={tx("Amount")} type="number" min={0} step="0.01" value={pick.amount} onChange={e => setSelected(s => ({ ...s, [c.invoiceId]: { ...s[c.invoiceId], amount: e.target.value } }))} />}</TableCell>
                <TableCell>{pick && c.exchangeRate !== 1 && <FormField label={`${c.currencyCode} ${tx("rate")}`} type="number" min={0} step="0.0001" value={pick.rate} onChange={e => setSelected(s => ({ ...s, [c.invoiceId]: { ...s[c.invoiceId], rate: e.target.value } }))} />}</TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
          <div className="p2p-grid">
            <FormField label={tx("Payment date")} type="date" value={header.paymentDate} onChange={e => setHeader(h => ({ ...h, paymentDate: e.target.value }))} />
            <LabeledSelect label={tx("Method")} value={header.method} onChange={e => setHeader(h => ({ ...h, method: e.target.value }))}>
              {METHODS.map(m => <option key={m} value={m}>{tx(m)}</option>)}
            </LabeledSelect>
            <FormField label={tx("Reference")} value={header.reference} placeholder={tx("Bank batch or transfer reference")} onChange={e => setHeader(h => ({ ...h, reference: e.target.value }))} />
          </div>
          <div className="prq-actions"><Button disabled={busy || chosen.length === 0 || chosen.some(c => !(Number(selected[c.invoiceId].amount) > 0))} onClick={() => void create()}>
            {tx("Submit run for approval")} ({chosen.length})</Button></div>
        </>)}
      </CardContent>
    </Card>}
    <Card>
      <CardHeader><CardTitle>{tx("Payment runs")}</CardTitle></CardHeader>
      <CardContent>
        {!runs ? <StateMessage tone="loading">{tx("Loading...")}</StateMessage> : runs.length === 0 ? <EmptyState title={tx("No payment runs")} detail={tx("Group due invoices into a run and have a second person approve them together.")} /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tx("Run")}</TableHead><TableHead>{tx("Payment date")}</TableHead><TableHead>{tx("Method")}</TableHead><TableHead>{tx("Invoices")}</TableHead>
              <TableHead>{tx("Status")}</TableHead><TableHead>{tx("Prepared by")}</TableHead><TableHead className="p2p-right">{tx("Total")}</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>{runs.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.runNo}{r.reference && <div className="p2p-muted">{r.reference}</div>}</TableCell>
                <TableCell>{date(r.paymentDate)}</TableCell><TableCell>{r.method ? tx(r.method) : "-"}</TableCell><TableCell>{r.paymentCount}</TableCell>
                <TableCell><StatusChip status={r.status === "PendingApproval" ? "Pending approval" : r.status} />{r.decisionNote && <div className="p2p-muted">{r.decisionNote}</div>}</TableCell>
                <TableCell>{r.preparedBy ?? "-"}</TableCell>
                <TableCell className="p2p-right">{money(r.totalBaseAmount)}</TableCell>
                <TableCell className="p2p-right">{r.canDecide && <>
                  <Button size="sm" disabled={busy} onClick={() => setDeciding({ run: r, approve: true })}>{tx("Approve")}</Button>{" "}
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setDeciding({ run: r, approve: false })}>{tx("Reject")}</Button>
                </>}</TableCell>
              </TableRow>))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    <ActionDialog open={!!deciding} title={tx(deciding?.approve ? "Approve payment run" : "Reject payment run")} confirmText={tx(deciding?.approve ? "Approve" : "Reject")}
      danger={!deciding?.approve} commentLabel={tx(deciding?.approve ? "Note" : "Reason")} commentRequired={!deciding?.approve} busy={busy}
      message={deciding ? `${deciding.run.runNo}: ${deciding.run.paymentCount} ${tx("payments")}, ${money(deciding.run.totalBaseAmount)}.` : undefined}
      onConfirm={(note) => void decide(note)} onClose={() => setDeciding(null)} />
  </>;
}

function Advances({ companyId, canManage, canApprove, onError, onNotice }: Props & { canManage: boolean; canApprove: boolean }) {
  const { tx } = useI18n();
  const [rows, setRows] = useState<SupplierAdvance[] | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);
  const [form, setForm] = useState({ supplierId: "", amount: "", currencyCode: "", exchangeRate: "1", paidOn: todayIso(), method: "BankTransfer", reference: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ row: SupplierAdvance; kind: "approve" | "reject" | "reverse" } | null>(null);
  async function load() { try { setRows(await payablesApi.advances(companyId)); } catch (e) { onError(apiError(e, "Unable to load supplier advances.")); setRows([]); } }
  useEffect(() => { void load(); if (canManage) void suppliersApi.lookup(companyId).then(setSuppliers).catch(() => setSuppliers([])); }, [companyId]);
  const supplier = suppliers.find(s => s.id === form.supplierId);
  async function record() {
    setBusy(true); onError(null);
    try {
      await payablesApi.recordAdvance(companyId, { supplierId: form.supplierId, amount: Number(form.amount), currencyCode: form.currencyCode || supplier?.currencyCode || null,
        exchangeRate: Number(form.exchangeRate) || 1, paidOn: form.paidOn, method: form.method, reference: form.reference.trim() || null, reason: form.reason.trim() });
      onNotice?.("Advance recorded. A second person approves it before it posts.");
      setForm(f => ({ ...f, amount: "", reference: "", reason: "" })); await load();
    } catch (e) { onError(apiError(e, "Unable to record the advance.")); }
    finally { setBusy(false); }
  }
  async function decide(reason: string) {
    if (!pending) return;
    setBusy(true); onError(null);
    const d = { version: pending.row.version, reason: reason || null };
    try {
      if (pending.kind === "approve") await payablesApi.approveAdvance(companyId, pending.row.id, d);
      else if (pending.kind === "reject") await payablesApi.rejectAdvance(companyId, pending.row.id, d);
      else await payablesApi.reverseAdvance(companyId, pending.row.id, d);
    } catch (e) { onError(apiError(e, "Unable to update the advance.")); }
    finally { setBusy(false); setPending(null); await load(); }
  }
  return <>
    {canManage && <Card>
      <CardHeader><CardTitle>{tx("Record a supplier advance")}</CardTitle></CardHeader>
      <CardContent className="p2p-grid">
        <LabeledSelect label={tx("Supplier")} value={form.supplierId} onChange={e => { const s = suppliers.find(x => x.id === e.target.value); setForm(f => ({ ...f, supplierId: e.target.value, currencyCode: s?.currencyCode ?? "" })); }}>
          <option value="">{tx("Choose a supplier")}</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
        </LabeledSelect>
        <FormField label={`${tx("Amount")}${form.currencyCode ? ` (${form.currencyCode})` : ""}`} type="number" min={0} step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        <FormField label={tx("Exchange rate")} type="number" min={0} step="0.0001" value={form.exchangeRate} help={tx("1 for company currency.")} onChange={e => setForm(f => ({ ...f, exchangeRate: e.target.value }))} />
        <FormField label={tx("Paid on")} type="date" value={form.paidOn} onChange={e => setForm(f => ({ ...f, paidOn: e.target.value }))} />
        <LabeledSelect label={tx("Method")} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>{METHODS.map(m => <option key={m} value={m}>{tx(m)}</option>)}</LabeledSelect>
        <FormField label={tx("Reference")} value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
        <FormField label={tx("Reason")} value={form.reason} placeholder={tx("For example: 30% deposit on PO-000123")} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
        <div className="prq-actions"><Button disabled={busy || !form.supplierId || !(Number(form.amount) > 0) || !form.reason.trim()} onClick={() => void record()}>{tx("Submit for approval")}</Button></div>
      </CardContent>
    </Card>}
    <Card>
      <CardHeader><CardTitle>{tx("Supplier advances")}</CardTitle></CardHeader>
      <CardContent>
        <p className="p2p-muted">{tx("Approved advances are applied from the supplier invoice page once the invoice is approved.")}</p>
        {!rows ? <StateMessage tone="loading">{tx("Loading...")}</StateMessage> : rows.length === 0 ? <EmptyState title={tx("No advances")} detail={tx("Prepayments to suppliers appear here.")} /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tx("Advance")}</TableHead><TableHead>{tx("Supplier")}</TableHead><TableHead>{tx("Paid on")}</TableHead><TableHead>{tx("Status")}</TableHead>
              <TableHead className="p2p-right">{tx("Amount")}</TableHead><TableHead className="p2p-right">{tx("Not yet applied")}</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>{rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.advanceNo}<div className="p2p-muted">{r.reason}</div></TableCell>
                <TableCell>{r.supplier ?? "-"}</TableCell><TableCell>{date(r.paidOn)}</TableCell>
                <TableCell><StatusChip status={r.status === "PendingApproval" ? "Pending approval" : r.status} />{r.reversalReason && <div className="p2p-muted">{r.reversalReason}</div>}</TableCell>
                <TableCell className="p2p-right">{money(r.amount, r.currencyCode)}</TableCell>
                <TableCell className="p2p-right">{money(r.unapplied, r.currencyCode)}</TableCell>
                <TableCell className="p2p-right">
                  {r.canDecide && <><Button size="sm" disabled={busy} onClick={() => setPending({ row: r, kind: "approve" })}>{tx("Approve")}</Button>{" "}
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setPending({ row: r, kind: "reject" })}>{tx("Reject")}</Button></>}
                  {canApprove && r.status === "Approved" && r.appliedAmount === 0 && <Button size="sm" variant="outline" disabled={busy} onClick={() => setPending({ row: r, kind: "reverse" })}>{tx("Reverse")}</Button>}
                </TableCell>
              </TableRow>))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    <ActionDialog open={!!pending} busy={busy} title={tx(pending?.kind === "approve" ? "Approve advance" : pending?.kind === "reject" ? "Reject advance" : "Reverse advance")}
      confirmText={tx(pending?.kind === "approve" ? "Approve" : pending?.kind === "reject" ? "Reject" : "Reverse")} danger={pending?.kind !== "approve"}
      commentLabel={pending?.kind === "approve" ? undefined : tx("Reason")} commentRequired={pending?.kind !== "approve"}
      message={pending ? `${pending.row.advanceNo}: ${money(pending.row.amount, pending.row.currencyCode)}` : undefined}
      onConfirm={(reason) => void decide(reason)} onClose={() => setPending(null)} />
  </>;
}

function Reports({ companyId, onError }: Props) {
  const { tx } = useI18n();
  const [asOf, setAsOf] = useState(todayIso());
  const [aging, setAging] = useState<ApAgingReport | null>(null);
  const [grni, setGrni] = useState<GrniReport | null>(null);
  const [recon, setRecon] = useState<ApReconciliation | null>(null);
  const [busy, setBusy] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);
  const [stmt, setStmt] = useState({ supplierId: "", from: todayIso(-90), to: todayIso() });
  const [statement, setStatement] = useState<SupplierStatement | null>(null);
  useEffect(() => { void suppliersApi.lookup(companyId, undefined, true).then(setSuppliers).catch(() => setSuppliers([])); }, [companyId]);
  async function run() {
    setBusy(true); onError(null);
    try {
      const [a, g] = await Promise.all([payablesApi.aging(companyId, asOf), payablesApi.grni(companyId, asOf)]);
      setAging(a); setGrni(g);
      try { setRecon(await payablesApi.reconciliation(companyId, asOf)); } catch { setRecon(null); }
    } catch (e) { onError(apiError(e, "Unable to run the payables reports.")); }
    finally { setBusy(false); }
  }
  async function runStatement() {
    setBusy(true); onError(null);
    try { setStatement(await payablesApi.statement(companyId, stmt.supplierId, stmt.from, stmt.to)); }
    catch (e) { onError(apiError(e, "Unable to build the supplier statement.")); }
    finally { setBusy(false); }
  }
  async function csv(action: () => Promise<void>) { try { await action(); } catch (e) { onError(apiError(e, "Unable to download the file.")); } }
  return <>
    <Card>
      <CardHeader><CardTitle>{tx("Month-end payables")}</CardTitle></CardHeader>
      <CardContent>
        <div className="p2p-grid">
          <FormField label={tx("As of")} type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
          <div className="prq-actions"><Button disabled={busy} onClick={() => void run()}>{tx(busy ? "Working..." : "Run reports")}</Button></div>
        </div>
        {aging && <section className="p2p-metrics">
          <Metric label={tx("Accounts payable")} value={money(aging.total, aging.currency)} />
          <Metric label={tx("Unapplied advances")} value={money(aging.unappliedAdvances, aging.currency)} />
          {grni && <Metric label={tx("Received not invoiced")} value={money(grni.total, aging.currency)} />}
          {recon && <Metric label={tx("Documents not yet posted")} value={String(recon.unpostedDocuments)} tone={recon.unpostedDocuments > 0 ? "warning" : "success"} />}
        </section>}
      </CardContent>
    </Card>
    {recon && <Card>
      <CardHeader><CardTitle>{tx("Reconciliation to the general ledger")}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>{tx("Area")}</TableHead><TableHead className="p2p-right">{tx("Subledger")}</TableHead><TableHead className="p2p-right">{tx("Ledger")}</TableHead>
            <TableHead className="p2p-right">{tx("Difference")}</TableHead><TableHead>{tx("Notes")}</TableHead></TableRow></TableHeader>
          <TableBody>{recon.lines.map(l => (
            <TableRow key={l.postingKey}>
              <TableCell>{tx(l.area)}</TableCell><TableCell className="p2p-right">{money(l.subledger, recon.currency)}</TableCell>
              <TableCell className="p2p-right">{money(l.ledger, recon.currency)}</TableCell>
              <TableCell className="p2p-right">{l.difference === 0 ? <StatusChip status="Reconciled" /> : money(l.difference, recon.currency)}</TableCell>
              <TableCell className="p2p-muted">{tx(l.note)}</TableCell>
            </TableRow>))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>}
    {aging && <Card>
      <CardHeader><CardTitle>{tx("Accounts payable ageing")}</CardTitle></CardHeader>
      <CardContent>
        <div className="prq-actions"><Button variant="outline" onClick={() => void csv(() => payablesApi.agingCsv(companyId, asOf))}>{tx("Download CSV")}</Button></div>
        {aging.suppliers.length === 0 ? <EmptyState title={tx("Nothing owed")} detail={tx("No supplier has an open balance on this date.")} /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tx("Supplier")}</TableHead><TableHead className="p2p-right">{tx("Current")}</TableHead><TableHead className="p2p-right">1–30</TableHead>
              <TableHead className="p2p-right">31–60</TableHead><TableHead className="p2p-right">61–90</TableHead><TableHead className="p2p-right">90+</TableHead>
              <TableHead className="p2p-right">{tx("Total")}</TableHead><TableHead className="p2p-right">{tx("Advances")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>{aging.suppliers.map(s => (
              <TableRow key={s.supplierId}>
                <TableCell>{s.supplier}</TableCell>
                {[s.current, s.days1To30, s.days31To60, s.days61To90, s.over90, s.total, s.unappliedAdvances].map((v, i) => <TableCell key={i} className="p2p-right">{v ? money(v) : "-"}</TableCell>)}
              </TableRow>))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>}
    {grni && <Card>
      <CardHeader><CardTitle>{tx("Goods received not invoiced")}</CardTitle></CardHeader>
      <CardContent>
        <div className="prq-actions"><Button variant="outline" onClick={() => void csv(() => payablesApi.grniCsv(companyId, asOf))}>{tx("Download CSV")}</Button></div>
        {grni.lines.length === 0 ? <EmptyState title={tx("Nothing to accrue")} detail={tx("Every received stock line is invoiced.")} /> : (
          <Table>
            <TableHeader><TableRow><TableHead>{tx("Supplier")}</TableHead><TableHead>{tx("Order")}</TableHead><TableHead>{tx("Item")}</TableHead>
              <TableHead className="p2p-right">{tx("Received")}</TableHead><TableHead className="p2p-right">{tx("Returned")}</TableHead><TableHead className="p2p-right">{tx("Invoiced")}</TableHead>
              <TableHead className="p2p-right">{tx("Not invoiced")}</TableHead><TableHead className="p2p-right">{tx("Value")}</TableHead></TableRow></TableHeader>
            <TableBody>{grni.lines.map(l => (
              <TableRow key={l.purchaseOrderLineId}>
                <TableCell>{l.supplier}</TableCell>
                <TableCell><Link to={`/companies/${companyId}/procurement/purchase-orders/${l.purchaseOrderId}`}>{l.poNo}</Link></TableCell>
                <TableCell>{l.item}</TableCell><TableCell className="p2p-right">{qty(l.receivedQty)}</TableCell><TableCell className="p2p-right">{qty(l.returnedQty)}</TableCell>
                <TableCell className="p2p-right">{qty(l.invoicedQty)}</TableCell><TableCell className="p2p-right">{qty(l.uninvoicedQty)}</TableCell><TableCell className="p2p-right">{money(l.value)}</TableCell>
              </TableRow>))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>}
    <Card>
      <CardHeader><CardTitle>{tx("Supplier statement")}</CardTitle></CardHeader>
      <CardContent>
        <div className="p2p-grid">
          <LabeledSelect label={tx("Supplier")} value={stmt.supplierId} onChange={e => setStmt(s => ({ ...s, supplierId: e.target.value }))}>
            <option value="">{tx("Choose a supplier")}</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
          </LabeledSelect>
          <FormField label={tx("From")} type="date" value={stmt.from} onChange={e => setStmt(s => ({ ...s, from: e.target.value }))} />
          <FormField label={tx("To")} type="date" value={stmt.to} onChange={e => setStmt(s => ({ ...s, to: e.target.value }))} />
          <div className="prq-actions">
            <Button disabled={busy || !stmt.supplierId} onClick={() => void runStatement()}>{tx("Show statement")}</Button>
            <Button variant="outline" disabled={!stmt.supplierId} onClick={() => void csv(() => payablesApi.statementCsv(companyId, stmt.supplierId, stmt.from, stmt.to))}>{tx("Download CSV")}</Button>
          </div>
        </div>
        {statement && <Table>
          <TableHeader><TableRow><TableHead>{tx("Date")}</TableHead><TableHead>{tx("Type")}</TableHead><TableHead>{tx("Reference")}</TableHead>
            <TableHead className="p2p-right">{tx("Charges")}</TableHead><TableHead className="p2p-right">{tx("Credits")}</TableHead><TableHead className="p2p-right">{tx("Balance")}</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>{date(statement.from)}</TableCell><TableCell>{tx("Opening balance")}</TableCell><TableCell /><TableCell /><TableCell />
              <TableCell className="p2p-right">{money(statement.opening, statement.currencyCode)}</TableCell></TableRow>
            {statement.lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell>{date(l.date)}</TableCell><TableCell>{tx(l.type)}</TableCell><TableCell>{l.reference}{l.description && <div className="p2p-muted">{l.description}</div>}</TableCell>
                <TableCell className="p2p-right">{l.charges ? money(l.charges, statement.currencyCode) : ""}</TableCell>
                <TableCell className="p2p-right">{l.credits ? money(l.credits, statement.currencyCode) : ""}</TableCell>
                <TableCell className="p2p-right">{money(l.balance, statement.currencyCode)}</TableCell>
              </TableRow>))}
          </TableBody>
        </Table>}
      </CardContent>
    </Card>
  </>;
}

function Revaluation({ companyId, onError, onNotice }: Props) {
  const { tx } = useI18n();
  const [asOf, setAsOf] = useState(todayIso());
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<FxRevaluationLine[] | null>(null);
  const [history, setHistory] = useState<FxRevaluation[]>([]);
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setHistory(await payablesApi.revaluations(companyId));
      const aging = await payablesApi.aging(companyId, asOf);
      setCurrencies([...new Set(aging.items.filter(i => i.currencyCode !== aging.currency).map(i => i.currencyCode))]);
    } catch (e) { onError(apiError(e, "Unable to load foreign-currency payables.")); }
  }
  useEffect(() => { void load(); setPreview(null); }, [companyId, asOf]);
  const body = useMemo(() => ({ asOf, rates: currencies.map(c => ({ currencyCode: c, rate: Number(rates[c]) || 0 })) }), [asOf, currencies, rates]);
  async function doPreview() {
    setBusy(true); onError(null);
    try { setPreview(await payablesApi.previewRevaluation(companyId, body)); } catch (e) { onError(apiError(e, "Unable to preview the revaluation.")); }
    finally { setBusy(false); }
  }
  async function post() {
    setBusy(true); onError(null);
    try { await payablesApi.revalue(companyId, body); onNotice?.("Revaluation posted. It is reversed automatically the next day."); setPreview(null); await load(); }
    catch (e) { onError(apiError(e, "Unable to post the revaluation.")); }
    finally { setBusy(false); }
  }
  return <Card>
    <CardHeader><CardTitle>{tx("Revalue foreign-currency payables")}</CardTitle></CardHeader>
    <CardContent>
      <p className="p2p-muted">{tx("At month end, open foreign-currency invoices are restated at the closing rate. The unrealised difference posts on the date and reverses the next day, so payments measure their realised difference from the invoice rate.")}</p>
      <div className="p2p-grid">
        <FormField label={tx("As of")} type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
        {currencies.map(c => <FormField key={c} label={`${c} ${tx("closing rate")}`} type="number" min={0} step="0.0001" value={rates[c] ?? ""} onChange={e => setRates(r => ({ ...r, [c]: e.target.value }))} />)}
      </div>
      {currencies.length === 0 ? <EmptyState title={tx("No foreign-currency balances")} detail={tx("There is nothing to revalue on this date.")} /> : <div className="prq-actions">
        <Button variant="outline" disabled={busy || currencies.some(c => !(Number(rates[c]) > 0))} onClick={() => void doPreview()}>{tx("Preview")}</Button>
        <Button disabled={busy || !preview || preview.every(l => l.difference === 0)} onClick={() => void post()}>{tx("Post revaluation")}</Button>
      </div>}
      {preview && <Table>
        <TableHeader><TableRow><TableHead>{tx("Currency")}</TableHead><TableHead className="p2p-right">{tx("Open")}</TableHead><TableHead className="p2p-right">{tx("Booked")}</TableHead>
          <TableHead className="p2p-right">{tx("At closing rate")}</TableHead><TableHead className="p2p-right">{tx("Difference")}</TableHead></TableRow></TableHeader>
        <TableBody>{preview.map(l => <TableRow key={l.currency}>
          <TableCell>{l.currency} @ {l.rate}</TableCell><TableCell className="p2p-right">{money(l.openAmount, l.currency)}</TableCell><TableCell className="p2p-right">{money(l.bookedBase)}</TableCell>
          <TableCell className="p2p-right">{money(l.revaluedBase)}</TableCell><TableCell className="p2p-right">{money(l.difference)} {l.difference > 0 ? tx("loss") : l.difference < 0 ? tx("gain") : ""}</TableCell>
        </TableRow>)}</TableBody>
      </Table>}
      {history.length > 0 && <>
        <h3>{tx("Posted revaluations")}</h3>
        <Table>
          <TableHeader><TableRow><TableHead>{tx("As of")}</TableHead><TableHead className="p2p-right">{tx("Net difference")}</TableHead></TableRow></TableHeader>
          <TableBody>{history.map(h => <TableRow key={h.id}><TableCell>{date(h.asOf)}</TableCell><TableCell className="p2p-right">{money(h.netDifference)}</TableCell></TableRow>)}</TableBody>
        </Table>
      </>}
    </CardContent>
  </Card>;
}
