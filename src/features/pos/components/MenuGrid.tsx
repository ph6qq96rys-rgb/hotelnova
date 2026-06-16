import type { MenuItemDto } from "../types/posTypes";
import { Button, Card, Spinner } from "./posUi";

function badge(
  text: string,
  tone: "ok" | "warn" | "muted"
) {
  const style =
    tone === "ok"
      ? {
          color: "#4ADE80",
          borderColor: "rgba(74,222,128,.35)",
        }
      : tone === "warn"
      ? {
          color: "#FBBF24",
          borderColor: "rgba(251,191,36,.35)",
        }
      : {
          color: "#A1A1AA",
          borderColor: "rgba(161,161,170,.25)",
        };

  return (
    <span
      style={{
        fontSize: 10,
        padding: "3px 6px",
        border: "1px solid",
        borderRadius: 999,
        ...style,
      }}
    >
      {text}
    </span>
  );
}

function canSell(item: MenuItemDto): boolean {
  return (
    item.isActive &&
    item.isAvailableForSale &&
    item.hasConsumptionLocation &&
    item.hasRecipe
  );
}

function blockReason(item: MenuItemDto): string | null {
  if (!item.isActive) return "Inactive";
  if (!item.isAvailableForSale) return "Unavailable";
  if (!item.hasRecipe) return "No Recipe";
  if (!item.hasConsumptionLocation) return "No Location";
  return null;
}

interface MenuGridProps {
  menuItems: MenuItemDto[];
  categories: string[];
  category: string;
  setCategory: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  loading: boolean;
  addItem: (item: MenuItemDto) => void;
}

export function MenuGrid({
  menuItems,
  categories,
  category,
  setCategory,
  search,
  setSearch,
  loading,
  addItem,
}: MenuGridProps) {
  const filtered = menuItems.filter(
    (x) =>
      category === "All" ||
      (x.categoryName?.trim() || "Other") === category
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        flex: 1,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <input
          className="erp-pos-input"
          placeholder="Search menu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 350 }}
        />

        <div style={{ flex: 1 }} />

        {loading && (
          <span
            style={{
              color: "#71717A",
              fontSize: 13,
              display: "flex",
              gap: 8,
            }}
          >
            <Spinner />
            Loading...
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          marginBottom: 14,
        }}
      >
        {categories.map((c) => (
          <Button
            key={c}
            variant={category === c ? "gold" : "ghost"}
            onClick={() => setCategory(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill,minmax(220px,1fr))",
          gap: 12,
          overflowY: "auto",
        }}
      >
        {filtered.map((item) => {
          const allowed = canSell(item);
          const blocked = blockReason(item);

          return (
            <Card
              key={item.id}
              style={{
                opacity: allowed ? 1 : 0.65,
              }}
            >
              <div style={{ minHeight: 120 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  {item.name}
                </div>

                <div
                  style={{
                    color: "#71717A",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {item.categoryName}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    flexWrap: "wrap",
                    marginTop: 10,
                  }}
                >
                  {item.hasRecipe
                    ? badge("Recipe", "ok")
                    : badge("No Recipe", "warn")}

                  {item.hasConsumptionLocation
                    ? badge("Inventory", "ok")
                    : badge("No Location", "warn")}

                  {item.unitsSold > 0 &&
                    badge(`${item.unitsSold} Sold`, "muted")}

                  {item.cost > 0 &&
                    badge(
                      `Cost ${item.cost.toFixed(2)}`,
                      "muted"
                    )}

                  {blocked &&
                    badge(blocked, "warn")}
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <strong
                  style={{
                    color: "#D4A853",
                    fontSize: 16,
                  }}
                >
                  ${item.sellingPrice.toFixed(2)}
                </strong>

                <Button
                  variant={
                    allowed ? "gold" : "ghost"
                  }
                  disabled={!allowed}
                  onClick={() => addItem(item)}
                >
                  {allowed ? "Add" : "Blocked"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <div
          style={{
            color: "#71717A",
            textAlign: "center",
            padding: 48,
          }}
        >
          No menu items found.
        </div>
      )}
    </div>
  );
}