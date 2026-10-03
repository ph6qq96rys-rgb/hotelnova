import { RecipePreview } from "../../components/ui/RecipePreview";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { PublicMenu } from "./types";
import "./public-menu.css";

const text = {
  en: { menu: "Menu", all: "All", available: "Made for your table", unavailable: "Currently unavailable", empty: "The menu is being prepared. Please ask a member of staff.", invalid: "This menu link is unavailable. Please ask the restaurant for its current QR code.", failed: "We couldn't load the menu. Check your connection and try again.", retry: "Try again", loading: "Loading the menu…", categories: "Menu categories", stale: "Unable to refresh. Prices and availability may have changed.", price: "Prices in ETB · VAT and service charge included", currency: "ETB", language: "Language" },
  am: { menu: "የምግብ ዝርዝር", all: "ሁሉም", available: "ለእርስዎ የተዘጋጀ", unavailable: "ለጊዜው አይገኝም", empty: "የምግብ ዝርዝሩ እየተዘጋጀ ነው። እባክዎ ሰራተኛን ይጠይቁ።", invalid: "ይህ የምግብ ዝርዝር አገናኝ አይገኝም። እባክዎ አዲሱን QR ኮድ ይጠይቁ።", failed: "የምግብ ዝርዝሩን መጫን አልተቻለም። ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ።", retry: "እንደገና ይሞክሩ", loading: "የምግብ ዝርዝሩ በመጫን ላይ…", categories: "የምግብ ምድቦች", stale: "ማደስ አልተቻለም። ዋጋ እና አቅርቦት ሊቀየሩ ይችላሉ።", price: "ዋጋዎች በብር · ቫትና የአገልግሎት ክፍያን ያካትታሉ", currency: "ብር", language: "ቋንቋ" },
};
export function MenuPhoto({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed || !src.startsWith("https://")) return null;
  return <img src={src} alt={alt} className={className} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
export default function PublicMenuPage() {
  const { companyId, branchId, token } = useParams();
  const [language, setLanguage] = useState<"en" | "am">("en");
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [error, setError] = useState<"invalid" | "failed" | null>(null);
  const [stale, setStale] = useState(false);
  const [category, setCategory] = useState("");
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
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, [companyId, branchId, token, retry]);
  const categories = useMemo(() => {
    const result = new Map<string, {name: string; localName?: string | null}>();
    menu?.items.forEach(item => result.set(item.categoryId, {name:item.categoryName, localName:item.categoryLocalName}));
    return [...result.entries()];
  }, [menu]);
  const local = (name: string, translated?: string | null) => language === "am" && translated?.trim() ? translated : name;
  const displayName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase().replace(/\b\p{L}/gu, letter => letter.toUpperCase()).replace(/\bBbq\b/g, "BBQ");
  const selected = categories.some(([id]) => id === category) ? category : "";
  function groups(categoryId: string) {
    const rows = menu?.items.filter(item => item.categoryId === categoryId) ?? [];
    const grouped = new Map<string, {name: string; items: typeof rows}>();
    for (const item of rows) {
      let name = item.subCategoryName?.trim().toUpperCase();
      const itemName = item.name.trim().toUpperCase().replace(/\s+/g, " ");
      if (!name) {
        if (["CAPPUCHINO", "MOCHA LATTE"].includes(itemName)) name = "COFFEE";
        else if (itemName === "BEEF WRAP") name = "WRAPS";
        else if (["CHICKEN PANINI SANDWICH", "CLUB SANDWICH BEEF", "STUFFED CROISSANT SANDWICH"].includes(itemName)) name = "SANDWICH";
        else if (itemName === "YODA CHICKEN BURGER") name = "BURGER";
        else if (itemName === "FRENCH TOAST") name = "BREAKFAST";
        else if (itemName === "CARAMEL TORTA 1KG") name = "CAKE";
        else if (itemName === "CHOCOLATE MOUSSE") name = "DESSERT";
      }
      if (name === "CAKE" && /COOKIES|CROSSIENT|CROISSANT/.test(itemName)) name = "PASTRIES";
      const definitions = [
        { names: ["COFFEE"], key: "coffee", en: "Coffee", am: "ቡና" },
        { names: ["NON-COFFEE"], key: "other-drinks", en: "Tea & Other Drinks", am: "ሻይ እና ሌሎች መጠጦች" },
        { names: ["ICED BEVERAGE"], key: "iced-drinks", en: "Iced Drinks", am: "ቀዝቃዛ መጠጦች" },
        { names: ["MILKSHAKE"], key: "milkshakes", en: "Milkshakes", am: "ሚልክሼክ" },
        { names: ["BREAKFAST"], key: "breakfast", en: "Breakfast", am: "ቁርስ" },
        { names: ["JUICE", "SALAD", "SALADS"], key: "juice-salad", en: "Juice & Salad", am: "ጭማቂ እና ሰላጣ" },
        { names: ["BURGER", "BURGERS", "SANDWICH", "SANDWICHES"], key: "burger-sandwich", en: "Burger & Sandwich", am: "በርገር እና ሳንድዊች" },
        { names: ["WRAPS"], key: "wraps", en: "Wraps", am: "ራፕ" },
        { names: ["PIZZA"], key: "pizza", en: "Pizza", am: "ፒዛ" },
        { names: ["PASTA"], key: "pasta", en: "Pasta", am: "ፓስታ" },
        { names: ["NATIONAL DISHES NON-FASTING", "NATIONAL FOOD"], key: "national-dishes", en: "National Dishes", am: "የሀገር ባህላዊ ምግቦች" },
        { names: ["CAKE"], key: "cakes", en: "Cakes", am: "ኬኮች" },
        { names: ["PASTRIES"], key: "pastries", en: "Croissants & Cookies", am: "ክሮሳንት እና ኩኪስ" },
        { names: ["DESSERT"], key: "desserts", en: "Desserts", am: "ጣፋጮች" },
        { names: ["EXTRA"], key: "extras", en: "Extras & Takeaway", am: "ተጨማሪ እና መውሰጃ" },
      ];
      const combined = definitions.find(group => name && group.names.includes(name));
      const key = combined ? combined.key : item.subCategoryId ?? "other";
      if (!grouped.has(key)) grouped.set(key, {name: combined ? (language === "am" ? combined.am : combined.en) : item.subCategoryName || (language === "am" ? "ሌሎች" : "Other"), items: []});
      grouped.get(key)!.items.push(item);
    }
    return [...grouped.entries()].sort(([a], [b]) => a === "other" ? (b === "other" ? 0 : 1) : b === "other" ? -1 : 0);
  }
  return <main className="public-menu" lang={language}>
    <div className="public-menu-language" aria-label={t.language}>
      <Button variant="ghost" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</Button>
      <span aria-hidden="true">/</span>
      <Button variant="ghost" aria-pressed={language === "am"} onClick={() => setLanguage("am")}>አማርኛ</Button>
    </div>
    {!menu ? <div className="public-menu-state" role={error ? "alert" : "status"}>
      <h1>{t.menu}</h1><p>{error ? t[error] : t.loading}</p>
      {error && <Button variant="outline" onClick={() => setRetry(x => x + 1)}>{t.retry}</Button>}
    </div> : <>
      <header className="public-menu-header">
        <MenuPhoto src={menu.logoUrl} alt={menu.branchName} className="public-menu-logo" />



        
        <h1>{t.menu}</h1>
        <div className="public-menu-rule" aria-hidden="true" />
        <p className="public-menu-price-note">{t.price}</p>
      </header>
      <nav className="public-menu-nav" aria-label={t.categories}>
        <Button variant="ghost" aria-pressed={!selected} onClick={() => setCategory("")}>{t.all}</Button>
        {categories.map(([id, c]) => <Button key={id} variant="ghost" aria-pressed={selected === id} onClick={() => setCategory(id)}>{local(c.name,c.localName)}</Button>)}
      </nav>
      {stale && <p className="public-menu-notice" role="status">{t.stale}</p>}
      {!menu.items.length && <p className="public-menu-state">{t.empty}</p>}
      <div className="public-menu-sections">
        {categories.filter(([id]) => !selected || selected === id).map(([id, c]) => <section key={id} aria-labelledby={`category-${id}`} className="public-menu-section">
          <h2 id={`category-${id}`}>{local(c.name,c.localName)}</h2>
          {groups(id).some(([key]) => key !== "other") && <nav className="public-menu-subnav" aria-label={`${local(c.name,c.localName)} ${language === "am" ? "ንዑስ ምድቦች" : "subcategories"}`}>
            {groups(id).map(([key, group]) => <a key={key} href={`#subcategory-${id}-${key}`}>{group.name}<span> {group.items.length}</span></a>)}
          </nav>}
          <div className={"public-menu-group-grid" + (groups(id).some(([key]) => key !== "other") ? " has-subgroups" : "")}> 
          {groups(id).map(([key, group]) => <div key={key} id={`subcategory-${id}-${key}`} className="public-menu-subgroup">
          {groups(id).some(([k]) => k !== "other") && <h3 className="public-menu-subheading">{group.name}</h3>}
          <ul className="public-menu-items">
            {group.items.map(item => <li key={item.id} className="public-menu-item">
              <RecipePreview name={language === "am" && item.localName?.trim() ? item.localName : displayName(item.name)} language={language}
                details={{ description: local(item.description ?? item.recipeDetails?.description ?? "", item.localDescription),
                  ingredients: item.recipeDetails?.ingredients, allergenInformation: item.recipeDetails?.allergenInformation }}>
                {trigger => <>
              <MenuPhoto src={item.imageUrl} alt="" className="public-menu-photo" />
              <div className="public-menu-item-content">
                <div className="public-menu-item-title"><h3>{trigger}</h3><span className="public-menu-item-price">{new Intl.NumberFormat(language === "am" ? "am-ET" : "en-ET", {minimumFractionDigits:2, maximumFractionDigits:2}).format(item.price)} <small>{t.currency}</small></span></div>
                {(item.description || item.localDescription) && <p>{local(item.description ?? "",item.localDescription)}</p>}
                {!item.isAvailable && <span className="public-menu-unavailable">{t.unavailable}</span>}
              </div>
              </>}</RecipePreview>
            </li>)}
          </ul></div>)}
          </div>
        </section>)}
      </div>
      <footer className="public-menu-footer">{menu.branchName}<span> · </span>{language === "am" ? "እንኳን ደህና መጡ" : "You're always welcome"}</footer>
    </>}
  </main>;
}
