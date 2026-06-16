// src/features/production/pages/MenuItemDetailPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { menuItemsApi } from "../api/menuItemsApi";
import { productionRecipesApi } from "../api/recipesApi";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import type {
  MenuCategoryDto,
  MenuItemDto,
  RecipeDto,
  StockLocationDto,
  UpsertMenuItemRequest,
} from "../types";
import "./menu-item-detail.css";
import "../production.css";

function normalizeList<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : res.items ?? [];
}

function extractApiError(e: unknown, fallback = "Request failed."): string {
  const err = e as any;
  const data = err?.response?.data;
  if (!data) return err?.message ?? fallback;
  if (typeof data === "string") return data;
  return data?.message ?? data?.title ?? err?.message ?? fallback;
}

function money(value?: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-card" style={{ margin: 0 }}>
      <div className="p-card__body" style={{ padding: 14 }}>
        <div style={{ fontSize: 11, color: "var(--p-text-muted)", textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
      </div>
    </div>
  );
}

function CheckRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`p-check ${ok ? "p-check--ok" : "p-check--warn"}`}>
      <span className="p-check__icon">{ok ? "✓" : "!"}</span>
      <span>{text}</span>
    </div>
  );
}

export default function MenuItemDetailPage() {
  const nav = useNavigate();
  const { id: menuItemId } = useParams<{ id?: string }>();
  const { companyId, branchId } = useAppScope();

  const [item, setItem] = useState<MenuItemDto | null>(null);
  const [recipe, setRecipe] = useState<RecipeDto | null>(null);
  const [categories, setCategories] = useState<MenuCategoryDto[]>([]);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [externalCode, setExternalCode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [itemType, setItemType] = useState(1);
  const [consumptionLocationId, setConsumptionLocationId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isAvailableForSale, setIsAvailableForSale] = useState(true);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedCategory = categories.find((x) => x.id === categoryId);

  const effectiveLocationName =
    locations.find((x) => x.id === consumptionLocationId)?.name ||
    selectedCategory?.defaultConsumptionLocationName ||
    item?.categoryConsumptionLocationName ||
    null;

  const ingredientCount = recipe?.lines?.length ?? 0;

  const posReady = Boolean(
    item?.isActive &&
      item?.isAvailableForSale &&
      item?.hasRecipe &&
      item?.hasConsumptionLocation
  );

  const canSave = useMemo(
    () =>
      Boolean(
        companyId &&
          branchId &&
          menuItemId &&
          name.trim() &&
          categoryId &&
          Number(sellingPrice) >= 0 &&
          !saving
      ),
    [companyId, branchId, menuItemId, name, categoryId, sellingPrice, saving]
  );

  function bindItem(dto: MenuItemDto) {
    setItem(dto);
    setName(dto.name ?? "");
    setCode(dto.code ?? "");
    setExternalCode(dto.externalCode ?? "");
    setCategoryId(dto.categoryId ?? "");
    setSellingPrice(String(dto.sellingPrice ?? 0));
    setItemType(dto.itemType ?? 1);
    setConsumptionLocationId(dto.consumptionLocationId ?? "");
    setIsActive(dto.isActive);
    setIsAvailableForSale(dto.isAvailableForSale);
  }

  async function load() {
    if (!companyId || !branchId || !menuItemId) return;

    setLoading(true);
    setError(null);

    try {
      const [itemRes, catRes, locRes, recipeRes] = await Promise.allSettled([
        menuItemsApi.get(companyId, branchId, menuItemId),
        menuItemsApi.listCategories(companyId, branchId),
        menuItemsApi.listStockLocations(companyId, branchId),
        productionRecipesApi.getByMenuItem(companyId, menuItemId),
      ]);

      if (itemRes.status === "fulfilled") bindItem(itemRes.value);
      else throw itemRes.reason;

      if (catRes.status === "fulfilled") {
        setCategories(
          normalizeList<MenuCategoryDto>(catRes.value)
            .filter((x) => x.isActive !== false)
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      }

      if (locRes.status === "fulfilled") {
        setLocations(
          normalizeList<StockLocationDto>(locRes.value)
            .filter((x) => x.isActive !== false)
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      }

      if (recipeRes.status === "fulfilled") setRecipe(recipeRes.value);
      else setRecipe(null);
    } catch (e) {
      setError(extractApiError(e, "Failed to load menu item."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, branchId, menuItemId]);

  async function save() {
    if (!companyId || !branchId || !menuItemId || !item) return;
    if (!name.trim()) return setError("Menu item name is required.");
    if (!categoryId) return setError("Category is required.");

    const payload: UpsertMenuItemRequest = {
      name: name.trim(),
      code: code.trim() || null,
      externalCode: externalCode.trim() || null,
      categoryId,
      subCategoryId: item.subCategoryId ?? null,
      itemType,
      sellingPrice: Number(sellingPrice || 0),
      isActive,
      isAvailableForSale,
      consumptionLocationId: consumptionLocationId || null,
      outputItemId: item.outputItemId ?? null,
      outputUomId: item.outputUomId ?? null,
    };

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const updated = await menuItemsApi.update(companyId, branchId, menuItemId, payload);
      bindItem(updated);
      setNotice("Menu item configuration saved.");
      await load();
    } catch (e) {
      setError(extractApiError(e, "Failed to save menu item."));
    } finally {
      setSaving(false);
    }
  }

  if (!companyId || !branchId || !menuItemId) {
    return (
      <div className="p-page">
        <div className="p-guard">
          <div className="p-guard__icon">⚙</div>
          Company, branch, or menu item context is missing.
        </div>
      </div>
    );
  }

  return (
    <div className="p-page" style={{ maxWidth: 1220 }}>
      <ProductionWorkflowBar active="menu" menuItemId={menuItemId} />

      <div className="p-page-header">
        <div>
          <p className="p-kicker">Menu Configuration Workspace</p>
          <h1 className="p-title">{item?.name || "Menu Item"}</h1>
          <p className="p-subtitle">
            Configure branch sales behavior, selling price, POS availability, and stock
            consumption location.
          </p>
        </div>

        <div className="p-btn-row">
          <button className="p-btn p-btn--outline" onClick={() => nav(-1)} disabled={saving}>
            ← Back
          </button>
          <button className="p-btn p-btn--accent" onClick={save} disabled={!canSave}>
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-alert p-alert--error">
          <span className="p-alert__body">{error}</span>
          <button className="p-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {notice && (
        <div className="p-alert p-alert--success">
          <span className="p-alert__body">{notice}</span>
          <button className="p-dismiss" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {loading || !item ? (
        <div className="p-card">
          <div className="p-card__body" style={{ color: "var(--p-text-muted)" }}>
            Loading menu configuration...
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(150px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <Metric label="Selling Price" value={money(item.sellingPrice)} />
            <Metric label="Recipe Cost" value={money(item.cost)} />
            <Metric label="Units Sold" value={item.unitsSold ?? 0} />
            <Metric label="Effective Location" value={effectiveLocationName ?? "Missing"} />
            <Metric label="POS Status" value={posReady ? "Ready" : "Blocked"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 16 }}>
            <div className="p-card">
              <div className="p-card__head">
                <div>
                  <p className="p-card__title">Commercial & POS Configuration</p>
                  <p className="p-card__subtitle">
                    Controls how this item appears in POS and sales dashboards.
                  </p>
                </div>
                <span className={`p-badge ${posReady ? "p-badge--active" : "p-badge--inactive"}`}>
                  {posReady ? "POS Ready" : "Blocked"}
                </span>
              </div>

              <div className="p-card__body">
                <div className="p-grid-2">
                  <div className="p-field">
                    <label className="p-field__label">Menu Item Name *</label>
                    <input className="p-input" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
                  </div>

                  <div className="p-field">
                    <label className="p-field__label">Code / SKU</label>
                    <input className="p-input" value={code} onChange={(e) => setCode(e.target.value)} disabled={saving} />
                  </div>

                  <div className="p-field">
                    <label className="p-field__label">External POS Code</label>
                    <input className="p-input" value={externalCode} onChange={(e) => setExternalCode(e.target.value)} disabled={saving} />
                  </div>

                  <div className="p-field">
                    <label className="p-field__label">Selling Price *</label>
                    <input
                      className="p-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div className="p-field">
                    <label className="p-field__label">Category *</label>
                    <select className="p-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={saving}>
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code ? `${c.name} (${c.code})` : c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-field">
                    <label className="p-field__label">Item Type</label>
                    <select className="p-select" value={itemType} onChange={(e) => setItemType(Number(e.target.value))} disabled={saving}>
                      <option value={1}>Food / Recipe Item</option>
                      <option value={2}>Beverage</option>
                      <option value={3}>Service / Non-stock</option>
                    </select>
                  </div>

                  <div className="p-field">
                    <label className="p-field__label">Consumption Stock Location</label>
                    <select
                      className="p-select"
                      value={consumptionLocationId}
                      onChange={(e) => setConsumptionLocationId(e.target.value)}
                      disabled={saving}
                    >
                      <option value="">
                        Use category default
                        {selectedCategory?.defaultConsumptionLocationName
                          ? ` — ${selectedCategory.defaultConsumptionLocationName}`
                          : ""}
                      </option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code ? `${l.name} (${l.code})` : l.name}
                        </option>
                      ))}
                    </select>
                    <span className="p-field__hint">
                      Leave blank to inherit the category default. Override when this item consumes
                      from a different branch stock location.
                    </span>
                  </div>
                </div>

                <div className="p-grid-2" style={{ marginTop: 16 }}>
                  <label className="p-checkbox">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={saving} />
                    <span>Active</span>
                  </label>

                  <label className="p-checkbox">
                    <input
                      type="checkbox"
                      checked={isAvailableForSale}
                      onChange={(e) => setIsAvailableForSale(e.target.checked)}
                      disabled={saving}
                    />
                    <span>Available for POS sale</span>
                  </label>
                </div>
              </div>

              <div className="p-card__footer">
                <button className="p-btn p-btn--outline" onClick={() => load()} disabled={saving}>
                  Reset
                </button>
                <button className="p-btn p-btn--accent p-btn--lg" onClick={save} disabled={!canSave}>
                  {saving ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </div>

            <div className="p-card">
              <div className="p-card__head">
                <div>
                  <p className="p-card__title">POS Readiness</p>
                  <p className="p-card__subtitle">
                    Shows why the item is sellable or blocked in POS.
                  </p>
                </div>
              </div>

              <div className="p-card__body">
                <div className="p-checklist">
                  <CheckRow ok={item.isActive} text="Menu item is active" />
                  <CheckRow ok={item.isAvailableForSale} text="Available for sale" />
                  <CheckRow ok={item.hasConsumptionLocation} text="Consumption location configured" />
                  <CheckRow ok={item.hasRecipe} text="Recipe configured" />
                  <CheckRow ok={ingredientCount > 0} text={`${ingredientCount} ingredient line(s)`} />
                  <CheckRow ok={recipe?.isActive !== false} text="Recipe active" />
                </div>

                <div className="p-action-panel">
                  <div>
                    <div className="p-action-panel__title">
                      {posReady ? "Ready for POS" : "Blocked from POS"}
                    </div>
                    <p className="p-action-panel__text">
                      Effective consumption location: <strong>{effectiveLocationName ?? "Missing"}</strong>
                    </p>
                  </div>

                  <button
                    className="p-btn p-btn--accent"
                    onClick={() => nav(`/production/menu/items/${menuItemId}/recipe`)}
                  >
                    Open Recipe Editor
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}