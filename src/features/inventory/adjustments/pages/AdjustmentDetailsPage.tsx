// src/features/inventory/adjustments/pages/AdjustmentDetailsPage.tsx

import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAppScope } from "../../../../app/useAppScope";
import { formatCurrency } from "../../../../shared/currency/currencyFormat";
import { adjustmentApi, getApiError } from "../api/adjustmentApi";
import AdjustmentWorkflowActionBar from "../components/AdjustmentWorkflowActionBar";
import {
  ADJUSTMENT_TYPE_LABELS,
  availableActions,
  normalizeAdjustmentStatus,
  STATUS_BADGE,
  STATUS_LABEL,
  useAdjustmentPermissions,
} from "../utils/adjustmentWorkflow";
import type { InventoryAdjustmentDto, InventoryAdjustmentLineDto } from "../types";
import { Button } from "../../../../components/ui/button";

type ConfirmAction = "reject" | "reverse" | "cancel" | null;

function fmtDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtQty(value?: number | null): string {
  return Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function signedQty(value: number): string {
  return `${value > 0 ? "+" : ""}${fmtQty(value)}`;
}

function signedMoney(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatCurrency(Math.abs(value))}`;
}

function tone(value: number): string {
  if (value > 0) return "var(--success)";
  if (value < 0) return "var(--danger)";
  return "var(--text)";
}

function stockMoved(line: InventoryAdjustmentLineDto): boolean {
  return line.currentQtyBase !== undefined && line.currentQtyBase !== null && Math.abs(line.currentQtyBase - line.systemQtyBase) > 0.0000005;
}

function InfoField({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? "span 2" : undefined }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", whiteSpace: "pre-wrap" }}>{value || "-"}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
      {children}
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  placeholder,
  confirmLabel,
  working,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  placeholder: string;
  confirmLabel: string;
  working: boolean;
  error: string | null;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="page">
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <section className="card" style={{ width: "100%", maxWidth: 480, padding: 24 }} role="dialog" aria-modal="true" aria-label={title}>
          <h2 style={{ margin: 0, marginBottom: 8, fontSize: 18 }}>{title}</h2>
          <p style={{ margin: 0, marginBottom: 16, color: "var(--text-muted)", fontSize: 13 }}>{body}</p>
          {error && <div className="alert alert-danger">{error}</div>}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={placeholder}
            disabled={working}
            autoFocus
            maxLength={500}
            style={{
              width: "100%", minHeight: 96, resize: "vertical", boxSizing: "border-box", padding: "10px 12px",
              borderRadius: "var(--r)", border: "1px solid var(--border)", background: "var(--surface-2)",
              color: "var(--text)", fontFamily: "inherit", fontSize: 13, marginBottom: 16,
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="bare" type="button" className="btn" disabled={working} onClick={onCancel}>
              Back
            </Button>
            <Button variant="bare" type="button" className="btn btn-danger" disabled={working || !text.trim()} onClick={() => onConfirm(text.trim())}>
              {working ? "Working..." : confirmLabel}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function AuditTrail({ item }: { item: InventoryAdjustmentDto }) {
  const steps: { label: string; who?: string; at?: string; note?: string; tone?: string }[] = [
    { label: "Prepared", who: item.createdByName, at: item.createdAt },
  ];
  if (item.submittedAt) steps.push({ label: "Submitted", who: item.submittedByName, at: item.submittedAt });
  if (item.rejectedAt) steps.push({ label: "Rejected", who: item.rejectedByName, at: item.rejectedAt, note: item.rejectionNote, tone: "var(--danger)" });
  if (item.approvedAt)
    steps.push({ label: item.autoApproved ? "Approved by policy" : "Approved", who: item.approvedByName, at: item.approvedAt, note: item.approvalNote });
  if (item.postedAt) steps.push({ label: "Posted to stock", who: item.postedByName, at: item.postedAt, tone: "var(--success)" });
  if (item.cancelledAt) steps.push({ label: "Cancelled", who: item.cancelledByName, at: item.cancelledAt, note: item.cancelReason, tone: "var(--danger)" });
  if (item.reversedAt) steps.push({ label: "Reversed", who: item.reversedByName, at: item.reversedAt, note: item.reverseReason, tone: "var(--danger)" });

  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
      {steps.map((step, index) => (
        <li key={`${step.label}-${index}`} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: step.tone ?? "var(--text)" }}>{step.label}</div>
          <div>
            <div>
              {step.who || "-"} <span style={{ color: "var(--text-muted)" }}>· {fmtDateTime(step.at)}</span>
            </div>
            {step.note && <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{step.note}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

const GL_LABEL: Record<string, string> = {
  NotPosted: "Not posted",
  Waiting: "Waiting",
  Posted: "Posted",
  Failed: "Failed, needs attention",
  Skipped: "Not needed",
};

export default function AdjustmentDetailsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { adjustmentId } = useParams<{ adjustmentId: string }>();
  const { companyId, branchId } = useAppScope();
  const permissions = useAdjustmentPermissions();

  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<ConfirmAction>(null);

  const basePath = companyId ? `/companies/${companyId}/inventory/adjustments` : "";
  const queryKey = useMemo(() => ["inventory-adjustment", companyId, branchId, adjustmentId] as const, [companyId, branchId, adjustmentId]);

  const { data: item, isLoading, error: loadError } = useQuery({
    queryKey,
    queryFn: () => adjustmentApi.get(companyId!, branchId!, adjustmentId!),
    enabled: Boolean(companyId && branchId && adjustmentId),
  });

  const status = normalizeAdjustmentStatus(item?.docStatus);
  const actions = availableActions(status, permissions);

  const totals = useMemo(() => {
    const lines = item?.lines ?? [];
    return {
      found: lines.filter((l) => l.lineAmount > 0).reduce((sum, l) => sum + l.lineAmount, 0),
      missing: lines.filter((l) => l.lineAmount < 0).reduce((sum, l) => sum + l.lineAmount, 0),
      net: item?.totalAdjustmentValue ?? lines.reduce((sum, l) => sum + l.lineAmount, 0),
      changed: lines.filter((l) => l.adjustmentQtyBase !== 0).length,
      moved: lines.filter(stockMoved).length,
      needApproval: lines.filter((l) => l.requiresApproval || l.isHighVariance).length,
    };
  }, [item]);

  const goBack = useCallback(() => {
    if (basePath) navigate(basePath);
  }, [basePath, navigate]);

  const run = useCallback(
    async (label: string, action: () => Promise<void>) => {
      setWorking(true);
      setActionError(null);
      setNotice(null);
      try {
        await action();
        await queryClient.invalidateQueries({ queryKey });
        setModal(null);
        setNotice(label);
      } catch (error) {
        setActionError(getApiError(error, "The action failed."));
        // A conflict means someone else changed the document: show the current version.
        await queryClient.invalidateQueries({ queryKey });
      } finally {
        setWorking(false);
      }
    },
    [queryClient, queryKey]
  );

  if (!companyId || !branchId) {
    return (
      <div className="page">
        <div className="alert alert-warn">Select a company and branch first.</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page">
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>Loading stock adjustment...</div>
      </div>
    );
  }

  if (loadError || !item) {
    return (
      <div className="page">
        <div className="alert alert-danger">{loadError ? getApiError(loadError, "Failed to load stock adjustment.") : "Stock adjustment not found."}</div>
        <Button variant="bare" type="button" className="btn" onClick={goBack}>
          Back to adjustments
        </Button>
      </div>
    );
  }

  if (modal) {
    const copy = {
      reject: {
        title: "Reject adjustment",
        body: "The preparer sees your reason and can correct the adjustment.",
        placeholder: "Reason for rejection",
        confirm: "Reject",
        run: (note: string) => run("Rejected.", () => adjustmentApi.reject(companyId, branchId, item.id, note, item.version)),
      },
      reverse: {
        title: "Reverse adjustment",
        body: "Stock goes back to how it was before the adjustment and its journal is reversed. This cannot be undone.",
        placeholder: "Reason for reversal",
        confirm: "Reverse",
        run: (note: string) => run("Reversed.", () => adjustmentApi.reverse(companyId, branchId, item.id, note, item.version)),
      },
      cancel: {
        title: "Cancel adjustment",
        body: "The adjustment is closed without changing stock and stays on record as cancelled.",
        placeholder: "Reason for cancelling",
        confirm: "Cancel adjustment",
        run: (note: string) => run("Cancelled.", () => adjustmentApi.cancel(companyId, branchId, item.id, note, item.version)),
      },
    }[modal];

    return (
      <ConfirmModal
        title={copy.title}
        body={copy.body}
        placeholder={copy.placeholder}
        confirmLabel={copy.confirm}
        working={working}
        error={actionError}
        onConfirm={copy.run}
        onCancel={() => {
          setModal(null);
          setActionError(null);
        }}
      />
    );
  }

  const typeLabel = ADJUSTMENT_TYPE_LABELS[String(item.adjustmentType)] ?? String(item.adjustmentType);
  const posted = status === "Posted" || status === "Reversed";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Inventory · Stock adjustment</div>
          <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {item.adjustmentNo || "Stock adjustment"}
            <span className={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</span>
          </div>
          <div className="page-sub">
            {typeLabel} · {item.locationName ?? "Location"} · {fmtDate(item.adjustmentDate)}
            {item.referenceNo ? ` · Ref ${item.referenceNo}` : ""}
          </div>
        </div>
        <Button variant="bare" type="button" className="btn" onClick={goBack}>
          Back
        </Button>
      </div>

      {actionError && <div className="alert alert-danger">{actionError}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {status === "Rejected" && (
        <div className="alert alert-danger">
          <strong>Rejected{item.rejectedByName ? ` by ${item.rejectedByName}` : ""}:</strong> {item.rejectionNote}
          {actions.edit && " Edit the adjustment to correct it; it then returns to draft."}
        </div>
      )}
      {status === "Cancelled" && (
        <div className="alert alert-warn">
          <strong>Cancelled:</strong> {item.cancelReason}
        </div>
      )}
      {status === "Reversed" && (
        <div className="alert alert-warn">
          <strong>Reversed:</strong> {item.reverseReason}
        </div>
      )}
      {status === "Submitted" && (
        <div className="alert alert-info">
          {totals.needApproval} line{totals.needApproval === 1 ? "" : "s"} reach the approval threshold, so a manager other than the
          preparer must approve before the stock changes.
        </div>
      )}
      {status === "Approved" && (
        <div className="alert alert-info">
          {item.autoApproved ? "Within policy, so approved automatically. " : ""}Someone other than the preparer and approver posts it to stock.
        </div>
      )}
      {totals.moved > 0 && (
        <div className="alert alert-warn">
          Stock moved on {totals.moved} line{totals.moved === 1 ? "" : "s"} after the count was saved. The counted difference is what posts; if the
          count is stale, reject it so the preparer recounts.
        </div>
      )}
      {posted && item.glStatus === "Failed" && (
        <div className="alert alert-danger">
          <strong>General ledger posting failed:</strong> {item.glMessage} Finance can retry it from posting exceptions.
        </div>
      )}

      <AdjustmentWorkflowActionBar
        actions={actions}
        working={working}
        onEdit={() => basePath && navigate(`${basePath}/${item.id}/edit`)}
        onSubmit={() => void run("Submitted.", () => adjustmentApi.submit(companyId, branchId, item.id, item.version))}
        onApprove={() => basePath && navigate(`${basePath}/${item.id}/approve`)}
        onReject={() => setModal("reject")}
        onCancel={() => setModal("cancel")}
        onPost={() => void run("Posted to stock.", () => adjustmentApi.post(companyId, branchId, item.id, item.version))}
        onReverse={() => setModal("reverse")}
      />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Lines</div>
          <div className="kpi-val">{item.lines?.length ?? 0}</div>
          <div className="kpi-sub">{totals.changed} with a difference</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Stock found</div>
          <div className="kpi-val" style={{ color: tone(totals.found) }}>{signedMoney(totals.found)}</div>
          <div className="kpi-sub">{posted ? "posted value" : "at current cost"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Stock missing</div>
          <div className="kpi-val" style={{ color: tone(totals.missing) }}>{signedMoney(totals.missing)}</div>
          <div className="kpi-sub">{posted ? "posted value (FIFO cost)" : "at current cost"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Net value</div>
          <div className="kpi-val" style={{ color: tone(totals.net) }}>{signedMoney(totals.net)}</div>
          <div className="kpi-sub">highest variance {Number(item.highestVariancePercent ?? 0).toFixed(1)}%</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <SectionTitle>Summary</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
            <InfoField label="Type" value={typeLabel} />
            <InfoField label="Count / loss date" value={fmtDate(item.adjustmentDate)} />
            <InfoField label="Location" value={item.locationName} />
            <InfoField label="Reference" value={item.referenceNo} />
            <InfoField label="Reason" value={item.reason} wide />
            <InfoField label="Remarks" value={item.remarks} wide />
            {item.stockCountSessionId && <InfoField label="Source" value="Generated from an approved stock count" wide />}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <SectionTitle>Approval trail</SectionTitle>
          <AuditTrail item={item} />
          {posted && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>General ledger</div>
              <div>
                {GL_LABEL[String(item.glStatus)] ?? item.glStatus}
                {item.glJournalNo ? ` · journal ${item.glJournalNo}` : ""}
                {item.reversalGlJournalNo ? ` · reversal ${item.reversalGlJournalNo}` : ""}
              </div>
              {item.glMessage && item.glStatus !== "Failed" && <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{item.glMessage}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "12px 16px 0", borderBottom: "1px solid var(--border)" }}>
          <SectionTitle>Lines</SectionTitle>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Lot</th>
                <th style={{ textAlign: "right" }}>Book</th>
                <th style={{ textAlign: "right" }}>Counted</th>
                <th style={{ textAlign: "right" }}>Difference</th>
                <th style={{ textAlign: "right" }}>Unit cost</th>
                <th style={{ textAlign: "right" }}>Value</th>
                <th style={{ textAlign: "right" }}>Variance</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {(item.lines ?? []).length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 48, textAlign: "center", color: "var(--text-soft)" }}>
                    No lines.
                  </td>
                </tr>
              ) : (
                item.lines.map((line, index) => {
                  const unit = line.uomCode || line.uomName || "";
                  return (
                    <tr key={line.id ?? `${line.itemId}-${index}`}>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{line.lineNo || index + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{line.itemName || "Item"}</div>
                        {line.itemCode && <div style={{ fontSize: 11, color: "var(--text-soft)" }}>{line.itemCode}</div>}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {line.fifoLotId ? line.batchNo || "Lot" : "Whole item"}
                        {line.expiryDate && <div style={{ fontSize: 11, color: "var(--text-soft)" }}>Exp {fmtDate(line.expiryDate)}</div>}
                      </td>
                      <td
                        style={{ textAlign: "right", fontFamily: "var(--mono)" }}
                        title={`${fmtQty(line.systemQtyBase)} ${line.baseUomName ?? ""}`}
                      >
                        {fmtQty(line.systemQty)} {unit}
                        {stockMoved(line) && (
                          <div style={{ fontSize: 11, color: "var(--warn)" }}>
                            now {fmtQty((line.currentQtyBase ?? 0) / (line.conversionFactor || 1))}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                        {fmtQty(line.countedQty)} {unit}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700, color: tone(line.adjustmentQty) }}>
                        {signedQty(line.adjustmentQty)}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)" }} title={`${line.unitCost} per ${line.baseUomName ?? "base unit"}`}>
                        {formatCurrency(line.unitCostDisplay)}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700, color: tone(line.lineAmount) }}>
                        {signedMoney(line.lineAmount)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span style={{ color: line.isHighVariance ? "var(--warn)" : "var(--text-muted)", fontWeight: line.isHighVariance ? 700 : 400 }}>
                          {Number(line.variancePercent ?? 0).toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ color: "var(--text-soft)", fontSize: 12 }}>{line.notes || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {(item.lines ?? []).length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--surface-2)" }}>
                  <td colSpan={7} style={{ fontWeight: 700, padding: "10px 16px" }}>
                    Net value
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700, color: tone(totals.net) }}>{signedMoney(totals.net)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
