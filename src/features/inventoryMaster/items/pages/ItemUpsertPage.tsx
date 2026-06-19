// src/features/inventoryMaster/items/pages/ItemUpsertPage.tsx

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { inventoryItemsApi } from "../api/inventoryItemsApi";
import type { CreateItemBody, UpdateItemBody } from "../api/inventoryItemsApi";
import type {
  InventoryCatalogs,
  InventoryItemDto,
  ItemUomDto,
  UomDto,
  CategoryDto,
  ItemTypeCatalogDto,
} from "../types";
import type { ItemType } from "../constants/itemTypes";
import UomConversionGrid from "../components/UomConversionGrid";
import { extractApiError } from "./InventoryItemsPage";

function isPhysical(type: ItemType): boolean {
  return type !== "Service";
}

function validateUomRows(rows: ItemUomDto[]): string | null {
  if (!rows.length) return null;

  const ids = rows.map((r) => r.uomId).filter(Boolean);
  const uniq = new Set(ids);

  if (uniq.size !== ids.length) {
    return "Each unit of measure must appear only once.";
  }

  if (rows.some((r) => !r.uomId || !r.toBaseFactor || r.toBaseFactor <= 0)) {
    return "All rows must have a unit selected and a conversion factor greater than zero.";
  }

  if (rows.filter((r) => r.isBase).length > 1) {
    return "Only one unit can be marked as the base unit.";
  }

  if (rows.filter((r) => r.isIssue).length > 1) {
    return "Only one unit can be marked as the issue unit.";
  }

  if (rows.filter((r) => r.isIssue).length === 0) {
    return "Select one unit as the issue unit.";
  }

  return null;
}

function ensureBaseRow(
  rows: ItemUomDto[],
  baseUomId: string,
  uoms: UomDto[]
): ItemUomDto[] {
  if (!baseUomId) return rows;

  const alreadyHasBase = rows.some((r) => r.isBase && r.uomId === baseUomId);
  if (alreadyHasBase) return rows;

  const base = uoms.find((x) => x.id === baseUomId);
  if (!base) return rows;

  return [
    {
      uomId: baseUomId,
      code: base.code || base.symbol || "",
      name: base.name,
      toBaseFactor: 1,
      isBase: true,
      isPurchase: false,
      isIssue: false,
      isRecipe: false,
      isConsume: false,
      isCount: true,
      isActive: true,
    },
    ...rows,
  ];
}

interface ItemModel {
  name: string;
  localName: string;
  sku: string;
  barcode: string;
  type: ItemType;
  categoryId: string;
  baseUomId: string;
  allowedUoms: ItemUomDto[];
  trackInventory: boolean;
  reorderLevel: number;
  costingMethod: string;
  defaultCost: string;
  defaultPrice: string;
  isActive: boolean;
}

const EMPTY_MODEL: ItemModel = {
  name: "",
  localName: "",
  sku: "",
  barcode: "",
  type: "Ingredient",
  categoryId: "",
  baseUomId: "",
  allowedUoms: [],
  trackInventory: true,
  reorderLevel: 0,
  costingMethod: "",
  defaultCost: "",
  defaultPrice: "",
  isActive: true,
};

function dtoToModel(dto: InventoryItemDto): ItemModel {
  return {
    name: dto.name ?? "",
    localName: dto.localName ?? "",
    sku: dto.sku ?? "",
    barcode: dto.barcode ?? "",
    type: dto.type ?? "Ingredient",
    categoryId: dto.categoryId ?? "",
    baseUomId: dto.baseUomId ?? "",
    allowedUoms: Array.isArray(dto.allowedUoms) ? dto.allowedUoms : [],
    trackInventory: dto.trackInventory ?? true,
    reorderLevel: dto.reorderLevel ?? 0,
    costingMethod: dto.costingMethod ?? "",
    defaultCost: dto.defaultCost != null ? String(dto.defaultCost) : "",
    defaultPrice: dto.defaultPrice != null ? String(dto.defaultPrice) : "",
    isActive: dto.isActive ?? true,
  };
}

interface Touched {
  name: boolean;
  categoryId: boolean;
  baseUomId: boolean;
  uoms: boolean;
}

const UNTOUCHED: Touched = {
  name: false,
  categoryId: false,
  baseUomId: false,
  uoms: false,
};

function validate(model: ItemModel, physical: boolean) {
  return {
    nameOk: model.name.trim().length >= 2,
    catOk: Boolean(model.categoryId),
    baseOk: !physical || Boolean(model.baseUomId),
    uomError: physical ? validateUomRows(model.allowedUoms) : null,
  };
}

export default function ItemUpsertPage() {
  const navigate = useNavigate();
  const { companyId } = useAppScope();

  const params = useParams<{
    id?: string;
    itemId?: string;
  }>();

  const itemId = params.itemId ?? params.id ?? "";
  const isEdit = Boolean(itemId);

  const itemsListPath = companyId
    ? `/companies/${companyId}/inventory-master/items`
    : "/platform";

  const [catalogs, setCatalogs] = useState<InventoryCatalogs | null>(null);
  const [model, setModel] = useState<ItemModel>(EMPTY_MODEL);
  const [touched, setTouched] = useState<Touched>(UNTOUCHED);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const originalBaseUomId = useRef<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!companyId) return;

    let cancelled = false;

    setLoadError(null);
    setSubmitError(null);

    async function load() {
      try {
        const [catalogsRaw, itemDto] = await Promise.all([
          inventoryItemsApi.loadCatalogs(companyId),
          isEdit ? inventoryItemsApi.get(companyId, itemId) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setCatalogs(catalogsRaw);

        if (itemDto) {
          originalBaseUomId.current = itemDto.baseUomId ?? null;
          setModel(dtoToModel(itemDto));
        } else {
          originalBaseUomId.current = null;
          setModel(EMPTY_MODEL);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(extractApiError(e));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [companyId, itemId, isEdit]);

  const uoms: UomDto[] = useMemo(() => catalogs?.uoms ?? [], [catalogs]);
  const categories: CategoryDto[] = useMemo(
    () => catalogs?.categories ?? [],
    [catalogs]
  );
  const itemTypes: ItemTypeCatalogDto[] = useMemo(
    () => catalogs?.itemTypes ?? [],
    [catalogs]
  );

  const physical = isPhysical(model.type);
  const validation = useMemo(() => validate(model, physical), [model, physical]);

  const canSave =
    validation.nameOk &&
    validation.catOk &&
    validation.baseOk &&
    validation.uomError === null;

  const baseUomChanged =
    isEdit &&
    Boolean(originalBaseUomId.current) &&
    Boolean(model.baseUomId) &&
    model.baseUomId !== originalBaseUomId.current;

  const set = useCallback(<K extends keyof ItemModel>(key: K, value: ItemModel[K]) => {
    setModel((current) => ({ ...current, [key]: value }));
  }, []);

  const touchAll = useCallback(() => {
    setTouched({
      name: true,
      categoryId: true,
      baseUomId: true,
      uoms: true,
    });
  }, []);

  const save = useCallback(async () => {
    if (!companyId || inFlight.current) return;

    touchAll();

    if (!canSave) {
      setSubmitError(validation.uomError ?? "Complete all required fields before saving.");
      return;
    }

    const cost = model.defaultCost ? Number(model.defaultCost) : null;
    const price = model.defaultPrice ? Number(model.defaultPrice) : null;

    if (cost !== null && Number.isNaN(cost)) {
      setSubmitError("Default cost must be a number.");
      return;
    }

    if (price !== null && Number.isNaN(price)) {
      setSubmitError("Default price must be a number.");
      return;
    }

    setSubmitError(null);
    setSaving(true);
    inFlight.current = true;

    try {
      const normalizedUoms = physical
        ? ensureBaseRow(model.allowedUoms, model.baseUomId, uoms)
        : [];

      if (isEdit) {
        const body: UpdateItemBody = {
          id: itemId,
          companyId,
          name: model.name.trim(),
          localName: model.localName.trim() || null,
          sku: model.sku.trim() || null,
          barcode: model.barcode.trim() || null,
          categoryId: model.categoryId || null,
          baseUomId: physical ? model.baseUomId : "",
          type: model.type,
          allowedUoms: normalizedUoms,
          trackInventory: physical ? model.trackInventory : false,
          defaultCost: cost,
          defaultPrice: price,
          reorderLevel: model.reorderLevel,
          isActive: model.isActive,
        };

        await inventoryItemsApi.update(companyId, itemId, body);
      } else {
        const body: CreateItemBody = {
          companyId,
          name: model.name.trim(),
          localName: model.localName.trim() || null,
          sku: model.sku.trim() || null,
          barcode: model.barcode.trim() || null,
          categoryId: model.categoryId || null,
          baseUomId: physical ? model.baseUomId : "",
          type: model.type,
          allowedUoms: normalizedUoms,
          trackInventory: physical ? model.trackInventory : false,
          defaultCost: cost,
          defaultPrice: price,
          reorderLevel: model.reorderLevel,
          isActive: true,
        };

        await inventoryItemsApi.create(companyId, body);
      }

      navigate(itemsListPath, { replace: true });
    } catch (e) {
      setSubmitError(extractApiError(e));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [
    companyId,
    itemId,
    isEdit,
    model,
    physical,
    uoms,
    canSave,
    validation.uomError,
    navigate,
    itemsListPath,
    touchAll,
  ]);

  if (!companyId) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Missing company scope</div>
          <div style={{ ...S.note, marginTop: 6 }}>
            Open this page from the company workspace.
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={S.page}>
        <div style={S.errorCard}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "rgb(220,38,38)" }}>
            Failed to load
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "rgb(220,38,38)" }}>
            {loadError}
          </div>
          <button style={{ ...S.secondaryBtn, marginTop: 14 }} onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!catalogs) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>
            Loading…
          </div>
        </div>
      </div>
    );
  }

  const primaryBtn: CSSProperties = {
    ...S.primaryBtn,
    opacity: !canSave || saving ? 0.55 : 1,
    cursor: !canSave || saving ? "not-allowed" : "pointer",
  };

  return (
    <div style={S.page}>
      <div style={S.headerRow}>
        <div>
          <div style={S.title}>{isEdit ? "Edit item" : "New item"}</div>
          <div style={S.subtitle}>
            {isEdit
              ? "Update item details, units, and conversion rules."
              : "Register a new item with base unit and conversion rules."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={S.secondaryBtn}
            onClick={() => navigate(itemsListPath)}
            disabled={saving}
          >
            Cancel
          </button>

          <button type="button" style={primaryBtn} onClick={save} disabled={!canSave || saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create item"}
          </button>
        </div>
      </div>

      {submitError ? (
        <div style={S.submitErrorCard}>
          <div style={{ fontWeight: 800, fontSize: 12, color: "rgb(220,38,38)" }}>
            Action needed
          </div>
          <div style={{ marginTop: 5, fontSize: 12, color: "rgb(220,38,38)" }}>
            {submitError}
          </div>
        </div>
      ) : null}

      {baseUomChanged ? (
        <div style={S.warningCard}>
          <div style={{ fontWeight: 800, fontSize: 12, color: "rgba(120,53,15,1)" }}>
            ⚠ Base UOM change detected
          </div>
          <div style={{ marginTop: 5, fontSize: 12, color: "rgba(120,53,15,1)" }}>
            Changing the base unit on an item with stock transactions may corrupt historical
            quantities and valuations. Confirm this is intentional.
          </div>
        </div>
      ) : null}

      <div style={S.card}>
        <SectionHead title="Basics" hint="Item identity and classification." />

        <div style={S.grid}>
          <div style={{ gridColumn: "span 6" }}>
            <Label required>Item name</Label>
            <input
              style={inputStyle(touched.name && !validation.nameOk)}
              value={model.name}
              placeholder="e.g., Flour 1kg, Mineral Water 500ml"
              onChange={(e) => set("name", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            />
            {touched.name && !validation.nameOk ? (
              <div style={S.err}>Item name must be at least 2 characters.</div>
            ) : null}
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <Label>Local name</Label>
            <input
              style={inputStyle(false)}
              value={model.localName}
              placeholder="Local name optional"
              dir="auto"
              onChange={(e) => set("localName", e.target.value)}
            />
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <Label>SKU</Label>
            <input
              style={inputStyle(false)}
              value={model.sku}
              placeholder="e.g., RAW-FLOUR-1KG"
              onChange={(e) => set("sku", e.target.value)}
            />
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <Label>Barcode</Label>
            <input
              style={inputStyle(false)}
              value={model.barcode}
              placeholder="EAN-13, QR, etc."
              onChange={(e) => set("barcode", e.target.value)}
            />
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <Label required>Item type</Label>
            <select
              style={inputStyle(false)}
              value={model.type}
              onChange={(e) => {
                const type = e.target.value as ItemType;
                setModel((m) => ({
                  ...m,
                  type,
                  trackInventory: type === "Service" ? false : m.trackInventory,
                  baseUomId: type === "Service" ? "" : m.baseUomId,
                  allowedUoms: type === "Service" ? [] : m.allowedUoms,
                }));
              }}
            >
              {itemTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <Label required>Category</Label>
            <select
              style={inputStyle(touched.categoryId && !validation.catOk)}
              value={model.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, categoryId: true }))}
            >
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {touched.categoryId && !validation.catOk ? (
              <div style={S.err}>Category is required.</div>
            ) : null}
          </div>

          {isEdit ? (
            <div style={{ gridColumn: "span 3" }}>
              <Label>Status</Label>
              <select
                style={inputStyle(false)}
                value={model.isActive ? "active" : "inactive"}
                onChange={(e) => set("isActive", e.target.value === "active")}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          ) : null}
        </div>
      </div>

      <div style={S.card}>
        <SectionHead
          title="Inventory behaviour"
          hint="Controls how stock is tracked and when alerts are triggered."
        />

        <div style={S.grid}>
          <div style={{ gridColumn: "span 4" }}>
            <Label>Track inventory</Label>
            <select
              style={inputStyle(false)}
              value={model.trackInventory ? "yes" : "no"}
              disabled={!physical}
              onChange={(e) => set("trackInventory", e.target.value === "yes")}
            >
              <option value="yes">Yes — track stock levels</option>
              <option value="no">No — non-stock item</option>
            </select>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <Label>Reorder level</Label>
            <input
              style={inputStyle(false)}
              type="number"
              min={0}
              step={1}
              value={model.reorderLevel}
              disabled={!model.trackInventory || !physical}
              onChange={(e) => set("reorderLevel", Math.max(0, Number(e.target.value)))}
            />
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <Label>Costing method</Label>
            <select
              style={inputStyle(false)}
              value={model.costingMethod}
              disabled={!physical}
              onChange={(e) => set("costingMethod", e.target.value)}
            >
              <option value="">Inherit from company default</option>
              <option value="AVCO">AVCO — weighted average cost</option>
              <option value="FIFO">FIFO — first in, first out</option>
              <option value="Standard">Standard cost</option>
            </select>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <SectionHead
          title="Costing defaults"
          hint="Fallback defaults used when creating purchase or sales documents."
        />

        <div style={S.grid}>
          <div style={{ gridColumn: "span 4" }}>
            <Label>Default cost per base UOM</Label>
            <input
              style={inputStyle(false)}
              type="number"
              min={0}
              step="0.000001"
              value={model.defaultCost}
              placeholder="0.000000"
              onChange={(e) => set("defaultCost", e.target.value)}
            />
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <Label>Default price per base UOM</Label>
            <input
              style={inputStyle(false)}
              type="number"
              min={0}
              step="0.000001"
              value={model.defaultPrice}
              placeholder="0.000000"
              onChange={(e) => set("defaultPrice", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={S.card}>
        <SectionHead
          title="Units of measure & conversions"
          hint="Define base unit and every unit used in purchasing, issuing, recipes, and counts."
        />

        {!physical ? (
          <div style={{ fontSize: 12.5, color: "#64748b" }}>
            Service items do not require unit-of-measure configuration.
          </div>
        ) : (
          <>
            <div style={S.grid}>
              <div style={{ gridColumn: "span 5" }}>
                <Label required>Base UOM</Label>
                <select
                  style={inputStyle(touched.baseUomId && !validation.baseOk)}
                  value={model.baseUomId}
                  onChange={(e) => {
                    set("baseUomId", e.target.value);
                    set("allowedUoms", []);
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, baseUomId: true }))}
                >
                  <option value="">Select base unit…</option>
                  {uoms.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code ? `${u.code} — ${u.name}` : u.name}
                    </option>
                  ))}
                </select>

                {touched.baseUomId && !validation.baseOk ? (
                  <div style={S.err}>Base UOM is required for physical items.</div>
                ) : null}
              </div>
            </div>

            {model.baseUomId ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 800, marginTop: 18, marginBottom: 10 }}>
                  Allowed UOMs & conversion factors
                </div>

                <UomConversionGrid
                  baseUomId={model.baseUomId}
                  uoms={uoms}
                  rows={model.allowedUoms}
                  onChange={(rows) => {
                    set("allowedUoms", rows);
                    setTouched((t) => ({ ...t, uoms: true }));
                  }}
                />

                {touched.uoms && validation.uomError ? (
                  <div style={S.uomWarning}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(120,53,15,1)" }}>
                      Fix UOM configuration
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "rgba(120,53,15,1)" }}>
                      {validation.uomError}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>

      <div style={S.bottomActions}>
        <button
          type="button"
          style={S.secondaryBtn}
          onClick={() => navigate(itemsListPath)}
          disabled={saving}
        >
          Cancel
        </button>

        <button type="button" style={primaryBtn} onClick={save} disabled={!canSave || saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create item"}
        </button>
      </div>
    </div>
  );
}

function Label({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label style={S.label}>
      {children}
      {required ? <span style={{ color: "rgb(220,38,38)" }}> *</span> : null}
    </label>
  );
}

function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={S.sectionHead}>
      <div>
        <div style={S.sectionTitle}>{title}</div>
        <div style={S.sectionHint}>{hint}</div>
      </div>
    </div>
  );
}

function inputStyle(invalid: boolean): CSSProperties {
  return {
    width: "100%",
    padding: "10px",
    borderRadius: 10,
    border: invalid
      ? "1px solid rgba(220,38,38,0.9)"
      : "1px solid rgba(0,0,0,0.15)",
    outline: "none",
    background: "white",
    color: "#0f172a",
    fontSize: 13,
    boxSizing: "border-box",
  };
}

const S: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "18px 14px 60px",
  },
  headerRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: -0.3,
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12.5,
    opacity: 0.75,
    color: "#0f172a",
  },
  card: {
    marginTop: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 12,
    padding: 18,
    background: "white",
    color: "#0f172a",
  },
  errorCard: {
    marginTop: 14,
    border: "1px solid rgba(220,38,38,0.35)",
    borderRadius: 12,
    padding: 18,
    background: "rgba(220,38,38,0.05)",
    color: "#0f172a",
  },
  submitErrorCard: {
    marginTop: 10,
    border: "1px solid rgba(220,38,38,0.35)",
    borderRadius: 12,
    padding: 18,
    background: "rgba(220,38,38,0.06)",
    color: "#0f172a",
  },
  warningCard: {
    marginTop: 10,
    border: "1px solid rgba(245,158,11,0.45)",
    borderRadius: 12,
    padding: 18,
    background: "rgba(245,158,11,0.08)",
    color: "#0f172a",
  },
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    paddingBottom: 10,
    marginBottom: 14,
    borderBottom: "1px solid rgba(0,0,0,0.08)",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
  },
  sectionHint: {
    marginTop: 3,
    fontSize: 12,
    color: "#0f172a",
    opacity: 0.65,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    opacity: 0.75,
    marginBottom: 6,
  },
  note: {
    marginTop: 6,
    fontSize: 11.5,
    opacity: 0.65,
  },
  err: {
    color: "rgb(220,38,38)",
    fontSize: 12,
    marginTop: 5,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: 14,
  },
  primaryBtn: {
    padding: "10px 20px",
    borderRadius: 10,
    border: "1px solid transparent",
    background: "#0f172a",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },
  secondaryBtn: {
    padding: "10px 20px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "white",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },
  uomWarning: {
    marginTop: 12,
    borderRadius: 10,
    border: "1px solid rgba(245,158,11,0.40)",
    background: "rgba(245,158,11,0.09)",
    padding: "10px 14px",
  },
  bottomActions: {
    marginTop: 20,
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
};