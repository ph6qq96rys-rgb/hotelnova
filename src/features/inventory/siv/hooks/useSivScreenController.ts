// src/features/inventory/siv/hooks/useSivScreenController.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  sivApi,
  type CreateSivDraftRequest,
  type FifoIssueCandidateDto,
  type InventoryItemSearchResult,
  type LocationOption,
  type SivDetailsDto,
  type SivLineDto,
  type UpdateSivDraftRequest,
} from "../api/sivApi";

const DESTINATION_REQUIRED_MESSAGE =
  "SIV destination location is required. Select Kitchen, Bar, Coffee Bar, or another consumption location.";

const defaultIssueDate = () => new Date().toISOString().slice(0, 10);

type Nullable<T> = T | null | undefined;

type DraftLineLike = Partial<SivLineDto> & {
  key?: string;
  inventoryItemId?: string | null;
  inventoryItemName?: string | null;
  baseUomId?: string | null;
  baseUomCode?: string | null;
  quantity?: number | string | null;
  notes?: string | null;
};

export type FifoOptionWithUiKey = FifoIssueCandidateDto & {
  __fifoOptionKey: string;
};

export type SIVLine = {
  key: string;
  id?: string | null;
  itemId: string;
  itemName: string;
  uomId: string;
  uomCode: string;
  qty: number | "";
  remarks: string;
  availableQty?: number;
  availableBaseQty?: number;
  batchNo: string;
  expiryDate: string;
  selectedFifoKey: string;
  fifoOptions: FifoOptionWithUiKey[];
  loadingFifo: boolean;
  loadingAvailability: boolean;
  lineError: string;
};

type Args = {
  companyId: string;
  branchId: string;
  departmentId?: string | null;
  currentLocationId?: string | null;
  requestedByUserId?: string | null;
};

type ValidationResult = {
  ok: boolean;
  message?: string;
};

function makeKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeEmptyLine(): SIVLine {
  return {
    key: makeKey(),
    id: null,
    itemId: "",
    itemName: "",
    uomId: "",
    uomCode: "",
    qty: "",
    remarks: "",
    availableQty: undefined,
    availableBaseQty: undefined,
    batchNo: "",
    expiryDate: "",
    selectedFifoKey: "",
    fifoOptions: [],
    loadingFifo: false,
    loadingAvailability: false,
    lineError: "",
  };
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  const valueText = text(value).trim();
  return valueText || null;
}

function num(value: unknown, fallback = 0): number {
  if (value === "" || value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateOnly(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function apiError(error: unknown, fallback: string): string {
  const err = error as {
    response?: { data?: unknown };
    message?: string;
  };

  const data = err?.response?.data as
    | string
    | { error?: string; Error?: string; message?: string; title?: string }
    | undefined;

if (typeof data === "string") {
  return data || fallback;
}

if (data && typeof data === "object") {
  return (
    data.error ??
    data.Error ??
    data.message ??
    data.title ??
    err?.message ??
    fallback
  );
}

return err?.message ?? fallback;
}

function fifoBusinessDate(option: Partial<FifoIssueCandidateDto>): string {
  return dateOnly(option.expiryDate) || dateOnly(option.receivedDate) || "";
}

function makeFifoBaseKey(option: Partial<FifoIssueCandidateDto>): string {
  return [
    option.fifoLayerId || "no-layer",
    option.sourceId || "no-source",
    option.sourceNumber || "no-source-number",
    option.itemId || "no-item",
    option.uomId || "no-uom",
    dateOnly(option.receivedDate) || "no-received",
    option.batchNo || "no-batch",
    dateOnly(option.expiryDate) || "no-exp",
    option.availableQty ?? "no-qty",
    option.availableBaseQty ?? "no-base-qty",
  ].join("|");
}

function withUniqueFifoKeys(options: FifoIssueCandidateDto[]): FifoOptionWithUiKey[] {
  const seen = new Map<string, number>();

  return options.map((option) => {
    const base = makeFifoBaseKey(option);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);

    return {
      ...option,
      __fifoOptionKey: count === 0 ? base : `${base}|dup-${count}`,
    };
  });
}

export function getFifoOptionKey(option: Partial<FifoIssueCandidateDto>): string {
  return (option as Partial<FifoOptionWithUiKey>).__fifoOptionKey || makeFifoBaseKey(option);
}

function sortFifoLots(lots: FifoIssueCandidateDto[]): FifoIssueCandidateDto[] {
  return [...lots].sort((a, b) => {
    const aDate = fifoBusinessDate(a) || "9999-12-31";
    const bDate = fifoBusinessDate(b) || "9999-12-31";
    if (aDate !== bDate) return aDate.localeCompare(bDate);

    const aReceived = dateOnly(a.receivedDate) || "9999-12-31";
    const bReceived = dateOnly(b.receivedDate) || "9999-12-31";
    if (aReceived !== bReceived) return aReceived.localeCompare(bReceived);

    return makeFifoBaseKey(a).localeCompare(makeFifoBaseKey(b));
  });
}

function itemId(item: Partial<InventoryItemSearchResult> & Record<string, unknown>): string {
  return text(item.itemId ?? item.id ?? item.inventoryItemId);
}

function itemName(item: Partial<InventoryItemSearchResult> & Record<string, unknown>): string {
  return text(item.itemName ?? item.name ?? item.inventoryItemName ?? item.description);
}

function itemUomId(item: Partial<InventoryItemSearchResult> & Record<string, unknown>): string {
  return text(item.uomId ?? item.baseUomId ?? item.unitOfMeasureId);
}

function itemUomCode(item: Partial<InventoryItemSearchResult> & Record<string, unknown>): string {
  return text(item.uomCode ?? item.baseUomCode ?? item.unitOfMeasureCode);
}

function normalizeInventoryItem(
  item: Partial<InventoryItemSearchResult> & Record<string, unknown>,
): InventoryItemSearchResult {
  const id = itemId(item);
  const name = itemName(item);
  const uomId = itemUomId(item);
  const uomCode = itemUomCode(item);

  return {
    ...item,
    id,
    name,
    uomId,
    uomCode,
    baseUomId: text(item.baseUomId ?? uomId),
    baseUomCode: text(item.baseUomCode ?? uomCode),
    sku: nullableText(item.sku),
    barcode: nullableText(item.barcode),
    isActive: Boolean(item.isActive ?? true),
  };
}

function normalizeLocation(location: Partial<LocationOption> & Record<string, unknown>): LocationOption {
  return {
    id: text(location.id ?? location.locationId),
    name: text(location.name ?? location.locationName ?? location.code),
    code: nullableText(location.code),
    locationType: nullableText(location.locationType),
    canIssue: Boolean(location.canIssue),
    canReceive: Boolean(location.canReceive),
    canProduce: Boolean(location.canProduce),
    canSell: Boolean(location.canSell),
    isActive: Boolean(location.isActive ?? true),
  };
}

function uniqueLocations(locations: LocationOption[]): LocationOption[] {
  const seen = new Set<string>();
  return locations.filter((location) => {
    if (!location.id || !location.name || seen.has(location.id)) return false;
    seen.add(location.id);
    return true;
  });
}

function resetStockFields(line: SIVLine, message = ""): SIVLine {
  return {
    ...line,
    availableQty: undefined,
    availableBaseQty: undefined,
    batchNo: "",
    expiryDate: "",
    selectedFifoKey: "",
    fifoOptions: [],
    loadingFifo: false,
    loadingAvailability: false,
    lineError: message,
  };
}

function defaultDestinationId(
  locations: LocationOption[],
  currentLocationId?: Nullable<string>,
): string {
  if (currentLocationId && locations.some((location) => location.id === currentLocationId)) {
    return currentLocationId;
  }
  return locations.length === 1 ? locations[0].id : "";
}

function hasDuplicateLines(lines: SIVLine[]): boolean {
  const seen = new Set<string>();

  for (const line of lines) {
    const key = `${line.itemId}|${line.uomId}|${line.batchNo || "no-batch"}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }

  return false;
}

function validateDraft(args: {
  companyId: string;
  branchId: string;
  fromLocationId: string;
  toLocationId: string;
  selectedLines: SIVLine[];
}): ValidationResult {
  const { companyId, branchId, fromLocationId, toLocationId, selectedLines } = args;

  if (!companyId) return { ok: false, message: "Missing company scope." };
  if (!branchId) return { ok: false, message: "Missing branch scope. Please select a branch before creating an SIV." };
  if (!fromLocationId) return { ok: false, message: "SIV source warehouse is required." };
  if (!toLocationId) return { ok: false, message: DESTINATION_REQUIRED_MESSAGE };
  if (fromLocationId === toLocationId) return { ok: false, message: "SIV source and destination locations cannot be the same." };
  if (!selectedLines.length) return { ok: false, message: "At least one line is required." };
  if (selectedLines.some((line) => !line.uomId)) return { ok: false, message: "UOM is required. Please reselect the affected item." };
  if (selectedLines.some((line) => num(line.qty) <= 0)) return { ok: false, message: "Quantity must be greater than zero." };

  const overStock = selectedLines.some((line) => {
    const available = line.availableQty ?? line.availableBaseQty;
    return available != null && num(line.qty) > available;
  });

  if (overStock) return { ok: false, message: "Requested quantity cannot exceed available warehouse stock." };

  const lineWithError = selectedLines.find((line) => Boolean(line.lineError));
  if (lineWithError) return { ok: false, message: lineWithError.lineError || "Resolve line errors before saving." };

  if (hasDuplicateLines(selectedLines)) return { ok: false, message: "Duplicate item + batch + UOM combinations are not allowed." };

  return { ok: true };
}

function getDraftFifoSourceNumber(line: DraftLineLike): string | null {
  return (
    nullableText(line.grnNumber) ??
    nullableText(line.receiptNumber) ??
    nullableText(line.documentNumber) ??
    nullableText(line.sourceNumber)
  );
}

function mapDraftLine(line: DraftLineLike): SIVLine {
  const itemIdValue = text(line.itemId ?? line.inventoryItemId);
  const itemNameValue = text(line.itemName ?? line.inventoryItemName);
  const uomIdValue = text(line.uomId ?? line.baseUomId);
  const uomCodeValue = text(line.uomCode ?? line.baseUomCode);
  const qtyValue = num(line.qty ?? line.quantity, 0);
  const savedQty = qtyValue > 0 ? qtyValue : 0;
  const savedAvailableQty = num(line.availableQty ?? line.availableBaseQty ?? savedQty, savedQty);
  const savedAvailableBaseQty = num(line.availableBaseQty ?? line.availableQty ?? savedQty, savedQty);

  const fifoOption: FifoIssueCandidateDto = {
    fifoLayerId: text(line.fifoLayerId ?? line.inventoryLayerId),
    sourceId: nullableText(line.sourceId),
    sourceNumber: getDraftFifoSourceNumber(line),
    grnNumber: nullableText(line.grnNumber),
    receiptNumber: nullableText(line.receiptNumber),
    documentNumber: nullableText(line.documentNumber),
    itemId: itemIdValue,
    itemName: itemNameValue,
    uomId: uomIdValue,
    uomCode: uomCodeValue,
    batchNo: nullableText(line.batchNo),
    expiryDate: nullableText(line.expiryDate),
    availableQty: savedAvailableQty,
    availableBaseQty: savedAvailableBaseQty,
    receivedDate: text(line.receivedDate),
  };

  const hasFifo = Boolean(
    fifoOption.fifoLayerId ||
      fifoOption.sourceId ||
      fifoOption.sourceNumber ||
      fifoOption.batchNo ||
      fifoOption.expiryDate ||
      fifoOption.receivedDate,
  );

  const fifoOptions = hasFifo ? withUniqueFifoKeys([fifoOption]) : [];
  const selectedFifoKey = fifoOptions[0]?.__fifoOptionKey ?? "";

  return {
    key: text(line.key ?? line.id) || makeKey(),
    id: nullableText(line.id),
    itemId: itemIdValue,
    itemName: itemNameValue,
    uomId: uomIdValue,
    uomCode: uomCodeValue,
    qty: qtyValue > 0 ? qtyValue : "",
    remarks: text(line.remarks ?? line.notes),
    availableQty: savedAvailableQty,
    availableBaseQty: savedAvailableBaseQty,
    batchNo: text(line.batchNo),
    expiryDate: dateOnly(line.expiryDate ?? line.receivedDate),
    selectedFifoKey,
    fifoOptions,
    loadingFifo: false,
    loadingAvailability: false,
    lineError: "",
  };
}

export function useSivScreenController({
  companyId,
  branchId,
  departmentId,
  currentLocationId,
  requestedByUserId,
}: Args) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [fromLocations, setFromLocations] = useState<LocationOption[]>([]);
  const [toLocations, setToLocations] = useState<LocationOption[]>([]);
  const [selectedFromLocationId, setSelectedFromLocationIdState] = useState("");
  const [selectedToLocationId, setSelectedToLocationIdState] = useState("");

  const [issueDate, setIssueDate] = useState(defaultIssueDate);
  const [notes, setNotes] = useState("");
  const [rowVersion, setRowVersion] = useState<string | null>(null);
  const [lines, setLines] = useState<SIVLine[]>([makeEmptyLine()]);

  const fifoRequestIds = useRef<Record<string, string>>({});

  const replaceLine = useCallback((key: string, patch: Partial<SIVLine>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }, []);

  const setSelectedFromLocationId = useCallback((locationId: string) => {
    setSelectedFromLocationIdState(locationId);
    setError("");
    setSuccess("");
    fifoRequestIds.current = {};
    setLines((prev) =>
      prev.map((line) =>
        resetStockFields(
          line,
          line.itemId ? "Warehouse changed. Please reselect this item to reload FIFO stock." : "",
        ),
      ),
    );
  }, []);

  const setSelectedToLocationId = useCallback((locationId: string) => {
    setSelectedToLocationIdState(locationId);
    setError("");
    setSuccess("");
  }, []);

  const loadLocations = useCallback(async () => {
    if (!companyId) {
      setFromLocations([]);
      setToLocations([]);
      setSelectedFromLocationIdState("");
      setSelectedToLocationIdState("");
      return;
    }

    const [fromResponse, toResponse] = await Promise.all([
      sivApi.getIssueLocations(companyId, branchId || undefined),
      sivApi.getConsumptionLocations(companyId, branchId || undefined),
    ]);

    const from = uniqueLocations(
      (fromResponse as Array<Partial<LocationOption> & Record<string, unknown>>).map(normalizeLocation),
    );

    let to = uniqueLocations(
      (toResponse as Array<Partial<LocationOption> & Record<string, unknown>>).map(normalizeLocation),
    );

    if (to.length === 0 && currentLocationId) {
      to = [
        {
          id: currentLocationId,
          name: "Current location",
          code: null,
          canReceive: true,
          canIssue: false,
          canSell: false,
          canProduce: false,
          isActive: true,
        },
      ];
    }

    setFromLocations(from);
    setToLocations(to);

    setSelectedFromLocationIdState((prev) => {
      if (prev && from.some((location) => location.id === prev)) return prev;
      return from.length === 1 ? from[0].id : "";
    });

    setSelectedToLocationIdState((prev) => {
      if (prev && to.some((location) => location.id === prev)) return prev;
      return defaultDestinationId(to, currentLocationId);
    });
  }, [companyId, branchId, currentLocationId]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        setLoading(true);
        setError("");
        await loadLocations();
      } catch (e) {
        if (active) setError(apiError(e, "Failed to load SIV screen."));
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadLocations]);

  const addLine = useCallback(() => {
    setError("");
    setSuccess("");
    setLines((prev) => [...prev, makeEmptyLine()]);
  }, []);

  const removeLine = useCallback((key: string) => {
    setError("");
    setSuccess("");
    delete fifoRequestIds.current[key];

    setLines((prev) => {
      const next = prev.filter((line) => line.key !== key);
      return next.length ? next : [makeEmptyLine()];
    });
  }, []);

  const updateLine = useCallback(
    <K extends keyof SIVLine>(key: string, field: K, value: SIVLine[K]) => {
      setError("");
      setSuccess("");
      setLines((prev) => prev.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
    },
    [],
  );

  const searchInventoryItems = useCallback(
    async (term: string): Promise<InventoryItemSearchResult[]> => {
      if (!companyId || !selectedFromLocationId) return [];

      const items = await sivApi.searchInventoryItems(companyId, {
        branchId: branchId || undefined,
        locationId: selectedFromLocationId,
        q: term.trim() || undefined,
      });

      return (items as Array<Partial<InventoryItemSearchResult> & Record<string, unknown>>)
        .map(normalizeInventoryItem)
        .filter((item) => item.id && item.name && item.uomId && item.isActive);
    },
    [companyId, branchId, selectedFromLocationId],
  );

  const onPickItem = useCallback(
    async (key: string, itemOrPatch: Partial<InventoryItemSearchResult> & Record<string, unknown>) => {
      const pickedItemId = itemId(itemOrPatch);
      const pickedItemName = itemName(itemOrPatch);
      const pickedUomId = itemUomId(itemOrPatch);
      const pickedUomCode = itemUomCode(itemOrPatch);
      const requestId = makeKey();

      fifoRequestIds.current[key] = requestId;

      replaceLine(key, {
        itemId: pickedItemId,
        itemName: pickedItemName,
        uomId: pickedUomId,
        uomCode: pickedUomCode,
        qty: "",
        remarks: "",
        availableQty: undefined,
        availableBaseQty: undefined,
        batchNo: "",
        expiryDate: "",
        selectedFifoKey: "",
        fifoOptions: [],
        loadingFifo: false,
        loadingAvailability: false,
        lineError: pickedItemId && !pickedUomId ? "Selected item has no UOM." : "",
      });

      if (!pickedItemId) return;

      if (!selectedFromLocationId) {
        replaceLine(key, {
          lineError: "Please select a warehouse before selecting an item.",
        });
        return;
      }

      if (!pickedUomId) return;

      replaceLine(key, {
        loadingFifo: true,
        loadingAvailability: true,
        lineError: "",
      });

      try {
        const lots = withUniqueFifoKeys(sortFifoLots(await sivApi.getItemFifoLots(companyId, pickedItemId, selectedFromLocationId)));

        if (fifoRequestIds.current[key] !== requestId) return;

        const first = lots[0];

        replaceLine(key, {
          fifoOptions: lots,
          selectedFifoKey: first?.__fifoOptionKey ?? "",
          batchNo: first?.batchNo ?? "",
          expiryDate: dateOnly(first?.expiryDate ?? first?.receivedDate),
          availableQty: first ? num(first.availableQty ?? first.availableBaseQty) : undefined,
          availableBaseQty: first ? num(first.availableBaseQty ?? first.availableQty) : undefined,
          loadingFifo: false,
          loadingAvailability: false,
          lineError: lots.length ? "" : "No FIFO stock available at this warehouse.",
        });
      } catch (e) {
        if (fifoRequestIds.current[key] !== requestId) return;

        replaceLine(key, {
          loadingFifo: false,
          loadingAvailability: false,
          lineError: apiError(e, "Failed to load FIFO lots."),
        });
      }
    },
    [companyId, selectedFromLocationId, replaceLine],
  );

  const onChangeFifo = useCallback((key: string, selectedKey: string) => {
    setError("");
    setSuccess("");

    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;

        const selected = line.fifoOptions.find((option) => option.__fifoOptionKey === selectedKey);

        if (!selected) {
          return {
            ...line,
            selectedFifoKey: "",
            batchNo: "",
            expiryDate: "",
            availableQty: undefined,
            availableBaseQty: undefined,
          };
        }

        return {
          ...line,
          selectedFifoKey: selected.__fifoOptionKey,
          batchNo: selected.batchNo ?? "",
          expiryDate: dateOnly(selected.expiryDate ?? selected.receivedDate),
          availableQty: num(selected.availableQty ?? selected.availableBaseQty),
          availableBaseQty: num(selected.availableBaseQty ?? selected.availableQty),
          lineError: "",
        };
      }),
    );
  }, []);

  const setLinesFromDraft = useCallback((draftLines: DraftLineLike[]) => {
    setLines(draftLines.length ? draftLines.map(mapDraftLine) : [makeEmptyLine()]);
  }, []);

  const hydrateDraft = useCallback(
    (draftInput?: Partial<SivDetailsDto> | null) => {
      if (!draftInput) return;

      setRowVersion(draftInput.rowVersion ?? null);
      setSelectedFromLocationIdState(text(draftInput.fromLocationId));
      setSelectedToLocationIdState(text(draftInput.toLocationId ?? currentLocationId));
      setIssueDate(dateOnly(draftInput.issueDate) || defaultIssueDate());
      setNotes(text(draftInput.remarks));
      setLinesFromDraft(Array.isArray(draftInput.lines) ? draftInput.lines : []);
    },
    [currentLocationId, setLinesFromDraft],
  );

  const selectedLines = useMemo(() => lines.filter((line) => Boolean(line.itemId)), [lines]);

  const validation = useMemo(
    () =>
      validateDraft({
        companyId,
        branchId,
        fromLocationId: selectedFromLocationId,
        toLocationId: selectedToLocationId,
        selectedLines,
      }),
    [companyId, branchId, selectedFromLocationId, selectedToLocationId, selectedLines],
  );

  const buildRequest = useCallback((): CreateSivDraftRequest | null => {
    setError("");

    const result = validateDraft({
      companyId,
      branchId,
      fromLocationId: selectedFromLocationId,
      toLocationId: selectedToLocationId,
      selectedLines,
    });

    if (!result.ok) {
      setError(result.message ?? "Resolve validation errors before saving.");
      return null;
    }

    return {
      companyId,
      branchId,
      departmentId: departmentId ?? null,
      requestedByUserId: requestedByUserId ?? null,
      fromLocationId: selectedFromLocationId,
      toLocationId: selectedToLocationId,
      issueDate,
      remarks: notes.trim() || null,
      lines: selectedLines.map((line) => ({
        itemId: line.itemId,
        uomId: line.uomId,
        qty: num(line.qty),
        remarks: line.remarks.trim() || null,
        batchNo: line.batchNo || null,
        expiryDate: line.expiryDate || null,
      })),
    };
  }, [
    companyId,
    branchId,
    departmentId,
    requestedByUserId,
    issueDate,
    notes,
    selectedFromLocationId,
    selectedToLocationId,
    selectedLines,
  ]);

  const createDraft = useCallback(async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const request = buildRequest();

      if (!request) {
        return null;
      }

      const created = await sivApi.createDraft(
        companyId,
        branchId,
        request,
      );

      setSuccess("SIV draft created.");
      return created;
    } catch (e) {
      setError(apiError(e, "Failed to create SIV draft."));
      return null;
    } finally {
      setSaving(false);
    }
  }, [branchId, buildRequest, companyId]);

  const updateDraft = useCallback(
    async (draftId: string) => {
      setSaving(true);
      setError("");
      setSuccess("");

      try {
        const request = buildRequest();

        if (!request) {
          return null;
        }

        const updateRequest: UpdateSivDraftRequest = {
          ...request,
          sivId: draftId,
          rowVersion,
        };

        const updated = await sivApi.updateDraft(
          companyId,
          branchId,
          draftId,
          updateRequest,
        );

        setSuccess("SIV draft saved.");
        return updated;
      } catch (e) {
        setError(apiError(e, "Failed to save SIV draft."));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [branchId, buildRequest, companyId, rowVersion],
  );

  return {
    loading,
    saving,
    error,
    success,

    fromLocations,
    toLocations,
    selectedFromLocationId,
    selectedToLocationId,
    setSelectedFromLocationId,
    setSelectedToLocationId,

    issueDate,
    setIssueDate,
    notes,
    setNotes,
    rowVersion,

    lines,
    addLine,
    removeLine,
    replaceLine,
    updateLine,
    setLinesFromDraft,
    hydrateDraft,

    selectedLines,
    canSaveDraft: validation.ok,
    validationMessage: validation.message ?? "",

    searchInventoryItems,
    onPickItem,
    onChangeFifo,

    createDraft,
    updateDraft,
  };
}
