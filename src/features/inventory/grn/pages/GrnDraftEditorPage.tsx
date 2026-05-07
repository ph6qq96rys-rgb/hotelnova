// GrnDraftEditorPage.tsx (FULL REWRITE - name-first edit binding)
// ✅ Draft workflow: create draft, load/edit draft by :draftId, post draft
// ✅ companyId/branchId come from AppScope (NOT from URL)
// ✅ Classic native <select> dropdowns (no SelectDropdown)
// ✅ When opening a draft: shows SAVED NAMES (Warehouse/Item/UOM), not placeholder and not raw IDs
// ✅ Works even if options aren't loaded yet: injects "saved" option with a friendly name
// ✅ Item → UOM dropdown filtered to item.allowed UOM list
// ✅ Safe native <select>: value is ALWAYS string ("" for none), never null
//
// NOTE about "name-first":
// - If the saved ID isn't present in current options (loading, deleted, filtered), we still show a fallback option
//   with a name from caches and/or a best-effort API fetch (getById if available).
// - If your APIs don't have getById, the UI still works: it shows cached label if available,
//   otherwise "Saved item"/"Saved unit"/"Saved warehouse" (no raw GUID shown).

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";

import { grnApi } from "../api/grnApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import { inventoryItemsApi } from "../../../inventoryMaster/items/api/inventoryItemsApi";

import type { InventoryItemDto } from "../../../inventoryMaster/items/types";
import type { GrnDto, CreateGrnDraftRequest, SelectOption } from "../types/grn";

import {
  cardStyle,
  labelStyle,
  inputStyle,
  errorStyle,
  tableStyle,
  thStyle,
  tdStyle,
  primaryBtn,
  secondaryBtn,
  dangerBtn,
  stickyBar,
  totRow,
} from "../../../../shared/inventoryStyles";

/** ================= Helpers ================= */
const todayDateOnly = () => new Date().toISOString().slice(0, 10);

function dateOnlyToUtcIso(dateOnly: string) {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

function utcIsoToDateOnly(iso: string | null | undefined) {
  return (iso ?? "").toString().slice(0, 10) || todayDateOnly();
}

function toNullable(s: string | null | undefined) {
  const t = (s ?? "").trim();
  return t ? t : null;
}

function money(n: number) {
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

const clean = (s?: string | null) => (s ?? "").trim();

const shortId = (id?: string | null, n = 8) => {
  const s = clean(id);
  if (!s) return "";
  return s.length <= n ? s : s.slice(-n);
};

const labelWithShortId = (main: string, id?: string | null) => {
  const sid = shortId(id, 8);
  return sid ? `${main}  ·  #${sid}` : main;
};

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

/** ================= View Models ================= */
type ItemUomVm = {
  uomId: string;
  uomName: string;
  isDefaultPurchase?: boolean;
};

type ItemVm = {
  id: string;
  code?: string;
  name: string;
  label: string; // friendly label
  baseUomId: string;
  baseUomName?: string;
  uoms: ItemUomVm[]; // allowed list
  defaultUomId: string;
};

function toItemVm(dto: InventoryItemDto): ItemVm {
  const d: any = dto;

  const id = clean(d.id);
  const name = clean(d.name);
  const code = clean(d.code) || clean(d.sku) || undefined;

  const baseUomId = clean(d.baseUomId);
  const baseUomName =
    clean(d.baseUomCode) ||
    clean(d.baseUomName) ||
    clean(d.baseUom?.code) ||
    clean(d.baseUom?.name) ||
    undefined;

  const uomsRaw: any[] = Array.isArray(d.uoms) ? d.uoms : Array.isArray(d.itemUoms) ? d.itemUoms : [];

  const uoms: ItemUomVm[] = (uomsRaw ?? [])
    .map((u: any) => {
      const uomId = clean(u.uomId ?? u.id);
      const uomName = clean(u.uomName ?? u.name ?? u.code ?? "UOM");
      // many backends use IsBase/IsIssue instead of isDefaultPurchase;
      // we'll still honor isDefaultPurchase if present, else fallback later.
      const isDefaultPurchase = !!u.isDefaultPurchase || !!u.isBase;
      return { uomId, uomName, isDefaultPurchase };
    })
    .filter((x) => !!x.uomId);

  if (!uoms.length && baseUomId) {
    uoms.push({
      uomId: baseUomId,
      uomName: baseUomName ?? "Base UOM",
      isDefaultPurchase: true,
    });
  }

  const defaultUomId = uoms.find((x) => x.isDefaultPurchase)?.uomId ?? baseUomId ?? (uoms[0]?.uomId ?? "");

  const friendlyMain = code ? `${code} — ${name}` : name;
  const label = labelWithShortId(friendlyMain, id);

  return { id, code, name, label, baseUomId, baseUomName, uoms, defaultUomId };
}


/** ================= Draft Form Types ================= */
export type GrnLineDraft = {
  inventoryItemId: string;
  uomId: string;
  quantity: number;
  unitCost: number;
  expiryDate: string | null;
  notes: string;
};

export type GrnDraft = {
  id?: string;
  locationId: string;
  receivedDate: string;
  supplierName: string;
  notes: string;
  lines: GrnLineDraft[];
};

type FieldErrors = {
  locationId?: string;
  receivedDate?: string;
  lines?: string;
  lineErrors?: Record<number, Partial<Record<keyof GrnLineDraft, string>>>;
};



/** ================= DTO Normalization Utilities (enterprise-grade) =================
 * Why: backend DTOs evolve (PascalCase/camelCase, renamed ids, nested objects).
 * We normalize into the UI's GrnDraft shape consistently.
 */

function pickId(obj: any, ...paths: string[]): string {
  for (const p of paths) {
    const v = obj?.[p];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickDateOnly(obj: any, ...paths: string[]): string {
  // expects ISO strings; converts to yyyy-mm-dd using utcIsoToDateOnly helper below
  for (const p of paths) {
    const v = obj?.[p];
    if (typeof v === "string" && v.trim()) return utcIsoToDateOnly(v.trim());
  }
  return todayDateOnly();
}

function normalizeGrnLineDto(l: any): GrnLineDraft {
  return {
    inventoryItemId: pickId(
      l,
      "inventoryItemId",
      "InventoryItemId",
      "itemId",
      "ItemId",
      "inventoryItemID",
      "InventoryItemID"
    ) || pickId(l?.inventoryItem, "id", "Id") || pickId(l?.item, "id", "Id"),
    uomId: pickId(
      l,
      "uomId",
      "UomId",
      "unitId",
      "UnitId",
      "unitOfMeasureId",
      "UnitOfMeasureId"
    ) || pickId(l?.uom, "id", "Id") || pickId(l?.unitOfMeasure, "id", "Id"),
    quantity: Number(l?.quantity ?? l?.Quantity ?? 0),
    unitCost: Number(l?.unitCost ?? l?.UnitCost ?? 0),
    expiryDate:
      typeof (l?.expiryDateUtc ?? l?.ExpiryDateUtc ?? l?.expiryDate ?? l?.ExpiryDate) === "string"
        ? utcIsoToDateOnly((l?.expiryDateUtc ?? l?.ExpiryDateUtc ?? l?.expiryDate ?? l?.ExpiryDate).trim())
        : null,
    notes: String(l?.notes ?? l?.Notes ?? ""),
  };
}

function normalizeGrnDraftDto(dto: any, fallbackId?: string): GrnDraft {
  const d = dto ?? {};
  return {
    id: pickId(d, "id", "Id") || fallbackId,
    // "warehouse" sometimes stored as locationId, warehouseId, or stockLocationId
    locationId:
      pickId(d, "locationId", "LocationId", "warehouseId", "WarehouseId", "stockLocationId", "StockLocationId") ||
      pickId(d?.location, "id", "Id") ||
      pickId(d?.warehouse, "id", "Id") ||
      pickId(d?.stockLocation, "id", "Id"),
    receivedDate: pickDateOnly(d, "receivedAtUtc", "ReceivedAtUtc", "receivedDateUtc", "ReceivedDateUtc", "receivedDate", "ReceivedDate"),
    supplierName: String(d?.supplierName ?? d?.SupplierName ?? ""),
    notes: String(d?.notes ?? d?.Notes ?? ""),
    lines: Array.isArray(d?.lines ?? d?.Lines) ? (d?.lines ?? d?.Lines).map(normalizeGrnLineDto) : [],
  };
}

/** ================= Auto-repair helpers ================= */

type MissingRef = { kind: "item" | "uom"; id: string; lineIndex: number };


/** ================= Page ================= */
export default function GrnDraftEditorPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();
  const { draftId: routeDraftId } = useParams<{ draftId?: string }>();

  /** Form */
  const [form, setForm] = useState<GrnDraft>({
    id: undefined,
    locationId: "",
    receivedDate: todayDateOnly(),
    supplierName: "",
    notes: "",
    lines: [],
  });

  const effectiveDraftId = form.id ?? routeDraftId;
  const isEdit = !!effectiveDraftId;

  const setHeader = (patch: Partial<GrnDraft>) => setForm((f) => ({ ...f, ...patch }));

  /** Label caches (id -> label) to show saved names immediately */
  const [warehouseLabelById, setWarehouseLabelById] = useState<Record<string, string>>({});
  const [itemLabelById, setItemLabelById] = useState<Record<string, string>>({});
  const [uomLabelById, setUomLabelById] = useState<Record<string, string>>({});

  /** Warehouses */
  const [warehouseOptions, setWarehouseOptions] = useState<SelectOption<string>[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  // Avoid clearing location on initial mount (would wipe loaded draft)
  const lastBranchRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = lastBranchRef.current;
    const next = branchId ?? null;

    // Clear only when branch actually changes after initial mount
    if (prev !== null && prev !== next) setHeader({ locationId: "" });
    lastBranchRef.current = next;

    setWarehouseOptions([]);
    if (!companyId || !branchId) return;

    setWarehousesLoading(true);
    stockLocationsApi
      .list(companyId, branchId)
      .then((rows: any[]) => {
        const opts: SelectOption<string>[] = (rows ?? []).map((x) => ({
          value: String(x.id),
          label: clean(x.name) || "Warehouse",
        }));
        setWarehouseOptions(opts);
      })
      .catch(() => setWarehouseOptions([]))
      .finally(() => setWarehousesLoading(false));
  }, [companyId, branchId]);

  // Fill warehouse cache from options
  useEffect(() => {
    if (!warehouseOptions.length) return;
    setWarehouseLabelById((prev) => {
      const next = { ...prev };
      warehouseOptions.forEach((o) => (next[o.value] = o.label));
      return next;
    });
  }, [warehouseOptions]);

  /** Items */
  const [items, setItems] = useState<ItemVm[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!companyId) {
        if (!alive) return;
        setItems([]);
        setItemsLoading(false);
        return;
      }

      setItemsLoading(true);
      try {
        const res = await inventoryItemsApi.list(companyId);
        const list: InventoryItemDto[] = Array.isArray(res) ? res : [];
        if (!alive) return;

        const vms = list.map(toItemVm);
        setItems(vms);

        // populate label caches
        setItemLabelById((prev) => {
          const next = { ...prev };
          vms.forEach((it) => (next[it.id] = it.label));
          return next;
        });
        setUomLabelById((prev) => {
          const next = { ...prev };
          vms.forEach((it) => it.uoms.forEach((u) => (next[u.uomId] = u.uomName)));
          return next;
        });
      } catch {
        if (!alive) return;
        setItems([]);
      } finally {
        if (!alive) return;
        setItemsLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [companyId]);

  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  const itemOptions = useMemo<SelectOption<string>[]>(
    () => items.map((it) => ({ value: it.id, label: it.label })),
    [items]
  );

  /** Load draft (ONLY from routeDraftId) */
  useEffect(() => {
    if (!companyId || !routeDraftId) return;

    grnApi
      .getDraftById(companyId, routeDraftId)
      .then((dto: GrnDto) => {
        setForm(normalizeGrnDraftDto(dto as any, routeDraftId));
      })
      .catch((e: any) => alert(e?.response?.data?.title ?? e?.message ?? "Failed to load draft"));
  }, [companyId, routeDraftId]);

  /**
   * Best-effort "getById" fetchers (only if your API provides them).
   * This lets us show actual names even when the saved IDs are not in current option lists.
   */
  const fetchedWarehouseRef = useRef<Set<string>>(new Set());
  const fetchedItemRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = clean(form.locationId);
    if (!id || !companyId || !branchId) return;
    if (warehouseLabelById[id]) return;
    if (fetchedWarehouseRef.current.has(id)) return;

    // If API has getById, fetch name once.
    const apiAny: any = stockLocationsApi as any;
    if (typeof apiAny.getById !== "function") {
      // fallback label (no raw GUID)
      setWarehouseLabelById((prev) => ({ ...prev, [id]: "Saved warehouse" }));
      fetchedWarehouseRef.current.add(id);
      return;
    }

    fetchedWarehouseRef.current.add(id);
    (async () => {
      try {
        const loc = await apiAny.getById(companyId, branchId, id);
        const name = clean(loc?.name) || "Warehouse";
        setWarehouseLabelById((prev) => ({ ...prev, [id]: name }));
      } catch {
        setWarehouseLabelById((prev) => ({ ...prev, [id]: "Saved warehouse" }));
      }
    })();
  }, [companyId, branchId, form.locationId, warehouseLabelById]);

  useEffect(() => {
    if (!companyId) return;

    const itemIds = uniq(form.lines.map((l) => clean(l.inventoryItemId)).filter(Boolean));
    itemIds.forEach((id) => {
      if (!id) return;
      if (itemLabelById[id]) return;
      if (itemById.has(id)) return;
      if (fetchedItemRef.current.has(id)) return;

      const apiAny: any = inventoryItemsApi as any;
      if (typeof apiAny.getById !== "function") {
        // fallback label (no raw GUID)
        setItemLabelById((prev) => ({ ...prev, [id]: "Saved item" }));
        fetchedItemRef.current.add(id);
        return;
      }

      fetchedItemRef.current.add(id);
      (async () => {
        try {
          const dto = await apiAny.getById(companyId, id);
          const vm = toItemVm(dto as InventoryItemDto);

          setItemLabelById((prev) => ({ ...prev, [id]: vm.label }));
          setUomLabelById((prev) => {
            const next = { ...prev };
            vm.uoms.forEach((u) => (next[u.uomId] = u.uomName));
            return next;
          });
        } catch {
          // Could be deleted or access denied
          setItemLabelById((prev) => ({ ...prev, [id]: "Deleted item" }));
        }
      })();
    });
  }, [companyId, form.lines, itemById, itemLabelById]);

  /** ================= Auto-repair: missing/deleted items =================
   * If a draft references an item that no longer exists (deleted / permission removed),
   * we "repair" the line by clearing the item+uom but preserving quantity/cost/notes.
   * This prevents silent posting with invalid refs and makes the UI obvious.
   */
  const repairedMissingKeyRef = useRef<string>("");

  useEffect(() => {
    if (itemsLoading) return;

    const missing: MissingRef[] = [];
    form.lines.forEach((l, idx) => {
      const id = clean(l.inventoryItemId);
      if (!id) return;
      if (itemById.has(id)) return;

      // If we couldn't resolve by list and the best-effort getById also didn't help,
      // itemLabelById may still be a generic "Saved item".
      const label = itemLabelById[id];
      const looksMissing = !label || label === "Saved item" || label === "Deleted item";
      if (looksMissing) missing.push({ kind: "item", id, lineIndex: idx });
    });

    if (!missing.length) return;

    // Stable key to avoid repeating the same repair every render
    const key = missing.map((m) => `${m.lineIndex}:${m.id}`).join("|");
    if (repairedMissingKeyRef.current === key) return;
    repairedMissingKeyRef.current = key;

    setForm((prev) => {
      const nextLines = prev.lines.map((l, idx) => {
        const hit = missing.find((m) => m.lineIndex === idx);
        if (!hit) return l;
        return {
          ...l,
          inventoryItemId: "",
          uomId: "",
          // preserve notes; append a short hint if empty
          notes: clean(l.notes) ? l.notes : "Item was removed. Please re-select.",
        };
      });
      return { ...prev, lines: nextLines };
    });

    setSubmitError(
      "One or more lines referenced items that no longer exist (deleted or not accessible). Those lines were repaired—please re-select the item and unit."
    );
  }, [itemsLoading, form.lines, itemById, itemLabelById]);



  /** Totals */
  const subtotal = useMemo(
    () => form.lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0),
    [form.lines]
  );

  /** Lines helpers */
  const addLine = () => {
    const nl: GrnLineDraft = {
      inventoryItemId: "",
      uomId: "",
      quantity: 1,
      unitCost: 0,
      expiryDate: null,
      notes: "",
    };
    setForm((f) => ({ ...f, lines: [...f.lines, nl] }));
  };

  const updateLine = (idx: number, patch: Partial<GrnLineDraft>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  };

  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const removeLine = (idx: number) => {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
    setErrors((prev) => {
      const next: FieldErrors = { ...prev };
      if (next.lineErrors) {
        const remapped: FieldErrors["lineErrors"] = {};
        Object.entries(next.lineErrors).forEach(([k, v]) => {
          const i = Number(k);
          if (i < idx) remapped![i] = v;
          else if (i > idx) remapped![i - 1] = v;
        });
        next.lineErrors = remapped;
      }
      return next;
    });
  };

  const validate = (current: GrnDraft): FieldErrors => {
    const e: FieldErrors = {};
    const locId = clean(current.locationId);
    if (!locId) e.locationId = "Warehouse is required.";
    // If draft was created under a different branch, the saved warehouse may not exist in current branch list.
    if (locId && branchId && !warehousesLoading && warehouseOptions.length) {
      const inBranch = warehouseOptions.some((o) => o.value === locId);
      if (!inBranch) e.locationId = "Selected warehouse is not available in this branch. Please choose another.";
    }
    if (!clean(current.receivedDate)) e.receivedDate = "Received date is required.";
    if (!current.lines.length) e.lines = "Add at least one line.";

    const lineErrors: FieldErrors["lineErrors"] = {};
    current.lines.forEach((l, idx) => {
      const le: Partial<Record<keyof GrnLineDraft, string>> = {};
      if (!clean(l.inventoryItemId)) le.inventoryItemId = "Item is required.";
      if (!clean(l.uomId)) le.uomId = "Unit is required.";
      if (!Number.isFinite(l.quantity) || l.quantity <= 0) le.quantity = "Qty must be > 0.";
      if (!Number.isFinite(l.unitCost) || l.unitCost < 0) le.unitCost = "Unit cost cannot be negative.";
      if (Object.keys(le).length) lineErrors[idx] = le;
    });

    if (Object.keys(lineErrors).length) e.lineErrors = lineErrors;
    return e;
  };

  const hasErrors = (e: FieldErrors) =>
    !!(e.locationId || e.receivedDate || e.lines || (e.lineErrors && Object.keys(e.lineErrors).length));

  const buildPayload = (): CreateGrnDraftRequest => ({
    locationId: form.locationId,
    receivedDate: dateOnlyToUtcIso(form.receivedDate),
    supplierName: toNullable(form.supplierName) ?? "",
    notes: toNullable(form.notes),
    lines: form.lines.map((l) => ({
      inventoryItemId: l.inventoryItemId,
      quantity: Number(l.quantity),
      unitId: l.uomId,
      unitCost: Number(l.unitCost),
      expiryDateUtc: l.expiryDate ? dateOnlyToUtcIso(l.expiryDate) : null,
      notes: toNullable(l.notes),
    })),
  });

  const getErrorMessage = (err: unknown, fallback: string) => {
  const e = err as any;

  return (
    e?.response?.data?.message ??
    e?.response?.data?.title ??
    e?.response?.data ??
    e?.message ??
    fallback
  );
};

const redirectToDraft = (id: string) => {
  nav(`/companies/${companyId}/grns/drafts/${id}`, { replace: true });
};

const saveDraft = async () => {
  setSubmitError(null);

  const validationErrors = validate(form);
  setErrors(validationErrors);

  if (hasErrors(validationErrors) || !companyId) return;

  setSaving(true);

  try {
    const payload = buildPayload();

    if (!form.id) {
      const created = await grnApi.createDraft(companyId, payload);
      const createdId = String((created as any).id ?? created);

      setForm((current) => ({
        ...current,
        id: createdId,
      }));

      redirectToDraft(createdId);
      return;
    }

    await grnApi.updateDraft(companyId, form.id, payload);
  } catch (err) {
    setSubmitError(getErrorMessage(err, "Failed to save draft."));
  } finally {
    setSaving(false);
  }
};

const postGrn = async () => {
  setSubmitError(null);

  const validationErrors = validate(form);
  setErrors(validationErrors);

  if (hasErrors(validationErrors) || !companyId) return;

  setPosting(true);

  try {
    let draftId = form.id;

    if (!draftId) {
      const created = await grnApi.createDraft(companyId, buildPayload());
      draftId = String((created as any).id ?? created);

      setForm((current) => ({
        ...current,
        id: draftId,
      }));

      redirectToDraft(draftId);
    }

    const posted = await grnApi.postDraft(companyId, draftId);
    const postedId = String((posted as any).id ?? posted);

    nav(`/companies/${companyId}/grns/${postedId}`);
  } catch (err) {
    setSubmitError(getErrorMessage(err, "Failed to post GRN."));
  } finally {
    setPosting(false);
  }
};

  /** ================= Render helpers ================= */
  const savedWarehouseId = clean(form.locationId);
  const warehouseExists = savedWarehouseId ? warehouseOptions.some((o) => o.value === savedWarehouseId) : false;
  const savedWarehouseLabel =
    warehouseLabelById[savedWarehouseId] || (savedWarehouseId ? "Saved warehouse" : "");

  /** ================= Render ================= */
  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{isEdit ? "Edit GRN Draft" : "New GRN Draft"}</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Select warehouse, then add line items. Units are restricted to each item’s allowed UOM list.
          </div>

          {effectiveDraftId && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
              Draft Id: <b>{effectiveDraftId}</b>
            </div>
          )}

          {!companyId && (
            <div style={{ marginTop: 10, color: "rgb(220, 38, 38)", fontSize: 12 }}>
              companyId missing (AppScope). Cannot submit.
            </div>
          )}
          {!branchId && (
            <div style={{ marginTop: 6, color: "rgb(220, 38, 38)", fontSize: 12 }}>
              branchId missing (AppScope). Select a branch to load warehouses.
            </div>
          )}

          {submitError && <div style={{ marginTop: 10, color: "rgb(220, 38, 38)", fontSize: 12 }}>{submitError}</div>}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Subtotal</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{money(subtotal)}</div>
        </div>
      </div>

      {/* Header Card */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>Warehouse *</label>
            <select
              style={inputStyle(!!errors.locationId)}
              value={savedWarehouseId || ""}
              disabled={!companyId || !branchId || warehousesLoading}
              onChange={(e) => setHeader({ locationId: e.target.value || "" })}
            >
              {/* Show saved name immediately if not present in options yet */}
              {!warehouseExists && savedWarehouseId && (
                <option value={savedWarehouseId}>{savedWarehouseLabel}</option>
              )}

              {/* Placeholder only when nothing saved */}
              {!savedWarehouseId && (
                <option value="" disabled>
                  {!branchId ? "Select branch first…" : warehousesLoading ? "Loading warehouses..." : "Select warehouse…"}
                </option>
              )}

              {warehouseOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.locationId && <div style={errorStyle}>{errors.locationId}</div>}
            {!errors.locationId && savedWarehouseId && !warehouseExists && !warehousesLoading && branchId && (
              <div style={{ marginTop: 6, fontSize: 12, color: "rgb(220, 38, 38)" }}>
                This draft’s warehouse is not in the current branch. Please choose a warehouse for this branch before saving/posting.
              </div>
            )}
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>Received Date *</label>
            <input
              style={inputStyle(!!errors.receivedDate)}
              type="date"
              value={form.receivedDate}
              onChange={(e) => setHeader({ receivedDate: e.target.value })}
            />
            {errors.receivedDate && <div style={errorStyle}>{errors.receivedDate}</div>}
          </div>

          <div style={{ gridColumn: "span 5" }}>
            <label style={labelStyle}>Supplier Name</label>
            <input
              style={inputStyle(false)}
              value={form.supplierName}
              onChange={(e) => setHeader({ supplierName: e.target.value })}
              placeholder="Supplier"
            />
          </div>

          <div style={{ gridColumn: "span 12" }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle(false), minHeight: 72, resize: "vertical" }}
              value={form.notes}
              onChange={(e) => setHeader({ notes: e.target.value })}
              placeholder="Optional receiving notes…"
            />
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Dropdowns show friendly names; saved values will display by name even while options are still loading.
        </div>
      </div>

      {/* Lines */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Lines</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>Items and units are persisted by saved IDs and shown by name.</div>
          </div>

          <button style={primaryBtn} onClick={addLine}>
            + Add Line
          </button>
        </div>

        {errors.lines && <div style={{ ...errorStyle, marginTop: 10 }}>{errors.lines}</div>}

        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Item *</th>
                <th style={thStyle}>Qty *</th>
                <th style={thStyle}>Unit (UOM) *</th>
                <th style={thStyle}>Unit Cost</th>
                <th style={thStyle}>Expiry</th>
                <th style={thStyle}>Line Notes</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Line Total</th>
                <th style={thStyle}></th>
              </tr>
            </thead>

            <tbody>
              {form.lines.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 18, opacity: 0.75 }}>
                    No lines yet. Click <b>Add Line</b>.
                  </td>
                </tr>
              ) : (
                form.lines.map((l, idx) => {
                  const le = errors.lineErrors?.[idx] ?? {};
                  const lineTotal = (Number(l.quantity) || 0) * (Number(l.unitCost) || 0);

                  const savedItemId = clean(l.inventoryItemId);
                  const savedUomId = clean(l.uomId);

                  const item = savedItemId ? itemById.get(savedItemId) : undefined;

                  // Allowed UOMs (filtered)
                  const uomOptions: SelectOption<string>[] =
                    item?.uoms.map((u) => ({ value: u.uomId, label: u.uomName })) ?? [];

                  const itemExists = savedItemId ? itemById.has(savedItemId) : false;
                  const uomExists = savedUomId ? uomOptions.some((o) => o.value === savedUomId) : false;

                  const savedItemLabel = itemLabelById[savedItemId] || (savedItemId ? "Saved item" : "");
                  const savedUomLabel = uomLabelById[savedUomId] || (savedUomId ? "Saved unit" : "");

                  return (
                    <tr key={idx}>
                      {/* Item */}
                      <td style={tdStyle}>
                        <select
                          style={inputStyle(!!le.inventoryItemId)}
                          value={savedItemId || ""}
                          disabled={itemsLoading}
                          onChange={(e) => {
                            const id = e.target.value || "";
                            const it = id ? itemById.get(id) : undefined;

                            updateLine(idx, {
                              inventoryItemId: id,
                              uomId: it?.defaultUomId ?? "",
                            });
                          }}
                        >
                          {/* Show saved label immediately (name-first) */}
                          {!itemExists && savedItemId && <option value={savedItemId}>{savedItemLabel}</option>}

                          {!savedItemId && (
                            <option value="" disabled>
                              {itemsLoading ? "Loading items..." : "Select item…"}
                            </option>
                          )}

                          {itemOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {le.inventoryItemId && <div style={errorStyle}>{le.inventoryItemId}</div>}
                      </td>

                      {/* Qty */}
                      <td style={tdStyle}>
                        <input
                          style={inputStyle(!!le.quantity)}
                          type="number"
                          min={1}
                          step={1}
                          value={l.quantity}
                          onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                        />
                        {le.quantity && <div style={errorStyle}>{le.quantity}</div>}
                      </td>

                      {/* UOM */}
                      <td style={tdStyle}>
                        <select
                          style={inputStyle(!!le.uomId)}
                          value={savedUomId || ""}
                          disabled={!savedItemId}
                          onChange={(e) => updateLine(idx, { uomId: e.target.value || "" })}
                        >
                          {/* Show saved unit name immediately (even if not in allowed list) */}
                          {!uomExists && savedUomId && <option value={savedUomId}>{savedUomLabel}</option>}

                          {!savedUomId && (
                            <option value="" disabled>
                              {!savedItemId
                                ? "Select item first…"
                                : uomOptions.length === 0
                                ? "Loading units..."
                                : "Select unit…"}
                            </option>
                          )}

                          {uomOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {le.uomId && <div style={errorStyle}>{le.uomId}</div>}

                                          </td>

                      {/* Unit Cost */}
                      <td style={tdStyle}>
                        <input
                          style={inputStyle(!!le.unitCost)}
                          type="number"
                          min={0}
                          value={l.unitCost}
                          onChange={(e) => updateLine(idx, { unitCost: Number(e.target.value) })}
                        />
                        {le.unitCost && <div style={errorStyle}>{le.unitCost}</div>}
                      </td>

                      {/* Expiry */}
                      <td style={tdStyle}>
                        <input
                          style={inputStyle(false)}
                          type="date"
                          value={l.expiryDate ?? ""}
                          onChange={(e) => updateLine(idx, { expiryDate: e.target.value || null })}
                        />
                      </td>

                      {/* Notes */}
                      <td style={tdStyle}>
                        <input
                          style={inputStyle(false)}
                          value={l.notes}
                          onChange={(e) => updateLine(idx, { notes: e.target.value })}
                          placeholder="Optional"
                        />
                      </td>

                      {/* Total */}
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{money(lineTotal)}</td>

                      {/* Remove */}
                      <td style={tdStyle}>
                        <button style={dangerBtn} onClick={() => removeLine(idx)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <div style={{ minWidth: 280 }}>
            <div style={totRow}>
              <span style={{ opacity: 0.75 }}>Subtotal</span>
              <b>{money(subtotal)}</b>
            </div>
            <div style={{ ...totRow, marginTop: 6, fontSize: 16 }}>
              <span>Total</span>
              <b>{money(subtotal)}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div style={stickyBar}>
        <div style={{ opacity: 0.85 }}>
          <b>Tip:</b> Save Draft first, then Post when you confirm quantities & cost.
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} onClick={() => nav(`/companies/${companyId}/grns/drafts`)}>
            Drafts
          </button>

          <button style={secondaryBtn} onClick={saveDraft} disabled={saving || posting || !companyId}>
            {saving ? "Saving..." : form.id ? "Update Draft" : "Save Draft"}
          </button>

          <button style={primaryBtn} onClick={postGrn} disabled={saving || posting || !companyId}>
            {posting ? "Posting..." : "Post GRN"}
          </button>
        </div>
      </div>
    </div>
  );
}
