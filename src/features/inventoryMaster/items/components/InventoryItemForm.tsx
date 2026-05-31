// src/features/inventory/items/components/InventoryItemForm.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InventoryItemDto, ItemUomDto } from "../types";
import { ITEM_TYPES, isServiceLikeType, type ItemType } from "../constants/itemTypes";
import UomConversionGrid from "./UomConversionGrid";
import { useAppScope } from "../../../../app/useAppScope";
import { inventoryItemsApi } from "../api/inventoryItemsApi";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SelectOption {
  id:    string;
  name:  string;
  code?: string | null;
}

export interface InventoryItemFormDto {
  name:           string;
  sku:            string | null;
  localName:      string | null;
  barcode:        string | null;
  categoryId:     string | null;
  baseUomId:      string;
  type:           ItemType;
  allowedUoms:    ItemUomDto[];
  trackInventory: boolean;
  defaultCost:    number | null;
  defaultPrice:   number | null;
  reorderLevel:   number;
  isActive:       boolean;
}

interface Props {
  mode:      "create" | "edit";
  initial?:  InventoryItemDto | null;
  onSubmit:  (dto: InventoryItemFormDto) => Promise<void>;
  onCancel:  () => void;
  saving?:    boolean;
  categories: SelectOption[];
  uoms:       SelectOption[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nullableText(value: string): string | null {
  return value.trim() || null;
}

function parseOptionalNumber(value: string, label: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a valid number.`);
  return n;
}

function parseReorderLevel(value: string): number {
  if (!value.trim()) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Reorder level must be ≥ 0.");
  return n;
}

function extractApiError(e: unknown): string {
  const err = e as any;
  const data = err?.response?.data;
  if (data?.message) return data.message;
  if (data?.title && data?.errors) return `${data.title}: ${JSON.stringify(data.errors)}`;
  if (data?.title) return data.title;
  return err?.message ?? "Failed to save item.";
}

function getInitialType(initial?: InventoryItemDto | null): ItemType {
  const item = initial as any;
  return item?.type ?? item?.itemType ?? "RawMaterial";
}

// ── UOM helpers ───────────────────────────────────────────────────────────────

function buildBaseRow(baseUomId: string, uoms: SelectOption[]): ItemUomDto {
  const uom = uoms.find((x) => x.id === baseUomId);
  return { uomId: baseUomId, code: uom?.code ?? "", name: uom?.name ?? "", toBaseFactor: 1, isBase: true, isIssue: false, isActive: true };
}

function ensureBaseRow(rows: ItemUomDto[], baseUomId: string, uoms: SelectOption[]): ItemUomDto[] {
  if (!baseUomId) return rows;
  const existing = rows.find((r) => r.isBase && r.uomId === baseUomId);
  const baseRow  = existing ? { ...existing, toBaseFactor: 1, isBase: true, isActive: true } : buildBaseRow(baseUomId, uoms);
  return [baseRow, ...rows.filter((r) => r.uomId !== baseUomId).map((r) => ({ ...r, isBase: false }))];
}

function applyIssueUom(rows: ItemUomDto[], baseUomId: string, storeUomId: string): ItemUomDto[] {
  return rows.map((r) => ({
    ...r,
    isIssue: !!storeUomId && (r.uomId === storeUomId || (storeUomId === baseUomId && r.isBase)),
  }));
}

function normalizeRows(rows: ItemUomDto[], baseUomId: string, storeUomId: string, uoms: SelectOption[]): ItemUomDto[] {
  return applyIssueUom(ensureBaseRow(rows, baseUomId, uoms), baseUomId, storeUomId);
}

function validateUoms(rows: ItemUomDto[]): string | null {
  const ids = rows.map((r) => r.uomId).filter(Boolean);
  if (rows.some((r) => !r.uomId))                         return "Each UOM line must have a unit selected.";
  if (new Set(ids).size !== ids.length)                   return "Duplicate UOMs are not allowed.";
  if (rows.some((r) => !r.toBaseFactor || r.toBaseFactor <= 0)) return "All to-base factors must be > 0.";
  if (rows.filter((r) => r.isBase).length !== 1)          return "Exactly one base UOM row is required.";
  if (rows.filter((r) => r.isIssue).length > 1)           return "Only one Issue UOM can be selected.";
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="inv-section">
      <div className="inv-section__head">
        <div className="inv-section__title">{title}</div>
        {subtitle && <div className="inv-section__subtitle">{subtitle}</div>}
      </div>
      <div className="inv-section__body">{children}</div>
    </div>
  );
}

function Field({ label, span, required, hint, error, children }: {
  label:     string;
  span:      number;
  required?: boolean;
  hint?:     string;
  error?:    string;
  children:  React.ReactNode;
}) {
  return (
    <div className={`inv-field inv-field--span-${span}`}>
      <label className="inv-field__label">
        {label}{required && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint  && <span className="inv-field__hint">{hint}</span>}
      {error && <span className="inv-field__error">{error}</span>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InventoryItemForm({ mode, initial, onSubmit, onCancel, categories, uoms }: Props) {
  const { companyId }       = useAppScope();
  const factorCacheRef      = useRef<Map<string, number>>(new Map());

  const [name,           setName]           = useState("");
  const [sku,            setSku]            = useState("");
  const [localName,      setLocalName]      = useState("");
  const [barcode,        setBarcode]        = useState("");
  const [categoryId,     setCategoryId]     = useState("");
  const [type,           setType]           = useState<ItemType>("RawMaterial");
  const [baseUomId,      setBaseUomId]      = useState("");
  const [storeUomId,     setStoreUomId]     = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [isActive,       setIsActive]       = useState(true);
  const [defaultCost,    setDefaultCost]    = useState("");
  const [defaultPrice,   setDefaultPrice]   = useState("");
  const [reorderLevel,   setReorderLevel]   = useState("");
  const [allowedUoms,    setAllowedUoms]    = useState<ItemUomDto[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  const isServiceLike = isServiceLikeType(type);

  const uomMetaById = useMemo(() => new Map(uoms.map((u) => [u.id, u])), [uoms]);

  // ── Factor hydration ────────────────────────────────────────────────────────

  const fetchFactor = useCallback(async (baseId: string, uomId: string): Promise<number | null> => {
    if (!companyId || !baseId || !uomId) return null;
    const key = `${baseId}:${uomId}`;
    const cached = factorCacheRef.current.get(key);
    if (cached !== undefined) return cached;
    const res = await inventoryItemsApi.getUomConversionFactor(companyId, baseId, uomId);
    const factor = res?.toBaseFactor ?? null;
    if (typeof factor === "number") factorCacheRef.current.set(key, factor);
    return factor;
  }, [companyId]);

  const hydrateMissing = useCallback(async (rows: ItemUomDto[]) => {
    if (!baseUomId) return;
    const targets = [...new Set(rows.filter((r) => !r.isBase && r.uomId && (!r.toBaseFactor || r.toBaseFactor <= 0)).map((r) => r.uomId))];
    await Promise.all(targets.map(async (id) => {
      const factor = await fetchFactor(baseUomId, id);
      if (factor === null) return;
      setAllowedUoms((cur) => cur.map((r) => r.uomId === id && !r.isBase ? { ...r, toBaseFactor: factor } : r));
    }));
  }, [baseUomId, fetchFactor]);

  const ensureNonBaseRow = useCallback(async (uomId: string) => {
    if (!baseUomId || !uomId || uomId === baseUomId) return;
    const meta = uomMetaById.get(uomId);
    setAllowedUoms((cur) => {
      if (cur.some((r) => r.uomId === uomId)) return cur;
      return [...cur, { uomId, code: meta?.code ?? "", name: meta?.name ?? "", toBaseFactor: 0, isBase: false, isIssue: false, isActive: true }];
    });
    const factor = await fetchFactor(baseUomId, uomId);
    if (factor === null) return;
    setAllowedUoms((cur) => cur.map((r) => r.uomId === uomId && !r.isBase ? { ...r, toBaseFactor: factor } : r));
  }, [baseUomId, fetchFactor, uomMetaById]);

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Reset on create mode
  useEffect(() => {
    if (mode !== "create") return;
    setName(""); setSku(""); setBarcode(""); setLocalName(""); setCategoryId("");
    setType("RawMaterial"); setTrackInventory(true); setIsActive(true);
    setDefaultCost(""); setDefaultPrice(""); setReorderLevel("");
    setBaseUomId(""); setStoreUomId(""); setAllowedUoms([]); setError(null);
  }, [mode]);

  // Populate from initial on edit
  useEffect(() => {
    if (!initial) return;
    const item = initial as any;
    const initialAllowedUoms: ItemUomDto[] = Array.isArray(item.allowedUoms) ? item.allowedUoms : [];
    setName(initial.name ?? "");
    setSku(initial.sku ?? "");
    setBarcode(item.barcode ?? "");
    setLocalName(item.localName ?? "");
    setCategoryId(initial.categoryId ?? "");
    setBaseUomId(initial.baseUomId ?? "");
    setType(getInitialType(initial));
    setTrackInventory(Boolean(initial.trackInventory));
    setIsActive(Boolean(initial.isActive));
    setDefaultCost(item.defaultCost == null ? "" : String(item.defaultCost));
    setDefaultPrice(item.defaultPrice == null ? "" : String(item.defaultPrice));
    setReorderLevel(item.reorderLevel == null ? "" : String(item.reorderLevel));
    setAllowedUoms(initialAllowedUoms);
    setStoreUomId(initialAllowedUoms.find((r) => r.isIssue)?.uomId ?? item.issueUomId ?? "");
    setError(null);
  }, [initial]);

  // Auto-select first UOM on new stock items
  useEffect(() => {
    if (mode !== "create" || isServiceLike || baseUomId || !uoms.length) return;
    setBaseUomId(uoms[0].id);
  }, [baseUomId, isServiceLike, mode, uoms]);

  // Clear UOM state when switching to service-like
  useEffect(() => {
    if (!isServiceLike) return;
    setTrackInventory(false); setBaseUomId(""); setStoreUomId(""); setAllowedUoms([]);
  }, [isServiceLike]);

  // Keep base row in sync
  useEffect(() => {
    if (isServiceLike || !baseUomId) return;
    setAllowedUoms((cur) => ensureBaseRow(cur, baseUomId, uoms));
  }, [baseUomId, isServiceLike, uoms]);

  // Keep store UOM in sync
  useEffect(() => {
    if (isServiceLike || !baseUomId) return;
    if (storeUomId && storeUomId !== baseUomId) void ensureNonBaseRow(storeUomId);
    setAllowedUoms((cur) => applyIssueUom(cur, baseUomId, storeUomId));
  }, [baseUomId, ensureNonBaseRow, isServiceLike, storeUomId]);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const submit = async () => {
    setError(null);
    try {
      if (!name.trim()) throw new Error("Item name is required.");
      if (!isServiceLike && !baseUomId) throw new Error("FUOM / Base UOM is required.");

      const normalizedUoms = !isServiceLike && baseUomId
        ? normalizeRows(allowedUoms, baseUomId, storeUomId, uoms)
        : [];

      if (!isServiceLike) {
        const uomError = validateUoms(normalizedUoms);
        if (uomError) throw new Error(uomError);
      }

      const dto: InventoryItemFormDto = {
        name:           name.trim(),
        sku:            nullableText(sku),
        localName:      nullableText(localName),
        barcode:        nullableText(barcode),
        categoryId:     categoryId || null,
        baseUomId:      isServiceLike ? "" : baseUomId,
        type,
        allowedUoms:    isServiceLike ? [] : normalizedUoms,
        trackInventory: isServiceLike ? false : trackInventory,
        defaultCost:    parseOptionalNumber(defaultCost, "Default cost"),
        defaultPrice:   parseOptionalNumber(defaultPrice, "Default price"),
        reorderLevel:   parseReorderLevel(reorderLevel),
        isActive:       mode === "create" ? true : isActive,
      };

      setSaving(true);
      await onSubmit(dto);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Chip label ───────────────────────────────────────────────────────────────

  const chipTone  = mode === "create" ? "draft" : isActive ? "success" : "danger";
  const chipLabel = mode === "create" ? "Draft" : isActive ? "Active" : "Inactive";

  const uomSectionSubtitle = isServiceLike
    ? "Service / non-stock items do not require UOM conversions"
    : "FUOM is the base unit — Store UOM maps to the issue UOM";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="iif-shell">
      {/* Header */}
      <div className="iif-header">
        <div className="iif-header__left">
          <div className="iif-header__kicker">Item master</div>
          <div className="iif-header__title">
            {mode === "create" ? "New inventory item" : "Edit inventory item"}
          </div>
          <div className="iif-header__subtitle">
            {isServiceLike ? "Service / non-stock item" : "Stock item with FUOM, store UOM, and conversion rules"}
          </div>
        </div>
        <div className="iif-header__actions">
          <span className={`inv-status-chip inv-status-chip--${chipTone}`}>{chipLabel}</span>
          <button className="inv-btn inv-btn--ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="inv-btn inv-btn--solid" onClick={submit}   disabled={saving}>
            {saving ? "Saving…" : "Save item"}
          </button>
        </div>
      </div>

      {error && <div className="iif-alert">{error}</div>}

      <div className="iif-body">
        {/* Item information */}
        <Section title="Item information" subtitle="Basic identity and classification">
          <div className="inv-form-grid">
            <Field label="Item name" span={4} required>
              <input
                className="inv-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tomato, Beef, Room Service"
                disabled={saving}
              />
            </Field>

            <Field label="SKU" span={2}>
              <input
                className="inv-input"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU-001"
                disabled={saving}
              />
            </Field>

            <Field label="Barcode" span={3}>
              <input
                className="inv-input"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="0000000000000"
                disabled={saving}
              />
            </Field>

            <Field label="Local name" span={3}>
              <input
                className="inv-input"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="Optional"
                disabled={saving}
                dir="auto"
              />
            </Field>

            <Field label="Category" span={3}>
              <select
                className="inv-input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={saving}
              >
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label="Item type" span={3} required>
              <select
                className="inv-input"
                value={type}
                onChange={(e) => setType(e.target.value as ItemType)}
                disabled={saving}
              >
                {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>

            <Field label="Track inventory" span={3} hint={isServiceLike ? "Not applicable for service items" : undefined}>
              <label className={`inv-checkbox-row${isServiceLike ? " inv-checkbox-row--disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={trackInventory}
                  disabled={isServiceLike || saving}
                  onChange={(e) => setTrackInventory(e.target.checked)}
                />
                <span>Yes — track stock movements</span>
              </label>
            </Field>

            {mode === "edit" && (
              <Field label="Active status" span={3}>
                <label className="inv-checkbox-row">
                  <input
                    type="checkbox"
                    checked={isActive}
                    disabled={saving}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span>{isActive ? "Active" : "Inactive"}</span>
                </label>
              </Field>
            )}
          </div>
        </Section>

        {/* Unit of measurement */}
        <Section title="Unit of measurement" subtitle={uomSectionSubtitle}>
          <div className="inv-form-grid">
            <Field label="FUOM / base UOM" span={4} required={!isServiceLike} hint="Fundamental unit — all conversions are relative to this">
              <select
                className="inv-input"
                value={baseUomId}
                onChange={(e) => setBaseUomId(e.target.value)}
                disabled={isServiceLike || saving}
              >
                <option value="">—</option>
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>{u.code ? `${u.name} (${u.code})` : u.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Store UOM / issue UOM" span={4} hint="Controls the unit used during store requests and stock movements">
              <select
                className="inv-input"
                value={storeUomId}
                onChange={(e) => setStoreUomId(e.target.value)}
                disabled={isServiceLike || !baseUomId || saving}
              >
                <option value="">—</option>
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>{u.code ? `${u.name} (${u.code})` : u.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Conversion source" span={4}>
              <div className="inv-readonly-field">Loaded from UOM conversion database</div>
            </Field>
          </div>

          {!isServiceLike && (
            <div className="iif-conv-section">
              <div className="iif-conv-section__label">Allowed units &amp; conversion lines</div>
              <div className="iif-conv-section__body">
                {!baseUomId ? (
                  <p className="iif-conv-section__empty">Select a <strong>FUOM</strong> to enable conversion lines.</p>
                ) : (
                  <UomConversionGrid
                    baseUomId={baseUomId}
                    uoms={uoms.map((u) => ({ id: u.id, code: u.code ?? "", name: u.name }))}
                    rows={allowedUoms.filter((r) => !r.isBase)}
                    onChange={(rows) => {
                      setAllowedUoms((cur) => {
                        const baseRow = cur.find((r) => r.isBase && r.uomId === baseUomId);
                        const merged  = [...(baseRow ? [baseRow] : []), ...rows.map((r) => ({ ...r, isBase: false }))];
                        const norm    = normalizeRows(merged, baseUomId, storeUomId, uoms);
                        void hydrateMissing(norm);
                        return norm;
                      });
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </Section>

        {/* Costing & control */}
        <Section title="Costing & control" subtitle="Default values used by inventory and recipe costing">
          <div className="inv-form-grid">
            <Field label="Default cost" span={3} hint="Used as fallback unit cost">
              <input
                type="number"
                inputMode="decimal"
                className="inv-input"
                value={defaultCost}
                onChange={(e) => setDefaultCost(e.target.value)}
                placeholder="0.00"
                disabled={saving}
              />
            </Field>

            <Field label="Default price" span={3} hint="Used as fallback selling price">
              <input
                type="number"
                inputMode="decimal"
                className="inv-input"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
                placeholder="0.00"
                disabled={saving}
              />
            </Field>

            <Field label="Reorder level" span={3} hint="Triggers low-stock alerts when stock falls below this">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                className="inv-input"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                placeholder="0"
                disabled={saving}
              />
            </Field>
          </div>
        </Section>
      </div>
    </div>
  );
}
