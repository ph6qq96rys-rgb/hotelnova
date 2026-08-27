import { useEffect, useMemo, useState } from "react";
import { useAppScope } from "../app/useAppScope";
import {
  posApi,
  type PosScope,
} from "../features/pos/api/posApi";
import type { MenuItemDto } from "../features/pos/types/posTypes";

type MenuCategory = "All" | string;

type RestaurantMenuPageProps = {
  restaurantName?: string;
  menuQrSrc?: string;
  currency?: string;
  onAddItem?: (item: MenuItemDto) => void;
};

type ApiMenuItem = MenuItemDto & {
  imageUrl?: string | null;
  photoUrl?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  isVegetarian?: boolean | null;
  isSpicy?: boolean | null;
  isChefSpecial?: boolean | null;
  recipeName?: string | null;
};

const SEARCH_DEBOUNCE_MS = 250;

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(value);
}

function extractError(error: unknown, fallback: string): string {
  const candidate = error as {
    response?: {
      data?: {
        message?: unknown;
        detail?: unknown;
        title?: unknown;
        error?: unknown;
      };
    };
    message?: unknown;
  };

  const data = candidate?.response?.data;

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data?.detail === "string" && data.detail.trim()) {
    return data.detail;
  }

  if (typeof data?.title === "string" && data.title.trim()) {
    return data.title;
  }

  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error;
  }

  if (typeof candidate?.message === "string" && candidate.message.trim()) {
    return candidate.message;
  }

  return fallback;
}

function categoryOf(item: MenuItemDto): string {
  return item.categoryName?.trim() || "Uncategorized";
}

function imageOf(item: ApiMenuItem): string | null {
  return (
    item.imageUrl?.trim() ||
    item.photoUrl?.trim() ||
    item.thumbnailUrl?.trim() ||
    null
  );
}

function descriptionOf(item: ApiMenuItem): string {
  return (
    item.description?.trim() ||
    item.shortDescription?.trim() ||
    item.categoryName?.trim() ||
    "Prepared fresh by our kitchen."
  );
}

function recipeOf(item: ApiMenuItem): string {
  if (item.hasRecipe === false) {
    return "Recipe not configured";
  }

  return item.recipeName?.trim() || "Recipe configured";
}

function itemIsBlocked(item: MenuItemDto): boolean {
  const typed = item as MenuItemDto & {
    isActive?: boolean;
    isAvailableForSale?: boolean;
    hasRecipe?: boolean;
    hasConsumptionLocation?: boolean;
  };

  return (
    typed.isActive === false ||
    typed.isAvailableForSale === false ||
    typed.hasRecipe === false ||
    typed.hasConsumptionLocation === false
  );
}

function itemBlockReason(item: MenuItemDto): string {
  const typed = item as MenuItemDto & {
    isActive?: boolean;
    isAvailableForSale?: boolean;
    hasRecipe?: boolean;
    hasConsumptionLocation?: boolean;
  };

  if (typed.isActive === false) {
    return `${item.name} is inactive.`;
  }

  if (typed.isAvailableForSale === false) {
    return `${item.name} is not currently available for sale.`;
  }

  if (typed.hasRecipe === false) {
    return `${item.name} does not have a production recipe.`;
  }

  if (typed.hasConsumptionLocation === false) {
    return `${item.name} does not have an inventory consumption location.`;
  }

  return "";
}

export default function RestaurantMenuPage({
  restaurantName = "HOTELNOVA",
  menuQrSrc = "/assets/menu-qr.png",
  currency = "USD",
  onAddItem,
}: RestaurantMenuPageProps) {
  const { companyId, branchId } = useAppScope();

  const scope = useMemo<PosScope>(
    () => ({
      companyId: String(companyId ?? "").trim(),
      branchId: String(branchId ?? "").trim(),
    }),
    [companyId, branchId],
  );

  const [items, setItems] = useState<MenuItemDto[]>([]);
  const [activeCategory, setActiveCategory] =
    useState<MenuCategory>("All");
  const [search, setSearch] = useState("");
  const [apiSearch, setApiSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setApiSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      if (!companyId || !branchId) {
        setItems([]);
        setLoading(false);
        setMessage(
          "Company and branch context are required before loading the menu.",
        );
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const rows = await posApi.menuItems(
          scope,
          apiSearch,
          true,
        );

        if (cancelled) return;

        setItems(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (cancelled) return;

        setItems([]);
        setMessage(
          extractError(error, "Unable to load the restaurant menu."),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMenu();

    return () => {
      cancelled = true;
    };
  }, [apiSearch, scope]);

  const categories = useMemo(() => {
    const names = Array.from(
      new Set(items.map(categoryOf)),
    ).sort((a, b) => a.localeCompare(b));

    return ["All", ...names];
  }, [items]);

  useEffect(() => {
    if (
      activeCategory !== "All" &&
      !categories.includes(activeCategory)
    ) {
      setActiveCategory("All");
    }
  }, [activeCategory, categories]);

  const visibleItems = useMemo(() => {
    if (activeCategory === "All") return items;

    return items.filter(
      (item) => categoryOf(item) === activeCategory,
    );
  }, [activeCategory, items]);

  function addItem(item: MenuItemDto) {
    if (itemIsBlocked(item)) {
      setMessage(itemBlockReason(item));
      return;
    }

    const price = Number(item.sellingPrice ?? 0);

    if (!Number.isFinite(price) || price <= 0) {
      setMessage(
        `${item.name} does not have a valid selling price.`,
      );
      return;
    }

    setCartCount((count) => count + 1);
    setMessage(null);
    onAddItem?.(item);
  }

  return (
    <div className="menu-page">
      <style>{css}</style>

      <header className="menu-hero">
        <div className="menu-brand">
          <div className="menu-logo"></div>

          <div>
            <h1>{restaurantName}</h1>

            <div className="menu-brand-line">
              <span />
              <strong>RESTAURANT</strong>
              <span />
            </div>

            <p>Good Food. Great Experience.</p>
          </div>
        </div>

        <div className="menu-qr-panel">
          <div>
            <small>SCAN TO VIEW</small>
            <strong>OUR MENU</strong>
          </div>

          <img src={menuQrSrc} alt="Restaurant menu QR code" />
        </div>
      </header>

      <section className="menu-trust">
        <article>
          <span></span>
          <div>
            <strong>FRESH INGREDIENTS</strong>
            <small>Carefully selected</small>
          </div>
        </article>

        <article>
          <span></span>
          <div>
            <strong>EXPERT CHEFS</strong>
            <small>Crafted to perfection</small>
          </div>
        </article>

        <article>
          <span></span>
          <div>
            <strong>QUALITY & HYGIENE</strong>
            <small>Always our priority</small>
          </div>
        </article>

        <article>
          <span></span>
          <div>
            <strong>MADE WITH LOVE</strong>
            <small>Just for you</small>
          </div>
        </article>
      </section>

      <main className="menu-content">
        <div className="menu-toolbar">
          <nav className="menu-categories" aria-label="Menu categories">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={
                  activeCategory === category ? "active" : ""
                }
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </nav>

          <div className="menu-search-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search menu..."
              aria-label="Search menu"
            />

            <button type="button" className="menu-cart-button">
              Cart <span>{cartCount}</span>
            </button>
          </div>
        </div>

        {message && (
          <div className="menu-message">{message}</div>
        )}

        {loading ? (
          <div className="menu-empty">Loading menu...</div>
        ) : visibleItems.length === 0 ? (
          <div className="menu-empty">
            No menu items match your selection.
          </div>
        ) : (
          <section className="menu-grid">
            {visibleItems.map((menuItem) => {
              const item = menuItem as ApiMenuItem;
              const image = imageOf(item);
              const blocked = itemIsBlocked(item);

              return (
                <article
                  className={[
                    "menu-item-row",
                    image ? "has-image" : "",
                    blocked ? "menu-item-row-blocked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={item.id}
                >
                  {image && (
                    <div className="menu-card-image">
                      <img src={image} alt={item.name} />

                      <div className="menu-badges">
                      {item.isVegetarian && (
                        <span className="veg">Vegetarian</span>
                      )}

                      {item.isSpicy && (
                        <span className="spicy">Spicy</span>
                      )}

                      {item.isChefSpecial && (
                        <span className="special">
                          Chef&apos;s Special
                        </span>
                      )}

                      {blocked && (
                        <span className="blocked">
                          Unavailable
                        </span>
                      )}
                      </div>
                    </div>
                  )}

                  <div className="menu-card-body">
                    <div className="menu-card-title-row">
                      <h2>{item.name}</h2>
                      <span className="menu-card-dots" />
                      <strong>
                        {formatMoney(
                          Number(item.sellingPrice ?? 0),
                          currency,
                        )}
                      </strong>
                    </div>

                    <p className="menu-card-description">
                      {descriptionOf(item)}
                    </p>

                    <div className="menu-card-recipe-row">
                      <span>{recipeOf(item)}</span>
                      {item.code && <small>{item.code}</small>}
                    </div>

                    <button
                      className="menu-card-add"
                      type="button"
                      disabled={blocked}
                      title={
                        blocked
                          ? itemBlockReason(item)
                          : `Add ${item.name}`
                      }
                      onClick={() => addItem(item)}
                      aria-label={`Add ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section className="menu-legend">
          <span> Vegetarian</span>
          <span> Spicy</span>
          <span> Chef&apos;s Special</span>
          <span className="allergy">
            Food allergy? Please inform our staff before ordering.
          </span>
        </section>
      </main>

      <footer className="menu-footer">
        <div>
          <strong>OPENING HOURS</strong>
          <span>Mon - Sun - 11:00 AM - 11:00 PM</span>
        </div>

        <div>
          <strong>WE DELIVER</strong>
          <span>Fast. Safe. On time.</span>
        </div>

        <div>
          <strong>CONTACT US</strong>
          <span>+1 234 567 8900 - info@hotelnova.com</span>
        </div>

        <div>
          <strong>THANK YOU!</strong>
          <span>We look forward to serving you.</span>
        </div>
      </footer>
    </div>
  );
}

const css = `
:root {
  --menu-green: #073d2f;
  --menu-green-dark: #03291f;
  --menu-gold: #d6aa43;
  --menu-cream: #f6f1e8;
  --menu-paper: #fffdf8;
  --menu-text: #102f27;
  --menu-muted: #6c726f;
}

* { box-sizing: border-box; }

.menu-page {
  min-height: 100vh;
  background: var(--menu-paper);
  color: var(--menu-text);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

.menu-hero {
  min-height: 190px;
  padding: 34px clamp(24px, 5vw, 72px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 28px;
  background:
    radial-gradient(circle at top right, rgba(214,170,67,.18), transparent 30%),
    linear-gradient(145deg, var(--menu-green), var(--menu-green-dark));
  color: white;
}

.menu-brand {
  display: flex;
  align-items: center;
  gap: 22px;
}

.menu-logo {
  width: 96px;
  height: 96px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border: 3px solid var(--menu-gold);
  border-radius: 50%;
  font-size: 42px;
}

.menu-brand h1 {
  margin: 0;
  font: 700 clamp(42px, 6vw, 72px)/1 Georgia, serif;
  letter-spacing: .08em;
}

.menu-brand-line {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--menu-gold);
  letter-spacing: .28em;
}

.menu-brand-line span {
  width: 78px;
  height: 1px;
  background: currentColor;
}

.menu-brand p {
  margin: 10px 0 0;
  font: italic 19px Georgia, serif;
  color: rgba(255,255,255,.8);
}

.menu-qr-panel {
  padding: 12px 14px 12px 22px;
  display: flex;
  align-items: center;
  gap: 18px;
  border: 2px solid var(--menu-gold);
  border-radius: 28px;
}

.menu-qr-panel div {
  display: flex;
  flex-direction: column;
}

.menu-qr-panel small {
  font-weight: 700;
  letter-spacing: .08em;
}

.menu-qr-panel strong {
  color: var(--menu-gold);
  font-size: 22px;
}

.menu-qr-panel img {
  width: 92px;
  height: 92px;
  padding: 7px;
  border-radius: 12px;
  object-fit: contain;
  background: white;
}

.menu-trust {
  padding: 24px clamp(24px, 5vw, 72px);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid #eadfc9;
  background: var(--menu-cream);
}

.menu-trust article {
  min-height: 58px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-right: 1px solid #d9c9a7;
}

.menu-trust article:last-child { border-right: 0; }

.menu-trust article > span { font-size: 30px; }

.menu-trust article div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.menu-trust strong { font-size: 12px; }
.menu-trust small { color: var(--menu-muted); }

.menu-content {
  width: min(1480px, 100%);
  margin: 0 auto;
  padding: 26px clamp(20px, 4vw, 56px) 34px;
}

.menu-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 14px 0 18px;
  background: rgba(255,253,248,.96);
  backdrop-filter: blur(10px);
}

.menu-categories {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.menu-categories button {
  min-width: max-content;
  padding: 12px 24px;
  border: 1px solid #dccca9;
  border-radius: 999px;
  background: white;
  color: var(--menu-text);
  font-weight: 800;
  cursor: pointer;
}

.menu-categories button.active {
  border-color: var(--menu-green);
  background: var(--menu-green);
  color: white;
}

.menu-search-row {
  margin-top: 14px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.menu-search-row input {
  width: min(420px, 100%);
  padding: 12px 15px;
  border: 1px solid #dccca9;
  border-radius: 12px;
  background: white;
  color: var(--menu-text);
  font: inherit;
}

.menu-cart-button {
  padding: 10px 16px;
  border: 0;
  border-radius: 12px;
  background: var(--menu-gold);
  color: var(--menu-green-dark);
  font-weight: 900;
  cursor: pointer;
}

.menu-cart-button span {
  min-width: 24px;
  margin-left: 8px;
  padding: 3px 7px;
  display: inline-block;
  border-radius: 999px;
  background: white;
}

.menu-message {
  margin-bottom: 18px;
  padding: 13px 15px;
  border: 1px solid #d4a94c;
  border-radius: 12px;
  background: #fff7df;
  color: #6f4b00;
}

.menu-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.menu-item-row {
  min-height: 112px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  border-bottom: 1px solid #e6dbc5;
  background: transparent;
}

.menu-item-row.has-image {
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 16px;
}

.menu-item-row-blocked {
  opacity: .58;
}

.menu-card-image {
  width: 112px;
  height: 92px;
  margin: 10px 0;
  position: relative;
  overflow: hidden;
  border-radius: 10px;
}

.menu-card-image img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.menu-badges {
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.menu-badges span {
  padding: 4px 7px;
  border-radius: 999px;
  color: white;
  font-size: 9px;
  font-weight: 900;
  backdrop-filter: blur(8px);
}

.menu-badges .veg { background: rgba(46,125,50,.9); }
.menu-badges .spicy { background: rgba(198,40,40,.9); }
.menu-badges .special { background: rgba(183,132,22,.94); }
.menu-badges .blocked { background: rgba(82,82,82,.92); }

.menu-card-body {
  min-width: 0;
  position: relative;
  padding: 16px 46px 16px 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.menu-item-row.has-image .menu-card-body {
  padding-left: 0;
}

.menu-card-title-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.menu-card-title-row h2 {
  margin: 0;
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--menu-text);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: none;
}

.menu-card-dots {
  min-width: 18px;
  flex: 1;
  border-bottom: 1px dotted #b9aa88;
}

.menu-card-title-row strong {
  color: var(--menu-green);
  font-size: 16px;
  font-weight: 900;
  white-space: nowrap;
}

.menu-card-description {
  margin: 6px 0 10px;
  overflow: hidden;
  display: -webkit-box;
  color: var(--menu-muted);
  font-size: 10px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.menu-card-recipe-row {
  padding-top: 8px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid #eee4d1;
}

.menu-card-recipe-row span,
.menu-card-recipe-row small {
  overflow: hidden;
  color: #8a7a5a;
  font-size: 9px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-card-add {
  width: 30px;
  height: 30px;
  position: absolute;
  right: 0;
  bottom: 16px;
  border: 0;
  border-radius: 50%;
  background: var(--menu-gold);
  color: white;
  font-size: 20px;
  cursor: pointer;
}

.menu-card-add:disabled {
  cursor: not-allowed;
  background: #aaa;
}

.menu-empty {
  padding: 60px 20px;
  border: 1px dashed #dccca9;
  border-radius: 18px;
  text-align: center;
  color: var(--menu-muted);
}

.menu-legend {
  margin-top: 30px;
  padding: 18px 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  border: 1px solid #dccca9;
  border-radius: 16px;
  background: var(--menu-cream);
  font-size: 13px;
  font-weight: 800;
}

.menu-legend .allergy {
  margin-left: auto;
  color: #9a6814;
}

.menu-footer {
  padding: 28px clamp(24px, 5vw, 72px);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 22px;
  background: linear-gradient(145deg, var(--menu-green), var(--menu-green-dark));
  color: white;
}

.menu-footer > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.menu-footer strong { color: var(--menu-gold); }

.menu-footer span {
  color: rgba(255,255,255,.78);
  font-size: 13px;
  line-height: 1.45;
}


@media (max-width: 1100px) {
  .menu-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 980px) {
  .menu-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .menu-trust,
  .menu-footer {
    grid-template-columns: repeat(2, 1fr);
  }

  .menu-trust article:nth-child(2) {
    border-right: 0;
  }

  .menu-trust article {
    padding: 14px;
  }
}

@media (max-width: 640px) {
  .menu-item-row.has-image {
    grid-template-columns: 88px minmax(0, 1fr);
    gap: 12px;
  }

  .menu-card-image {
    width: 88px;
    height: 76px;
  }

  .menu-card-body {
    padding: 14px 42px 14px 0;
  }

  .menu-card-title-row h2,
  .menu-card-title-row strong {
    font-size: 14px;
  }

  .menu-hero {
    padding: 28px 20px;
  }

  .menu-brand {
    align-items: flex-start;
  }

  .menu-logo {
    width: 68px;
    height: 68px;
    font-size: 28px;
  }

  .menu-brand h1 {
    font-size: 36px;
  }

  .menu-brand-line span {
    width: 30px;
  }

  .menu-qr-panel {
    width: 100%;
    justify-content: space-between;
  }

  .menu-trust,
  .menu-footer {
    grid-template-columns: 1fr;
  }

  .menu-trust article {
    border-right: 0;
    border-bottom: 1px solid #d9c9a7;
  }

  .menu-trust article:last-child {
    border-bottom: 0;
  }

  .menu-search-row {
    flex-direction: column;
  }

  .menu-search-row input,
  .menu-cart-button {
    width: 100%;
  }

  .menu-legend .allergy {
    margin-left: 0;
  }
}
`;