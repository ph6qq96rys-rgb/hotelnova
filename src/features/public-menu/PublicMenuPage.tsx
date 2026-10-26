import { amharicMenuNames } from "./menuAmharic";
import { groupMenuItems, menuLabel, menuPlacement, normalizeMenuName } from "./menuPresentation";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import type { MenuPricing, PublicMenu, PublicMenuItem } from "./types";
import "./public-menu.css";

type Language = "en" | "am";

/** 15 → "15", 7.5 → "7.5". */
const rate = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);

const text = {
  en: {
    menu: "Menu", all: "All", unavailable: "Not available today",
    empty: "The menu is being prepared. Please ask a member of staff.",
    invalid: "This menu link is no longer active. Please ask the restaurant for its current QR code.",
    failed: "The menu could not be loaded. Check your connection and try again.",
    retry: "Try again", loading: "Loading the menu…", categories: "Menu sections",
    stale: "Could not refresh. Prices and availability may have changed.",
    priceNote: (currency: string, p?: MenuPricing | null) => {
      const parts = [p?.vatRate ? `${rate(p.vatRate)}% VAT` : "", p?.serviceChargeRate ? `${rate(p.serviceChargeRate)}% service charge` : ""].filter(Boolean);
      return parts.length ? `Prices in ${currency}, including ${parts.join(" and ")}.` : `Prices in ${currency}.`;
    },
    search: "Search dishes or ingredients", noMatch: (q: string) => `Nothing on the menu matches “${q}”.`, clear: "Clear search",
    contains: "Contains", language: "Language", other: "More", ingredients: "Ingredients", items: "items", footer: "Thank you for dining with us.",
  },
  am: {
    menu: "የምግብ ዝርዝር", all: "ሁሉም", unavailable: "ዛሬ አይገኝም",
    empty: "የምግብ ዝርዝሩ እየተዘጋጀ ነው። እባክዎ ሰራተኛን ይጠይቁ።",
    invalid: "ይህ የምግብ ዝርዝር አገናኝ አሁን አይሰራም። እባክዎ አዲሱን QR ኮድ ይጠይቁ።",
    failed: "የምግብ ዝርዝሩን መጫን አልተቻለም። ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ።",
    retry: "እንደገና ይሞክሩ", loading: "የምግብ ዝርዝሩ በመጫን ላይ…", categories: "የምግብ ምድቦች",
    stale: "ማደስ አልተቻለም። ዋጋ እና አቅርቦት ሊቀየሩ ይችላሉ።",
    priceNote: (currency: string, p?: MenuPricing | null) => {
      const unit = currency === "ETB" ? "ብር" : currency;
      const parts = [p?.vatRate ? `${rate(p.vatRate)}% ቫት` : "", p?.serviceChargeRate ? `${rate(p.serviceChargeRate)}% የአገልግሎት ክፍያ` : ""].filter(Boolean);
      return parts.length ? `ዋጋዎች በ${unit}፣ ${parts.join(" እና ")} ጨምሮ።` : `ዋጋዎች በ${unit}።`;
    },
    search: "ምግብ፣ መጠጥ ወይም የምግብ ይዘት ይፈልጉ", noMatch: (q: string) => `ከ“${q}” ጋር የሚመሳሰል ምግብ የለም።`, clear: "ፍለጋ አጽዳ",
    contains: "አለርጂ ሊያስከትሉ የሚችሉ ይዘቶች", language: "ቋንቋ", other: "ሌሎች", ingredients: "የምግቡ ይዘት", items: "አይነቶች", footer: "ስለጎበኙን እናመሰግናለን።",
  },
};

export function MenuPhoto({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed || !src.startsWith("https://")) return null;
  return <img src={src} alt={alt} className={className} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

/** POS names are often typed in capitals; menus read better in title case. */
function displayName(value: string): string {
  const clean = value.trim().replace(/\s+/g, " ");
  if (/[a-z]/.test(clean)) return clean; // already deliberately cased
  return clean.toLowerCase().replace(/(^|[\s(/&-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase()).replace(/\bBbq\b/g, "BBQ");
}

/** Ingredient names for the small print, in the guest's language. Capitalised words are lower-cased so the line
 * reads as a sentence; short acronyms (BBQ) keep their capitals. */
function ingredientLine(item: PublicMenuItem, language: Language): string {
  const details = item.recipeDetails;
  if (!details) return "";
  const names = details.ingredients ?? [];
  return names.map((raw, index) => {
    const name = raw.trim();
    if (/^(straw|tea cup)$/i.test(name)) return "";
    if (name.toLowerCase() === "match" && /matcha/i.test(item.name)) return language === "am" ? "የማቻ ሻይ" : "matcha tea";
    if (language === "am") return details.localIngredients?.[index]?.trim() || name;
    return name.replace(/\s*-\s*unpacked$/i, "").replace(/\b\d+\s*(gram|grams|g|kg|ml|ltr)\b/gi, "").trim().toLowerCase();
  }).filter(Boolean).join(language === "am" ? "፣ " : ", ");
}

export default function PublicMenuPage() {
  const { companyId, branchId, token } = useParams();
  const [language, setLanguage] = useState<Language>(() => (navigator.language?.toLowerCase().startsWith("am") ? "am" : "en"));
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [error, setError] = useState<"invalid" | "failed" | null>(null);
  const [stale, setStale] = useState(false);
  const [category, setCategory] = useState("");
  const [subgroup, setSubgroup] = useState("");
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const t = text[language];

  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    setMenu(null); setError(null); setStale(false); setCategory("");
    const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (![companyId, branchId, token].every(x => x && guid.test(x))) { setError("invalid"); return; }
    async function load() {
      if (loading || controller.signal.aborted) return;
      loading = true;
      try {
        const response = await fetch(`/api/public/menu/${companyId}/${branchId}/${token}`, { signal: controller.signal, credentials: "omit", cache: "no-store" });
        if ([400, 403, 404, 410].includes(response.status)) { setMenu(null); setError("invalid"); return; }
        if (!response.ok) throw new Error("Menu request failed");
        const data: PublicMenu = await response.json();
        if (!Array.isArray(data.items)) throw new Error("Invalid menu");
        if (!controller.signal.aborted) { setMenu(data); setError(null); setStale(false); }
      } catch {
        if (!controller.signal.aborted) { setError("failed"); setStale(true); }
      } finally { loading = false; }
    }
    void load();
    // Prices and availability follow the POS; refresh while the guest is looking at the menu.
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, [companyId, branchId, token, retry]);

  useEffect(() => {
    if (menu) document.title = `${menu.restaurantName} · ${t.menu}`;
  }, [menu, t.menu]);

  const local = (name: string, translated?: string | null) => (language === "am" && translated?.trim() ? translated : name);
  const itemName = (item: PublicMenuItem) => language === "am" ? item.localName?.trim() || amharicMenuNames[normalizeMenuName(item.name)] || displayName(item.name) : displayName(item.name);
  const description = (item: PublicMenuItem) => local(item.description ?? item.recipeDetails?.description ?? "", item.localDescription);

  // Add-on rows ("Extra" sub-groups) are ordered at the till, not chosen from the menu.
  const items = useMemo(() => menu?.items.filter(item => item.subCategoryName?.trim().toUpperCase() !== "EXTRA") ?? [], [menu]);

  const needle = query.trim().toLocaleLowerCase();
  const matches = useMemo(() => {
    if (!needle) return items;
    return items.filter(item =>
      [item.name, item.localName, amharicMenuNames[normalizeMenuName(item.name)], item.description, item.localDescription, item.categoryName, item.subCategoryName, menuLabel(menuPlacement(item).category, language), menuLabel(menuPlacement(item).group, language),
        ...(item.recipeDetails?.ingredients ?? []), ...(item.recipeDetails?.localIngredients ?? [])]
        .some(value => value?.toLocaleLowerCase().includes(needle)));
  }, [items, needle, language]);

  const categories = useMemo(() => groupMenuItems(items), [items]);
  const selected = !needle && categories.some(c => c.key === category) ? category : "";
  const groups = selected ? categories.find(c => c.key === selected)?.groups ?? [] : [];
  const selectedGroup = groups.some(g => g.key === subgroup) ? subgroup : "";
  const sections = useMemo(() => groupMenuItems(matches.filter(item => {
    const placement = menuPlacement(item);
    return (!selected || placement.category === selected) && (!selectedGroup || placement.group === selectedGroup);
  })), [matches, selected, selectedGroup]);

  const money = (value: number) =>
    new Intl.NumberFormat(language === "am" ? "am-ET" : "en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  return (
    <main className="qm" lang={language}>
      <div className="qm-language" role="group" aria-label={t.language}>
        <Button variant="ghost" size="sm" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</Button>
        <Button variant="ghost" size="sm" aria-pressed={language === "am"} onClick={() => setLanguage("am")}>አማርኛ</Button>
      </div>

      {!menu ? (
        <div className="qm-state" role={error ? "alert" : "status"}>
          <h1>{t.menu}</h1>
          <p>{error ? t[error] : t.loading}</p>
          {error && <Button variant="outline" onClick={() => setRetry(x => x + 1)}>{t.retry}</Button>}
        </div>
      ) : (
        <>
          <header className="qm-header">
            <MenuPhoto src={menu.logoUrl} alt="" className="qm-logo" />
            <h1 className="qm-restaurant">{menu.restaurantName}</h1>
            <p className="qm-branch">{menu.branchName}</p>
            <p className="qm-price-note">{t.priceNote(menu.currency || "ETB", menu.pricing)}</p>
          </header>

          <div className="qm-toolbar">
            <div className="qm-search">
              <Input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} enterKeyHint="search" />
            </div>
            {!needle && categories.length > 1 && (
              <nav className="qm-nav" aria-label={t.categories}>
                <Button variant="ghost" size="sm" aria-pressed={!selected} onClick={() => { setCategory(""); setSubgroup(""); }}>{t.all}</Button>
                {categories.map(c => (
                  <Button key={c.key} variant="ghost" size="sm" aria-pressed={selected === c.key} onClick={() => { setCategory(c.key); setSubgroup(""); window.scrollTo({ top: 0 }); }}>
                    {menuLabel(c.key, language, c.localName)}
                  </Button>
                ))}
              </nav>
            )}
          </div>

          {groups.length > 1 && <nav className="qm-subnav" aria-label={language === "am" ? "ንዑስ ምድቦች" : "Menu groups"}>
            <Button size="sm" variant="ghost" aria-pressed={!selectedGroup} onClick={() => setSubgroup("")}>{t.all}</Button>
            {groups.map(g => <Button key={g.key} size="sm" variant="ghost" aria-pressed={selectedGroup === g.key} onClick={() => setSubgroup(g.key)}>{menuLabel(g.key, language)} <span>{g.items.length}</span></Button>)}
          </nav>}
          {stale && <p className="qm-notice" role="status">{t.stale}</p>}
          {!items.length && <p className="qm-state">{t.empty}</p>}
          {needle && !matches.length && (
            <div className="qm-state" role="status">
              <p>{t.noMatch(query.trim())}</p>
              <Button variant="outline" onClick={() => setQuery("")}>{t.clear}</Button>
            </div>
          )}

          <div className="qm-sections">
            {sections.map(section => (
              <section key={section.key} className="qm-section" aria-labelledby={`qm-section-${section.key}`}>
                <h2 id={`qm-section-${section.key}`}>{menuLabel(section.key, language, section.localName)}</h2>
                <div className={"qm-groups" + (section.groups.length > 1 ? " qm-groups--columns" : "")}>
                  {section.groups.map(group => (
                    <div key={group.key || "main"} className="qm-group">
                      <div className="qm-group-heading"><h3 className="qm-group-title">{menuLabel(group.key, language)}</h3><span>{group.items.length} {t.items}</span></div>
                      <ul className="qm-items">
                        {group.items.map(item => {
                          const ingredients = ingredientLine(item, language);
                          const blurb = description(item);
                          const allergens = item.recipeDetails?.allergenInformation?.trim();
                          const dietary = item.recipeDetails?.dietaryInformation?.trim();
                          return (
                            <li key={item.id} className={"qm-item" + (item.isAvailable ? "" : " qm-item--unavailable")}>
                              <MenuPhoto src={item.imageUrl} alt="" className="qm-photo" />
                              <div className="qm-item-body">
                                <div className="qm-item-line">
                                  <h4 className="qm-item-name">{itemName(item)}</h4>
                                  <span className="qm-leader" aria-hidden="true" />
                                  <span className="qm-price">
                                    {money(item.price)}
                                    <span className="qm-currency"> {language === "am" && (menu.currency || "ETB") === "ETB" ? "ብር" : menu.currency || "ETB"}</span>
                                  </span>
                                </div>
                                {blurb && <p className="qm-description">{blurb}</p>}
                                {ingredients && <details className="qm-ingredient-details"><summary>{t.ingredients}</summary><p className="qm-ingredients">{ingredients}</p></details>}
                                {(dietary || allergens) && (
                                  <p className="qm-notes">
                                    {dietary && <span>{dietary}</span>}
                                    {allergens && <span>{t.contains}: {allergens}</span>}
                                  </p>
                                )}
                                {!item.isAvailable && <p className="qm-unavailable">{t.unavailable}</p>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="qm-footer">
            <p>{t.footer}</p>
            <p>{menu.restaurantName}, {menu.branchName}</p>
          </footer>
        </>
      )}
    </main>
  );
}
