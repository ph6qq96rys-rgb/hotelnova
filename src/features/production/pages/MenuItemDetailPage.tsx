// src/features/production/pages/MenuItemDetailPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { menuItemsApi } from "../api/menuItemsApi";
import { productionRecipesApi } from "../api/recipesApi";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import "./menu-item-detail.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type MenuItemVm = {
  id: string;
  name: string;
  code?: string | null;
  categoryName?: string | null;
  categoryId?: string | null;
  sellingPrice?: number | null;
  isActive?: boolean;
};

type RecipeMode = "directSale" | "production";

type RecipeStatus = {
  id?: string | null;
  mode?: RecipeMode | null;
  isActive?: boolean;
  outputItemId?: string | null;
  outputUomId?: string | null;
  lines?: unknown[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractApiError(e: unknown, fallback: string): string {
  const err = e as any;
  const data = err?.response?.data;
  if (!data) return err?.message ?? fallback;
  if (typeof data === "string") return data;
  return data?.message ?? data?.title ?? err?.message ?? fallback;
}

function formatMoney(value?: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FLOW_NOTES = [
  { title: "Menu Item",        text: "Commercial product sold to customers." },
  { title: "Direct Sale",      text: "Consumes ingredients during POS sale; no finished stock is received." },
  { title: "Production",       text: "Optional mode for stocked outputs, batches, and semi-finished goods." },
  { title: "Menu Engineering", text: "Analyzes sales, margin, popularity, and food cost." },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: "var(--p-r-md)", border: "1px solid var(--p-border)", background: "var(--p-surface-2)" }}>
      <div style={{ fontFamily: "var(--p-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--p-text-muted)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--p-text)", wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

function CheckRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`p-check ${ok ? "p-check--ok" : "p-check--warn"}`}>
      <span className="p-check__icon">{ok ? "✓" : "!"}</span>
      <span>{text}</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MenuItemDetailPage() {
  const nav = useNavigate();
  const { id: menuItemId } = useParams<{ id?: string }>();
  const { companyId, branchId } = useAppScope();

  const [menuItem, setMenuItem] = useState<MenuItemVm | null>(null);
  const [recipe,   setRecipe]   = useState<RecipeStatus | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const recipeMode = (recipe?.mode ?? "directSale") as RecipeMode;
  const recipeConfigured = Boolean(recipe?.id);
  const outputConfigured = recipeMode === "production"
    ? Boolean(recipe?.outputItemId && recipe?.outputUomId)
    : true;
  const ingredientCount = recipe?.lines?.length ?? 0;
  const operationalReady = recipeConfigured && outputConfigured && ingredientCount > 0 && recipe?.isActive !== false;

  const statusLabel = useMemo(() => {
    if (!recipeConfigured) return "Recipe Missing";
    if (ingredientCount === 0) return "Inputs Missing";
    if (recipe?.isActive === false) return "Recipe Inactive";
    if (recipeMode === "directSale") return "POS Ready";
    if (!outputConfigured) return "Output Missing";
    return "Production Ready";
  }, [recipeConfigured, ingredientCount, recipe?.isActive, recipeMode, outputConfigured]);

  useEffect(() => {
    if (!companyId || !branchId || !menuItemId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    async function load() {
      try {
        const [items, recipeResult] = await Promise.allSettled([
          menuItemsApi.list(companyId!, branchId!),
          productionRecipesApi.getByMenuItem(companyId!, menuItemId!),
        ]);

        if (cancelled) return;

        if (items.status === "fulfilled") {
          const found = items.value.find((x: any) => x.id === menuItemId) ?? null;
          setMenuItem(found as MenuItemVm | null);
        }

        if (recipeResult.status === "fulfilled") {
          setRecipe(recipeResult.value);
        } else {
          const status = (recipeResult.reason as any)?.response?.status;
          if (status !== 404) setError(extractApiError(recipeResult.reason, "Failed to load recipe."));
          setRecipe(null);
        }
      } catch (e) {
        if (!cancelled) setError(extractApiError(e, "Failed to load menu item."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [companyId, branchId, menuItemId]);

  if (!companyId || !branchId || !menuItemId) {
    return (
      <div className="p-page">
        <div className="p-guard"><div className="p-guard__icon">⚙</div>Company, branch, or menu item context is missing.</div>
      </div>
    );
  }

  return (
    <div className="p-page" style={{ maxWidth: 1180 }}>
      <ProductionWorkflowBar active="menu" menuItemId={menuItemId} />

      {/* Header */}
      <div className="p-page-header">
        <div>
          <p className="p-kicker">Production Workspace</p>
          <h1 className="p-title">{menuItem?.name ?? "Menu Item Detail"}</h1>
          <p className="p-subtitle">
            Commercial menu item detail. Recipe and manufacturing rules are managed in the Recipe Editor.
          </p>
        </div>
        <div className="p-btn-row">
          <button className="p-btn p-btn--outline" onClick={() => nav(-1)}>← Back</button>
          <button
            className="p-btn p-btn--accent"
            onClick={() => nav(`/production/menu/items/${menuItemId}/recipe`)}
          >
            Configure Recipe →
          </button>
        </div>
      </div>

      {error && (
        <div className="p-alert p-alert--error">
          <span className="p-alert__body">{error}</span>
          <button className="p-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="p-card"><div className="p-card__body" style={{ color: "var(--p-text-muted)" }}>Loading menu item…</div></div>
      ) : (
        <>
          {/* Identity + Setup cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Commercial identity */}
            <div className="p-card">
              <div className="p-card__head">
                <div>
                  <p className="p-card__title">Commercial Identity</p>
                  <p className="p-card__subtitle">Customer-facing sales configuration.</p>
                </div>
                <span className={`p-badge ${menuItem?.isActive === false ? "p-badge--inactive" : "p-badge--active"}`}>
                  {menuItem?.isActive === false ? "Inactive" : "Active"}
                </span>
              </div>
              <div className="p-card__body">
                <div className="p-grid-2">
                  <Metric label="Name"          value={menuItem?.name ?? "—"} />
                  <Metric label="Code / SKU"    value={menuItem?.code ?? "—"} />
                  <Metric label="Category"      value={menuItem?.categoryName ?? menuItem?.categoryId ?? "—"} />
                  <Metric label="Selling Price" value={formatMoney(menuItem?.sellingPrice)} />
                </div>
              </div>
            </div>

            {/* Production setup */}
            <div className="p-card">
              <div className="p-card__head">
                <div>
                  <p className="p-card__title">Recipe Operating Mode</p>
                  <p className="p-card__subtitle">Direct-sale items are consumed at POS; production items create stock through batches.</p>
                </div>
                <span
                  className="p-badge"
                  style={operationalReady
                    ? { background: "var(--p-success-bg)", color: "var(--p-success)" }
                    : { background: "var(--p-warning-bg)", color: "var(--p-warning)" }
                  }
                >
                  {statusLabel}
                </span>
              </div>
              <div className="p-card__body">
                <div className="p-checklist">
                  <CheckRow ok={recipeConfigured} text="Recipe exists" />
                  <CheckRow ok={true} text={`Mode: ${recipeMode === "production" ? "Production / Stocked Output" : "Direct Sale / Made-to-Order"}`} />
                  {recipeMode === "production" && (
                    <CheckRow ok={outputConfigured} text="Output item and UOM assigned" />
                  )}
                  <CheckRow ok={ingredientCount > 0} text={`${ingredientCount} input ingredient line(s)`} />
                  <CheckRow ok={recipe?.isActive !== false} text="Recipe active" />
                </div>

                <div className="p-action-panel">
                  <div>
                    <div className="p-action-panel__title">Next operational step</div>
                    <p className="p-action-panel__text">
                      {recipeMode === "production"
                        ? "Configure recipe output and inputs before creating production batches."
                        : "Direct-sale recipe is ready for POS consumption once ingredients are configured."}
                    </p>
                  </div>
                  <button
                    className="p-btn p-btn--accent"
                    onClick={() => nav(`/production/menu/items/${menuItemId}/recipe`)}
                  >
                    Open Recipe Editor
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Workflow boundary */}
          <div className="p-card">
            <div className="p-card__head">
              <div>
                <p className="p-card__title">Workflow Boundary</p>
                <p className="p-card__subtitle">This page intentionally does not edit recipe lines.</p>
              </div>
            </div>
            <div className="p-card__body">
              <div className="p-flow-notes">
                {FLOW_NOTES.map((note) => (
                  <div key={note.title} className="p-flow-note">
                    <div className="p-flow-note__title">{note.title}</div>
                    <div className="p-flow-note__text">{note.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}