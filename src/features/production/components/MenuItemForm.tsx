import type { Dispatch, SetStateAction } from "react";
import type { MenuCategoryDto, MenuItemDto, StockLocationDto } from "../types";
import type { MenuItemFormState } from "../hooks/useMenuItemDetail";

type Props = {
  item: MenuItemDto;
  form: MenuItemFormState;
  setForm: Dispatch<SetStateAction<MenuItemFormState>>;
  categories: MenuCategoryDto[];
  locations: StockLocationDto[];
  selectedCategory?: MenuCategoryDto;
  posReady: boolean;
  saving: boolean;
  canSave: boolean;
  onSave: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
};

function labelWithCode(name?: string | null, code?: string | null): string {
  const cleanName = String(name ?? "").trim() || "Unnamed";
  const cleanCode = String(code ?? "").trim();

  return cleanCode ? `${cleanName} (${cleanCode})` : cleanName;
}

function numberValue(value: string): string {
  return value === "" ? "" : String(value);
}

export default function MenuItemForm({
  form,
  setForm,
  categories,
  locations,
  selectedCategory,
  posReady,
  saving,
  canSave,
  onSave,
  onReset,
}: Props) {
  const patch = <K extends keyof MenuItemFormState>(
    key: K,
    value: MenuItemFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-card">
      <div className="p-card__head">
        <div>
          <p className="p-card__title">Sales Item, POS & Consumption Controls</p>
          <p className="p-card__subtitle">
            Menu Items are sales items. Production outputs are Semi-Finished or Finished Goods in Inventory Master and are selected in Recipe Editor OUTPUT.
          </p>
        </div>

        <span className={`p-badge ${posReady ? "p-badge--active" : "p-badge--inactive"}`}>
          {posReady ? "POS Ready" : "Blocked"}
        </span>
      </div>

      <div className="p-card__body">
        <div className="p-grid-2">
          <label className="p-field">
            <span className="p-field__label">Menu Item Name *</span>
            <input
              className="p-input"
              value={form.name}
              onChange={(event) => patch("name", event.target.value)}
              placeholder="e.g. Chicken Burger"
              disabled={saving}
              autoComplete="off"
            />
          </label>

          <label className="p-field">
            <span className="p-field__label">Code / SKU</span>
            <input
              className="p-input"
              value={form.code}
              onChange={(event) => patch("code", event.target.value)}
              placeholder="e.g. BURGER-CHICKEN"
              disabled={saving}
              autoComplete="off"
            />
          </label>

          <label className="p-field">
            <span className="p-field__label">External POS Code</span>
            <input
              className="p-input"
              value={form.externalCode}
              onChange={(event) => patch("externalCode", event.target.value)}
              placeholder="Optional POS mapping code"
              disabled={saving}
              autoComplete="off"
            />
          </label>

          <label className="p-field">
            <span className="p-field__label">Selling Price *</span>
            <input
              className="p-input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={numberValue(form.sellingPrice)}
              onChange={(event) => patch("sellingPrice", event.target.value)}
              disabled={saving}
            />
          </label>

          <label className="p-field">
            <span className="p-field__label">Category *</span>
            <select
              className="p-select"
              value={form.categoryId}
              onChange={(event) => patch("categoryId", event.target.value)}
              disabled={saving}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {labelWithCode(category.name, category.code)}
                </option>
              ))}
            </select>
          </label>

          <label className="p-field">
            <span className="p-field__label">Item Type</span>
            <select
              className="p-select"
              value={form.itemType}
              onChange={(event) => patch("itemType", Number(event.target.value))}
              disabled={saving}
            >
              <option value={1}>Prepared Food - POS sales item</option>
              <option value={2}>Beverage - POS sales item</option>
              <option value={3}>Service / Non-stock sales item</option>
            </select>
            <span className="p-field__hint">
              If this is a prep-only production output, create it in Inventory Master as Semi-Finished and select it in Recipe Editor OUTPUT.
            </span>
          </label>

          <label className="p-field">
            <span className="p-field__label">Consumption Stock Location</span>
            <select
              className="p-select"
              value={form.consumptionLocationId}
              onChange={(event) => patch("consumptionLocationId", event.target.value)}
              disabled={saving}
            >
              <option value="">
                Use category default
                {selectedCategory?.defaultConsumptionLocationName
                  ? ` - ${selectedCategory.defaultConsumptionLocationName}`
                  : ""}
              </option>

              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {labelWithCode(location.name, location.code)}
                </option>
              ))}
            </select>

            <span className="p-field__hint">
              Leave blank to inherit the category default. Override only when this item consumes
              from a different stock location.
            </span>
          </label>
        </div>

        <div className="p-grid-2" style={{ marginTop: 16 }}>
          <label className="p-checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => patch("isActive", event.target.checked)}
              disabled={saving}
            />
            <span>Active</span>
          </label>

          <label className="p-checkbox">
            <input
              type="checkbox"
              checked={form.isAvailableForSale}
              onChange={(event) => patch("isAvailableForSale", event.target.checked)}
              disabled={saving}
            />
            <span>Available for POS sale</span>
          </label>
        </div>
      </div>

      <div className="p-card__footer">
        <button
          className="p-btn p-btn--outline"
          onClick={onReset}
          disabled={saving}
          type="button"
        >
          Reset
        </button>

        <button
          className="p-btn p-btn--accent p-btn--lg"
          onClick={onSave}
          disabled={!canSave}
          type="button"
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
