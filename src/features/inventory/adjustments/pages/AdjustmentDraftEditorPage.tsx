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

type NormalizedStockLocation = {
  /**
   * Real StockLocation.Id expected by backend adjustment validation.
   * Never store BranchStockLocation.Id here.
   */
  id: string;
  name: string;
  code?: string;
  branchId?: string;
  branchName?: string;
  branchLocationId?: string;
  branchLocationName?: string;
  type?: string;
  isActive: boolean;
  isDefault: boolean;
  canAdjust?: boolean;
};

type VarianceLevel = "warning" | "high" | "critical" | null;

const ADJUSTMENT_TYPES = [
  { value: "StockCount", label: "Stock count" },
  { value: "Waste", label: "Waste" },
  { value: "Damage", label: "Damage" },
  { value: "Variance", label: "Variance" },
] as const;

type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number]["value"];

const SEARCH_DEBOUNCE_MS = 300;

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function cleanString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const clean = cleanString(value);
    if (clean) return clean;
  }

  return undefined;
}

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

function fmtMoney(value: unknown): string {
  return `ETB ${toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(value?: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeStockLocation(
  row: StockLocationOption | Record<string, unknown>
): NormalizedStockLocation | null {
  const source = toRecord(row);
  const stockLocation = toRecord(source.stockLocation);
  const location = toRecord(source.location);
  const branchLocation = toRecord(source.branchLocation);
  const branch = toRecord(source.branch);

  /**
   * Backend validation expects StockLocation.Id.
   *
   * Important:
   * - BranchStockLocation.Id / BranchLocation.Id must NOT be sent as locationId.
   * - Some refactored endpoints return `id` as the branch mapping id, so `id`
   *   is intentionally used only after StockLocation-specific fields.
   */
  const stockLocationId = firstString(
    source.stockLocationId,
    source.locationId,
    stockLocation.id,
    location.id,
    stockLocation.stockLocationId,
    location.stockLocationId,
    source.id
  );

  if (!stockLocationId) return null;

  const branchLocationId = firstString(
    source.branchLocationId,
    source.branchStockLocationId,
    branchLocation.id
  );

  const name =
    firstString(
      source.stockLocationName,
      source.locationName,
      source.name,
      stockLocation.name,
      location.name,
      source.branchLocationName,
      branchLocation.name,
      source.displayName,
      "Unnamed stock location"
    ) ?? "Unnamed stock location";

  return {
    id: stockLocationId,
    name,
    code: firstString(
      source.stockLocationCode,
      source.locationCode,
      source.code,
      stockLocation.code,
      location.code
    ),
    branchId: firstString(source.branchId, branch.id, branchLocation.branchId),
    branchName: firstString(source.branchName, branch.name),
    branchLocationId,
    branchLocationName: firstString(
      source.branchLocationName,
      branchLocation.name
    ),
    type: firstString(
      source.stockLocationType,
      source.locationType,
      source.type,
      stockLocation.type,
      location.type
    ),
    canAdjust:
      typeof source.canAdjust === "boolean"
        ? source.canAdjust
        : typeof stockLocation.canAdjust === "boolean"
          ? stockLocation.canAdjust
          : undefined,
    isActive:
      source.isActive !== false &&
      source.active !== false &&
      source.isEnabled !== false &&
      stockLocation.isActive !== false &&
      location.isActive !== false &&
      branchLocation.isActive !== false,
    isDefault:
      source.isDefault === true ||
      source.default === true ||
      source.isPrimary === true ||
      stockLocation.isDefault === true ||
      location.isDefault === true,
  };
}

function getLocationLabel(location: NormalizedStockLocation): string {
  const left = location.code
    ? `${location.code} - ${location.name}`
    : location.name;

  const scope = location.branchLocationName || location.branchName;
  const suffix = [scope, location.type].filter(Boolean).join(" - ");

  return suffix ? `${left} (${suffix})` : left;
}

function candidateToLine(candidate: AdjustmentCandidateDto): LineVm {
  const source = candidate as AdjustmentCandidateDto & Record<string, unknown>;
  const conversionFactor =
    toNumber(source.conversionFactor ?? source.toBaseFactor, 1) || 1;

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
    itemName: line.itemName ?? "Unnamed item",
    itemCode: undefined,
    uomId: line.uomId,
    uomName: line.uomName ?? "Unspecified UOM",
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
  if (line.systemQty === 0) return line.countedQty === 0 ? 0 : 100;
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
    <div className="adj-modal-shell" role="presentation">
      <div
        className="adj-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adj-modal-title"
      >
        <div id="adj-modal-title" className="adj-modal-title">
          {title}
        </div>

        <div className="adj-modal-body">{body}</div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          autoFocus
        />

        <div className="adj-modal-actions">
          <button
            type="button"
            className="btn"
            disabled={working}
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            disabled={working || (requireText && !text.trim())}
            onClick={() => onConfirm(text.trim())}
          >
            {working ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sign,
}: {
  label: string;
  value: string | number;
  sign?: "neg" | "pos";
}) {
  return (
    <div className="adj-metric">
      <div className="adj-metric-label">{label}</div>
      <div className="adj-metric-value" data-sign={sign}>
        {value}
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
  const [locations, setLocations] = useState<NormalizedStockLocation[]>([]);
  const [candidates, setCandidates] = useState<AdjustmentCandidateDto[]>([]);

  const [locationId, setLocationId] = useState("");
  const [adjustmentType, setAdjustmentType] =
    useState<AdjustmentType>("StockCount");
  const [referenceNo, setReferenceNo] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [search, setSearch] = useState("");

  const [pageLoading, setPageLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
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
  const isLocked = isEdit && status !== "Draft";

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === locationId) ?? null,
    [locations, locationId]
  );

  const activeLocations = useMemo(
    () =>
      locations.filter(
        (location) => location.isActive && location.canAdjust !== false
      ),
    [locations]
  );

  const usedLotIds = useMemo(
    () => new Set(lines.map((line) => line.fifoLotId)),
    [lines]
  );

  const availableCandidates = useMemo(
    () => candidates.filter((candidate) => !usedLotIds.has(candidate.fifoLotId)),
    [candidates, usedLotIds]
  );

  const totals = useMemo(
    () => ({
      system: lines.reduce((sum, line) => sum + line.systemQty, 0),
      counted: lines.reduce((sum, line) => sum + line.countedQty, 0),
      variance: lines.reduce((sum, line) => sum + line.adjustmentQty, 0),
      amount: lines.reduce((sum, line) => sum + line.lineAmount, 0),
    }),
    [lines]
  );

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
    if (adjustmentBasePath) navigate(adjustmentBasePath);
  }, [adjustmentBasePath, navigate]);

  const goToAdjustment = useCallback(
    (id: string, replace = false) => {
      if (adjustmentBasePath) {
        navigate(`${adjustmentBasePath}/${id}`, { replace });
      }
    },
    [adjustmentBasePath, navigate]
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
            search: keyword.trim() || undefined,
          }
        );

        setCandidates(Array.isArray(rows) ? rows : []);
      } catch (error) {
        setCandidates([]);
        setErr(
          getApiError(error, "Failed to load stock candidates for this location.")
        );
      } finally {
        setCandidateLoading(false);
      }
    },
    [companyId, branchId]
  );

  const loadLocations = useCallback(async () => {
    if (!companyId || !branchId) return;

    setLocationLoading(true);
    setErr(null);

    try {
      const rows = await stockLocationsApi.list(companyId, branchId);
      const normalized = (Array.isArray(rows) ? rows : [])
        .map((row) =>
          normalizeStockLocation(row as StockLocationOption & Record<string, unknown>)
        )
        .filter((row): row is NormalizedStockLocation => Boolean(row));

      setLocations(normalized);

      if (!isEdit && !locationId) {
        const preferred =
          normalized.find(
            (location) =>
              location.isActive &&
              location.canAdjust !== false &&
              location.isDefault
          ) ??
          normalized.find(
            (location) => location.isActive && location.canAdjust !== false
          );

        if (preferred) {
          setLocationId(preferred.id);
        }
      }
    } catch (error) {
      setLocations([]);
      setErr(getApiError(error, "Failed to load branch stock locations."));
    } finally {
      setLocationLoading(false);
    }
  }, [companyId, branchId, isEdit, locationId]);

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
        setAdjustmentType(
          ADJUSTMENT_TYPES.some((item) => item.value === dto.adjustmentType)
            ? (dto.adjustmentType as AdjustmentType)
            : "StockCount"
        );
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

  useEffect(() => {
    if (!canUsePage) return;

    void loadLocations();

    if (isEdit && adjustmentId) {
      void loadExisting(adjustmentId);
    }
  }, [canUsePage, isEdit, adjustmentId, loadExisting, loadLocations]);

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
          setErr(getApiError(error, "Failed to load inventory control policy."));
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
    if (!isLocked && locationId) {
      void loadCandidates(locationId, search);
    }
  }, [isLocked, locationId, loadCandidates, search]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  function handleLocationChange(stockLocationId: string) {
    if (stockLocationId === locationId) return;

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
    }, SEARCH_DEBOUNCE_MS);
  }

  function addCandidate(candidate: AdjustmentCandidateDto) {
    if (isLocked || usedLotIds.has(candidate.fifoLotId)) return;

    setLines((previous) => [...previous, candidateToLine(candidate)]);
  }

  function removeLine(index: number) {
    if (isLocked) return;

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
      previous.map((line, i) =>
        i === index ? { ...line, notes: value } : line
      )
    );
  }

  function validateSelectedLocation(): string | null {
    if (!locationId) return "Select a stock location.";

    if (!selectedLocation && !isEdit) {
      return "Selected stock location is not available in the current branch scope.";
    }

    if (selectedLocation && !selectedLocation.isActive) {
      return "Selected stock location is inactive.";
    }

    if (selectedLocation && selectedLocation.canAdjust === false) {
      return "Selected stock location does not allow stock adjustments.";
    }

    if (
      selectedLocation?.branchId &&
      branchId &&
      selectedLocation.branchId !== branchId
    ) {
      return "Selected stock location does not belong to the active branch.";
    }

    return null;
  }

  function validateBeforeSave(): string | null {
    const locationError = validateSelectedLocation();
    if (locationError) return locationError;

    if (lines.length === 0) return "Add at least one stock lot line.";

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
  return lines.map((line, index) => ({
    lineNo: index + 1,
    fifoLotId: line.fifoLotId,
    itemId: line.itemId,
    uomId: line.uomId,
    systemQty: line.systemQty,
    countedQty: line.countedQty,
    unitCost: line.unitCost,
    notes: line.notes.trim() || undefined,
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
      const payload = {
        locationId,
        adjustmentType,
        referenceNo: referenceNo.trim() || undefined,
        reason: reason.trim() || undefined,
        remarks: remarks.trim() || undefined,
        lines: buildLines(),
      };

      if (isEdit && adjustmentId) {
        await adjustmentApi.updateDraft(companyId, branchId, adjustmentId, payload);

        setSuccess("Adjustment saved.");
        await loadExisting(adjustmentId);
      } else {
        const created = await adjustmentApi.createDraft(companyId, branchId, {
          ...payload,
          adjustmentDate: new Date().toISOString(),
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
      <main className="adj-page page">
        <div className="alert alert-warning">
          Select a company and branch before opening inventory adjustments.
        </div>
      </main>
    );
  }

  if (pageLoading) {
    return (
      <main className="adj-page page">
        <div className="adj-loading">Loading adjustment...</div>
      </main>
    );
  }

  if (modal === "reject" || modal === "reverse") {
    const isReject = modal === "reject";

    return (
      <main className="adj-page page">
        <InlineModal
          title={isReject ? "Reject adjustment" : "Reverse adjustment"}
          body={
            isReject
              ? "Provide a reason. This will be visible to the submitter."
              : "This writes counter-entries to FIFO and the inventory ledger. This cannot be undone."
          }
          placeholder={
            isReject ? "Rejection reason required" : "Reason for reversal required"
          }
          requireText
          confirmLabel={isReject ? "Confirm reject" : "Confirm reverse"}
          danger
          working={saving}
          onConfirm={isReject ? rejectAdjustment : reverseAdjustment}
          onCancel={() => {
            setModal(null);
            setErr(null);
          }}
        />

        {err && <div className="alert alert-danger adj-modal-error">{err}</div>}
      </main>
    );
  }

  return (
    <main className="adj-page page">
      <header className="adj-header">
        <div className="adj-header-left">
          <div className="adj-kicker">
            {isEdit
              ? `Adjustment - ${draft?.adjustmentNo ?? "..."}`
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
                    ? ` - Submitted ${fmtDate(draft.submittedAt)}`
                    : ""
                }${draft?.postedAt ? ` - Posted ${fmtDate(draft.postedAt)}` : ""}`
              : "Select an active branch stock location, then add FIFO lots to count."}
          </div>

          {selectedLocation && (
            <div className="adj-location-context">
              Location: {getLocationLabel(selectedLocation)}
            </div>
          )}
        </div>

        <div className="adj-btn-row">
          {draft && <span className={STATUS_BADGE[status]}>{status}</span>}

          {draft?.hasHighVariance && (
            <span className="adj-badge warn">
              Warning: {draft.highestVariancePercent?.toFixed(1)}% variance
            </span>
          )}

          {canSubmit(status) && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || lines.length === 0}
              onClick={submitAdjustment}
            >
              {saving ? "Submitting..." : "Submit for approval"}
            </button>
          )}

          {canApprove(status) && (
            <button
              type="button"
              className="btn btn-success"
              disabled={saving}
              onClick={approveAdjustment}
            >
              {saving ? "Approving..." : "Approve"}
            </button>
          )}

          {canReject(status) && (
            <button
              type="button"
              className="btn btn-danger btn-ghost-danger"
              disabled={saving}
              onClick={() => setModal("reject")}
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
              {saving ? "Posting..." : "Post to inventory"}
            </button>
          )}

          {canReverse(status) && (
            <button
              type="button"
              className="btn btn-danger btn-ghost-danger"
              disabled={saving}
              onClick={() => setModal("reverse")}
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
              {saving ? "Saving..." : isEdit ? "Save changes" : "Create draft"}
            </button>
          )}

          <button type="button" className="btn" onClick={goBack}>
            Back
          </button>
        </div>
      </header>

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

      <section className="adj-card" aria-labelledby="adj-header-form-title">
        <div className="adj-section-title" id="adj-header-form-title">
          Adjustment header
        </div>

        <div className="adj-form-grid">
          <div className="adj-field adj-field-wide-sm">
            <label htmlFor="adj-location">
              Stock location <span className="req">*</span>
            </label>

            {isEdit ? (
              <input
                id="adj-location"
                value={
                  selectedLocation
                    ? getLocationLabel(selectedLocation)
                    : locationId || "-"
                }
                readOnly
                disabled
              />
            ) : (
              <select
                id="adj-location"
                value={locationId}
                onChange={(event) => handleLocationChange(event.target.value)}
                disabled={isLocked || locationLoading}
              >
                <option value="">
                  {locationLoading
                    ? "Loading locations..."
                    : "- select stock location -"}
                </option>

                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {getLocationLabel(location)}
                  </option>
                ))}
              </select>
            )}

            <div className="adj-help-text">
              Only active stock locations linked to the selected branch are
              available.
            </div>
          </div>

          <div className="adj-field">
            <label htmlFor="adj-type">
              Adjustment type <span className="req">*</span>
            </label>

            {isEdit ? (
              <input id="adj-type" value={adjustmentType} readOnly disabled />
            ) : (
              <select
                id="adj-type"
                value={adjustmentType}
                onChange={(event) =>
                  setAdjustmentType(event.target.value as AdjustmentType)
                }
                disabled={isLocked}
              >
                {ADJUSTMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="adj-field">
            <label htmlFor="adj-ref">Reference no</label>
            <input
              id="adj-ref"
              value={referenceNo}
              onChange={(event) => setReferenceNo(event.target.value)}
              disabled={isLocked}
              placeholder="Optional external ref"
            />
          </div>

          <div className="adj-field">
            <label htmlFor="adj-reason">Reason</label>
            <input
              id="adj-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isLocked}
              placeholder="Brief reason"
            />
          </div>

          <div className="adj-field adj-remarks">
            <label htmlFor="adj-remarks">Remarks</label>
            <textarea
              id="adj-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              disabled={isLocked}
              placeholder="Additional notes"
            />
          </div>
        </div>
      </section>

      {lines.length > 0 && (
        <section className="adj-metrics" aria-label="Adjustment totals">
          <Metric label="Lines" value={lines.length} />
          <Metric label="System qty" value={fmt3(totals.system)} />
          <Metric label="Counted qty" value={fmt3(totals.counted)} />
          <Metric
            label="Net variance"
            value={`${totals.variance >= 0 ? "+" : ""}${fmt3(totals.variance)}`}
            sign={
              totals.variance < 0
                ? "neg"
                : totals.variance > 0
                  ? "pos"
                  : undefined
            }
          />
          <Metric
            label="Value impact"
            value={fmtMoney(totals.amount)}
            sign={
              totals.amount < 0 ? "neg" : totals.amount > 0 ? "pos" : undefined
            }
          />
        </section>
      )}

      {locationId && (
        <section className="adj-policy-banner" aria-live="polite">
          {settingsLoading
            ? "Loading inventory control policy..."
            : settings
              ? (
                <>
                  <strong>Variance policy</strong> - Warning{" "}
                  {fmt2(settings.warningVariancePercent)}% - High{" "}
                  {fmt2(settings.highVariancePercent)}% - Critical{" "}
                  {fmt2(settings.criticalVariancePercent)}%
                  {settings.requireReasonOnVariance && " - Reason required"}
                  {settings.blockPostingOnCriticalVariance &&
                    " - Critical posting blocked"}
                </>
              )
              : "No inventory control policy loaded for this location."}
        </section>
      )}

      {!isLocked && locationId && (
        <section className="adj-card" aria-labelledby="adj-add-lots-title">
          <div className="adj-section-head">
            <div>
              <h2 id="adj-add-lots-title">Add stock lots</h2>
              <p>
                {candidateLoading
                  ? "Loading available lots..."
                  : `${availableCandidates.length} lot${
                      availableCandidates.length !== 1 ? "s" : ""
                    } available in ${
                      selectedLocation?.name ?? "selected location"
                    }`}
              </p>
            </div>

            <input
              className="adj-search-input"
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search item / batch..."
            />
          </div>

          {availableCandidates.length === 0 && !candidateLoading ? (
            <div className="adj-empty-card">
              {search
                ? "No lots match your search."
                : "All available lots have been added, or this location has no available FIFO lots."}
            </div>
          ) : (
            <div className="adj-candidate-grid">
              {availableCandidates.map((candidate) => (
                <button
                  type="button"
                  key={candidate.fifoLotId}
                  className="adj-candidate-card"
                  onClick={() => addCandidate(candidate)}
                >
                  <div className="adj-candidate-title">
                    {candidate.itemName}
                    {candidate.itemCode && <span>{candidate.itemCode}</span>}
                  </div>

                  <div className="adj-candidate-uom">
                    {candidate.uomName}
                    {candidate.uomId !== candidate.baseUomId && (
                      <span>
                        1 {candidate.uomName} = {candidate.toBaseFactor}{" "}
                        {candidate.baseUomName}
                      </span>
                    )}
                  </div>

                  <div className="adj-candidate-meta">
                    <span>
                      On hand: <strong>{fmt3(candidate.systemQty)}</strong>
                    </span>

                    {candidate.batchNo && (
                      <span>Batch: {candidate.batchNo}</span>
                    )}

                    {candidate.expiryDate && (
                      <span
                        className={
                          new Date(candidate.expiryDate.toString()) < new Date()
                            ? "adj-expired"
                            : undefined
                        }
                      >
                        Exp: {String(candidate.expiryDate).slice(0, 10)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section
        className="adj-card adj-card-flush"
        aria-labelledby="adj-count-lines-title"
      >
        <div className="adj-section-head adj-section-head-padded">
          <div>
            <h2 id="adj-count-lines-title">Count lines</h2>
            <p>
              Enter counted quantities. Variance = counted - system.
              {hasVariance &&
                " Notes are required by policy when applicable."}
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
                              ? `${line.itemCode} - ${line.itemName}`
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
                              : `${line.baseUomName} (${line.conversionFactor})`
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
                        <input value={line.batchNo ?? "-"} readOnly disabled />
                      </td>

                      <td className="adj-td-input">
                        <input
                          value={line.expiryDate?.slice(0, 10) ?? "-"}
                          readOnly
                          disabled
                          data-expired={
                            line.expiryDate &&
                            new Date(line.expiryDate) < new Date()
                              ? "true"
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
                            {varianceLevel.toUpperCase()} - {fmt2(percent)}%
                          </div>
                        )}
                      </td>

                      <td className="num adj-td-input">
                        <input
                          value={fmt2(line.unitCost)}
                          readOnly
                          disabled
                          title={`${fmt2(line.unitCostDisplay)} per ${line.uomName}`}
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
                          placeholder={notesRequired ? "Required Warning:" : "Optional"}
                          disabled={isLocked}
                          onChange={(event) =>
                            handleNotesChange(index, event.target.value)
                          }
                          data-required={notesRequired ? "true" : undefined}
                        />
                      </td>

                      {!isLocked && (
                        <td className="adj-remove-cell">
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
                  <td colSpan={5}>Totals</td>
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
                    {fmtMoney(totals.amount)}
                  </td>
                  <td />
                  {!isLocked && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </main>
  );
}
