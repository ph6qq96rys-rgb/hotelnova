// ─── GRN Custom Hooks ─────────────────────────────────────────────────────────
// ERP-grade hooks for GRN list, detail, draft editor, and reversal workflows.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";

import { grnApi } from "../api/grnApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import { inventoryItemsApi } from "../../../inventoryMaster/items/api/inventoryItemsApi";

import type {
  CreateGrnDraftRequest,
  GrnDetailDto,
  GrnDraft,
  GrnLineDraft,
  GrnListDto,
  ItemVm,
  SelectOption,
} from "../types/grn.types";

import {
  buildItemLabelCache,
  buildUomLabelCache,
  extractApiError,
  normalizeDraftDto,
  toItemVm,
  todayDateOnly,
  trim,
} from "../utils/grn.utils";

const createEmptyGrnLine = (): GrnLineDraft => ({
  itemId: "",
  uomId: "",
  quantity: 1,
  unitCost: 0,
  batchNo: "",
  expiryDate: null,
  notes: "",
});

function toUtcDateOnlyIso(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date().toISOString();
  }

  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function toNullableUtcDateOnlyIso(value: string | null | undefined): string | null {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function buildGrnDraftRequest(form: GrnDraft): CreateGrnDraftRequest {
  return {
    receivingLocationId: form.locationId,
    supplierName: trim(form.supplierName),
    receivedDate: toUtcDateOnlyIso(form.receivedDate),
    notes: trim(form.notes),
    lines: form.lines.map((line) => ({
      itemId: line.itemId,
      uomId: line.uomId,
      quantity: Number(line.quantity) || 0,
      unitCost: Number(line.unitCost) || 0,
      batchNo: trim(line.batchNo),
      expiryDate: toNullableUtcDateOnlyIso(line.expiryDate),
      notes: trim(line.notes),
    })),
  };
}

// ── useGrnList ────────────────────────────────────────────────────────────────

export interface UseGrnListResult {
  rows: GrnListDto[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useGrnList(): UseGrnListResult {
  const { companyId } = useAppScope();

  const [rows, setRows] = useState<GrnListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await grnApi.list(companyId);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(extractApiError(err, "Failed to load GRNs"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    rows,
    loading,
    error,
    refresh: load,
  };
}

// ── useGrnDetail ──────────────────────────────────────────────────────────────

export interface UseGrnDetailResult {
  value: GrnDetailDto | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useGrnDetail(grnId: string | undefined): UseGrnDetailResult {
  const { companyId } = useAppScope();

  const [value, setValue] = useState<GrnDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !grnId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await grnApi.getById(companyId, grnId);
      setValue(data);
    } catch (err) {
      setError(extractApiError(err, "Failed to load GRN"));
      setValue(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, grnId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    value,
    loading,
    error,
    refresh: load,
  };
}

// ── useGrnDraftEditor ─────────────────────────────────────────────────────────

export interface UseGrnDraftEditorResult {
  form: GrnDraft;
  setHeader: (patch: Partial<GrnDraft>) => void;
  addLine: () => void;
  updateLine: (idx: number, patch: Partial<GrnLineDraft>) => void;
  removeLine: (idx: number) => void;
  subtotal: number;

  warehouseOptions: SelectOption<string>[];
  warehousesLoading: boolean;

  itemOptions: SelectOption<string>[];
  itemById: Map<string, ItemVm>;
  itemLabelById: Record<string, string>;
  uomLabelById: Record<string, string>;
  itemsLoading: boolean;

  saving: boolean;
  posting: boolean;
  saveError: string | null;
  postError: string | null;
  saveSuccess: string | null;

  saveDraft: () => Promise<void>;
  postGrn: () => Promise<string | null>;

  isEdit: boolean;
  draftLoading: boolean;
  draftError: string | null;
}

export function useGrnDraftEditor(
  draftId: string | undefined
): UseGrnDraftEditorResult {
  const { companyId, branchId } = useAppScope();
  const isEdit = Boolean(draftId);

  const [form, setForm] = useState<GrnDraft>({
    locationId: "",
    receivedDate: todayDateOnly(),
    supplierName: "",
    notes: "",
    lines: [],
  });

  const setHeader = useCallback((patch: Partial<GrnDraft>) => {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
  }, []);

  const addLine = useCallback(() => {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, createEmptyGrnLine()],
    }));
  }, []);

  const updateLine = useCallback(
    (idx: number, patch: Partial<GrnLineDraft>) => {
      setForm((current) => {
        if (idx < 0 || idx >= current.lines.length) return current;

        const lines = current.lines.map((line, index) =>
          index === idx ? { ...line, ...patch } : line
        );

        return {
          ...current,
          lines,
        };
      });
    },
    []
  );

  const removeLine = useCallback((idx: number) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.filter((_, index) => index !== idx),
    }));
  }, []);

  const subtotal = useMemo(() => {
    return form.lines.reduce((sum, line) => {
      return sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
    }, 0);
  }, [form.lines]);

  const [warehouseOptions, setWarehouseOptions] = useState<SelectOption<string>[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  useEffect(() => {
    if (!companyId || !branchId) return;

    let cancelled = false;

    setWarehousesLoading(true);

    stockLocationsApi
      .list(companyId, branchId)
      .then((rows) => {
        if (cancelled) return;

        const options = (rows ?? []).map((row: { id: string; name?: string }) => ({
          value: String(row.id),
          label: trim(row.name) || "Warehouse",
        }));

        setWarehouseOptions(options);
      })
      .catch(() => {
        if (!cancelled) setWarehouseOptions([]);
      })
      .finally(() => {
        if (!cancelled) setWarehousesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  const [itemsRaw, setItemsRaw] = useState<ItemVm[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;

    let cancelled = false;

    setItemsLoading(true);

    inventoryItemsApi
      .list(companyId)
      .then((data) => {
        if (cancelled) return;
        setItemsRaw((data ?? []).map(toItemVm));
      })
      .catch(() => {
        if (!cancelled) setItemsRaw([]);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const itemById = useMemo(() => {
    return new Map(itemsRaw.map((item) => [item.id, item]));
  }, [itemsRaw]);

  const itemOptions = useMemo<SelectOption<string>[]>(() => {
    return itemsRaw.map((item) => ({
      value: item.id,
      label: item.label,
    }));
  }, [itemsRaw]);

  const itemLabelById = useMemo(() => buildItemLabelCache(itemsRaw), [itemsRaw]);
  const uomLabelById = useMemo(() => buildUomLabelCache(itemsRaw), [itemsRaw]);

  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !companyId || !draftId) return;

    let cancelled = false;

    setDraftLoading(true);
    setDraftError(null);

    grnApi
      .getById(companyId, draftId)
      .then((dto) => {
        if (cancelled) return;
        setForm(normalizeDraftDto(dto));
      })
      .catch((err) => {
        if (!cancelled) {
          setDraftError(extractApiError(err, "Failed to load draft"));
        }
      })
      .finally(() => {
        if (!cancelled) setDraftLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isEdit, companyId, draftId]);

  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const saveDraft = useCallback(async () => {
    if (!companyId) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const request = buildGrnDraftRequest(form);

      if (form.id) {
        await grnApi.updateDraft(companyId, form.id, request);
        setSaveSuccess("Draft updated.");
      } else {
        const result = await grnApi.createDraft(companyId, request);
        const newId = result?.id ?? result?.draftId;

        if (newId) {
          setForm((current) => ({
            ...current,
            id: newId,
          }));
        }

        setSaveSuccess("Draft saved.");
      }
    } catch (err) {
      setSaveError(extractApiError(err, "Failed to save draft"));
    } finally {
      setSaving(false);
    }
  }, [companyId, form]);

  const postGrn = useCallback(async (): Promise<string | null> => {
    if (!companyId) return null;

    setPosting(true);
    setPostError(null);

    try {
      const request = buildGrnDraftRequest(form);

      let draftIdToPost = form.id;

      if (!draftIdToPost) {
        const draft = await grnApi.createDraft(companyId, request);
        draftIdToPost = draft?.id ?? draft?.draftId;

        if (draftIdToPost) {
          setForm((current) => ({
            ...current,
            id: draftIdToPost,
          }));
        }
      }

      if (!draftIdToPost) {
        throw new Error("Could not obtain draft ID.");
      }

      const posted = await grnApi.postDraft(companyId, draftIdToPost);

      return posted?.id ?? posted?.grnId ?? null;
    } catch (err) {
      setPostError(extractApiError(err, "Failed to post GRN"));
      return null;
    } finally {
      setPosting(false);
    }
  }, [companyId, form]);

  return {
    form,
    setHeader,
    addLine,
    updateLine,
    removeLine,
    subtotal,

    warehouseOptions,
    warehousesLoading,

    itemOptions,
    itemById,
    itemLabelById,
    uomLabelById,
    itemsLoading,

    saving,
    posting,
    saveError,
    postError,
    saveSuccess,

    saveDraft,
    postGrn,

    isEdit,
    draftLoading,
    draftError,
  };
}

// ── useGrnReverse ─────────────────────────────────────────────────────────────

export interface UseGrnReverseResult {
  grnNumber: string;
  setGrnNumber: (value: string) => void;
  batchNo: string;
  setBatchNo: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  busy: boolean;
  message: string | null;
  tone: "success" | "error" | null;
  canSubmit: boolean;
  onReverse: () => Promise<void>;
  onClear: () => void;
}

export function useGrnReverse(): UseGrnReverseResult {
  const { companyId } = useAppScope();

  const [grnNumber, setGrnNumberState] = useState("");
  const [batchNo, setBatchNoState] = useState("");
  const [reason, setReason] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error" | null>(null);

  const cleanedGrnNumber = trim(grnNumber);
  const cleanedBatchNo = trim(batchNo);
  const cleanedReason = trim(reason);

  const canSubmit = Boolean(
    companyId &&
      (cleanedGrnNumber || cleanedBatchNo) &&
      cleanedReason.length >= 5
  );

  const setGrnNumber = useCallback((value: string) => {
    setGrnNumberState(value);
    if (trim(value)) setBatchNoState("");
  }, []);

  const setBatchNo = useCallback((value: string) => {
    setBatchNoState(value);
    if (trim(value)) setGrnNumberState("");
  }, []);

  const onClear = useCallback(() => {
    setGrnNumberState("");
    setBatchNoState("");
    setReason("");
    setMessage(null);
    setTone(null);
  }, []);

  const onReverse = useCallback(async () => {
    if (!companyId) return;

    setMessage(null);
    setTone(null);

    if (!cleanedGrnNumber && !cleanedBatchNo) {
      setTone("error");
      setMessage("Enter a GRN number or batch number.");
      return;
    }

    if (cleanedReason.length < 5) {
      setTone("error");
      setMessage("Reversal reason is required and must be at least 5 characters.");
      return;
    }

    setBusy(true);

    try {
      if (cleanedGrnNumber) {
        const found = await grnApi.findByNumber(companyId, cleanedGrnNumber);
        const id = found?.id;

        if (!id) {
          throw new Error("GRN number was not found.");
        }

        await grnApi.reverseById(companyId, String(id), {
          reason: cleanedReason,
        });
      } else {
        await grnApi.reverseByBatch(companyId, cleanedBatchNo, {
          reason: cleanedReason,
        });
      }

      setTone("success");
      setMessage("GRN reversal submitted successfully.");

      setGrnNumberState("");
      setBatchNoState("");
      setReason("");
    } catch (err) {
      setTone("error");
      setMessage(extractApiError(err, "Failed to reverse GRN"));
    } finally {
      setBusy(false);
    }
  }, [companyId, cleanedGrnNumber, cleanedBatchNo, cleanedReason]);

  return {
    grnNumber,
    setGrnNumber,
    batchNo,
    setBatchNo,
    reason,
    setReason,
    busy,
    message,
    tone,
    canSubmit,
    onReverse,
    onClear,
  };
}