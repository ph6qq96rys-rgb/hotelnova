import { useEffect, useMemo, useState } from "react";
import { posApi, type PosScope } from "../api/posApi";
import type { MenuItemDto } from "../types/posTypes";

export function usePosCatalog(
  scope: PosScope,
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

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingMenu(true);
      setError(null);

      try {
        const rows = await posApi.menuItems(scope, search, true);

        if (cancelled) return;
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
        if (cancelled) return;
        setMenuItems([]);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load menu items."
        );
      } finally {
        if (!cancelled) setLoadingMenu(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, scope.companyId, scope.branchId, search]);

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