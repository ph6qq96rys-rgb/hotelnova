import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { menuItemsApi } from "../api/menuItemsApi";
import type { MenuCategoryDto, MenuItemDto } from "../types";

export function normalizeList<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : res.items ?? [];
}

export function extractApiError(e: unknown, fallback = "Request failed."): string {
  const err = e as any;
  const data = err?.response?.data;
  if (!data) return err?.message ?? fallback;
  if (typeof data === "string") return data;
  return data?.message ?? data?.title ?? err?.message ?? fallback;
}

export type MenuItemAvailabilityFilter = "all" | "ready" | "blocked" | "active" | "inactive";
export type MenuItemSortKey = "name" | "price" | "cost" | "margin" | "unitsSold";

export type MenuItemsListFilters = {
  search: string;
  categoryId: string;
  availability: MenuItemAvailabilityFilter;
  sortBy: MenuItemSortKey;
};

const initialFilters: MenuItemsListFilters = {
  search: "",
  categoryId: "",
  availability: "all",
  sortBy: "name",
};

function isReady(item: MenuItemDto): boolean {
  return Boolean(
    item.isActive === true &&
      item.isAvailableForSale === true &&
      item.hasRecipe === true &&
      item.hasConsumptionLocation === true
  );
}

function getSearchText(item: MenuItemDto): string {
  return [
    item.name,
    item.code,
    item.externalCode,
    (item as any).categoryName,
    (item as any).subCategoryName,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

async function fetchMenuItems(companyId: string, branchId: string): Promise<MenuItemDto[]> {
  const api = menuItemsApi as any;

  if (typeof api.list === "function") {
    return normalizeList<MenuItemDto>(await api.list(companyId, branchId));
  }

  if (typeof api.search === "function") {
    return normalizeList<MenuItemDto>(await api.search(companyId, branchId));
  }

  if (typeof api.getAll === "function") {
    return normalizeList<MenuItemDto>(await api.getAll(companyId, branchId));
  }

  throw new Error("menuItemsApi must expose list(companyId, branchId), search(companyId, branchId), or getAll(companyId, branchId).");
}

export function useMenuItemsList() {
  const { companyId, branchId } = useAppScope();

  const [items, setItems] = useState<MenuItemDto[]>([]);
  const [categories, setCategories] = useState<MenuCategoryDto[]>([]);
  const [filters, setFilters] = useState<MenuItemsListFilters>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasContext = Boolean(companyId && branchId);

  const load = useCallback(async () => {
    if (!companyId || !branchId) return;

    setLoading(true);
    setError(null);

    try {
      const [itemsRes, categoriesRes] = await Promise.allSettled([
        fetchMenuItems(companyId, branchId),
        menuItemsApi.listCategories(companyId, branchId),
      ]);

      if (itemsRes.status !== "fulfilled") throw itemsRes.reason;

      setItems(
        normalizeList<MenuItemDto>(itemsRes.value).sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? "")
        )
      );

      setCategories(
        categoriesRes.status === "fulfilled"
          ? normalizeList<MenuCategoryDto>(categoriesRes.value)
              .filter((x) => x.isActive !== false)
              .sort((a, b) => a.name.localeCompare(b.name))
          : []
      );
    } catch (e) {
      setError(extractApiError(e, "Failed to load menu items."));
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const search = filters.search.trim().toUpperCase();

    const rows = items.filter((item) => {
      if (search && !getSearchText(item).includes(search)) return false;
      if (filters.categoryId && item.categoryId !== filters.categoryId) return false;

      switch (filters.availability) {
        case "ready":
          return isReady(item);
        case "blocked":
          return !isReady(item);
        case "active":
          return item.isActive === true;
        case "inactive":
          return item.isActive !== true;
        default:
          return true;
      }
    });

    return [...rows].sort((a, b) => {
      if (filters.sortBy === "price") return (b.sellingPrice ?? 0) - (a.sellingPrice ?? 0);
      if (filters.sortBy === "cost") return (b.cost ?? 0) - (a.cost ?? 0);
      if (filters.sortBy === "unitsSold") return ((b as any).unitsSold ?? 0) - ((a as any).unitsSold ?? 0);
      if (filters.sortBy === "margin") {
        const ma = (a.sellingPrice ?? 0) - (a.cost ?? 0);
        const mb = (b.sellingPrice ?? 0) - (b.cost ?? 0);
        return mb - ma;
      }
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [items, filters]);

  const summary = useMemo(() => {
    const ready = items.filter(isReady).length;
    const active = items.filter((x) => x.isActive === true).length;
    const missingRecipe = items.filter((x) => x.hasRecipe !== true).length;
    const missingLocation = items.filter((x) => x.hasConsumptionLocation !== true).length;

    return {
      total: items.length,
      visible: filteredItems.length,
      ready,
      blocked: items.length - ready,
      active,
      inactive: items.length - active,
      missingRecipe,
      missingLocation,
    };
  }, [items, filteredItems]);

  return {
    companyId,
    branchId,
    hasContext,
    items,
    filteredItems,
    categories,
    filters,
    setFilters,
    loading,
    error,
    setError,
    notice,
    setNotice,
    summary,
    load,
  };
}
