// src/features/inventoryMaster/items/pages/ItemUpsertPage.tsx
//
// Full-page create / edit form for a single inventory item.
//   • /inventory-master/items/new        → create
//   • /inventory-master/items/:id/edit   → update
//
// Responsibilities:
//   • Load catalogs + item (parallel on edit) via inventoryItemsApi
//   • Validate all fields including UOM conversion grid (mirrors backend rules)
//   • POST (create) or PUT (update)
//   • Soft-warn when base UOM changes on an item that may have stock history

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope }       from "../../../../app/useAppScope";
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
import type { ItemType }     from "../constants/itemTypes";
import UomConversionGrid     from "../components/UomConversionGrid";
import { extractApiError }   from "./InventoryItemsPage";

// =============================================================================
// Domain helpers
// =============================================================================

function isPhysical(type: ItemType): boolean {
  return type !== "Service";
}

/**
 * Client-side UOM validation — mirrors BuildItemUomEntries rules on the
 * backend so errors are caught before the round-trip.
 */
function validateUomRows(rows: ItemUomDto[]): string | null {
  if (!rows.length) return null;

  const ids  = rows.map(r => r.uomId).filter(Boolean);
  const uniq = new Set(ids);
  if (uniq.size !== ids.length)
    return "Each unit of measure must appear only once.";

  if (rows.some(r => !r.uomId || !r.toBaseFactor || r.toBaseFactor <= 0))
    return "All rows must have a unit selected and a conversion factor greater than zero.";

  if (rows.filter(r => r.isBase).length > 1)
    return "Only one unit can be marked as the base unit.";

  if (rows.filter(r => r.isIssue).length > 1)
    return "Only one unit can be marked as the issue unit.";

  if (rows.filter(r => r.isIssue).length === 0)
    return "Select one unit as the issue (dispensing) unit.";

  return null;
}

/**
 * Injects the base-UOM row (factor = 1) when absent.
 * Called at save time only — never mutates live model state.
 */
function ensureBaseRow(
  rows:      ItemUomDto[],
  baseUomId: string,
  uoms:      UomDto[],
): ItemUomDto[] {
  if (!baseUomId) return rows;
  if (rows.some(r => r.isBase && r.uomId === baseUomId)) return rows;

  const u = uoms.find(x => x.id === baseUomId);
  if (!u) return rows;

  return [
    {
      uomId:        baseUomId,
      code:         u.code || u.symbol || "",
      name:         u.name,
      toBaseFactor: 1,
      isBase:       true,
      isPurchase:   false,
      isIssue:      false,
      isRecipe:     false,
      isConsume:    false,
      isCount:      true,
      isActive:     true,
    },
    ...rows,
  ];
}

// =============================================================================
// Form model
// =============================================================================

interface ItemModel {
  name:           string;
  localName:      string;
  sku:            string;
  barcode:        string;
  type:           ItemType;
  categoryId:     string;
  baseUomId:      string;
  allowedUoms:    ItemUomDto[];
  trackInventory: boolean;
  reorderLevel:   number;
  costingMethod:  string;
  defaultCost:    string;   // string so <input> stays controlled without NaN quirks
  defaultPrice:   string;
  isActive:       boolean;
}

const EMPTY_MODEL: ItemModel = {
  name:           "",
  localName:      "",
  sku:            "",
  barcode:        "",
  type:           "Ingredient",
  categoryId:     "",
  baseUomId:      "",
  allowedUoms:    [],
  trackInventory: true,
  reorderLevel:   0,
  costingMethod:  "",
  defaultCost:    "",
  defaultPrice:   "",
  isActive:       true,
};

function dtoToModel(dto: InventoryItemDto): ItemModel {
  return {
    name:           dto.name           ?? "",
    localName:      dto.localName      ?? "",
    sku:            dto.sku            ?? "",
    barcode:        dto.barcode        ?? "",
    type:           dto.type           ?? "Ingredient",
    categoryId:     dto.categoryId     ?? "",
    baseUomId:      dto.baseUomId      ?? "",
    allowedUoms:    Array.isArray(dto.allowedUoms) ? dto.allowedUoms : [],
    trackInventory: dto.trackInventory ?? true,
    reorderLevel:   dto.reorderLevel   ?? 0,
    costingMethod:  dto.costingMethod  ?? "",
    defaultCost:    dto.defaultCost    != null ? String(dto.defaultCost)  : "",
    defaultPrice:   dto.defaultPrice   != null ? String(dto.defaultPrice) : "",
    isActive:       dto.isActive       ?? true,
  };
}

// =============================================================================
// Validation
// =============================================================================

interface Touched {
  name:       boolean;
  categoryId: boolean;
  baseUomId:  boolean;
  uoms:       boolean;
}

const UNTOUCHED: Touched = {
  name: false, categoryId: false, baseUomId: false, uoms: false,
};

interface Validation {
  nameOk:   boolean;
  catOk:    boolean;
  baseOk:   boolean;
  uomError: string | null;
}

function validate(model: ItemModel, physical: boolean): Validation {
  return {
    nameOk:   model.name.trim().length >= 2,
    catOk:    !!model.categoryId,
    baseOk:   !physical || !!model.baseUomId,
    uomError: physical ? validateUomRows(model.allowedUoms) : null,
  };
}

// =============================================================================
// Styles  (GRN / inventory design language)
// =============================================================================

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
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    paddingBottom: 10,
    marginBottom: 14,
    borderBottom: "1px solid rgba(0,0,0,0.08)",
  },
  sectionTitle: { fontSize: 13, fontWeight: 800, color: "#0f172a" },
  sectionHint:  { marginTop: 3, fontSize: 12, color: "#0f172a", opacity: 0.65 },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    opacity: 0.75,
    marginBottom: 6,
  },
  note:  { marginTop: 6, fontSize: 11.5, opacity: 0.65 },
  err:   { color: "rgb(220,38,38)", fontSize: 12, marginTop: 5 },
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
};

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

function Req() {
  return <span style={{ color: "rgb(220,38,38)" }}> *</span>;
}

// =============================================================================
// Page
// =============================================================================

export default function ItemUpsertPage() {
  const navigate      = useNavigate();
  const { companyId } = useAppScope();
  const { id }        = useParams<{ id: string }>();
  const isEdit        = !!id;

  // ── State ───────────────────────────────────────────────────────────────────

  const [catalogs,    setCatalogs]    = useState<InventoryCatalogs | null>(null);
  const [model,       setModel]       = useState<ItemModel>(EMPTY_MODEL);
  const [touched,     setTouched]     = useState<Touched>(UNTOUCHED);
  const [saving,      setSaving]      = useState(false);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const originalBaseUomId = useRef<string | null>(null);
  const inFlight          = useRef(false);

  // ── Load ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoadError(null);

    (async () => {
      try {
        const [catalogsRaw, itemDto] = await Promise.all([
          inventoryItemsApi.loadCatalogs(companyId),
          isEdit ? inventoryItemsApi.get(companyId, id!) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setCatalogs(catalogsRaw);

        if (itemDto) {
          originalBaseUomId.current = itemDto.baseUomId ?? null;
          setModel(dtoToModel(itemDto));
        }
      } catch (e) {
        if (!cancelled) setLoadError(extractApiError(e));
      }
    })();

    return () => { cancelled = true; };
  }, [companyId, id, isEdit]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const uoms:       UomDto[]             = useMemo(() => catalogs?.uoms       ?? [], [catalogs]);
  const categories: CategoryDto[]        = useMemo(() => catalogs?.categories ?? [], [catalogs]);
  const itemTypes:  ItemTypeCatalogDto[] = useMemo(() => catalogs?.itemTypes  ?? [], [catalogs]);

  const physical = isPhysical(model.type);
  const v        = useMemo(() => validate(model, physical), [model, physical]);
  const canSave  = v.nameOk && v.catOk && v.baseOk && v.uomError === null;

  const baseUomChanged =
    isEdit &&
    !!originalBaseUomId.current &&
    !!model.baseUomId &&
    model.baseUomId !== originalBaseUomId.current;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const set = useCallback(<K extends keyof ItemModel>(key: K, value: ItemModel[K]) => {
    setModel(m => ({ ...m, [key]: value }));
  }, []);

  const touchAll = useCallback(() => {
    setTouched({ name: true, categoryId: true, baseUomId: true, uoms: true });
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (!companyId || inFlight.current) return;

    touchAll();

    if (!v.nameOk || !v.catOk) {
      setSubmitError("Complete all required fields before saving.");
      return;
    }
    if (physical && !v.baseOk) {
      setSubmitError("Select a base unit of measure.");
      return;
    }
    if (physical && v.uomError) {
      setSubmitError(v.uomError);
      return;
    }

    const cost  = model.defaultCost  ? Number(model.defaultCost)  : null;
    const price = model.defaultPrice ? Number(model.defaultPrice) : null;
    if (cost  !== null && Number.isNaN(cost))  { setSubmitError("Default cost must be a number.");  return; }
    if (price !== null && Number.isNaN(price)) { setSubmitError("Default price must be a number."); return; }

    setSubmitError(null);
    inFlight.current = true;
    setSaving(true);

    try {
      const normalizedUoms = physical
        ? ensureBaseRow(model.allowedUoms, model.baseUomId, uoms)
        : [];

      if (isEdit) {
        const body: UpdateItemBody = {
          id:             id!,
          companyId,
          name:           model.name.trim(),
          localName:      model.localName.trim()  || null,
          sku:            model.sku.trim()         || null,
          barcode:        model.barcode.trim()     || null,
          categoryId:     model.categoryId         || null,
          baseUomId:      physical ? model.baseUomId : "",
          type:           model.type,
          allowedUoms:    normalizedUoms,
          trackInventory: physical ? model.trackInventory : false,
          defaultCost:    cost,
          defaultPrice:   price,
          reorderLevel:   model.reorderLevel,
          isActive:       model.isActive,
        };
        await inventoryItemsApi.update(companyId, id!, body);
      } else {
        const body: CreateItemBody = {
          companyId,
          name:           model.name.trim(),
          localName:      model.localName.trim()  || null,
          sku:            model.sku.trim()         || null,
          barcode:        model.barcode.trim()     || null,
          categoryId:     model.categoryId         || null,
          baseUomId:      physical ? model.baseUomId : "",
          type:           model.type,
          allowedUoms:    normalizedUoms,
          trackInventory: physical ? model.trackInventory : false,
          defaultCost:    cost,
          defaultPrice:   price,
          reorderLevel:   model.reorderLevel,
          isActive:       true,
        };
        await inventoryItemsApi.create(companyId, body);
      }

      navigate("/inventory-master/items");
    } catch (e) {
      setSubmitError(extractApiError(e));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [companyId, id, isEdit, model, physical, uoms, v, navigate, touchAll]);

  // ── Guards ───────────────────────────────────────────────────────────────────

  if (!companyId) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Select a company</div>
          <div style={{ ...S.note, marginTop: 6 }}>
            Choose your company context to manage inventory items.
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={S.page}>
        <div style={{
          ...S.card,
          border: "1px solid rgba(220,38,38,0.35)",
          background: "rgba(220,38,38,0.05)",
        }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "rgb(220,38,38)" }}>
            Failed to load
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "rgb(220,38,38)" }}>
            {loadError}
          </div>
          <button
            style={{ ...S.secondaryBtn, marginTop: 14 }}
            onClick={() => window.location.reload()}
          >
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
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Loading…</div>
        </div>
      </div>
    );
  }

  const primaryBtn: CSSProperties = {
    ...S.primaryBtn,
    opacity: (!canSave || saving) ? 0.55 : 1,
    cursor:  (!canSave || saving) ? "not-allowed" : "pointer",
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* ── Header ── */}
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
            style={S.secondaryBtn}
            onClick={() => navigate("/inventory-master/items")}
            disabled={saving}
          >
            Cancel
          </button>
          <button style={primaryBtn} onClick={save} disabled={!canSave || saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create item"}
          </button>
        </div>
      </div>

      {/* ── Submit error ── */}
      {submitError && (
        <div style={{
          ...S.card, marginTop: 10,
          border: "1px solid rgba(220,38,38,0.35)",
          background: "rgba(220,38,38,0.06)",
        }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: "rgb(220,38,38)" }}>
            Action needed
          </div>
          <div style={{ marginTop: 5, fontSize: 12, color: "rgb(220,38,38)" }}>
            {submitError}
          </div>
        </div>
      )}

      {/* ── Base-UOM change warning ── */}
      {baseUomChanged && (
        <div style={{
          ...S.card, marginTop: 10,
          border: "1px solid rgba(245,158,11,0.45)",
          background: "rgba(245,158,11,0.08)",
        }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: "rgba(120,53,15,1)" }}>
            ⚠ Base UOM change detected
          </div>
          <div style={{ marginTop: 5, fontSize: 12, color: "rgba(120,53,15,1)" }}>
            Changing the base unit on an item that already has stock transactions
            may corrupt historical quantities and valuations. Confirm this is intentional.
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — Basics
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={S.card}>
        <div style={S.sectionHead}>
          <div>
            <div style={S.sectionTitle}>Basics</div>
            <div style={S.sectionHint}>Item identity and classification.</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>

          <div style={{ gridColumn: "span 6" }}>
            <label style={S.label}>Item name<Req /></label>
            <input
              style={inputStyle(touched.name && !v.nameOk)}
              value={model.name}
              placeholder="e.g., Flour 1kg, Mineral Water 500ml"
              onChange={e => set("name", e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, name: true }))}
            />
            {touched.name && !v.nameOk && (
              <div style={S.err}>Item name must be at least 2 characters.</div>
            )}
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <label style={S.label}>Local name</label>
            <input
              style={inputStyle(false)}
              value={model.localName}
              placeholder="الاسم المحلي (optional)"
              dir="auto"
              onChange={e => set("localName", e.target.value)}
            />
            <div style={S.note}>Used for Arabic / RTL display on reports.</div>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={S.label}>SKU</label>
            <input
              style={inputStyle(false)}
              value={model.sku}
              placeholder="e.g., RAW-FLOUR-1KG"
              onChange={e => set("sku", e.target.value)}
            />
            <div style={S.note}>Optional. Must be unique per company.</div>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={S.label}>Barcode</label>
            <input
              style={inputStyle(false)}
              value={model.barcode}
              placeholder="EAN-13, QR, etc."
              onChange={e => set("barcode", e.target.value)}
            />
            <div style={S.note}>Optional.</div>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={S.label}>Item type<Req /></label>
            <select
              style={inputStyle(false)}
              value={model.type}
              onChange={e => {
                const type = e.target.value as ItemType;
                setModel(m => ({
                  ...m,
                  type,
                  trackInventory: type === "Service" ? false : m.trackInventory,
                  baseUomId:      type === "Service" ? ""    : m.baseUomId,
                  allowedUoms:    type === "Service" ? []    : m.allowedUoms,
                }));
              }}
            >
              {itemTypes.map(t => (
                <option key={t.code} value={t.code}>{t.name}</option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <label style={S.label}>Category<Req /></label>
            <select
              style={inputStyle(touched.categoryId && !v.catOk)}
              value={model.categoryId}
              onChange={e => set("categoryId", e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, categoryId: true }))}
            >
              <option value="">Select category…</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {touched.categoryId && !v.catOk && (
              <div style={S.err}>Category is required.</div>
            )}
          </div>

          {isEdit && (
            <div style={{ gridColumn: "span 3" }}>
              <label style={S.label}>Status</label>
              <select
                style={inputStyle(false)}
                value={model.isActive ? "active" : "inactive"}
                onChange={e => set("isActive", e.target.value === "active")}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <div style={S.note}>Inactive items are hidden from all pick-lists.</div>
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — Inventory behaviour
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={S.card}>
        <div style={S.sectionHead}>
          <div>
            <div style={S.sectionTitle}>Inventory behaviour</div>
            <div style={S.sectionHint}>
              Controls how stock is tracked and when alerts are triggered.
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>

          <div style={{ gridColumn: "span 4" }}>
            <label style={S.label}>Track inventory</label>
            <select
              style={inputStyle(false)}
              value={model.trackInventory ? "yes" : "no"}
              disabled={!physical}
              onChange={e => set("trackInventory", e.target.value === "yes")}
            >
              <option value="yes">Yes — track stock levels</option>
              <option value="no">No — non-stock item</option>
            </select>
            {!physical && (
              <div style={S.note}>Service items are never tracked.</div>
            )}
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={S.label}>Reorder level</label>
            <input
              style={inputStyle(false)}
              type="number"
              min={0}
              step={1}
              value={model.reorderLevel}
              disabled={!model.trackInventory || !physical}
              onChange={e => set("reorderLevel", Math.max(0, Number(e.target.value)))}
            />
            <div style={S.note}>
              Alert triggers when on-hand falls below this. Enter 0 to disable.
            </div>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={S.label}>Costing method</label>
            <select
              style={inputStyle(false)}
              value={model.costingMethod}
              disabled={!physical}
              onChange={e => set("costingMethod", e.target.value)}
            >
              <option value="">Inherit from company default</option>
              <option value="AVCO">AVCO — weighted average cost</option>
              <option value="FIFO">FIFO — first in, first out</option>
              <option value="Standard">Standard cost</option>
            </select>
            <div style={S.note}>Overrides the company-level default for this item only.</div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — Costing defaults
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={S.card}>
        <div style={S.sectionHead}>
          <div>
            <div style={S.sectionTitle}>Costing defaults</div>
            <div style={S.sectionHint}>
              Seeded into new purchase orders and sales orders. Actual cost is
              determined at GRN — these are fallback defaults only.
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>

          <div style={{ gridColumn: "span 4" }}>
            <label style={S.label}>Default cost (per base UOM)</label>
            <input
              style={inputStyle(false)}
              type="number"
              min={0}
              step="0.000001"
              value={model.defaultCost}
              placeholder="0.000000"
              onChange={e => set("defaultCost", e.target.value)}
            />
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={S.label}>Default price (per base UOM)</label>
            <input
              style={inputStyle(false)}
              type="number"
              min={0}
              step="0.000001"
              value={model.defaultPrice}
              placeholder="0.000000"
              onChange={e => set("defaultPrice", e.target.value)}
            />
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4 — Units of measure & conversions
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={S.card}>
        <div style={S.sectionHead}>
          <div>
            <div style={S.sectionTitle}>Units of measure &amp; conversions</div>
            <div style={S.sectionHint}>
              Define the base (stocking) unit and every other unit used in
              purchasing, production, and issuing. Each non-base unit needs a
              factor relative to the base unit.
            </div>
          </div>
        </div>

        {!physical ? (
          <div style={{ fontSize: 12.5, color: "#64748b" }}>
            Service items do not require unit-of-measure configuration.
          </div>
        ) : (
          <>
            {/* Base UOM */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14, marginBottom: 20 }}>
              <div style={{ gridColumn: "span 5" }}>
                <label style={S.label}>Base UOM (stocking unit)<Req /></label>
                <select
                  style={inputStyle(touched.baseUomId && !v.baseOk)}
                  value={model.baseUomId}
                  onChange={e => {
                    set("baseUomId", e.target.value);
                    set("allowedUoms", []);
                  }}
                  onBlur={() => setTouched(t => ({ ...t, baseUomId: true }))}
                >
                  <option value="">Select base unit…</option>
                  {uoms.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.code ? `${u.code} — ${u.name}` : u.name}
                    </option>
                  ))}
                </select>
                {touched.baseUomId && !v.baseOk && (
                  <div style={S.err}>Base UOM is required for physical items.</div>
                )}
                <div style={S.note}>
                  All conversion factors below are relative to this unit.{" "}
                  <strong>
                    Changing this after stock transactions have been posted
                    requires a stock adjustment journal.
                  </strong>
                </div>
              </div>
            </div>

            {/* Conversion grid */}
            {model.baseUomId && (
              <>
                <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85, marginBottom: 10 }}>
                  Allowed UOMs &amp; conversion factors
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                  Add every unit used in POs, GRNs, or issue requests. Mark one
                  as <strong>Issue</strong> (the default dispensing unit in kitchen /
                  store requisitions). The base row is locked at factor&nbsp;1.
                </div>

                <UomConversionGrid
                  baseUomId={model.baseUomId}
                  uoms={uoms}
                  rows={model.allowedUoms}
                  onChange={rows => {
                    set("allowedUoms", rows);
                    setTouched(t => ({ ...t, uoms: true }));
                  }}
                />

                {touched.uoms && v.uomError && (
                  <div style={{
                    marginTop: 12,
                    borderRadius: 10,
                    border: "1px solid rgba(245,158,11,0.40)",
                    background: "rgba(245,158,11,0.09)",
                    padding: "10px 14px",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(120,53,15,1)" }}>
                      Fix UOM configuration
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "rgba(120,53,15,1)" }}>
                      {v.uomError}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Bottom action bar ── */}
      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          style={S.secondaryBtn}
          onClick={() => navigate("/inventory-master/items")}
          disabled={saving}
        >
          Cancel
        </button>
        <button style={primaryBtn} onClick={save} disabled={!canSave || saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create item"}
        </button>
      </div>

    </div>
  );
}