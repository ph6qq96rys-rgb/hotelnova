import type { PublicMenuItem } from "./types";
export type MenuLanguage = "en" | "am";
export const normalizeMenuName = (name: string) => name.trim().replace(/\s+/g, " ").toUpperCase();
const labels: Record<string, [string, string]> = {
  BEVERAGE: ["Drinks", "መጠጦች"], FOOD: ["Food", "ምግቦች"], PASTRY: ["Bakery & desserts", "የዳቦ መጋገሪያ ውጤቶችና ጣፋጮች"],
  COFFEE: ["Coffee", "ቡና"], "ICED BEVERAGE": ["Iced drinks", "ቀዝቃዛ መጠጦች"], MILKSHAKE: ["Milkshakes", "ሚልክሼክ"],
  "NON-COFFEE": ["Tea & other drinks", "ሻይና ሌሎች መጠጦች"], TEA: ["Tea & infusions", "ሻይና ቅመም መጠጦች"], MATCHA: ["Matcha", "ማቻ"],
  MOJITO: ["Mojitos", "ሞሂቶ"], REFRESHMENTS: ["Water & soft drinks", "ውሃና ለስላሳ መጠጦች"], JUICE: ["Juice & Smoothie Corner", "የጭማቂና ስሙዚ ማዕዘን"],
  BREAKFAST: ["Breakfast", "ቁርስ"], SANDWICH_BURGER: ["Sandwiches & Burgers", "ሳንድዊችና በርገር"], EXTRA: ["Extras", "ተጨማሪዎች"],
  LOCAL_DISHES: ["Local Dishes", "የአገር ባህል ምግቦች"], PASTA: ["Pasta", "ፓስታ"], PIZZA: ["Pizza", "ፒዛ"], SALADS: ["Salads", "ሰላጣ"],
  WRAPS: ["Wraps", "ጥቅል ሳንድዊች"], CAKE: ["Cakes & desserts", "ኬክና ጣፋጮች"],
  BAKERY: ["Croissants & cookies", "ክሮሳንትና ብስኩት"], OTHER: ["Other items", "ሌሎች"],
};
const order = Object.keys(labels);
export function menuLabel(value: string, language: MenuLanguage, local?: string | null) {
  const key = normalizeMenuName(value);
  const known = labels[key];
  if (known) return known[language === "am" ? 1 : 0];
  if (language === "am" && local?.trim()) return local.trim();
  return value.trim().replace(/\s+/g, " ").replace(/\b[A-Z][A-Z]+\b/g, word => word[0] + word.slice(1).toLowerCase());
}
/** Guest-facing sections are separate from POS/accounting categories. Never change item IDs or prices. */
export function menuPlacement(item: PublicMenuItem) {
  let category = normalizeMenuName(item.categoryName || "OTHER");
  let group = normalizeMenuName(item.subCategoryName || "OTHER");
  const name = normalizeMenuName(item.name);
  if (["JUICE", "SMOOTHIE", "SMOOTHIES"].includes(group)) group = "JUICE";
  if (category === "FOOD" && group === "JUICE") category = "BEVERAGE";
  if (category === "FOOD") {
    if (group === "NATIONAL DISHES NON-FASTING" || group === "NATIONAL FOOD") group = "LOCAL_DISHES";
    if (group === "OTHER") {
      if (/\bBURGER\b/.test(name)) group = "BURGER";
      else if (/\bWRAP\b/.test(name)) group = "WRAPS";
      else if (/\b(SANDWICH|PANINI)\b/.test(name)) group = "SANDWICH";
    }
  }
  if (category === "FOOD" && (group === "SANDWICH" || group === "BURGER")) group = "SANDWICH_BURGER";
  if (category === "FOOD" && group === "WRAP") group = "WRAPS";
  if (category === "BEVERAGE" && group === "NON-COFFEE") {
    if (/MATCHA/.test(name)) group = "MATCHA";
    else if (/MOJITO/.test(name)) group = "MOJITO";
    else if (/TEA/.test(name)) group = "TEA";
    else if (/WATER|SOFT DRINK/.test(name)) group = "REFRESHMENTS";
  }
  if (category === "PASTRY" && /CROSSIENT|CROISSANT|COOKIES/.test(name)) group = "BAKERY";
  return { category, group };
}
export function groupMenuItems(items: PublicMenuItem[]) {
  const sections = new Map<string, { key: string; localName?: string | null; groups: Map<string, { key: string; items: PublicMenuItem[] }> }>();
  for (const item of items) {
    const { category, group } = menuPlacement(item);
    if (!sections.has(category)) sections.set(category, { key: category, localName: item.categoryLocalName, groups: new Map() });
    const section = sections.get(category)!;
    if (!section.groups.has(group)) section.groups.set(group, { key: group, items: [] });
    section.groups.get(group)!.items.push(item);
  }
  const rank = (key: string) => order.includes(key) ? order.indexOf(key) : order.length;
  return [...sections.values()].sort((a,b) => rank(a.key)-rank(b.key)).map(section => ({ ...section, groups: [...section.groups.values()].sort((a,b) => rank(a.key)-rank(b.key)) }));
}
