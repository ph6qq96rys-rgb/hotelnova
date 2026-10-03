// src/features/production/pages/RecipeEditorPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { useI18n } from "../../../i18n";
import { menuItemsApi } from "../api/menuItemsApi";
import { productionRecipesApi } from "../api/recipesApi";
import { fetchInventoryItems, fetchProductionOutputItems, fetchUoms } from "../api/lookups";
import type { InventoryItemLite, UomLite } from "../api/lookups";
import type { MenuItemLite, RecipeDto, UpsertRecipeRequest } from "../types";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import { RecipeCostingPanel } from "../components/RecipeCostingPanel";
import "../layout/production.css";

type RecipeMode = "directSale" | "production";

type MenuItemWithOutput = MenuItemLite & {
  outputItemId?: string | null;
  outputItemName?: string | null;
  outputUomId?: string | null;
  outputUomName?: string | null;
};

type ItemUomOption = {
  uomId: string;
  code?: string | null;
  name?: string | null;
  isBase?: boolean;
  isRecipe?: boolean;
  isConsume?: boolean;
  isActive?: boolean;
  toBaseFactor?: number | null;
};

type InventoryItemEx = InventoryItemLite & {
  itemType?: string | number | null;
  baseUomId?: string | null;
  baseUomCode?: string | null;
  baseUomName?: string | null;
  uoms?: ItemUomOption[];
};

type EditRow = {
  _uid: string;
  id?: string | null;
  itemId: string;
  uomId: string;
  uomName: string;
  qtyStr: string;
  wastePctStr: string;
  isActive: boolean;
  notes: string | null;
};

let uidCounter = 0;
const newUid = () => `row-${++uidCounter}`;

function blankRow(): EditRow {
  return {
    _uid: newUid(),
    id: null,
    itemId: "",
    uomId: "",
    uomName: "",
    qtyStr: "1",
    wastePctStr: "0",
    isActive: true,
    notes: null,
  };
}

function normalizeItemType(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value.trim()))) {
    const numericValue = Number(value);
    const map: Record<number, string> = {
      0: "select",
      1: "ingredient",
      2: "stockitem",
      3: "packaging",
      4: "semifinished",
      5: "finishedgood",
      6: "rawmaterial",
    };
    return map[numericValue] ?? String(value);
  }
  return String(value).replace(/[\s_-]+/g, "").toLowerCase();
}

const PRODUCIBLE = new Set(["finishedgood", "semifinished"]);

function isProducible(item: InventoryItemEx): boolean {
  return PRODUCIBLE.has(normalizeItemType(item.itemType));
}

function extractApiError(e: unknown, fallback: string): string {
  const err = e as any;
  const data = err?.response?.data;
  if (!data) return err?.message ?? fallback;
  if (typeof data === "string") return data;
  return data?.message ?? data?.title ?? err?.message ?? fallback;
}

function inventoryItemDisplayName(item: Pick<InventoryItemLite, "name" | "localName">): string {
  const englishName = String(item.name ?? "").trim() || "Unnamed item";
  const amharicName = String(item.localName ?? "").trim();

  if (amharicName && amharicName !== englishName && !englishName.includes(amharicName)) {
    return `${englishName} - ${amharicName}`;
  }

  return englishName;
}

function normalizeRecipeMode(value: unknown): RecipeMode {
  if (value === 2) return "production";
  if (value === 1) return "directSale";

  const text = String(value ?? "")
    .replace(/[\s_-]+/g, "")
    .toLowerCase();

  return text === "production" || text === "stockedoutput"
    ? "production"
    : "directSale";
}

function uomDisplayName(uom: ItemUomOption, fallback: Map<string, string>): string {
  return uom.code || uom.name || fallback.get(uom.uomId) || uom.uomId;
}

function getRecipeUoms(item?: InventoryItemEx | null): ItemUomOption[] {
  if (!item) return [];

  const rows = (item.uoms ?? []).filter(
    (u) =>
      u.uomId &&
      u.isActive !== false &&
      (u.isRecipe === true || u.isConsume === true)
  );

  if (rows.length > 0) return rows;

  if (item.baseUomId) {
    return [
      {
        uomId: item.baseUomId,
        code: item.baseUomCode ?? null,
        name: item.baseUomName ?? "Base UOM",
        isRecipe: true,
        isConsume: true,
        isActive: true,
        toBaseFactor: 1,
      },
    ];
  }

  return [];
}

function getOutputUoms(item?: InventoryItemEx | null): ItemUomOption[] {
  if (!item) return [];

  const rows = (item.uoms ?? []).filter((u) => u.uomId && u.isActive !== false);
  if (rows.length > 0) return rows;

  if (item.baseUomId) {
    return [
      {
        uomId: item.baseUomId,
        code: item.baseUomCode ?? null,
        name: item.baseUomName ?? "Base UOM",
        isActive: true,
        toBaseFactor: 1,
      },
    ];
  }

  return [];
}

function toEditRow(line: RecipeDto["lines"][number], uomNameById: Map<string, string>): EditRow {
  return {
    _uid: newUid(),
    id: line.id ?? null,
    itemId: line.itemId,
    uomId: line.uomId,
    uomName: uomNameById.get(line.uomId) ?? line.uomName ?? line.uomId,
    qtyStr: String(line.qty ?? ""),
    wastePctStr: line.wastePct == null ? "0" : String(line.wastePct),
    isActive: line.isActive ?? true,
    notes: line.notes?.trim() || null,
  };
}

export default function RecipeEditorPage() {
  const { tx } = useI18n();
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();
  const { id: routeMenuItemId } = useParams<{ id?: string }>();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItemWithOutput[]>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [items, setItems] = useState<InventoryItemEx[]>([]);
  const [productionOutputItems, setProductionOutputItems] = useState<InventoryItemEx[]>([]);
  const [uoms, setUoms] = useState<UomLite[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [importSourceMenuItemId, setImportSourceMenuItemId] = useState("");
  const [importingRecipe, setImportingRecipe] = useState(false);

  const [recipe, setRecipe] = useState<RecipeDto | null>(null);
  const [recipeMode, setRecipeMode] = useState<RecipeMode>("directSale");
  const [outputItemId, setOutputItemId] = useState("");
  const [outputUomId, setOutputUomId] = useState("");
  const [outputQuantityStr, setOutputQuantityStr] = useState("1");
  const [rows, setRows] = useState<EditRow[]>([]);

  const effectiveMenuItemId = routeMenuItemId ?? selectedMenuItemId;
  const costingMenuItemId = recipeMode === "production"
    ? (recipe?.outputItemId === outputItemId ? recipe?.menuItemId : null)
    : (recipe?.menuItemId === effectiveMenuItemId ? effectiveMenuItemId : null);
  const hasCostingRecipe = Boolean(recipe?.id && recipe.id !== "00000000-0000-0000-0000-000000000000"
    && costingMenuItemId && costingMenuItemId !== "00000000-0000-0000-0000-000000000000");
  const isDeepLinked = Boolean(routeMenuItemId);
  const busy = loading || saving;

  const uomNameById = useMemo(
    () => new Map(uoms.map((u) => [u.id, u.name ?? u.code])),
    [uoms]
  );

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const selectedMenuItem = useMemo(
    () => menuItems.find((m) => m.id === effectiveMenuItemId) ?? null,
    [menuItems, effectiveMenuItemId]
  );

  const importableMenuItems = useMemo(() => {
    const otherItems = menuItems.filter((m) => m.id !== effectiveMenuItemId);
    const withRecipes = otherItems.filter((m) => Boolean((m as MenuItemWithOutput & { hasRecipe?: boolean }).hasRecipe));
    return withRecipes.length ? withRecipes : otherItems;
  }, [menuItems, effectiveMenuItemId]);

  const outputItems = useMemo(() => {
    return productionOutputItems.filter(isProducible);
  }, [productionOutputItems]);

  const ingredientItems = useMemo(() => {
    const hasTypes = items.some((i) => i.itemType != null);
    const candidates = hasTypes
      ? items.filter((i) => normalizeItemType(i.itemType) !== "finishedgood")
      : items;

    const q = ingredientSearch.trim().toLowerCase();
    if (!q) return candidates;

    return candidates.filter((item) =>
      [
        inventoryItemDisplayName(item),
        item.name,
        item.localName,
        item.sku,
        item.code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [items, ingredientSearch]);

  const selectedOutputItem = useMemo(
    () => productionOutputItems.find((i) => i.id === outputItemId) ?? null,
    [productionOutputItems, outputItemId]
  );

  const outputUomOptions = useMemo(
    () => getOutputUoms(selectedOutputItem),
    [selectedOutputItem]
  );

  const activeLines = useMemo(() => rows.filter((r) => r.isActive).length, [rows]);
  const inactiveLines = rows.length - activeLines;
  const outputNeedsSetup = recipeMode === "production" && (!outputItemId || !outputUomId);

  useEffect(() => {
    setProductionOutputItems([]);
    if (!companyId) return;
    let cancelled = false;

    Promise.all([
      fetchInventoryItems(companyId, branchId ?? "", ""),
      fetchProductionOutputItems(companyId, branchId),
      fetchUoms(companyId),
    ])
      .then(([inv, outputInv, uomRows]) => {
        if (cancelled) return;
        setItems(inv as InventoryItemEx[]);
        setProductionOutputItems(outputInv as InventoryItemEx[]);
        setUoms(uomRows);
      })
      .catch((e) => {
        if (!cancelled) setError(extractApiError(e, "Failed to load inventory catalog."));
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId || !branchId) return;
    let cancelled = false;

    setLoading(true);

    menuItemsApi
      .list(companyId, branchId)
      .then((list) => {
        if (cancelled) return;
        setMenuItems(list as MenuItemWithOutput[]);
        if (!routeMenuItemId && list.length > 0) {
          setSelectedMenuItemId((prev) =>
            list.some((m: MenuItemWithOutput) => m.id === prev) ? prev : list[0].id
          );
        }
      })
      .catch((e) => {
        if (!cancelled) setError(extractApiError(e, "Failed to load menu items."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, routeMenuItemId]);

  useEffect(() => {
    if (!companyId || !ingredientSearch.trim()) return;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      fetchInventoryItems(companyId, branchId ?? "", ingredientSearch)
        .then((inv) => {
          if (!cancelled) setItems(inv as InventoryItemEx[]);
        })
        .catch(() => {});
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [companyId, branchId, ingredientSearch]);

  useEffect(() => {
    if (!companyId || !branchId || !effectiveMenuItemId) return;
    if (recipeMode !== "directSale") return;
    let cancelled = false;

    setError(null);
    setSuccess(null);

    productionRecipesApi
      .getByMenuItem(companyId, effectiveMenuItemId)
      .then((dto) => {
        if (cancelled) return;
        setRecipe(dto);
        setRecipeMode(normalizeRecipeMode((dto as any)?.mode));
        setOutputItemId(dto?.outputItemId ?? "");
        setOutputUomId(dto?.outputUomId ?? "");
        setOutputQuantityStr(String(dto?.outputQuantity ?? 1));
        setRows((dto?.lines ?? []).map((line) => toEditRow(line, uomNameById)));
      })
      .catch((e: any) => {
        if (cancelled) return;
        const status = e?.response?.status ?? e?.status;
        if (status === 404) {
          setRecipe(null);
          setRecipeMode("directSale");
          setOutputItemId("");
          setOutputUomId("");
          setOutputQuantityStr("1");
          setRows([]);
        } else {
          setError(extractApiError(e, "Failed to load recipe."));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, effectiveMenuItemId, recipeMode, uomNameById]);

  useEffect(() => {
    if (!companyId || !branchId || recipeMode !== "production" || !outputItemId) return;
    let cancelled = false;

    setError(null);
    setSuccess(null);

    productionRecipesApi
      .getByOutputItem(companyId, branchId, outputItemId, { mode: "production" })
      .then((dto) => {
        if (cancelled) return;
        setRecipe(dto);
        setRecipeMode("production");
        setOutputItemId(dto.outputItemId ?? outputItemId);
        setOutputUomId(dto.outputUomId ?? outputUomId);
        setOutputQuantityStr(String(dto.outputQuantity ?? outputQuantityStr));
        setRows((dto.lines ?? []).map((line) => toEditRow(line, uomNameById)));
      })
      .catch((e: any) => {
        if (cancelled) return;
        const status = e?.response?.status ?? e?.status;
        if (status === 404) {
          setRecipe(null);
          setRows([]);
        } else {
          setError(extractApiError(e, "Failed to load production recipe."));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, recipeMode, outputItemId, uomNameById]);

  const addLine = () => setRows((prev) => [blankRow(), ...prev]);
  const removeRow = (uid: string) => setRows((prev) => prev.filter((r) => r._uid !== uid));
  const updateRow = (uid: string, patch: Partial<EditRow>) =>
    setRows((prev) => prev.map((r) => (r._uid === uid ? { ...r, ...patch } : r)));

  const selectIngredient = (uid: string, itemId: string) => {
    const item = itemById.get(itemId);
    const allowedUoms = getRecipeUoms(item);
    const preferred = allowedUoms[0];

    updateRow(uid, {
      itemId,
      uomId: preferred?.uomId ?? "",
      uomName: preferred ? uomDisplayName(preferred, uomNameById) : "",
    });
  };

  async function importRecipeFromMenuItem() {
    if (!companyId || !branchId || !effectiveMenuItemId) return;

    if (!importSourceMenuItemId) {
      setError("Select a source menu item to import from.");
      return;
    }

    if (importSourceMenuItemId === effectiveMenuItemId) {
      setError("Choose a different source menu item.");
      return;
    }

    setImportingRecipe(true);
    setError(null);
    setSuccess(null);

    try {
      const source = await productionRecipesApi.getByMenuItem(companyId, importSourceMenuItemId, { mode: "directSale" });
      const importedRows = (source.lines ?? []).map((line) => ({
        ...toEditRow(line, uomNameById),
        id: null,
      }));

      if (!importedRows.length) {
        setError("The selected source menu item has no ingredient lines to import.");
        return;
      }

      setRecipeMode("directSale");
      setOutputItemId("");
      setOutputUomId("");
      setOutputQuantityStr("1");
      setRows(importedRows);
      setRecipe((current) => current ? { ...current, notes: source.notes ?? current.notes } : null);
      setSuccess(`Imported ${importedRows.length} recipe lines. Review quantities, then save this menu item.`);
    } catch (e) {
      setError(extractApiError(e, "Unable to import recipe."));
    } finally {
      setImportingRecipe(false);
    }
  }

  function validate(): string | null {
    if (!branchId) return "Branch is required before editing recipes.";
    if (recipeMode === "directSale" && !effectiveMenuItemId) return "Menu item is required.";

    if (recipeMode === "production") {
      if (!outputItemId) return "Output item is required for production recipes.";
      if (selectedOutputItem && !isProducible(selectedOutputItem)) {
        return "Output item must be a finished or semi-finished inventory item.";
      }
      if (!outputUomId) return "Output UOM is required for production recipes.";
      const outputQuantity = Number(outputQuantityStr);
      if (!Number.isFinite(outputQuantity) || outputQuantity <= 0) return "Output quantity must be greater than zero for production recipes.";
      if (outputUomOptions.length > 0 && !outputUomOptions.some((u) => u.uomId === outputUomId)) {
        return "Output UOM is not configured for the selected output item.";
      }
    }

    const activeRows = rows.filter((x) => x.isActive);
    if (!activeRows.length) return "Add at least one active ingredient line.";

    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.isActive) continue;
      const label = `Ingredient line ${i + 1}`;

      if (!row.itemId) return `${label}: ingredient is required.`;
      if (!row.uomId) return `${label}: select a recipe/consume UOM for this ingredient.`;

      const item = itemById.get(row.itemId);
      const allowed = getRecipeUoms(item);
      if (allowed.length > 0 && !allowed.some((u) => u.uomId === row.uomId)) {
        return `${label}: selected UOM is not configured for recipe/consume use.`;
      }

      const qty = Number(row.qtyStr);
      if (!Number.isFinite(qty) || qty <= 0) return `${label}: qty must be greater than zero.`;

      const waste = Number(row.wastePctStr);
      if (!Number.isFinite(waste) || waste < 0 || waste > 100) {
        return `${label}: waste % must be 0-100.`;
      }

      const key = `${row.itemId}::${row.uomId}`;
      if (seen.has(key)) return `${label}: duplicate ingredient/UOM combination.`;
      seen.add(key);
    }

    return null;
  }

  async function save() {
    if (!companyId || !branchId) return;
    if (recipeMode === "directSale" && !effectiveMenuItemId) return;

    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const body = {
        menuItemId: recipeMode === "directSale" ? effectiveMenuItemId : recipe?.menuItemId ?? null,
        mode: recipeMode,
        notes: recipe?.notes ?? null,
        isActive: recipe?.isActive ?? true,
        outputItemId: recipeMode === "production" ? outputItemId || null : null,
        outputUomId: recipeMode === "production" ? outputUomId || null : null,
        outputQuantity: recipeMode === "production" ? Number(outputQuantityStr) : null,
        lines: rows.map((row) => ({
          id: row.id ?? null,
          itemId: row.itemId,
          uomId: row.uomId,
          qtyPerMenuUnit: Number(row.qtyStr),
          wastePct: Number(row.wastePctStr),
          isActive: row.isActive,
          notes: row.notes?.trim() || null,
        })),
      };

      const dto = recipeMode === "production"
        ? await productionRecipesApi.upsertByOutputItem(
            companyId,
            branchId,
            outputItemId,
            body as UpsertRecipeRequest & { mode: RecipeMode }
          )
        : await productionRecipesApi.upsertByMenuItem(
            companyId,
            effectiveMenuItemId,
            body as UpsertRecipeRequest & { mode: RecipeMode }
          );

      setRecipe(dto);
      setRecipeMode(normalizeRecipeMode((dto as any)?.mode ?? recipeMode));
      setOutputItemId(dto.outputItemId ?? "");
      setOutputUomId(dto.outputUomId ?? "");
      setOutputQuantityStr(String(dto.outputQuantity ?? 1));
      setRows(dto.lines.map((line) => toEditRow(line, uomNameById)));
      setSuccess(tx("Recipe saved successfully."));
    } catch (e) {
      setError(extractApiError(e, "Save failed."));
    } finally {
      setSaving(false);
    }
  }

  function goToBatch() {
    if (!branchId) {
      setError("Select a branch before creating production batches.");
      return;
    }

    if (!recipe?.id) {
      setError("Save the recipe first. Production batches require a saved production recipe.");
      return;
    }

    if (recipeMode !== "production") {
      setError("Direct-sale recipes are consumed at POS sale and do not use production batches.");
      return;
    }

    if (!recipe.menuItemId) {
      setError("Save the production recipe again so the system can link it to its internal production item.");
      return;
    }

    nav(`/production/batches/new?recipeId=${recipe.id}&menuItemId=${recipe.menuItemId}`);
  }

  if (!companyId) {
    return (
      <div className="p-page">
        <div className="p-guard">
          {tx("Select a company to continue.")}
        </div>
      </div>
    );
  }

  return (
    <div className="p-page">
      <ProductionWorkflowBar active="recipe" menuItemId={recipeMode === "production" ? recipe?.menuItemId : effectiveMenuItemId} />

      <section className="p-kitchen-hero" aria-label={tx("Kitchen recipe setup guide")}>
        <div>
          <p className="p-kicker">{tx("Kitchen Recipe Setup")}</p>
          <h1 className="p-title">{tx("Build the recipe the way the kitchen uses it")}</h1>
          <p className="p-subtitle">
            {tx("Choose the menu item, decide whether it is made on sale or produced into stock, then add the ingredients the kitchen consumes.")}
          </p>
        </div>

        <div className="p-kitchen-status-grid">
          <div className="p-kitchen-status">
            <span>{recipeMode === "production" ? tx("Output item") : tx("Menu item")}</span>
            <strong>
              {recipeMode === "production"
                ? selectedOutputItem
                  ? inventoryItemDisplayName(selectedOutputItem)
                  : tx("Not selected")
                : selectedMenuItem?.name ?? tx("Not selected")}
            </strong>
          </div>
          <div className="p-kitchen-status">
            <span>{tx("Recipe type")}</span>
            <strong>{recipeMode === "production" ? tx("Stocked production") : tx("Made to order")}</strong>
          </div>
          <div className="p-kitchen-status">
            <span>{tx("Active ingredients")}</span>
            <strong>{activeLines}</strong>
          </div>
          <div className={`p-kitchen-status ${outputNeedsSetup ? "is-warning" : "is-ready"}`}>
            <span>{tx("Readiness")}</span>
            <strong>{outputNeedsSetup ? tx("Needs output setup") : tx("Ready to edit")}</strong>
          </div>
        </div>
      </section>

      <section className="p-kitchen-steps" aria-label={tx("Recipe workflow")}>
        <div className="p-kitchen-step is-active">
          <span>1</span>
          <div>
            <strong>{tx("Select item")}</strong>
            <small>{recipeMode === "production" ? tx("Pick the inventory item this recipe produces.") : tx("Pick the menu item this recipe controls.")}</small>
          </div>
        </div>
        <div className={`p-kitchen-step ${recipeMode === "production" ? outputItemId : effectiveMenuItemId ? "is-active" : ""}`}>
          <span>2</span>
          <div>
            <strong>{tx("Choose recipe type")}</strong>
            <small>{tx("Made to order or stocked production.")}</small>
          </div>
        </div>
        <div className={`p-kitchen-step ${rows.length > 0 ? "is-active" : ""}`}>
          <span>3</span>
          <div>
            <strong>{tx("Add ingredients")}</strong>
            <small>{tx("Use kitchen quantities and recipe UOMs.")}</small>
          </div>
        </div>
        <div className={`p-kitchen-step ${recipe?.id ? "is-active" : ""}`}>
          <span>4</span>
          <div>
            <strong>{tx("Save and cost")}</strong>
            <small>{tx("Review food cost before production.")}</small>
          </div>
        </div>
      </section>

      <div className="p-card">
        <div className="p-card__head">
          <div>
            <p className="p-card__title">{tx("Recipe Editor")}</p>
            <p className="p-card__subtitle">
              {tx("Define whether this is made-to-order or produced into stock, then configure the ingredients it consumes.")}
            </p>
          </div>

          <div className="p-btn-row">
            <select
              className="p-select"
              value={importSourceMenuItemId}
              onChange={(e) => setImportSourceMenuItemId(e.target.value)}
              disabled={busy || importingRecipe || !effectiveMenuItemId || recipeMode !== "directSale"}
              style={{ minWidth: 230 }}
            >
              <option value="">{tx("Import recipe from...")}</option>
              {importableMenuItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.code ? ` (${m.code})` : ""}
                </option>
              ))}
            </select>
            <button className="p-btn p-btn--outline" onClick={importRecipeFromMenuItem} disabled={busy || importingRecipe || !importSourceMenuItemId || recipeMode !== "directSale"}>
              {importingRecipe ? tx("Importing...") : tx("Import Recipe")}
            </button>
            <button className="p-btn p-btn--outline" onClick={addLine} disabled={busy}>
              {tx("+ Add Line")}
            </button>
            <button className="p-btn p-btn--primary" onClick={save} disabled={busy}>
              {saving ? tx("Saving...") : tx("Save Recipe")}
            </button>
            <button
              className="p-btn p-btn--success"
              onClick={goToBatch}
              disabled={!recipe?.id || saving || recipeMode !== "production"}
            >
              {tx("Create Production Batch")}
            </button>
          </div>
        </div>

        <div className="p-card__body">
          {error && <div className="p-alert p-alert--error"><span className="p-alert__body">{error}</span></div>}
          {success && <div className="p-alert p-alert--success"><span className="p-alert__body">{success}</span></div>}

          {outputNeedsSetup && (
            <div className="p-alert p-alert--warning">
              <span className="p-alert__body">
                <strong>{tx("Output setup required:")}</strong> {tx("select the finished or semi-finished inventory item and the UOM this recipe will receive into stock.")}
              </span>
            </div>
          )}

          <div className="p-alert p-alert--info" style={{ marginBottom: 20 }}>
            <span className="p-alert__body">
              {recipeMode === "directSale" ? (
                <>{tx("Direct-sale recipes consume ingredients during POS sale. They do not receive stock into inventory.")}</>
              ) : (
                <>{tx("Production recipes consume inputs and receive a finished or semi-finished item into inventory.")}</>
              )}
            </span>
          </div>

          {recipeMode === "directSale" && (
            <div className="p-section">
              <div className="p-section__head p-section__head--slate">{tx("Menu Item")}</div>
              <div className="p-section__body">
                <div className="p-field" style={{ maxWidth: 420 }}>
                  <label className="p-field__label">{tx("Select Menu Item")}</label>
                  <select
                    className="p-select"
                    value={effectiveMenuItemId}
                    onChange={(e) => setSelectedMenuItemId(e.target.value)}
                    disabled={loading || !branchId || isDeepLinked}
                  >
                    <option value="">{!branchId ? tx("Select a branch first...") : tx("Select menu item...")}</option>
                    {menuItems.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}{m.code ? ` (${m.code})` : ""}
                      </option>
                    ))}
                  </select>
                  {isDeepLinked && (
                    <span className="p-field__hint">
                      {tx("Opened from menu setup. Open the Recipe Editor from the sidebar to switch items.")}
                    </span>
                  )}
                  {selectedMenuItem && (
                    <span className="p-field__hint">
                      {tx("Current:")} <strong>{selectedMenuItem.name}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="p-section">
            <div className="p-section__head p-section__head--slate">
              {tx("Recipe Mode")}
              <span className="p-section__badge">{tx("Direct sale vs production")}</span>
            </div>

            <div className="p-section__body">
              <div className="p-grid-2">
                <label className={`p-check ${recipeMode === "directSale" ? "p-check--ok" : ""}`}>
                  <input
                    type="radio"
                    name="recipeMode"
                    checked={recipeMode === "directSale"}
                    onChange={() => {
                      setRecipeMode("directSale");
                      setOutputItemId("");
                      setOutputUomId("");
                      setOutputQuantityStr("1");
                    }}
                    disabled={busy}
                  />
                  <span>
                    <strong>{tx("Direct Sale / Made-to-Order")}</strong><br />
                    <small>{tx("Macchiato, cocktail, burger, tea - ingredients are consumed when sold.")}</small>
                  </span>
                </label>

                <label className={`p-check ${recipeMode === "production" ? "p-check--ok" : ""}`}>
                  <input
                    type="radio"
                    name="recipeMode"
                    checked={recipeMode === "production"}
                    onChange={() => {
                      setRecipeMode("production");
                      if (!outputItemId) {
                        const firstOutput = outputItems[0];
                        setOutputItemId(firstOutput?.id ?? "");
                        setOutputUomId(firstOutput ? getOutputUoms(firstOutput)[0]?.uomId ?? "" : "");
                      }
                    }}
                    disabled={busy}
                  />
                  <span>
                    <strong>{tx("Production / Stocked Output")}</strong><br />
                    <small>{tx("Sauce, dough, cake batch - recipe creates inventory stock.")}</small>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {recipeMode === "production" && (
            <div className="p-section">
              <div className="p-section__head p-section__head--green">
                {tx("Output - Stock received into inventory")}
                <span className="p-section__badge" style={{ background: "#dcfce7", color: "#166534" }}>
                  {tx("What this recipe PRODUCES")}
                </span>
              </div>

              <div className="p-section__body">
                <div className="p-grid-2" style={{ gridTemplateColumns: "minmax(260px, 1fr) minmax(180px, 0.7fr) minmax(180px, 0.55fr)" }}>
                  <div className="p-field">
                    <label className="p-field__label">
                      {tx("Finished / Semi-Finished Item")} <span className="p-field__required">*</span>
                    </label>
                    <select
                      className="p-select"
                      value={outputItemId}
                      onChange={(e) => {
                        const nextOutputItem = productionOutputItems.find((item) => item.id === e.target.value) ?? null;
                        setOutputItemId(e.target.value);
                        setOutputUomId(nextOutputItem ? getOutputUoms(nextOutputItem)[0]?.uomId ?? "" : "");
                      }}
                      disabled={busy}
                    >
                      <option value="">
                        {productionOutputItems.length === 0
                          ? tx("No matching output items for this branch")
                          : tx("Select output item...")}
                      </option>
                      {outputItems.map((item) => {
                        const type = normalizeItemType(item.itemType);
                        const typeLabel =
                          type === "finishedgood"
                            ? tx("Finished Good")
                            : type === "semifinished"
                              ? tx("Semi-Finished")
                              : tx("Inventory Item");

                        return (
                          <option key={item.id} value={item.id}>
                            {inventoryItemDisplayName(item)}{item.sku ? ` - ${item.sku}` : ""} [{typeLabel}]
                          </option>
                        );
                      })}
                    </select>
                    <span className="p-field__hint">
                      {tx("Output choices follow the branch: Food for Prod and Pastry for Pastry Production. Assign the item category in Inventory Items if it is missing here.")}
                    </span>
                    {selectedOutputItem && !isProducible(selectedOutputItem) && (
                      <span className="p-field__hint" style={{ color: "var(--p-warning)" }}>
                        {tx("This item is not FinishedGood or SemiFinished - update its type in Inventory Items.")}
                      </span>
                    )}
                  </div>

                  <div className="p-field">
                    <label className="p-field__label">
                      {tx("Output UOM")} <span className="p-field__required">*</span>
                    </label>
                    <select
                      className="p-select"
                      value={outputUomId}
                      onChange={(e) => setOutputUomId(e.target.value)}
                      disabled={busy || !outputItemId}
                    >
                      <option value="">
                        {!outputItemId
                          ? tx("Select output item first...")
                          : outputUomOptions.length === 0
                            ? tx("No UOMs configured for this item")
                            : tx("Select output unit...")}
                      </option>
                      {outputUomOptions.map((u) => (
                        <option key={u.uomId} value={u.uomId}>
                          {uomDisplayName(u, uomNameById)}
                        </option>
                      ))}
                    </select>
                    <span className="p-field__hint">{tx("Production batches receive stock in this configured output unit.")}</span>
                  </div>

                  <div className="p-field">
                    <label className="p-field__label">
                      {tx("Output Quantity")} <span className="p-field__required">*</span>
                    </label>
                    <input
                      className="p-input p-input--num"
                      type="number"
                      min={0.000001}
                      step="0.000001"
                      value={outputQuantityStr}
                      onChange={(e) => setOutputQuantityStr(e.target.value)}
                      disabled={busy}
                    />
                    <span className="p-field__hint">{tx("How many output units this recipe standard produces.")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-section">
            <div className="p-section__head p-section__head--orange">
              {tx("Inputs - Ingredients consumed from stock")}
              <span className="p-section__badge" style={{ background: "#ffedd5", color: "#9a3412" }}>
                {tx("Recipe / Consume UOM only")}
              </span>

              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="p-input"
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                  placeholder={tx("Search ingredients...")}
                  style={{ width: 180, height: 30, fontSize: 12 }}
                />
                <button className="p-btn p-btn--outline p-btn--sm" onClick={addLine} disabled={busy}>
                  {tx("+ Add line")}
                </button>
              </div>
            </div>

            <div className="p-table-wrap">
              <table className="p-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 260 }}>{tx("Ingredient")}</th>
                    <th style={{ width: 190 }}>{tx("Recipe / Consume UOM")}</th>
                    <th className="num" style={{ width: 110 }}>{tx("Qty / Unit")}</th>
                    <th className="num" style={{ width: 110 }}>{tx("Waste %")}</th>
                    <th style={{ width: 80 }}>{tx("Active")}</th>
                    <th>{tx("Notes")}</th>
                    <th className="num" style={{ width: 90 }}>{tx("Actions")}</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-table__empty">
                        {tx("No ingredients yet - click add line to start.")}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const item = itemById.get(row.itemId);
                      const allowedUoms = getRecipeUoms(item);

                      return (
                        <tr key={row._uid}>
                          <td>
                            <select
                              className="p-select"
                              value={row.itemId}
                              onChange={(e) => selectIngredient(row._uid, e.target.value)}
                              disabled={saving}
                            >
                              <option value="">{tx("Select ingredient...")}</option>
                              {ingredientItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {inventoryItemDisplayName(item)}{item.sku ? ` - ${item.sku}` : ""}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <select
                              className="p-select"
                              value={row.uomId}
                              disabled={saving || !row.itemId || allowedUoms.length === 0}
                              onChange={(e) => {
                                const selected = allowedUoms.find((u) => u.uomId === e.target.value);
                                updateRow(row._uid, {
                                  uomId: e.target.value,
                                  uomName: selected ? uomDisplayName(selected, uomNameById) : "",
                                });
                              }}
                            >
                              <option value="">
                                {!row.itemId ? tx("Select ingredient first...") : tx("Select recipe UOM...")}
                              </option>
                              {allowedUoms.map((u) => (
                                <option key={u.uomId} value={u.uomId}>
                                  {uomDisplayName(u, uomNameById)}
                                  {u.toBaseFactor && u.toBaseFactor !== 1 ? ` - ${tx("factor")} ${u.toBaseFactor}` : ""}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <input
                              className="p-input p-input--num"
                              value={row.qtyStr}
                              inputMode="decimal"
                              disabled={saving}
                              onChange={(e) => updateRow(row._uid, { qtyStr: e.target.value })}
                              onBlur={(e) => {
                                const n = Number(e.target.value);
                                if (Number.isFinite(n)) updateRow(row._uid, { qtyStr: String(n) });
                              }}
                            />
                          </td>

                          <td>
                            <input
                              className="p-input p-input--num"
                              value={row.wastePctStr}
                              inputMode="decimal"
                              disabled={saving}
                              onChange={(e) => updateRow(row._uid, { wastePctStr: e.target.value })}
                              onBlur={(e) => {
                                const n = Number(e.target.value);
                                if (Number.isFinite(n)) updateRow(row._uid, { wastePctStr: String(n) });
                              }}
                            />
                          </td>

                          <td>
                            <label className="p-checkbox">
                              <input
                                type="checkbox"
                                checked={row.isActive}
                                onChange={(e) => updateRow(row._uid, { isActive: e.target.checked })}
                                disabled={saving}
                              />
                              {tx("Active")}
                            </label>
                          </td>

                          <td>
                            <input
                              className="p-input"
                              value={row.notes ?? ""}
                              onChange={(e) => updateRow(row._uid, { notes: e.target.value || null })}
                              placeholder={tx("optional")}
                              disabled={saving}
                            />
                          </td>

                          <td style={{ textAlign: "right" }}>
                            <button
                              className="p-btn p-btn--danger p-btn--sm"
                              onClick={() => removeRow(row._uid)}
                              disabled={saving}
                            >
                              {tx("Remove")}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-section__footer">
              <span>{tx("Total:")} {rows.length}</span>
              <span>{tx("Active:")} {activeLines}</span>
              <span>{tx("Inactive:")} {inactiveLines}</span>
            </div>
          </div>

          {hasCostingRecipe && costingMenuItemId && companyId && branchId && (
            <RecipeCostingPanel
              key={JSON.stringify([companyId, branchId, recipeMode, recipe, costingMenuItemId])}
              isProduction={recipeMode === "production"}
              companyId={companyId}
              branchId={branchId}
              menuItemId={costingMenuItemId}
              disabled={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}



