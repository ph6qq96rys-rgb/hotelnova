import type { MenuItemDto } from "../types";

function money(value?: number | null): string {
  if (value == null) return "-";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isReady(item: MenuItemDto): boolean {
  return Boolean(
    item.isActive === true &&
      item.isAvailableForSale === true &&
      item.hasRecipe === true &&
      item.hasConsumptionLocation === true
  );
}

type Props = {
  items: MenuItemDto[];
  loading?: boolean;
  onOpen: (id: string) => void;
  onOpenRecipe: (id: string) => void;
};

export default function MenuItemsTable({ items, loading, onOpen, onOpenRecipe }: Props) {
  if (loading) {
    return (
      <div className="p-card">
        <div className="p-card__body" style={{ color: "var(--p-text-muted)" }}>
          Loading menu items...
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-card">
        <div className="p-card__body mi-empty-state">
          <div className="mi-empty-state__icon"></div>
          <div>
            <strong>No menu items found.</strong>
            <p>Adjust your filters or create/import menu items for this branch.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-card mi-list-table-card">
      <div className="mi-table-wrap">
        <table className="mi-table">
          <thead>
            <tr>
              <th>Menu Item</th>
              <th>Category</th>
              <th>Codes</th>
              <th className="mi-number">Price</th>
              <th className="mi-number">Cost</th>
              <th className="mi-number">Margin</th>
              <th>Status</th>
              <th className="mi-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const ready = isReady(item);
              const margin = (item.sellingPrice ?? 0) - (item.cost ?? 0);
              const categoryName = (item as any).categoryName ?? item.categoryName ?? "-";
              const subCategoryName = (item as any).subCategoryName ?? item.subCategoryName ?? null;

              return (
                <tr key={item.id}>
                  <td>
                    <button className="mi-link-button" onClick={() => onOpen(item.id)}>
                      {item.name || "Unnamed item"}
                    </button>
                    <div className="mi-muted">Units sold: {(item as any).unitsSold ?? 0}</div>
                  </td>
                  <td>
                    <div>{categoryName}</div>
                    {subCategoryName && <div className="mi-muted">{subCategoryName}</div>}
                  </td>
                  <td>
                    <div>{item.code || "-"}</div>
                    {item.externalCode && <div className="mi-muted">POS: {item.externalCode}</div>}
                  </td>
                  <td className="mi-number">{money(item.sellingPrice)}</td>
                  <td className="mi-number">{money(item.cost)}</td>
                  <td className="mi-number">{money(margin)}</td>
                  <td>
                    <span className={`p-badge ${ready ? "p-badge--active" : "p-badge--inactive"}`}>
                      {ready ? "POS Ready" : "Blocked"}
                    </span>
                    <div className="mi-readiness-flags">
                      {item.hasRecipe !== true && <span>Recipe missing</span>}
                      {item.hasConsumptionLocation !== true && <span>Location missing</span>}
                      {item.isActive !== true && <span>Inactive</span>}
                      {item.isAvailableForSale !== true && <span>Not for sale</span>}
                    </div>
                  </td>
                  <td className="mi-actions-col">
                    <div className="mi-row-actions">
                      <button className="p-btn p-btn--outline" onClick={() => onOpen(item.id)}>
                        Configure
                      </button>
                      <button className="p-btn p-btn--accent" onClick={() => onOpenRecipe(item.id)}>
                        Recipe
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
