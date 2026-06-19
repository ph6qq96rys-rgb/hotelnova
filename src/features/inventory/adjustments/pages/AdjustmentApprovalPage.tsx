// src/features/inventory/adjustments/pages/AdjustmentApprovalPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { adjustmentApi, getApiError } from "../api/adjustmentApi";
import type { InventoryAdjustmentDto } from "../types";
import {
  normalizeAdjustmentStatus,
  STATUS_BADGE,
} from "../utils/adjustmentWorkflow";

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatQty(value?: number | null): string {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatMoney(value?: number | null): string {
  return `ETB ${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AdjustmentApprovalPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { companyId, branchId } = useAppScope();

  const [item, setItem] = useState<InventoryAdjustmentDto | null>(null);
  const [note, setNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);

  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adjustmentBasePath = companyId
    ? `/companies/${companyId}/inventory/adjustments`
    : "";

  const detailPath = item?.id && adjustmentBasePath
    ? `${adjustmentBasePath}/${item.id}`
    : adjustmentBasePath;

  const status = normalizeAdjustmentStatus(item?.docStatus);
  const canApprove = status === "Submitted";

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

  const load = useCallback(async () => {
    if (!companyId || !branchId || !id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await adjustmentApi.get(companyId, branchId, id);
      setItem(data);
    } catch (err) {
      setError(getApiError(err, "Failed to load adjustment."));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const goBack = useCallback(() => {
    if (!detailPath) return;
    navigate(detailPath);
  }, [detailPath, navigate]);

  async function approve() {
    if (!companyId || !branchId || !id || !canApprove) return;

    setWorking(true);
    setError(null);

    try {
      await adjustmentApi.approve(companyId, branchId, id);
      navigate(`${adjustmentBasePath}/${id}`, { replace: true });
    } catch (err) {
      setError(getApiError(err, "Approval failed."));
    } finally {
      setWorking(false);
    }
  }

  async function reject() {
    if (!companyId || !branchId || !id) return;

    const trimmed = rejectNote.trim();

    if (!trimmed) {
      setError("Rejection note is required.");
      return;
    }

    setWorking(true);
    setError(null);

    try {
      await adjustmentApi.reject(companyId, branchId, id, trimmed);
      navigate(`${adjustmentBasePath}/${id}`, { replace: true });
    } catch (err) {
      setError(getApiError(err, "Rejection failed."));
    } finally {
      setWorking(false);
    }
  }

  if (!companyId || !branchId) {
    return (
      <div className="page">
        <div className="alert alert-warn">
          Company or branch scope is missing. Please select a company and branch,
          then try again.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card">Loading approval page…</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page">
        <div className="alert alert-danger">
          {error || "Adjustment not found."}
        </div>

        {adjustmentBasePath && (
          <button
            type="button"
            className="btn"
            onClick={() => navigate(adjustmentBasePath)}
          >
            ← Back to adjustments
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Inventory · Adjustment Approval</div>

          <div
            className="page-title"
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            Approve Adjustment
            <span className={STATUS_BADGE[status]}>{status}</span>
          </div>

          <div className="page-sub">
            Review and approve inventory adjustment before ledger posting.
          </div>
        </div>

        <button type="button" className="btn" onClick={goBack}>
          ← Back
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {!canApprove && (
        <div className="alert alert-warn">
          Only submitted adjustments can be approved. Current status:{" "}
          <strong>{status}</strong>.
        </div>
      )}

      {item.hasHighVariance && (
        <div className="alert alert-warn">
          High variance detected:{" "}
          <strong>{item.highestVariancePercent?.toFixed(1) ?? "0.0"}%</strong>.
          Review lines carefully before approval.
        </div>
      )}

      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}
      >
        <div className="kpi">
          <div className="kpi-label">Adjustment No</div>
          <div className="kpi-val">{item.adjustmentNo || "—"}</div>
          <div className="kpi-sub">{formatDate(item.adjustmentDate)}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Positive adjustment</div>
          <div className="kpi-val">{formatQty(totals.qtyIn)}</div>
          <div className="kpi-sub">qty increase</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Negative adjustment</div>
          <div className="kpi-val">{formatQty(totals.qtyOut)}</div>
          <div className="kpi-sub">qty decrease</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Amount impact</div>
          <div className="kpi-val">{formatMoney(totals.amount)}</div>
          <div className="kpi-sub">{item.adjustmentType || "Adjustment"}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
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
              <th>Item</th>
              <th>UOM</th>
              <th style={{ textAlign: "right" }}>System</th>
              <th style={{ textAlign: "right" }}>Counted</th>
              <th style={{ textAlign: "right" }}>Difference</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th>Notes</th>
            </tr>
          </thead>

          <tbody>
            {(item.lines ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 48,
                    textAlign: "center",
                    color: "var(--text-soft)",
                    fontSize: 13,
                  }}
                >
                  No adjustment lines found.
                </td>
              </tr>
            ) : (
              (item.lines ?? []).map((line, index) => {
                const adjustmentQty = Number(line.adjustmentQty ?? 0);
                const amount = Number(line.unitCost ?? 0) * adjustmentQty;

                return (
                  <tr key={line.id ?? `${line.itemId}-${index}`}>
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
                    </td>

                    <td>{line.uomName || line.uomId}</td>

                    <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                      {formatQty(line.systemQty)}
                    </td>

                    <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                      {formatQty(line.countedQty)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontWeight: 600,
                        color:
                          adjustmentQty < 0
                            ? "var(--danger)"
                            : adjustmentQty > 0
                              ? "var(--success)"
                              : "var(--text-muted)",
                      }}
                    >
                      {adjustmentQty >= 0 ? "+" : ""}
                      {formatQty(adjustmentQty)}
                    </td>

                    <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                      {formatMoney(amount)}
                    </td>

                    <td>{line.notes || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          Approval note
        </label>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional approval note"
          disabled={working || !canApprove}
          style={{
            width: "100%",
            minHeight: 90,
            border: "1px solid var(--border)",
            borderRadius: "var(--r)",
            background: "var(--surface-2)",
            color: "var(--text)",
            padding: "10px 12px",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />

        {showReject && (
          <div style={{ marginTop: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Rejection note <span className="req">*</span>
            </label>

            <textarea
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              placeholder="Enter reason for rejection"
              disabled={working || !canApprove}
              style={{
                width: "100%",
                minHeight: 90,
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                background: "var(--surface-2)",
                color: "var(--text)",
                padding: "10px 12px",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>
        )}

        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn btn-danger"
            disabled={!canApprove || working}
            onClick={() => {
              if (!showReject) {
                setShowReject(true);
                setError(null);
                return;
              }

              void reject();
            }}
            style={{ background: "transparent" }}
          >
            {working && showReject ? "Rejecting…" : showReject ? "Confirm reject" : "Reject"}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={!canApprove || working}
            onClick={() => void approve()}
          >
            {working ? "Approving…" : "Approve adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}