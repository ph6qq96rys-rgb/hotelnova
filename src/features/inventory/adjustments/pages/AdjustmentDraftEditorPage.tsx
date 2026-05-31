// src/features/inventory/adjustments/pages/AdjustmentDraftEditorPage.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { adjustmentApi, getApiError } from "../api/adjustmentApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import {
  inventoryControlSettingsApi,
  type InventoryControlSettingsDto,
} from "../../settings/api/inventoryControlSettingsApi";
import {
  canApprove, canPost, canReject, canReverse, canSubmit,
  normalizeAdjustmentStatus, STATUS_BADGE,
} from "../utils/adjustmentWorkflow";

import type {
  InventoryAdjustmentDto,
  AdjustmentCandidateDto,
  StockLocationOption,
} from "../types";

import "./adjustment-draft-editor.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const fmt3 = (v: unknown) => toNum(v).toFixed(3);
const fmt2 = (v: unknown) => toNum(v).toFixed(2);

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

// ── Line view-model ───────────────────────────────────────────────────────────

type LineVm = {
  vmId:              string;
  fifoLotId:         string;
  itemId:            string;
  itemName:          string;
  itemCode?:         string;
  uomId:             string;
  uomName:           string;
  systemQty:         number;
  countedQty:        number;
  adjustmentQty:     number;
  baseUomId:         string;
  baseUomName:       string;
  conversionFactor:  number;
  isBaseUnit:        boolean;
  systemQtyBase:     number;
  countedQtyBase:    number;
  adjustmentQtyBase: number;
  unitCost:          number;
  unitCostDisplay:   number;
  lineAmount:        number;
  batchNo?:          string;
  expiryDate?:       string;
  notes:             string;
};

function candidateToLine(c: AdjustmentCandidateDto): LineVm {
  // Backend returns toBaseFactor (types.ts) or conversionFactor (new service).
  // Read both; whichever is present wins.
  const factor = toNum((c as any).conversionFactor ?? c.toBaseFactor, 1) || 1;
  return {
    vmId:              `lot-${c.fifoLotId}`,
    fifoLotId:         c.fifoLotId,
    itemId:            c.itemId,
    itemName:          c.itemName,
    itemCode:          c.itemCode,
    uomId:             c.uomId,
    uomName:           c.uomName,
    systemQty:         c.systemQty,
    countedQty:        c.systemQty,
    adjustmentQty:     0,
    baseUomId:         c.baseUomId,
    baseUomName:       c.baseUomName,
    conversionFactor:  factor,
    isBaseUnit:        c.uomId === c.baseUomId,
    systemQtyBase:     c.systemQtyBase,
    countedQtyBase:    c.systemQtyBase,
    adjustmentQtyBase: 0,
    unitCost:          c.unitCost,
    unitCostDisplay:   c.unitCostDisplay,
    lineAmount:        0,
    batchNo:           c.batchNo,
    expiryDate:        c.expiryDate?.toString(),
    notes:             "",
  };
}

function dtoLineToVm(l: InventoryAdjustmentDto["lines"][0]): LineVm {
  return {
    vmId:              `dto-${l.fifoLotId}-${l.itemId}`,
    fifoLotId:         l.fifoLotId,
    itemId:            l.itemId,
    itemName:          l.itemName ?? l.itemId,
    itemCode:          undefined,
    uomId:             l.uomId,
    uomName:           l.uomName ?? l.uomId,
    systemQty:         l.systemQty,
    countedQty:        l.countedQty,
    adjustmentQty:     l.adjustmentQty,
    baseUomId:         l.baseUomId,
    baseUomName:       l.baseUomName ?? "",
    conversionFactor:  l.conversionFactor,
    isBaseUnit:        l.isBaseUnit,
    systemQtyBase:     l.systemQtyBase,
    countedQtyBase:    l.countedQtyBase,
    adjustmentQtyBase: l.adjustmentQtyBase,
    unitCost:          l.unitCost,
    unitCostDisplay:   l.unitCostDisplay,
    lineAmount:        l.lineAmount,
    batchNo:           l.batchNo,
    expiryDate:        l.expiryDate?.toString(),
    notes:             l.notes ?? "",
  };
}

function updateCounted(line: LineVm, rawValue: string): LineVm {
  const countedQty      = Math.max(0, toNum(rawValue));
  const adjustmentQty   = countedQty - line.systemQty;
  const f               = line.conversionFactor || 1;
  const countedQtyBase  = countedQty    * f;
  const adjQtyBase      = adjustmentQty * f;
  const lineAmount      = adjQtyBase * line.unitCost;
  return { ...line, countedQty, adjustmentQty, countedQtyBase,
    adjustmentQtyBase: adjQtyBase, lineAmount };
}

type VarianceLevel = "warning" | "high" | "critical" | null;

function variancePct(line: LineVm): number {
  if (line.systemQty === 0) return line.countedQty === 0 ? 0 : 100;
  return Math.abs((line.adjustmentQty / line.systemQty) * 100);
}

function getVarianceLevel(
  line: LineVm,
  settings: InventoryControlSettingsDto | null
): VarianceLevel {
  if (!settings || line.adjustmentQty === 0) return null;
  const pct = variancePct(line);
  if (pct >= settings.criticalVariancePercent) return "critical";
  if (pct >= settings.highVariancePercent)     return "high";
  if (pct >= settings.warningVariancePercent)  return "warning";
  return null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ADJ_TYPES = [
  { value: "StockCount", label: "Stock count" },
  { value: "Waste",      label: "Waste"        },
  { value: "Damage",     label: "Damage"       },
  { value: "Variance",   label: "Variance"     },
];

// ── Modal ─────────────────────────────────────────────────────────────────────
// Uses inline normal-flow layout — no position:fixed (collapses iframes).

function InlineModal({
  title, body, placeholder, requireText, confirmLabel, danger, working,
  onConfirm, onCancel,
}: {
  title: string; body: string; placeholder: string; requireText: boolean;
  confirmLabel: string; danger?: boolean; working: boolean;
  onConfirm: (text: string) => void; onCancel: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <div style={{ background: "rgba(0,0,0,.3)", padding: "40px 20px",
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", padding: 24, width: "100%", maxWidth: 420 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{body}</div>
        <textarea
          style={{ width: "100%", minHeight: 80, fontSize: 13, padding: "8px 10px",
            borderRadius: "var(--r)", border: "1px solid var(--border)",
            background: "var(--surface-2)", color: "var(--text)", resize: "vertical",
            marginBottom: 16, fontFamily: "inherit", boxSizing: "border-box" }}
          value={text}
          onChange={(e) => setText(e.target.value)}
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

export default function AdjustmentDraftEditorPage() {
  const navigate = useNavigate();
  const { adjustmentId } = useParams<{ adjustmentId?: string }>();
  const { companyId, branchId } = useAppScope();
  const isEdit = Boolean(adjustmentId);

  const [draft,        setDraft]        = useState<InventoryAdjustmentDto | null>(null);
  const [lines,        setLines]        = useState<LineVm[]>([]);
  const [locations,    setLocations]    = useState<StockLocationOption[]>([]);
  const [candidates,   setCandidates]   = useState<AdjustmentCandidateDto[]>([]);
  const [locationId,   setLocationId]   = useState("");
  const [adjType,      setAdjType]      = useState("StockCount");
  const [referenceNo,  setReferenceNo]  = useState("");
  const [reason,       setReason]       = useState("");
  const [remarks,      setRemarks]      = useState("");
  const [search,       setSearch]       = useState("");

  const [pageLoading,     setPageLoading]     = useState(false);
  const [candLoading,     setCandLoading]     = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [err,             setErr]             = useState<string | null>(null);
  const [success,         setSuccess]         = useState<string | null>(null);
  const [settings,        setSettings]        = useState<InventoryControlSettingsDto | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [modal,           setModal]           = useState<"reject" | "reverse" | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────

  const status    = normalizeAdjustmentStatus(draft?.docStatus);
  const isLocked  = status !== "Draft";

  const usedLotIds    = useMemo(() => new Set(lines.map((l) => l.fifoLotId)), [lines]);
  const totalSystem   = useMemo(() => lines.reduce((s, l) => s + l.systemQty,    0), [lines]);
  const totalCounted  = useMemo(() => lines.reduce((s, l) => s + l.countedQty,   0), [lines]);
  const totalVariance = useMemo(() => lines.reduce((s, l) => s + l.adjustmentQty,0), [lines]);
  const totalAmount   = useMemo(() => lines.reduce((s, l) => s + l.lineAmount,   0), [lines]);
  const hasVariance   = useMemo(() => lines.some((l) => l.adjustmentQty !== 0),       [lines]);
  const hasCritical   = useMemo(
    () => lines.some((l) => getVarianceLevel(l, settings) === "critical"),
    [lines, settings]
  );

  // ── Bootstrap ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!companyId || !branchId) return;
    if (isEdit && adjustmentId) loadExisting(adjustmentId);
    else loadLocations();
  }, [companyId, branchId, adjustmentId]);

  useEffect(() => {
    if (!companyId || !branchId || !locationId) { setSettings(null); return; }
    let cancelled = false;
    setSettingsLoading(true);
    inventoryControlSettingsApi
      .getEffective(companyId, { branchId, locationId })
      .then((dto) => { if (!cancelled) setSettings(dto); })
      .catch((e)  => { if (!cancelled) { setSettings(null);
        setErr(getApiError(e, "Failed to load inventory control settings.")); } })
      .finally(() => { if (!cancelled) setSettingsLoading(false); });
    return () => { cancelled = true; };
  }, [companyId, branchId, locationId]);

  async function loadExisting(id: string) {
    if (!companyId || !branchId) return;
    setPageLoading(true);
    setErr(null);
    try {
      const d = await adjustmentApi.get(companyId, branchId, id);
      setDraft(d);
      setLocationId(d.locationId ?? "");
      setAdjType(d.adjustmentType ?? "StockCount");
      setReferenceNo(d.referenceNo ?? "");
      setReason(d.reason ?? "");
      setRemarks(d.remarks ?? "");
      setLines((d.lines ?? []).map(dtoLineToVm));
    } catch (e) {
      setErr(getApiError(e, "Failed to load adjustment."));
    } finally {
      setPageLoading(false);
    }
  }

  async function loadLocations() {
    if (!companyId || !branchId) return;
    try {
      const rows = await stockLocationsApi.list(companyId, branchId);
      setLocations(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErr(getApiError(e, "Failed to load stock locations."));
    }
  }

  // ── Candidates ────────────────────────────────────────────────────────────

  async function loadCandidates(locId: string, s: string) {
    if (!companyId || !branchId || !locId) { setCandidates([]); return; }
    setCandLoading(true);
    try {
      const rows = await adjustmentApi.candidates(companyId, branchId, locId,
        { search: s || undefined });
      setCandidates(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErr(getApiError(e, "Failed to load stock candidates."));
    } finally {
      setCandLoading(false);
    }
  }

  function onLocationChange(locId: string) {
    setLocationId(locId);
    setLines([]);
    setCandidates([]);
    setSearch("");
    if (locId) loadCandidates(locId, "");
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadCandidates(locationId, value), 300);
  }

  const addCandidate = (c: AdjustmentCandidateDto) => {
    if (!usedLotIds.has(c.fifoLotId))
      setLines((prev) => [...prev, candidateToLine(c)]);
  };

  const removeLine     = (idx: number) => setLines((p) => p.filter((_, i) => i !== idx));
  const onCountedChange= (idx: number, v: string) =>
    setLines((p) => p.map((l, i) => i === idx ? updateCounted(l, v) : l));
  const onNotesChange  = (idx: number, v: string) =>
    setLines((p) => p.map((l, i) => i === idx ? { ...l, notes: v } : l));

  // ── Validation ────────────────────────────────────────────────────────────

  function validateBeforeSave(): string | null {
    if (settings?.requireReasonOnVariance &&
        lines.some((l) => l.adjustmentQty !== 0 && !l.notes.trim()))
      return "A variance reason is required for every line with a non-zero variance.";
    return null;
  }

  function validateBeforePost(): string | null {
    if (settings?.blockPostingOnCriticalVariance && hasCritical)
      return "Posting blocked: one or more lines exceed the critical variance threshold.";
    return validateBeforeSave();
  }

  // ── Build command lines (matches AdjustmentLineInputDto) ──────────────────

  function buildLines() {
    return lines.map((l) => ({
      fifoLotId:  l.fifoLotId,
      itemId:     l.itemId,
      uomId:      l.uomId,
      systemQty:  l.systemQty,
      countedQty: l.countedQty,
      unitCost:   l.unitCost,
      notes:      l.notes || undefined,
    }));
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function saveDraft() {
    if (!companyId || !branchId) return;
    if (!locationId) { setErr("Select a stock location."); return; }
    if (lines.length === 0) { setErr("Add at least one line."); return; }
    const policyErr = validateBeforeSave();
    if (policyErr) { setErr(policyErr); return; }

    setSaving(true); setErr(null); setSuccess(null);
    try {
      if (isEdit && adjustmentId) {
        await adjustmentApi.updateDraft(companyId, branchId, adjustmentId, {
          locationId, adjustmentType: adjType as any,
          referenceNo: referenceNo || undefined,
          reason: reason || undefined,
          remarks: remarks || undefined,
          lines: buildLines(),
        });
        setSuccess("Saved.");
        await loadExisting(adjustmentId);
      } else {
        const { id } = await adjustmentApi.createDraft(companyId, branchId, {
          locationId, adjustmentType: adjType as any,
          adjustmentDate: new Date().toISOString(),
          referenceNo: referenceNo || undefined,
          reason: reason || undefined,
          remarks: remarks || undefined,
          lines: buildLines(),
        });
        setSuccess("Created.");
        navigate(`/inventory/adjustments/${id}`, { replace: true });
      }
    } catch (e) {
      setErr(getApiError(e, "Failed to save adjustment."));
    } finally {
      setSaving(false);
    }
  }

  async function doAction(label: string, fn: () => Promise<void>) {
    if (!companyId || !branchId || !adjustmentId) return;
    setSaving(true); setErr(null); setSuccess(null);
    try {
      await fn();
      setSuccess(`${label} successful.`);
      await loadExisting(adjustmentId);
      setModal(null);
    } catch (e) {
      setErr(getApiError(e, `${label} failed.`));
    } finally {
      setSaving(false);
    }
  }

  const onSubmit  = () => doAction("Submit",  () =>
    adjustmentApi.submit(companyId!, branchId!, adjustmentId!));

  const onApprove = () => doAction("Approve", () =>
    adjustmentApi.approve(companyId!, branchId!, adjustmentId!));

  const onPost = () => {
    const policyErr = validateBeforePost();
    if (policyErr) { setErr(policyErr); return; }
    doAction("Post", () => adjustmentApi.post(companyId!, branchId!, adjustmentId!));
  };

  // ── Guards ────────────────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div className="page">
        <div style={{ padding: 48, textAlign: "center",
          color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  // ── Modal screens (inline normal-flow, no fixed positioning) ─────────────

  if (modal === "reject") {
    return (
      <div className="adj-page page">
        <InlineModal
          title="Reject adjustment"
          body="Provide a reason — this will be visible to the submitter."
          placeholder="Rejection reason (required)"
          requireText
          confirmLabel="Confirm reject"
          danger
          working={saving}
          onConfirm={(note) =>
            doAction("Reject", () =>
              adjustmentApi.reject(companyId!, branchId!, adjustmentId!, note))}
          onCancel={() => { setModal(null); setErr(null); }}
        />
        {err && <div className="alert alert-danger" style={{ margin: "0 20px" }}>{err}</div>}
      </div>
    );
  }

  if (modal === "reverse") {
    return (
      <div className="adj-page page">
        <InlineModal
          title="Reverse adjustment"
          body="This writes counter-entries to FIFO and the inventory ledger. Cannot be undone."
          placeholder="Reason for reversal (required)"
          requireText
          confirmLabel="Confirm reverse"
          danger
          working={saving}
          onConfirm={(reason) =>
            doAction("Reverse", () =>
              adjustmentApi.reverse(companyId!, branchId!, adjustmentId!, reason))}
          onCancel={() => { setModal(null); setErr(null); }}
        />
        {err && <div className="alert alert-danger" style={{ margin: "0 20px" }}>{err}</div>}
      </div>
    );
  }

  const availableCandidates = candidates.filter((c) => !usedLotIds.has(c.fifoLotId));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="adj-page page">

      <div className="adj-header">
        <div className="adj-header-left">
          <div className="adj-kicker">
            {isEdit ? `Adjustment · ${draft?.adjustmentNo ?? "…"}` : "New adjustment"}
          </div>
          <h1>
            {isEdit ? (draft?.adjustmentType ?? "Adjustment") : "Create adjustment draft"}
          </h1>
          <div className="adj-subtitle">
            {isEdit
              ? `Created ${fmtDate(draft?.createdAt)}${draft?.submittedAt
                  ? ` · Submitted ${fmtDate(draft.submittedAt)}` : ""}${draft?.postedAt
                  ? ` · Posted ${fmtDate(draft.postedAt)}` : ""}`
              : "Select a stock location, then add FIFO lots to count."}
          </div>
        </div>

        <div className="adj-btn-row">
          {draft && <span className={STATUS_BADGE[status]}>{status}</span>}

          {draft?.hasHighVariance && (
            <span className="adj-badge warn">
              <i className="ti ti-alert-triangle" aria-hidden
                style={{ fontSize: 11, marginRight: 4 }} />
              {draft.highestVariancePercent?.toFixed(1)}% variance
            </span>
          )}

          {canSubmit(status) && (
            <button className="btn btn-primary" disabled={saving || lines.length === 0}
              onClick={onSubmit}>
              {saving ? "Submitting…" : "Submit for approval"}
            </button>
          )}
          {canApprove(status) && (
            <button className="btn btn-success" disabled={saving} onClick={onApprove}>
              {saving ? "Approving…" : "Approve"}
            </button>
          )}
          {canReject(status) && (
            <button className="btn btn-danger" disabled={saving}
              onClick={() => setModal("reject")}
              style={{ background: "transparent" }}>
              Reject
            </button>
          )}
          {canPost(status) && (
            <button className="btn btn-primary" disabled={saving} onClick={onPost}>
              {saving ? "Posting…" : "Post to inventory"}
            </button>
          )}
          {canReverse(status) && (
            <button className="btn btn-danger" disabled={saving}
              onClick={() => setModal("reverse")}
              style={{ background: "transparent" }}>
              Reverse
            </button>
          )}

          {!isLocked && (
            <button className="btn btn-primary" disabled={saving || lines.length === 0}
              onClick={saveDraft}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create draft"}
            </button>
          )}

          <button className="btn" onClick={() => navigate("/inventory/adjustments")}>
            ← Back
          </button>
        </div>
      </div>

      {err     && <div className="alert alert-danger">{err}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {draft?.rejectionNote && (
        <div className="alert alert-danger">
          <strong>Rejected:</strong> {draft.rejectionNote}
        </div>
      )}
      {draft?.reverseReason && (
        <div className="alert alert-warn">
          <strong>Reversed:</strong> {draft.reverseReason}
        </div>
      )}

      {/* Header card */}
      <div className="adj-card">
        <div className="adj-form-grid">
          {!isEdit && (
            <div className="adj-field">
              <label>Stock location <span className="req">*</span></label>
              <select value={locationId} onChange={(e) => onLocationChange(e.target.value)}
                disabled={isLocked}>
                <option value="">— select location —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
          {!isEdit && (
            <div className="adj-field">
              <label>Adjustment type <span className="req">*</span></label>
              <select value={adjType} onChange={(e) => setAdjType(e.target.value)}
                disabled={isLocked}>
                {ADJ_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="adj-field">
            <label>Reference no</label>
            <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)}
              disabled={isLocked} placeholder="Optional external ref" />
          </div>
          <div className="adj-field">
            <label>Reason</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              disabled={isLocked} placeholder="Brief reason for adjustment" />
          </div>
          <div className="adj-field adj-remarks" style={{ gridColumn: "1 / -1" }}>
            <label>Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)}
              disabled={isLocked} placeholder="Additional notes" />
          </div>
        </div>
      </div>

      {/* Summary metrics */}
      {lines.length > 0 && (
        <div className="adj-metrics">
          <div className="adj-metric">
            <div className="adj-metric-label">Lines</div>
            <div className="adj-metric-value">{lines.length}</div>
          </div>
          <div className="adj-metric">
            <div className="adj-metric-label">System qty</div>
            <div className="adj-metric-value">{fmt3(totalSystem)}</div>
          </div>
          <div className="adj-metric">
            <div className="adj-metric-label">Counted qty</div>
            <div className="adj-metric-value">{fmt3(totalCounted)}</div>
          </div>
          <div className="adj-metric">
            <div className="adj-metric-label">Net variance</div>
            <div className="adj-metric-value"
              data-sign={totalVariance < 0 ? "neg" : totalVariance > 0 ? "pos" : undefined}>
              {totalVariance >= 0 ? "+" : ""}{fmt3(totalVariance)}
            </div>
          </div>
        </div>
      )}

      {/* Variance policy banner */}
      {locationId && (
        <div className="adj-policy-banner">
          {settingsLoading ? "Loading inventory control policy…"
            : settings ? (
              <>
                <strong>Variance policy</strong> · Warning {fmt2(settings.warningVariancePercent)}%
                · High {fmt2(settings.highVariancePercent)}%
                · Critical {fmt2(settings.criticalVariancePercent)}%
                {settings.requireReasonOnVariance    && " · Reason required"}
                {settings.blockPostingOnCriticalVariance && " · Critical posting blocked"}
              </>
            ) : "No inventory control policy loaded."}
        </div>
      )}

      {/* Candidate picker */}
      {!isLocked && locationId && (
        <div className="adj-card">
          <div className="adj-section-head">
            <div>
              <h2>Add stock lots</h2>
              <p>
                {candLoading
                  ? "Loading available lots…"
                  : `${availableCandidates.length} lot${
                      availableCandidates.length !== 1 ? "s" : ""
                    } available`}
              </p>
            </div>
            <input value={search} onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search item / batch…" style={{ maxWidth: 240 }} />
          </div>

          {availableCandidates.length === 0 && !candLoading ? (
            <div style={{ fontSize: 13, color: "var(--text-soft)", padding: "12px 0" }}>
              {search ? "No lots match your search." : "All available lots have been added."}
            </div>
          ) : (
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
              {availableCandidates.map((c) => (
                <button
                  key={c.fifoLotId}
                  onClick={() => addCandidate(c)}
                  style={{
                    textAlign: "left", padding: "10px 12px",
                    border: "1px solid var(--border)", borderRadius: "var(--r-md)",
                    background: "var(--surface)", cursor: "pointer",
                    transition: "background .12s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--surface)")}
                >
                  <div style={{ fontWeight: 500, fontSize: 13, color: "var(--text)" }}>
                    {c.itemName}
                    {c.itemCode && (
                      <span style={{ fontWeight: 400, color: "var(--text-muted)",
                        marginLeft: 4, fontSize: 11 }}>
                        {c.itemCode}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)",
                    fontFamily: "var(--mono)", marginTop: 3 }}>
                    {c.uomName}
                    {c.uomId !== c.baseUomId && (
                      <span style={{ marginLeft: 6, color: "var(--text-soft)" }}>
                        1 {c.uomName} = {c.toBaseFactor} {c.baseUomName}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)",
                    marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>On hand: <strong>{fmt3(c.systemQty)}</strong></span>
                    {c.batchNo && <span>Batch: {c.batchNo}</span>}
                    {c.expiryDate && (
                      <span style={{
                        color: new Date(c.expiryDate.toString()) < new Date()
                          ? "var(--danger)" : "inherit",
                      }}>
                        Exp: {String(c.expiryDate).slice(0, 10)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lines table */}
      <div className="adj-card" style={{ padding: 0 }}>
        <div className="adj-section-head" style={{ padding: "14px 16px" }}>
          <div>
            <h2>Count lines</h2>
            <p>
              Enter counted quantities. Variance = counted − system.
              {hasVariance && " Notes required on lines with variance."}
            </p>
          </div>
        </div>

        <div className="adj-table-wrap">
          <table className="adj-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Count UOM</th>
                <th>Base UOM</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th className="num">System</th>
                <th className="num">Counted</th>
                <th className="num">Variance</th>
                <th className="num" title="Per base unit">Cost/base</th>
                <th className="num">Amount</th>
                <th>Notes</th>
                {!isLocked && <th />}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={isLocked ? 11 : 12} className="adj-empty">
                    {!locationId
                      ? "Select a stock location to begin."
                      : "Click a lot above to add it to the count."}
                  </td>
                </tr>
              ) : lines.map((line, idx) => {
                const varSign      = line.adjustmentQty < 0 ? "neg"
                                   : line.adjustmentQty > 0 ? "pos" : undefined;
                const varianceLevel = getVarianceLevel(line, settings);
                const pct          = variancePct(line);
                const notesReq     = Boolean(
                  settings?.requireReasonOnVariance &&
                  line.adjustmentQty !== 0 &&
                  !line.notes.trim()
                );

                return (
                  <tr key={line.vmId}
                    className={varianceLevel
                      ? `adj-variance-row adj-variance-row--${varianceLevel}` : undefined}>

                    <td className="adj-td-input">
                      <input value={line.itemCode
                        ? `${line.itemCode} — ${line.itemName}` : line.itemName}
                        readOnly disabled />
                    </td>
                    <td className="adj-td-input">
                      <input value={line.uomName} readOnly disabled />
                    </td>
                    <td className="adj-td-input">
                      <input
                        value={line.isBaseUnit
                          ? line.baseUomName
                          : `${line.baseUomName} (×${line.conversionFactor})`}
                        readOnly disabled
                        title={line.isBaseUnit
                          ? "Counting in base unit"
                          : `1 ${line.uomName} = ${line.conversionFactor} ${line.baseUomName}`}
                      />
                    </td>
                    <td className="adj-td-input">
                      <input value={line.batchNo ?? "—"} readOnly disabled />
                    </td>
                    <td className="adj-td-input">
                      <input
                        value={line.expiryDate?.slice(0, 10) ?? "—"}
                        readOnly disabled
                        style={line.expiryDate && new Date(line.expiryDate) < new Date()
                          ? { color: "var(--danger)" } : undefined}
                      />
                    </td>
                    <td className="num adj-td-input">
                      <input value={fmt3(line.systemQty)} readOnly disabled
                        title={`${fmt3(line.systemQtyBase)} ${line.baseUomName}`} />
                    </td>
                    <td className="num adj-td-input">
                      <input type="number" min="0" step="0.001"
                        value={line.countedQty} disabled={isLocked}
                        onChange={(e) => onCountedChange(idx, e.target.value)}
                        title={`${fmt3(line.countedQtyBase)} ${line.baseUomName}`} />
                    </td>
                    <td className="num adj-td-input">
                      <input value={fmt3(line.adjustmentQty)} readOnly disabled
                        data-sign={varSign}
                        title={`${fmt3(line.adjustmentQtyBase)} ${line.baseUomName}`} />
                      {varianceLevel && (
                        <div className={`adj-variance-badge adj-variance-badge--${varianceLevel}`}>
                          {varianceLevel.toUpperCase()} · {fmt2(pct)}%
                        </div>
                      )}
                    </td>
                    <td className="num adj-td-input">
                      <input value={fmt2(line.unitCost)} readOnly disabled
                        title={`$${fmt2(line.unitCostDisplay)} per ${line.uomName}`} />
                    </td>
                    <td className="num adj-td-input">
                      <input value={fmt2(line.lineAmount)} readOnly disabled
                        data-sign={varSign} />
                    </td>
                    <td className="adj-td-input">
                      <input value={line.notes}
                        placeholder={notesReq ? "Required ⚠" : "Optional"}
                        disabled={isLocked}
                        onChange={(e) => onNotesChange(idx, e.target.value)}
                        data-required={notesReq ? "true" : undefined} />
                    </td>
                    {!isLocked && (
                      <td style={{ textAlign: "center" }}>
                        <button className="adj-remove-btn" onClick={() => removeLine(idx)}
                          aria-label="Remove line">
                          <i className="ti ti-x" aria-hidden />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ fontWeight: 500 }}>Totals</td>
                  <td className="num">{fmt3(totalSystem)}</td>
                  <td className="num">{fmt3(totalCounted)}</td>
                  <td className="num"
                    data-sign={totalVariance < 0 ? "neg"
                      : totalVariance > 0 ? "pos" : undefined}>
                    {totalVariance >= 0 ? "+" : ""}{fmt3(totalVariance)}
                  </td>
                  <td />
                  <td className="num"
                    data-sign={totalAmount < 0 ? "neg"
                      : totalAmount > 0 ? "pos" : undefined}>
                    ${fmt2(totalAmount)}
                  </td>
                  <td />
                  {!isLocked && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}