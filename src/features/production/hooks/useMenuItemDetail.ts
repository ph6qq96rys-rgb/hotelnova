import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { menuItemsApi } from "../api/menuItemsApi";
import { productionRecipesApi } from "../api/recipesApi";
import type {
  MenuCategoryDto,
  MenuItemDto,
  RecipeDto,
  StockLocationDto,
  UpsertMenuItemRequest,
} from "../types";

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function isRealId(value?: string | null): value is string {
  const id = clean(value).toLowerCase();

  return Boolean(
    id &&
      id !== "new" &&
      id !== "create" &&
      id !== ":id" &&
      id !== EMPTY_GUID
  );
}

function canHaveOutputInventory(itemType: number): boolean {
  return itemType === 5 || itemType === 6;
}

export function normalizeList<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : res.items ?? [];
}

export function extractApiError(e: unknown, fallback = "Request failed."): string {
  const err = e as any;
  const data = err?.response?.data;

  if (!data) return err?.message ?? fallback;
  if (typeof data === "string") return data;

  return data?.detail ?? data?.message ?? data?.title ?? err?.message ?? fallback;
}

export type MenuItemFormState = {
  vatRateOverride: number | null;
  serviceChargeRateOverride: number | null;
  contingencyRateOverride: number | null;
  name: string;
  code: string;
  externalCode: string;
  categoryId: string;
  sellingPrice: string;
  itemType: number;
  consumptionLocationId: string;
  isActive: boolean;
  isAvailableForSale: boolean;
  showOnQrMenu: boolean;
};

const emptyForm: MenuItemFormState = {
  vatRateOverride: null,
  serviceChargeRateOverride: null,
  contingencyRateOverride: null,
  name: "",
  code: "",
  externalCode: "",
  categoryId: "",
  sellingPrice: "0",
  itemType: 1,
  consumptionLocationId: "",
  isActive: true,
  isAvailableForSale: true,
  showOnQrMenu: true,
};

function bindForm(dto: MenuItemDto): MenuItemFormState {
  return {
    name: dto.name ?? "",
    code: dto.code ?? "",
    externalCode: dto.externalCode ?? "",
    categoryId: dto.categoryId ?? "",
    sellingPrice: String(dto.sellingPrice ?? 0),
    vatRateOverride: dto.vatRateOverride ?? null,
    serviceChargeRateOverride: dto.serviceChargeRateOverride ?? null,
    contingencyRateOverride: dto.contingencyRateOverride ?? null,
    itemType: dto.itemType ?? 1,
    consumptionLocationId: dto.consumptionLocationId ?? "",
    isActive: dto.isActive === true,
    isAvailableForSale: dto.isAvailableForSale === true,
    showOnQrMenu: dto.showOnQrMenu ?? true,
  };
}

export function useMenuItemDetail(rawMenuItemId?: string) {
  const { companyId, branchId } = useAppScope();
  const menuItemId = isRealId(rawMenuItemId) ? rawMenuItemId : undefined;

  const [item, setItem] = useState<MenuItemDto | null>(null);
  const [recipe, setRecipe] = useState<RecipeDto | null>(null);
  const [categories, setCategories] = useState<MenuCategoryDto[]>([]);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [form, setForm] = useState<MenuItemFormState>(emptyForm);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasContext = Boolean(companyId && branchId);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === form.categoryId),
    [categories, form.categoryId]
  );

  const effectiveLocationName = useMemo(() => {
    return (
      locations.find((location) => location.id === form.consumptionLocationId)?.name ||
      selectedCategory?.defaultConsumptionLocationName ||
      item?.categoryConsumptionLocationName ||
      null
    );
  }, [locations, form.consumptionLocationId, selectedCategory, item]);

  const canSave = useMemo(() => {
    const price = Number(form.sellingPrice || 0);

    return Boolean(
      companyId &&
        branchId &&
        menuItemId &&
        item &&
        form.name.trim() &&
        form.categoryId &&
        Number.isFinite(price) &&
        price >= 0 &&
        !saving
    );
  }, [companyId, branchId, menuItemId, item, form, saving]);

  const loadReferenceData = useCallback(async () => {
    if (!companyId || !branchId) return;

    const [catRes, locRes] = await Promise.allSettled([
      menuItemsApi.listCategories(companyId, branchId),
      menuItemsApi.listStockLocations(companyId, branchId),
    ]);

    setCategories(
      catRes.status === "fulfilled"
        ? normalizeList<MenuCategoryDto>(catRes.value)
            .filter((category) => category.isActive !== false)
            .sort((a, b) => a.name.localeCompare(b.name))
        : []
    );

    setLocations(
      locRes.status === "fulfilled"
        ? normalizeList<StockLocationDto>(locRes.value)
            .filter((location) => location.isActive !== false)
            .sort((a, b) => a.name.localeCompare(b.name))
        : []
    );
  }, [companyId, branchId]);

  const load = useCallback(async () => {
    if (!companyId || !branchId) return;

    setLoading(true);
    setError(null);

    try {
      await loadReferenceData();

      if (!menuItemId) {
        setItem(null);
        setRecipe(null);
        setForm(emptyForm);
        return;
      }

      const [itemRes, recipeRes] = await Promise.allSettled([
        menuItemsApi.get(companyId, branchId, menuItemId),
        productionRecipesApi.getByMenuItem(companyId, menuItemId),
      ]);

      if (itemRes.status !== "fulfilled") throw itemRes.reason;

      setItem(itemRes.value);
      setForm(bindForm(itemRes.value));
      setRecipe(recipeRes.status === "fulfilled" ? recipeRes.value : null);
    } catch (e) {
      setError(extractApiError(e, "Failed to load menu item."));
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, menuItemId, loadReferenceData]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!companyId || !branchId || !menuItemId || !item) return;
    if (!form.name.trim()) return setError("Menu item name is required.");
    if (!form.categoryId) return setError("Category is required.");

    const price = Number(form.sellingPrice || 0);

    if (!Number.isFinite(price) || price < 0) {
      return setError("Selling price must be zero or greater.");
    }

    const allowOutputInventory = canHaveOutputInventory(form.itemType);

    const payload: UpsertMenuItemRequest = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      externalCode: form.externalCode.trim() || null,
      categoryId: form.categoryId,
      subCategoryId: item.subCategoryId ?? null,
      itemType: form.itemType,
      sellingPrice: price,
      vatRateOverride: form.vatRateOverride,
      serviceChargeRateOverride: form.serviceChargeRateOverride,
      contingencyRateOverride: form.contingencyRateOverride,
      isActive: form.isActive,
      isAvailableForSale: form.isAvailableForSale,
      showOnQrMenu: form.showOnQrMenu,
      consumptionLocationId: form.consumptionLocationId || null,
      outputItemId: allowOutputInventory ? item.outputItemId ?? null : null,
      outputUomId: allowOutputInventory ? item.outputUomId ?? null : null,
    };

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const updated = await menuItemsApi.update(companyId, branchId, menuItemId, payload);
      setItem(updated);
      setForm(bindForm(updated));
      setNotice("Menu item configuration saved.");
      await load();
    } catch (e) {
      setError(extractApiError(e, "Failed to save menu item."));
    } finally {
      setSaving(false);
    }
  }, [companyId, branchId, menuItemId, item, form, load]);

  return {
    companyId,
    branchId,
    menuItemId,
    hasContext,
    item,
    recipe,
    categories,
    locations,
    form,
    setForm,
    selectedCategory,
    effectiveLocationName,
    loading,
    saving,
    error,
    setError,
    notice,
    setNotice,
    canSave,
    load,
    save,
  };
}
