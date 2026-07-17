// src/features/inventory/adjustments/pages/AdjustmentDetailsPage.tsx

import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAppScope } from "../../../../app/useAppScope";
import { adjustmentApi, getApiError } from "../api/adjustmentApi";
import AdjustmentWorkflowActionBar from "../components/AdjustmentWorkflowActionBar";
import {
  canReject,
  canReverse,
  normalizeAdjustmentStatus,
  STATUS_BADGE,
} from "../utils/adjustmentWorkflow";

type ConfirmAction = "reject" | "reverse" | null;

const CURRENCY = "ETB";

function fmtDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMoney(value?: number | null): string {
  return `${CURRENCY} ${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtQty(value?: number | null): string {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function signedQty(value: number): string {
  return `${value > 0 ? "+" : ""}${fmtQty(value)}`;
}

function signedMoney(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${fmtMoney(Math.abs(value))}`;
}

function normalizeText(value?: string | null): string {
  return String(value ?? "").trim();
}

function friendlyStatus(status: string): string {
  switch (status) {
    case "Draft":
      return "Draft";
    case "Submitted":
      return "Waiting for Approval";
    case "Approved":
      return "Approved · Ready to Post";
    case "Posted":
      return "Posted to Inventory";
    case "Rejected":
      return "Rejected";
    case "Reversed":
      return "Reversed";
    default:
      return status || "Unknown";
  }
}

function statusMessage(status: string): string {
  switch (status) {
    case "Draft":
      return "This adjustment is still editable and has not entered approval.";
    case "Submitted":
      return "This adjustment is waiting for manager review.";
    case "Approved":
      return "This adjustment is approved and ready to update stock.";
    case "Posted":
      return "Inventory balances have been updated.";
    case "Rejected":
      return "This adjustment was rejected and cannot be posted.";
    case "Reversed":
      return "This adjustment has been reversed with counter entries.";
    default:
      return "Review the adjustment workflow status.";
  }
}

function friendlyAdjustmentType(value?: string | null): string {
  const type = normalizeText(value).toLowerCase();

  if (type.includes("count")) return "Stock Count Adjustment";
  if (type.includes("increase")) return "Stock Increase";
  if (type.includes("decrease")) return "Stock Decrease";
  if (type.includes("damage")) return "Damage / Write-off";
  if (type.includes("expiry")) return "Expired Stock Write-off";

  return value || "Inventory Adjustment";
}

function impactText(value: number): string {
  if (value > 0) return "Inventory value increased";
  if (value < 0) return "Inventory value decreased";
  return "No inventory value change";
}

function qtyImpactText(value: number): string {
  if (value > 0) return "More stock than expected";
  if (value < 0) return "Less stock than expected";
  return "No quantity difference";
}

function valueTone(value: number): string {
  if (value > 0) return "var(--success)";
  if (value < 0) return "var(--danger)";
  return "var(--text)";
}

function InfoField({
  label,
  value,
  wide,
}: {
  label: string;
  value?: string | null;
  wide?: boolean;
}) {
  return (
    <div style={{ gridColumn: wide ? "span 2" : undefined }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  placeholder,
  requireText,
  confirmLabel,
  danger,
  working,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  placeholder: string;
  requireText: boolean;
  confirmLabel: string;
  danger?: boolean;
  working: boolean;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="page">
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <section
          className="card"
          style={{
            width: "100%",
            maxWidth: 480,
            padding: 24,
          }}
        >
          <h2 style={{ margin: 0, marginBottom: 8, fontSize: 18 }}>{title}</h2>

          <p style={{ margin: 0, marginBottom: 16, color: "var(--text-muted)", fontSize: 13 }}>
            {body}
          </p>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={placeholder}
            disabled={working}
            autoFocus
            style={{
              width: "100%",
              minHeight: 96,
              resize: "vertical",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: "var(--r)",
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
              fontFamily: "inherit",
              fontSize: 13,
              marginBottom: 16,
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn" disabled={working} onClick={onCancel}>
              Cancel
            </button>

            <button
              type="button"
              className={danger ? "btn btn-danger" : "btn btn-primary"}
              disabled={working || (requireText && !text.trim())}
              onClick={() => onConfirm(text.trim())}
            >
              {working ? "Working…" : confirmLabel}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AdjustmentDetailsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { adjustmentId } = useParams<{ adjustmentId: string }>();
  const { companyId, branchId } = useAppScope();

  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modal, setModal] = useState<ConfirmAction>(null);

  const adjustmentBasePath = companyId
    ? `/companies/${companyId}/inventory/adjustments`
    : "";

  const queryKey = useMemo(
    () => ["inventory-adjustment", companyId, branchId, adjustmentId] as const,
    [companyId, branchId, adjustmentId],
  );

  const {
    data: item,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey,
    queryFn: () => adjustmentApi.get(companyId!, branchId!, adjustmentId!),
    enabled: Boolean(companyId && branchId && adjustmentId),
  });

  const status = normalizeAdjustmentStatus(item?.docStatus);

  const totals = useMemo(() => {
    return (item?.lines ?? []).reduce(
      (acc, line) => {
        const adjustmentQty = Number(line.adjustmentQty ?? 0);
        const unitCost = Number(line.unitCost ?? 0);
        const lineAmount = unitCost * adjustmentQty;

        if (adjustmentQty > 0) acc.qtyIn += adjustmentQty;
        if (adjustmentQty < 0) acc.qtyOut += Math.abs(adjustmentQty);

        acc.netQty += adjustmentQty;
        acc.valueImpact += lineAmount;

        if (line.isHighVariance) acc.highVarianceLines += 1;

        return acc;
      },
      {
        qtyIn: 0,
        qtyOut: 0,
        netQty: 0,
        valueImpact: 0,
        highVarianceLines: 0,
      },
    );
  }, [item]);

  const goBack = useCallback(() => {
    if (adjustmentBasePath) navigate(adjustmentBasePath);
  }, [adjustmentBasePath, navigate]);

  const goEdit = useCallback(() => {
    if (adjustmentBasePath && item?.id) {
      navigate(`${adjustmentBasePath}/${item.id}/edit`);
    }
  }, [adjustmentBasePath, item?.id, navigate]);

  const invalidateAdjustment = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const runWorkflowAction = useCallback(
    async (action: () => Promise<void>) => {
      setWorking(true);
      setActionError(null);

      try {
        await action();
        await invalidateAdjustment();
        setModal(null);
      } catch (error) {
        setActionError(getApiError(error, "Action failed."));
      } finally {
        setWorking(false);
      }
    },
    [invalidateAdjustment],
  );

  const submitAdjustment = useCallback(() => {
    if (!companyId || !branchId || !item?.id) return;
    void runWorkflowAction(() => adjustmentApi.submit(companyId, branchId, item.id));
  }, [companyId, branchId, item?.id, runWorkflowAction]);

  const approveAdjustment = useCallback(() => {
    if (!companyId || !branchId || !item?.id) return;
    void runWorkflowAction(() => adjustmentApi.approve(companyId, branchId, item.id));
  }, [companyId, branchId, item?.id, runWorkflowAction]);

  const postAdjustment = useCallback(() => {
    if (!companyId || !branchId || !item?.id) return;
    void runWorkflowAction(() => adjustmentApi.post(companyId, branchId, item.id));
  }, [companyId, branchId, item?.id, runWorkflowAction]);

  const rejectAdjustment = useCallback(
    (note: string) => {
      if (!companyId || !branchId || !item?.id) return;
      void runWorkflowAction(() => adjustmentApi.reject(companyId, branchId, item.id, note));
    },
    [companyId, branchId, item?.id, runWorkflowAction],
  );

  const reverseAdjustment = useCallback(
    (reason: string) => {
      if (!companyId || !branchId || !item?.id) return;
      void runWorkflowAction(() => adjustmentApi.reverse(companyId, branchId, item.id, reason));
    },
    [companyId, branchId, item?.id, runWorkflowAction],
  );

  if (!companyId || !branchId) {
    return (
      <div className="page">
        <div className="alert alert-warn">
          Company or branch scope is missing. Please select a company and branch.
        </div>

        {adjustmentBasePath && (
          <button type="button" className="btn" onClick={goBack}>
            ← Back to Adjustments
          </button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page">
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
          Loading stock adjustment…
        </div>
      </div>
    );
  }

  if (loadError || !item) {
    return (
      <div className="page">
        <div className="alert alert-danger">
          {loadError
            ? getApiError(loadError, "Failed to load stock adjustment.")
            : "Stock adjustment not found."}
        </div>

        <button type="button" className="btn" onClick={goBack}>
          ← Back to Adjustments
        </button>
      </div>
    );
  }

  if (modal === "reject") {
    return (
      <ConfirmModal
        title="Reject Stock Adjustment"
        body="Enter a clear reason. The submitter will see this note."
        placeholder="Reason for rejection"
        requireText
        confirmLabel="Reject Adjustment"
        danger
        working={working}
        onConfirm={rejectAdjustment}
        onCancel={() => {
          setModal(null);
          setActionError(null);
        }}
      />
    );
  }

  if (modal === "reverse") {
    return (
      <ConfirmModal
        title="Reverse Stock Adjustment"
        body="This will create counter entries in inventory and cannot be undone."
        placeholder="Reason for reversal"
        requireText
        confirmLabel="Reverse Adjustment"
        danger
        working={working}
        onConfirm={reverseAdjustment}
        onCancel={() => {
          setModal(null);
          setActionError(null);
        }}
      />
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Inventory · Stock Control</div>

          <div
            className="page-title"
            style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
          >
            {item.adjustmentNo || "Stock Adjustment"}
            <span className={STATUS_BADGE[status]}>{friendlyStatus(status)}</span>
          </div>

          <div className="page-sub">
            {friendlyAdjustmentType(item.adjustmentType)}
            {item.adjustmentDate ? <> · {fmtDate(item.adjustmentDate)}</> : null}
            {item.referenceNo ? <> · Ref: {item.referenceNo}</> : null}
          </div>
        </div>

        <button type="button" className="btn" onClick={goBack}>
          ← Back
        </button>
      </div>

      {actionError ? <div className="alert alert-danger">{actionError}</div> : null}

      {item.rejectionNote ? (
        <div className="alert alert-danger">
          <strong>Rejected:</strong> {item.rejectionNote}
        </div>
      ) : null}

      {item.reverseReason ? (
        <div className="alert alert-warn">
          <strong>Reversed:</strong> {item.reverseReason}
        </div>
      ) : null}

      {item.hasHighVariance ? (
        <div className="alert alert-warn">
          High variance detected on {totals.highVarianceLines || "one or more"} line(s). Highest
          variance: {Number(item.highestVariancePercent ?? 0).toFixed(1)}%.
        </div>
      ) : null}

      <AdjustmentWorkflowActionBar
        status={status}
        working={working}
        onEdit={goEdit}
        onSubmit={submitAdjustment}
        onApprove={approveAdjustment}
        onReject={canReject(status) ? () => setModal("reject") : undefined}
        onPost={postAdjustment}
        onReverse={canReverse(status) ? () => setModal("reverse") : undefined}
      />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Items Adjusted</div>
          <div className="kpi-val">{item.lines?.length ?? 0}</div>
          <div className="kpi-sub">inventory items included</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Quantity Difference</div>
          <div className="kpi-val" style={{ color: valueTone(totals.netQty) }}>
            {signedQty(totals.netQty)}
          </div>
          <div className="kpi-sub">{qtyImpactText(totals.netQty)}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Stock Value Impact</div>
          <div className="kpi-val" style={{ color: valueTone(totals.valueImpact) }}>
            {signedMoney(totals.valueImpact)}
          </div>
          <div className="kpi-sub">{impactText(totals.valueImpact)}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Workflow Status</div>
          <div className="kpi-val">{friendlyStatus(status)}</div>
          <div className="kpi-sub">{statusMessage(status)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          Adjustment Summary
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
          }}
        >
          <InfoField label="Adjustment Type" value={friendlyAdjustmentType(item.adjustmentType)} />
          <InfoField label="Adjustment Date" value={fmtDate(item.adjustmentDate)} />
          <InfoField label="Reference No." value={item.referenceNo} />
          <InfoField label="Status" value={friendlyStatus(status)} />

          <InfoField label="Reason" value={item.reason} wide />
          <InfoField label="Remarks" value={item.remarks} wide />

          <InfoField label="Submitted At" value={fmtDateTime(item.submittedAt)} />
          <InfoField label="Approved At" value={fmtDateTime(item.approvedAt)} />
          <InfoField label="Posted At" value={fmtDateTime(item.postedAt)} />
          <InfoField label="Reversed At" value={fmtDateTime(item.reversedAt)} />

          {item.rejectionNote ? (
            <InfoField label="Rejection Note" value={item.rejectionNote} wide />
          ) : null}

          {item.reverseReason ? (
            <InfoField label="Reverse Reason" value={item.reverseReason} wide />
          ) : null}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Stock Adjustment Lines
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>UOM</th>
              <th style={{ textAlign: "right" }}>Expected Qty</th>
              <th style={{ textAlign: "right" }}>Actual Qty</th>
              <th style={{ textAlign: "right" }}>Difference</th>
              <th style={{ textAlign: "right" }}>Unit Cost</th>
              <th style={{ textAlign: "right" }}>Value Impact</th>
              <th style={{ textAlign: "right" }}>Variance</th>
              <th>Notes</th>
            </tr>
          </thead>

          <tbody>
            {(item.lines ?? []).length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 48, textAlign: "center", color: "var(--text-soft)" }}>
                  No stock adjustment lines found.
                </td>
              </tr>
            ) : (
              (item.lines ?? []).map((line, index) => {
                const adjustmentQty = Number(line.adjustmentQty ?? 0);
                const amount = Number(line.unitCost ?? 0) * adjustmentQty;
                const variance = Number(line.variancePercent ?? 0);

                return (
                  <tr key={line.id ?? `${line.itemId}-${index}`}>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                      {line.lineNo ?? index + 1}
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {line.itemName || "Unknown Item"}
                      </div>

                      {line.batchNo ? (
                        <div style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 2 }}>
                          Batch: {line.batchNo}
                        </div>
                      ) : null}

                      {line.expiryDate ? (
                        <div style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 2 }}>
                          Expiry: {fmtDate(line.expiryDate)}
                        </div>
                      ) : null}
                    </td>

                    <td>{line.uomName || "—"}</td>

                    <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                      {fmtQty(line.systemQty)}
                    </td>

                    <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                      {fmtQty(line.countedQty)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontWeight: 700,
                        color: valueTone(adjustmentQty),
                      }}
                    >
                      {signedQty(adjustmentQty)}
                    </td>

                    <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                      {fmtMoney(line.unitCost)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontWeight: 700,
                        color: valueTone(amount),
                      }}
                    >
                      {signedMoney(amount)}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      {line.isHighVariance ? (
                        <span style={{ color: "var(--warn)", fontWeight: 700 }}>
                          ⚠ {variance.toFixed(1)}%
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>{variance.toFixed(1)}%</span>
                      )}
                    </td>

                    <td style={{ color: "var(--text-soft)", fontSize: 12 }}>
                      {line.notes || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {(item.lines ?? []).length > 0 ? (
            <tfoot>
              <tr style={{ background: "var(--surface-2)" }}>
                <td colSpan={5} style={{ fontWeight: 700 }}>
                  Totals
                </td>

                <td
                  style={{
                    textAlign: "right",
                    fontFamily: "var(--mono)",
                    fontWeight: 700,
                    color: valueTone(totals.netQty),
                  }}
                >
                  {signedQty(totals.netQty)}
                </td>

                <td />

                <td
                  style={{
                    textAlign: "right",
                    fontFamily: "var(--mono)",
                    fontWeight: 700,
                    color: valueTone(totals.valueImpact),
                  }}
                >
                  {signedMoney(totals.valueImpact)}
                </td>

                <td colSpan={2} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}