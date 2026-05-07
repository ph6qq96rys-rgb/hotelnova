import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { adjustmentApi } from "../api/adjustmentApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";

import type {
  InventoryAdjustmentDto,
  UpdateAdjustmentCountDto,
  CreateAdjustmentFromSivDto,
  ManualAdjustmentCreateDto,
  StockLocationOption,
  InventoryItemOption,
} from "../types";

import "./adjustment-draft-editor.css";

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmt3(n: unknown) {
  return toNum(n).toFixed(3);
}

function fmt2(n: unknown) {
  return toNum(n).toFixed(2);
}

function getErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object") {
    const err = e as Record<string, unknown>;
    const resp = err.response as Record<string, unknown> | undefined;
    if (resp?.data) {
      const d = resp.data as Record<string, unknown>;
      if (typeof d.message === "string") return d.message;
      if (typeof d.title === "string") return d.title;
      if (typeof d === "string") return d;
    }
    if (typeof err.message === "string") return err.message;
  }
  return fallback;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type DraftLineVm = {
  lineId: string;
  fifoLotId: string | null;
  stockLocationId: string | null;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  uomId: string;
  uomCode: string | null;
  uomName: string | null;
  systemQty: number;
  countedQty: number;
  adjustmentQty: number;
  unitCost: number;
  lineAmount: number;
  batchNo: string | null;
  expiryDate: string | null;
  notes: string;
};

function emptyLine(locationId: string): DraftLineVm {
  return {
    lineId: `manual-${crypto.randomUUID()}`,
    fifoLotId: null,
    stockLocationId: locationId,
    itemId: "",
    itemCode: null,
    itemName: null,
    uomId: "",
    uomCode: null,
    uomName: null,
    systemQty: 0,
    countedQty: 0,
    adjustmentQty: 0,
    unitCost: 0,
    lineAmount: 0,
    batchNo: null,
    expiryDate: null,
    notes: "",
  };
}

function mapDraftLine(l: Record<string, unknown>, index: number): DraftLineVm {
  const systemQty  = toNum(l.systemQty);
  const countedQty = toNum(l.countedQty);
  const adjustmentQty =
    l.adjustmentQty != null ? toNum(l.adjustmentQty) : countedQty - systemQty;
  const unitCost  = toNum(l.unitCost);
  const lineAmount =
    l.lineAmount != null ? toNum(l.lineAmount) : adjustmentQty * unitCost;

  return {
    lineId:          String(l.id ?? l.lineId ?? `temp-${index}`),
    fifoLotId:       (l.fifoLotId as string) ?? null,
    stockLocationId: (l.stockLocationId as string) ?? (l.locationId as string) ?? null,
    itemId:          String(l.itemId ?? ""),
    itemCode:        (l.itemCode as string) ?? (l.code as string) ?? null,
    itemName:        (l.itemName as string) ?? (l.name as string) ?? null,
    uomId:           String(l.uomId ?? ""),
    uomCode:         (l.uomCode as string) ?? (l.defaultUomCode as string) ?? null,
    uomName:         (l.uomName as string) ?? (l.defaultUomName as string) ?? null,
    systemQty,
    countedQty,
    adjustmentQty,
    unitCost,
    lineAmount,
    batchNo:    (l.batchNo as string) ?? null,
    expiryDate: (l.expiryDate as string) ?? null,
    notes:      String(l.notes ?? l.reason ?? ""),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdjustmentDraftEditorPage() {
  const navigate = useNavigate();
  const { companyId: routeCompanyId, adjustmentId } = useParams<{
    companyId: string;
    adjustmentId?: string;
  }>();
  const [searchParams] = useSearchParams();

  const appScope   = useAppScope();
  const companyId  = routeCompanyId || appScope.companyId;
  const branchId   = appScope.branchId ?? "";

  const sivId = searchParams.get("sivId") || searchParams.get("siv_id") || "";

  const isEditMode   = Boolean(adjustmentId);
  const isSivMode    = !isEditMode && Boolean(sivId);
  const isManualMode = !isEditMode && !sivId;

  // ── Loading states ─────────────────────────────────────────────────────────
  const [pageLoading,    setPageLoading]    = useState(false);
  const [lookupLoading,  setLookupLoading]  = useState(false);
  const [saving,         setSaving]         = useState(false);

  // ── Feedback ───────────────────────────────────────────────────────────────
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Header fields ──────────────────────────────────────────────────────────
  const [draft,          setDraft]          = useState<InventoryAdjustmentDto | null>(null);
  const [adjustmentDate, setAdjustmentDate] = useState(todayIso());
  const [remarks,        setRemarks]        = useState("");

  // ── Lines ──────────────────────────────────────────────────────────────────
  const [lines, setLines] = useState<DraftLineVm[]>([]);

  // ── Lookup data ────────────────────────────────────────────────────────────
  const [locations,       setLocations]       = useState<StockLocationOption[]>([]);
  const [manualLocationId, setManualLocationId] = useState("");
  const [fifoItems,        setFifoItems]        = useState<InventoryItemOption[]>([]);

  // Keep a ref so effects that close over stale state can still read current companyId
  const companyIdRef = useRef(companyId);
  companyIdRef.current = companyId;

  // ── Derived totals ─────────────────────────────────────────────────────────
  const totalSystemQty   = useMemo(() => lines.reduce((s, l) => s + toNum(l.systemQty),   0), [lines]);
  const totalCountedQty  = useMemo(() => lines.reduce((s, l) => s + toNum(l.countedQty),  0), [lines]);
  const totalVarianceQty = useMemo(() => lines.reduce((s, l) => s + toNum(l.adjustmentQty), 0), [lines]);
  const totalAmount      = useMemo(() => lines.reduce((s, l) => s + toNum(l.lineAmount),   0), [lines]);
  const hasVariance      = useMemo(() => lines.some(l => toNum(l.adjustmentQty) !== 0),         [lines]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return;
    if (isEditMode && adjustmentId)  { loadDraft(companyId, adjustmentId); return; }
    if (isSivMode  && sivId)         { createDraftFromSiv(companyId, sivId); return; }
    initManualShell();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, adjustmentId, sivId]);

  useEffect(() => {
    if (!companyId || !branchId || !isManualMode) return;
    loadLocations(companyId, branchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, branchId, isManualMode]);

  // ── API calls ──────────────────────────────────────────────────────────────

  async function loadLocations(cid: string, bid: string) {
    try {
      setLookupLoading(true);
      setError(null);
      const rows = await stockLocationsApi.listForBranch(cid, bid);
      setLocations(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(getErrorMessage(e, "Failed to load stock locations."));
    } finally {
      setLookupLoading(false);
    }
  }

  async function loadFifoItems(locationId: string) {
    if (!companyId || !branchId || !locationId) { setFifoItems([]); return; }
    try {
      setLookupLoading(true);
      setError(null);
      const rows = await adjustmentApi.fifoItems(companyId, { branchId, locationId });
      setFifoItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(getErrorMessage(e, "Failed to load FIFO items for location."));
      setFifoItems([]);
    } finally {
      setLookupLoading(false);
    }
  }

  function initManualShell() {
    setDraft({
      adjustmentNo: "NEW",
      docStatus:    "Draft",
      branchId,
      locationId:   "",
      adjustmentDate: todayIso(),
      remarks:      "",
      lines:        [],
    } as unknown as InventoryAdjustmentDto);
    setAdjustmentDate(todayIso());
    setRemarks("");
    setLines([]);
  }

  async function loadDraft(cid: string, aid: string) {
    try {
      setPageLoading(true);
      setError(null);
      setSuccess(null);
      const data = await adjustmentApi.get(cid, aid);
      setDraft(data);
      setAdjustmentDate(data.adjustmentDate?.slice(0, 10) || todayIso());
      setRemarks(data.remarks || "");
      setLines((data.lines ?? []).map((l, i) => mapDraftLine(l as unknown as Record<string, unknown>, i)));
    } catch (e) {
      setError(getErrorMessage(e, "Failed to load adjustment draft."));
    } finally {
      setPageLoading(false);
    }
  }

  async function createDraftFromSiv(cid: string, sid: string) {
    try {
      setPageLoading(true);
      setError(null);
      setSuccess(null);
      if (!sid || sid === "null" || sid === "undefined") {
        throw new Error("SIV ID is missing or invalid.");
      }
      const payload: CreateAdjustmentFromSivDto = { adjustmentDate, remarks, lines: [] };
      const created = await adjustmentApi.createFromSiv(cid, sid, payload);
      navigate(`/companies/${cid}/inventory-adjustments/drafts/${created.id}`, { replace: true });
    } catch (e) {
      setError(getErrorMessage(e, "Failed to create adjustment from SIV."));
    } finally {
      setPageLoading(false);
    }
  }

  // ── Line mutations ─────────────────────────────────────────────────────────

  async function handleLocationChange(locationId: string) {
    setManualLocationId(locationId);
    setFifoItems([]);
    setLines([]);
    setDraft(prev => ({ ...(prev ?? {}), locationId } as InventoryAdjustmentDto));
    if (locationId) await loadFifoItems(locationId);
  }

  function addLine() {
    if (!manualLocationId) { setError("Select a stock location first."); return; }
    setLines(prev => [...prev, emptyLine(manualLocationId)]);
  }

  function removeLine(index: number) {
    setLines(prev => prev.filter((_, i) => i !== index));
  }

  function selectFifoLot(index: number, fifoLotId: string) {
    const selected = fifoItems.find(x => x.fifoLotId === fifoLotId);
    setLines(prev =>
      prev.map((line, i) => {
        if (i !== index) return line;
        if (!selected) return emptyLine(manualLocationId);
        const systemQty  = toNum(selected.availableQty);
        const unitCost   = toNum(selected.unitCost);
        return {
          ...line,
          fifoLotId:       selected.fifoLotId,
          stockLocationId: manualLocationId,
          itemId:          selected.id,
          itemCode:        selected.code ?? null,
          itemName:        selected.name,
          uomId:           selected.defaultUomId,
          uomCode:         selected.defaultUomCode ?? null,
          uomName:         selected.defaultUomName ?? null,
          batchNo:         selected.batchNo ?? null,
          expiryDate:      selected.expiryDate ?? null,
          systemQty,
          countedQty:      systemQty,
          adjustmentQty:   0,
          unitCost,
          lineAmount:      0,
        };
      })
    );
  }

  function updateCountedQty(index: number, value: string) {
    const countedQty = Math.max(0, toNum(value));
    setLines(prev =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const adjustmentQty = countedQty - line.systemQty;
        return { ...line, countedQty, adjustmentQty, lineAmount: adjustmentQty * line.unitCost };
      })
    );
  }

  function updateNotes(index: number, value: string) {
    setLines(prev => prev.map((line, i) => i === index ? { ...line, notes: value } : line));
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): string | null {
    if (!companyId)       return "Company context is missing.";
    if (!adjustmentDate)  return "Adjustment date is required.";

    if (isManualMode) {
      if (!branchId)          return "Branch context is missing.";
      if (!manualLocationId)  return "Stock location is required.";
      if (lines.length === 0) return "Add at least one FIFO lot line.";
    }

    if (!isManualMode && !adjustmentId) return "Adjustment draft ID is missing.";

    const usedLots = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.fifoLotId && isManualMode)   return `Line ${i + 1}: Select a FIFO lot.`;
      if (!line.itemId)                       return `Line ${i + 1}: Item is missing.`;
      if (!line.uomId)                        return `Line ${i + 1}: UOM is missing.`;

      if (isManualMode && line.fifoLotId) {
        if (usedLots.has(line.fifoLotId))     return `Line ${i + 1}: Duplicate FIFO lot.`;
        usedLots.add(line.fifoLotId);
      }
      if (toNum(line.countedQty) > toNum(line.systemQty))
        return `Line ${i + 1}: Counted qty cannot exceed system qty. Positive adjustments require a separate receive adjustment.`;
      if (toNum(line.adjustmentQty) !== 0 && !line.notes.trim())
        return `Line ${i + 1}: Notes are required when variance exists.`;
    }
    return null;
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    const validationError = validate();
    if (validationError) { setError(validationError); setSuccess(null); return; }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (isManualMode) {
        const payload = buildManualPayload();
        const created = await adjustmentApi.createManual(companyId!, payload);
        setSuccess("Manual adjustment draft created.");
        navigate(
          `/companies/${companyId}/inventory-adjustments/drafts/${created.id}`,
          { replace: true }
        );
        return;
      }

      await adjustmentApi.updateDraftCount(companyId!, adjustmentId!, buildUpdatePayload());
      await loadDraft(companyId!, adjustmentId!);
      setSuccess("Draft saved.");
    } catch (e) {
      setError(getErrorMessage(e, "Failed to save adjustment."));
    } finally {
      setSaving(false);
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) { setError(validationError); setSuccess(null); return; }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (isManualMode) {
        const payload  = buildManualPayload();
        const created  = await adjustmentApi.createManual(companyId!, payload);
        await adjustmentApi.submit(companyId!, created.id);
        navigate(`/companies/${companyId}/inventory-adjustments/${created.id}`);
        return;
      }

      await adjustmentApi.updateDraftCount(companyId!, adjustmentId!, buildUpdatePayload());
      await adjustmentApi.submit(companyId!, adjustmentId!);
      navigate(`/companies/${companyId}/inventory-adjustments/${adjustmentId}`);
    } catch (e) {
      setError(getErrorMessage(e, "Failed to submit adjustment."));
    } finally {
      setSaving(false);
    }
  }

  // ── Payload builders ───────────────────────────────────────────────────────

  function buildManualPayload(): ManualAdjustmentCreateDto {
    return {
      branchId,
      locationId:     manualLocationId,
      adjustmentDate,
      remarks,
      lines: lines.map(l => ({
        fifoLotId:     l.fifoLotId!,
        itemId:        l.itemId,
        uomId:         l.uomId,
        batchNo:       l.batchNo ?? null,
        expiryDate:    l.expiryDate ?? null,
        systemQty:     toNum(l.systemQty),
        countedQty:    toNum(l.countedQty),
        adjustmentQty: toNum(l.countedQty) - toNum(l.systemQty),
        unitCost:      toNum(l.unitCost),
        notes:         l.notes.trim(),
      })),
    };
  }

  function buildUpdatePayload(): UpdateAdjustmentCountDto {
    return {
      adjustmentDate,
      remarks,
      lines: lines.map(l => ({
        lineId:     l.lineId,
        countedQty: toNum(l.countedQty),
        notes:      l.notes.trim(),
      })),
    };
  }

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!companyId) {
    return (
      <div className="adj-page">
        <div className="adj-alert error">Company context is missing.</div>
      </div>
    );
  }

  // ── Derived display helpers ────────────────────────────────────────────────

  const isLoading   = pageLoading || lookupLoading;
  const isSubmitted = draft?.docStatus === "Submitted" || draft?.docStatus === "Posted";
  const usedLotIds  = new Set(lines.map(l => l.fifoLotId).filter(Boolean));

  const locationDisplayName =
    isManualMode
      ? undefined
      : (draft as Record<string, unknown>)?.locationName as string | undefined
        ?? draft?.locationId
        ?? "";

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="adj-page">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="adj-header">
        <div className="adj-header-left">
          <p className="adj-kicker">Inventory Adjustment</p>
          <h1>{isManualMode ? "Manual FIFO Branch Count" : "SIV-Based Branch Count"}</h1>
          <p className="adj-subtitle">
            {isManualMode
              ? "Select a stock location, choose FIFO lots, enter counted quantities, then save or submit."
              : "System qty, item, UOM, batch, expiry, unit cost, and FIFO lot come from the SIV/FIFO stock. Only Counted Qty is editable."}
          </p>
        </div>

        <div className="adj-btn-row">
          <button
            type="button"
            className="adj-btn"
            onClick={() => navigate(`/companies/${companyId}/inventory-adjustments`)}
          >
            ← Back
          </button>
          <button
            type="button"
            className="adj-btn"
            disabled={saving || isLoading || isSubmitted}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            className="adj-btn primary"
            disabled={saving || isLoading || isSubmitted}
            onClick={handleSubmit}
          >
            {isSubmitted ? "Submitted" : "Submit"}
          </button>
        </div>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────── */}
      {error   && <div className="adj-alert error"  role="alert">{error}</div>}
      {success && <div className="adj-alert success" role="status">{success}</div>}
      {isLoading && <div className="adj-alert info">Loading…</div>}

      {/* ── Header Card ────────────────────────────────────────────────── */}
      <div className="adj-card">
        <div className="adj-form-grid">
          <div className="adj-field">
            <label htmlFor="adj-no">Adjustment no</label>
            <input id="adj-no" value={draft?.adjustmentNo ?? "NEW"} disabled />
          </div>

          <div className="adj-field">
            <label htmlFor="adj-status">Status</label>
            <input
              id="adj-status"
              value={draft?.docStatus ?? "Draft"}
              disabled
              data-status={draft?.docStatus ?? "Draft"}
            />
          </div>

          <div className="adj-field">
            <label htmlFor="adj-branch">Branch</label>
            <input
              id="adj-branch"
              value={(draft as Record<string, unknown>)?.branchName as string ?? branchId}
              disabled
            />
          </div>

          {isManualMode ? (
            <div className="adj-field">
              <label htmlFor="adj-location">
                Stock location <span className="req">*</span>
              </label>
              <select
                id="adj-location"
                value={manualLocationId}
                onChange={e => handleLocationChange(e.target.value)}
                disabled={lookupLoading}
              >
                <option value="">— select location —</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code ? `${loc.code} – ${loc.name}` : loc.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="adj-field">
              <label htmlFor="adj-location">Location</label>
              <input id="adj-location" value={locationDisplayName} disabled />
            </div>
          )}

          <div className="adj-field">
            <label htmlFor="adj-date">Adjustment date</label>
            <input
              id="adj-date"
              type="date"
              value={adjustmentDate}
              onChange={e => setAdjustmentDate(e.target.value)}
              disabled={isSubmitted}
            />
          </div>

          <div className="adj-field">
            <label htmlFor="adj-amount">Variance amount</label>
            <input
              id="adj-amount"
              value={fmt2(totalAmount)}
              disabled
              data-sign={totalAmount < 0 ? "neg" : totalAmount > 0 ? "pos" : "zero"}
            />
          </div>
        </div>

        <div className="adj-field adj-remarks">
          <label htmlFor="adj-remarks">Remarks</label>
          <textarea
            id="adj-remarks"
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="e.g. Kitchen physical count after SIV issue."
            disabled={isSubmitted}
            rows={3}
          />
        </div>
      </div>

      {/* ── Lines Card ─────────────────────────────────────────────────── */}
      <div className="adj-card">
        <div className="adj-section-head">
          <div>
            <h2>Branch count lines</h2>
            <p>
              {isManualMode
                ? "Each row is tied to one FIFO lot/batch. Counted qty is editable; stock identity fields are locked."
                : "Counted qty is editable. All operational fields are locked from the SIV/FIFO record."}
            </p>
          </div>

          <div className="adj-btn-row">
            {isManualMode && (
              <button
                type="button"
                className="adj-btn"
                onClick={addLine}
                disabled={!manualLocationId || isLoading}
              >
                + Add FIFO Lot
              </button>
            )}
            <span className={`adj-badge ${hasVariance ? "warn" : "ok"}`}>
              {hasVariance ? "Variance detected" : "No variance"}
            </span>
          </div>
        </div>

        {/* Metric summary row */}
        {lines.length > 0 && (
          <div className="adj-metrics">
            {[
              { label: "System qty",    value: fmt3(totalSystemQty),   sign: "zero" },
              { label: "Counted qty",   value: fmt3(totalCountedQty),  sign: "zero" },
              { label: "Total variance", value: fmt3(totalVarianceQty), sign: totalVarianceQty < 0 ? "neg" : totalVarianceQty > 0 ? "pos" : "zero" },
              { label: "Variance amount", value: fmt2(totalAmount),    sign: totalAmount < 0 ? "neg" : totalAmount > 0 ? "pos" : "zero" },
            ].map(m => (
              <div key={m.label} className="adj-metric">
                <div className="adj-metric-label">{m.label}</div>
                <div className="adj-metric-value" data-sign={m.sign}>{m.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="adj-table-wrap">
          <table className="adj-table">
            <thead>
              <tr>
                <th>Item / FIFO Lot</th>
                <th>UOM</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th className="num">System qty</th>
                <th className="num">Counted qty</th>
                <th className="num">Variance</th>
                <th className="num">Unit cost</th>
                <th className="num">Amount</th>
                <th>Notes</th>
                {isManualMode && <th aria-label="Actions" />}
              </tr>
            </thead>

            <tbody>
              {lines.length === 0 && !pageLoading && (
                <tr>
                  <td colSpan={isManualMode ? 11 : 10} className="adj-empty">
                    {isManualMode && !manualLocationId
                      ? "Select a stock location to begin adding FIFO lots."
                      : isManualMode ? 'Click "Add FIFO Lot" to add a count line.'  : "No adjustment lines found."}
                  </td>
                </tr>
              )}

              {lines.map((line, index) => {
                const varianceSign =
                  line.adjustmentQty < 0 ? "neg" : line.adjustmentQty > 0 ? "pos" : "zero";
                const amountSign =
                  line.lineAmount < 0 ? "neg" : line.lineAmount > 0 ? "pos" : "zero";
                const notesRequired =
                  line.adjustmentQty !== 0 && !line.notes.trim();

                // Only show lots not already selected in other lines (or the current line's lot)
                const availableLots = fifoItems.filter(
                  x => x.fifoLotId === line.fifoLotId || !usedLotIds.has(x.fifoLotId)
                );

                return (
                  <tr key={line.lineId}>
                    {/* Item / FIFO Lot */}
                    <td className="adj-td-input">
                      {isManualMode ? (
                        <select
                          value={line.fifoLotId ?? ""}
                          onChange={e => selectFifoLot(index, e.target.value)}
                          disabled={isLoading || isSubmitted}
                          className="adj-lot-select"
                        >
                          <option value="">— choose lot —</option>
                          {availableLots.map(item => (
                            <option key={item.fifoLotId} value={item.fifoLotId}>
                              {[
                                item.code ? `${item.code} – ${item.name}` : item.name,
                                item.batchNo ? `Batch: ${item.batchNo}` : "No batch",
                                item.expiryDate ? `Exp: ${item.expiryDate.slice(0, 10)}` : null,
                                `Qty: ${toNum(item.availableQty).toFixed(3)}`,
                                item.defaultUomCode,
                              ]
                                .filter(Boolean)
                                .join(" | ")}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={
                            line.itemCode
                              ? `${line.itemCode} – ${line.itemName ?? line.itemId}`
                              : (line.itemName ?? line.itemId)
                          }
                          disabled
                        />
                      )}
                    </td>

                    <td><input value={line.uomCode ?? line.uomName ?? "—"} disabled /></td>
                    <td><input value={line.batchNo ?? "—"} disabled /></td>
                    <td><input value={line.expiryDate?.slice(0, 10) ?? "—"} disabled /></td>

                    <td className="num adj-td-input">
                      <input value={fmt3(line.systemQty)} disabled />
                    </td>

                    <td className="num adj-td-input">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={line.countedQty}
                        disabled={!line.fifoLotId || isSubmitted}
                        onChange={e => updateCountedQty(index, e.target.value)}
                      />
                    </td>

                    <td className="num adj-td-input">
                      <input
                        value={fmt3(line.adjustmentQty)}
                        disabled
                        data-sign={varianceSign}
                      />
                    </td>

                    <td className="num adj-td-input">
                      <input value={fmt2(line.unitCost)} disabled />
                    </td>

                    <td className="num adj-td-input">
                      <input
                        value={fmt2(line.lineAmount)}
                        disabled
                        data-sign={amountSign}
                      />
                    </td>

                    <td className="adj-td-input">
                      <input
                        value={line.notes}
                        placeholder={line.adjustmentQty !== 0 ? "Required" : "Optional"}
                        disabled={isSubmitted}
                        onChange={e => updateNotes(index, e.target.value)}
                        data-required={notesRequired ? "true" : undefined}
                      />
                    </td>

                    {isManualMode && (
                      <td>
                        <button
                          type="button"
                          className="adj-remove-btn"
                          onClick={() => removeLine(index)}
                          disabled={isSubmitted}
                          aria-label={`Remove line ${index + 1}`}
                        >
                          ✕
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
                  <td colSpan={4}>Totals</td>
                  <td className="num">{fmt3(totalSystemQty)}</td>
                  <td className="num">{fmt3(totalCountedQty)}</td>
                  <td className="num" data-sign={totalVarianceQty < 0 ? "neg" : totalVarianceQty > 0 ? "pos" : "zero"}>
                    {fmt3(totalVarianceQty)}
                  </td>
                  <td />
                  <td className="num" data-sign={totalAmount < 0 ? "neg" : totalAmount > 0 ? "pos" : "zero"}>
                    {fmt2(totalAmount)}
                  </td>
                  <td />
                  {isManualMode && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
