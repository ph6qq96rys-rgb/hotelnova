import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useI18n } from "../../../i18n";
import type { MenuItemDto } from "../types/posTypes";
import { itemBlockReason } from "../utils/posCart";
import { money } from "./posUi";

type Props = {
  items: MenuItemDto[];
  loading: boolean;
  error?: string | null;
  disabled?: boolean;
  onAdd: (item: MenuItemDto) => void;
};

/** Searchable, category-filtered menu. Items that cannot be sold explain why. */
export function PosMenuPanel({ items, loading, error, disabled, onAdd }: Props) {
  const { tx } = useI18n();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.categoryName?.trim() || "Other"))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) =>
      (!category || (item.categoryName?.trim() || "Other") === category) &&
      (!q || [item.name, item.categoryName, item.code, item.externalCode].some((value) => value?.toLowerCase().includes(q))));
  }, [items, category, search]);

  return (
    <section className="rpos-menu" aria-label={tx("Menu")}>
      <div className="rpos-menu-search">
        <Search size={18} aria-hidden="true" />
        <Input id="rpos-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder={tx("Search item, category, code, or barcode")} aria-label={tx("Search item, category, code, or barcode")} />
      </div>
      <div className="rpos-chip-row rpos-category-strip" aria-label={tx("Menu categories")}>
        <Button type="button" size="sm" variant={!category ? "default" : "outline"} aria-pressed={!category} onClick={() => setCategory("")}>{tx("All")}</Button>
        {categories.map((name) => (
          <Button key={name} type="button" size="sm" variant={category === name ? "default" : "outline"} aria-pressed={category === name}
            onClick={() => setCategory(name)}>{name}</Button>
        ))}
      </div>

      {error ? <p className="rpos-alert" role="alert">{tx(error)}</p> : null}
      {loading ? <p className="rpos-muted">{tx("Loading menu catalogue...")}</p> : null}
      {!loading && visible.length === 0 ? <p className="rpos-muted">{tx("No matching menu items were found.")}</p> : null}

      <div className="rpos-menu-grid">
        {visible.map((item) => {
          const blocked = itemBlockReason(item);
          return (
            <Button key={item.id} type="button" variant="outline" className={blocked ? "rpos-menu-card is-blocked" : "rpos-menu-card"}
              disabled={disabled || !!blocked} title={blocked ?? undefined} onClick={() => onAdd(item)}>
              <span className="rpos-menu-name">{item.name}</span>
              <span className="rpos-muted">{item.categoryName || tx("Uncategorized")}</span>
              <strong>{money(Number(item.sellingPrice || 0))}</strong>
              {blocked ? <span className="rpos-menu-blocked">{tx("Not ready for sale")}</span> : null}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
