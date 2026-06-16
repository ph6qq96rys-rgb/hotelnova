// src/features/inventory/siv/hooks/useSivScreenController.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  sivApi,
  type CreateSivDraftRequest,
  type FifoIssueCandidateDto,
  type InventoryItemSearchResult,
  type LocationOption,
} from "../api/sivApi";

const DESTINATION_REQUIRED_MESSAGE =
  "SIV destination location is required. Select Kitchen, Bar, Coffee Bar, or another consumption location.";

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
  fifoOptions: FifoIssueCandidateDto[];
  loadingFifo: boolean;
  loadingAvailability: boolean;
  lineError: string;
};

type Args = {
  companyId: string;
  branchId: string;
  departmentId?: string | null;
  currentLocationId?: string | null;
};

function makeEmptyLine(): SIVLine {
  return {
    key: crypto.randomUUID(),
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

function unwrapData<T>(response: unknown): T {
  const r = response as any;
  return (r?.data ?? r) as T;
}

function unwrapArray<T>(response: unknown): T[] {
  const data = (response as any)?.data ?? response;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.value)) return data.value;

  return [];
}

function normalizeDate(value: unknown): string {
  if (!value) return "";

  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function getApiError(e: unknown, fallback: string): string {
  const err = e as any;
  const data = err?.response?.data;

  if (typeof data === "string") return data;

  return (
    data?.error ??
    data?.Error ??
    data?.message ??
    data?.title ??
    err?.message ??
    fallback
  );
}

function makeFifoKey(opt: Partial<FifoIssueCandidateDto>): string {
  return [
    opt.fifoLayerId || opt.sourceId || "no-source",
    opt.batchNo || "no-batch",
    opt.expiryDate || "no-exp",
  ].join("|");
}

function getItemId(item: any): string {
  return String(item?.itemId ?? item?.id ?? item?.inventoryItemId ?? "");
}

function getItemName(item: any): string {
  return String(
    item?.itemName ??
      item?.name ??
      item?.inventoryItemName ??
      item?.description ??
      "",
  );
}

function getItemUomId(item: any): string {
  return String(item?.uomId ?? item?.baseUomId ?? item?.unitOfMeasureId ?? "");
}

function getItemUomCode(item: any): string {
  return String(
    item?.uomCode ?? item?.baseUomCode ?? item?.unitOfMeasureCode ?? "",
  );
}

function normalizeInventoryItem(item: any): InventoryItemSearchResult {
  return {
    ...item,
    id: getItemId(item),
    name: getItemName(item),
    uomId: getItemUomId(item),
    uomCode: getItemUomCode(item),
    baseUomId: item?.baseUomId ?? getItemUomId(item),
    baseUomCode: item?.baseUomCode ?? getItemUomCode(item),
    sku: item?.sku ?? null,
    barcode: item?.barcode ?? null,
    isActive: Boolean(item?.isActive ?? true),
  };
}

function normalizeLocation(location: any): LocationOption {
  return {
    id: String(location?.id ?? location?.locationId ?? ""),
    name: String(
      location?.name ?? location?.locationName ?? location?.code ?? "",
    ),
    code: location?.code ?? null,
    locationType: location?.locationType ?? null,
    canIssue: location?.canIssue ?? null,
    canReceive: location?.canReceive ?? null,
    canProduce: location?.canProduce ?? null,
    canSell: location?.canSell ?? null,
  };
}

function uniqueLocations(locations: LocationOption[]): LocationOption[] {
  const seen = new Set<string>();
  return locations.filter((x) => {
    if (!x.id || seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}

function resetLineStockFields(line: SIVLine, message = ""): SIVLine {
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

function resolveDefaultDestinationId(
  locations: LocationOption[],
  currentLocationId?: string | null,
): string {
  if (currentLocationId && locations.some((x) => x.id === currentLocationId))
    return currentLocationId;
  if (locations.length === 1) return locations[0].id;
  return "";
}

export function useSivScreenController({
  companyId,
  branchId,
  departmentId,
  currentLocationId,
}: Args) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [fromLocations, setFromLocations] = useState<LocationOption[]>([]);
  const [toLocations, setToLocations] = useState<LocationOption[]>([]);
  const [selectedFromLocationId, setSelectedFromLocationIdState] = useState("");
  const [selectedToLocationId, setSelectedToLocationIdState] = useState("");

  const [issueDate, setIssueDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<SIVLine[]>([makeEmptyLine()]);

  const replaceLine = useCallback((key: string, patch: Partial<SIVLine>) => {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }, []);

  const setSelectedFromLocationId = useCallback((locationId: string) => {
    setSelectedFromLocationIdState(locationId);
    setLines((prev) =>
      prev.map((line) =>
        resetLineStockFields(
          line,
          line.itemId
            ? "Warehouse changed. Please reselect this item to reload FIFO stock."
            : "",
        ),
      ),
    );
  }, []);

  const setSelectedToLocationId = useCallback((locationId: string) => {
    setSelectedToLocationIdState(locationId);
    setError("");
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
      unwrapArray<LocationOption>(fromResponse).map(normalizeLocation),
    );
    let to = uniqueLocations(
      unwrapArray<LocationOption>(toResponse).map(normalizeLocation),
    );

    // Fallback for older APIs that do not yet support destination filtering.
    if (to.length === 0 && currentLocationId) {
      to = [
        {
          id: currentLocationId,
          name: "Current location",
          code: null,
          canReceive: true,
        },
      ];
    }

    setFromLocations(from);
    setToLocations(to);

    setSelectedFromLocationIdState((prev) => {
      if (prev && from.some((x) => x.id === prev)) return prev;
      return from.length === 1 ? from[0].id : "";
    });

    setSelectedToLocationIdState((prev) => {
      if (prev && to.some((x) => x.id === prev)) return prev;
      return resolveDefaultDestinationId(to, currentLocationId);
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
        if (active) setError(getApiError(e, "Failed to load SIV screen."));
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadLocations]);

  const addLine = useCallback(
    () => setLines((prev) => [...prev, makeEmptyLine()]),
    [],
  );

  const removeLine = useCallback((key: string) => {
    setLines((prev) => {
      const next = prev.filter((x) => x.key !== key);
      return next.length ? next : [makeEmptyLine()];
    });
  }, []);

  const updateLine = useCallback(
    <K extends keyof SIVLine>(key: string, field: K, value: SIVLine[K]) => {
      setLines((prev) =>
        prev.map((line) =>
          line.key === key ? { ...line, [field]: value } : line,
        ),
      );
    },
    [],
  );

  const searchInventoryItems = useCallback(
    async (term: string) => {
      if (!companyId || !selectedFromLocationId) return [];

      const response = await sivApi.searchInventoryItems(companyId, {
        branchId: branchId || undefined,
        locationId: selectedFromLocationId,
        q: term.trim() || undefined,
      });

      return unwrapArray<InventoryItemSearchResult>(response).map(
        normalizeInventoryItem,
      );
    },
    [companyId, branchId, selectedFromLocationId],
  );

  const onPickItem = useCallback(
    async (key: string, itemOrPatch: any) => {
      const itemId = getItemId(itemOrPatch);
      const itemName = getItemName(itemOrPatch);
      const uomId = getItemUomId(itemOrPatch);
      const uomCode = getItemUomCode(itemOrPatch);

      replaceLine(key, {
        itemId,
        itemName,
        uomId,
        uomCode,
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
        lineError: itemId && !uomId ? "Selected item has no UOM." : "",
      });

      if (!itemId) return;

      if (!selectedFromLocationId) {
        replaceLine(key, {
          lineError: "Please select a warehouse before selecting an item.",
        });
        return;
      }

      if (!uomId) return;

      replaceLine(key, {
        loadingFifo: true,
        loadingAvailability: true,
        lineError: "",
      });

      try {
        const response = await sivApi.getItemFifoLots(
          companyId,
          itemId,
          selectedFromLocationId,
        );
        const lots = unwrapArray<FifoIssueCandidateDto>(response);
        const first = lots[0];

        const totalAvailable = lots.reduce(
          (sum, lot) =>
            sum + Number(lot.availableQty ?? lot.availableBaseQty ?? 0),
          0,
        );

        const totalAvailableBase = lots.reduce(
          (sum, lot) =>
            sum + Number(lot.availableBaseQty ?? lot.availableQty ?? 0),
          0,
        );

        replaceLine(key, {
          fifoOptions: lots,
          selectedFifoKey: first ? makeFifoKey(first) : "",
          batchNo: first?.batchNo ?? "",
          expiryDate: normalizeDate(first?.expiryDate),
          availableQty: totalAvailable,
          availableBaseQty: totalAvailableBase,
          loadingFifo: false,
          loadingAvailability: false,
          lineError: lots.length
            ? ""
            : "No FIFO stock available at this warehouse.",
        });
      } catch (e) {
        replaceLine(key, {
          loadingFifo: false,
          loadingAvailability: false,
          lineError: getApiError(e, "Failed to load FIFO lots."),
        });
      }
    },
    [companyId, selectedFromLocationId, replaceLine],
  );

  const onChangeFifo = useCallback((key: string, selectedKey: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;

        const selected = line.fifoOptions.find(
          (opt) => makeFifoKey(opt) === selectedKey,
        );
        if (!selected) {
          return { ...line, selectedFifoKey: "", batchNo: "", expiryDate: "" };
        }

        return {
          ...line,
          selectedFifoKey: selectedKey,
          batchNo: selected.batchNo ?? "",
          expiryDate: normalizeDate(selected.expiryDate),
          availableQty: selected.availableQty,
          availableBaseQty: selected.availableBaseQty ?? selected.availableQty,
          lineError: "",
        };
      }),
    );
  }, []);

  const setLinesFromDraft = useCallback(
    (draftLines: Record<string, unknown>[]) => {
      const mapped: SIVLine[] = draftLines.map((x) => {
        const fifoOpt: FifoIssueCandidateDto = {
          fifoLayerId: String(x.fifoLayerId ?? x.inventoryLayerId ?? ""),
          sourceId: (x.sourceId as string | null) ?? null,
          sourceNumber: (x.sourceNumber as string | null) ?? "Saved FIFO",
          itemId: String(x.itemId ?? ""),
          itemName: String(x.itemName ?? x.inventoryItemName ?? ""),
          uomId: String(x.uomId ?? x.baseUomId ?? ""),
          uomCode: String(x.uomCode ?? x.baseUomCode ?? ""),
          batchNo: (x.batchNo as string | null) ?? null,
          expiryDate: (x.expiryDate as string | null) ?? null,
          availableQty: Number(x.availableQty ?? x.qty ?? 0),
          availableBaseQty: Number(x.availableBaseQty ?? x.qty ?? 0),
          receivedDate: String(x.receivedDate ?? ""),
        };

        const hasFifo = Boolean(
          fifoOpt.fifoLayerId ||
          fifoOpt.sourceId ||
          fifoOpt.batchNo ||
          fifoOpt.expiryDate,
        );

        return {
          key: String(x.id ?? crypto.randomUUID()),
          id: (x.id as string | null) ?? null,
          itemId: String(x.itemId ?? ""),
          itemName: String(x.itemName ?? x.inventoryItemName ?? ""),
          uomId: String(x.uomId ?? x.baseUomId ?? ""),
          uomCode: String(x.uomCode ?? x.baseUomCode ?? ""),
          qty: Number(x.qty ?? x.quantity ?? "") || "",
          remarks: String(x.remarks ?? x.notes ?? ""),
          availableQty: Number(x.availableQty ?? 0),
          availableBaseQty: Number(x.availableBaseQty ?? x.availableQty ?? 0),
          batchNo: String(x.batchNo ?? ""),
          expiryDate: normalizeDate(x.expiryDate),
          selectedFifoKey: hasFifo ? makeFifoKey(fifoOpt) : "",
          fifoOptions: hasFifo ? [fifoOpt] : [],
          loadingFifo: false,
          loadingAvailability: false,
          lineError: "",
        };
      });

      setLines(mapped.length ? mapped : [makeEmptyLine()]);
    },
    [],
  );

  const hydrateDraft = useCallback(
    (draftInput: Record<string, unknown>) => {
      const draft = unwrapData<Record<string, unknown>>(draftInput);
      if (!draft) return;

      setSelectedFromLocationIdState(
        String(draft.fromLocationId ?? draft.locationId ?? ""),
      );
      setSelectedToLocationIdState(
        String(draft.toLocationId ?? currentLocationId ?? ""),
      );
      setIssueDate(
        normalizeDate(draft.issueDate) || new Date().toISOString().slice(0, 10),
      );
      setNotes(String(draft.remarks ?? draft.notes ?? ""));

      const draftLines =
        draft.lines ??
        draft.sivLines ??
        draft.issueLines ??
        draft.lineItems ??
        draft.items ??
        draft.details ??
        draft.documentLines ??
        [];

      setLinesFromDraft(Array.isArray(draftLines) ? (draftLines as any[]) : []);
    },
    [currentLocationId, setLinesFromDraft],
  );

  const selectedLines = useMemo(
    () => lines.filter((line) => Boolean(line.itemId)),
    [lines],
  );

  const canSaveDraft = useMemo(() => {
    if (!selectedFromLocationId) return false;
    if (!selectedToLocationId) return false;
    if (selectedLines.length === 0) return false;

    return selectedLines.every(
      (line) =>
        Boolean(line.itemId) &&
        Boolean(line.uomId) &&
        Number(line.qty || 0) > 0 &&
        !line.lineError,
    );
  }, [selectedFromLocationId, selectedToLocationId, selectedLines]);

  const buildRequest = useCallback((): CreateSivDraftRequest | null => {
    setError("");

    if (!companyId) {
      setError("Missing company scope.");
      return null;
    }

    if (!branchId) {
      setError(
        "Missing branch scope. Please select a branch before creating an SIV.",
      );
      return null;
    }

    if (!selectedFromLocationId) {
      setError("SIV source warehouse is required.");
      return null;
    }

    if (!selectedToLocationId) {
      setError(DESTINATION_REQUIRED_MESSAGE);
      return null;
    }

    if (selectedFromLocationId === selectedToLocationId) {
      setError("SIV source and destination locations cannot be the same.");
      return null;
    }

    if (!selectedLines.length) {
      setError("At least one line is required.");
      return null;
    }

    const noUom = selectedLines.find((line) => !line.uomId);
    if (noUom) {
      setError("UOM is required. Please reselect the affected item.");
      return null;
    }

    const zeroQty = selectedLines.find((line) => Number(line.qty || 0) <= 0);
    if (zeroQty) {
      setError("Quantity must be greater than zero.");
      return null;
    }

    const lineWithError = selectedLines.find((line) => Boolean(line.lineError));
    if (lineWithError) {
      setError(lineWithError.lineError || "Resolve line errors before saving.");
      return null;
    }

    return {
      companyId,
      branchId,
      departmentId: departmentId ?? null,
      fromLocationId: selectedFromLocationId,
      toLocationId: selectedToLocationId,
      issueDate,
      remarks: notes || null,
      lines: selectedLines.map((line) => ({
        itemId: line.itemId,
        uomId: line.uomId,
        qty: Number(line.qty || 0),
        remarks: line.remarks || null,
        batchNo: line.batchNo || null,
        expiryDate: line.expiryDate || null,
      })),
    };
  }, [
    companyId,
    branchId,
    departmentId,
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
      if (!request) return null;

      const response = await sivApi.createDraft(companyId, request);
      const created = unwrapData<any>(response);

      setSuccess("SIV draft created.");
      return created;
    } catch (e) {
      setError(getApiError(e, "Failed to create SIV draft."));
      return null;
    } finally {
      setSaving(false);
    }
  }, [buildRequest, companyId]);

  const updateDraft = useCallback(
    async (_draftId: string) => {
      setSaving(true);
      setError("");
      setSuccess("");

      try {
        const request = buildRequest();
        if (!request) return null;

        // Replace this with sivApi.updateDraft(...) when your backend PATCH/PUT exists.
        const response = await sivApi.createDraft(companyId, request);
        const updated = unwrapData<any>(response);

        setSuccess("SIV draft saved.");
        return updated;
      } catch (e) {
        setError(getApiError(e, "Failed to save SIV draft."));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [buildRequest, companyId],
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

    lines,
    addLine,
    removeLine,
    replaceLine,
    updateLine,
    setLinesFromDraft,
    hydrateDraft,

    selectedLines,
    canSaveDraft,

    searchInventoryItems,
    onPickItem,
    onChangeFifo,

    createDraft,
    updateDraft,
  };
}
