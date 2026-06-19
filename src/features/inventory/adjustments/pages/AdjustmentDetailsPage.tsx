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

function fmtMoney(value?: number | null): string {
  return `ETB ${Number(value ?? 0).toLocaleString(undefined, {
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

function InfoField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{value || "—"}</div>
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
    <div
      style={{
        background: "rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: 24,
          width: "100%",
          maxWidth: 420,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>
          {title}
        </div>

        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 14,
          }}
        >
          {body}
        </div>

        <textarea
          style={{
            width: "100%",
            minHeight: 80,
            fontSize: 13,
            padding: "8px 10px",
            borderRadius: "var(--r)",
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--text)",
            resize: "vertical",
            marginBottom: 16,
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          autoFocus
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn"
            disabled={working}
            onClick={onCancel}
          >
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
  const [modal, setModal] = useState<"reject" | "reverse" | null>(null);

  const adjustmentBasePath = companyId
    ? `/companies/${companyId}/inventory/adjustments`
    : "";

  const queryKey = useMemo(
    () => ["inventory-adjustment", companyId, branchId, adjustmentId] as const,
    [companyId, branchId, adjustmentId]
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

        if (adjustmentQty > 0) acc.qtyIn += adjustmentQty;
        if (adjustmentQty < 0) acc.qtyOut += Math.abs(adjustmentQty);

        acc.amount += unitCost * adjustmentQty;

        return acc;
      },
      {
        qtyIn: 0,
        qtyOut: 0,
        amount: 0,
      }
    );
  }, [item]);

  const netVariance = totals.qtyIn - totals.qtyOut;

  const goBack = useCallback(() => {
    if (!adjustmentBasePath) return;
    navigate(adjustmentBasePath);
  }, [adjustmentBasePath, navigate]);

  const goEdit = useCallback(() => {
    if (!adjustmentBasePath || !item?.id) return;
    navigate(`${adjustmentBasePath}/${item.id}/edit`);
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
    [invalidateAdjustment]
  );

  const submitAdjustment = useCallback(() => {
    if (!companyId || !branchId || !item?.id) return;

    void runWorkflowAction(() =>
      adjustmentApi.submit(companyId, branchId, item.id)
    );
  }, [companyId, branchId, item?.id, runWorkflowAction]);

  const approveAdjustment = useCallback(() => {
    if (!companyId || !branchId || !item?.id) return;

    void runWorkflowAction(() =>
      adjustmentApi.approve(companyId, branchId, item.id)
    );
  }, [companyId, branchId, item?.id, runWorkflowAction]);

  const postAdjustment = useCallback(() => {
    if (!companyId || !branchId || !item?.id) return;

    void runWorkflowAction(() =>
      adjustmentApi.post(companyId, branchId, item.id)
    );
  }, [companyId, branchId, item?.id, runWorkflowAction]);

  const rejectAdjustment = useCallback(
    (note: string) => {
      if (!companyId || !branchId || !item?.id) return;

      void runWorkflowAction(() =>
        adjustmentApi.reject(companyId, branchId, item.id, note)
      );
    },
    [companyId, branchId, item?.id, runWorkflowAction]
  );

  const reverseAdjustment = useCallback(
    (reason: string) => {
      if (!companyId || !branchId || !item?.id) return;

      void runWorkflowAction(() =>
        adjustmentApi.reverse(companyId, branchId, item.id, reason)
      );
    },
    [companyId, branchId, item?.id, runWorkflowAction]
  );

  if (!companyId || !branchId) {
    return (
      <div className="page">
        <div className="alert alert-warn">
          Company or branch scope is missing. Please select a company and branch,
          then try again.
        </div>

        {adjustmentBasePath && (
          <button type="button" className="btn" onClick={goBack}>
            ← Back to list
          </button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page">
        <div
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          Loading adjustment…
        </div>
      </div>
    );
  }

  if (loadError || !item) {
    return (
      <div className="page">
        <div className="alert alert-danger">
          {loadError
            ? getApiError(loadError, "Failed to load adjustment.")
            : "Adjustment not found."}
        </div>

        <button type="button" className="btn" onClick={goBack}>
          ← Back to list
        </button>
      </div>
    );
  }

  if (modal === "reject") {
    return (
      <div className="page">
        <ConfirmModal
          title="Reject adjustment"
          body="Provide a reason. This will be visible to the submitter."
          placeholder="Rejection reason required"
          requireText
          confirmLabel="Confirm reject"
          danger
          working={working}
          onConfirm={rejectAdjustment}
          onCancel={() => {
            setModal(null);
            setActionError(null);
          }}
        />

        {actionError && (
          <div className="alert alert-danger" style={{ margin: "0 20px" }}>
            {actionError}
          </div>
        )}
      </div>
    );
  }

  if (modal === "reverse") {
    return (
      <div className="page">
        <ConfirmModal
          title="Reverse adjustment"
          body="This writes counter-entries to FIFO and inventory ledger. This action cannot be undone."
          placeholder="Reason for reversal required"
          requireText
          confirmLabel="Confirm reverse"
          danger
          working={working}
          onConfirm={reverseAdjustment}
          onCancel={() => {
            setModal(null);
            setActionError(null);
          }}
        />

        {actionError && (
          <div className="alert alert-danger" style={{ margin: "0 20px" }}>
            {actionError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Inventory · Adjustments</div>

          <div
            className="page-title"
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            {item.adjustmentNo || "Adjustment"}
            <span className={STATUS_BADGE[status]}>{status}</span>
          </div>

          <div className="page-sub">
            {item.adjustmentType || "—"}
            {item.adjustmentDate && <> · {fmtDate(item.adjustmentDate)}</>}
            {item.referenceNo && (
              <span
                style={{
                  fontFamily: "var(--mono)",
                  marginLeft: 8,
                  fontSize: 11,
                  color: "var(--text-soft)",
                }}
              >
                Ref: {item.referenceNo}
              </span>
            )}
          </div>
        </div>

        <button type="button" className="btn" onClick={goBack}>
          ← Back
        </button>
      </div>

      {actionError && <div className="alert alert-danger">{actionError}</div>}

      {item.rejectionNote && (
        <div className="alert alert-danger">
          <strong>Rejected:</strong> {item.rejectionNote}
        </div>
      )}

      {item.reverseReason && (
        <div className="alert alert-warn">
          <strong>Reversed:</strong> {item.reverseReason}
        </div>
      )}

      {item.hasHighVariance && (
        <div className="alert alert-warn">
          <i
            className="ti ti-alert-triangle"
            aria-hidden
            style={{ marginRight: 6 }}
          />
          High variance detected —{" "}
          {item.highestVariancePercent?.toFixed(1) ?? "0.0"}% on one or more
          lines.
          {status === "Submitted" && " Manager approval required before posting."}
        </div>
      )}

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

      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}
      >
        <div className="kpi">
          <div className="kpi-label">Lines</div>
          <div className="kpi-val">{item.lines?.length ?? 0}</div>
          <div className="kpi-sub">adjustment lines</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Net variance qty</div>
          <div
            className="kpi-val"
            style={{
              color:
                netVariance < 0
                  ? "var(--danger)"
                  : netVariance > 0
                    ? "var(--success)"
                    : "var(--text)",
            }}
          >
            {netVariance >= 0 ? "+" : ""}
            {fmtQty(netVariance)}
          </div>
          <div className="kpi-sub">base units</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Total value</div>
          <div className="kpi-val">{fmtMoney(totals.amount)}</div>
          <div className="kpi-sub">adjustment impact</div>

          {item.hasHighVariance && (
            <div className="kpi-badge badge-warn">
              ⚠ {item.highestVariancePercent?.toFixed(1) ?? "0.0"}% variance
            </div>
          )}
        </div>

        <div className="kpi">
          <div className="kpi-label">Approval</div>
          <div className="kpi-val">
            {status === "Submitted" ? "Pending" : status}
          </div>
          <div className="kpi-sub">
            {status === "Submitted" ? "awaiting review" : "no action needed"}
          </div>

          {status === "Submitted" && (
            <div className="kpi-badge badge-warn">Action needed</div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Header information
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
          }}
        >
          <InfoField label="Adjustment type" value={item.adjustmentType} />
          <InfoField label="Date" value={fmtDate(item.adjustmentDate)} />
          <InfoField label="Reference no" value={item.referenceNo} />
          <InfoField label="Reason" value={item.reason} />
          <InfoField label="Remarks" value={item.remarks} />
          <InfoField label="Submitted at" value={fmtDate(item.submittedAt)} />
          <InfoField label="Approved at" value={fmtDate(item.approvedAt)} />
          <InfoField label="Posted at" value={fmtDate(item.postedAt)} />

          {item.rejectionNote && (
            <div style={{ gridColumn: "span 4" }}>
              <InfoField label="Rejection note" value={item.rejectionNote} />
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Adjustment lines
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>UOM</th>
              <th style={{ textAlign: "right" }}>System qty</th>
              <th style={{ textAlign: "right" }}>Counted qty</th>
              <th style={{ textAlign: "right" }}>Adjustment</th>
              <th style={{ textAlign: "right" }}>Unit cost</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "right" }}>Variance %</th>
              <th>Notes</th>
            </tr>
          </thead>

          <tbody>
            {(item.lines ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    padding: 48,
                    textAlign: "center",
                    color: "var(--text-soft)",
                    fontSize: 13,
                  }}
                >
                  No lines on this adjustment.
                </td>
              </tr>
            ) : (
              (item.lines ?? []).map((line, index) => {
                const adjustmentQty = Number(line.adjustmentQty ?? 0);
                const amount = Number(line.unitCost ?? 0) * adjustmentQty;
                const variance = Number(line.variancePercent ?? 0);

                return (
                  <tr key={line.id ?? `${line.itemId}-${index}`}>
                    <td
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontFamily: "var(--mono)",
                        width: 36,
                      }}
                    >
                      {line.lineNo ?? index + 1}
                    </td>

                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>
                        {line.itemName || line.itemId}
                      </div>

                      {line.batchNo && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-soft)",
                            fontFamily: "var(--mono)",
                            marginTop: 1,
                          }}
                        >
                          Batch: {line.batchNo}
                        </div>
                      )}

                      {line.expiryDate && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-soft)",
                            marginTop: 1,
                          }}
                        >
                          Exp: {fmtDate(line.expiryDate)}
                        </div>
                      )}
                    </td>

                    <td style={{ fontSize: 13 }}>{line.uomName || line.uomId}</td>

                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                      }}
                    >
                      {fmtQty(line.systemQty)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                      }}
                    >
                      {fmtQty(line.countedQty)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                        fontWeight: adjustmentQty !== 0 ? 600 : 400,
                        color:
                          adjustmentQty < 0
                            ? "var(--danger)"
                            : adjustmentQty > 0
                              ? "var(--success)"
                              : "var(--text-muted)",
                      }}
                    >
                      {adjustmentQty >= 0 ? "+" : ""}
                      {fmtQty(adjustmentQty)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                      }}
                    >
                      {fmtMoney(line.unitCost)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {fmtMoney(amount)}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      {line.isHighVariance ? (
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--warn)",
                            fontWeight: 600,
                          }}
                        >
                          <i
                            className="ti ti-alert-triangle"
                            aria-hidden
                            style={{ fontSize: 10, marginRight: 2 }}
                          />
                          {variance.toFixed(1)}%
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--mono)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {variance.toFixed(1)}%
                        </span>
                      )}
                    </td>

                    <td style={{ fontSize: 12, color: "var(--text-soft)" }}>
                      {line.notes || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {(item.lines ?? []).length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--surface-2)" }}>
                <td
                  colSpan={5}
                  style={{
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                  }}
                >
                  Totals
                </td>

                <td
                  style={{
                    textAlign: "right",
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "8px 12px",
                    color:
                      netVariance < 0
                        ? "var(--danger)"
                        : netVariance > 0
                          ? "var(--success)"
                          : "var(--text)",
                  }}
                >
                  {netVariance >= 0 ? "+" : ""}
                  {fmtQty(netVariance)}
                </td>

                <td />

                <td
                  style={{
                    textAlign: "right",
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "8px 12px",
                  }}
                >
                  {fmtMoney(totals.amount)}
                </td>

                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}