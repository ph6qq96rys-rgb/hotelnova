// src/features/production/pages/MenuItemCreatePage.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { menuItemsApi } from "../api/menuItemsApi";
import type { CreateMenuItemRequest } from "../types";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import "../production.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type MenuCategoryDto = {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeList<T>(res: T[] | { items?: T[] }): T[] {
  return Array.isArray(res) ? res : (res.items ?? []);
}

function extractApiError(err: unknown): string {
  const e = err as any;
  const data = e?.response?.data;
  if (!data) return e?.message ?? "Request failed.";
  if (typeof data === "string") return data;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.title === "string") return data.title;
  const errors = data?.errors;
  if (errors && typeof errors === "object") {
    const key = Object.keys(errors)[0];
    if (key && Array.isArray(errors[key]) && errors[key][0]) return String(errors[key][0]);
  }
  return "Request failed.";
}

const SETUP_STEPS = [
  "Create the customer-facing menu item",
  "Configure production recipe next",
  "Select output inventory item in Recipe Editor",
  "Create production batches after recipe is saved",
];

const HINTS = [
  { label: "Step 1", text: "Create the menu item as the commercial product sold to customers." },
  { label: "Step 2", text: "Configure the recipe — output item, inputs, and UOM." },
  { label: "Step 3", text: "Create production batches from saved recipes and post inventory." },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function MenuItemCreatePage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [name,       setName]       = useState("");
  const [code,       setCode]       = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isActive,   setIsActive]   = useState(true);

  const [cats,        setCats]        = useState<MenuCategoryDto[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catsError,   setCatsError]   = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const trimmedName = useMemo(() => name.trim(), [name]);
  const canSave = Boolean(companyId && branchId && trimmedName && !saving);

  // Load categories
  useEffect(() => {
    if (!companyId || !branchId) return;
    let cancelled = false;

    setCatsLoading(true);
    setCatsError(null);

    menuItemsApi
      .listCategories(companyId, branchId)
      .then((res) => {
        if (cancelled) return;
        const rows = normalizeList<MenuCategoryDto>(res)
          .filter((x) => x.isActive !== false)
          .sort((a, b) => a.name.localeCompare(b.name));
        setCats(rows);
      })
      .catch((e) => {
        if (!cancelled) { setCats([]); setCatsError(extractApiError(e)); }
      })
      .finally(() => { if (!cancelled) setCatsLoading(false); });

    return () => { cancelled = true; };
  }, [companyId, branchId]);

  // Save
  async function onSave() {
    if (!companyId) return setError("Select a company first.");
    if (!branchId)  return setError("Select a branch first.");
    if (!trimmedName) return setError("Menu item name is required.");

    const payload: CreateMenuItemRequest = {
      name: trimmedName,
      code: code.trim() || null,
      categoryId: categoryId || null,
      outputUomId: null,
      isActive,
    };

    setSaving(true);
    setError(null);

    try {
      const res = await menuItemsApi.create(companyId, branchId, payload);
      if (!res?.id) throw new Error("API did not return an ID.");
      nav(`/production/menu/items/${res.id}/recipe`);
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setSaving(false);
    }
  }

  if (!companyId || !branchId) {
    return (
      <div className="p-page">
        <div className="p-guard"><div className="p-guard__icon">⚙</div>Select a company and branch to continue.</div>
      </div>
    );
  }

  return (
    <div className="p-page" style={{ maxWidth: 980 }}>
      <ProductionWorkflowBar active="menu" />

      {/* Header */}
      <div className="p-page-header">
        <div>
          <p className="p-kicker">Production Workspace</p>
          <h1 className="p-title">Menu Item Commercial Setup</h1>
          <p className="p-subtitle">
            Define the customer-facing product first. Recipe, output inventory item,
            costing, and production rules are configured in the next step.
          </p>
        </div>
        <button className="p-btn p-btn--ghost" onClick={() => nav(-1)} disabled={saving}>
          ← Cancel
        </button>
      </div>

      {error && (
        <div className="p-alert p-alert--error">
          <span className="p-alert__body">{error}</span>
          <button className="p-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Form card */}
      <div className="p-card">
        <div className="p-card__head">
          <div>
            <p className="p-card__title">Commercial Identity</p>
            <p className="p-card__subtitle">This item appears in the POS and sales reports.</p>
          </div>
          <span className={`p-badge ${isActive ? "p-badge--active" : "p-badge--inactive"}`}>
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="p-card__body">
          <div className="p-grid-2" style={{ marginBottom: 20 }}>
            {/* Name */}
            <div className="p-field">
              <label className="p-field__label">
                Menu Item Name <span className="p-field__required">*</span>
              </label>
              <input
                className="p-input"
                value={name}
                autoFocus
                onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
                placeholder="e.g. Chicken Shawarma Wrap"
                disabled={saving}
              />
            </div>

            {/* Code */}
            <div className="p-field">
              <label className="p-field__label">Code / SKU</label>
              <input
                className="p-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Optional"
                disabled={saving}
              />
            </div>

            {/* Category */}
            <div className="p-field">
              <label className="p-field__label">Category</label>
              <select
                className="p-select"
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value || null)}
                disabled={saving || catsLoading}
              >
                <option value="">{catsLoading ? "Loading…" : "— No category —"}</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.name} (${c.code})` : c.name}
                  </option>
                ))}
              </select>
              {catsError && <span className="p-field__error">{catsError}</span>}
            </div>
          </div>

          {/* Setup status */}
          <div className="p-card" style={{ margin: 0 }}>
            <div className="p-card__head">
              <div>
                <p className="p-card__title">Production Setup Status</p>
                <p className="p-card__subtitle">This item becomes production-ready only after recipe and output setup.</p>
              </div>
            </div>
            <div className="p-card__body" style={{ paddingTop: 14, paddingBottom: 14 }}>
              <div className="p-steps">
                {SETUP_STEPS.map((text, i) => (
                  <div key={text} className="p-step">
                    <span className="p-step__no">{i + 1}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Responsibility note */}
          <div className="p-alert p-alert--warning" style={{ marginTop: 14, marginBottom: 0 }}>
            <span className="p-alert__body">
              <strong>Responsibility boundary:</strong> Menu Item manages commercial identity.
              Recipe Editor manages production output, inputs, costing, and manufacturability.
            </span>
          </div>

          {/* Checkboxes */}
          <div className="p-grid-2" style={{ marginTop: 16 }}>
            <label className="p-checkbox">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={saving} />
              <span>Active — appears in production and sales flows</span>
            </label>
            <label className="p-checkbox">
              <input type="checkbox" checked readOnly />
              <span>Recipe controlled — configured in next step</span>
            </label>
            <label className="p-checkbox">
              <input type="checkbox" checked readOnly />
              <span>Inventory impact handled through recipe and batch posting</span>
            </label>
            <label className="p-checkbox">
              <input type="checkbox" checked readOnly />
              <span>Production-ready after output item and UOM are assigned</span>
            </label>
          </div>
        </div>

        <div className="p-card__footer">
          <button className="p-btn p-btn--outline" onClick={() => nav(-1)} disabled={saving}>
            Cancel
          </button>
          <button className="p-btn p-btn--accent p-btn--lg" onClick={onSave} disabled={!canSave}>
            {saving ? "Creating…" : "Create & Continue to Recipe →"}
          </button>
        </div>
      </div>

      {/* Hint strip */}
      <div className="p-hint-strip">
        {HINTS.map((h) => (
          <div key={h.label} className="p-hint">
            <div className="p-hint__label">{h.label}</div>
            <div className="p-hint__text">{h.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}