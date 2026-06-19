// src/features/inventory/adjustments/pages/AdjustmentDraftEditorPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { adjustmentApi, getApiError } from "../api/adjustmentApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import {
  inventoryControlSettingsApi,
  type InventoryControlSettingsDto,
} from "../../settings/api/inventoryControlSettingsApi";

import {
  canApprove,
  canPost,
  canReject,
  canReverse,
  canSubmit,
  normalizeAdjustmentStatus,
  STATUS_BADGE,
} from "../utils/adjustmentWorkflow";

import type {
  AdjustmentCandidateDto,
  InventoryAdjustmentDto,
  StockLocationOption,
} from "../types";

import "./adjustment-draft-editor.css";

type LineVm = {
  vmId: string;
  fifoLotId: string;
  itemId: string;
  itemName: string;
  itemCode?: string;
  uomId: string;
  uomName: string;
  systemQty: number;
  countedQty: number;
  adjustmentQty: number;
  baseUomId: string;
  baseUomName: string;
  conversionFactor: number;
  isBaseUnit: boolean;
  systemQtyBase: number;
  countedQtyBase: number;
  adjustmentQtyBase: number;
  unitCost: number;
  unitCostDisplay: number;
  lineAmount: number;
  batchNo?: string;
  expiryDate?: string;
  notes: string;
};

type VarianceLevel = "warning" | "high" | "critical" | null;

const ADJUSTMENT_TYPES = [
  { value: "StockCount", label: "Stock count" },
  { value: "Waste", label: "Waste" },
  { value: "Damage", label: "Damage" },
  { value: "Variance", label: "Variance" },
] as const;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fmt3(value: unknown): string {
  return toNumber(value).toFixed(3);
}

function fmt2(value: unknown): string {
  return toNumber(value).toFixed(2);
}

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

function candidateToLine(candidate: AdjustmentCandidateDto): LineVm {
  const conversionFactor =
    toNumber((candidate as any).conversionFactor ?? candidate.toBaseFactor, 1) ||
    1;

  return {
    vmId: `lot-${candidate.fifoLotId}`,
    fifoLotId: candidate.fifoLotId,
    itemId: candidate.itemId,
    itemName: candidate.itemName,
    itemCode: candidate.itemCode,
    uomId: candidate.uomId,
    uomName: candidate.uomName,
    systemQty: candidate.systemQty,
    countedQty: candidate.systemQty,
    adjustmentQty: 0,
    baseUomId: candidate.baseUomId,
    baseUomName: candidate.baseUomName,
    conversionFactor,
    isBaseUnit: candidate.uomId === candidate.baseUomId,
    systemQtyBase: candidate.systemQtyBase,
    countedQtyBase: candidate.systemQtyBase,
    adjustmentQtyBase: 0,
    unitCost: candidate.unitCost,
    unitCostDisplay: candidate.unitCostDisplay,
    lineAmount: 0,
    batchNo: candidate.batchNo,
    expiryDate: candidate.expiryDate?.toString(),
    notes: "",
  };
}

function dtoLineToVm(line: InventoryAdjustmentDto["lines"][number]): LineVm {
  return {
    vmId: `dto-${line.fifoLotId}-${line.itemId}`,
    fifoLotId: line.fifoLotId,
    itemId: line.itemId,
    itemName: line.itemName ?? line.itemId,
    itemCode: undefined,
    uomId: line.uomId,
    uomName: line.uomName ?? line.uomId,
    systemQty: line.systemQty,
    countedQty: line.countedQty,
    adjustmentQty: line.adjustmentQty,
    baseUomId: line.baseUomId,
    baseUomName: line.baseUomName ?? "",
    conversionFactor: line.conversionFactor || 1,
    isBaseUnit: line.isBaseUnit,
    systemQtyBase: line.systemQtyBase,
    countedQtyBase: line.countedQtyBase,
    adjustmentQtyBase: line.adjustmentQtyBase,
    unitCost: line.unitCost,
    unitCostDisplay: line.unitCostDisplay,
    lineAmount: line.lineAmount,
    batchNo: line.batchNo,
    expiryDate: line.expiryDate?.toString(),
    notes: line.notes ?? "",
  };
}

function updateCountedQuantity(line: LineVm, rawValue: string): LineVm {
  const countedQty = Math.max(0, toNumber(rawValue));
  const adjustmentQty = countedQty - line.systemQty;
  const conversionFactor = line.conversionFactor || 1;
  const countedQtyBase = countedQty * conversionFactor;
  const adjustmentQtyBase = adjustmentQty * conversionFactor;
  const lineAmount = adjustmentQtyBase * line.unitCost;

  return {
    ...line,
    countedQty,
    adjustmentQty,
    countedQtyBase,
    adjustmentQtyBase,
    lineAmount,
  };
}

function variancePercent(line: LineVm): number {
  if (line.systemQty === 0) {
    return line.countedQty === 0 ? 0 : 100;
  }

  return Math.abs((line.adjustmentQty / line.systemQty) * 100);
}

function getVarianceLevel(
  line: LineVm,
  settings: InventoryControlSettingsDto | null
): VarianceLevel {
  if (!settings || line.adjustmentQty === 0) return null;

  const percent = variancePercent(line);

  if (percent >= settings.criticalVariancePercent) return "critical";
  if (percent >= settings.highVariancePercent) return "high";
  if (percent >= settings.warningVariancePercent) return "warning";

  return null;
}

function InlineModal({
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
  onConfirm: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");

  return (
    <div
      style={{
        background: "rgba(0,0,0,.3)",
        padding: "40px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
          <button type="button" className="btn" disabled={working} onClick={onCancel}>
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

export default function AdjustmentDraftEditorPage() {
  const navigate = useNavigate();
  const { adjustmentId } = useParams<{ adjustmentId?: string }>();
  const { companyId, branchId } = useAppScope();

  const isEdit = Boolean(adjustmentId);

  const adjustmentBasePath = companyId
    ? `/companies/${companyId}/inventory/adjustments`
    : "";

  const [draft, setDraft] = useState<InventoryAdjustmentDto | null>(null);
  const [lines, setLines] = useState<LineVm[]>([]);
  const [locations, setLocations] = useState<StockLocationOption[]>([]);
  const [candidates, setCandidates] = useState<AdjustmentCandidateDto[]>([]);

  const [locationId, setLocationId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("StockCount");
  const [referenceNo, setReferenceNo] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [search, setSearch] = useState("");

  const [pageLoading, setPageLoading] = useState(false);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [settings, setSettings] =
    useState<InventoryControlSettingsDto | null>(null);
  const [modal, setModal] = useState<"reject" | "reverse" | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = normalizeAdjustmentStatus(draft?.docStatus);
  const isLocked = status !== "Draft";

  const usedLotIds = useMemo(
    () => new Set(lines.map((line) => line.fifoLotId)),
    [lines]
  );

  const availableCandidates = useMemo(
    () => candidates.filter((candidate) => !usedLotIds.has(candidate.fifoLotId)),
    [candidates, usedLotIds]
  );

  const totals = useMemo(() => {
    return {
      system: lines.reduce((sum, line) => sum + line.systemQty, 0),
      counted: lines.reduce((sum, line) => sum + line.countedQty, 0),
      variance: lines.reduce((sum, line) => sum + line.adjustmentQty, 0),
      amount: lines.reduce((sum, line) => sum + line.lineAmount, 0),
    };
  }, [lines]);

  const hasVariance = useMemo(
    () => lines.some((line) => line.adjustmentQty !== 0),
    [lines]
  );

  const hasCriticalVariance = useMemo(
    () => lines.some((line) => getVarianceLevel(line, settings) === "critical"),
    [lines, settings]
  );

  const canUsePage = Boolean(companyId && branchId);

  const goBack = useCallback(() => {
    if (!adjustmentBasePath) return;
    navigate(adjustmentBasePath);
  }, [adjustmentBasePath, navigate]);

  const goToAdjustment = useCallback(
    (id: string, replace = false) => {
      if (!adjustmentBasePath) return;
      navigate(`${adjustmentBasePath}/${id}`, { replace });
    },
    [adjustmentBasePath, navigate]
  );

  const loadLocations = useCallback(async () => {
    if (!companyId || !branchId) return;

    setErr(null);

    try {
      const rows = await stockLocationsApi.list(companyId, branchId);
      setLocations(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setLocations([]);
      setErr(getApiError(error, "Failed to load stock locations."));
    }
  }, [companyId, branchId]);

  const loadExisting = useCallback(
    async (id: string) => {
      if (!companyId || !branchId) return;

      setPageLoading(true);
      setErr(null);
      setSuccess(null);

      try {
        const dto = await adjustmentApi.get(companyId, branchId, id);

        setDraft(dto);
        setLocationId(dto.locationId ?? "");
        setAdjustmentType(dto.adjustmentType ?? "StockCount");
        setReferenceNo(dto.referenceNo ?? "");
        setReason(dto.reason ?? "");
        setRemarks(dto.remarks ?? "");
        setLines((dto.lines ?? []).map(dtoLineToVm));
      } catch (error) {
        setErr(getApiError(error, "Failed to load adjustment."));
      } finally {
        setPageLoading(false);
      }
    },
    [companyId, branchId]
  );

  const loadCandidates = useCallback(
    async (stockLocationId: string, keyword: string) => {
      if (!companyId || !branchId || !stockLocationId) {
        setCandidates([]);
        return;
      }

      setCandidateLoading(true);
      setErr(null);

      try {
        const rows = await adjustmentApi.candidates(
          companyId,
          branchId,
          stockLocationId,
          {
            search: keyword || undefined,
          }
        );

        setCandidates(Array.isArray(rows) ? rows : []);
      } catch (error) {
        setCandidates([]);
        setErr(getApiError(error, "Failed to load stock candidates."));
      } finally {
        setCandidateLoading(false);
      }
    },
    [companyId, branchId]
  );

  useEffect(() => {
    if (!canUsePage) return;

    if (isEdit && adjustmentId) {
      void loadExisting(adjustmentId);
    } else {
      void loadLocations();
    }
  }, [
    canUsePage,
    isEdit,
    adjustmentId,
    loadExisting,
    loadLocations,
  ]);

  useEffect(() => {
    if (!companyId || !branchId || !locationId) {
      setSettings(null);
      return;
    }

    let cancelled = false;

    setSettingsLoading(true);

    inventoryControlSettingsApi
      .getEffective(companyId, { branchId, locationId })
      .then((dto) => {
        if (!cancelled) setSettings(dto);
      })
      .catch((error) => {
        if (!cancelled) {
          setSettings(null);
          setErr(getApiError(error, "Failed to load inventory control settings."));
        }
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, locationId]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  function handleLocationChange(stockLocationId: string) {
    setLocationId(stockLocationId);
    setLines([]);
    setCandidates([]);
    setSearch("");

    if (stockLocationId) {
      void loadCandidates(stockLocationId, "");
    }
  }

  function handleSearchChange(value: string) {
    setSearch(value);

    if (searchTimer.current) clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(() => {
      void loadCandidates(locationId, value);
    }, 300);
  }

  function addCandidate(candidate: AdjustmentCandidateDto) {
    if (usedLotIds.has(candidate.fifoLotId)) return;

    setLines((previous) => [...previous, candidateToLine(candidate)]);
  }

  function removeLine(index: number) {
    setLines((previous) => previous.filter((_, i) => i !== index));
  }

  function handleCountedChange(index: number, value: string) {
    setLines((previous) =>
      previous.map((line, i) =>
        i === index ? updateCountedQuantity(line, value) : line
      )
    );
  }

  function handleNotesChange(index: number, value: string) {
    setLines((previous) =>
      previous.map((line, i) => (i === index ? { ...line, notes: value } : line))
    );
  }

  function validateBeforeSave(): string | null {
    if (!locationId) return "Select a stock location.";
    if (lines.length === 0) return "Add at least one line.";

    if (
      settings?.requireReasonOnVariance &&
      lines.some((line) => line.adjustmentQty !== 0 && !line.notes.trim())
    ) {
      return "A variance reason is required for every line with non-zero variance.";
    }

    return null;
  }

  function validateBeforePost(): string | null {
    if (settings?.blockPostingOnCriticalVariance && hasCriticalVariance) {
      return "Posting blocked: one or more lines exceed the critical variance threshold.";
    }

    return validateBeforeSave();
  }

  function buildLines() {
    return lines.map((line) => ({
      fifoLotId: line.fifoLotId,
      itemId: line.itemId,
      uomId: line.uomId,
      systemQty: line.systemQty,
      countedQty: line.countedQty,
      unitCost: line.unitCost,
      notes: line.notes || undefined,
    }));
  }

  async function saveDraft() {
    if (!companyId || !branchId) return;

    const validationError = validateBeforeSave();

    if (validationError) {
      setErr(validationError);
      setSuccess(null);
      return;
    }

    setSaving(true);
    setErr(null);
    setSuccess(null);

    try {
      if (isEdit && adjustmentId) {
        await adjustmentApi.updateDraft(companyId, branchId, adjustmentId, {
          locationId,
          adjustmentType: adjustmentType as any,
          referenceNo: referenceNo || undefined,
          reason: reason || undefined,
          remarks: remarks || undefined,
          lines: buildLines(),
        });

        setSuccess("Adjustment saved.");
        await loadExisting(adjustmentId);
      } else {
        const created = await adjustmentApi.createDraft(companyId, branchId, {
          locationId,
          adjustmentType: adjustmentType as any,
          adjustmentDate: new Date().toISOString(),
          referenceNo: referenceNo || undefined,
          reason: reason || undefined,
          remarks: remarks || undefined,
          lines: buildLines(),
        });

        setSuccess("Adjustment draft created.");
        goToAdjustment(created.id, true);
      }
    } catch (error) {
      setErr(getApiError(error, "Failed to save adjustment."));
    } finally {
      setSaving(false);
    }
  }

  async function runWorkflowAction(label: string, action: () => Promise<void>) {
    if (!companyId || !branchId || !adjustmentId) return;

    setSaving(true);
    setErr(null);
    setSuccess(null);

    try {
      await action();
      setSuccess(`${label} successful.`);
      await loadExisting(adjustmentId);
      setModal(null);
    } catch (error) {
      setErr(getApiError(error, `${label} failed.`));
    } finally {
      setSaving(false);
    }
  }

  function submitAdjustment() {
    void runWorkflowAction("Submit", () =>
      adjustmentApi.submit(companyId!, branchId!, adjustmentId!)
    );
  }

  function approveAdjustment() {
    void runWorkflowAction("Approve", () =>
      adjustmentApi.approve(companyId!, branchId!, adjustmentId!)
    );
  }

  function postAdjustment() {
    const validationError = validateBeforePost();

    if (validationError) {
      setErr(validationError);
      setSuccess(null);
      return;
    }

    void runWorkflowAction("Post", () =>
      adjustmentApi.post(companyId!, branchId!, adjustmentId!)
    );
  }

  function rejectAdjustment(note: string) {
    void runWorkflowAction("Reject", () =>
      adjustmentApi.reject(companyId!, branchId!, adjustmentId!, note)
    );
  }

  function reverseAdjustment(reverseReason: string) {
    void runWorkflowAction("Reverse", () =>
      adjustmentApi.reverse(companyId!, branchId!, adjustmentId!, reverseReason)
    );
  }

  if (!companyId || !branchId) {
    return (
      <div className="adj-page page">
        <div className="alert alert-warning">
          Select a company and branch before opening inventory adjustments.
        </div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="adj-page page">
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

  if (modal === "reject") {
    return (
      <div className="adj-page page">
        <InlineModal
          title="Reject adjustment"
          body="Provide a reason. This will be visible to the submitter."
          placeholder="Rejection reason required"
          requireText
          confirmLabel="Confirm reject"
          danger
          working={saving}
          onConfirm={rejectAdjustment}
          onCancel={() => {
            setModal(null);
            setErr(null);
          }}
        />

        {err && (
          <div className="alert alert-danger" style={{ margin: "0 20px" }}>
            {err}
          </div>
        )}
      </div>
    );
  }

  if (modal === "reverse") {
    return (
      <div className="adj-page page">
        <InlineModal
          title="Reverse adjustment"
          body="This writes counter-entries to FIFO and inventory ledger. This cannot be undone."
          placeholder="Reason for reversal required"
          requireText
          confirmLabel="Confirm reverse"
          danger
          working={saving}
          onConfirm={reverseAdjustment}
          onCancel={() => {
            setModal(null);
            setErr(null);
          }}
        />

        {err && (
          <div className="alert alert-danger" style={{ margin: "0 20px" }}>
            {err}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="adj-page page">
      <div className="adj-header">
        <div className="adj-header-left">
          <div className="adj-kicker">
            {isEdit
              ? `Adjustment · ${draft?.adjustmentNo ?? "…"}`
              : "New adjustment"}
          </div>

          <h1>
            {isEdit
              ? draft?.adjustmentType ?? "Adjustment"
              : "Create adjustment draft"}
          </h1>

          <div className="adj-subtitle">
            {isEdit
              ? `Created ${fmtDate(draft?.createdAt)}${
                  draft?.submittedAt
                    ? ` · Submitted ${fmtDate(draft.submittedAt)}`
                    : ""
                }${
                  draft?.postedAt ? ` · Posted ${fmtDate(draft.postedAt)}` : ""
                }`
              : "Select a stock location, then add FIFO lots to count."}
          </div>
        </div>

        <div className="adj-btn-row">
          {draft && <span className={STATUS_BADGE[status]}>{status}</span>}

          {draft?.hasHighVariance && (
            <span className="adj-badge warn">
              <i
                className="ti ti-alert-triangle"
                aria-hidden
                style={{ fontSize: 11, marginRight: 4 }}
              />
              {draft.highestVariancePercent?.toFixed(1)}% variance
            </span>
          )}

          {canSubmit(status) && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || lines.length === 0}
              onClick={submitAdjustment}
            >
              {saving ? "Submitting…" : "Submit for approval"}
            </button>
          )}

          {canApprove(status) && (
            <button
              type="button"
              className="btn btn-success"
              disabled={saving}
              onClick={approveAdjustment}
            >
              {saving ? "Approving…" : "Approve"}
            </button>
          )}

          {canReject(status) && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={saving}
              onClick={() => setModal("reject")}
              style={{ background: "transparent" }}
            >
              Reject
            </button>
          )}

          {canPost(status) && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={postAdjustment}
            >
              {saving ? "Posting…" : "Post to inventory"}
            </button>
          )}

          {canReverse(status) && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={saving}
              onClick={() => setModal("reverse")}
              style={{ background: "transparent" }}
            >
              Reverse
            </button>
          )}

          {!isLocked && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || lines.length === 0}
              onClick={() => void saveDraft()}
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create draft"}
            </button>
          )}

          <button type="button" className="btn" onClick={goBack}>
            ← Back
          </button>
        </div>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}
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

      <div className="adj-card">
        <div className="adj-form-grid">
          {!isEdit && (
            <div className="adj-field">
              <label>
                Stock location <span className="req">*</span>
              </label>

              <select
                value={locationId}
                onChange={(event) => handleLocationChange(event.target.value)}
                disabled={isLocked}
              >
                <option value="">— select location —</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isEdit && (
            <div className="adj-field">
              <label>
                Adjustment type <span className="req">*</span>
              </label>

              <select
                value={adjustmentType}
                onChange={(event) => setAdjustmentType(event.target.value)}
                disabled={isLocked}
              >
                {ADJUSTMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="adj-field">
            <label>Reference no</label>
            <input
              value={referenceNo}
              onChange={(event) => setReferenceNo(event.target.value)}
              disabled={isLocked}
              placeholder="Optional external ref"
            />
          </div>

          <div className="adj-field">
            <label>Reason</label>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isLocked}
              placeholder="Brief reason for adjustment"
            />
          </div>

          <div className="adj-field adj-remarks" style={{ gridColumn: "1 / -1" }}>
            <label>Remarks</label>
            <textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              disabled={isLocked}
              placeholder="Additional notes"
            />
          </div>
        </div>
      </div>

      {lines.length > 0 && (
        <div className="adj-metrics">
          <div className="adj-metric">
            <div className="adj-metric-label">Lines</div>
            <div className="adj-metric-value">{lines.length}</div>
          </div>

          <div className="adj-metric">
            <div className="adj-metric-label">System qty</div>
            <div className="adj-metric-value">{fmt3(totals.system)}</div>
          </div>

          <div className="adj-metric">
            <div className="adj-metric-label">Counted qty</div>
            <div className="adj-metric-value">{fmt3(totals.counted)}</div>
          </div>

          <div className="adj-metric">
            <div className="adj-metric-label">Net variance</div>
            <div
              className="adj-metric-value"
              data-sign={
                totals.variance < 0
                  ? "neg"
                  : totals.variance > 0
                    ? "pos"
                    : undefined
              }
            >
              {totals.variance >= 0 ? "+" : ""}
              {fmt3(totals.variance)}
            </div>
          </div>
        </div>
      )}

      {locationId && (
        <div className="adj-policy-banner">
          {settingsLoading
            ? "Loading inventory control policy…"
            : settings
              ? (
                  <>
                    <strong>Variance policy</strong> · Warning{" "}
                    {fmt2(settings.warningVariancePercent)}% · High{" "}
                    {fmt2(settings.highVariancePercent)}% · Critical{" "}
                    {fmt2(settings.criticalVariancePercent)}%
                    {settings.requireReasonOnVariance && " · Reason required"}
                    {settings.blockPostingOnCriticalVariance &&
                      " · Critical posting blocked"}
                  </>
                )
              : "No inventory control policy loaded."}
        </div>
      )}

      {!isLocked && locationId && (
        <div className="adj-card">
          <div className="adj-section-head">
            <div>
              <h2>Add stock lots</h2>
              <p>
                {candidateLoading
                  ? "Loading available lots…"
                  : `${availableCandidates.length} lot${
                      availableCandidates.length !== 1 ? "s" : ""
                    } available`}
              </p>
            </div>

            <input
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search item / batch…"
              style={{ maxWidth: 240 }}
            />
          </div>

          {availableCandidates.length === 0 && !candidateLoading ? (
            <div
              style={{
                fontSize: 13,
                color: "var(--text-soft)",
                padding: "12px 0",
              }}
            >
              {search
                ? "No lots match your search."
                : "All available lots have been added."}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 8,
              }}
            >
              {availableCandidates.map((candidate) => (
                <button
                  type="button"
                  key={candidate.fifoLotId}
                  onClick={() => addCandidate(candidate)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface)",
                    cursor: "pointer",
                    transition: "background .12s",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 13,
                      color: "var(--text)",
                    }}
                  >
                    {candidate.itemName}
                    {candidate.itemCode && (
                      <span
                        style={{
                          fontWeight: 400,
                          color: "var(--text-muted)",
                          marginLeft: 4,
                          fontSize: 11,
                        }}
                      >
                        {candidate.itemCode}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontFamily: "var(--mono)",
                      marginTop: 3,
                    }}
                  >
                    {candidate.uomName}
                    {candidate.uomId !== candidate.baseUomId && (
                      <span style={{ marginLeft: 6, color: "var(--text-soft)" }}>
                        1 {candidate.uomName} = {candidate.toBaseFactor}{" "}
                        {candidate.baseUomName}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 2,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span>
                      On hand: <strong>{fmt3(candidate.systemQty)}</strong>
                    </span>

                    {candidate.batchNo && <span>Batch: {candidate.batchNo}</span>}

                    {candidate.expiryDate && (
                      <span
                        style={{
                          color:
                            new Date(candidate.expiryDate.toString()) < new Date()
                              ? "var(--danger)"
                              : "inherit",
                        }}
                      >
                        Exp: {String(candidate.expiryDate).slice(0, 10)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
                <th className="num" title="Per base unit">
                  Cost/base
                </th>
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
              ) : (
                lines.map((line, index) => {
                  const varianceSign =
                    line.adjustmentQty < 0
                      ? "neg"
                      : line.adjustmentQty > 0
                        ? "pos"
                        : undefined;

                  const varianceLevel = getVarianceLevel(line, settings);
                  const percent = variancePercent(line);

                  const notesRequired = Boolean(
                    settings?.requireReasonOnVariance &&
                      line.adjustmentQty !== 0 &&
                      !line.notes.trim()
                  );

                  return (
                    <tr
                      key={line.vmId}
                      className={
                        varianceLevel
                          ? `adj-variance-row adj-variance-row--${varianceLevel}`
                          : undefined
                      }
                    >
                      <td className="adj-td-input">
                        <input
                          value={
                            line.itemCode
                              ? `${line.itemCode} — ${line.itemName}`
                              : line.itemName
                          }
                          readOnly
                          disabled
                        />
                      </td>

                      <td className="adj-td-input">
                        <input value={line.uomName} readOnly disabled />
                      </td>

                      <td className="adj-td-input">
                        <input
                          value={
                            line.isBaseUnit
                              ? line.baseUomName
                              : `${line.baseUomName} (×${line.conversionFactor})`
                          }
                          readOnly
                          disabled
                          title={
                            line.isBaseUnit
                              ? "Counting in base unit"
                              : `1 ${line.uomName} = ${line.conversionFactor} ${line.baseUomName}`
                          }
                        />
                      </td>

                      <td className="adj-td-input">
                        <input value={line.batchNo ?? "—"} readOnly disabled />
                      </td>

                      <td className="adj-td-input">
                        <input
                          value={line.expiryDate?.slice(0, 10) ?? "—"}
                          readOnly
                          disabled
                          style={
                            line.expiryDate && new Date(line.expiryDate) < new Date()
                              ? { color: "var(--danger)" }
                              : undefined
                          }
                        />
                      </td>

                      <td className="num adj-td-input">
                        <input
                          value={fmt3(line.systemQty)}
                          readOnly
                          disabled
                          title={`${fmt3(line.systemQtyBase)} ${line.baseUomName}`}
                        />
                      </td>

                      <td className="num adj-td-input">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={line.countedQty}
                          disabled={isLocked}
                          onChange={(event) =>
                            handleCountedChange(index, event.target.value)
                          }
                          title={`${fmt3(line.countedQtyBase)} ${line.baseUomName}`}
                        />
                      </td>

                      <td className="num adj-td-input">
                        <input
                          value={fmt3(line.adjustmentQty)}
                          readOnly
                          disabled
                          data-sign={varianceSign}
                          title={`${fmt3(line.adjustmentQtyBase)} ${line.baseUomName}`}
                        />

                        {varianceLevel && (
                          <div
                            className={`adj-variance-badge adj-variance-badge--${varianceLevel}`}
                          >
                            {varianceLevel.toUpperCase()} · {fmt2(percent)}%
                          </div>
                        )}
                      </td>

                      <td className="num adj-td-input">
                        <input
                          value={fmt2(line.unitCost)}
                          readOnly
                          disabled
                          title={`$${fmt2(line.unitCostDisplay)} per ${
                            line.uomName
                          }`}
                        />
                      </td>

                      <td className="num adj-td-input">
                        <input
                          value={fmt2(line.lineAmount)}
                          readOnly
                          disabled
                          data-sign={varianceSign}
                        />
                      </td>

                      <td className="adj-td-input">
                        <input
                          value={line.notes}
                          placeholder={notesRequired ? "Required ⚠" : "Optional"}
                          disabled={isLocked}
                          onChange={(event) =>
                            handleNotesChange(index, event.target.value)
                          }
                          data-required={notesRequired ? "true" : undefined}
                        />
                      </td>

                      {!isLocked && (
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="adj-remove-btn"
                            onClick={() => removeLine(index)}
                            aria-label="Remove line"
                          >
                            <i className="ti ti-x" aria-hidden />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>

            {lines.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ fontWeight: 500 }}>
                    Totals
                  </td>
                  <td className="num">{fmt3(totals.system)}</td>
                  <td className="num">{fmt3(totals.counted)}</td>
                  <td
                    className="num"
                    data-sign={
                      totals.variance < 0
                        ? "neg"
                        : totals.variance > 0
                          ? "pos"
                          : undefined
                    }
                  >
                    {totals.variance >= 0 ? "+" : ""}
                    {fmt3(totals.variance)}
                  </td>
                  <td />
                  <td
                    className="num"
                    data-sign={
                      totals.amount < 0
                        ? "neg"
                        : totals.amount > 0
                          ? "pos"
                          : undefined
                    }
                  >
                    ${fmt2(totals.amount)}
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