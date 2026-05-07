import { useCallback, useEffect, useMemo, useState } from "react";
import {
  sivApi,
  type CreateSivDraftRequest,
  type FifoIssueCandidateDto,
  type InventorySearchItemDto,
} from "../api/sivApi";

type UseSivScreenControllerArgs = {
  companyId: string;
  branchId: string;
  departmentId?: string | null;
  currentLocationId?: string | null;
};

type LookupOption = {
  id: string;
  name: string;
  code?: string | null;
};

export type SIVLine = {
  key: string;
  id?: string | null;
  itemId: string;
  itemName?: string;
  uomId?: string;
  uomCode?: string;
  qty: number | "";
  remarks: string;
  availableQty?: number;
  availableBaseQty?: number;
  batchNo?: string;
  expiryDate?: string;
  selectedFifoKey?: string;
  fifoOptions?: FifoIssueCandidateDto[];
  loadingFifo?: boolean;
  loadingAvailability?: boolean;
  lineError?: string;
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

function makeFifoKey(opt: Partial<FifoIssueCandidateDto>): string {
  return [
    opt.fifoLayerId || opt.sourceId || "no-source",
    opt.batchNo || "no-batch",
    opt.expiryDate || "no-exp",
  ].join("|");
}

function normalizeDate(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function useSivScreenController({
  companyId,
  branchId,
  departmentId,
  currentLocationId,
}: UseSivScreenControllerArgs) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [branchName, setBranchName] = useState("");

  const [fromLocations, setFromLocations] = useState<LookupOption[]>([]);
  const [selectedFromLocationId, setSelectedFromLocationId] = useState(
    currentLocationId ?? ""
  );

  const [issueDate, setIssueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<SIVLine[]>([makeEmptyLine()]);

  const companyDisplay = useMemo(() => {
    if (companyName && companyId) return `${companyName} (${companyId})`;
    return companyName || companyId || "";
  }, [companyName, companyId]);

  const branchDisplay = useMemo(() => {
    if (branchName && branchId) return `${branchName} (${branchId})`;
    return branchName || branchId || "";
  }, [branchName, branchId]);

  const loadHeaderMeta = useCallback(async () => {
    setCompanyName(companyId);
    setBranchName(branchId);
  }, [companyId, branchId]);

  const loadFromLocations = useCallback(async () => {
    try {
      const data = await sivApi.getStockLocations(companyId, branchId);

      const mapped: LookupOption[] = (data || []).map((x: any) => ({
        id: x.id,
        name: x.name,
        code: x.code ?? null,
      }));

      setFromLocations(mapped);

      setSelectedFromLocationId((prev) => {
        if (prev && mapped.some((x) => x.id === prev)) return prev;
        if (currentLocationId && mapped.some((x) => x.id === currentLocationId)) {
          return currentLocationId;
        }
        return mapped[0]?.id ?? "";
      });
    } catch {
      setFromLocations([]);
    }
  }, [companyId, branchId, currentLocationId]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        setLoading(true);
        setError("");

        await Promise.all([loadHeaderMeta(), loadFromLocations()]);

        if (!active) return;
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load SIV screen.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadHeaderMeta, loadFromLocations]);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, makeEmptyLine()]);
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => {
      const next = prev.filter((x) => x.key !== key);
      return next.length ? next : [makeEmptyLine()];
    });
  }, []);

  const replaceLine = useCallback((key: string, patch: Partial<SIVLine>) => {
    setLines((prev) =>
      prev.map((line) =>
        line.key === key
          ? {
              ...line,
              ...patch,
            }
          : line
      )
    );
  }, []);

  const updateLine = useCallback(
    <K extends keyof SIVLine>(key: string, field: K, value: SIVLine[K]) => {
      setLines((prev) =>
        prev.map((line) =>
          line.key === key
            ? {
                ...line,
                [field]: value,
              }
            : line
        )
      );
    },
    []
  );

  const searchInventoryItems = useCallback(
    async (term: string): Promise<InventorySearchItemDto[]> => {
      if (!selectedFromLocationId) return [];

      return await sivApi.searchInventoryItems(companyId, {
        q: term.trim() || undefined,
        branchId: branchId || undefined,
        locationId: selectedFromLocationId || undefined,
        activeOnly: true,
      });
    },
    [companyId, branchId, selectedFromLocationId]
  );

  const onPickItem = useCallback(
    async (
      key: string,
      patch: {
        itemId: string;
        itemName?: string;
        uomId?: string|null;
        uomCode?: string|null;
      }
    ) => {
      replaceLine(key, {
        itemId: patch.itemId || "",
        itemName: patch.itemName || "",
        uomId: patch.uomId || "",
        uomCode: patch.uomCode || "",
        qty: "",
        availableQty: undefined,
        availableBaseQty: undefined,
        batchNo: "",
        expiryDate: "",
        selectedFifoKey: "",
        fifoOptions: [],
        loadingFifo: false,
        loadingAvailability: false,
        lineError: patch.itemId && !patch.uomId ? "Selected item has no UOM." : "",
      });

      if (!patch.itemId || !selectedFromLocationId) return;

      try {
        replaceLine(key, {
          loadingFifo: true,
          loadingAvailability: true,
          lineError: "",
        });

        const [fifoOptions, availability] = await Promise.all([
          sivApi.getFifoPreview(companyId, {
            branchId: branchId || undefined,
            locationId: selectedFromLocationId,
            itemId: patch.itemId,
          }),
          sivApi.getAvailability(companyId, {
            branchId: branchId || undefined,
            locationId: selectedFromLocationId,
            itemId: patch.itemId,
          }),
        ]);

        const first = fifoOptions?.[0];

        replaceLine(key, {
          fifoOptions: fifoOptions || [],
          selectedFifoKey: first ? makeFifoKey(first) : "",
          batchNo: first?.batchNo || "",
          expiryDate: first?.expiryDate || "",
          availableQty:
            first?.availableQty ?? availability?.availableQty ?? undefined,
          availableBaseQty:
            first?.availableBaseQty ??
            first?.availableQty ??
            availability?.availableBaseQty ??
            availability?.availableQty ??
            undefined,
          loadingFifo: false,
          loadingAvailability: false,
          lineError: fifoOptions?.length ? "" : "No FIFO stock available.",
        });
      } catch {
        replaceLine(key, {
          loadingFifo: false,
          loadingAvailability: false,
          fifoOptions: [],
          selectedFifoKey: "",
          availableQty: undefined,
          availableBaseQty: undefined,
          lineError: "Failed to load FIFO availability.",
        });
      }
    },
    [replaceLine, companyId, branchId, selectedFromLocationId]
  );

  const onChangeFifo = useCallback((key: string, selectedKey: string) => {
    setLines((prev) =>
      prev.map((line): SIVLine => {
        if (line.key !== key) return line;

        const selected = (line.fifoOptions || []).find(
          (opt) => makeFifoKey(opt) === selectedKey
        );

        return {
          ...line,
          selectedFifoKey: selectedKey,
          batchNo: selected?.batchNo ?? line.batchNo ?? "",
          expiryDate: selected?.expiryDate ?? line.expiryDate ?? "",
          availableQty: selected?.availableQty ?? line.availableQty,
          availableBaseQty:
            selected?.availableBaseQty ??
            selected?.availableQty ??
            line.availableBaseQty ??
            line.availableQty,
          lineError: "",
        };
      })
    );
  }, []);

  const setLinesFromDraft = useCallback((draftLines: any[]) => {
    const mapped: SIVLine[] = (draftLines || []).map((x: any) => {
      const fifoOption = {
        fifoLayerId: x.fifoLayerId ?? x.inventoryLayerId ?? null,
        sourceId: x.sourceId ?? x.grnId ?? x.receiptId ?? null,
        sourceNumber: x.sourceNumber ?? x.grnNumber ?? x.receiptNumber ?? "Saved FIFO",
        batchNo: x.batchNo ?? x.batchNumber ?? null,
        expiryDate: x.expiryDate ?? x.expirationDate ?? null,
        availableQty:
          x.availableQty ??
          x.availableBaseQty ??
          x.qty ??
          x.quantity ??
          0,
        availableBaseQty:
          x.availableBaseQty ??
          x.availableQty ??
          x.qty ??
          x.quantity ??
          0,
        receivedDate: x.receivedDate ?? null,
      } as FifoIssueCandidateDto;

    const hasFifo = Boolean(
      fifoOption.fifoLayerId ||
        fifoOption.sourceId ||
        fifoOption.batchNo ||
        fifoOption.expiryDate
    );

      return {
        key: x.id || crypto.randomUUID(),
        id: x.id ?? null,
        itemId: x.itemId ?? "",
        itemName: x.itemName ?? x.inventoryItemName ?? x.name ?? "",
        uomId: x.uomId ?? x.baseUomId ?? "",
        uomCode: x.uomCode ?? x.baseUomCode ?? "",
        qty: x.qty ?? x.quantity ?? "",
        remarks: x.remarks ?? x.notes ?? "",
        availableQty:
          x.availableQty ?? x.availableBaseQty ?? x.qty ?? x.quantity ?? 0,
        availableBaseQty:
          x.availableBaseQty ?? x.availableQty ?? x.qty ?? x.quantity ?? 0,
        batchNo: x.batchNo ?? "",
        expiryDate: normalizeDate(x.expiryDate),
        fifoOptions: hasFifo ? [fifoOption] : [],
        selectedFifoKey: hasFifo ? makeFifoKey(fifoOption) : "",
        loadingFifo: false,
        loadingAvailability: false,
        lineError: "",
      };
    });

    setLines(mapped.length ? mapped : [makeEmptyLine()]);
  }, []);

const hydrateDraft = useCallback(
  (draft: any) => {
    if (!draft) return;

    setSelectedFromLocationId(
      draft.fromLocationId ??
        draft.locationId ??
        draft.stockLocationId ??
        currentLocationId ??
        ""
    );

    setIssueDate(normalizeDate(draft.issueDate) || issueDate);
    setNotes(draft.notes ?? draft.remarks ?? draft.description ?? "");

    const draftLines =
      draft.lines ??
      draft.sivLines ??
      draft.issueLines ??
      draft.items ??
      draft.details ??
      draft.lineItems ??
      draft.stockIssueVoucherLines ??
      draft.stockIssueLines ??
      [];

    console.log("SIV draft lines detected:", draftLines);

    setLinesFromDraft(Array.isArray(draftLines) ? draftLines : []);
  },
  [currentLocationId, issueDate, setLinesFromDraft]
);

  const selectedLines = useMemo(
    () => lines.filter((x) => x.itemId),
    [lines]
  );

  const canSaveDraft = useMemo(() => {
    if (!selectedFromLocationId) return false;
    if (!selectedLines.length) return false;

    return selectedLines.every(
      (x) => !!x.itemId && !!x.uomId && Number(x.qty || 0) > 0 && !x.lineError
    );
  }, [selectedLines, selectedFromLocationId]);

  const buildRequest = useCallback((): CreateSivDraftRequest | null => {
    if (!selectedFromLocationId) {
      setError("From location is required.");
      return null;
    }

    if (!selectedLines.length) {
      setError("At least one valid line is required.");
      return null;
    }

    const missingUom = selectedLines.find((x) => !x.uomId);
    if (missingUom) {
      setError("UOM is required. Please reselect the affected item.");
      return null;
    }

    const invalidQty = selectedLines.find((x) => Number(x.qty || 0) <= 0);
    if (invalidQty) {
      setError("Quantity must be greater than zero for every selected line.");
      return null;
    }

    const brokenLine = selectedLines.find((x) => !!x.lineError);
    if (brokenLine) {
      setError(brokenLine.lineError || "Please resolve line errors before saving.");
      return null;
    }

    return {
      companyId,
      branchId,
      departmentId: departmentId ?? undefined,
      fromLocationId: selectedFromLocationId,
      issueDate,
      notes,
      lines: selectedLines.map((x) => {
        const selectedFifo = x.fifoOptions?.find(
          (opt) => makeFifoKey(opt) === x.selectedFifoKey
        );

        return {
          id: x.id ?? undefined,
          itemId: x.itemId,
          uomId: x.uomId!,
          qty: Number(x.qty || 0),
          remarks: x.remarks || "",
          batchNo: x.batchNo || undefined,
          expiryDate: x.expiryDate || undefined,
          fifoLayerId: selectedFifo?.fifoLayerId ?? undefined,
          sourceId: selectedFifo?.sourceId ?? undefined,
          sourceNumber: selectedFifo?.sourceNumber ?? undefined,
        } as any;
      }),
    };
  }, [
    companyId,
    branchId,
    departmentId,
    issueDate,
    notes,
    selectedFromLocationId,
    selectedLines,
  ]);

  const createDraft = useCallback(async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const request = buildRequest();
      if (!request) return null;

      const created = await sivApi.createDraft(companyId, request);

      setSuccess("SIV draft created successfully.");
      return created;
    } catch (err: any) {
      setError(err?.message || "Failed to create SIV draft.");
      return null;
    } finally {
      setSaving(false);
    }
  }, [buildRequest, companyId]);

  const updateDraft = useCallback(
  async (draftId: string) => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const request = buildRequest();
      if (!request) return null;

      const fixedRequest = {
        ...request,
        id: draftId,
        sivId: draftId,
        draftId,
        lines: request.lines?.map((line: any) => ({
          ...line,
          sivId: draftId,
        })),
      };

      const updated = await sivApi.updateDraft(companyId, draftId, fixedRequest);

      setSuccess("SIV draft updated successfully.");
      return updated;
    } catch (err: any) {
      setError(
        err?.response?.data?.title ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update SIV draft."
      );
      return null;
    } finally {
      setSaving(false);
    }
  },
  [buildRequest, companyId]
);

  return {
    loading,
    saving,
    error,
    success,

    companyName,
    branchName,
    companyDisplay,
    branchDisplay,

    fromLocations,
    selectedFromLocationId,
    setSelectedFromLocationId,

    issueDate,
    setIssueDate,
    notes,
    setNotes,

    lines,
    setLinesFromDraft,
    hydrateDraft,
    addLine,
    removeLine,
    updateLine,
    replaceLine,

    searchInventoryItems,
    onPickItem,
    onChangeFifo,

    createDraft,
    updateDraft,
    canSaveDraft,
  };
}