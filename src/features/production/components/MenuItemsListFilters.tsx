import type { MenuCategoryDto } from "../types";
import type { MenuItemAvailabilityFilter, MenuItemSortKey, MenuItemsListFilters as Filters } from "../hooks/useMenuItemsList";
import { useI18n } from "../../../i18n";

type Props = {
  filters: Filters;
  categories: MenuCategoryDto[];
  disabled?: boolean;
  onChange: (next: Filters) => void;
  onRefresh: () => void;
};

export default function MenuItemsListFilters({
  filters,
  categories,
  disabled,
  onChange,
  onRefresh,
}: Props) {
  const { tx } = useI18n();

  function patch<T extends keyof Filters>(key: T, value: Filters[T]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="p-card mi-list-filters">
      <div className="p-card__body">
        <div className="mi-filter-grid">
          <div className="p-field">
            <label className="p-field__label">{tx("Search")}</label>
            <input
              className="p-input"
              value={filters.search}
              onChange={(e) => patch("search", e.target.value)}
              placeholder={tx("Search name, SKU, POS code...")}
              disabled={disabled}
            />
          </div>

          <div className="p-field">
            <label className="p-field__label">{tx("Category")}</label>
            <select
              className="p-select"
              value={filters.categoryId}
              onChange={(e) => patch("categoryId", e.target.value)}
              disabled={disabled}
            >
              <option value="">{tx("All categories")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.code ? `${category.name} (${category.code})` : category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="p-field">
            <label className="p-field__label">{tx("Status")}</label>
            <select
              className="p-select"
              value={filters.availability}
              onChange={(e) => patch("availability", e.target.value as MenuItemAvailabilityFilter)}
              disabled={disabled}
            >
              <option value="all">{tx("All items")}</option>
              <option value="ready">{tx("POS ready")}</option>
              <option value="blocked">{tx("Blocked")}</option>
              <option value="active">{tx("Active")}</option>
              <option value="inactive">{tx("Inactive")}</option>
            </select>
          </div>

          <div className="p-field">
            <label className="p-field__label">{tx("Sort by")}</label>
            <select
              className="p-select"
              value={filters.sortBy}
              onChange={(e) => patch("sortBy", e.target.value as MenuItemSortKey)}
              disabled={disabled}
            >
              <option value="name">{tx("Name")}</option>
              <option value="price">{tx("Selling price")}</option>
              <option value="cost">{tx("Recipe cost")}</option>
              <option value="margin">{tx("Gross margin")}</option>
              <option value="unitsSold">{tx("Units sold")}</option>
            </select>
          </div>

          <div className="mi-filter-actions">
            <button className="p-btn p-btn--outline" onClick={onRefresh} disabled={disabled}>
              {tx("Refresh")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
