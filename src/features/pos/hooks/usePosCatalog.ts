import { useEffect, useMemo, useState } from "react";
import { posApi } from "../api/posApi";
import type { MenuItemDto } from "../types/posTypes";

export function usePosCatalog(
  enabled: boolean,
  search: string
) {
  const [menuItems, setMenuItems] = useState<MenuItemDto[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setMenuItems([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoadingMenu(true);
      setError(null);

      try {
        const rows = await posApi.menuItems(search, true);

        setMenuItems(
          Array.isArray(rows)
            ? rows.filter(
                (x) =>
                  x.isActive !== false &&
                  x.isAvailableForSale !== false
              )
            : []
        );
      } catch (err) {
        setMenuItems([]);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load menu items."
        );
      } finally {
        setLoadingMenu(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [enabled, search]);

  const categories = useMemo(() => {
    const names = Array.from(
      new Set(
        menuItems.map(
          (x) => x.categoryName?.trim() || "Other"
        )
      )
    ).sort();

    return ["All", ...names];
  }, [menuItems]);

  return {
    menuItems,
    loadingMenu,
    error,
    categories,
  };
}