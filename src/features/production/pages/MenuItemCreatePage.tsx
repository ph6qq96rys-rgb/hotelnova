import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { menuItemsApi } from "../api/menuItemsApi";
import type { MenuCategoryDto, StockLocationDto, UpsertMenuItemRequest } from "../types";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import "../production.css";

function normalizeList<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : res.items ?? [];
}

function extractApiError(err: unknown): string {
  const e = err as any;
  const data = e?.response?.data;
  if (!data) return e?.message ?? "Request failed.";
  if (typeof data === "string") return data;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.title === "string") return data.title;
  return "Request failed.";
}

export default function MenuItemCreatePage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [externalCode, setExternalCode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [itemType, setItemType] = useState(1);
  const [consumptionLocationId, setConsumptionLocationId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isAvailableForSale, setIsAvailableForSale] = useState(true);

  const [categories, setCategories] = useState<MenuCategoryDto[]>([]);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = categories.find((x) => x.id === categoryId);
  const inheritedLocationName = selectedCategory?.defaultConsumptionLocationName ?? null;

  const canSave = useMemo(
    () =>
      Boolean(companyId && branchId && name.trim() && categoryId && Number(sellingPrice) >= 0 && !saving),
    [companyId, branchId, name, categoryId, sellingPrice, saving]
  );

  useEffect(() => {
    if (!companyId || !branchId) return;

    let cancelled = false;

    async function load() {
      setLoadingLookups(true);
      setError(null);

      try {
        const [catRes, locRes] = await Promise.all([
          menuItemsApi.listCategories(companyId, branchId),
          menuItemsApi.listStockLocations(companyId, branchId),
        ]);

        if (cancelled) return;

        setCategories(
          normalizeList<MenuCategoryDto>(catRes)
            .filter((x) => x.isActive !== false)
            .sort((a, b) => a.name.localeCompare(b.name))
        );

        setLocations(
          normalizeList<StockLocationDto>(locRes)
            .filter((x) => x.isActive !== false)
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (e) {
        if (!cancelled) setError(extractApiError(e));
      } finally {
        if (!cancelled) setLoadingLookups(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  async function onSave() {
    if (!companyId) return setError("Select a company first.");
    if (!branchId) return setError("Select a branch first.");
    if (!name.trim()) return setError("Menu item name is required.");
    if (!categoryId) return setError("Category is required.");

    const payload: UpsertMenuItemRequest = {
      name: name.trim(),
      code: code.trim() || null,
      externalCode: externalCode.trim() || null,
      categoryId,
      subCategoryId: null,
      itemType,
      sellingPrice: Number(sellingPrice || 0),
      isActive,
      isAvailableForSale,
      consumptionLocationId: consumptionLocationId || null,
      outputItemId: null,
      outputUomId: null,
    };

    setSaving(true);
    setError(null);

    try {
      const created = await menuItemsApi.create(companyId, branchId, payload);
      nav(`/production/menu/items/${created.id}`);
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setSaving(false);
    }
  }

  if (!companyId || !branchId) {
    return (
      <div className="p-page">
        <div className="p-guard">
          <div className="p-guard__icon">⚙</div>
          Select a company and branch to continue.
        </div>
      </div>
    );
  }

  return (
    <div className="p-page" style={{ maxWidth: 1100 }}>
      <ProductionWorkflowBar active="menu" />

      <div className="p-page-header">
        <div>
          <p className="p-kicker">Menu Configuration</p>
          <h1 className="p-title">Create Menu Item</h1>
          <p className="p-subtitle">
            Configure sales readiness, branch association, category, price, and stock consumption behavior.
          </p>
        </div>
        <button className="p-btn p-btn--ghost" onClick={() => nav(-1)} disabled={saving}>
          ← Cancel
        </button>
      </div>

      {error && (
        <div className="p-alert p-alert--error">
          <span className="p-alert__body">{error}</span>
          <button className="p-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="p-card">
        <div className="p-card__head">
          <div>
            <p className="p-card__title">Commercial Setup</p>
            <p className="p-card__subtitle">This item appears in POS and sales reports when active and available for sale.</p>
          </div>
          <span className={`p-badge ${isAvailableForSale ? "p-badge--active" : "p-badge--inactive"}`}>
            {isAvailableForSale ? "Sellable" : "Not for Sale"}
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
              <select className="p-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={saving || loadingLookups}>
                <option value="">{loadingLookups ? "Loading..." : "Select category"}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.name} (${c.code})` : c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-field">
              <label className="p-field__label">Consumption Stock Location</label>
              <select
                className="p-select"
                value={consumptionLocationId}
                onChange={(e) => setConsumptionLocationId(e.target.value)}
                disabled={saving || loadingLookups}
              >
                <option value="">Use category default{inheritedLocationName ? ` — ${inheritedLocationName}` : ""}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code ? `${l.name} (${l.code})` : l.name}
                  </option>
                ))}
              </select>
              <span className="p-field__hint">
                Leave blank to inherit the category default. Override only when this item consumes from a different stock location.
              </span>
            </div>

            <div className="p-field">
              <label className="p-field__label">Item Type</label>
              <select className="p-select" value={itemType} onChange={(e) => setItemType(Number(e.target.value))} disabled={saving}>
                <option value={1}>Food / Recipe Item</option>
                <option value={2}>Beverage</option>
                <option value={3}>Service / Non-stock</option>
              </select>
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

          <div className="p-alert p-alert--warning" style={{ marginTop: 16 }}>
            <span className="p-alert__body">
              POS readiness requires: active item, available for sale, recipe configured, and consumption location configured either on item or category.
            </span>
          </div>
        </div>

        <div className="p-card__footer">
          <button className="p-btn p-btn--outline" onClick={() => nav(-1)} disabled={saving}>
            Cancel
          </button>
          <button className="p-btn p-btn--accent p-btn--lg" onClick={onSave} disabled={!canSave}>
            {saving ? "Creating..." : "Create Menu Item"}
          </button>
        </div>
      </div>
    </div>
  );
}