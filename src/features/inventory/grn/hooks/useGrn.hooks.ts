// ─── GRN Custom Hooks ─────────────────────────────────────────────────────────
// Encapsulate all async data-fetching and business state.
// Pages become thin rendering shells; logic lives here.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";

import { grnApi } from "../api/grnApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import { inventoryItemsApi } from "../../../inventoryMaster/items/api/inventoryItemsApi";

import type { GrnListDto, GrnDetailDto, GrnDraft, GrnLineDraft, SelectOption, ItemVm } from "../types/grn.types";
import {
  toItemVm,
  normalizeDraftDto,
  buildItemLabelCache,
  buildUomLabelCache,
  extractApiError,
  todayDateOnly,
  trim,
} from "../utils/grn.utils";

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
      setRows(Array.isArray(data) ? (data as GrnListDto[]) : []);
    } catch (e) {
      setError(extractApiError(e, "Failed to load GRNs"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  return { rows, loading, error, refresh: load };
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
    } catch (e) {
      setError(extractApiError(e, "Failed to load GRN"));
    } finally {
      setLoading(false);
    }
  }, [companyId, grnId]);

  useEffect(() => { void load(); }, [load]);

  return { value, loading, error, refresh: load };
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
  postGrn: () => Promise<string | null>; // returns posted GRN id or null

  isEdit: boolean;
  draftLoading: boolean;
  draftError: string | null;
}

export function useGrnDraftEditor(draftId: string | undefined): UseGrnDraftEditorResult {
  const { companyId, branchId } = useAppScope();
  const isEdit = !!draftId;

  const [form, setForm] = useState<GrnDraft>({
    locationId: "",
    receivedDate: todayDateOnly(),
    supplierName: "",
    notes: "",
    lines: [],
  });

  const setHeader = useCallback((patch: Partial<GrnDraft>) => setForm((f) => ({ ...f, ...patch })), []);

  const addLine = useCallback(() =>
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { itemId: "", uomId: "", quantity: 1, unitCost: 0, expiryDate: null, notes: "" }],
    })), []);

  const updateLine = useCallback((idx: number, patch: Partial<GrnLineDraft>) =>
    setForm((f) => {
      const lines = [...f.lines];
      lines[idx] = { ...lines[idx], ...patch };
      return { ...f, lines };
    }), []);

  const removeLine = useCallback((idx: number) =>
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) })), []);

  // Subtotal
  const subtotal = useMemo(
    () => form.lines.reduce((acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0),
    [form.lines]
  );

  // Warehouses
  const [warehouseOptions, setWarehouseOptions] = useState<SelectOption<string>[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  useEffect(() => {
    if (!companyId || !branchId) return;
    setWarehousesLoading(true);
    stockLocationsApi.list(companyId, branchId)
      .then((rows: any[]) =>
        setWarehouseOptions(
          (rows ?? []).map((x) => ({ value: String(x.id), label: trim(x.name) || "Warehouse" }))
        )
      )
      .catch(() => {})
      .finally(() => setWarehousesLoading(false));
  }, [companyId, branchId]);

  // Items
  const [itemsRaw, setItemsRaw] = useState<ItemVm[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setItemsLoading(true);
    inventoryItemsApi.list(companyId)
      .then((data: any[]) => setItemsRaw((data ?? []).map(toItemVm)))
      .catch(() => {})
      .finally(() => setItemsLoading(false));
  }, [companyId]);

  const itemById = useMemo(() => new Map(itemsRaw.map((i) => [i.id, i])), [itemsRaw]);
  const itemOptions = useMemo<SelectOption<string>[]>(() => itemsRaw.map((i) => ({ value: i.id, label: i.label })), [itemsRaw]);
  const itemLabelById = useMemo(() => buildItemLabelCache(itemsRaw), [itemsRaw]);
  const uomLabelById = useMemo(() => buildUomLabelCache(itemsRaw), [itemsRaw]);

  // Load draft (edit mode)
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !companyId || !draftId) return;
    setDraftLoading(true);
    setDraftError(null);
    grnApi.getById(companyId, draftId)
      .then((dto: any) => setForm(normalizeDraftDto(dto)))
      .catch((e) => setDraftError(extractApiError(e, "Failed to load draft")))
      .finally(() => setDraftLoading(false));
  }, [isEdit, companyId, draftId]);

  // Actions
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const buildRequest = () => ({
    locationId: form.locationId,
    supplierName: trim(form.supplierName) || null,
    receivedDate: form.receivedDate
      ? (() => { const [y, m, d] = form.receivedDate.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).toISOString(); })()
      : new Date().toISOString(),
    notes: trim(form.notes) || null,
    lines: form.lines.map((l) => ({
      itemId: l.itemId,
      uomId: l.uomId,
      quantity: l.quantity,
      unitCost: l.unitCost,
      expiryDate: l.expiryDate
        ? (() => { const [y, m, d] = l.expiryDate!.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).toISOString(); })()
        : null,
      notes: trim(l.notes) || null,
    })),
  });

  const saveDraft = useCallback(async () => {
    if (!companyId) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const req = buildRequest();
      if (form.id) {
        await grnApi.updateDraft(companyId, form.id, req);
        setSaveSuccess("Draft updated.");
      } else {
        const result: any = await grnApi.createDraft(companyId, req);
        const newId = result?.id ?? result?.draftId;
        if (newId) setForm((f) => ({ ...f, id: newId }));
        setSaveSuccess("Draft saved.");
      }
    } catch (e) {
      setSaveError(extractApiError(e, "Failed to save draft"));
    } finally {
      setSaving(false);
    }
  }, [companyId, form]);

  const postGrn = useCallback(async (): Promise<string | null> => {
    if (!companyId) return null;
    setPosting(true);
    setPostError(null);
    try {
      const req = buildRequest();
      let draftIdToPost = form.id;
      if (!draftIdToPost) {
        const draft: any = await grnApi.createDraft(companyId, req);
        draftIdToPost = draft?.id ?? draft?.draftId;
        if (draftIdToPost) setForm((f) => ({ ...f, id: draftIdToPost! }));
      }
      if (!draftIdToPost) throw new Error("Could not obtain draft ID");
      const posted: any = await grnApi.postDraft(companyId, draftIdToPost);
      return posted?.id ?? posted?.grnId ?? null;
    } catch (e) {
      setPostError(extractApiError(e, "Failed to post GRN"));
      return null;
    } finally {
      setPosting(false);
    }
  }, [companyId, form]);

  return {
    form, setHeader, addLine, updateLine, removeLine, subtotal,
    warehouseOptions, warehousesLoading,
    itemOptions, itemById, itemLabelById, uomLabelById, itemsLoading,
    saving, posting, saveError, postError, saveSuccess,
    saveDraft, postGrn,
    isEdit, draftLoading, draftError,
  };
}

// ── useGrnReverse ─────────────────────────────────────────────────────────────

export interface UseGrnReverseResult {
  grnNumber: string;
  setGrnNumber: (v: string) => void;
  batchNo: string;
  setBatchNo: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  busy: boolean;
  message: string | null;
  tone: "success" | "error" | null;
  canSubmit: boolean;
  onReverse: () => Promise<void>;
  onClear: () => void;
}

export function useGrnReverse(): UseGrnReverseResult {
  const { companyId } = useAppScope();
  const [grnNumber, setGrnNumber] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error" | null>(null);

  const canSubmit = !!trim(grnNumber) || !!trim(batchNo);

  const onClear = useCallback(() => {
    setGrnNumber(""); setBatchNo(""); setReason(""); setMessage(null); setTone(null);
  }, []);

  const onReverse = useCallback(async () => {
    if (!companyId) return;
    setMessage(null); setTone(null);
    const gn = trim(grnNumber);
    const bn = trim(batchNo);
    if (!gn && !bn) { setTone("error"); setMessage("Enter a GRN number or batch number."); return; }
    setBusy(true);
    try {
      await grnApi.reverseById(companyId, gn || bn, { reason: trim(reason) || null });
      setTone("success");
      setMessage("Reversal submitted successfully.");
      setGrnNumber(""); setBatchNo(""); setReason("");
    } catch (e) {
      setTone("error");
      setMessage(extractApiError(e, "Failed to reverse GRN"));
    } finally {
      setBusy(false);
    }
  }, [companyId, grnNumber, batchNo, reason]);

  return { grnNumber, setGrnNumber, batchNo, setBatchNo, reason, setReason, busy, message, tone, canSubmit, onReverse, onClear };
}