// src/features/inventory/siv/pages/SivDetailsPage.tsx
//
// Full SIV detail view with:
//   • Workflow progress bar
//   • Command bar (role-gated action buttons)
//   • Line items table (Requested / Approved / Issued / Cost columns)
//   • Audit trail tab
//   • FIFO preview tab (lazy-loaded per line)
//   • Properties panel
//   • All workflow action modals wired to real API

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams }            from "react-router-dom";
import { useAppScope }                       from "../../../../app/useAppScope";
import { sivApi }                            from "../api/sivApi";
import type { ApproveSivLineRequest, IssueSivLineRequest, SivLineFifoPreviewDto } from "../api/sivApi";
import SivWorkflowBar                        from "../components/SivWorkflowBar";
import {
  normalizeStatus, STATUS_BADGE, resolvePermissions,
  mapToVm, fmtDate, fmtDateTime, fmtQty, fmt$, getApiError,
  type SivVm, type SivLineVm,
}                                            from "../types/sivTypes";
import "./siv-draft.css";

// ── Approve modal — per-line quantity overrides ───────────────────────────────

function ApproveModal({
  lines,  busy,
  onConfirm, onCancel,
}: {
  lines:      SivLineVm[];
  rowVersion: string | null;
  busy:       boolean;
  onConfirm:  (lines: ApproveSivLineRequest[], remarks: string) => void;
  onCancel:   () => void;
}) {
  const [qtys,    setQtys]    = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState("");
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    lines.forEach((l) => {
      const v = qtys[l.id] !== undefined ? parseFloat(qtys[l.id]) : l.qty;
      if (isNaN(v) || v < 0) e[l.id] = "Cannot be negative";
      else if (v > l.qty) e[l.id] = `Max: ${fmtQty(l.qty)}`;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = () => {
    if (!validate()) return;
    const lineReqs: ApproveSivLineRequest[] = lines.map((l) => ({
      lineId:      l.id,
      approvedQty: qtys[l.id] !== undefined ? parseFloat(qtys[l.id]) : l.qty,
    }));
    onConfirm(lineReqs, remarks);
  };

  const partials = lines.filter(
    (l) => qtys[l.id] !== undefined && parseFloat(qtys[l.id]) < l.qty
  ).length;

  return (
    <div
      style={{
        position:"fixed",inset:0,background:"rgba(0,0,0,.45)",
        display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,
      }}
    >
      <div
        style={{
          background:"var(--surface)",borderRadius:"var(--r-lg)",
          padding:24,width:580,maxHeight:"90vh",overflowY:"auto",
          border:"1px solid var(--border)",boxShadow:"var(--shadow-lg)",
        }}
      >
        <div style={{fontWeight:600,fontSize:15,marginBottom:4}}>Approve SIV</div>
        <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:16}}>
          Review quantities. Leave unchanged to approve at the full requested amount.
        </div>

        {partials > 0 && (
          <div className="alert alert-warn" style={{marginBottom:14}}>
            ⚠ {partials} line{partials > 1 ? "s" : ""} will be partially approved.
          </div>
        )}

        <table className="table" style={{marginBottom:14}}>
          <thead>
            <tr>
              <th>Item</th>
              <th>UOM</th>
              <th style={{textAlign:"right"}}>Requested</th>
              <th style={{textAlign:"right",width:130}}>Approved Qty</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const cur     = qtys[l.id] !== undefined ? qtys[l.id] : String(l.qty);
              const partial = parseFloat(cur) < l.qty;
              return (
                <tr key={l.id} style={{background:partial?"var(--warn-bg-light)":"transparent"}}>
                  <td>
                    <div style={{fontWeight:500}}>{l.itemName || "—"}</div>
                    <div style={{fontSize:10,color:"var(--text-muted)",fontFamily:"var(--mono)"}}>{l.itemCode}</div>
                  </td>
                  <td style={{fontFamily:"var(--mono)",fontSize:12}}>{l.uomCode}</td>
                  <td style={{textAlign:"right",fontFamily:"var(--mono)",fontWeight:500}}>
                    {fmtQty(l.qty)}
                  </td>
                  <td style={{padding:"6px 12px"}}>
                    <input
                      type="number" min={0} max={l.qty} step="0.001"
                      className="input"
                      value={cur}
                      onChange={(e) => setQtys((p) => ({ ...p, [l.id]: e.target.value }))}
                      style={{
                        height:32,fontSize:12,
                        borderColor:errors[l.id]?"var(--danger)":partial?"var(--warn)":undefined,
                      }}
                    />
                    {errors[l.id] && (
                      <div style={{fontSize:10,color:"var(--danger)",marginTop:2}}>
                        {errors[l.id]}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="field" style={{marginBottom:16}}>
          <label className="field-label">Approval notes (optional)</label>
          <textarea
            className="input"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Notes for the warehouse…"
            style={{minHeight:64}}
          />
        </div>

        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-success" onClick={handleConfirm} disabled={busy}>
            {busy ? "Approving…" : "Approve SIV"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Issue modal — per-line issued quantities ───────────────────────────────────

function IssueModal({
  lines, rowVersion, busy,
  onConfirm, onCancel,
}: {
  lines:      SivLineVm[];
  rowVersion: string | null;
  busy:       boolean;
  onConfirm:  (lines: IssueSivLineRequest[], remarks: string) => void;
  onCancel:   () => void;
}) {
  const [qtys,    setQtys]    = useState<Record<string, string>>({});
  const [batches, setBatches] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState("");
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    lines.forEach((l) => {
      const max = l.approvedQty ?? l.qty;
      const v   = qtys[l.id] !== undefined ? parseFloat(qtys[l.id]) : max;
      if (isNaN(v) || v < 0) e[l.id] = "Cannot be negative";
      else if (v > max) e[l.id] = `Max: ${fmtQty(max)}`;
    });
    const allZero = lines.every((l) => {
      const max = l.approvedQty ?? l.qty;
      const v   = qtys[l.id] !== undefined ? parseFloat(qtys[l.id]) : max;
      return v === 0;
    });
    if (allZero) e._all = "At least one line must have a non-zero issued quantity.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = () => {
    if (!validate()) return;
    const lineReqs: IssueSivLineRequest[] = lines.map((l) => {
      const max = l.approvedQty ?? l.qty;
      return {
        lineId:    l.id,
        issuedQty: qtys[l.id] !== undefined ? parseFloat(qtys[l.id]) : max,
        batchNo:   batches[l.id] || l.batchNo || null,
      };
    });
    onConfirm(lineReqs, remarks);
  };

  return (
    <div
      style={{
        position:"fixed",inset:0,background:"rgba(0,0,0,.45)",
        display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,
      }}
    >
      <div
        style={{
          background:"var(--surface)",borderRadius:"var(--r-lg)",
          padding:24,width:640,maxHeight:"90vh",overflowY:"auto",
          border:"1px solid var(--border)",boxShadow:"var(--shadow-lg)",
        }}
      >
        <div style={{fontWeight:600,fontSize:15,marginBottom:4}}>Issue SIV</div>
        <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:16}}>
          Confirm quantities physically picked from the warehouse.
          IssuedQty ≤ ApprovedQty.
        </div>

        {errors._all && (
          <div className="alert alert-danger" style={{marginBottom:12}}>{errors._all}</div>
        )}

        <table className="table" style={{marginBottom:14}}>
          <thead>
            <tr>
              <th>Item</th>
              <th style={{textAlign:"right"}}>Approved</th>
              <th style={{textAlign:"right",width:130}}>Issued Qty</th>
              <th style={{width:140}}>Batch / Lot No.</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const max = l.approvedQty ?? l.qty;
              const cur = qtys[l.id] !== undefined ? qtys[l.id] : String(max);
              return (
                <tr key={l.id}>
                  <td>
                    <div style={{fontWeight:500}}>{l.itemName || "—"}</div>
                    <div style={{fontSize:10,color:"var(--text-muted)",fontFamily:"var(--mono)"}}>
                      {l.itemCode} · {l.uomCode}
                    </div>
                  </td>
                  <td style={{textAlign:"right",fontFamily:"var(--mono)",fontWeight:500}}>
                    {fmtQty(max)}
                  </td>
                  <td style={{padding:"6px 12px"}}>
                    <input
                      type="number" min={0} max={max} step="0.001"
                      className="input"
                      value={cur}
                      onChange={(e) => {
                        if (parseFloat(e.target.value) > max) return;
                        setQtys((p) => ({ ...p, [l.id]: e.target.value }));
                      }}
                      style={{height:32,fontSize:12,borderColor:errors[l.id]?"var(--danger)":undefined}}
                    />
                    {errors[l.id] && (
                      <div style={{fontSize:10,color:"var(--danger)",marginTop:2}}>{errors[l.id]}</div>
                    )}
                  </td>
                  <td style={{padding:"6px 12px"}}>
                    <input
                      type="text" className="input"
                      value={batches[l.id] ?? ""}
                      onChange={(e) => setBatches((p) => ({ ...p, [l.id]: e.target.value }))}
                      placeholder="Batch / Lot No."
                      style={{height:32,fontSize:12}}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="field" style={{marginBottom:16}}>
          <label className="field-label">Issue notes (optional)</label>
          <textarea
            className="input"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Warehouse notes…"
            style={{minHeight:56}}
          />
        </div>

        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={busy}>
            {busy ? "Issuing…" : "Confirm Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Remarks modal (Reject / Request Changes / Reverse) ────────────────────────

function RemarksModal({
  title, subtitle, fieldLabel, confirmLabel, confirmClass,
  required, busy,
  onConfirm, onCancel,
}: {
  title:        string;
  subtitle?:    string;
  fieldLabel:   string;
  confirmLabel: string;
  confirmClass: string;
  required:     boolean;
  busy:         boolean;
  onConfirm:    (remarks: string) => void;
  onCancel:     () => void;
}) {
  const [text,  setText]  = useState("");
  const [err,   setErr]   = useState("");
  const valid = !required || text.trim().length > 0;

  return (
    <div
      style={{
        position:"fixed",inset:0,background:"rgba(0,0,0,.4)",
        display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,
      }}
    >
      <div
        style={{
          background:"var(--surface)",borderRadius:"var(--r-lg)",
          padding:24,width:440,
          border:"1px solid var(--border)",boxShadow:"var(--shadow-lg)",
        }}
      >
        <div style={{fontWeight:600,fontSize:15,marginBottom:subtitle?4:12}}>{title}</div>
        {subtitle && (
          <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:14}}>{subtitle}</div>
        )}
        <div className="field" style={{marginBottom:16}}>
          <label className="field-label">
            {fieldLabel}{required && <span style={{color:"var(--danger)",marginLeft:3}}>*</span>}
          </label>
          <textarea
            className="input"
            value={text}
            onChange={(e) => { setText(e.target.value); if (e.target.value) setErr(""); }}
            placeholder={required ? "Required" : "Optional"}
            style={{minHeight:88}}
            autoFocus
          />
          {err && <div style={{fontSize:11,color:"var(--danger)",marginTop:3}}>{err}</div>}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className={`btn ${confirmClass}`}
            onClick={() => {
              if (required && !text.trim()) { setErr("This field is required."); return; }
              onConfirm(text.trim());
            }}
            disabled={busy || !valid}
          >
            {busy ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Post confirmation modal ───────────────────────────────────────────────────

function PostModal({
  doc, busy,
  onConfirm, onCancel,
}: {
  doc:       SivVm;
  busy:      boolean;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  const issued = doc.lines.filter((l) => l.issuedQty > 0);
  const total  = issued.reduce((s, l) => s + l.issuedQty, 0);
  return (
    <div
      style={{
        position:"fixed",inset:0,background:"rgba(0,0,0,.4)",
        display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,
      }}
    >
      <div
        style={{
          background:"var(--surface)",borderRadius:"var(--r-lg)",
          padding:24,width:480,
          border:"1px solid var(--border)",boxShadow:"var(--shadow-lg)",
        }}
      >
        <div style={{fontWeight:600,fontSize:15,marginBottom:4}}>Post to Inventory Ledger</div>
        <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:16}}>
          This will trigger FIFO consumption at {doc.fromLocationName} and create
          inventory ledger entries. This cannot be undone without a formal reversal.
        </div>
        <div className="alert alert-success" style={{marginBottom:14}}>
          ▲ {issued.length} line{issued.length !== 1 ? "s" : ""} · {fmtQty(total)} units
          will be posted from {doc.fromLocationName} → {doc.toLocationName || doc.departmentName || "—"}.
        </div>
        <div className="alert alert-warn" style={{marginBottom:18}}>
          ⚠ Posting is permanent. Verify all quantities before proceeding.
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? "Posting…" : "Post to Ledger"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FIFO Preview panel ────────────────────────────────────────────────────────

function FifoPreviewPanel({
  companyId, sivId, lines,
}: {
  companyId: string;
  sivId:     string;
  lines:     SivLineVm[];
}) {
  const [selectedLine, setSelectedLine] = useState<string>(lines[0]?.id ?? "");
  const [preview,      setPreview]      = useState<SivLineFifoPreviewDto | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [err,          setErr]          = useState("");

  const loadPreview = async (lineId: string) => {
    setLoading(true); setErr(""); setPreview(null);
    try {
      const data = await sivApi.getFifoPreview(companyId, sivId, lineId);
      setPreview(data.data);
    } catch (e) {
      setErr(getApiError(e, "Failed to load FIFO preview."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{marginBottom:14}}>
        <label className="field-label">Select line to preview</label>
        <select
          className="select"
          style={{maxWidth:320}}
          value={selectedLine}
          onChange={(e) => {
            setSelectedLine(e.target.value);
            void loadPreview(e.target.value);
          }}
        >
          <option value="">— choose a line —</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.itemName || l.itemCode} ({fmtQty(l.qty)} {l.uomCode})
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div style={{padding:24,textAlign:"center",color:"var(--text-muted)",fontSize:13}}>
          Loading FIFO preview…
        </div>
      )}

      {err && <div className="alert alert-danger">{err}</div>}

      {preview && !loading && (
        <div>
          <div style={{marginBottom:12,fontSize:13}}>
            <strong>{preview.itemName}</strong>
            {" · "} Need:{" "}
            <span style={{fontFamily:"var(--mono)",fontWeight:500}}>
              {fmtQty(preview.requestedQty)} {preview.uomCode}
            </span>
          </div>

          {preview.allocations.length === 0 ? (
            <div style={{padding:24,textAlign:"center",color:"var(--text-muted)",fontSize:13}}>
              No FIFO lots available for this item at the selected warehouse.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Lot</th>
                  <th>Received</th>
                  <th>Batch</th>
                  <th>Expiry</th>
                  <th style={{textAlign:"right"}}>Available</th>
                  <th style={{textAlign:"right"}}>Proposed take</th>
                </tr>
              </thead>
              <tbody>
                {preview.allocations.map((alloc) => (
                  <tr key={alloc.fifoLayerId}>
                    <td style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)"}}>
                      {alloc.sourceNumber || alloc.fifoLayerId.slice(0, 8)}
                    </td>
                    <td style={{fontSize:12}}>{fmtDate(alloc.receivedDate)}</td>
                    <td style={{fontSize:12}}>{alloc.batchNo || "—"}</td>
                    <td
                      style={{
                        fontSize: 12,
                        color:
                          alloc.expiryDate && new Date(alloc.expiryDate) < new Date()
                            ? "var(--danger)" : "var(--text)",
                      }}
                    >
                      {alloc.expiryDate ? fmtDate(alloc.expiryDate) : "—"}
                    </td>
                    <td style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:12}}>
                      {fmtQty(alloc.availableBaseQty)}
                    </td>
                    <td
                      style={{
                        textAlign:  "right",
                        fontFamily: "var(--mono)",
                        fontSize:   12,
                        fontWeight: 500,
                        color:      "var(--accent)",
                      }}
                    >
                      {fmtQty(alloc.proposedIssueBaseQty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!selectedLine && !loading && (
        <div style={{padding:32,textAlign:"center",color:"var(--text-muted)",fontSize:13}}>
          Select a line above to see the FIFO lot allocation preview.
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ModalType = "none"|"approve"|"reject"|"requestChanges"|"issue"|"post"|"reverse"|"submit";

export default function SivDetailsPage() {
  const nav = useNavigate();
  const { companyId: routeCompanyId, sivId = "" } = useParams<{
    companyId?: string; sivId?: string;
  }>();
  const { companyId: scopeCompanyId } = useAppScope();
  const companyId = routeCompanyId || scopeCompanyId || "";

  const [doc,     setDoc]     = useState<SivVm | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modal,   setModal]   = useState<ModalType>("none");
  const [tab,     setTab]     = useState<"lines"|"audit"|"fifo">("lines");

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!companyId || !sivId) return;
    setLoading(true); setErr(null);
    try {
      const raw = await sivApi.getById(companyId, sivId);
      setDoc(mapToVm(raw.data));
    } catch (e) {
      setErr(getApiError(e, "Failed to load SIV."));
    } finally {
      setLoading(false);
    }
  }, [companyId, sivId]);

  useEffect(() => { void load(); }, [load]);

  // ── Generic action runner ─────────────────────────────────────────────────

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true); setErr(null); setSuccess(null);
    try {
      await fn();
      setSuccess(`${label} successful.`);
      setModal("none");
      await load();
    } catch (e) {
      setErr(getApiError(e, `${label} failed.`));
    } finally {
      setBusy(false);
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page">
        <div style={{padding:48,textAlign:"center",color:"var(--text-muted)",fontSize:13}}>
          Loading SIV…
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="page">
        {err && <div className="alert alert-danger">{err}</div>}
        <div style={{fontSize:13,color:"var(--text-soft)"}}>SIV not found.</div>
      </div>
    );
  }

  const status = normalizeStatus(doc.docStatus);
  const p      = resolvePermissions(status);
  const totalReq = doc.lines.reduce((s, l) => s + l.qty, 0);
  const totalApp = doc.lines.reduce((s, l) => s + (l.approvedQty ?? 0), 0);
  const totalIss = doc.lines.reduce((s, l) => s + l.issuedQty, 0);

  const statusBanners: Record<string, React.ReactNode> = {
    ChangesRequested: (
      <div className="alert alert-warn" style={{marginBottom:14}}>
        ↩ <strong>Changes Requested</strong> — This SIV has been returned for
        amendment. Review the remarks below, update lines, and resubmit.
      </div>
    ),
    Rejected: (
      <div className="alert alert-danger" style={{marginBottom:14}}>
        ✕ <strong>Rejected</strong> — This SIV has been rejected and is closed.
        Create a new SIV if required.
      </div>
    ),
    Reversed: (
      <div className="alert" style={{marginBottom:14}}>
        ↺ <strong>Reversed</strong> — FIFO consumption has been undone and stock
        balances have been restored.
      </div>
    ),
  };

  return (
    <div className="page">

      {/* Workflow progress bar */}
      <SivWorkflowBar status={status}/>

      {/* Page header */}
      <div className="page-header" style={{marginTop:16}}>
        <div>
          <div className="page-kicker">Inventory · SIV</div>
          <div className="page-title" style={{fontFamily:"var(--mono)",fontSize:20}}>
            {doc.number || doc.id}
          </div>
          <div className="page-sub">
            {fmtDate(doc.issueDate)}
            {doc.fromLocationName && ` · ${doc.fromLocationName}`}
            {doc.toLocationName   && ` → ${doc.toLocationName}`}
            {doc.departmentName   && ` · ${doc.departmentName}`}
          </div>
        </div>

        {/* Command bar */}
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span className={STATUS_BADGE[status]}>{status}</span>

          {p.canEdit && (
            <button className="btn"
              onClick={() => nav(`/companies/${companyId}/siv/drafts/${doc.id}/edit`)}>
              ✎ Edit
            </button>
          )}
          {p.canSubmit && (
            <button className="btn btn-primary" disabled={busy}
              onClick={() => setModal("submit")}>
              ↗ Submit for Approval
            </button>
          )}
          {p.canApprove && (
            <button className="btn btn-success" disabled={busy}
              onClick={() => setModal("approve")}>
              ✓ Approve
            </button>
          )}
          {p.canRequestChanges && (
            <button className="btn" disabled={busy}
              onClick={() => setModal("requestChanges")}>
              ↩ Request Changes
            </button>
          )}
          {p.canReject && (
            <button className="btn btn-danger" disabled={busy}
              onClick={() => setModal("reject")}>
              ✕ Reject
            </button>
          )}
          {p.canIssue && (
            <button className="btn btn-primary" disabled={busy}
              onClick={() => setModal("issue")}>
              ◉ Issue
            </button>
          )}
          {p.canPost && (
            <button className="btn btn-primary" disabled={busy}
              onClick={() => setModal("post")}>
              ▲ Post to Ledger
            </button>
          )}
          {p.canReverse && (
            <button className="btn btn-danger" disabled={busy}
              onClick={() => setModal("reverse")}>
              ↺ Reverse
            </button>
          )}
          {p.canPrint && (
            <button className="btn"
              onClick={() => nav(`/companies/${companyId}/siv/${doc.id}/print`)}>
              ⎙ Print
            </button>
          )}
          <button className="btn" onClick={() => nav(-1)}>← Back</button>
        </div>
      </div>

      {/* Status banners */}
      {statusBanners[status]}

      {/* Alerts */}
      {err     && <div className="alert alert-danger">{err}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Main content: tabs + properties panel */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:16,alignItems:"start"}}>

        {/* Left: card with tabs */}
        <div className="card" style={{padding:0}}>
          {/* Tab bar */}
          <div
            style={{
              display:    "flex",
              borderBottom:"1px solid var(--border-soft)",
              padding:    "0 16px",
              background: "var(--surface-2)",
            }}
          >
            {([
              { id:"lines", label:`Line Items (${doc.lines.length})` },
              { id:"audit", label:"Audit Trail" },
              { id:"fifo",  label:"FIFO Preview" },
            ] as const).map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  padding:      "9px 14px",
                  fontSize:     12,
                  fontWeight:   500,
                  cursor:       "pointer",
                  background:   "none",
                  border:       "none",
                  borderBottom: `2px solid ${tab===t.id?"var(--accent)":"transparent"}`,
                  color:        tab===t.id?"var(--accent)":"var(--text-muted)",
                  marginBottom: -1,
                  transition:   "color 0.1s",
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Lines tab */}
          {tab==="lines" && (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{width:42}}>#</th>
                    <th>Item</th>
                    <th>UOM</th>
                    <th style={{textAlign:"right"}}>Requested</th>
                    <th style={{textAlign:"right"}}>Approved</th>
                    <th style={{textAlign:"right"}}>Issued</th>
                    <th style={{textAlign:"right"}}>Unit Cost</th>
                    <th style={{textAlign:"right"}}>Line Cost</th>
                    <th>Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.lines.length === 0 ? (
                    <tr><td colSpan={9} style={{padding:40,textAlign:"center",color:"var(--text-soft)",fontSize:13}}>
                      No lines on this voucher.
                    </td></tr>
                  ) : doc.lines.map((line, i) => {
                    const partial = line.approvedQty !== null && line.approvedQty < line.qty;
                    const expired = line.expiryDate && new Date(line.expiryDate) < new Date();
                    return (
                      <tr key={line.id || i}>
                        <td style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--text-muted)"}}>{String(line.lineNo).padStart(2,"0")}</td>
                        <td>
                          <div style={{fontWeight:500,fontSize:13}}>{line.itemName||"—"}</div>
                          <div style={{fontSize:10,color:"var(--text-muted)",fontFamily:"var(--mono)",marginTop:1}}>{line.itemCode}</div>
                          {line.remarks && <div style={{fontSize:10,color:"var(--text-muted)",marginTop:1,fontStyle:"italic"}}>{line.remarks}</div>}
                        </td>
                        <td style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--text-muted)"}}>{line.uomCode||line.uomName||"—"}</td>
                        <td style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:13,fontWeight:500}}>{fmtQty(line.qty)}</td>
                        <td style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:13}}>
                          {line.approvedQty !== null
                            ? <span style={{color:partial?"var(--warn)":"inherit",fontWeight:partial?600:400}}>
                                {partial && "▼ "}{fmtQty(line.approvedQty)}
                              </span>
                            : <span style={{color:"var(--text-soft)"}}>—</span>}
                        </td>
                        <td style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:13}}>
                          {line.issuedQty
                            ? <span style={{color:"var(--accent)",fontWeight:500}}>{fmtQty(line.issuedQty)}</span>
                            : <span style={{color:"var(--text-soft)"}}>—</span>}
                        </td>
                        <td style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:12,color:"var(--text-muted)"}}>—</td>
                        <td style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:12,color:"var(--text-muted)"}}>—</td>
                        <td style={{fontSize:12,color:expired?"var(--danger)":"var(--text-muted)"}}>
                          {line.batchNo || "—"}
                          {line.expiryDate && (
                            <div style={{fontSize:10,marginTop:1}}>
                              Exp: {fmtDate(line.expiryDate)}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:"var(--surface-2)",fontWeight:600}}>
                    <td colSpan={3} style={{padding:"8px 14px",fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--text-muted)"}}>Totals</td>
                    <td style={{textAlign:"right",fontFamily:"var(--mono)",padding:"8px 14px"}}>{fmtQty(totalReq)}</td>
                    <td style={{textAlign:"right",fontFamily:"var(--mono)",padding:"8px 14px",color:totalApp<totalReq?"var(--warn)":"inherit"}}>
                      {doc.lines.some((l)=>l.approvedQty!==null)?fmtQty(totalApp):"—"}
                    </td>
                    <td style={{textAlign:"right",fontFamily:"var(--mono)",padding:"8px 14px",color:"var(--accent)"}}>
                      {doc.lines.some((l)=>l.issuedQty>0)?fmtQty(totalIss):"—"}
                    </td>
                    <td colSpan={3}/>
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          {/* Audit trail tab */}
          {tab==="audit" && (
            <div style={{padding:20}}>
              {([
                {l:"Created",   at:doc.createdAt,          by:null },
                {l:"Submitted", at:doc.audit.submittedAtUtc,by:null },
                {l:"Approved",  at:doc.audit.approvedAtUtc, by:null },
                {l:"Issued",    at:doc.audit.issuedAtUtc,   by:null },
                {l:"Posted",    at:doc.audit.postedAtUtc,   by:null },
                {l:"Reversed",  at:doc.audit.reversedAtUtc, by:null },
              ] as { l:string; at:string|null; by:string|null }[]).filter((x)=>x.at).map((ev,i)=>(
                <div key={ev.l} style={{display:"flex",gap:14,marginBottom:18,alignItems:"flex-start"}}>
                  <div style={{
                    width:20,height:20,borderRadius:"50%",
                    background:"var(--surface-2)",border:"2px solid var(--border)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:9,fontWeight:700,color:"var(--accent)",flexShrink:0,marginTop:2,
                  }}>
                    {i+1}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:2}}>{ev.l}</div>
                    <div style={{fontSize:11,color:"var(--text-muted)",fontFamily:"var(--mono)"}}>{fmtDateTime(ev.at)}</div>
                  </div>
                </div>
              ))}
              {!doc.audit.submittedAtUtc && (
                <div style={{fontSize:12,color:"var(--text-soft)"}}>Only draft creation recorded.</div>
              )}
            </div>
          )}

          {/* FIFO preview tab */}
          {tab==="fifo" && (
            <div style={{padding:20}}>
              <FifoPreviewPanel
                companyId={companyId}
                sivId={sivId}
                lines={doc.lines}
              />
            </div>
          )}
        </div>

        {/* Right: document properties panel */}
        <div>
          {/* Document details card */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-header">
              <div className="card-title">Document Details</div>
            </div>
            <div className="card-body">
              {[
                {label:"Document No.",   value:doc.number||doc.id,     mono:true},
                {label:"Status",         value:status},
                {label:"Issue Date",     value:fmtDate(doc.issueDate)},
                {label:"From Location",  value:doc.fromLocationName||"—"},
                {label:"To Location",    value:doc.toLocationName||"—"},
                {label:"Department",     value:doc.departmentName||"—"},
                {label:"Remarks",        value:doc.remarks||doc.notes||"—"},
              ].map(({label,value,mono})=>(
                <div key={label} style={{marginBottom:10}}>
                  <div style={{
                    fontSize:10,fontWeight:600,textTransform:"uppercase",
                    letterSpacing:"0.08em",color:"var(--text-muted)",
                    fontFamily:"var(--mono)",marginBottom:3,
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize:13,color:"var(--text)",
                    fontFamily:mono?"var(--mono)":undefined,
                    wordBreak:"break-all",
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quantity summary card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Quantity Summary</div>
            </div>
            <div className="card-body">
              {[
                {label:"Lines",     value:String(doc.lines.length)},
                {label:"Requested", value:fmtQty(totalReq)},
                ...(doc.lines.some(l=>l.approvedQty!==null)
                  ? [{label:"Approved", value:fmtQty(totalApp)}] : []),
                ...(doc.lines.some(l=>l.issuedQty>0)
                  ? [{label:"Issued", value:fmtQty(totalIss)}] : []),
              ].map(({label,value})=>(
                <div key={label} style={{
                  display:"flex",justifyContent:"space-between",
                  fontSize:12,marginBottom:8,
                }}>
                  <span style={{color:"var(--text-muted)"}}>{label}</span>
                  <span style={{fontFamily:"var(--mono)",fontWeight:500}}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}

      {modal==="submit" && (
        <RemarksModal
          title="Submit for Approval"
          subtitle="The F&B Controller will be notified to review this SIV."
          fieldLabel="Submission notes"
          confirmLabel="Submit"
          confirmClass="btn-primary"
          required={false}
          busy={busy}
          onConfirm={(remarks) => run("Submit", () =>
            sivApi.submit(companyId, sivId, { rowVersion:doc.rowVersion, remarks })
              .then(()=>undefined)
          )}
          onCancel={() => setModal("none")}
        />
      )}

      {modal==="approve" && (
        <ApproveModal
          lines={doc.lines}
          rowVersion={doc.rowVersion}
          busy={busy}
          onConfirm={(lines, remarks) => run("Approve", () =>
            sivApi.approve(companyId, sivId, { rowVersion:doc.rowVersion, remarks, lines })
              .then(()=>undefined)
          )}
          onCancel={() => setModal("none")}
        />
      )}

      {modal==="reject" && (
        <RemarksModal
          title="Reject SIV"
          subtitle="Provide a reason — this will be visible to the submitter."
          fieldLabel="Rejection reason"
          confirmLabel="Confirm Reject"
          confirmClass="btn-danger"
          required={true}
          busy={busy}
          onConfirm={(remarks) => run("Reject", () =>
            sivApi.reject(companyId, sivId, { rowVersion:doc.rowVersion, remarks })
              .then(()=>undefined)
          )}
          onCancel={() => setModal("none")}
        />
      )}

      {modal==="requestChanges" && (
        <RemarksModal
          title="Request Changes"
          subtitle="The SIV is returned to the requester for amendment and resubmission."
          fieldLabel="Feedback for requester"
          confirmLabel="Send Back"
          confirmClass="btn-primary"
          required={true}
          busy={busy}
          onConfirm={(remarks) => run("Request Changes", () =>
            sivApi.requestChanges(companyId, sivId, { rowVersion:doc.rowVersion, remarks })
              .then(()=>undefined)
          )}
          onCancel={() => setModal("none")}
        />
      )}

      {modal==="issue" && (
        <IssueModal
          lines={doc.lines}
          rowVersion={doc.rowVersion}
          busy={busy}
          onConfirm={(lines, remarks) => run("Issue", () =>
            sivApi.issue(companyId, sivId, { rowVersion:doc.rowVersion, remarks, lines })
              .then(()=>undefined)
          )}
          onCancel={() => setModal("none")}
        />
      )}

      {modal==="post" && (
        <PostModal
          doc={doc}
          busy={busy}
          onConfirm={() => run("Post", () =>
            sivApi.post(companyId, sivId)
              .then((r) => { if (r?.data?.message != null) throw new Error(r.data.message); })
          )}
          onCancel={() => setModal("none")}
        />
      )}

      {modal==="reverse" && (
        <RemarksModal
          title="Reverse SIV"
          subtitle="Reverses FIFO consumption and restores stock balances. Only valid if no downstream transactions exist on these lots."
          fieldLabel="Reversal reason"
          confirmLabel="Confirm Reversal"
          confirmClass="btn-danger"
          required={true}
          busy={busy}
          onConfirm={(reason) => run("Reverse", () =>
            sivApi.reverse(companyId, sivId, { rowVersion:doc.rowVersion, reason })
              .then(()=>undefined)
          )}
          onCancel={() => setModal("none")}
        />
      )}
    </div>
  );
}
