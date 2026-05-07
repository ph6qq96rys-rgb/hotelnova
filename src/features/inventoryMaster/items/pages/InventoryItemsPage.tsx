// src/features/inventory/items/pages/InventoryItemsPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePageMeta } from "../../../../hooks/usePageMeta";
import { useAppScope } from "../../../../app/useAppScope";
import { inventoryItemsApi } from "../api/inventoryItemsApi";
import type { InventoryItemDto, CategoryDto, UomDto, ItemUomDto } from "../types";
import type { InventoryItemFormDto } from "../components/InventoryItemForm";
import InventoryItemForm from "../components/InventoryItemForm";
import "./inventory-items.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type InventoryItemRow = InventoryItemDto & {
  localName?: string | null;
  reorderLevel?: number | null;
  issueUomId?: string | null;
  allowedUoms?: ItemUomDto[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "Request failed.";

  const e = error as { response?: { data?: unknown }; message?: string };
  const data = e.response?.data;

  if (!data) return e.message ?? "Request failed.";
  if (typeof data === "string") return data;

  if (typeof data === "object" && data !== null) {
    const d = data as { title?: string; message?: string; errors?: unknown };
    if (d.message) return d.message;
    if (d.title && d.errors) return `${d.title}: ${JSON.stringify(d.errors)}`;
    if (d.title) return d.title;
    try { return JSON.stringify(d); } catch { /* fall through */ }
  }

  return e.message ?? "Request failed.";
}

function formatUom(uom: UomDto): string {
  const code = (uom as UomDto & { code?: string }).code ?? uom.symbol;
  return code ? `${uom.name} (${code})` : uom.name;
}

function getStoreUomId(item: InventoryItemRow): string | null {
  return item.issueUomId ?? item.allowedUoms?.find((u) => u.isIssue)?.uomId ?? null;
}

function isServiceLike(form: InventoryItemFormDto): boolean {
  return form.type === "Service" || form.type === "NonStock";
}

// ─── Form validation & mapping ────────────────────────────────────────────────

function validateForm(companyId: string | null | undefined, form: InventoryItemFormDto): void {
  if (!companyId) throw new Error("Missing company ID.");
  if (!form.name.trim()) throw new Error("Name is required.");
  if (!isServiceLike(form) && !form.baseUomId) throw new Error("FUOM / Base UOM is required.");
}

function buildCreateBody(companyId: string, form: InventoryItemFormDto) {
  validateForm(companyId, form);
  return {
    companyId,
    name:           form.name.trim(),
    localName:      form.localName || null,
    sku:            form.sku || null,
    barcode:        form.barcode || null,
    categoryId:     form.categoryId || null,
    baseUomId:      form.baseUomId,
    type:           form.type,
    allowedUoms:    form.allowedUoms ?? [],
    trackInventory: Boolean(form.trackInventory),
    defaultCost:    form.defaultCost ?? null,
    defaultPrice:   form.defaultPrice ?? null,
    reorderLevel:   form.reorderLevel ?? 0,
    isActive:       true as const,
  };
}

function buildUpdateBody(companyId: string, itemId: string, form: InventoryItemFormDto) {
  if (!itemId) throw new Error("Missing item ID.");
  validateForm(companyId, form);
  return {
    ...buildCreateBody(companyId, form),
    id:       itemId,
    isActive: form.isActive ?? true,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inv-badge ${active ? "inv-badge--active" : "inv-badge--inactive"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryItemsPage() {
  usePageMeta({
    title:    "Inventory Items",
    subtitle: "Create and maintain item master data",
  });

  const { companyId } = useAppScope();

  const [items,         setItems]         = useState<InventoryItemDto[]>([]);
  const [categoriesRaw, setCategoriesRaw] = useState<CategoryDto[]>([]);
  const [uomsRaw,       setUomsRaw]       = useState<UomDto[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [query,         setQuery]         = useState("");
  const [editing,       setEditing]       = useState<InventoryItemDto | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, categoriesRes, uomsRes] = await Promise.all([
        inventoryItemsApi.list(companyId),
        inventoryItemsApi.getCategories(companyId),
        inventoryItemsApi.getUoms(companyId),
      ]);
      setItems(itemsRes ?? []);
      setCategoriesRaw(categoriesRes ?? []);
      setUomsRaw(uomsRes ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const uomById = useMemo(
    () => new Map(uomsRaw.map((u) => [u.id, formatUom(u)])),
    [uomsRaw]
  );

  const categories = useMemo(
    () => categoriesRaw.map(({ id, name }) => ({ id, name })),
    [categoriesRaw]
  );

  const uomOptions = useMemo(
    () =>
      uomsRaw.map((u) => ({
        id:   u.id,
        name: u.name,
        code: (u as UomDto & { code?: string }).code ?? u.symbol ?? "",
      })),
    [uomsRaw]
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((raw) => {
      const item = raw as InventoryItemRow;
      return (
        item.name?.toLowerCase().includes(q) ||
        item.localName?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSubmit = async (formDto: InventoryItemFormDto) => {
    if (!companyId) return;
    setError(null);
    try {
      if (!editing) {
        await inventoryItemsApi.create(companyId, buildCreateBody(companyId, formDto));
      } else {
        await inventoryItemsApi.update(
          companyId,
          editing.id,
          buildUpdateBody(companyId, editing.id, formDto)
        );
      }
      setEditing(null);
      await loadAll();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const handleToggleActive = async (item: InventoryItemDto) => {
    if (!companyId) return;
    const next = !item.isActive;
    if (!window.confirm(next ? "Activate this item?" : "Deactivate this item?")) return;
    setError(null);
    try {
      await inventoryItemsApi.setActive(companyId, item.id, next);
      await loadAll();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const handleEdit = (item: InventoryItemDto) => {
    setEditing(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCreateNew = () => {
    setEditing(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!companyId) {
    return <div className="inv-page-guard">Select a company first.</div>;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Banner */}
      <div className="inv-banner">
        <div>
          <p className="inv-banner__kicker">Item master</p>
          <h1 className="inv-banner__title">Inventory items</h1>
          <p className="inv-banner__subtitle">
            Manage English and local-language names, FUOM, store UOM, reorder level, tracking, and status.
          </p>
        </div>
        <div className="inv-banner__right">
          <div className="inv-banner__count">
            <span className="inv-banner__count-label">Showing</span>
            <span className="inv-banner__count-value">{filteredItems.length}</span>
          </div>
          <button className="inv-btn inv-btn--outline" onClick={handleCreateNew}>
            + New item
          </button>
        </div>
      </div>

      {/* Form */}
      <InventoryItemForm
        mode={editing ? "edit" : "create"}
        initial={editing}
        categories={categories}
        uoms={uomOptions}
        onCancel={() => setEditing(null)}
        onSubmit={handleSubmit}
      />

      {/* Page-level error */}
      {error && (
        <div className="inv-alert inv-alert--error" role="alert">{error}</div>
      )}

      {/* Item register */}
      <div className="inv-card">
        <div className="inv-card__head">
          <div>
            <h2 className="inv-card__title">Item register</h2>
            <p className="inv-card__subtitle">Search by English name, local name, or SKU.</p>
          </div>
          <div className="inv-search-wrap">
            <input
              className="inv-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items…"
            />
          </div>
        </div>

        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>English name</th>
                <th>Local name</th>
                <th>SKU</th>
                <th>FUOM</th>
                <th>Store UOM</th>
                <th>Reorder</th>
                <th>Track</th>
                <th>Status</th>
                <th className="inv-table__actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="inv-table__empty">Loading…</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="inv-table__empty">No items found.</td>
                </tr>
              ) : (
                filteredItems.map((raw) => {
                  const item = raw as InventoryItemRow;
                  const storeUomId = getStoreUomId(item);
                  return (
                    <tr key={item.id}>
                      <td className="inv-table__name">{item.name}</td>
                      <td dir="auto">{item.localName || "—"}</td>
                      <td>{item.sku ?? "—"}</td>
                      <td>{uomById.get(item.baseUomId) ?? "—"}</td>
                      <td>{storeUomId ? (uomById.get(storeUomId) ?? "—") : "—"}</td>
                      <td>{item.reorderLevel == null ? "—" : String(item.reorderLevel)}</td>
                      <td>{item.trackInventory ? "Yes" : "No"}</td>
                      <td><StatusBadge active={Boolean(item.isActive)} /></td>
                      <td className="inv-table__actions-col">
                        <div className="inv-table__actions">
                          <button
                            className="inv-btn inv-btn--sm inv-btn--outline"
                            onClick={() => handleEdit(item)}
                          >
                            Edit
                          </button>
                          <button
                            className={`inv-btn inv-btn--sm ${item.isActive ? "inv-btn--danger" : "inv-btn--primary"}`}
                            onClick={() => handleToggleActive(item)}
                          >
                            {item.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
