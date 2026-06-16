// src/features/inventoryMaster/items/components/InventoryItemForm.tsx
//
// Inline create / edit form used by InventoryItemsPage (slide-in panel mode).
// Full-page upsert lives in ItemUpsertPage — this component is the lightweight
// inline variant for the list page.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InventoryItemDto, ItemUomDto } from "../types";
import { ITEM_TYPES, isServiceLikeType, type ItemType } from "../constants/itemTypes";
import UomConversionGrid from "./UomConversionGrid";
import { useAppScope }   from "../../../../app/useAppScope";
import { inventoryItemsApi } from "../api/inventoryItemsApi";

// ── Exported types (consumed by InventoryItemsPage) ───────────────────────────

export interface SelectOption {
  id:    string;
  name:  string;
  code?: string | null;
}

/** Shape the form hands back to its parent on submit. */
export interface InventoryItemFormDto {
  name:           string;
  localName:      string | null;
  sku:            string | null;
  barcode:        string | null;
  categoryId:     string | null;
  baseUomId:      string;
  type:           ItemType;
  allowedUoms:    ItemUomDto[];
  trackInventory: boolean;
  reorderLevel:   number;
  defaultCost:    number | null;
  defaultPrice:   number | null;
  isActive:       boolean;
}

interface Props {
  mode:       "create" | "edit";
  initial?:   InventoryItemDto | null;
  categories: SelectOption[];
  uoms:       SelectOption[];
  saving?:    boolean;
  onSubmit:   (dto: InventoryItemFormDto) => Promise<void>;
  onCancel:   () => void;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

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
  return Math.floor(n);
}

function extractApiError(e: unknown): string {
  const err  = e as any;
  const data = err?.response?.data;
  if (data?.message)               return String(data.message);
  if (data?.title && data?.errors) return `${data.title}: ${JSON.stringify(data.errors)}`;
  if (data?.title)                 return String(data.title);
  return err?.message ?? "Failed to save item.";
}

function getInitialType(initial: InventoryItemDto | null | undefined): ItemType {
  return (initial as any)?.type ?? (initial as any)?.itemType ?? "RawMaterial";
}

// ── UOM helpers ───────────────────────────────────────────────────────────────

function buildBaseRow(baseUomId: string, uoms: SelectOption[]): ItemUomDto {
  const uom = uoms.find(x => x.id === baseUomId);
  return {
    uomId:        baseUomId,
    code:         uom?.code ?? "",
    name:         uom?.name ?? "",
    toBaseFactor: 1,
    isBase:       true,
    isPurchase:   false,
    isIssue:      false,
    isRecipe:     false,
    isConsume:    false,
    isCount:      true,
    isActive:     true,
  };
}

function ensureBaseRow(
  rows:      ItemUomDto[],
  baseUomId: string,
  uoms:      SelectOption[],
): ItemUomDto[] {
  if (!baseUomId) return rows;
  const existing = rows.find(r => r.isBase && r.uomId === baseUomId);
  const baseRow  = existing
    ? { ...existing, toBaseFactor: 1, isBase: true, isActive: true }
    : buildBaseRow(baseUomId, uoms);
  return [baseRow, ...rows.filter(r => r.uomId !== baseUomId).map(r => ({ ...r, isBase: false }))];
}

function applyIssueUom(
  rows:      ItemUomDto[],
  baseUomId: string,
  issueId:   string,
): ItemUomDto[] {
  return rows.map(r => ({
    ...r,
    isIssue: !!issueId && (r.uomId === issueId || (issueId === baseUomId && r.isBase)),
  }));
}

function normalizeRows(
  rows:      ItemUomDto[],
  baseUomId: string,
  issueId:   string,
  uoms:      SelectOption[],
): ItemUomDto[] {
  return applyIssueUom(ensureBaseRow(rows, baseUomId, uoms), baseUomId, issueId);
}

/**
 * ERP-grade UOM validation — mirrors the server-side BuildItemUomEntries rules
 * so errors are caught before the round-trip.
 */
function validateUoms(rows: ItemUomDto[]): string | null {
  if (rows.some(r => !r.uomId))
    return "Each UOM line must have a unit selected.";

  const ids = rows.map(r => r.uomId);
  if (new Set(ids).size !== ids.length)
    return "Duplicate UOMs are not allowed.";

  if (rows.some(r => !r.toBaseFactor || r.toBaseFactor <= 0))
    return "All conversion factors must be greater than 0.";

  if (rows.filter(r => r.isBase).length !== 1)
    return "Exactly one base UOM row is required.";

  if (rows.filter(r => r.isIssue).length > 1)
    return "Only one issue UOM can be selected.";

  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title, subtitle, children,
}: {
  title:     string;
  subtitle?: string;
  children:  React.ReactNode;
}) {
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

function Field({
  label, span, required, hint, error, children,
}: {
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
        {label}
        {required && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint  && <span className="inv-field__hint">{hint}</span>}
      {error && <span className="inv-field__error">{error}</span>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InventoryItemForm({
  mode, initial, categories, uoms, saving: externalSaving, onSubmit, onCancel,
}: Props) {
  const { companyId }  = useAppScope();
  const factorCache    = useRef<Map<string, number>>(new Map());

  // ── Field state ─────────────────────────────────────────────────────────────
  const [name,           setName]           = useState("");
  const [localName,      setLocalName]      = useState("");
  const [sku,            setSku]            = useState("");
  const [barcode,        setBarcode]        = useState("");
  const [categoryId,     setCategoryId]     = useState("");
  const [type,           setType]           = useState<ItemType>("RawMaterial");
  const [baseUomId,      setBaseUomId]      = useState("");
  const [issueUomId,     setIssueUomId]     = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [isActive,       setIsActive]       = useState(true);
  const [defaultCost,    setDefaultCost]    = useState("");
  const [defaultPrice,   setDefaultPrice]   = useState("");
  const [reorderLevel,   setReorderLevel]   = useState("");
  const [allowedUoms,    setAllowedUoms]    = useState<ItemUomDto[]>([]);

  const [internalSaving, setInternalSaving] = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  // External saving prop wins when present (parent controls spinner)
  const saving = externalSaving ?? internalSaving;

  const isServiceLike = isServiceLikeType(type);
  const uomById       = useMemo(() => new Map(uoms.map(u => [u.id, u])), [uoms]);

  // ── Factor hydration from conversion DB ─────────────────────────────────────

  const fetchFactor = useCallback(async (
    baseId: string, uomId: string,
  ): Promise<number | null> => {
    if (!companyId || !baseId || !uomId) return null;
    const key    = `${baseId}:${uomId}`;
    const cached = factorCache.current.get(key);
    if (cached !== undefined) return cached;
    const res = await inventoryItemsApi.getUomConversionFactor(companyId, baseId, uomId);
    if (typeof res?.toBaseFactor === "number") {
      factorCache.current.set(key, res.toBaseFactor);
      return res.toBaseFactor;
    }
    return null;
  }, [companyId]);

  const hydrateMissing = useCallback(async (rows: ItemUomDto[]) => {
    if (!baseUomId) return;
    const targets = [...new Set(
      rows
        .filter(r => !r.isBase && r.uomId && (!r.toBaseFactor || r.toBaseFactor <= 0))
        .map(r => r.uomId),
    )];
    await Promise.all(targets.map(async id => {
      const factor = await fetchFactor(baseUomId, id);
      if (factor === null) return;
      setAllowedUoms(cur =>
        cur.map(r => r.uomId === id && !r.isBase ? { ...r, toBaseFactor: factor } : r),
      );
    }));
  }, [baseUomId, fetchFactor]);

  /** Ensures a non-base UOM row exists and hydrates its factor from the DB. */
  const ensureNonBaseRow = useCallback(async (uomId: string) => {
    if (!baseUomId || !uomId || uomId === baseUomId) return;
    const meta = uomById.get(uomId);
    setAllowedUoms(cur => {
      if (cur.some(r => r.uomId === uomId)) return cur;
      return [...cur, {
        uomId,
        code:         meta?.code  ?? "",
        name:         meta?.name  ?? "",
        toBaseFactor: null,
        isBase:       false,
        isPurchase:   false,
        isIssue:      false,
        isRecipe:     false,
        isConsume:    false,
        isCount:      true,
        isActive:     true,
      }];
    });
    const factor = await fetchFactor(baseUomId, uomId);
    if (factor === null) return;
    setAllowedUoms(cur =>
      cur.map(r => r.uomId === uomId && !r.isBase ? { ...r, toBaseFactor: factor } : r),
    );
  }, [baseUomId, fetchFactor, uomById]);

  // ── Seed from initial item on edit ───────────────────────────────────────────

  useEffect(() => {
    if (mode === "create") {
      setName(""); setLocalName(""); setSku(""); setBarcode("");
      setCategoryId(""); setType("RawMaterial");
      setBaseUomId(""); setIssueUomId(""); setAllowedUoms([]);
      setTrackInventory(true); setIsActive(true);
      setDefaultCost(""); setDefaultPrice(""); setReorderLevel("");
      setError(null);
      return;
    }

    if (!initial) return;

    const uoms_: ItemUomDto[] = Array.isArray(initial.allowedUoms)
      ? initial.allowedUoms
      : [];

    setName(initial.name ?? "");
    setLocalName((initial as any).localName ?? "");
    setSku(initial.sku ?? "");
    setBarcode((initial as any).barcode ?? "");
    setCategoryId(initial.categoryId ?? "");
    setType(getInitialType(initial));
    setBaseUomId(initial.baseUomId ?? "");
    setIssueUomId(uoms_.find(r => r.isIssue)?.uomId ?? initial.issueUomId ?? "");
    setTrackInventory(Boolean(initial.trackInventory));
    setIsActive(Boolean(initial.isActive));
    setDefaultCost(initial.defaultCost   == null ? "" : String(initial.defaultCost));
    setDefaultPrice(initial.defaultPrice == null ? "" : String(initial.defaultPrice));
    setReorderLevel((initial as any).reorderLevel == null ? "" : String((initial as any).reorderLevel));
    setAllowedUoms(uoms_);
    setError(null);
  }, [mode, initial]);

  // Auto-select first UOM when creating a stock item
  useEffect(() => {
    if (mode !== "create" || isServiceLike || baseUomId || !uoms.length) return;
    setBaseUomId(uoms[0].id);
  }, [baseUomId, isServiceLike, mode, uoms]);

  // Clear UOM fields when switching to a service-type
  useEffect(() => {
    if (!isServiceLike) return;
    setTrackInventory(false);
    setBaseUomId("");
    setIssueUomId("");
    setAllowedUoms([]);
  }, [isServiceLike]);

  // Keep base row in sync with baseUomId
  useEffect(() => {
    if (isServiceLike || !baseUomId) return;
    setAllowedUoms(cur => ensureBaseRow(cur, baseUomId, uoms));
  }, [baseUomId, isServiceLike, uoms]);

  // Keep issue UOM flag in sync across rows
  useEffect(() => {
    if (isServiceLike || !baseUomId) return;
    if (issueUomId && issueUomId !== baseUomId) void ensureNonBaseRow(issueUomId);
    setAllowedUoms(cur => applyIssueUom(cur, baseUomId, issueUomId));
  }, [baseUomId, ensureNonBaseRow, isServiceLike, issueUomId]);

  // ── Submit ───────────────────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    setError(null);
    try {
      if (!name.trim())
        throw new Error("Item name is required.");
      if (!isServiceLike && !baseUomId)
        throw new Error("Base UOM (FUOM) is required.");

      const normalizedUoms = !isServiceLike && baseUomId
        ? normalizeRows(allowedUoms, baseUomId, issueUomId, uoms)
        : [];

      if (!isServiceLike) {
        const uomError = validateUoms(normalizedUoms);
        if (uomError) throw new Error(uomError);
      }

      const dto: InventoryItemFormDto = {
        name:           name.trim(),
        localName:      nullableText(localName),
        sku:            nullableText(sku),
        barcode:        nullableText(barcode),
        categoryId:     categoryId || null,
        baseUomId:      isServiceLike ? "" : baseUomId,
        type,
        allowedUoms:    isServiceLike ? [] : normalizedUoms,
        trackInventory: isServiceLike ? false : trackInventory,
        reorderLevel:   parseReorderLevel(reorderLevel),
        defaultCost:    parseOptionalNumber(defaultCost,  "Default cost"),
        defaultPrice:   parseOptionalNumber(defaultPrice, "Default price"),
        isActive:       mode === "create" ? true : isActive,
      };

      setInternalSaving(true);
      await onSubmit(dto);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setInternalSaving(false);
    }
  }, [
    name, localName, sku, barcode, categoryId, baseUomId, issueUomId,
    type, allowedUoms, trackInventory, reorderLevel,
    defaultCost, defaultPrice, isActive,
    isServiceLike, mode, uoms, onSubmit,
  ]);

  // ── Derived display values ───────────────────────────────────────────────────

  const chipTone  = mode === "create" ? "draft" : isActive ? "success" : "danger";
  const chipLabel = mode === "create" ? "Draft"  : isActive ? "Active"  : "Inactive";

  const uomSubtitle = isServiceLike
    ? "Service / non-stock items do not require UOM conversions."
    : "FUOM is the stocking unit. Store UOM maps to the issue / dispensing unit.";

  const uomGridRows = allowedUoms.filter(r => !r.isBase);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="iif-shell">

      {/* ── Header ── */}
      <div className="iif-header">
        <div className="iif-header__left">
          <div className="iif-header__kicker">Item master</div>
          <div className="iif-header__title">
            {mode === "create" ? "New inventory item" : "Edit inventory item"}
          </div>
          <div className="iif-header__subtitle">
            {isServiceLike
              ? "Service / non-stock item"
              : "Stock item — define FUOM, store UOM, and conversion rules"}
          </div>
        </div>
        <div className="iif-header__actions">
          <span className={`inv-status-chip inv-status-chip--${chipTone}`}>
            {chipLabel}
          </span>
          <button
            className="inv-btn inv-btn--ghost"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="inv-btn inv-btn--solid"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save item"}
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && <div className="iif-alert">{error}</div>}

      <div className="iif-body">

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1 — Item information                                    */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <Section
          title="Item information"
          subtitle="Basic identity and classification"
        >
          <div className="inv-form-grid">

            <Field label="Item name" span={4} required>
              <input
                className="inv-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Tomato, Beef, Room Service"
                disabled={saving}
              />
            </Field>

            <Field label="SKU" span={2}>
              <input
                className="inv-input"
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="SKU-001"
                disabled={saving}
              />
            </Field>

            <Field label="Barcode" span={3}>
              <input
                className="inv-input"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                placeholder="0000000000000"
                disabled={saving}
              />
            </Field>

            <Field label="Local name" span={3}>
              <input
                className="inv-input"
                value={localName}
                onChange={e => setLocalName(e.target.value)}
                placeholder="Optional — Arabic / RTL"
                disabled={saving}
                dir="auto"
              />
            </Field>

            <Field label="Category" span={3}>
              <select
                className="inv-input"
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                disabled={saving}
              >
                <option value="">None</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Item type" span={3} required>
              <select
                className="inv-input"
                value={type}
                onChange={e => setType(e.target.value as ItemType)}
                disabled={saving}
              >
                {ITEM_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>

            <Field
              label="Track inventory"
              span={3}
              hint={isServiceLike ? "Not applicable for service items" : undefined}
            >
              <label className={`inv-checkbox-row${isServiceLike ? " inv-checkbox-row--disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={trackInventory}
                  disabled={isServiceLike || saving}
                  onChange={e => setTrackInventory(e.target.checked)}
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
                    onChange={e => setIsActive(e.target.checked)}
                  />
                  <span>{isActive ? "Active" : "Inactive"}</span>
                </label>
              </Field>
            )}

          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2 — Unit of measurement                                 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <Section title="Unit of measurement" subtitle={uomSubtitle}>
          <div className="inv-form-grid">

            <Field
              label="FUOM / base UOM"
              span={4}
              required={!isServiceLike}
              hint="Fundamental stocking unit — all conversions are relative to this"
            >
              <select
                className="inv-input"
                value={baseUomId}
                onChange={e => setBaseUomId(e.target.value)}
                disabled={isServiceLike || saving}
              >
                <option value="">—</option>
                {uoms.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.code ? `${u.name} (${u.code})` : u.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Store UOM / issue UOM"
              span={4}
              hint="Controls the unit used in store requests and stock movements"
            >
              <select
                className="inv-input"
                value={issueUomId}
                onChange={e => setIssueUomId(e.target.value)}
                disabled={isServiceLike || !baseUomId || saving}
              >
                <option value="">—</option>
                {uoms.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.code ? `${u.name} (${u.code})` : u.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Conversion source" span={4}>
              <div className="inv-readonly-field">
                Factors loaded from UOM conversion database
              </div>
            </Field>

          </div>

          {!isServiceLike && (
            <div className="iif-conv-section">
              <div className="iif-conv-section__label">
                Allowed units &amp; conversion lines
              </div>
              <div className="iif-conv-section__body">
                {!baseUomId ? (
                  <p className="iif-conv-section__empty">
                    Select a <strong>FUOM</strong> to enable conversion lines.
                  </p>
                ) : (
                  <UomConversionGrid
                    baseUomId={baseUomId}
                    uoms={uoms.map(u => ({ id: u.id, code: u.code ?? "", name: u.name }))}
                    rows={uomGridRows}
                    onChange={rows => {
                      setAllowedUoms(cur => {
                        const baseRow = cur.find(r => r.isBase && r.uomId === baseUomId);
                        const merged  = [
                          ...(baseRow ? [baseRow] : []),
                          ...rows.map(r => ({ ...r, isBase: false })),
                        ];
                        const norm = normalizeRows(merged, baseUomId, issueUomId, uoms);
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

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3 — Costing & control                                   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <Section
          title="Costing & control"
          subtitle="Default values used by inventory and recipe costing"
        >
          <div className="inv-form-grid">

            <Field label="Default cost" span={3} hint="Fallback unit cost for POs and recipe costing">
              <input
                type="number"
                inputMode="decimal"
                className="inv-input"
                value={defaultCost}
                onChange={e => setDefaultCost(e.target.value)}
                placeholder="0.00"
                disabled={saving}
              />
            </Field>

            <Field label="Default price" span={3} hint="Fallback selling price">
              <input
                type="number"
                inputMode="decimal"
                className="inv-input"
                value={defaultPrice}
                onChange={e => setDefaultPrice(e.target.value)}
                placeholder="0.00"
                disabled={saving}
              />
            </Field>

            <Field
              label="Reorder level"
              span={3}
              hint="Low-stock alert triggers when on-hand quantity falls below this"
            >
              <input
                type="number"
                min={0}
                inputMode="numeric"
                className="inv-input"
                value={reorderLevel}
                onChange={e => setReorderLevel(e.target.value)}
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