//  GRN Custom Hooks 
// ERP-grade hooks for GRN list, detail, draft editor, posting, and reversal.
//
// Design rules:
// - grnApi is the only HTTP boundary.
// - Request mapping uses shared GRN helpers.
// - GRN create/update/post always uses company + branch scope when available.
// - Reversal is by GRN id only; batch reversal was removed from the API.

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppScope } from "../../../../app/useAppScope";
import { grnApi, type GrnIdentityResult, type GrnScope } from "../api/grnApi";
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
import type { GrnStatusFilter } from "../helpers/grn.status";
import {
  buildCreateGrnRequest,
  createEmptyGrnDraft,
  createEmptyGrnLine,
} from "../helpers/grn.builders";

import {
  buildItemLabelCache,
  buildUomLabelCache,
  extractApiError,
  normalizeDraftDto,
  toItemVm,
  trim,
} from "../utils/grn.utils";

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                              */
/* -------------------------------------------------------------------------- */

function buildScope(companyId?: string | null, branchId?: string | null): GrnScope | null {
  const cleanCompanyId = trim(companyId);
  if (!cleanCompanyId) return null;

  const cleanBranchId = trim(branchId);

  return {
    companyId: cleanCompanyId,
    ...(cleanBranchId ? { branchId: cleanBranchId } : {}),
  } as GrnScope;
}

function buildDraftRequest(
  form: GrnDraft,
  companyId?: string | null,
  branchId?: string | null,
): CreateGrnDraftRequest {
  return buildCreateGrnRequest(form, {
    companyId: trim(companyId) || undefined,
    branchId: trim(branchId) || undefined,
  });
}

function getCreatedId(value: GrnIdentityResult | null | undefined): string | undefined {
  return value?.id ?? value?.grnId ?? value?.draftId ?? undefined;
}

/* -------------------------------------------------------------------------- */
/* useGrnList                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseGrnListOptions {
  status?: GrnStatusFilter;
  from?: string | Date | null;
  to?: string | Date | null;
  q?: string | null;
}

export interface UseGrnListResult {
  rows: GrnListDto[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useGrnList(options: UseGrnListOptions = {}): UseGrnListResult {
  const { companyId, branchId } = useAppScope();

  const [rows, setRows] = useState<GrnListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scope = useMemo(() => buildScope(companyId, branchId), [companyId, branchId]);

  const load = useCallback(async () => {
    if (!scope) {
      setRows([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await grnApi.list(scope, {
        status: options.status === "ALL" ? undefined : options.status,
        from: options.from ?? undefined,
        to: options.to ?? undefined,
        q: trim(options.q) || undefined,
      });

      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setError(extractApiError(err, "Failed to load goods receipts."));
    } finally {
      setLoading(false);
    }
  }, [scope, options.status, options.from, options.to, options.q]);

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

/* -------------------------------------------------------------------------- */
/* useGrnDetail                                                                */
/* -------------------------------------------------------------------------- */

export interface UseGrnDetailResult {
  value: GrnDetailDto | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useGrnDetail(grnId: string | null | undefined): UseGrnDetailResult {
  const { companyId, branchId } = useAppScope();

  const [value, setValue] = useState<GrnDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scope = useMemo(() => buildScope(companyId, branchId), [companyId, branchId]);

  const load = useCallback(async () => {
    if (!scope || !grnId) {
      setValue(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await grnApi.getById(scope, grnId);
      setValue(data);
    } catch (err) {
      setValue(null);
      setError(extractApiError(err, "Failed to load goods receipt."));
    } finally {
      setLoading(false);
    }
  }, [scope, grnId]);

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

/* -------------------------------------------------------------------------- */
/* useGrnLookups                                                               */
/* -------------------------------------------------------------------------- */

export interface UseGrnLookupsResult {
  warehouseOptions: SelectOption<string>[];
  warehousesLoading: boolean;
  warehouseError: string | null;

  itemOptions: SelectOption<string>[];
  itemById: Map<string, ItemVm>;
  itemLabelById: Record<string, string>;
  uomLabelById: Record<string, string>;
  itemsLoading: boolean;
  itemError: string | null;

  refreshWarehouses: () => Promise<void>;
  refreshItems: () => Promise<void>;
}

type StockLocationRow = {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  locationType?: string | null;
  canReceive?: boolean | null;
  canReceiveGrn?: boolean | null;
  isActive?: boolean | null;
};

export function useGrnLookups(): UseGrnLookupsResult {
  const { companyId, branchId } = useAppScope();

  const [warehouseOptions, setWarehouseOptions] = useState<SelectOption<string>[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);

  const [itemsRaw, setItemsRaw] = useState<ItemVm[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  const refreshWarehouses = useCallback(async () => {
    if (!companyId || !branchId) {
      setWarehouseOptions([]);
      setWarehouseError(null);
      return;
    }

    setWarehousesLoading(true);
    setWarehouseError(null);

    try {
      const rows = (await stockLocationsApi.list(companyId, branchId)) as StockLocationRow[];

      const options = (rows ?? [])
        .filter((row) => Boolean(row.id) && row.isActive !== false)
        .map((row) => ({
          value: String(row.id),
          label: trim(row.name) || trim(row.code) || "Receiving warehouse",
        }));

      setWarehouseOptions(options);
    } catch (err) {
      setWarehouseOptions([]);
      setWarehouseError(extractApiError(err, "Failed to load receiving warehouses."));
    } finally {
      setWarehousesLoading(false);
    }
  }, [companyId, branchId]);

  const refreshItems = useCallback(async () => {
    if (!companyId) {
      setItemsRaw([]);
      setItemError(null);
      return;
    }

    setItemsLoading(true);
    setItemError(null);

    try {
      const data = await inventoryItemsApi.list(companyId);
      setItemsRaw((data ?? []).map(toItemVm));
    } catch (err) {
      setItemsRaw([]);
      setItemError(extractApiError(err, "Failed to load inventory items."));
    } finally {
      setItemsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refreshWarehouses();
  }, [refreshWarehouses]);

  useEffect(() => {
    void refreshItems();
  }, [refreshItems]);

  const itemById = useMemo(() => new Map(itemsRaw.map((item) => [item.id, item])), [itemsRaw]);

  const itemOptions = useMemo<SelectOption<string>[]>(
    () => itemsRaw.map((item) => ({ value: item.id, label: item.label })),
    [itemsRaw],
  );

  const itemLabelById = useMemo(() => buildItemLabelCache(itemsRaw), [itemsRaw]);
  const uomLabelById = useMemo(() => buildUomLabelCache(itemsRaw), [itemsRaw]);

  return {
    warehouseOptions,
    warehousesLoading,
    warehouseError,

    itemOptions,
    itemById,
    itemLabelById,
    uomLabelById,
    itemsLoading,
    itemError,

    refreshWarehouses,
    refreshItems,
  };
}

/* -------------------------------------------------------------------------- */
/* useGrnDraftEditor                                                           */
/* -------------------------------------------------------------------------- */

export interface UseGrnDraftEditorResult extends UseGrnLookupsResult {
  form: GrnDraft;
  setHeader: (patch: Partial<GrnDraft>) => void;
  addLine: () => void;
  updateLine: (idx: number, patch: Partial<GrnLineDraft>) => void;
  removeLine: (idx: number) => void;
  resetDraft: () => void;
  subtotal: number;

  saving: boolean;
  posting: boolean;
  saveError: string | null;
  postError: string | null;
  saveSuccess: string | null;

  saveDraft: () => Promise<string | null>;
  postGrn: () => Promise<string | null>;

  isEdit: boolean;
  draftLoading: boolean;
  draftError: string | null;
}

export function useGrnDraftEditor(draftId: string | null | undefined): UseGrnDraftEditorResult {
  const { companyId, branchId } = useAppScope();
  const lookups = useGrnLookups();

  const isEdit = Boolean(draftId);
  const scope = useMemo(() => buildScope(companyId, branchId), [companyId, branchId]);

  const [form, setForm] = useState<GrnDraft>(() => createEmptyGrnDraft());
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const setHeader = useCallback((patch: Partial<GrnDraft>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const addLine = useCallback(() => {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, createEmptyGrnLine()],
    }));
  }, []);

  const updateLine = useCallback((idx: number, patch: Partial<GrnLineDraft>) => {
    setForm((current) => {
      if (idx < 0 || idx >= current.lines.length) return current;

      return {
        ...current,
        lines: current.lines.map((line, index) =>
          index === idx ? { ...line, ...patch } : line,
        ),
      };
    });
  }, []);

  const removeLine = useCallback((idx: number) => {
    setForm((current) => {
      const lines = current.lines.filter((_, index) => index !== idx);

      return {
        ...current,
        lines: lines.length > 0 ? lines : [createEmptyGrnLine()],
      };
    });
  }, []);

  const resetDraft = useCallback(() => {
    setForm(createEmptyGrnDraft());
    setDraftError(null);
    setSaveError(null);
    setPostError(null);
    setSaveSuccess(null);
  }, []);

  const subtotal = useMemo(
    () =>
      form.lines.reduce(
        (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0),
        0,
      ),
    [form.lines],
  );

  useEffect(() => {
    if (!isEdit || !scope || !draftId) {
      return;
    }

    let cancelled = false;

    setDraftLoading(true);
    setDraftError(null);

    grnApi
      .getById(scope, draftId)
      .then((dto) => {
        if (!cancelled) {
          setForm(normalizeDraftDto(dto));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDraftError(extractApiError(err, "Failed to load goods receipt draft."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDraftLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isEdit, scope, draftId]);

  const saveDraft = useCallback(async (): Promise<string | null> => {
    if (!scope || !companyId) return null;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const request = buildDraftRequest(form, companyId, branchId);

      const result = form.id
        ? await grnApi.updateDraft(scope, form.id, request)
        : await grnApi.createDraft(scope, request);

      const id = getCreatedId(result);

      if (id) {
        setForm((current) => ({ ...current, id }));
      }

      setSaveSuccess(form.id ? "Goods receipt draft updated." : "Goods receipt draft saved.");
      return id ?? form.id ?? null;
    } catch (err) {
      setSaveError(extractApiError(err, "Failed to save goods receipt draft."));
      return null;
    } finally {
      setSaving(false);
    }
  }, [scope, companyId, branchId, form]);

  const postGrn = useCallback(async (): Promise<string | null> => {
    if (!scope || !companyId) return null;

    setPosting(true);
    setPostError(null);

    try {
      const request = buildDraftRequest(form, companyId, branchId);
      let draftIdToPost = form.id;

      if (!draftIdToPost) {
        const draft = await grnApi.createDraft(scope, request);
        draftIdToPost = getCreatedId(draft);

        if (draftIdToPost) {
          setForm((current) => ({ ...current, id: draftIdToPost }));
        }
      } else {
        await grnApi.updateDraft(scope, draftIdToPost, request);
      }

      if (!draftIdToPost) {
        throw new Error("Unable to identify the goods receipt draft to post.");
      }

      const posted = await grnApi.postDraft(scope, draftIdToPost);
      return getCreatedId(posted) ?? draftIdToPost;
    } catch (err) {
      setPostError(extractApiError(err, "Failed to post goods receipt."));
      return null;
    } finally {
      setPosting(false);
    }
  }, [scope, companyId, branchId, form]);

  return {
    form,
    setHeader,
    addLine,
    updateLine,
    removeLine,
    resetDraft,
    subtotal,

    ...lookups,

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

/* -------------------------------------------------------------------------- */
/* useGrnReversal                                                              */
/* -------------------------------------------------------------------------- */

export interface UseGrnReversalResult {
  reason: string;
  setReason: (value: string) => void;
  busy: boolean;
  error: string | null;
  success: string | null;
  canSubmit: boolean;
  reverse: () => Promise<boolean>;
  reset: () => void;
}

export function useGrnReversal(
  grn: Pick<GrnDetailDto, "id"> | null | undefined,
  onReversed?: () => Promise<void> | void,
): UseGrnReversalResult {
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => buildScope(companyId, branchId), [companyId, branchId]);

  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const cleanedReason = trim(reason);
  const canSubmit = Boolean(scope && grn?.id && cleanedReason.length >= 10 && !busy);

  const reset = useCallback(() => {
    setReason("");
    setError(null);
    setSuccess(null);
  }, []);

  const reverse = useCallback(async (): Promise<boolean> => {
    if (!scope || !grn?.id) return false;

    setError(null);
    setSuccess(null);

    if (cleanedReason.length < 10) {
      setError("Enter a clear reversal reason of at least 10 characters.");
      return false;
    }

    setBusy(true);

    try {
      await grnApi.reverseById(scope, grn.id, { reason: cleanedReason });
      setSuccess("Goods receipt reversed successfully.");
      setReason("");
      await onReversed?.();
      return true;
    } catch (err) {
      setError(extractApiError(err, "Failed to reverse goods receipt."));
      return false;
    } finally {
      setBusy(false);
    }
  }, [scope, grn?.id, cleanedReason, onReversed]);

  return {
    reason,
    setReason,
    busy,
    error,
    success,
    canSubmit,
    reverse,
    reset,
  };
}
