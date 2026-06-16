// src/features/production/pages/MenuCategoriesPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import { menuCategoriesApi, type UpsertMenuCategoryRequest } from "../api/menuCategoriesApi";
import type { MenuCategoryDto, StockLocationDto } from "../types";
import "../production.css";

function normalizeList<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : res.items ?? [];
}

function extractApiError(e: unknown, fallback = "Request failed."): string {
  const err = e as any;
  const data = err?.response?.data;
  if (!data) return err?.message ?? fallback;
  if (typeof data === "string") return data;
  return data?.message ?? data?.title ?? err?.message ?? fallback;
}

function emptyForm() {
  return {
    id: "",
    name: "",
    code: "",
    isActive: true,
    defaultConsumptionLocationId: "",
  };
}

type FormState = ReturnType<typeof emptyForm>;

export default function MenuCategoriesPage() {
  const { companyId, branchId } = useAppScope();

  const [categories, setCategories] = useState<MenuCategoryDto[]>([]);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const editing = Boolean(form.id);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const canSave = Boolean(
    companyId &&
      branchId &&
      form.name.trim() &&
      !saving
  );

  async function load() {
    if (!companyId || !branchId) return;

    setLoading(true);
    setError(null);

    try {
      const [catRes, locRes] = await Promise.all([
        menuCategoriesApi.list(companyId, branchId),
        menuCategoriesApi.listStockLocations(companyId, branchId),
      ]);

      setCategories(normalizeList<MenuCategoryDto>(catRes));
      setLocations(
        normalizeList<StockLocationDto>(locRes)
          .filter((x) => x.isActive !== false)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (e) {
      setError(extractApiError(e, "Failed to load menu categories."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, branchId]);

  function edit(row: MenuCategoryDto) {
    setNotice(null);
    setError(null);

    setForm({
      id: row.id,
      name: row.name ?? "",
      code: row.code ?? "",
      isActive: row.isActive !== false,
      defaultConsumptionLocationId: row.defaultConsumptionLocationId ?? "",
    });
  }

  function reset() {
    setForm(emptyForm());
    setError(null);
    setNotice(null);
  }

  async function save() {
    if (!companyId) return setError("Select a company first.");
    if (!branchId) return setError("Select a branch first.");
    if (!form.name.trim()) return setError("Category name is required.");

    const payload: UpsertMenuCategoryRequest = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      isActive: form.isActive,
      defaultConsumptionLocationId: form.defaultConsumptionLocationId || null,
    };

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      if (editing) {
        await menuCategoriesApi.update(companyId, branchId, form.id, payload);
        setNotice("Menu category updated.");
      } else {
        await menuCategoriesApi.create(companyId, branchId, payload);
        setNotice("Menu category created.");
      }

      reset();
      await load();
    } catch (e) {
      setError(extractApiError(e, "Failed to save menu category."));
    } finally {
      setSaving(false);
    }
  }

  if (!companyId || !branchId) {
    return (
      <div className="p-page">
        <div className="p-guard">
          <div className="p-guard__icon">⚙</div>
          Select a company and branch to continue.
        </div>
      </div>
    );
  }

  return (
    <div className="p-page" style={{ maxWidth: 1180 }}>
      <ProductionWorkflowBar active="menu" />

      <div className="p-page-header">
        <div>
          <p className="p-kicker">Menu Configuration</p>
          <h1 className="p-title">Menu Categories</h1>
          <p className="p-subtitle">
            Configure category defaults such as Kitchen, Bar, Coffee Bar, or Bakery consumption locations.
            Menu items inherit these defaults unless individually overridden.
          </p>
        </div>

        <button className="p-btn p-btn--outline" onClick={() => void load()} disabled={loading || saving}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-alert p-alert--error">
          <span className="p-alert__body">{error}</span>
          <button className="p-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {notice && (
        <div className="p-alert p-alert--success">
          <span className="p-alert__body">{notice}</span>
          <button className="p-dismiss" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 16 }}>
        <div className="p-card">
          <div className="p-card__head">
            <div>
              <p className="p-card__title">
                {editing ? "Edit Category" : "Create Category"}
              </p>
              <p className="p-card__subtitle">
                Assign a default stock location for POS consumption.
              </p>
            </div>

            <span className={`p-badge ${form.isActive ? "p-badge--active" : "p-badge--inactive"}`}>
              {form.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="p-card__body">
            <div className="p-field">
              <label className="p-field__label">Category Name *</label>
              <input
                className="p-input"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                disabled={saving}
                placeholder="e.g. Foods, Drinks, Coffee"
              />
            </div>

            <div className="p-field">
              <label className="p-field__label">Code</label>
              <input
                className="p-input"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                disabled={saving}
                placeholder="Optional"
              />
            </div>

            <div className="p-field">
              <label className="p-field__label">Default Consumption Location</label>
              <select
                className="p-select"
                value={form.defaultConsumptionLocationId}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    defaultConsumptionLocationId: e.target.value,
                  }))
                }
                disabled={saving}
              >
                <option value="">No default location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code ? `${loc.name} (${loc.code})` : loc.name}
                  </option>
                ))}
              </select>
              <span className="p-field__hint">
                Example: Foods → Kitchen, Drinks → Bar, Coffee → Coffee Bar.
              </span>
            </div>

            <label className="p-checkbox" style={{ marginTop: 14 }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                disabled={saving}
              />
              <span>Active</span>
            </label>
          </div>

          <div className="p-card__footer">
            <button className="p-btn p-btn--outline" onClick={reset} disabled={saving}>
              Clear
            </button>
            <button className="p-btn p-btn--accent p-btn--lg" onClick={save} disabled={!canSave}>
              {saving ? "Saving..." : editing ? "Update Category" : "Create Category"}
            </button>
          </div>
        </div>

        <div className="p-card">
          <div className="p-card__head">
            <div>
              <p className="p-card__title">Configured Categories</p>
              <p className="p-card__subtitle">
                Category default locations are inherited by menu items and used by POS COGS posting.
              </p>
            </div>
            <span className="p-badge">{sortedCategories.length} Categories</span>
          </div>

          <div className="p-card__body">
            {loading ? (
              <div style={{ color: "var(--p-text-muted)", padding: 24 }}>Loading categories...</div>
            ) : sortedCategories.length === 0 ? (
              <div style={{ color: "var(--p-text-muted)", padding: 24 }}>
                No categories configured yet.
              </div>
            ) : (
              <div className="p-table-wrap">
                <table className="p-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Default Consumption Location</th>
                      <th>Status</th>
                      <th style={{ width: 120 }}></th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedCategories.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 700 }}>{row.name}</td>
                        <td>{row.code || "—"}</td>
                        <td>
                          {row.defaultConsumptionLocationName ? (
                            <span className="p-badge p-badge--active">
                              {row.defaultConsumptionLocationName}
                            </span>
                          ) : (
                            <span className="p-badge p-badge--inactive">
                              Missing
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`p-badge ${row.isActive === false ? "p-badge--inactive" : "p-badge--active"}`}>
                            {row.isActive === false ? "Inactive" : "Active"}
                          </span>
                        </td>
                        <td>
                          <button className="p-btn p-btn--outline" onClick={() => edit(row)} disabled={saving}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="p-alert p-alert--warning" style={{ marginTop: 16 }}>
              <span className="p-alert__body">
                ERP rule: configure defaults at category level first. Use item-level override only when a specific
                menu item consumes from a different branch stock location.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
