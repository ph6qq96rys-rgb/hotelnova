// src/features/inventory/siv/pages/SivApprovalPage.tsx
//
// F&B Controller approval workspace.
// Shows the submitted SIV with per-line ApprovedQty inputs,
// then wires Approve / Request Changes / Reject to the real API.
// Redirects away if the SIV is not in Submitted status.

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams }            from "react-router-dom";
import { useAppScope }                       from "../../../../app/useAppScope";
import { sivApi }                            from "../api/sivApi";
import type { ApproveSivLineRequest }        from "../api/sivApi";
import SivWorkflowBar                        from "../components/SivWorkflowBar";
import {
  normalizeStatus, STATUS_BADGE,
  mapToVm, fmtDate, fmtQty, getApiError,
  type SivVm, type SivLineVm,
}                                            from "../types/sivTypes";
import "./siv-draft.css";

export default function SivApprovalPage() {
  const nav = useNavigate();
  const { companyId: routeCompanyId, sivId = "" } = useParams<{
    companyId?: string; sivId?: string;
  }>();
  const { companyId: scopeCompanyId } = useAppScope();
  const companyId = routeCompanyId || scopeCompanyId || "";

  const [doc,         setDoc]         = useState<SivVm | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [busy,        setBusy]        = useState(false);
  const [err,         setErr]         = useState<string | null>(null);
  const [success,     setSuccess]     = useState<string | null>(null);

  // Per-line approved quantity overrides
  const [approvedQtys, setApprovedQtys] = useState<Record<string, string>>({});
  const [lineErrors,   setLineErrors]   = useState<Record<string, string>>({});

  // Remarks modal state
  const [rejectNote,  setRejectNote]  = useState("");
  const [changeNote,  setChangeNote]  = useState("");
  const [showReject,  setShowReject]  = useState(false);
  const [showChange,  setShowChange]  = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!companyId || !sivId) return;
    setLoading(true); setErr(null);
    try {
      const raw = await sivApi.getById(companyId, sivId);
      const vm  = mapToVm(raw.data);
      const s   = normalizeStatus(vm.docStatus);
      if (s !== "Submitted") {
        nav(`/companies/${companyId}/siv/${sivId}`, { replace: true });
        return;
      }
      setDoc(vm);
    } catch (e) {
      setErr(getApiError(e, "Failed to load SIV."));
    } finally {
      setLoading(false);
    }
  }, [companyId, sivId, nav]);

  useEffect(() => { void load(); }, [load]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function doAction(label: string, fn: () => Promise<void>) {
    setBusy(true); setErr(null); setSuccess(null);
    try {
      await fn();
      setSuccess(`${label} successful.`);
      await load();
    } catch (e) {
      setErr(getApiError(e, `${label} failed.`));
    } finally {
      setBusy(false);
    }
  }

  function validateLineQtys(): boolean {
    const e: Record<string, string> = {};
    (doc?.lines ?? []).forEach((l) => {
      const raw = approvedQtys[l.id];
      const v   = raw !== undefined ? parseFloat(raw) : l.qty;
      if (isNaN(v) || v < 0) e[l.id] = "Cannot be negative";
      else if (v > l.qty)    e[l.id] = `Max: ${fmtQty(l.qty)}`;
    });
    setLineErrors(e);
    return Object.keys(e).length === 0;
  }

  const onApprove = () => {
    if (!validateLineQtys()) return;
    const lines: ApproveSivLineRequest[] = (doc?.lines ?? []).map((l) => ({
      lineId:      l.id,
      approvedQty: approvedQtys[l.id] !== undefined
        ? parseFloat(approvedQtys[l.id])
        : l.qty,
    }));
    doAction("Approve", () =>
      sivApi
        .approve(companyId, sivId, { rowVersion: doc?.rowVersion ?? null, lines })
        .then(() => undefined)
    );
  };

  const onReject = () => {
    if (!rejectNote.trim()) { setErr("Rejection reason is required."); return; }
    doAction("Reject", () =>
      sivApi
        .reject(companyId, sivId, { rowVersion: doc?.rowVersion ?? null, remarks: rejectNote.trim() })
        .then(() => undefined)
    ).then(() => { setShowReject(false); setRejectNote(""); });
  };

  const onRequestChange = () => {
    if (!changeNote.trim()) { setErr("Feedback is required."); return; }
    doAction("Request Changes", () =>
      sivApi
        .requestChanges(companyId, sivId, { rowVersion: doc?.rowVersion ?? null, remarks: changeNote.trim() })
        .then(() => undefined)
    ).then(() => { setShowChange(false); setChangeNote(""); });
  };

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
      </div>
    );
  }

  const status        = normalizeStatus(doc.docStatus);
  const totalReq      = doc.lines.reduce((s, l) => s + l.qty, 0);
  const totalApproved = doc.lines.reduce((s, l) => {
    const v = approvedQtys[l.id] !== undefined ? parseFloat(approvedQtys[l.id]) : l.qty;
    return s + (isNaN(v) ? l.qty : v);
  }, 0);
  const partialCount = doc.lines.filter((l) => {
    const v = approvedQtys[l.id] !== undefined ? parseFloat(approvedQtys[l.id]) : l.qty;
    return !isNaN(v) && v < l.qty;
  }).length;

  return (
    <div className="page">

      {/* Workflow bar */}
      <SivWorkflowBar status={status}/>

      {/* Header */}
      <div className="page-header" style={{marginTop:16}}>
        <div>
          <div className="page-kicker">Inventory · SIV · F&B Controller Approval</div>
          <div className="page-title" style={{fontFamily:"var(--mono)",fontSize:20}}>
            {doc.number || doc.id}
          </div>
          <div className="page-sub">
            Review the submitted voucher and take an approval action.
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span className={STATUS_BADGE[status]}>{status}</span>
          <button className="btn btn-success" disabled={busy} onClick={onApprove}>
            ✓ Approve
          </button>
          <button className="btn" disabled={busy} onClick={() => setShowChange(true)}>
            ↩ Request Changes
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={() => setShowReject(true)}>
            ✕ Reject
          </button>
          <button className="btn" onClick={() => nav(-1)}>← Back</button>
        </div>
      </div>

      {/* Alerts */}
      {err     && <div className="alert alert-danger">{err}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {partialCount > 0 && (
        <div className="alert alert-warn" style={{marginBottom:14}}>
          ⚠ {partialCount} line{partialCount > 1 ? "s" : ""} will be partially approved.
          Total approved: {fmtQty(totalApproved)} of {fmtQty(totalReq)} requested.
        </div>
      )}

      {/* Document summary */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-header">
          <div className="card-title">Document Summary</div>
        </div>
        <div className="card-body" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
          {[
            {label:"Issue Date",    value:fmtDate(doc.issueDate)},
            {label:"From Location", value:doc.fromLocationName||"—"},
            {label:"To Location",   value:doc.toLocationName||"—"},
            {label:"Department",    value:doc.departmentName||"—"},
            {label:"Remarks",       value:doc.remarks||"—"},
          ].map(({label,value})=>(
            <div key={label}>
              <div style={{
                fontSize:10,fontWeight:600,textTransform:"uppercase",
                letterSpacing:"0.08em",color:"var(--text-muted)",
                fontFamily:"var(--mono)",marginBottom:4,
              }}>
                {label}
              </div>
              <div style={{fontSize:13,color:"var(--text)"}}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lines — with editable ApprovedQty */}
      <div className="card" style={{padding:0}}>
        <div className="card-header">
          <div>
            <div className="card-title">Line Items — Set Approved Quantities</div>
            <div className="card-subtitle">
              Leave a field unchanged to approve at the full requested amount.
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span className="badge badge-neutral">{doc.lines.length} lines</span>
            <span className="badge badge-neutral">
              Requested: {fmtQty(totalReq)}
            </span>
            {partialCount > 0 && (
              <span className="badge badge-warn">
                Approved: {fmtQty(totalApproved)}
              </span>
            )}
          </div>
        </div>

        {doc.lines.length === 0 ? (
          <div style={{padding:40,textAlign:"center",color:"var(--text-soft)",fontSize:13}}>
            No lines on this voucher.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{width:42}}>#</th>
                <th>Item</th>
                <th>UOM</th>
                <th style={{textAlign:"right"}}>Requested</th>
                <th style={{textAlign:"right",width:150}}>Approved Qty ▼</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((line, i) => {
                const curVal    = approvedQtys[line.id] !== undefined
                  ? approvedQtys[line.id]
                  : String(line.qty);
                const curNum    = parseFloat(curVal);
                const partial   = !isNaN(curNum) && curNum < line.qty;
                const expired   = line.expiryDate && new Date(line.expiryDate) < new Date();
                return (
                  <tr
                    key={line.id || i}
                    style={{background:partial?"var(--warn-bg-light)":"transparent"}}
                  >
                    <td style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--text-muted)"}}>
                      {String(line.lineNo || i+1).padStart(2,"0")}
                    </td>
                    <td>
                      <div style={{fontWeight:500,fontSize:13}}>
                        {line.itemName || "—"}
                      </div>
                      <div style={{fontSize:10,color:"var(--text-muted)",fontFamily:"var(--mono)",marginTop:1}}>
                        {line.itemCode}
                      </div>
                    </td>
                    <td style={{fontSize:12,fontFamily:"var(--mono)"}}>{line.uomCode||"—"}</td>
                    <td
                      style={{
                        textAlign:"right",fontFamily:"var(--mono)",
                        fontSize:13,fontWeight:500,
                      }}
                    >
                      {fmtQty(line.qty)}
                    </td>
                    <td style={{padding:"8px 14px",width:150}}>
                      <input
                        type="number"
                        min={0}
                        max={line.qty}
                        step="0.001"
                        className="input"
                        value={curVal}
                        onChange={(e) => {
                          setApprovedQtys((p) => ({ ...p, [line.id]: e.target.value }));
                          setLineErrors((p) => { const n={...p}; delete n[line.id]; return n; });
                        }}
                        style={{
                          height:     32,
                          fontSize:   12,
                          fontFamily: "var(--mono)",
                          borderColor:lineErrors[line.id]
                            ? "var(--danger)"
                            : partial
                            ? "var(--warn)"
                            : undefined,
                          textAlign:  "right",
                        }}
                      />
                      {lineErrors[line.id] && (
                        <div style={{fontSize:10,color:"var(--danger)",marginTop:2}}>
                          {lineErrors[line.id]}
                        </div>
                      )}
                    </td>
                    <td style={{fontSize:12}}>{line.batchNo || "—"}</td>
                    <td
                      style={{
                        fontSize:12,
                        color:expired ? "var(--danger)" : "var(--text)",
                      }}
                    >
                      {line.expiryDate ? fmtDate(line.expiryDate) : "—"}
                    </td>
                    <td style={{fontSize:12,color:"var(--text-muted)"}}>
                      {line.remarks || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:"var(--surface-2)",fontWeight:600}}>
                <td colSpan={3} style={{padding:"8px 14px",fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--text-muted)"}}>
                  Totals
                </td>
                <td style={{textAlign:"right",fontFamily:"var(--mono)",padding:"8px 14px"}}>
                  {fmtQty(totalReq)}
                </td>
                <td
                  style={{
                    textAlign:  "right",
                    fontFamily: "var(--mono)",
                    padding:    "8px 14px",
                    color:      partialCount > 0 ? "var(--warn)" : "inherit",
                  }}
                >
                  {fmtQty(totalApproved)}
                </td>
                <td colSpan={3}/>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ── Reject modal ── */}
      {showReject && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}>
          <div style={{background:"var(--surface)",borderRadius:"var(--r-lg)",padding:24,width:440,border:"1px solid var(--border)",boxShadow:"var(--shadow-lg)"}}>
            <div style={{fontWeight:600,fontSize:15,marginBottom:6}}>Reject SIV</div>
            <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:14}}>
              Provide a reason — this will be visible to the submitter.
            </div>
            <div className="field" style={{marginBottom:16}}>
              <label className="field-label">Rejection reason <span style={{color:"var(--danger)"}}>*</span></label>
              <textarea
                className="input"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Required"
                style={{minHeight:80}}
                autoFocus
              />
            </div>
            {err && <div className="alert alert-danger" style={{marginBottom:12}}>{err}</div>}
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="btn" onClick={() => { setShowReject(false); setRejectNote(""); setErr(null); }}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={onReject} disabled={busy || !rejectNote.trim()}>
                {busy ? "Rejecting…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Request changes modal ── */}
      {showChange && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}>
          <div style={{background:"var(--surface)",borderRadius:"var(--r-lg)",padding:24,width:440,border:"1px solid var(--border)",boxShadow:"var(--shadow-lg)"}}>
            <div style={{fontWeight:600,fontSize:15,marginBottom:6}}>Request Changes</div>
            <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:14}}>
              The SIV will be returned to the requester for amendment.
            </div>
            <div className="field" style={{marginBottom:16}}>
              <label className="field-label">Feedback for requester <span style={{color:"var(--danger)"}}>*</span></label>
              <textarea
                className="input"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Describe what needs to change"
                style={{minHeight:80}}
                autoFocus
              />
            </div>
            {err && <div className="alert alert-danger" style={{marginBottom:12}}>{err}</div>}
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="btn" onClick={() => { setShowChange(false); setChangeNote(""); setErr(null); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onRequestChange} disabled={busy || !changeNote.trim()}>
                {busy ? "Sending…" : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
