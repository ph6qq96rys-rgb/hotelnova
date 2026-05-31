// src/features/inventory/adjustments/pages/AdjustmentDetailsPage.tsx

import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppScope } from "../../../../app/useAppScope";
import { adjustmentApi, getApiError } from "../api/adjustmentApi";
import AdjustmentWorkflowActionBar from "../components/AdjustmentWorkflowActionBar";
import {
  canReject, canReverse,
  normalizeAdjustmentStatus, STATUS_BADGE,
} from "../utils/adjustmentWorkflow";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(v?: number | null): string {
  return "ETB " + Number(v ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function fmtQty(v?: number | null): string {
  return Number(v ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 3, maximumFractionDigits: 3,
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{value || "—"}</div>
    </div>
  );
}

function ConfirmModal({
  title, body, placeholder, requireText, confirmLabel, danger, working, onConfirm, onCancel,
}: {
  title: string; body: string; placeholder: string; requireText: boolean;
  confirmLabel: string; danger?: boolean; working: boolean;
  onConfirm: (note: string) => void; onCancel: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <div style={{
      background: "rgba(0,0,0,.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "40px 20px",
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", padding: 24, width: "100%", maxWidth: 420,
      }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{body}</div>
        <textarea
          style={{
            width: "100%", minHeight: 80, fontSize: 13, padding: "8px 10px",
            borderRadius: "var(--r)", border: "1px solid var(--border)",
            background: "var(--surface-2)", color: "var(--text)", resize: "vertical",
            marginBottom: 16, fontFamily: "inherit", boxSizing: "border-box",
          }}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={placeholder}
          autoFocus
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" disabled={working} onClick={onCancel}>Cancel</button>
          <button
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdjustmentDetailsPage() {
  const navigate         = useNavigate();
  const { adjustmentId } = useParams<{ adjustmentId: string }>();
  const { companyId, branchId } = useAppScope();
  const queryClient      = useQueryClient();

  const [working,     setWorking]     = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modal,       setModal]       = useState<"reject" | "reverse" | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────

  // FIX: stable query key — was a new array literal on every render, causing
  // the invalidate useCallback to be recreated on every render.
  const queryKey = useMemo(
    () => ["adjustment", companyId, branchId, adjustmentId] as const,
    [companyId, branchId, adjustmentId]
  );

  const { data: item, isLoading, error: loadError } = useQuery({
    queryKey,
    queryFn: () => adjustmentApi.get(companyId!, branchId!, adjustmentId!),

    // FIX: original required branchId to be truthy. branchId from useAppScope
    // falls back to "" when the JWT has no branch_id claim — Boolean("") is
    // false, so the query was silently disabled and the page showed "Not found"
    // with no explanation.
    //
    // branchId is kept in the query fn (the API may need it) but is NOT
    // required to enable the query — companyId + adjustmentId is sufficient
    // to identify the resource. If your backend route actually requires branchId
    // in the URL, fix the JWT claim instead (ensure branch_id is emitted by
    // GenerateAccessTokenAsync) and restore the branchId check here.
    enabled: Boolean(companyId && adjustmentId),
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  );

  // ── Action runner ─────────────────────────────────────────────────────────

  // FIX: was recreated on every render without useCallback — passed directly
  // into child component handlers, causing unnecessary re-renders.
  const run = useCallback(async (action: () => Promise<void>) => {
    setWorking(true);
    setActionError(null);
    try {
      await action();
      await invalidate();
      setModal(null);
    } catch (e) {
      setActionError(getApiError(e, "Action failed."));
    } finally {
      setWorking(false);
    }
  }, [invalidate]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const status = normalizeAdjustmentStatus(item?.docStatus);

  const totals = useMemo(() => (item?.lines ?? []).reduce(
    (acc, line) => {
      const qty = Number(line.adjustmentQty ?? 0);
      if (qty > 0) acc.qtyIn  += qty;
      if (qty < 0) acc.qtyOut += Math.abs(qty);
      acc.amount += Number(line.unitCost ?? 0) * qty;
      return acc;
    },
    { qtyIn: 0, qtyOut: 0, amount: 0 }
  ), [item]);

  const netVariance = totals.qtyIn - totals.qtyOut;

  // ── Loading / error states ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="page">
        <div style={{ padding: 48, textAlign: "center",
          color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  // FIX: added missing branchId warning so the user understands why the page
  // is empty, rather than seeing a generic "Not found" with no context.
  if (!branchId) {
    return (
      <div className="page">
        <div className="alert alert-warn">
          Branch scope is missing. Ensure your account has a branch assigned
          and log in again to refresh your session.
        </div>
        <button className="btn" onClick={() => navigate("/inventory/adjustments")}>
          ← Back to list
        </button>
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
        <button className="btn" onClick={() => navigate("/inventory/adjustments")}>
          ← Back to list
        </button>
      </div>
    );
  }

  // ── Modal overlay ─────────────────────────────────────────────────────────

  if (modal === "reject") {
    return (
      <div className="page">
        <ConfirmModal
          title="Reject adjustment"
          body="Provide a reason — this will be visible to the submitter."
          placeholder="Rejection reason (required)"
          requireText confirmLabel="Confirm reject" danger
          working={working}
          onConfirm={note => run(() => adjustmentApi.reject(companyId!, branchId, item.id, note))}
          onCancel={() => { setModal(null); setActionError(null); }}
        />
        {actionError && (
          <div className="alert alert-danger" style={{ margin: "0 20px" }}>{actionError}</div>
        )}
      </div>
    );
  }

  if (modal === "reverse") {
    return (
      <div className="page">
        <ConfirmModal
          title="Reverse adjustment"
          body="This writes counter-entries to FIFO and the inventory ledger. The action cannot be undone."
          placeholder="Reason for reversal (required)"
          requireText confirmLabel="Confirm reverse" danger
          working={working}
          onConfirm={reason => run(() => adjustmentApi.reverse(companyId!, branchId, item.id, reason))}
          onCancel={() => { setModal(null); setActionError(null); }}
        />
        {actionError && (
          <div className="alert alert-danger" style={{ margin: "0 20px" }}>{actionError}</div>
        )}
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="page">

      <div className="page-header">
        <div>
          <div className="page-kicker">Inventory · Adjustments</div>
          <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {item.adjustmentNo}
            <span className={STATUS_BADGE[status]}>{status}</span>
          </div>
          <div className="page-sub">
            {item.adjustmentType}
            {item.adjustmentDate && <> · {fmtDate(item.adjustmentDate)}</>}
            {item.referenceNo && (
              <span style={{ fontFamily: "var(--mono)", marginLeft: 8,
                fontSize: 11, color: "var(--text-soft)" }}>
                Ref: {item.referenceNo}
              </span>
            )}
          </div>
        </div>
        <button className="btn" onClick={() => navigate("/inventory/adjustments")}>
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
          <i className="ti ti-alert-triangle" aria-hidden style={{ marginRight: 6 }} />
          High variance detected — {item.highestVariancePercent?.toFixed(1)}% on one or more lines.
          {status === "Submitted" && " Manager approval required before posting."}
        </div>
      )}

      <AdjustmentWorkflowActionBar
        status={status}
        working={working}
        onEdit={()    => navigate(`/inventory/adjustments/${item.id}/edit`)}
        onSubmit={()  => run(() => adjustmentApi.submit(companyId!, branchId, item.id))}
        onApprove={() => run(() => adjustmentApi.approve(companyId!, branchId, item.id))}
        onReject={canReject(status)  ? () => setModal("reject")  : undefined}
        onPost={()    => run(() => adjustmentApi.post(companyId!, branchId, item.id))}
        onReverse={canReverse(status) ? () => setModal("reverse") : undefined}
      />

      {/* KPI strip */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Lines</div>
          <div className="kpi-val">{item.lines?.length ?? 0}</div>
          <div className="kpi-sub">adjustment lines</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Net variance qty</div>
          <div className="kpi-val" style={{
            color: netVariance < 0 ? "var(--danger)" : netVariance > 0 ? "var(--success)" : "var(--text)",
          }}>
            {netVariance >= 0 ? "+" : ""}{fmtQty(netVariance)}
          </div>
          <div className="kpi-sub">base units</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total value</div>
          <div className="kpi-val">{fmtMoney(totals.amount)}</div>
          <div className="kpi-sub">adjustment impact</div>
          {item.hasHighVariance && (
            <div className="kpi-badge badge-warn">
              ⚠ {item.highestVariancePercent?.toFixed(1)}% variance
            </div>
          )}
        </div>
        <div className="kpi">
          <div className="kpi-label">Approval</div>
          <div className="kpi-val">{status === "Submitted" ? "Pending" : status}</div>
          <div className="kpi-sub">
            {status === "Submitted" ? "awaiting review" : "no action needed"}
          </div>
          {status === "Submitted" && (
            <div className="kpi-badge badge-warn">Action needed</div>
          )}
        </div>
      </div>

      {/* Header information */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)",
          letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          Header information
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
          <InfoField label="Adjustment type" value={item.adjustmentType} />
          <InfoField label="Date"            value={fmtDate(item.adjustmentDate)} />
          <InfoField label="Reference no"    value={item.referenceNo} />
          <InfoField label="Reason"          value={item.reason} />
          <InfoField label="Remarks"         value={item.remarks} />
          <InfoField label="Submitted at"    value={fmtDate(item.submittedAt)} />
          <InfoField label="Approved at"     value={fmtDate(item.approvedAt)} />
          <InfoField label="Posted at"       value={fmtDate(item.postedAt)} />
          {item.rejectionNote && (
            <div style={{ gridColumn: "span 4" }}>
              <InfoField label="Rejection note" value={item.rejectionNote} />
            </div>
          )}
        </div>
      </div>

      {/* Lines table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)",
          fontSize: 12, fontWeight: 600, color: "var(--text-muted)",
          letterSpacing: "0.06em", textTransform: "uppercase" }}>
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
                <td colSpan={10} style={{ padding: 48, textAlign: "center",
                  color: "var(--text-soft)", fontSize: 13 }}>
                  No lines on this adjustment.
                </td>
              </tr>
            ) : (item.lines ?? []).map((line, index) => {
              const adjQty   = Number(line.adjustmentQty ?? 0);
              const amount   = Number(line.unitCost ?? 0) * adjQty;
              const variance = Number(line.variancePercent ?? 0);
              return (
                <tr key={line.id ?? index}>
                  <td style={{ fontSize: 11, color: "var(--text-muted)",
                    fontFamily: "var(--mono)", width: 36 }}>
                    {line.lineNo ?? index + 1}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>
                      {line.itemName || line.itemId}
                    </div>
                    {line.batchNo && (
                      <div style={{ fontSize: 11, color: "var(--text-soft)",
                        fontFamily: "var(--mono)", marginTop: 1 }}>
                        Batch: {line.batchNo}
                      </div>
                    )}
                    {line.expiryDate && (
                      <div style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 1 }}>
                        Exp: {fmtDate(line.expiryDate)}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{line.uomName || line.uomId}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                    {fmtQty(line.systemQty)}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                    {fmtQty(line.countedQty)}
                  </td>
                  <td style={{
                    textAlign: "right", fontFamily: "var(--mono)", fontSize: 12,
                    fontWeight: adjQty !== 0 ? 600 : 400,
                    color: adjQty < 0 ? "var(--danger)" : adjQty > 0 ? "var(--success)" : "var(--text-muted)",
                  }}>
                    {adjQty >= 0 ? "+" : ""}{fmtQty(adjQty)}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                    {fmtMoney(line.unitCost)}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)",
                    fontSize: 12, fontWeight: 500 }}>
                    {fmtMoney(amount)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {line.isHighVariance ? (
                      <span style={{ fontSize: 11, color: "var(--warn)", fontWeight: 600 }}>
                        <i className="ti ti-alert-triangle" aria-hidden
                          style={{ fontSize: 10, marginRight: 2 }} />
                        {variance.toFixed(1)}%
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontFamily: "var(--mono)",
                        color: "var(--text-muted)" }}>
                        {variance.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-soft)" }}>
                    {line.notes || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {(item.lines ?? []).length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--surface-2)" }}>
                <td colSpan={5} style={{ padding: "8px 12px", fontSize: 12,
                  fontWeight: 600, color: "var(--text-muted)" }}>
                  Totals
                </td>
                <td style={{
                  textAlign: "right", fontFamily: "var(--mono)", fontSize: 12,
                  fontWeight: 600, padding: "8px 12px",
                  color: netVariance < 0 ? "var(--danger)" : netVariance > 0 ? "var(--success)" : "var(--text)",
                }}>
                  {netVariance >= 0 ? "+" : ""}{fmtQty(netVariance)}
                </td>
                <td />
                <td style={{ textAlign: "right", fontFamily: "var(--mono)",
                  fontSize: 12, fontWeight: 600, padding: "8px 12px" }}>
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