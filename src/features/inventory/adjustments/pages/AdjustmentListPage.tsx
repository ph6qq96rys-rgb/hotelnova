// src/features/inventory/adjustments/pages/AdjustmentListPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { adjustmentApi, getApiError } from "../api/adjustmentApi";
import { normalizeAdjustmentStatus, STATUS_BADGE } from "../utils/adjustmentWorkflow";
import type { InventoryAdjustmentDto } from "../types";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(v: number) {
  return "$" + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(v: number) {
  return v.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function rowAmount(row: InventoryAdjustmentDto): number {
  return (row.lines ?? []).reduce((s, l) => s + (l.lineAmount ?? 0), 0);
}

const STATUS_OPTIONS = ["Draft", "Submitted", "Approved", "Posted", "Rejected", "Reversed"] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdjustmentListPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [items,   setItems]   = useState<InventoryAdjustmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState("");
  const [err,     setErr]     = useState<string | null>(null);

  async function load() {
    if (!companyId || !branchId) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await adjustmentApi.list(companyId, branchId, {
        status: status || undefined,
      });
      setItems(data);
    } catch (e) {
      setErr(getApiError(e, "Failed to load adjustments."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [companyId, branchId, status]);

  const kpis = useMemo(() => {
    const totalAmount     = items.reduce((s, r) => s + rowAmount(r), 0);
    const totalVariance   = items.reduce((s, r) => s + (r.totalAdjustmentQty ?? 0), 0);
    const highVariance    = items.filter((r) => r.hasHighVariance).length;
    const pendingApproval = items.filter(
      (r) => normalizeAdjustmentStatus(r.docStatus) === "Submitted"
    ).length;
    return { totalAmount, totalVariance, highVariance, pendingApproval };
  }, [items]);

  return (
    <div className="page">

      <div className="page-header">
        <div>
          <div className="page-kicker">Inventory</div>
          <div className="page-title">Adjustments</div>
          <div className="page-sub">Stock counts, waste, damage and variance corrections</div>
        </div>
        <button
          className="btn btn-primary"
          disabled={!companyId || !branchId}
          onClick={() => nav("/inventory/adjustments/new")}
        >
          <i className="ti ti-plus" aria-hidden /> New adjustment
        </button>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Documents</div>
          <div className="kpi-val">{items.length}</div>
          <div className="kpi-sub">in current filter</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Net variance qty</div>
          <div className="kpi-val" style={{
            color: kpis.totalVariance < 0
              ? "var(--danger)"
              : kpis.totalVariance > 0
              ? "var(--success)"
              : "var(--text)",
          }}>
            {kpis.totalVariance >= 0 ? "+" : ""}{fmtQty(kpis.totalVariance)}
          </div>
          <div className="kpi-sub">base units</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total value</div>
          <div className="kpi-val">{fmtMoney(kpis.totalAmount)}</div>
          <div className="kpi-sub">adjustment impact</div>
          {kpis.highVariance > 0 && (
            <div className="kpi-badge badge-warn">{kpis.highVariance} high variance</div>
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
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex",
          alignItems: "center", gap: 6 }}>
          Status
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: 150, fontSize: 13, height: 32, padding: "0 8px" }}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <button className="btn" disabled={loading || !companyId} onClick={load}>
          <i className="ti ti-refresh" aria-hidden />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

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
                <td colSpan={9} style={{ padding: 48, textAlign: "center",
                  color: "var(--text-muted)", fontSize: 13 }}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 56, textAlign: "center",
                  color: "var(--text-soft)", fontSize: 13 }}>
                  No adjustments found.{" "}
                  <span style={{ color: "var(--accent)", cursor: "pointer" }}
                    onClick={() => nav("/inventory/adjustments/new")}>
                    Create one
                  </span>
                </td>
              </tr>
            ) : items.map((row) => {
              const s         = normalizeAdjustmentStatus(row.docStatus);
              const amount    = rowAmount(row);
              const varQty    = row.totalAdjustmentQty ?? 0;

              return (
                <tr key={row.id} style={{ cursor: "pointer" }}
                  onClick={() => nav(`/inventory/adjustments/${row.id}`)}>

                  <td style={{ fontSize: 12, fontFamily: "var(--mono)",
                    color: "var(--text-muted)" }}>
                    {fmtDate(row.adjustmentDate)}
                  </td>

                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>
                      {row.adjustmentNo || "—"}
                    </div>
                    {row.referenceNo && (
                      <div style={{ fontSize: 11, color: "var(--text-soft)",
                        fontFamily: "var(--mono)", marginTop: 1 }}>
                        Ref: {row.referenceNo}
                      </div>
                    )}
                    {row.hasHighVariance && (
                      <div style={{ fontSize: 10, color: "var(--warn)",
                        fontWeight: 500, marginTop: 2 }}>
                        <i className="ti ti-alert-triangle" aria-hidden
                          style={{ fontSize: 10, marginRight: 3 }} />
                        High variance {row.highestVariancePercent?.toFixed(1)}%
                      </div>
                    )}
                  </td>

                  <td style={{ fontSize: 13 }}>{row.adjustmentType || "—"}</td>

                  <td>
                    <span className={STATUS_BADGE[s]}>{s}</span>
                    {row.rejectionNote && (
                      <div style={{ fontSize: 11, color: "var(--danger)",
                        marginTop: 2, maxWidth: 140,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={row.rejectionNote}>
                        {row.rejectionNote}
                      </div>
                    )}
                  </td>

                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                    {fmtQty(row.totalSystemQty ?? 0)}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                    {fmtQty(row.totalCountedQty ?? 0)}
                  </td>

                  <td style={{
                    textAlign: "right", fontFamily: "var(--mono)", fontSize: 12,
                    fontWeight: varQty !== 0 ? 500 : 400,
                    color: varQty < 0 ? "var(--danger)"
                      : varQty > 0  ? "var(--success)"
                      : "var(--text-muted)",
                  }}>
                    {varQty >= 0 ? "+" : ""}{fmtQty(varQty)}
                  </td>

                  <td style={{ textAlign: "right", fontFamily: "var(--mono)",
                    fontSize: 12, fontWeight: 500 }}>
                    {fmtMoney(amount)}
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm"
                      onClick={(e) => { e.stopPropagation();
                        nav(`/inventory/adjustments/${row.id}`); }}>
                      Open →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}