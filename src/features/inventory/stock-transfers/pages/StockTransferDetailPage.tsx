import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import { StateMessage } from "../../../../components/ui/Feedback";
import { Card, DocHeader, Info, InfoGrid, Kpi, KpiRow, StatusPill } from "../../../../shared/ui/DocUI";
import { tableStyle, tdStyle, thStyle } from "../../../../shared/inventoryStyles";
import { stockTransfersApi } from "../api/stockTransfersApi";
import { buildStockTransferPaths } from "../routing/stockTransferRoutes";
import { STOCK_TRANSFER_TYPE, type StockTransferAction, type StockTransferDocumentDto } from "../types";
import { fmtDateTime, getApiError, money } from "../utils/apiUtils";
import {
  normalizeTransferType,
  qty,
  transferStatusLabel,
  transferStatusTone,
  routeParty,
  transferTypeLabel,
} from "../utils/stockTransferLabels";

type Pending =
  | { kind: "reason"; action: "reject" | "cancel" | "reverse" | "recall" }
  | { kind: "confirm"; action: "post" | "dispatch" | "approve" | "submit" }
  | { kind: "receive" }
  | null;

const reasonCopy: Record<"reject" | "cancel" | "reverse" | "recall", { title: string; help: string; button: string }> = {
  reject: { title: "Return to preparer", help: "Explain what must change. The preparer can edit and resubmit.", button: "Reject" },
  cancel: { title: "Cancel transfer", help: "No stock has moved. The transfer is closed and cannot be reopened.", button: "Cancel transfer" },
  reverse: { title: "Reverse posted transfer", help: "Stock goes back to the sending location at the same cost. Fails if the received stock was already used.", button: "Reverse" },
  recall: { title: "Recall from transit", help: "The stock returns to the sending location. Only possible before the receiving branch receives it.", button: "Recall" },
};

const confirmCopy: Record<"post" | "dispatch" | "approve" | "submit", { title: string; help: string; button: string }> = {
  submit: { title: "Submit for approval", help: "The transfer is locked until it is approved or returned.", button: "Submit" },
  approve: { title: "Approve transfer", help: "Stock is checked again when it is posted or dispatched.", button: "Approve" },
  post: { title: "Post transfer", help: "Stock moves now from the sending to the receiving location at FIFO cost.", button: "Post" },
  dispatch: { title: "Dispatch to the receiving branch", help: "Stock leaves the sending location and sits in transit until the receiving branch receives it.", button: "Dispatch" },
};

export default function StockTransferDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { companyId, branchId: selectedBranchId } = useAppScope();
  const branchId = search.get("branchId") || selectedBranchId;
  const paths = useMemo(() => buildStockTransferPaths(companyId), [companyId]);

  const [doc, setDoc] = useState<StockTransferDocumentDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [received, setReceived] = useState<Record<string, string>>({});
  const [receiptNotes, setReceiptNotes] = useState("");

  const load = useCallback(async () => {
    if (!companyId || !branchId || !id) return;
    try {
      setLoadError(null);
      const data = await stockTransfersApi.get(companyId, branchId, id);
      setDoc(data);
      setReceived(Object.fromEntries(data.items.map((line) => [line.id, String(line.quantity)])));
    } catch (e) {
      setLoadError(getApiError(e));
    }
  }, [companyId, branchId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId || !branchId || !paths) return <div style={{ padding: 16 }}>Select a company and branch first.</div>;
  if (loadError) return <div style={{ padding: 16 }}><StateMessage tone="error">{loadError}</StateMessage></div>;
  if (!doc) return <div style={{ padding: 16 }}><StateMessage tone="loading">Loading transfer…</StateMessage></div>;

  const type = normalizeTransferType(doc.transferType);
  const interBranch = type === STOCK_TRANSFER_TYPE.InterBranch;
  const can = (action: StockTransferAction) => doc.allowedActions.includes(action);
  const lines = [...doc.items].sort((a, b) => a.lineNo - b.lineNo);
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  const totalReceived = lines.reduce((s, l) => s + (l.receivedQty ?? 0), 0);
  const hasShortage = lines.some((l) => l.shortQty > 0);
  const showReceived = interBranch && (doc.postedAtUtc || pending?.kind === "receive");
  const showAvailable = !doc.dispatchedAtUtc && !doc.postedAtUtc && lines.some((l) => l.availableBaseQty != null);

  const run = async (work: () => Promise<void>, done: string) => {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await work();
      setPending(null);
      setReason("");
      setNotice(done);
      await load();
    } catch (e) {
      setActionError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const doConfirm = (action: "post" | "dispatch" | "approve" | "submit") => {
    const call = {
      submit: () => stockTransfersApi.submit(companyId, branchId, id),
      approve: () => stockTransfersApi.approve(companyId, branchId, id),
      post: () => stockTransfersApi.post(companyId, branchId, id),
      dispatch: () => stockTransfersApi.post(companyId, branchId, id),
    }[action];
    const done = { submit: "Submitted for approval.", approve: "Approved.", post: "Posted. Stock has moved.", dispatch: "Dispatched. Stock is in transit." }[action];
    void run(call, done);
  };

  const doReason = (action: "reject" | "cancel" | "reverse" | "recall") => {
    if (!reason.trim()) {
      setActionError("A reason is required.");
      return;
    }
    const call = {
      reject: () => stockTransfersApi.reject(companyId, branchId, id, reason.trim()),
      cancel: () => stockTransfersApi.cancel(companyId, branchId, id, reason.trim()),
      reverse: () => stockTransfersApi.reverse(companyId, branchId, id, reason.trim()),
      recall: () => stockTransfersApi.reverse(companyId, branchId, id, reason.trim()),
    }[action];
    const done = { reject: "Returned to the preparer.", cancel: "Cancelled.", reverse: "Reversed. Stock is back at the sending location.", recall: "Recalled. Stock is back at the sending location." }[action];
    void run(call, done);
  };

  const doReceive = () => {
    const parsed = lines.map((line) => ({ lineId: line.id, receivedQty: Number(received[line.id]) }));
    const bad = parsed.find((p, i) => !Number.isFinite(p.receivedQty) || p.receivedQty < 0 || p.receivedQty > lines[i].quantity);
    if (bad) {
      setActionError("Each received quantity must be between 0 and the dispatched quantity.");
      return;
    }
    if (parsed.every((p) => p.receivedQty === 0)) {
      setActionError("Nothing received. Ask the sending branch to recall the transfer instead.");
      return;
    }
    const short = parsed.some((p, i) => p.receivedQty < lines[i].quantity);
    if (short && !receiptNotes.trim()) {
      setActionError("Explain the shortage in the receipt notes.");
      return;
    }
    void run(
      () => stockTransfersApi.receive(companyId, branchId, id, { notes: receiptNotes.trim() || null, lines: parsed }),
      short ? "Received with a shortage. The missing stock stays in transit for follow-up." : "Received in full."
    );
  };

  const actionButtons = (
    <>
      {can("edit") ? <Button variant="outline" disabled={busy} onClick={() => navigate(branchId !== selectedBranchId ? `${paths.edit(id)}?branchId=${encodeURIComponent(branchId)}` : paths.edit(id))}>Edit</Button> : null}
      {can("submit") ? <Button disabled={busy} onClick={() => setPending({ kind: "confirm", action: "submit" })}>Submit</Button> : null}
      {can("approve") ? <Button disabled={busy} onClick={() => setPending({ kind: "confirm", action: "approve" })}>Approve</Button> : null}
      {can("post") ? <Button disabled={busy} onClick={() => setPending({ kind: "confirm", action: "post" })}>Post</Button> : null}
      {can("dispatch") ? <Button disabled={busy} onClick={() => setPending({ kind: "confirm", action: "dispatch" })}>Dispatch</Button> : null}
      {can("receive") ? <Button disabled={busy} onClick={() => setPending({ kind: "receive" })}>Receive</Button> : null}
      {can("reject") ? <Button variant="outline" disabled={busy} onClick={() => setPending({ kind: "reason", action: "reject" })}>Reject</Button> : null}
      {can("recall") ? <Button variant="outline" disabled={busy} onClick={() => setPending({ kind: "reason", action: "recall" })}>Recall</Button> : null}
      {can("reverse") ? <Button variant="outline" disabled={busy} onClick={() => setPending({ kind: "reason", action: "reverse" })}>Reverse</Button> : null}
      {can("cancel") ? <Button variant="destructive" disabled={busy} onClick={() => setPending({ kind: "reason", action: "cancel" })}>Cancel</Button> : null}
    </>
  );

  const fromParty = routeParty(doc.fromLocationName, doc.fromBranchName);
  const toParty = routeParty(doc.toLocationName, doc.toBranchName);

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
      <DocHeader
        title={
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {doc.transferNumber}
            <StatusPill text={transferStatusLabel(doc.status, type)} tone={transferStatusTone(doc.status)} />
            {doc.direction === "incoming" ? <StatusPill text="Incoming" tone="bg-indigo-50 text-indigo-700" /> : null}
          </span>
        }
        subtitle={`${transferTypeLabel(type)} · ${fromParty} → ${toParty}`}
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={() => navigate(paths.list)}>Back to list</Button>
            {actionButtons}
          </div>
        }
      />

      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {actionError ? <StateMessage tone="error">{actionError}</StateMessage> : null}
      {doc.rejectionReason && doc.allowedActions.includes("edit") ? <StateMessage tone="warning">Returned: {doc.rejectionReason}</StateMessage> : null}
      {hasShortage ? (
        <StateMessage tone="warning">
          Short received: {qty(totalQty - totalReceived)} units worth {money(doc.shortValue)} remain in {doc.transitLocationName ?? "transit"} at the sending branch. Investigate and adjust the in-transit stock.
        </StateMessage>
      ) : null}
      {doc.status && String(doc.status).toLowerCase() === "issued" && doc.direction === "outgoing" ? (
        <StateMessage tone="info">In transit since {fmtDateTime(doc.dispatchedAtUtc)}. Waiting for {doc.toBranchName ?? "the receiving branch"} to receive it.</StateMessage>
      ) : null}

      {pending?.kind === "confirm" ? (
        <Card title={confirmCopy[pending.action].title} subtitle={confirmCopy[pending.action].help}>
          <div style={{ display: "flex", gap: 8 }}>
            <Button disabled={busy} onClick={() => doConfirm(pending.action)}>{busy ? "Working…" : confirmCopy[pending.action].button}</Button>
            <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>Back</Button>
          </div>
        </Card>
      ) : null}

      {pending?.kind === "reason" ? (
        <Card title={reasonCopy[pending.action].title} subtitle={reasonCopy[pending.action].help}>
          <label className="ui-field-help" htmlFor="st-reason">Reason *</label>
          <Textarea id="st-reason" rows={3} maxLength={500} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button variant={pending.action === "cancel" ? "destructive" : "default"} disabled={busy} onClick={() => doReason(pending.action)}>
              {busy ? "Working…" : reasonCopy[pending.action].button}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>Back</Button>
          </div>
        </Card>
      ) : null}

      <KpiRow>
        <Kpi label="Lines" value={lines.length} />
        <Kpi label="Quantity" value={qty(totalQty)} />
        {interBranch && doc.postedAtUtc ? <Kpi label="Received" value={qty(totalReceived)} /> : null}
        <Kpi label="Value at cost" value={doc.totalValue != null ? money(doc.totalValue) : "On posting"} />
        <Kpi label="Requested" value={fmtDateTime(doc.transferDateUtc)} />
      </KpiRow>

      <Card title="Route">
        <InfoGrid>
          <Info label="From location" value={doc.fromLocationName} />
          <Info label="From branch" value={doc.fromBranchName} />
          {doc.fromDepartmentName ? <Info label="From department" value={doc.fromDepartmentName} /> : null}
          {interBranch ? <Info label="In transit at" value={doc.transitLocationName ?? "Assigned on dispatch"} /> : null}
          <Info label="To location" value={doc.toLocationName} />
          <Info label="To branch" value={doc.toBranchName} />
          {doc.toDepartmentName ? <Info label="To department" value={doc.toDepartmentName} /> : null}
          <Info label="Notes" value={doc.reference} />
        </InfoGrid>
      </Card>

      <Card
        title={pending?.kind === "receive" ? "Count what arrived" : "Lines"}
        subtitle={pending?.kind === "receive" ? "Enter the quantity actually received for each line. A shortfall stays in transit at the sending branch." : undefined}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Unit</th>
                <th style={{ ...thStyle, textAlign: "right" }}>{interBranch ? "Dispatched" : "Quantity"}</th>
                {showReceived ? <th style={{ ...thStyle, textAlign: "right" }}>Received</th> : null}
                {showReceived && doc.postedAtUtc ? <th style={{ ...thStyle, textAlign: "right" }}>Short</th> : null}
                {showAvailable ? <th style={{ ...thStyle, textAlign: "right" }}>Available at source</th> : null}
                <th style={{ ...thStyle, textAlign: "right" }}>Unit cost</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Value</th>
                <th style={thStyle}>Note</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td style={tdStyle}>{line.lineNo}</td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{line.itemName ?? line.itemId}</div>
                    {line.itemCode ? <div className="ui-field-help">{line.itemCode}</div> : null}
                  </td>
                  <td style={tdStyle}>{line.uomCode ?? line.uomName ?? "-"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{qty(line.quantity)}</td>
                  {showReceived ? (
                    <td style={{ ...tdStyle, textAlign: "right", width: 130 }}>
                      {pending?.kind === "receive" ? (
                        <Input
                          aria-label={`Received quantity for line ${line.lineNo}`}
                          type="number"
                          min={0}
                          max={line.quantity}
                          step="any"
                          inputMode="decimal"
                          style={{ textAlign: "right" }}
                          value={received[line.id] ?? ""}
                          disabled={busy}
                          onChange={(e) => setReceived((prev) => ({ ...prev, [line.id]: e.target.value }))}
                        />
                      ) : (
                        qty(line.receivedQty)
                      )}
                    </td>
                  ) : null}
                  {showReceived && doc.postedAtUtc ? <td style={{ ...tdStyle, textAlign: "right" }}>{line.shortQty > 0 ? qty(line.shortQty) : "-"}</td> : null}
                  {showAvailable ? (
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {line.availableBaseQty != null ? `${qty(line.availableBaseQty)} ${line.baseUomCode ?? ""}` : "-"}
                    </td>
                  ) : null}
                  <td style={{ ...tdStyle, textAlign: "right" }}>{line.avgUnitCost != null ? money(line.avgUnitCost) : "-"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{line.lineValue != null ? money(line.lineValue) : "-"}</td>
                  <td style={tdStyle}>{line.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pending?.kind === "receive" ? (
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <label className="ui-field-help" htmlFor="st-receipt-notes">Receipt notes (required when short)</label>
            <Textarea id="st-receipt-notes" rows={2} maxLength={500} value={receiptNotes} disabled={busy} onChange={(e) => setReceiptNotes(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <Button disabled={busy} onClick={doReceive}>{busy ? "Receiving…" : "Confirm receipt"}</Button>
              <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>Back</Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card title="History">
        <InfoGrid>
          <Info label="Created" value={fmtDateTime(doc.createdAtUtc)} />
          <Info label="Submitted" value={fmtDateTime(doc.submittedAtUtc)} />
          <Info label="Approved" value={fmtDateTime(doc.approvedAtUtc)} />
          {interBranch ? <Info label="Dispatched" value={fmtDateTime(doc.dispatchedAtUtc)} /> : null}
          <Info label={interBranch ? "Received" : "Posted"} value={fmtDateTime(doc.postedAtUtc)} />
          {doc.receiptNotes ? <Info label="Receipt notes" value={doc.receiptNotes} /> : null}
          {doc.rejectedAtUtc ? <Info label="Rejected" value={`${fmtDateTime(doc.rejectedAtUtc)} – ${doc.rejectionReason ?? ""}`} /> : null}
          {doc.cancelledAtUtc ? <Info label="Cancelled" value={`${fmtDateTime(doc.cancelledAtUtc)} – ${doc.cancellationReason ?? ""}`} /> : null}
          {doc.reversedAtUtc ? <Info label={interBranch ? "Recalled" : "Reversed"} value={`${fmtDateTime(doc.reversedAtUtc)} – ${doc.reversalReason ?? ""}`} /> : null}
        </InfoGrid>
      </Card>
    </div>
  );
}
