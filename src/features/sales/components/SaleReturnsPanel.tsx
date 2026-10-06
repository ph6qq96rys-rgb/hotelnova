import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, RotateCcw, Trash2, X } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Textarea } from "../../../components/ui/textarea";
import { useAppScope } from "../../../app/useAppScope";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import { PosDialog } from "../../pos/components/PosDialog";
import { money } from "../../pos/components/posUi";
import { extractApiError } from "../../pos/utils/posUtils";
import {
  REFUND_METHODS, saleReturnsApi,
  type RefundRequest, type ReturnPreviewDto, type ReturnableSaleDto, type SaleReturnDto,
} from "../api/saleReturnsApi";
import "../../pos/pos-service.css";

const statusLabel: Record<string, string> = { requested: "Waiting for approval", approved: "Approved", rejected: "Rejected" };
const stockLabel: Record<string, string> = { notRequired: "No stock to put back", pending: "Stock waiting", posted: "Back in stock", failed: "Stock posting failed" };

type Draft = {
  qty: Record<string, string>;
  restock: Record<string, boolean>;
  reason: string;
  refunds: Array<{ method: string; amount: string; reference: string }>;
};

/** Approve / reject buttons and dialogs for one return, shared by the sale page and the returns list. */
export function ReturnDecision({ item, onDone }: { item: SaleReturnDto; onDone: (message: string) => void }) {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => ({ companyId: companyId ?? "", branchId: branchId ?? "" }), [companyId, branchId]);
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canApprove = useHasPermission("sales.refund.approve");

  if (item.status === "approved" && (item.stockStatus === "failed" || item.stockStatus === "pending")) {
    if (!canApprove) return null;
    return (
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void (async () => {
        setBusy(true);
        try { await saleReturnsApi.retryStock(scope, item.id); onDone(tx("Stock posting retried.")); }
        catch (err) { setError(extractApiError(err, "Stock could not be put back.")); }
        finally { setBusy(false); }
      })()}>
        <RotateCcw size={14} aria-hidden="true" /> {tx("Retry stock")}
        {error ? <span className="rpos-muted"> {error}</span> : null}
      </Button>
    );
  }
  if (item.status !== "requested") return null;
  if (!item.canDecide) return item.decideBlockedReason ? <span className="rpos-muted">{tx(item.decideBlockedReason)}</span> : null;

  return (
    <>
      <Button type="button" size="sm" onClick={() => { setMode("approve"); setNote(""); setError(null); }}><Check size={14} aria-hidden="true" /> {tx("Approve")}</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => { setMode("reject"); setNote(""); setError(null); }}><X size={14} aria-hidden="true" /> {tx("Reject")}</Button>
      <PosDialog open={!!mode} title={`${tx(mode === "approve" ? "Approve return" : "Reject return")} · ${item.returnNo}`}
        description={`${item.saleNo} · ${money(item.totalAmount)} · ${tx("Refund")} ${money(item.refundAmount)} · ${item.reason}`}
        confirmText={tx(mode === "approve" ? "Approve and refund" : "Reject")} danger={mode === "reject"} busy={busy}
        confirmDisabled={mode === "reject" ? note.trim().length < 3 : note.trim().length > 0 && note.trim().length < 3}
        onClose={() => setMode(null)}
        onConfirm={() => void (async () => {
          setBusy(true);
          setError(null);
          try {
            if (mode === "approve") await saleReturnsApi.approve(scope, item.id, note.trim());
            else await saleReturnsApi.reject(scope, item.id, note.trim());
            setMode(null);
            onDone(tx(mode === "approve" ? "Return approved. Refund the guest from the drawer." : "Return rejected."));
          } catch (err) {
            setError(extractApiError(err, "The return could not be decided."));
          } finally {
            setBusy(false);
          }
        })()}>
        <ul className="rpos-muted">
          {item.lines.map((line) => <li key={line.saleItemId}>{line.quantity} × {line.itemName} · {money(line.totalAmount)}{line.restock ? ` · ${tx("back to stock")}` : ""}</li>)}
          {item.refunds.map((refund, index) => <li key={index}>{tx("Refund")} {tx(refund.method)} {money(refund.amount)}{refund.referenceCode ? ` · ${refund.referenceCode}` : ""}</li>)}
        </ul>
        <label className="rpos-field"><span>{tx(mode === "approve" ? "Note (optional)" : "Why is it rejected?")}</span>
          <Textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      </PosDialog>
    </>
  );
}

/**
 * Returns on one sale: what is left to return, earlier credit notes and their approval, and the
 * cashier's request form (quantities, restock, reason and how the money goes back).
 */
export function SaleReturnsPanel({ saleId, onChanged }: { saleId: string; onChanged?: () => void }) {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => ({ companyId: companyId ?? "", branchId: branchId ?? "" }), [companyId, branchId]);
  const canRequest = useHasPermission("pos.sell");

  const [info, setInfo] = useState<ReturnableSaleDto | null>(null);
  const [returns, setReturns] = useState<SaleReturnDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<ReturnPreviewDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!scope.companyId || !scope.branchId) return;
    try {
      const returnable = await saleReturnsApi.returnable(scope, saleId);
      setInfo(returnable);
      setReturns((await saleReturnsApi.list(scope, { search: returnable.saleNo })).filter((x) => x.saleId === saleId));
    } catch (err) {
      setError(extractApiError(err, "Unable to load returns for this sale."));
    }
  }, [scope, saleId]);

  useEffect(() => { void load(); }, [load]);

  const lines = useMemo(() => (info && draft ? info.lines
    .map((line) => ({ saleItemId: line.saleItemId, quantity: Number(draft.qty[line.saleItemId]) || 0, restock: !!draft.restock[line.saleItemId] }))
    .filter((line) => line.quantity > 0) : []), [info, draft]);
  const linesKey = JSON.stringify(lines);

  // The server prices the return and says how much money goes back.
  useEffect(() => {
    if (!draft || lines.length === 0) { setPreview(null); return; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      saleReturnsApi.preview(scope, saleId, lines)
        .then((result) => {
          if (cancelled) return;
          setPreview(result);
          setDraft((d) => d && d.refunds.length <= 1
            ? { ...d, refunds: result.refundDue > 0 ? [{ method: d.refunds[0]?.method ?? "CASH", amount: result.refundDue.toFixed(2), reference: d.refunds[0]?.reference ?? "" }] : [] }
            : d);
        })
        .catch((err) => { if (!cancelled) { setPreview(null); setError(extractApiError(err, "Unable to price the return.")); } });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, scope, saleId]);

  const refunds: RefundRequest[] = (draft?.refunds ?? []).map((r) => ({ method: r.method, amount: Math.round(Number(r.amount) * 100) / 100, referenceCode: r.reference.trim() || null }));
  const refundTotal = refunds.reduce((sum, r) => sum + (r.amount || 0), 0);
  const overLimit = info && draft ? info.lines.find((line) => (Number(draft.qty[line.saleItemId]) || 0) > line.remainingQuantity) : undefined;
  const problem = !draft ? null
    : lines.length === 0 ? "Choose at least one item to return."
    : overLimit ? "You cannot return more than is left on the line."
    : draft.reason.trim().length < 3 ? "Give a reason for the return."
    : !preview ? "Pricing the return..."
    : Math.abs(refundTotal - preview.refundDue) > 0.005 ? "The refund must equal the amount due back."
    : refunds.some((r) => r.method !== "CASH" && !r.referenceCode) ? "Card, mobile and transfer refunds need their reference."
    : null;

  const pending = returns.filter((r) => r.status === "requested").length;

  return (
    <section className="rpos-setup-area" aria-label={tx("Returns and refunds")}>
      <h2>{tx("Returns and refunds")}</h2>
      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {info ? (
        <p className="rpos-muted">
          {tx("Paid")} {money(info.paidAmount)} · {tx("Returned")} {money(info.returnedAmount)} · {tx("Refunded")} {money(info.refundedAmount)} · {tx("Balance due")} {money(info.balanceDue)}
          {!info.canReturn && info.blockedReason ? ` · ${tx(info.blockedReason)}` : ""}
        </p>
      ) : null}
      {canRequest && info?.canReturn ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => { setError(null); setNotice(null); setDraft({ qty: {}, restock: {}, reason: "", refunds: [] }); }}>
          <RotateCcw size={14} aria-hidden="true" /> {tx("Return items")}
        </Button>
      ) : null}

      {returns.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Return")}</TableHead>
              <TableHead>{tx("Requested")}</TableHead>
              <TableHead>{tx("Status")}</TableHead>
              <TableHead className="rpos-num">{tx("Total")}</TableHead>
              <TableHead className="rpos-num">{tx("Refund")}</TableHead>
              <TableHead>{tx("Stock")}</TableHead>
              <TableHead><span className="sr-only">{tx("Actions")}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.map((r) => (
              <TableRow key={r.id} className={r.status === "requested" ? "is-stale" : undefined}>
                <TableCell>{r.returnNo}<br /><span className="rpos-muted">{r.reason}</span></TableCell>
                <TableCell>{r.requestedByName}<br /><span className="rpos-muted">{formatAppDateTime(r.requestedAtUtc)}</span></TableCell>
                <TableCell>{tx(statusLabel[r.status] ?? r.status)}{r.decidedByName ? <><br /><span className="rpos-muted">{r.decidedByName}{r.decisionNote ? ` · ${r.decisionNote}` : ""}</span></> : null}</TableCell>
                <TableCell className="rpos-num">{money(r.totalAmount)}</TableCell>
                <TableCell className="rpos-num">{money(r.refundAmount)}</TableCell>
                <TableCell>{tx(stockLabel[r.stockStatus] ?? r.stockStatus)}{r.stockError ? <><br /><span className="rpos-muted">{r.stockError}</span></> : null}</TableCell>
                <TableCell className="rpos-row-actions"><ReturnDecision item={r} onDone={(message) => { setNotice(message); void load(); onChanged?.(); }} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      {pending > 0 ? <p className="rpos-muted">{tx("A supervisor who did not make the sale or ask for the return approves it.")}</p> : null}

      <PosDialog open={!!draft} title={`${tx("Return items")} · ${info?.saleNo ?? ""}`}
        description={tx("A supervisor approves the return before money goes back. The refund leaves your drawer.")}
        confirmText={tx("Ask for approval")} busy={busy} confirmDisabled={!!problem}
        onClose={() => { setDraft(null); setPreview(null); }}
        onConfirm={() => void (async () => {
          if (!draft) return;
          setBusy(true);
          setError(null);
          try {
            await saleReturnsApi.request(scope, saleId, { reason: draft.reason.trim(), lines, refunds: refunds.filter((r) => r.amount > 0) });
            setDraft(null);
            setPreview(null);
            setNotice(tx("Return requested. A supervisor must approve it."));
            await load();
            onChanged?.();
          } catch (err) {
            setError(extractApiError(err, "The return could not be requested."));
          } finally {
            setBusy(false);
          }
        })()}>
        {draft && info ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Item")}</TableHead>
                  <TableHead className="rpos-num">{tx("Left")}</TableHead>
                  <TableHead className="rpos-num">{tx("Return")}</TableHead>
                  <TableHead>{tx("Back to stock")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {info.lines.filter((line) => line.remainingQuantity > 0).map((line) => (
                  <TableRow key={line.saleItemId}>
                    <TableCell>{line.itemName}<br /><span className="rpos-muted">{money(line.unitPrice)}</span></TableCell>
                    <TableCell className="rpos-num">{line.remainingQuantity}</TableCell>
                    <TableCell className="rpos-num">
                      <Input type="number" inputMode="decimal" min="0" max={line.remainingQuantity} step="1" aria-label={`${tx("Return")} ${line.itemName}`}
                        value={draft.qty[line.saleItemId] ?? ""} style={{ maxWidth: 90 }}
                        onChange={(e) => setDraft({ ...draft, qty: { ...draft.qty, [line.saleItemId]: e.target.value } })} />
                    </TableCell>
                    <TableCell>
                      <label className="rpos-check">
                        <Checkbox disabled={!line.stockTracked} checked={!!draft.restock[line.saleItemId]}
                          onChange={(e) => setDraft({ ...draft, restock: { ...draft.restock, [line.saleItemId]: e.target.checked } })} />
                        <span>{tx(line.stockTracked ? "Unopened, resell" : "Not a stock item")}</span>
                      </label>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview ? (
              <dl className="rpos-totals">
                <div><dt>{tx("Items")}</dt><dd>{money(preview.subTotal - preview.discountAmount)}</dd></div>
                <div><dt>{tx("VAT")}</dt><dd>{money(preview.taxAmount)}</dd></div>
                <div><dt>{tx("Service charge")}</dt><dd>{money(preview.serviceChargeAmount)}</dd></div>
                <div className="rpos-grand"><dt>{tx("Credit note")}</dt><dd>{money(preview.totalAmount)}</dd></div>
                <div><dt>{tx("Money back to the guest")}</dt><dd>{money(preview.refundDue)}</dd></div>
                {preview.balanceReduced > 0 ? <div><dt>{tx("Taken off the unpaid balance")}</dt><dd>{money(preview.balanceReduced)}</dd></div> : null}
              </dl>
            ) : null}
            {preview && preview.refundDue > 0 ? (
              <div className="rpos-oo-add">
                {draft.refunds.map((refund, index) => (
                  <div key={index} className="rpos-form-grid">
                    <label className="rpos-field"><span>{tx("Refund by")}</span>
                      <Select value={refund.method} onChange={(e) => setDraft({ ...draft, refunds: draft.refunds.map((r, i) => i === index ? { ...r, method: e.target.value } : r) })}>
                        {REFUND_METHODS.filter((m) => m === "CASH" || info.tenders.some((t) => t.method === m)).map((m) => <option key={m} value={m}>{tx(m)}</option>)}
                      </Select>
                    </label>
                    <label className="rpos-field"><span>{tx("Amount")}</span>
                      <Input type="number" inputMode="decimal" min="0" step="0.01" value={refund.amount}
                        onChange={(e) => setDraft({ ...draft, refunds: draft.refunds.map((r, i) => i === index ? { ...r, amount: e.target.value } : r) })} />
                    </label>
                    {refund.method !== "CASH" ? (
                      <label className="rpos-field"><span>{tx("Payment Reference")}</span>
                        <Input value={refund.reference} maxLength={100}
                          onChange={(e) => setDraft({ ...draft, refunds: draft.refunds.map((r, i) => i === index ? { ...r, reference: e.target.value } : r) })} />
                      </label>
                    ) : null}
                    {draft.refunds.length > 1 ? (
                      <Button type="button" size="sm" variant="outline" aria-label={tx("Remove")} onClick={() => setDraft({ ...draft, refunds: draft.refunds.filter((_, i) => i !== index) })}>
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, refunds: [...draft.refunds, { method: "CASH", amount: "", reference: "" }] })}>
                  <Plus size={14} aria-hidden="true" /> {tx("Split the refund")}
                </Button>
              </div>
            ) : null}
            <label className="rpos-field"><span>{tx("Reason")}</span>
              <Textarea rows={2} maxLength={300} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} />
            </label>
            {problem ? <p className="rpos-muted">{tx(problem)}</p> : null}
            {error ? <StateMessage tone="error">{error}</StateMessage> : null}
          </>
        ) : null}
      </PosDialog>
    </section>
  );
}
