import StaffMenuRecipePreview from "./StaffMenuRecipePreview";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../../i18n";
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
  onOpenCustomerDetails: (id: string) => void;
  onOpenRecipe: (id: string) => void;
};

export default function MenuItemsTable({ items, loading, onOpen, onOpenRecipe, onOpenCustomerDetails }: Props) {
  const { tx } = useI18n();
  if (loading) {
    return (
      <div className="p-card">
        <div className="p-card__body" style={{ color: "var(--p-text-muted)" }}>
          {tx("Loading menu items...")}
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
            <strong>{tx("No menu items found.")}</strong>
            <p>{tx("Adjust your filters or create/import menu items for this branch.")}</p>
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
              <th>{tx("Menu Item")}</th>
              <th>{tx("Category")}</th>
              <th>{tx("Codes")}</th>
              <th className="mi-number">{tx("Price")}</th>
              <th className="mi-number">{tx("Cost")}</th>
              <th className="mi-number">{tx("Margin")}</th>
              <th>{tx("Status")}</th>
              <th className="mi-actions-col">{tx("Actions")}</th>
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
                    <StaffMenuRecipePreview id={item.id} name={item.name || tx("Unnamed item")} />
                    <div className="mi-muted">{tx("Units sold")}: {(item as any).unitsSold ?? 0}</div>
                  </td>
                  <td>
                    <div>{categoryName}</div>
                    {subCategoryName && <div className="mi-muted">{subCategoryName}</div>}
                  </td>
                  <td>
                    <div>{item.code || "-"}</div>
                    {item.externalCode && <div className="mi-muted">{tx("POS")}: {item.externalCode}</div>}
                  </td>
                  <td className="mi-number">{money(item.sellingPrice)}</td>
                  <td className="mi-number">{money(item.cost)}</td>
                  <td className="mi-number">{money(margin)}</td>
                  <td>
                    <span className={`p-badge ${ready ? "p-badge--active" : "p-badge--inactive"}`}>
                      {ready ? tx("POS Ready") : tx("Blocked")}
                    </span>
                    <div className="mi-readiness-flags">
                      {item.hasRecipe !== true && <span>{tx("Recipe missing")}</span>}
                      {item.hasConsumptionLocation !== true && <span>{tx("Location missing")}</span>}
                      {item.isActive !== true && <span>{tx("Inactive")}</span>}
                      {item.isAvailableForSale !== true && <span>{tx("Not for sale")}</span>}
                    </div>
                  </td>
                  <td className="mi-actions-col">
                    <div className="mi-row-actions">
                      <Button variant="outline" onClick={() => onOpenCustomerDetails(item.id)}>Customer details</Button>
                      <button className="p-btn p-btn--outline" onClick={() => onOpen(item.id)}>
                        {tx("Configure")}
                      </button>
                      <button className="p-btn p-btn--accent" onClick={() => onOpenRecipe(item.id)}>
                        {tx("Recipe")}
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
