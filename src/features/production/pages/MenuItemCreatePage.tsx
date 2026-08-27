import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { useErpNavigate } from "../../../routes/useErpNavigation";
import { menuItemsApi } from "../api/menuItemsApi";
import type {
  MenuCategoryDto,
  StockLocationDto,
  UpsertMenuItemRequest,
} from "../types";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import "../layout/production.css";

function normalizeList<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : res.items ?? [];
}

function extractApiError(err: unknown): string {
  const e = err as any;
  const data = e?.response?.data;

  if (!data) {
    return e?.message ?? "Unable to complete the request. Please try again.";
  }

  if (typeof data === "string") return data;
  if (typeof data.message === "string") return data.message;
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.title === "string") return data.title;
  if (typeof data.error === "string") return data.error;

  return "Unable to complete the request. Please try again.";
}

function normalizeText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function MenuItemCreatePage() {
  const erpNav = useErpNavigate();
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

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const selectedCategory = categoryMap.get(categoryId);
  const inheritedLocationName =
    selectedCategory?.defaultConsumptionLocationName ?? null;

  const price = Number.parseFloat(sellingPrice);

  const canSave = useMemo(() => {
    return Boolean(
      companyId &&
        branchId &&
        name.trim() &&
        categoryId &&
        !Number.isNaN(price) &&
        price >= 0 &&
        !saving &&
        !loadingLookups
    );
  }, [
    companyId,
    branchId,
    name,
    categoryId,
    price,
    saving,
    loadingLookups,
  ]);

  useEffect(() => {
    if (!companyId || !branchId) return;

    let cancelled = false;

    async function loadLookups() {
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

    void loadLookups();

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  async function onSave() {
    if (saving) return;

    if (!companyId) {
      setError("Company scope is missing.");
      return;
    }

    if (!branchId) {
      setError("Branch scope is missing.");
      return;
    }

    if (!name.trim()) {
      setError("Menu item name is required.");
      return;
    }

    if (!categoryId) {
      setError("Category is required.");
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      setError("Selling price must be a valid amount.");
      return;
    }

    const payload: UpsertMenuItemRequest = {
      name: name.trim(),
      code: normalizeText(code),
      externalCode: normalizeText(externalCode),
      categoryId,
      subCategoryId: null,
      itemType,
      sellingPrice: price,
      isActive,
      isAvailableForSale,
      consumptionLocationId: normalizeText(consumptionLocationId),
      outputItemId: null,
      outputUomId: null,
    };

    setSaving(true);
    setError(null);

    try {
      const created = await menuItemsApi.create(companyId, branchId, payload);

      erpNav(`/production/menu/items/${created.id}`);
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void onSave();
  }

  function goBackToList() {
    erpNav("/production/menu/items");
  }

  if (!companyId) {
    return (
      <div className="p-page">
        <div className="p-guard">
          <div className="p-guard__icon"></div>
          Company scope is required to continue.
        </div>
      </div>
    );
  }

  if (!branchId) {
    return (
      <div className="p-page">
        <div className="p-guard">
          <div className="p-guard__icon"></div>
          Select a branch to continue.
        </div>
      </div>
    );
  }

  return (
    <form className="p-page" style={{ maxWidth: 1100 }} onSubmit={handleSubmit}>
      <ProductionWorkflowBar active="menu" />

      <div className="p-page-header">
        <div>
          <p className="p-kicker">Menu Configuration</p>
          <h1 className="p-title">Create Menu Item</h1>
          <p className="p-subtitle">
            Configure sales readiness, category, price, and stock consumption behavior.
          </p>
        </div>

        <button
          type="button"
          className="p-btn p-btn--ghost"
          onClick={goBackToList}
          disabled={saving}
        >
          - Cancel
        </button>
      </div>

      {error && (
        <div className="p-alert p-alert--error">
          <span className="p-alert__body">{error}</span>
          <button
            type="button"
            className="p-dismiss"
            onClick={() => setError(null)}
          >
            
          </button>
        </div>
      )}

      <section className="p-kitchen-hero" aria-label="Menu item creation intent">
        <div>
          <p className="p-kicker">Menu Item Creation</p>
          <h1 className="p-title">Create only guest-facing sales items here</h1>
          <p className="p-subtitle">
            Menu Items are sales items for POS and reports. If the kitchen produces a prep item that is not sold directly, create it as a Semi-Finished inventory item and select it later in Recipe Editor OUTPUT.
          </p>
        </div>

        <div className="p-kitchen-status-grid">
          <div className="p-kitchen-status is-ready">
            <span>POS sales item</span>
            <strong>This screen</strong>
          </div>
          <div className="p-kitchen-status">
            <span>Prep-only output</span>
            <strong>Inventory Master</strong>
          </div>
          <div className="p-kitchen-status">
            <span>Recipe OUTPUT</span>
            <strong>Stock received</strong>
          </div>
          <div className="p-kitchen-status">
            <span>Sales behavior</span>
            <strong>{isAvailableForSale ? "Available for POS" : "Not for POS"}</strong>
          </div>
        </div>
      </section>

      <div className="p-card">
        <div className="p-card__head">
          <div>
            <p className="p-card__title">Sales Item Setup</p>
            <p className="p-card__subtitle">
              Create a POS-facing menu item. Production outputs are inventory items selected later in Recipe Editor.
            </p>
          </div>

          <span
            className={`p-badge ${
              isAvailableForSale ? "p-badge--active" : "p-badge--inactive"
            }`}
          >
            {isAvailableForSale ? "Sellable" : "Not for Sale"}
          </span>
        </div>

        <fieldset
          className="p-card__body"
          disabled={saving || loadingLookups}
          style={{ border: 0, padding: 0, margin: 0 }}
        >
          <div className="p-alert p-alert--info">
            <span className="p-alert__body">
              This page creates Menu Items for POS and Sales. Prep-only production outputs are created in Inventory Master as Semi-Finished or Finished Good, then selected in Recipe Editor OUTPUT - Stock received into inventory.
            </span>
          </div>

          <div className="p-grid-2">
            <div className="p-field">
              <label className="p-field__label">Menu Item Name *</label>
              <input
                className="p-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="p-field">
              <label className="p-field__label">Code / SKU</label>
              <input
                className="p-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="p-field">
              <label className="p-field__label">External POS Code</label>
              <input
                className="p-input"
                value={externalCode}
                onChange={(e) => setExternalCode(e.target.value)}
                autoComplete="off"
              />
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
              />
            </div>

            <div className="p-field">
              <label className="p-field__label">Category *</label>
              <select
                className="p-select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">
                  {loadingLookups ? "Loading..." : "Select category"}
                </option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.code
                      ? `${category.name} (${category.code})`
                      : category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-field">
              <label className="p-field__label">
                Consumption Stock Location
              </label>
              <select
                className="p-select"
                value={consumptionLocationId}
                onChange={(e) => setConsumptionLocationId(e.target.value)}
              >
                <option value="">
                  Use category default
                  {inheritedLocationName ? ` - ${inheritedLocationName}` : ""}
                </option>

                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code
                      ? `${location.name} (${location.code})`
                      : location.name}
                  </option>
                ))}
              </select>

              <span className="p-field__hint">
                Leave blank to inherit the category default. Override only when this item
                consumes from a different stock location.
              </span>
            </div>

            <div className="p-field">
              <label className="p-field__label">Item Type</label>
              <select
                className="p-select"
                value={itemType}
                onChange={(e) => setItemType(Number(e.target.value))}
              >
                <option value={1}>Prepared Food - POS sales item</option>
                <option value={2}>Beverage - POS sales item</option>
                <option value={3}>Service / Non-stock sales item</option>
              </select>
              <span className="p-field__hint">
                Semi-Finished and Finished Good types belong to Inventory Master, not Menu Item creation.
              </span>
            </div>
          </div>

          <div className="p-grid-2" style={{ marginTop: 16 }}>
            <label className="p-checkbox">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Active</span>
            </label>

            <label className="p-checkbox">
              <input
                type="checkbox"
                checked={isAvailableForSale}
                onChange={(e) => setIsAvailableForSale(e.target.checked)}
              />
              <span>Available for POS sale</span>
            </label>
          </div>

          <div className="p-alert p-alert--info" style={{ marginTop: 16 }}>
            <span className="p-alert__body">
              POS readiness requires an active item, available-for-sale status, recipe setup, and a consumption stock location from either the item or category.
            </span>
          </div>
        </fieldset>

        <div className="p-card__footer">
          <button
            type="button"
            className="p-btn p-btn--outline"
            onClick={goBackToList}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="p-btn p-btn--accent p-btn--lg"
            disabled={!canSave}
          >
            {saving ? "Creating..." : "Create Menu Item"}
          </button>
        </div>
      </div>
    </form>
  );
}
