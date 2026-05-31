// src/features/production/pages/RecipeEditorPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { menuItemsApi } from "../api/menuItemsApi";
import { productionRecipesApi } from "../api/recipesApi";
import { fetchInventoryItems, fetchUoms } from "../api/lookups";
import type { InventoryItemLite, UomLite } from "../api/lookups";
import type { MenuItemLite, RecipeDto, UpsertRecipeRequest } from "../types";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import { RecipeCostingPanel } from "../components/RecipeCostingPanel";
import "../production.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type InventoryItemEx = InventoryItemLite & { itemType?: string | number | null };

type RecipeMode = "directSale" | "production";

type EditRow = {
  _uid:         string;
  id?:          string | null;
  itemId:       string;
  uomId:        string;
  uomName:      string;
  qtyStr:       string;
  wastePctStr:  string;
  isActive:     boolean;
  notes:        string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

let uidCounter = 0;
const newUid = () => `row-${++uidCounter}`;

function blankRow(): EditRow {
  return { _uid: newUid(), id: null, itemId: "", uomId: "", uomName: "", qtyStr: "1", wastePctStr: "0", isActive: true, notes: null };
}

function toEditRow(line: RecipeDto["lines"][number], uomNameById: Map<string, string>): EditRow {
  return {
    _uid:        newUid(),
    id:          line.id ?? null,
    itemId:      line.itemId,
    uomId:       line.uomId,
    uomName:     uomNameById.get(line.uomId) ?? line.uomName ?? line.uomId,
    qtyStr:      String(line.qty ?? ""),
    wastePctStr: line.wastePct == null ? "0" : String(line.wastePct),
    isActive:    line.isActive ?? true,
    notes:       line.notes?.trim() || null,
  };
}

function normalizeItemType(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    const map: Record<number, string> = { 0: "select", 1: "ingredient", 2: "stockitem", 3: "packaging", 4: "semifinished", 5: "finishedgood", 6: "rawmaterial" };
    return map[value] ?? String(value);
  }
  return String(value).toLowerCase();
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecipeEditorPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();
  const { id: routeMenuItemId } = useParams<{ id?: string }>();

  const [loading,            setLoading]            = useState(false);
  const [saving,             setSaving]             = useState(false);
  const [error,              setError]              = useState<string | null>(null);
  const [success,            setSuccess]            = useState<string | null>(null);

  const [menuItems,          setMenuItems]          = useState<MenuItemLite[]>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [items,              setItems]              = useState<InventoryItemEx[]>([]);
  const [uoms,               setUoms]               = useState<UomLite[]>([]);
  const [ingredientSearch,   setIngredientSearch]   = useState("");

  const [recipe,        setRecipe]        = useState<RecipeDto | null>(null);
  const [recipeMode,    setRecipeMode]    = useState<RecipeMode>("directSale");
  const [outputItemId,  setOutputItemId]  = useState("");
  const [outputUomId,   setOutputUomId]   = useState("");
  const [rows,          setRows]          = useState<EditRow[]>([]);

  const effectiveMenuItemId = routeMenuItemId ?? selectedMenuItemId;
  const isDeepLinked = Boolean(routeMenuItemId);
  const busy = loading || saving;

  const uomNameById = useMemo(() => new Map(uoms.map((u) => [u.id, u.name ?? u.code])), [uoms]);
  const itemById    = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const selectedMenuItem = useMemo(
    () => menuItems.find((m) => m.id === effectiveMenuItemId) ?? null,
    [menuItems, effectiveMenuItemId]
  );

  const outputItems = useMemo(() => {
    const hasTypes = items.some((i) => i.itemType != null);
    if (!hasTypes) return items;
    const list = items.filter(isProducible);
    return list.length > 0 ? list : items;
  }, [items]);

  const ingredientItems = useMemo(() => {
    const hasTypes = items.some((i) => i.itemType != null);
    if (!hasTypes) return items;
    return items.filter((i) => normalizeItemType(i.itemType) !== "finishedgood");
  }, [items]);

  const selectedOutputItem = useMemo(
    () => items.find((i) => i.id === outputItemId) ?? null,
    [items, outputItemId]
  );

  const activeLines   = useMemo(() => rows.filter((r) => r.isActive).length, [rows]);
  const inactiveLines = rows.length - activeLines;
  const outputNeedsSetup = recipeMode === "production" && (!outputItemId || !outputUomId);

  // ── Load catalog (inventory + UOMs) ────────────────────────────────────────

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    Promise.all([
      fetchInventoryItems(companyId, branchId ?? "", ""),
      fetchUoms(companyId),
    ]).then(([inv, uomRows]) => {
      if (cancelled) return;
      setItems(inv as InventoryItemEx[]);
      setUoms(uomRows);
    }).catch((e) => {
      if (!cancelled) setError(extractApiError(e, "Failed to load inventory catalog."));
    });

    return () => { cancelled = true; };
  }, [companyId, branchId]);

  // ── Load menu items ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!companyId || !branchId) return;
    let cancelled = false;

    setLoading(true);
    menuItemsApi.list(companyId, branchId)
      .then((list) => {
        if (cancelled) return;
        setMenuItems(list);
        if (!routeMenuItemId && list.length > 0) {
          setSelectedMenuItemId((prev) => list.some((m: MenuItemLite) => m.id === prev) ? prev : list[0].id);
        }
      })
      .catch((e) => { if (!cancelled) setError(extractApiError(e, "Failed to load menu items.")); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [companyId, branchId, routeMenuItemId]);

  // ── Debounced ingredient search ────────────────────────────────────────────

  useEffect(() => {
    if (!companyId || !ingredientSearch.trim()) return;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      fetchInventoryItems(companyId, branchId ?? "", ingredientSearch)
        .then((inv) => { if (!cancelled) setItems(inv as InventoryItemEx[]); })
        .catch(() => { /* keep previous catalog */ });
    }, 300);

    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [companyId, branchId, ingredientSearch]);

  // ── Load recipe ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!companyId || !effectiveMenuItemId) return;
    let cancelled = false;

    setError(null); setSuccess(null);

    productionRecipesApi.getByMenuItem(companyId, effectiveMenuItemId)
      .then((dto) => {
        if (cancelled) return;
        setRecipe(dto);
        setRecipeMode(((dto as any)?.mode ?? "directSale") as RecipeMode);
        setOutputItemId(dto?.outputItemId ?? "");
        setOutputUomId(dto?.outputUomId ?? "");
        setRows((dto?.lines ?? []).map((line) => toEditRow(line, uomNameById)));
      })
      .catch((e: any) => {
        if (cancelled) return;
        const status = e?.response?.status ?? e?.status;
        if (status === 404) { setRecipe(null); setRecipeMode("directSale"); setOutputItemId(""); setOutputUomId(""); setRows([]); }
        else setError(extractApiError(e, "Failed to load recipe."));
      });

    return () => { cancelled = true; };
  }, [companyId, effectiveMenuItemId, uomNameById]);

  // ── Row operations ─────────────────────────────────────────────────────────

  const addLine       = () => setRows((prev) => [blankRow(), ...prev]);
  const removeRow     = (uid: string) => setRows((prev) => prev.filter((r) => r._uid !== uid));
  const updateRow     = (uid: string, patch: Partial<EditRow>) =>
    setRows((prev) => prev.map((r) => r._uid === uid ? { ...r, ...patch } : r));

  const selectIngredient = (uid: string, itemId: string) => {
    const item = itemById.get(itemId);
    updateRow(uid, {
      itemId,
      uomId:   item?.baseUomId ?? "",
      uomName: item?.baseUomName ?? uomNameById.get(item?.baseUomId ?? "") ?? "",
    });
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): string | null {
    if (!effectiveMenuItemId) return "Menu item is required.";

    if (recipeMode === "production") {
      if (!outputItemId) return "Output item is required for production recipes.";
      if (!outputUomId)  return "Output UOM is required for production recipes.";
    }

    if (!rows.length) return "Add at least one ingredient line.";

    const seen = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const label = `Ingredient line ${i + 1}`;
      if (!row.itemId) return `${label}: ingredient is required.`;
      if (!row.uomId)  return `${label}: UOM missing — re-select the ingredient.`;
      const qty = Number(row.qtyStr);
      if (!Number.isFinite(qty) || qty <= 0) return `${label}: qty must be greater than zero.`;
      const waste = Number(row.wastePctStr);
      if (!Number.isFinite(waste) || waste < 0 || waste > 100) return `${label}: waste % must be 0–100.`;
      const key = `${row.itemId}::${row.uomId}`;
      if (seen.has(key)) return `${label}: duplicate ingredient.`;
      seen.add(key);
    }
    return null;
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function save() {
    if (!companyId || !effectiveMenuItemId) return;
    setError(null); setSuccess(null);
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    try {
      const body = {
        menuItemId:   effectiveMenuItemId,
        mode:         recipeMode,
        notes:        recipe?.notes ?? null,
        isActive:     recipe?.isActive ?? true,
        outputItemId: recipeMode === "production" ? outputItemId || null : null,
        outputUomId:  recipeMode === "production" ? outputUomId || null : null,
        lines: rows.map((row) => ({
          id:              null,
          itemId:          row.itemId,
          uomId:           row.uomId,
          qtyPerMenuUnit:  Number(row.qtyStr),
          wastePct:        Number(row.wastePctStr),
          isActive:        row.isActive,
          notes:           row.notes ?? null,
        })),
      };

      const dto = await productionRecipesApi.upsertByMenuItem(companyId, effectiveMenuItemId, body as UpsertRecipeRequest & { mode: RecipeMode });
      setRecipe(dto);
      setRecipeMode(((dto as any)?.mode ?? recipeMode) as RecipeMode);
      setOutputItemId(dto.outputItemId ?? "");
      setOutputUomId(dto.outputUomId ?? "");
      setRows(dto.lines.map((line) => toEditRow(line, uomNameById)));
      setSuccess("Recipe saved successfully.");
    } catch (e) {
      setError(extractApiError(e, "Save failed."));
    } finally {
      setSaving(false);
    }
  }

  function goToBatch() {
    if (!effectiveMenuItemId) { setError("Select or save a menu item first."); return; }
    if (!recipe?.id) { setError("Save the recipe first. Production batches require a saved production recipe."); return; }
    if (recipeMode !== "production") {
      setError("Direct-sale recipes are consumed at POS sale and do not use production batches.");
      return;
    }
    nav(`/production/batches/new?recipeId=${recipe.id}&menuItemId=${effectiveMenuItemId}`);
  }

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!companyId) {
    return (
      <div className="p-page">
        <div className="p-guard"><div className="p-guard__icon">⚙</div>Select a company to continue.</div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-page">
      <ProductionWorkflowBar active="recipe" menuItemId={effectiveMenuItemId} />

      {/* Card */}
      <div className="p-card">
        <div className="p-card__head">
          <div>
            <p className="p-card__title">Recipe Editor</p>
            <p className="p-card__subtitle">
              Define whether the menu item is made-to-order or produced into stock, then configure the ingredients it consumes.
            </p>
          </div>
          <div className="p-btn-row">
            <button className="p-btn p-btn--outline" onClick={addLine} disabled={busy}>+ Add Line</button>
            <button className="p-btn p-btn--primary" onClick={save}    disabled={busy}>
              {saving ? "Saving…" : "Save Recipe"}
            </button>
            <button className="p-btn p-btn--success" onClick={goToBatch} disabled={!recipe?.id || saving || recipeMode !== "production"}>
              Create Production Batch →
            </button>
          </div>
        </div>

        <div className="p-card__body">
          {/* Alerts */}
          {error   && <div className="p-alert p-alert--error"><span className="p-alert__body">{error}</span></div>}
          {success && <div className="p-alert p-alert--success"><span className="p-alert__body">{success}</span></div>}
          {outputNeedsSetup && (
            <div className="p-alert p-alert--warning">
              <span className="p-alert__body">
                <strong>Output setup required:</strong> production recipes must choose the inventory item produced
                and its output UOM before saving.
              </span>
            </div>
          )}
          <div className="p-alert p-alert--info" style={{ marginBottom: 20 }}>
            <span className="p-alert__body">
              {recipeMode === "directSale" ? (
                <>Direct-sale recipes consume ingredients during POS sale. They do <strong>not</strong> receive stock into inventory.</>
              ) : (
                <>Production recipes consume inputs and receive a finished or semi-finished item into inventory.</>
              )}
            </span>
          </div>

          {/* ── Section 1: Menu Item ── */}
          <div className="p-section">
            <div className="p-section__head p-section__head--slate">📋 Menu Item</div>
            <div className="p-section__body">
              <div className="p-field" style={{ maxWidth: 420 }}>
                <label className="p-field__label">Select Menu Item</label>
                <select
                  className="p-select"
                  value={effectiveMenuItemId}
                  onChange={(e) => setSelectedMenuItemId(e.target.value)}
                  disabled={loading || !branchId || isDeepLinked}
                >
                  <option value="">{!branchId ? "Select a branch first…" : "Select menu item…"}</option>
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}{m.code ? ` (${m.code})` : ""}</option>
                  ))}
                </select>
                {isDeepLinked && (
                  <span className="p-field__hint">
                    Opened from menu setup. Open the Recipe Editor from the sidebar to switch items.
                  </span>
                )}
                {selectedMenuItem && (
                  <span className="p-field__hint">
                    Current: <strong>{selectedMenuItem.name}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 2: Recipe Mode ── */}
          <div className="p-section">
            <div className="p-section__head p-section__head--slate">
              ⚙ RECIPE MODE
              <span className="p-section__badge">
                Direct sale vs production
              </span>
            </div>
            <div className="p-section__body">
              <div className="p-grid-2">
                <label className={`p-check ${recipeMode === "directSale" ? "p-check--ok" : ""}`}>
                  <input
                    type="radio"
                    name="recipeMode"
                    checked={recipeMode === "directSale"}
                    onChange={() => { setRecipeMode("directSale"); setOutputItemId(""); setOutputUomId(""); }}
                    disabled={busy}
                  />
                  <span>
                    <strong>Direct Sale / Made-to-Order</strong><br />
                    <small>Macchiato, cocktail, burger, tea — ingredients are consumed when sold.</small>
                  </span>
                </label>
                <label className={`p-check ${recipeMode === "production" ? "p-check--ok" : ""}`}>
                  <input
                    type="radio"
                    name="recipeMode"
                    checked={recipeMode === "production"}
                    onChange={() => setRecipeMode("production")}
                    disabled={busy}
                  />
                  <span>
                    <strong>Production / Stocked Output</strong><br />
                    <small>Sauce, dough, cake batch — recipe creates inventory stock.</small>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* ── Section 3: Output ── */}
          {recipeMode === "production" && (
          <div className="p-section">
            <div className="p-section__head p-section__head--green">
              ▲ OUTPUT — Stock received into inventory
              <span className="p-section__badge" style={{ background: "#dcfce7", color: "#166534" }}>
                What this recipe PRODUCES
              </span>
            </div>
            <div className="p-section__body">
              <div className="p-alert p-alert--success" style={{ marginBottom: 14 }}>
                <span className="p-alert__body">
                  <strong>Output setup:</strong> select the Finished Good or Semi-Finished inventory
                  item that production will receive when this recipe is executed.
                </span>
              </div>

              <div className="p-grid-2">
                <div className="p-field">
                  <label className="p-field__label">
                    Finished / Semi-Finished Item <span className="p-field__required">*</span>
                  </label>
                  <select
                    className="p-select"
                    value={outputItemId}
                    onChange={(e) => setOutputItemId(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">{items.length === 0 ? "Loading inventory items…" : "Select output item…"}</option>
                    {outputItems.map((item) => {
                      const type = normalizeItemType(item.itemType);
                      const typeLabel = type === "finishedgood" ? "Finished Good" : type === "semifinished" ? "Semi-Finished" : "Inventory Item";
                      return (
                        <option key={item.id} value={item.id}>
                          {item.name}{item.sku ? ` • ${item.sku}` : ""} [{typeLabel}]
                        </option>
                      );
                    })}
                  </select>
                  {selectedOutputItem && !isProducible(selectedOutputItem) && (
                    <span className="p-field__hint" style={{ color: "var(--p-warning)" }}>
                      This item is not FinishedGood or SemiFinished — update its type in Inventory Items.
                    </span>
                  )}
                </div>

                <div className="p-field">
                  <label className="p-field__label">
                    Output UOM <span className="p-field__required">*</span>
                  </label>
                  <select
                    className="p-select"
                    value={outputUomId}
                    onChange={(e) => setOutputUomId(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">{uoms.length === 0 ? "Loading UOMs…" : "Select unit…"}</option>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>{u.name ?? u.code}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          )}

          {/* ── Section 4: Inputs ── */}
          <div className="p-section">
            <div className="p-section__head p-section__head--orange">
              ▼ INPUTS — Ingredients consumed from stock
              <span className="p-section__badge" style={{ background: "#ffedd5", color: "#9a3412" }}>
                What this recipe CONSUMES
              </span>

              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="p-input"
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                  placeholder="Search ingredients…"
                  style={{ width: 180, height: 30, fontSize: 12 }}
                />
                <button className="p-btn p-btn--outline p-btn--sm" onClick={addLine} disabled={busy}>
                  + Add line
                </button>
              </div>
            </div>

            <div className="p-table-wrap">
              <table className="p-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 260 }}>Ingredient</th>
                    <th style={{ width: 110 }}>Base UOM</th>
                    <th className="num" style={{ width: 110 }}>Qty / Unit</th>
                    <th className="num" style={{ width: 110 }}>Waste %</th>
                    <th style={{ width: 80 }}>Active</th>
                    <th>Notes</th>
                    <th className="num" style={{ width: 90 }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} className="p-table__empty">No ingredients yet — click "+ Add line" to start.</td></tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row._uid}>
                        <td>
                          <select
                            className="p-select"
                            value={row.itemId}
                            onChange={(e) => selectIngredient(row._uid, e.target.value)}
                            disabled={saving}
                          >
                            <option value="">Select ingredient…</option>
                            {ingredientItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}{item.sku ? ` · ${item.sku}` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="p-input p-input--locked"
                            value={row.uomName || row.uomId || "—"}
                            readOnly
                            disabled
                            title="Locked to base unit of selected ingredient"
                          />
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
                            Active
                          </label>
                        </td>
                        <td>
                          <input
                            className="p-input"
                            value={row.notes ?? ""}
                            onChange={(e) => updateRow(row._uid, { notes: e.target.value || null })}
                            placeholder="optional"
                            disabled={saving}
                          />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button className="p-btn p-btn--danger p-btn--sm" onClick={() => removeRow(row._uid)} disabled={saving}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-section__footer">
              <span>Total: {rows.length}</span>
              <span>Active: {activeLines}</span>
              <span>Inactive: {inactiveLines}</span>
            </div>
          </div>

          {/* ── Costing panel ── */}
          {effectiveMenuItemId && companyId && branchId && (
            <RecipeCostingPanel
              companyId={companyId}
              branchId={branchId}
              menuItemId={effectiveMenuItemId}
              disabled={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}