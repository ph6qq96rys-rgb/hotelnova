// src/features/inventory/adjustments/pages/AdjustmentListPage.tsx

import { useEffect, useMemo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { adjustmentApi, getApiError } from "../api/adjustmentApi";
import {
  normalizeAdjustmentStatus,
  STATUS_BADGE,
} from "../utils/adjustmentWorkflow";
import type { InventoryAdjustmentDto } from "../types";

const STATUS_OPTIONS = [
  "Draft",
  "Submitted",
  "Approved",
  "Posted",
  "Rejected",
  "Reversed",
] as const;

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtMoney(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtQty(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function rowAmount(row: InventoryAdjustmentDto): number {
  return (row.lines ?? []).reduce(
    (sum, line) => sum + (line.lineAmount ?? 0),
    0
  );
}

export default function AdjustmentListPage() {
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [items, setItems] = useState<InventoryAdjustmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const basePath = companyId
    ? `/companies/${companyId}/inventory/adjustments`
    : "";

  const goToList = useCallback(() => {
    if (!basePath) return;
    navigate(basePath);
  }, [basePath, navigate]);

  const goToCreate = useCallback(() => {
    if (!basePath) return;
    navigate(`${basePath}/new`);
  }, [basePath, navigate]);

  const goToDetail = useCallback(
    (id: string) => {
      if (!basePath || !id) return;
      navigate(`${basePath}/${id}`);
    },
    [basePath, navigate]
  );

  const load = useCallback(async () => {
    if (!companyId || !branchId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const data = await adjustmentApi.list(companyId, branchId, {
        status: status || undefined,
      });

      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      setErr(getApiError(error, "Failed to load adjustments."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    const totalAmount = items.reduce((sum, row) => sum + rowAmount(row), 0);

    const totalVariance = items.reduce(
      (sum, row) => sum + (row.totalAdjustmentQty ?? 0),
      0
    );

    const highVariance = items.filter((row) => row.hasHighVariance).length;

    const pendingApproval = items.filter(
      (row) => normalizeAdjustmentStatus(row.docStatus) === "Submitted"
    ).length;

    return {
      totalAmount,
      totalVariance,
      highVariance,
      pendingApproval,
    };
  }, [items]);

  const canNavigate = Boolean(companyId);
  const canCreate = Boolean(companyId && branchId);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Inventory</div>
          <div className="page-title">Adjustments</div>
          <div className="page-sub">
            Stock counts, waste, damage, and variance corrections
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          disabled={!canCreate}
          onClick={goToCreate}
        >
          <i className="ti ti-plus" aria-hidden /> New adjustment
        </button>
      </div>

      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}
      >
        <div className="kpi">
          <div className="kpi-label">Documents</div>
          <div className="kpi-val">{items.length}</div>
          <div className="kpi-sub">in current filter</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Net variance qty</div>
          <div
            className="kpi-val"
            style={{
              color:
                kpis.totalVariance < 0
                  ? "var(--danger)"
                  : kpis.totalVariance > 0
                    ? "var(--success)"
                    : "var(--text)",
            }}
          >
            {kpis.totalVariance >= 0 ? "+" : ""}
            {fmtQty(kpis.totalVariance)}
          </div>
          <div className="kpi-sub">base units</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Total value</div>
          <div className="kpi-val">{fmtMoney(kpis.totalAmount)}</div>
          <div className="kpi-sub">adjustment impact</div>

          {kpis.highVariance > 0 && (
            <div className="kpi-badge badge-warn">
              {kpis.highVariance} high variance
            </div>
          )}
        </div>

        <div className="kpi">
          <div className="kpi-label">Pending approval</div>
          <div className="kpi-val">{kpis.pendingApproval}</div>
          <div className="kpi-sub">submitted adjustments</div>

          {kpis.pendingApproval > 0 && (
            <div className="kpi-badge badge-warn">Action needed</div>
          )}
        </div>
      </div>

      <div className="toolbar">
        <label
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Status
          <select
            className="select"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            style={{
              width: 150,
              fontSize: 13,
              height: 32,
              padding: "0 8px",
            }}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn"
          disabled={loading || !companyId || !branchId}
          onClick={() => void load()}
        >
          <i className="ti ti-refresh" aria-hidden />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {!companyId && (
        <div className="alert alert-warning">
          Select a company before opening inventory adjustments.
        </div>
      )}

      {companyId && !branchId && (
        <div className="alert alert-warning">
          Select a branch before loading inventory adjustments.
        </div>
      )}

      {err && <div className="alert alert-danger">{err}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Document</th>
              <th>Type</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>System qty</th>
              <th style={{ textAlign: "right" }}>Counted qty</th>
              <th style={{ textAlign: "right" }}>Variance</th>
              <th style={{ textAlign: "right" }}>Value</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    padding: 48,
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    padding: 56,
                    textAlign: "center",
                    color: "var(--text-soft)",
                    fontSize: 13,
                  }}
                >
                  No adjustments found.{" "}
                  <button
                    type="button"
                    className="link-button"
                    disabled={!canNavigate}
                    onClick={goToCreate}
                  >
                    Create one
                  </button>
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const normalizedStatus = normalizeAdjustmentStatus(
                  row.docStatus
                );
                const amount = rowAmount(row);
                const varianceQty = row.totalAdjustmentQty ?? 0;

                return (
                  <tr
                    key={row.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => goToDetail(row.id)}
                  >
                    <td
                      style={{
                        fontSize: 12,
                        fontFamily: "var(--mono)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {fmtDate(row.adjustmentDate)}
                    </td>

                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>
                        {row.adjustmentNo || "—"}
                      </div>

                      {row.referenceNo && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-soft)",
                            fontFamily: "var(--mono)",
                            marginTop: 1,
                          }}
                        >
                          Ref: {row.referenceNo}
                        </div>
                      )}

                      {row.hasHighVariance && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--warn)",
                            fontWeight: 500,
                            marginTop: 2,
                          }}
                        >
                          <i
                            className="ti ti-alert-triangle"
                            aria-hidden
                            style={{ fontSize: 10, marginRight: 3 }}
                          />
                          High variance{" "}
                          {row.highestVariancePercent?.toFixed(1) ?? "0.0"}%
                        </div>
                      )}
                    </td>

                    <td style={{ fontSize: 13 }}>
                      {row.adjustmentType || "—"}
                    </td>

                    <td>
                      <span className={STATUS_BADGE[normalizedStatus]}>
                        {normalizedStatus}
                      </span>

                      {row.rejectionNote && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--danger)",
                            marginTop: 2,
                            maxWidth: 140,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={row.rejectionNote}
                        >
                          {row.rejectionNote}
                        </div>
                      )}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                      }}
                    >
                      {fmtQty(row.totalSystemQty ?? 0)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                      }}
                    >
                      {fmtQty(row.totalCountedQty ?? 0)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                        fontWeight: varianceQty !== 0 ? 500 : 400,
                        color:
                          varianceQty < 0
                            ? "var(--danger)"
                            : varianceQty > 0
                              ? "var(--success)"
                              : "var(--text-muted)",
                      }}
                    >
                      {varianceQty >= 0 ? "+" : ""}
                      {fmtQty(varianceQty)}
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
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          goToDetail(row.id);
                        }}
                      >
                        Open →
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        hidden
        aria-hidden
        onClick={goToList}
      />
    </div>
  );
}