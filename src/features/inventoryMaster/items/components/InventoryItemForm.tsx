import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InventoryItemDto, ItemUomDto } from "../types";
import { ITEM_TYPES, type ItemType } from "../constants/itemTypes";
import UomConversionGrid from "../components/UomConversionGrid";
import { useAppScope } from "../../../../app/useAppScope";
import { inventoryItemsApi } from "../api/inventoryItemsApi";
// Styles live in inventory-items.css — imported once by InventoryItemsPage.

// ─── Types ────────────────────────────────────────────────────────────────────

type SelectOption = {
  id: string;
  name: string;
  code?: string | null;
};

type ConversionFactorResponse = {
  toBaseFactor?: number | null;
};

export type InventoryItemFormDto = {
  name: string;
  sku: string | null;
  localName: string | null;
  barcode: string | null;
  categoryId: string | null;
  baseUomId: string;
  type: ItemType;
  allowedUoms: ItemUomDto[];
  trackInventory: boolean;
  defaultCost: number | null;
  defaultPrice: number | null;
  reorderLevel: number;
  isActive: boolean;
};

type Props = {
  mode: "create" | "edit";
  initial?: InventoryItemDto | null;
  onSubmit: (dto: InventoryItemFormDto) => Promise<void>;
  onCancel: () => void;
  categories: SelectOption[];
  uoms: SelectOption[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_GUID_VALUE = "";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function isServiceLikeType(type: ItemType): boolean {
  return type === "Service" || type === "NonStock";
}

function getNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function parseNullableNumber(value: string, label: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid number.`);
  return parsed;
}

function parseReorderLevel(value: string): number {
  const parsed = value.trim() === "" ? 0 : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Reorder level must be a number ≥ 0.");
  }
  return parsed;
}

function getErrorMessage(error: unknown): string {
  const e = error as {
    response?: { data?: { message?: string; title?: string; errors?: unknown } };
    message?: string;
  };
  const data = e?.response?.data;
  if (data?.message) return data.message;
  if (data?.title && data?.errors) return `${data.title}: ${JSON.stringify(data.errors)}`;
  if (data?.title) return data.title;
  return e?.message ?? "Failed to save item.";
}

function getInitialType(initial?: InventoryItemDto | null): ItemType {
  const item = initial as InventoryItemDto & { type?: ItemType; itemType?: ItemType };
  return item?.type ?? item?.itemType ?? "RawMaterial";
}

// ─── UOM helpers ──────────────────────────────────────────────────────────────

function createBaseUomRow(baseUomId: string, uoms: SelectOption[]): ItemUomDto {
  const uom = uoms.find((x) => x.id === baseUomId);
  return {
    uomId: baseUomId,
    code: uom?.code ?? "",
    name: uom?.name ?? "",
    toBaseFactor: 1,
    isBase: true,
    isIssue: false,
    isActive: true,
  };
}

function ensureBaseUomRow(rows: ItemUomDto[], baseUomId: string, uoms: SelectOption[]): ItemUomDto[] {
  if (!baseUomId) return rows;

  const existing = rows.find((r) => r.isBase && r.uomId === baseUomId);
  const baseRow = existing
    ? { ...existing, toBaseFactor: 1, isBase: true, isActive: true }
    : createBaseUomRow(baseUomId, uoms);

  const otherRows = rows
    .filter((r) => r.uomId !== baseUomId)
    .map((r) => ({ ...r, isBase: false }));

  return [baseRow, ...otherRows];
}

function applyStoreUom(rows: ItemUomDto[], baseUomId: string, storeUomId: string): ItemUomDto[] {
  return rows.map((r) => ({
    ...r,
    isIssue:
      Boolean(storeUomId) &&
      (r.uomId === storeUomId || (storeUomId === baseUomId && r.isBase)),
  }));
}

function normalizeAllowedUoms(
  rows: ItemUomDto[],
  baseUomId: string,
  storeUomId: string,
  uoms: SelectOption[]
): ItemUomDto[] {
  return applyStoreUom(ensureBaseUomRow(rows, baseUomId, uoms), baseUomId, storeUomId);
}

function validateAllowedUoms(rows: ItemUomDto[]): string | null {
  const ids = rows.map((r) => r.uomId).filter(Boolean);
  if (rows.some((r) => !r.uomId)) return "Each allowed UOM must have a unit selected.";
  if (new Set(ids).size !== ids.length) return "Allowed UOMs must be unique.";
  if (rows.some((r) => !r.toBaseFactor || r.toBaseFactor <= 0)) return "To-base factor must be > 0.";
  if (rows.filter((r) => r.isBase).length !== 1) return "Exactly one FUOM / base row is required.";
  if (rows.filter((r) => r.isIssue).length > 1) return "Only one store UOM can be selected.";
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type StatusChipTone = "draft" | "success" | "danger";

function StatusChip({ label, tone }: { label: string; tone: StatusChipTone }) {
  return (
    <span className={`inv-status-chip inv-status-chip--${tone}`}>{label}</span>
  );
}

function CheckboxField({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`inv-checkbox-row${disabled ? " inv-checkbox-row--disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function ReadOnlyField({ text }: { text: string }) {
  return <div className="inv-readonly-field">{text}</div>;
}

function Field({
  label,
  colSpan,
  children,
}: {
  label: string;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <div className={`inv-field inv-field--span-${colSpan}`}>
      <label className="inv-field__label">{label}</label>
      {children}
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="inv-form-grid">{children}</div>;
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function InventoryItemForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  categories,
  uoms,
}: Props) {
  const { companyId } = useAppScope();
  const factorCacheRef = useRef<Map<string, number>>(new Map());

  // Form state
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [localName, setLocalName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<ItemType>("RawMaterial");
  const [baseUomId, setBaseUomId] = useState("");
  const [storeUomId, setStoreUomId] = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [defaultCost, setDefaultCost] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [allowedUoms, setAllowedUoms] = useState<ItemUomDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isServiceLike = isServiceLikeType(type);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const uomMetaById = useMemo(
    () => new Map(uoms.map((u) => [u.id, u])),
    [uoms]
  );

  // ─── API ────────────────────────────────────────────────────────────────────

  const fetchToBaseFactor = useCallback(
    async (baseId: string, uomId: string): Promise<number | null> => {
      if (!companyId || !baseId || !uomId) return null;

      const cacheKey = `${baseId}:${uomId}`;
      const cached = factorCacheRef.current.get(cacheKey);
      if (cached !== undefined) return cached;

      const api = inventoryItemsApi as unknown as {
        getUomConversionFactor: (
          companyId: string,
          baseUomId: string,
          uomId: string
        ) => Promise<ConversionFactorResponse | null>;
      };

      const response = await api.getUomConversionFactor(companyId, baseId, uomId);
      const factor = response?.toBaseFactor ?? null;

      if (typeof factor === "number") {
        factorCacheRef.current.set(cacheKey, factor);
        return factor;
      }

      return null;
    },
    [companyId]
  );

  const ensureNonBaseRow = useCallback(
    async (uomId: string) => {
      if (!baseUomId || !uomId || uomId === baseUomId) return;

      const meta = uomMetaById.get(uomId);

      setAllowedUoms((current) => {
        if (current.some((r) => r.uomId === uomId)) return current;
        return [
          ...current,
          {
            uomId,
            code: meta?.code ?? "",
            name: meta?.name ?? "",
            toBaseFactor: 0,
            isBase: false,
            isIssue: false,
            isActive: true,
          },
        ];
      });

      const factor = await fetchToBaseFactor(baseUomId, uomId);
      if (factor === null) return;

      setAllowedUoms((current) =>
        current.map((r) =>
          r.uomId === uomId && !r.isBase ? { ...r, toBaseFactor: factor } : r
        )
      );
    },
    [baseUomId, fetchToBaseFactor, uomMetaById]
  );

  const hydrateMissingFactors = useCallback(
    async (rows: ItemUomDto[]) => {
      if (!baseUomId) return;

      const targets = Array.from(
        new Set(
          rows
            .filter((r) => !r.isBase && r.uomId && (!r.toBaseFactor || r.toBaseFactor <= 0))
            .map((r) => r.uomId)
        )
      );

      await Promise.all(
        targets.map(async (uomId) => {
          const factor = await fetchToBaseFactor(baseUomId, uomId);
          if (factor === null) return;
          setAllowedUoms((current) =>
            current.map((r) =>
              r.uomId === uomId && !r.isBase ? { ...r, toBaseFactor: factor } : r
            )
          );
        })
      );
    },
    [baseUomId, fetchToBaseFactor]
  );

  // ─── Effects ────────────────────────────────────────────────────────────────

  // Reset on create mode
  useEffect(() => {
    if (mode !== "create") return;
    setName("");
    setSku("");
    setBarcode("");
    setLocalName("");
    setCategoryId("");
    setType("RawMaterial");
    setTrackInventory(true);
    setIsActive(true);
    setDefaultCost("");
    setDefaultPrice("");
    setReorderLevel("");
    setBaseUomId("");
    setStoreUomId("");
    setAllowedUoms([]);
    setError(null);
  }, [mode]);

  // Populate from initial data on edit
  useEffect(() => {
    if (!initial) return;

    const item = initial as InventoryItemDto & {
      barcode?: string | null;
      localName?: string | null;
      defaultCost?: number | null;
      defaultPrice?: number | null;
      reorderLevel?: number | null;
      allowedUoms?: ItemUomDto[];
      issueUomId?: string | null;
    };

    const initialAllowedUoms = Array.isArray(item.allowedUoms) ? item.allowedUoms : [];

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
    setStoreUomId(
      initialAllowedUoms.find((r) => r.isIssue)?.uomId ?? item.issueUomId ?? ""
    );
    setError(null);
  }, [initial]);

  // Auto-select first UOM on new stock items
  useEffect(() => {
    if (mode !== "create" || isServiceLike || baseUomId || !uoms.length) return;
    setBaseUomId(uoms[0].id);
  }, [baseUomId, isServiceLike, mode, uoms]);

  // Clear UOM state when switching to service-like type
  useEffect(() => {
    if (!isServiceLike) return;
    setTrackInventory(false);
    setBaseUomId("");
    setStoreUomId("");
    setAllowedUoms([]);
  }, [isServiceLike]);

  // Keep base UOM row in sync
  useEffect(() => {
    if (isServiceLike || !baseUomId) return;
    setAllowedUoms((current) => ensureBaseUomRow(current, baseUomId, uoms));
  }, [baseUomId, isServiceLike, uoms]);

  // Keep store UOM row in sync
  useEffect(() => {
    if (isServiceLike || !baseUomId) return;
    if (storeUomId && storeUomId !== baseUomId) void ensureNonBaseRow(storeUomId);
    setAllowedUoms((current) => applyStoreUom(current, baseUomId, storeUomId));
  }, [baseUomId, ensureNonBaseRow, isServiceLike, storeUomId]);

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const submit = async () => {
    setError(null);

    try {
      if (!name.trim()) throw new Error("Item name is required.");
      if (!isServiceLike && !baseUomId) throw new Error("FUOM is required.");

      const normalizedAllowedUoms =
        !isServiceLike && baseUomId
          ? normalizeAllowedUoms(allowedUoms, baseUomId, storeUomId, uoms)
          : [];

      if (!isServiceLike) {
        const uomError = validateAllowedUoms(normalizedAllowedUoms);
        if (uomError) throw new Error(uomError);
      }

      const dto: InventoryItemFormDto = {
        name: name.trim(),
        sku: getNullableText(sku),
        localName: getNullableText(localName),
        barcode: getNullableText(barcode),
        categoryId: categoryId || null,
        baseUomId: isServiceLike ? EMPTY_GUID_VALUE : baseUomId,
        type,
        allowedUoms: isServiceLike ? [] : normalizedAllowedUoms,
        trackInventory: isServiceLike ? false : trackInventory,
        defaultCost: parseNullableNumber(defaultCost, "Default cost"),
        defaultPrice: parseNullableNumber(defaultPrice, "Default price"),
        reorderLevel: parseReorderLevel(reorderLevel),
        isActive: mode === "create" ? true : isActive,
      };

      setSaving(true);
      await onSubmit(dto);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const chipTone: StatusChipTone =
    mode === "create" ? "draft" : isActive ? "success" : "danger";
  const chipLabel =
    mode === "create" ? "Draft" : isActive ? "Active" : "Inactive";

  const uomSubtitle = isServiceLike
    ? "Service / non-stock items do not require UOM conversions"
    : "FUOM is the base unit. Store UOM maps to issue UOM";

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
            {isServiceLike
              ? "Service / non-stock item"
              : "Stock item with FUOM, store UOM, and conversion rules"}
          </div>
        </div>

        <div className="iif-header__actions">
          <StatusChip label={chipLabel} tone={chipTone} />
          <button className="inv-btn inv-btn--ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="inv-btn inv-btn--solid" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save item"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="iif-alert">
          {error}
        </div>
      )}

      {/* Body */}
      <div className="iif-body">

        {/* Item information */}
        <Section
          title="Item information"
          subtitle="Basic identity and classification"
        >
          <FormGrid>
            <Field label="Item name *" colSpan={4}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tomato, Beef, Room Service"
                className="inv-input"
              />
            </Field>

            <Field label="SKU" colSpan={2}>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU-001"
                className="inv-input"
              />
            </Field>

            <Field label="Barcode" colSpan={3}>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="0000000000000"
                className="inv-input"
              />
            </Field>

            <Field label="Local name" colSpan={3}>
              <input
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="Optional"
                className="inv-input"
              />
            </Field>

            <Field label="Category" colSpan={3}>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="inv-input"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Item type *" colSpan={3}>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ItemType)}
                className="inv-input"
              >
                {ITEM_TYPES.map((t) => (
                  <option key={String(t.value)} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Track inventory" colSpan={3}>
              <CheckboxField
                checked={trackInventory}
                disabled={isServiceLike}
                label="Yes"
                onChange={setTrackInventory}
              />
            </Field>

            {mode === "edit" && (
              <Field label="Active status" colSpan={3}>
                <CheckboxField
                  checked={isActive}
                  label={isActive ? "Active" : "Inactive"}
                  onChange={setIsActive}
                />
              </Field>
            )}
          </FormGrid>
        </Section>

        {/* Unit of measurement */}
        <Section title="Unit of measurement" subtitle={uomSubtitle}>
          <FormGrid>
            <Field label={`FUOM / base UOM${!isServiceLike ? " *" : ""}`} colSpan={4}>
              <select
                value={baseUomId}
                onChange={(e) => setBaseUomId(e.target.value)}
                disabled={isServiceLike}
                className="inv-input"
              >
                <option value="">—</option>
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code ? `${u.name} (${u.code})` : u.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Store UOM / issue UOM" colSpan={4}>
              <select
                value={storeUomId}
                onChange={(e) => setStoreUomId(e.target.value)}
                disabled={isServiceLike || !baseUomId}
                className="inv-input"
              >
                <option value="">—</option>
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code ? `${u.name} (${u.code})` : u.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Conversion source" colSpan={4}>
              <ReadOnlyField text="Loaded from UOM conversion database" />
            </Field>
          </FormGrid>

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
                    uoms={uoms.map((u) => ({
                      id: u.id,
                      code: u.code ?? "",
                      name: u.name,
                    }))}
                    rows={allowedUoms.filter((r) => !r.isBase)}
                    onChange={(rows) => {
                      setAllowedUoms((current) => {
                        const baseRow = current.find(
                          (r) => r.isBase && r.uomId === baseUomId
                        );
                        const merged = [
                          ...(baseRow ? [baseRow] : []),
                          ...rows.map((r) => ({ ...r, isBase: false })),
                        ];
                        const normalized = normalizeAllowedUoms(merged, baseUomId, storeUomId, uoms);
                        void hydrateMissingFactors(normalized);
                        return normalized;
                      });
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </Section>

        {/* Costing & control */}
        <Section
          title="Costing & control"
          subtitle="Default values used by inventory and recipe costing"
        >
          <FormGrid>
            <Field label="Default cost" colSpan={3}>
              <input
                type="number"
                inputMode="decimal"
                value={defaultCost}
                onChange={(e) => setDefaultCost(e.target.value)}
                placeholder="0.00"
                className="inv-input"
              />
            </Field>

            <Field label="Default price" colSpan={3}>
              <input
                type="number"
                inputMode="decimal"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
                placeholder="0.00"
                className="inv-input"
              />
            </Field>

            <Field label="Reorder level" colSpan={3}>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                placeholder="Optional"
                className="inv-input"
              />
            </Field>
          </FormGrid>
        </Section>

      </div>
    </div>
  );
}
