// src/features/inventory/stockTransfers/pages/StockTransferDetailPage.tsx

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { stockTransfersApi } from "../api/stockTransfersApi";
import {
  STOCK_TRANSFER_STATUS,
  type StockTransferDetailDto,
  type StockTransferStatus,
} from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function money(n?: number | null) {
  if (n == null || !isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function apiErr(e: unknown): string {
  const err  = e as any;
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  return data?.message ?? data?.title ?? err?.message ?? "Request failed";
}

// ── Status normalisation ──────────────────────────────────────────────────────
//
// FIX: original used `data?.status as StockTransferStatus` — a direct cast
// that silently produces the wrong value when the API returns lowercase
// ("submitted") or numeric status codes. canApprove / canReject were always
// false for Submitted transfers, so the buttons never rendered.

const STATUS_VALUES = new Set<StockTransferStatus>(
  Object.values(STOCK_TRANSFER_STATUS)
);

function normalizeStatus(raw: unknown): StockTransferStatus {
  if (STATUS_VALUES.has(raw as StockTransferStatus))
    return raw as StockTransferStatus;

  const v = String(raw ?? "").trim().toLowerCase().replace(/[\s_]/g, "");
  switch (v) {
    case "0":  case "draft":             return STOCK_TRANSFER_STATUS.Draft;
    case "1":  case "submitted":         return STOCK_TRANSFER_STATUS.Submitted;
    case "2":  case "approved":          return STOCK_TRANSFER_STATUS.Approved;
    case "3":  case "posted":            return STOCK_TRANSFER_STATUS.Posted;
    case "4":  case "rejected":          return STOCK_TRANSFER_STATUS.Rejected;
    case "5":  case "reversed":          return STOCK_TRANSFER_STATUS.Reversed;
    case "6":  case "cancelled":
               case "canceled":          return STOCK_TRANSFER_STATUS.Cancelled;
    case "7":  case "failed":            return STOCK_TRANSFER_STATUS.Failed;
    case "8":  case "issued":            return STOCK_TRANSFER_STATUS.Issued;
    case "9":  case "changesrequested":  return STOCK_TRANSFER_STATUS.ChangesRequested;
    default:                             return STOCK_TRANSFER_STATUS.Draft;
  }
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<StockTransferStatus, {
  label: string; bg: string; color: string; icon: string;
}> = {
  Draft:     { label: "Draft",     bg: "#f1f5f9", color: "#475569", icon: "✎"  },
  Submitted: { label: "Submitted", bg: "#fef3c7", color: "#92400e", icon: "⏳" },
  Approved:  { label: "Approved",  bg: "#dbeafe", color: "#1e40af", icon: "✓"  },
  Rejected:  { label: "Rejected",  bg: "#fee2e2", color: "#991b1b", icon: "✕"  },
  Posted:    { label: "Posted",    bg: "#d1fae5", color: "#065f46", icon: "⬆"  },
  Reversed:  { label: "Reversed",  bg: "#ede9fe", color: "#5b21b6", icon: "↩"  },
  Cancelled: { label: "Cancelled", bg: "#f3f4f6", color: "#374151", icon: "○"  },
  Failed:    { label: "Failed",    bg: "#fee2e2", color: "#991b1b", icon: "✗"  },
  Issued:    { label: "Issued",    bg: "#dbeafe", color: "#1e40af", icon: "📦"  },
  ChangesRequested: { label: "Changes Requested", bg: "#fef3c7", color: "#92400e", icon: "✏"  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StockTransferStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: cfg.bg, color: cfg.color,
    }}>
      <span>{cfg.icon}</span> {cfg.label}
    </span>
  );
}

function WorkflowStep({ label, done, current, icon }: {
  label: string; done: boolean; current: boolean; icon: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700,
        background: done ? "#059669" : current ? "#3b82f6" : "#e2e8f0",
        color: done || current ? "#fff" : "#94a3b8",
        border: current ? "2px solid #93c5fd" : "2px solid transparent",
        boxShadow: current ? "0 0 0 3px #eff6ff" : "none",
        transition: "all .2s",
      }}>
        {done ? "✓" : icon}
      </div>
      <span style={{
        fontSize: 11, marginTop: 6,
        fontWeight: current ? 700 : 400,
        color: done ? "#059669" : current ? "#3b82f6" : "#94a3b8",
      }}>
        {label}
      </span>
    </div>
  );
}

function Field({ label, value, mono }: {
  label: string; value: React.ReactNode; mono?: boolean;
}) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: "#94a3b8",
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 500, color: "#0f172a",
        fontFamily: mono ? "monospace" : undefined,
      }}>
        {value || "—"}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
      overflow: "hidden", marginBottom: 16,
    }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{title}</div>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

// ── RejectModal ───────────────────────────────────────────────────────────────
//
// FIX: original used browser prompt() — a blocking, unstyled native dialog
// that can't be customised and is disabled in some iframe / CSP contexts.
// Replaced with an inline modal consistent with the rest of the codebase.

function RejectModal({
  working, onConfirm, onCancel,
}: {
  working: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(15,23,42,.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 14, padding: 28, width: 440,
        boxShadow: "0 20px 60px rgba(15,23,42,.2)",
        border: "1px solid #e2e8f0",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
          Reject transfer
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
          Provide a reason — this will be visible to the submitter.
        </div>
        <textarea
          style={{
            width: "100%", minHeight: 88, fontSize: 13, padding: "8px 12px",
            borderRadius: 8, border: "1px solid #e2e8f0", resize: "vertical",
            background: "#f8fafc", color: "#0f172a", fontFamily: "inherit",
            boxSizing: "border-box", marginBottom: 16,
            outline: "none",
          }}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Rejection reason (required)"
          autoFocus
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            disabled={working}
            onClick={onCancel}
            style={{
              padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: "1px solid #e2e8f0", background: "#f8fafc",
              color: "#475569", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            disabled={working || !text.trim()}
            onClick={() => onConfirm(text.trim())}
            style={{
              padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: "1px solid #dc2626", background: "#dc2626",
              color: "#fff", cursor: working || !text.trim() ? "not-allowed" : "pointer",
              opacity: working || !text.trim() ? 0.6 : 1,
            }}
          >
            {working ? "Rejecting…" : "Confirm reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ActionBtn ─────────────────────────────────────────────────────────────────

const BTN_STYLES: Record<string, React.CSSProperties> = {
  primary:   { background: "#2563eb", color: "#fff",     border: "1px solid #2563eb"  },
  success:   { background: "#059669", color: "#fff",     border: "1px solid #059669"  },
  danger:    { background: "#dc2626", color: "#fff",     border: "1px solid #dc2626"  },
  secondary: { background: "#f1f5f9", color: "#334155",  border: "1px solid #cbd5e1"  },
  ghost:     { background: "transparent", color: "#64748b", border: "1px solid #e2e8f0" },
};

function ActionBtn({ label, busy, name, variant, onClick }: {
  label: string; busy: string | null; name: string;
  variant: keyof typeof BTN_STYLES; onClick: () => void;
}) {
  const isMe = busy === name;
  return (
    <button
      disabled={!!busy}
      onClick={onClick}
      style={{
        padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy && !isMe ? 0.5 : 1,
        transition: "opacity .15s",
        ...BTN_STYLES[variant],
      }}
    >
      {isMe ? "…" : label}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StockTransferDetailPage() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { companyId, branchId } = useAppScope();

  const [data,         setData]         = useState<StockTransferDetailDto | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [busy,         setBusy]         = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [success,      setSuccess]      = useState<string | null>(null);
  const [showReject,   setShowReject]   = useState(false);

  // Ref guard — prevents double-submit before React re-renders busy state.
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!id || !companyId) return;
    setLoading(true); setError(null); setSuccess(null);
    try {
      setData(await stockTransfersApi.get(companyId, branchId, id));
    } catch (e) {
      setError(apiErr(e));
    } finally {
      setLoading(false);
    }
  }, [id, companyId, branchId]);

  useEffect(() => { void load(); }, [load]);

  // FIX: was recreated on every render without useCallback — passed into
  // multiple button onClick handlers, causing unnecessary re-renders.
  const act = useCallback(async (
    name: string,
    fn: () => Promise<unknown>,
    successMsg: string
  ) => {
    if (!id || inFlight.current) return;
    inFlight.current = true;
    setBusy(name); setError(null); setSuccess(null);
    try {
      await fn();
      setSuccess(successMsg);
      await load();
    } catch (e) {
      setError(apiErr(e));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }, [id, load]);

  const handleRejectConfirm = useCallback((reason: string) => {
    void act(
      "reject",
      () => stockTransfersApi.reject(companyId, branchId, id!, reason),
      "Transfer rejected."
    ).then(() => setShowReject(false));
  }, [act, companyId, branchId, id]);

  // FIX: normalizeStatus applied so comparisons work regardless of whether
  // the API returns "Submitted", "submitted", or a numeric code.
  const status     = normalizeStatus(data?.status);
  const canEdit    = status === STOCK_TRANSFER_STATUS.Draft    || status === STOCK_TRANSFER_STATUS.Rejected;
  const canSubmit  = status === STOCK_TRANSFER_STATUS.Draft;
  const canApprove = status === STOCK_TRANSFER_STATUS.Submitted;
  const canPost    = status === STOCK_TRANSFER_STATUS.Approved;
  const canCancel  = status === STOCK_TRANSFER_STATUS.Draft    || status === STOCK_TRANSFER_STATUS.Submitted;

  const stepIndex  = ["Draft","Submitted","Approved","Posted"].indexOf(status);
  const totalQty   = data?.items.reduce((s, l) => s + (l.quantity  ?? 0), 0) ?? 0;
  const totalValue = data?.items.reduce((s, l) => s + (l.lineValue ?? 0), 0) ?? 0;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", gap: 16, marginBottom: 20,
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 6,
          }}>
            Inventory · Stock Transfers
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            {loading && !data ? "Loading…" : (data?.transferNumber ?? "Stock Transfer")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            {data && <StatusBadge status={status} />}
            {canEdit && (
              <button
                onClick={() => nav(`/inventory/stock-transfers/${id}/edit`)}
                style={{
                  fontSize: 12, padding: "4px 12px", borderRadius: 8,
                  border: "1px solid #e2e8f0", background: "#f8fafc",
                  cursor: "pointer", color: "#475569", fontWeight: 600,
                }}
              >
                ✎ Edit
              </button>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} disabled={loading}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0",
              background: "#f8fafc", cursor: "pointer", fontSize: 13, color: "#475569",
            }}>
            {loading ? "…" : "↻ Refresh"}
          </button>
          <button onClick={() => nav("/inventory/stock-transfers")}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0",
              background: "#f8fafc", cursor: "pointer", fontSize: 13, color: "#475569",
            }}>
            ← Back
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, background: "#fef2f2",
          border: "1px solid #fecaca", color: "#991b1b", fontSize: 13,
          marginBottom: 16, display: "flex", gap: 10,
        }}>
          <span>✕</span><div>{error}</div>
        </div>
      )}
      {success && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, background: "#f0fdf4",
          border: "1px solid #bbf7d0", color: "#166534", fontSize: 13,
          marginBottom: 16, display: "flex", gap: 10,
        }}>
          <span>✓</span><div>{success}</div>
        </div>
      )}
      {status === STOCK_TRANSFER_STATUS.Rejected && data?.rejectionReason && (
        <div style={{
          padding: "14px 16px", borderRadius: 10, background: "#fef2f2",
          border: "1px solid #fecaca", color: "#991b1b", fontSize: 13, marginBottom: 16,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Rejection reason</div>
          <div>{data.rejectionReason}</div>
        </div>
      )}

      {/* Workflow strip */}
      {status !== STOCK_TRANSFER_STATUS.Cancelled &&
       status !== STOCK_TRANSFER_STATUS.Reversed && (
        <div style={{
          background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
          padding: "20px 24px", marginBottom: 16,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "#94a3b8",
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16,
          }}>
            Workflow
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
            <div style={{
              position: "absolute", top: 17, left: "10%", right: "10%",
              height: 2, background: "#e2e8f0", zIndex: 0,
            }} />
            <div style={{
              position: "absolute", top: 17, left: "10%",
              width: `${Math.max(0, (stepIndex / 3) * 80)}%`,
              height: 2, background: "#059669", zIndex: 0, transition: "width .4s",
            }} />
            {([
              { label: "Draft",     icon: "✎"  },
              { label: "Submitted", icon: "⏳" },
              { label: "Approved",  icon: "✓"  },
              { label: "Posted",    icon: "⬆"  },
            ] as const).map((s, i) => (
              <WorkflowStep
                key={s.label}
                label={s.label}
                icon={s.icon}
                done={i < stepIndex}
                current={i === stepIndex}
              />
            ))}
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Lines",       value: data?.items.length ?? "—"                            },
          { label: "Total Qty",   value: totalQty.toLocaleString()                            },
          { label: "Total Value", value: totalValue > 0 ? money(totalValue) : "—"            },
          { label: "From → To",   value: data ? `${data.fromLocationName} → ${data.toLocationName}` : "—" },
        ].map(k => (
          <div key={k.label} style={{
            background: "#fff", borderRadius: 12,
            border: "1px solid #e2e8f0", padding: "14px 16px",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#94a3b8",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
            }}>
              {k.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {data && (
        <>
          <Section title="Transfer Details">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 20 }}>
              <Field label="Transfer No"   value={data.transferNumber} mono />
              <Field label="Transfer Date" value={fmt(data.transferDateUtc)} />
              <Field label="Reference"     value={data.reference} />
              <Field label="Status"        value={<StatusBadge status={status} />} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
              <Field label="From Location" value={data.fromLocationName} />
              <Field label="To Location"   value={data.toLocationName} />
              {data.notes && <Field label="Notes" value={data.notes} />}
            </div>
          </Section>

          <Section title="Audit Trail">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
              <Field label="Submitted At" value={fmt(data.submittedAtUtc)} />
              <Field label="Approved At"  value={fmt(data.approvedAtUtc)} />
              <Field label="Posted At"    value={fmt(data.postedAtUtc)} />
              <Field label="Rejected At"  value={fmt(data.rejectedAtUtc)} />
            </div>
          </Section>

          {/* Lines */}
          <div style={{
            background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
            overflow: "hidden", marginBottom: 80,
          }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Line Items</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                {data.items.length} item{data.items.length !== 1 ? "s" : ""} in this transfer
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["#", "Item", "UOM", "Qty", "Unit Cost", "Line Value"].map((h, i) => (
                      <th key={h} style={{
                        padding: "10px 16px", fontSize: 11, fontWeight: 700,
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        color: "#94a3b8", borderBottom: "1px solid #e2e8f0",
                        textAlign: i >= 3 ? "right" : "left", whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{
                        padding: "40px 16px", textAlign: "center",
                        color: "#94a3b8", fontSize: 13,
                      }}>
                        No line items.
                      </td>
                    </tr>
                  ) : data.items.map((l, idx) => (
                    <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 16px", color: "#94a3b8", fontFamily: "monospace", fontSize: 12 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{l.itemName || "—"}</div>
                        {l.itemCode && (
                          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>
                            {l.itemCode}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#475569" }}>{l.uom || "—"}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, fontFamily: "monospace" }}>
                        {l.quantity}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569", fontFamily: "monospace" }}>
                        {money(l.avgUnitCost)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, fontFamily: "monospace" }}>
                        {money(l.lineValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {data.items.length > 0 && totalValue > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #e2e8f0", background: "#f8fafc" }}>
                      <td colSpan={3} />
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, fontFamily: "monospace" }}>
                        {totalQty}
                      </td>
                      <td />
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, fontFamily: "monospace" }}>
                        {money(totalValue)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* Sticky action bar */}
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 20px", borderRadius: 16,
        background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)",
        boxShadow: "0 4px 24px rgba(15,23,42,.12), 0 0 0 1px rgba(15,23,42,.06)",
        zIndex: 50, flexWrap: "wrap", justifyContent: "center",
      }}>
        <span style={{ fontSize: 12, color: "#94a3b8", marginRight: 4 }}>
          <b style={{ color: "#475569" }}>Workflow:</b> Draft → Submit → Approve → Post
        </span>

        {canEdit && (
          <ActionBtn label="✎ Edit" busy={busy} name="edit" variant="secondary"
            onClick={() => nav(`/inventory/stock-transfers/${id}/edit`)} />
        )}
        {canSubmit && (
          <ActionBtn label="Submit for Approval" busy={busy} name="submit" variant="primary"
            onClick={() => act("submit",
              () => stockTransfersApi.submit(companyId, branchId, id!),
              "Submitted for approval.")} />
        )}
        {canApprove && (
          <>
            <ActionBtn label="✓ Approve" busy={busy} name="approve" variant="success"
              onClick={() => act("approve",
                () => stockTransfersApi.approve(companyId, branchId, id!),
                "Transfer approved.")} />
            <ActionBtn label="✕ Reject" busy={busy} name="reject" variant="danger"
              onClick={() => setShowReject(true)} />
          </>
        )}
        {canPost && (
          <ActionBtn label="⬆ Post (FIFO + Ledger)" busy={busy} name="post" variant="primary"
            onClick={() => act("post",
              () => stockTransfersApi.post(companyId, branchId, id!),
              "Transfer posted to ledger.")} />
        )}
        {canCancel && (
          <ActionBtn label="Cancel" busy={busy} name="cancel" variant="ghost"
            onClick={() => act("cancel",
              () => stockTransfersApi.cancel(companyId, branchId, id!),
              "Transfer cancelled.")} />
        )}
      </div>

      {/* Reject modal */}
      {showReject && (
        <RejectModal
          working={busy === "reject"}
          onConfirm={handleRejectConfirm}
          onCancel={() => { setShowReject(false); setError(null); }}
        />
      )}
    </div>
  );
}