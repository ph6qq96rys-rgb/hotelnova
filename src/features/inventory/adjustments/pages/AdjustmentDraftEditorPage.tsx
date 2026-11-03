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
  availableActions,
  canEdit,
  normalizeAdjustmentStatus,
  STATUS_BADGE,
  STATUS_LABEL,
  useAdjustmentPermissions,
  WRITE_OFF_TYPES,
} from "../utils/adjustmentWorkflow";
import type {
  AdjustmentCandidateDto,
  InventoryAdjustmentDto,
  StockLocationOption,
} from "../types";

import "./adjustment-draft-editor.css";
import { Button } from "../../../../components/ui/button";

type LineVm = {
  vmId: string;
  /** Null when the item is counted as a whole at the location. */
  fifoLotId: string | null;
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
  /** Stock on hand now (base unit), for open documents. */
  currentQtyBase?: number | null;
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
  { value: "Variance", label: "Unexplained variance" },
  { value: "Correction", label: "Correction" },
  { value: "Waste", label: "Waste (reduces stock)" },
  { value: "Spoilage", label: "Spoilage (reduces stock)" },
  { value: "Expiry", label: "Expired (reduces stock)" },
  { value: "Damage", label: "Damage / breakage (reduces stock)" },
  { value: "Other", label: "Other" },
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
    vmId: candidate.fifoLotId ? `lot-${candidate.fifoLotId}` : `item-${candidate.itemId}`,
    fifoLotId: candidate.fifoLotId ?? null,
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
    vmId: line.fifoLotId ? `lot-${line.fifoLotId}` : `item-${line.itemId}`,
    fifoLotId: line.fifoLotId ?? null,
    itemId: line.itemId,
    itemName: line.itemName ?? "Unnamed item",
    itemCode: line.itemCode,
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
    currentQtyBase: line.currentQtyBase,
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
  if (line.systemQtyBase === 0) return line.countedQtyBase === 0 ? 0 : 100;
  return Math.abs((line.adjustmentQtyBase / line.systemQtyBase) * 100);
}

function todayInput(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** A date picked in the form, sent as the end of that local day (or now, for today). */
function dateToIso(value: string): string | undefined {
  if (!value) return undefined;
  if (value === todayInput()) return new Date().toISOString();
  const end = new Date(`${value}T23:59:59`);
  return Number.isNaN(end.getTime()) ? undefined : end.toISOString();
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
          <Button variant="bare"
            type="button"
            className="btn"
            disabled={working}
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button variant="bare"
            type="button"
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            disabled={working || (requireText && !text.trim())}
            onClick={() => onConfirm(text.trim())}
          >
            {working ? "Working..." : confirmLabel}
          </Button>
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
  const [adjustmentDate, setAdjustmentDate] = useState(todayInput());
  const [search, setSearch] = useState("");
  const [pickMode, setPickMode] = useState<"lots" | "items">("lots");

  const [pageLoading, setPageLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [settings, setSettings] =
    useState<InventoryControlSettingsDto | null>(null);
  const [modal, setModal] = useState<"reject" | "reverse" | "cancel" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = normalizeAdjustmentStatus(draft?.docStatus);
  const permissions = useAdjustmentPermissions();
  const actions = availableActions(status, permissions);
  const isLocked = (isEdit && !canEdit(status)) || !permissions.create;
  const isWriteOff = WRITE_OFF_TYPES.has(adjustmentType);

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

  const usedKeys = useMemo(
    () => new Set(lines.map((line) => line.vmId)),
    [lines]
  );

  const availableCandidates = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          !usedKeys.has(candidate.fifoLotId ? `lot-${candidate.fifoLotId}` : `item-${candidate.itemId}`) &&
          // An item is counted either as a whole or by lot, never both.
          !lines.some((line) =>
            line.itemId === candidate.itemId && (candidate.fifoLotId ? line.fifoLotId === null : line.fifoLotId !== null))
      ),
    [candidates, usedKeys, lines]
  );

  const totals = useMemo(
    () => ({
      increases: lines.filter((line) => line.adjustmentQtyBase > 0).length,
      decreases: lines.filter((line) => line.adjustmentQtyBase < 0).length,
      amount: lines.reduce((sum, line) => sum + line.lineAmount, 0),
    }),
    [lines]
  );

  const hasVariance = useMemo(
    () => lines.some((line) => line.adjustmentQty !== 0),
    [lines]
  );

  const movedLines = useMemo(
    () =>
      lines.filter(
        (line) =>
          line.currentQtyBase !== undefined &&
          line.currentQtyBase !== null &&
          Math.abs(line.currentQtyBase - line.systemQtyBase) > 0.0000005
      ).length,
    [lines]
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
    async (stockLocationId: string, keyword: string, mode: "lots" | "items" = "lots") => {
      if (!companyId || !branchId || !stockLocationId) {
        setCandidates([]);
        return;
      }

      setCandidateLoading(true);
      setErr(null);

      try {
        const rows =
          mode === "items"
            ? await adjustmentApi.items(companyId, branchId, stockLocationId, keyword.trim() || undefined)
            : await adjustmentApi.candidates(companyId, branchId, stockLocationId, {
                search: keyword.trim() || undefined,
              });

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
        setAdjustmentDate(dto.adjustmentDate ? String(dto.adjustmentDate).slice(0, 10) : todayInput());
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
      void loadCandidates(locationId, search, pickMode);
    }
    // The search box reloads through its own debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, locationId, loadCandidates, pickMode]);

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
      void loadCandidates(stockLocationId, "", pickMode);
    }
  }

  function handleSearchChange(value: string) {
    setSearch(value);

    if (searchTimer.current) clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(() => {
      void loadCandidates(locationId, value, pickMode);
    }, SEARCH_DEBOUNCE_MS);
  }

  function addCandidate(candidate: AdjustmentCandidateDto) {
    if (isLocked) return;

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

    if (lines.length === 0) return "Add at least one lot or item to count.";

    if (isWriteOff && lines.some((line) => line.countedQty > line.systemQty)) {
      return "A write-off can only reduce stock. Use a stock count or correction for stock that was found.";
    }

    if (
      settings?.requireReasonOnVariance &&
      !reason.trim() &&
      lines.some((line) => line.adjustmentQty !== 0 && !line.notes.trim())
    ) {
      return "Give a reason for the differences: on each changed line, or one reason for the whole adjustment.";
    }

    return null;
  }

  /** Only what was counted and why; the server reads book quantity, cost and units itself. */
  function buildLines() {
    return lines.map((line) => ({
      fifoLotId: line.fifoLotId,
      itemId: line.itemId,
      uomId: line.uomId,
      countedQty: line.countedQty,
      reason: line.notes.trim() || undefined,
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
        adjustmentDate: dateToIso(adjustmentDate),
        referenceNo: referenceNo.trim() || undefined,
        reason: reason.trim() || undefined,
        remarks: remarks.trim() || undefined,
        lines: buildLines(),
      };

      if (isEdit && adjustmentId) {
        await adjustmentApi.updateDraft(companyId, branchId, adjustmentId, {
          ...payload,
          version: draft?.version,
        });

        const message = status === "Rejected" ? "Corrected. The adjustment is a draft again; submit it when ready." : "Adjustment saved.";
        await loadExisting(adjustmentId);
        setSuccess(message);
      } else {
        const created = await adjustmentApi.createDraft(companyId, branchId, payload);

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
      adjustmentApi.submit(companyId!, branchId!, adjustmentId!, draft?.version)
    );
  }

  function postAdjustment() {
    void runWorkflowAction("Post", () =>
      adjustmentApi.post(companyId!, branchId!, adjustmentId!, draft?.version)
    );
  }

  function rejectAdjustment(note: string) {
    void runWorkflowAction("Reject", () =>
      adjustmentApi.reject(companyId!, branchId!, adjustmentId!, note, draft?.version)
    );
  }

  function reverseAdjustment(reverseReason: string) {
    void runWorkflowAction("Reverse", () =>
      adjustmentApi.reverse(companyId!, branchId!, adjustmentId!, reverseReason, draft?.version)
    );
  }

  function cancelAdjustment(cancelReason: string) {
    void runWorkflowAction("Cancel", () =>
      adjustmentApi.cancel(companyId!, branchId!, adjustmentId!, cancelReason, draft?.version)
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

  if (modal) {
    const copy = {
      reject: {
        title: "Reject adjustment",
        body: "Give a reason. The preparer sees it and can correct the adjustment.",
        placeholder: "Reason for rejection",
        confirm: "Reject",
        run: rejectAdjustment,
      },
      reverse: {
        title: "Reverse adjustment",
        body: "This puts the stock back as it was and reverses the journal. It cannot be undone.",
        placeholder: "Reason for reversal",
        confirm: "Reverse",
        run: reverseAdjustment,
      },
      cancel: {
        title: "Cancel adjustment",
        body: "The adjustment is closed without changing stock. It stays on record as cancelled.",
        placeholder: "Reason for cancelling",
        confirm: "Cancel adjustment",
        run: cancelAdjustment,
      },
    }[modal];

    return (
      <main className="adj-page page">
        <InlineModal
          title={copy.title}
          body={copy.body}
          placeholder={copy.placeholder}
          requireText
          confirmLabel={copy.confirm}
          danger
          working={saving}
          onConfirm={copy.run}
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
          {draft && <span className={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</span>}

          {draft?.hasHighVariance && (
            <span className="adj-badge warn">
              Highest variance {draft.highestVariancePercent?.toFixed(1)}%
            </span>
          )}

          {!isLocked && (
            <Button variant="bare"
              type="button"
              className="btn btn-primary"
              disabled={saving || lines.length === 0}
              onClick={() => void saveDraft()}
            >
              {saving ? "Saving..." : !isEdit ? "Create draft" : status === "Rejected" ? "Save correction" : "Save changes"}
            </Button>
          )}

          {actions.submit && isEdit && (
            <Button variant="bare"
              type="button"
              className="btn btn-primary"
              disabled={saving || lines.length === 0}
              onClick={submitAdjustment}
              title="Save your changes first; submit sends the saved version."
            >
              {saving ? "Submitting..." : "Submit"}
            </Button>
          )}

          {actions.approve && adjustmentBasePath && adjustmentId && (
            <Button variant="bare"
              type="button"
              className="btn btn-success"
              disabled={saving}
              onClick={() => navigate(`${adjustmentBasePath}/${adjustmentId}/approve`)}
            >
              Review for approval
            </Button>
          )}

          {actions.reject && (
            <Button variant="bare" type="button" className="btn btn-danger btn-ghost-danger" disabled={saving} onClick={() => setModal("reject")}>
              Reject
            </Button>
          )}

          {actions.post && (
            <Button variant="bare" type="button" className="btn btn-primary" disabled={saving} onClick={postAdjustment}>
              {saving ? "Posting..." : "Post to stock"}
            </Button>
          )}

          {actions.reverse && (
            <Button variant="bare" type="button" className="btn btn-danger btn-ghost-danger" disabled={saving} onClick={() => setModal("reverse")}>
              Reverse
            </Button>
          )}

          {actions.cancel && isEdit && (
            <Button variant="bare" type="button" className="btn" disabled={saving} onClick={() => setModal("cancel")}>
              Cancel adjustment
            </Button>
          )}

          <Button variant="bare" type="button" className="btn" onClick={goBack}>
            Back
          </Button>
        </div>
      </header>

      {err && <div className="alert alert-danger">{err}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {status === "Rejected" && draft?.rejectionNote && (
        <div className="alert alert-danger">
          <strong>Rejected{draft.rejectedByName ? ` by ${draft.rejectedByName}` : ""}:</strong> {draft.rejectionNote}
          {permissions.create && " Correct the lines below and save; the adjustment then returns to draft."}
        </div>
      )}

      {draft?.cancelReason && (
        <div className="alert alert-warn">
          <strong>Cancelled:</strong> {draft.cancelReason}
        </div>
      )}

      {movedLines > 0 && (
        <div className="alert alert-warn">
          Stock moved on {movedLines} line{movedLines === 1 ? "" : "s"} after the count was saved (sales, issues or
          receipts). The adjustment still posts the counted difference; save again to recount against today's stock.
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

            {isLocked ? (
              <input
                id="adj-type"
                value={ADJUSTMENT_TYPES.find((type) => type.value === adjustmentType)?.label ?? adjustmentType}
                readOnly
                disabled
              />
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
            <label htmlFor="adj-date">
              Count / loss date <span className="req">*</span>
            </label>
            <input
              id="adj-date"
              type="date"
              value={adjustmentDate}
              max={todayInput()}
              onChange={(event) => setAdjustmentDate(event.target.value)}
              disabled={isLocked}
            />
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
              placeholder={settings?.requireReasonOnVariance ? "Required unless every changed line has its own reason" : "Brief reason"}
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
          <Metric label="Stock found" value={`${totals.increases} line${totals.increases === 1 ? "" : "s"}`} sign={totals.increases ? "pos" : undefined} />
          <Metric label="Stock missing" value={`${totals.decreases} line${totals.decreases === 1 ? "" : "s"}`} sign={totals.decreases ? "neg" : undefined} />
          <Metric
            label={status === "Posted" || status === "Reversed" ? "Posted value" : "Estimated value"}
            value={fmtMoney(totals.amount)}
            sign={totals.amount < 0 ? "neg" : totals.amount > 0 ? "pos" : undefined}
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
                  {settings.requireApprovalForHighVariance && ` - Manager approval from ${fmt2(Math.min(settings.highVariancePercent, settings.approvalThresholdPercent))}%`}
                  {settings.requireReasonOnVariance && " - Reason required"}
                  {settings.blockPostingOnCriticalVariance &&
                    " - Critical variances need a written approval"}
                </>
              )
              : "No inventory control policy loaded for this location."}
        </section>
      )}

      {!isLocked && locationId && (
        <section className="adj-card" aria-labelledby="adj-add-lots-title">
          <div className="adj-section-head">
            <div>
              <h2 id="adj-add-lots-title">{pickMode === "lots" ? "Add lots to count" : "Add items counted as a whole"}</h2>
              <p>
                {candidateLoading
                  ? "Loading..."
                  : pickMode === "lots"
                    ? `${availableCandidates.length} lot${availableCandidates.length !== 1 ? "s" : ""} in stock at ${selectedLocation?.name ?? "this location"}`
                    : "For stock found without a lot, or to count every lot of an item together (decreases use the oldest lots first)."}
              </p>
            </div>

            <div className="adj-btn-row">
              <div className="adj-segmented" role="tablist" aria-label="What to count">
                <Button variant="bare"
                  type="button"
                  role="tab"
                  aria-selected={pickMode === "lots"}
                  className={pickMode === "lots" ? "btn btn-sm btn-primary" : "btn btn-sm"}
                  onClick={() => setPickMode("lots")}
                >
                  By lot
                </Button>
                <Button variant="bare"
                  type="button"
                  role="tab"
                  aria-selected={pickMode === "items"}
                  className={pickMode === "items" ? "btn btn-sm btn-primary" : "btn btn-sm"}
                  onClick={() => setPickMode("items")}
                >
                  Whole item / found stock
                </Button>
              </div>

              <input
                className="adj-search-input"
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={pickMode === "lots" ? "Search item / batch..." : "Search item..."}
              />
            </div>
          </div>

          {availableCandidates.length === 0 && !candidateLoading ? (
            <div className="adj-empty-card">
              {search
                ? "Nothing matches your search."
                : pickMode === "lots"
                  ? "All lots in stock are already on the count, or the location has none. Use Whole item / found stock for stock without a lot."
                  : "No active stock items match."}
            </div>
          ) : (
            <div className="adj-candidate-grid">
              {availableCandidates.map((candidate) => (
                <Button variant="bare"
                  type="button"
                  key={candidate.fifoLotId ?? `item-${candidate.itemId}`}
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
                        1 {candidate.uomName} = {candidate.conversionFactor}{" "}
                        {candidate.baseUomName}
                      </span>
                    )}
                  </div>

                  <div className="adj-candidate-meta">
                    <span>
                      On hand: <strong>{fmt3(candidate.systemQty)}</strong>
                    </span>

                    {candidate.isItemLevel && (
                      <span>{candidate.openLotCount ? `${candidate.openLotCount} open lot${candidate.openLotCount === 1 ? "" : "s"}` : "No stock on the books"}</span>
                    )}

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
                </Button>
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
              Enter what you counted, in the unit shown. Book quantity and cost come from the stock ledger when you save.
              {hasVariance && settings?.requireReasonOnVariance &&
                " Give a reason on each changed line, or one reason for the whole adjustment."}
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
                <th>Lot / batch</th>
                <th>Expiry</th>
                <th className="num">Book</th>
                <th className="num">Counted</th>
                <th className="num">Variance</th>
                <th className="num" title="Cost per counting unit">
                  Unit cost
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
                        <input value={line.fifoLotId ? line.batchNo ?? "Lot" : "Whole item"} readOnly disabled />
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
                          title={`${fmt3(line.systemQtyBase)} ${line.baseUomName}${
                            line.currentQtyBase !== undefined && line.currentQtyBase !== null
                              ? ` (on hand now: ${fmt3(line.currentQtyBase)} ${line.baseUomName})`
                              : ""
                          }`}
                        />
                        {line.currentQtyBase !== undefined &&
                          line.currentQtyBase !== null &&
                          Math.abs(line.currentQtyBase - line.systemQtyBase) > 0.0000005 && (
                            <div className="adj-variance-badge adj-variance-badge--warning">
                              Now {fmt3(line.currentQtyBase / (line.conversionFactor || 1))}
                            </div>
                          )}
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
                          value={fmt2(line.unitCostDisplay || line.unitCost * (line.conversionFactor || 1))}
                          readOnly
                          disabled
                          title={`${line.unitCost} per ${line.baseUomName}`}
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
                          placeholder={notesRequired && !reason.trim() ? "Reason required" : "Reason (optional)"}
                          disabled={isLocked}
                          onChange={(event) =>
                            handleNotesChange(index, event.target.value)
                          }
                          data-required={notesRequired ? "true" : undefined}
                        />
                      </td>

                      {!isLocked && (
                        <td className="adj-remove-cell">
                          <Button variant="bare"
                            type="button"
                            className="adj-remove-btn"
                            onClick={() => removeLine(index)}
                            aria-label="Remove line"
                          >
                            <i className="ti ti-x" aria-hidden />
                          </Button>
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
                  <td colSpan={8}>Total value (quantities are in different units)</td>
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
