// src/features/production/pages/MenuCategoriesPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import {
  menuCategoriesApi,
  type UpsertMenuCategoryRequest,
} from "../api/menuCategoriesApi";
import type { MenuCategoryDto, StockLocationDto } from "../types";
import "../layout/production.css";

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

type FormState = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  defaultConsumptionBranchStockLocationId: string;
};

function createEmptyForm(): FormState {
  return {
    id: "",
    name: "",
    code: "",
    isActive: true,
    defaultConsumptionBranchStockLocationId: "",
  };
}

export default function MenuCategoriesPage() {
  const { companyId, branchId } = useAppScope();

  const [categories, setCategories] = useState<MenuCategoryDto[]>([]);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [form, setForm] = useState<FormState>(() => createEmptyForm());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const editing = Boolean(form.id);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "")
      ),
    [categories]
  );

  const activeConsumptionLocations = useMemo(
    () =>
      [...locations]
        .filter((x) => x.isActive !== false)
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [locations]
  );

  const canSave = Boolean(
    companyId && branchId && form.name.trim() && !saving && !loading
  );

  const reset = useCallback(() => {
    setForm(createEmptyForm());
    setError(null);
    setNotice(null);
  }, []);

  const load = useCallback(async () => {
    if (!companyId || !branchId) {
      setCategories([]);
      setLocations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [categoryResult, locationResult] = await Promise.all([
        menuCategoriesApi.list(companyId, branchId),
        menuCategoriesApi.listStockLocations(companyId, branchId),
      ]);

      setCategories(normalizeList<MenuCategoryDto>(categoryResult));
      setLocations(normalizeList<StockLocationDto>(locationResult));
    } catch (e) {
      setError(extractApiError(e, "Failed to load menu categories."));
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  function edit(row: MenuCategoryDto) {
    setNotice(null);
    setError(null);

    setForm({
      id: row.id,
      name: row.name ?? "",
      code: row.code ?? "",
      isActive: row.isActive !== false,
      defaultConsumptionBranchStockLocationId:
        row.defaultConsumptionBranchStockLocationId ?? "",
    });
  }

  async function save() {
    if (!companyId) return setError("Select a company first.");
    if (!branchId) return setError("Select a branch first.");
    if (!form.name.trim()) return setError("Category name is required.");

    const payload: UpsertMenuCategoryRequest = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      isActive: form.isActive,
      defaultConsumptionBranchStockLocationId:
        form.defaultConsumptionBranchStockLocationId || null,
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

      setForm(createEmptyForm());
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
          <div className="p-guard__icon"></div>
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
            Configure category defaults such as Kitchen, Bar, Coffee Bar, or
            Bakery consumption locations. Menu items inherit these defaults
            unless individually overridden.
          </p>
        </div>

        <button
          className="p-btn p-btn--outline"
          onClick={() => void load()}
          disabled={loading || saving}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="p-alert p-alert--error">
          <span className="p-alert__body">{error}</span>
          <button className="p-dismiss" onClick={() => setError(null)}>
            
          </button>
        </div>
      )}

      {notice && (
        <div className="p-alert p-alert--success">
          <span className="p-alert__body">{notice}</span>
          <button className="p-dismiss" onClick={() => setNotice(null)}>
            
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "420px 1fr",
          gap: 16,
        }}
      >
        <div className="p-card">
          <div className="p-card__head">
            <div>
              <p className="p-card__title">
                {editing ? "Edit Category" : "Create Category"}
              </p>
              <p className="p-card__subtitle">
                Assign the branch consumption location used for POS COGS.
              </p>
            </div>

            <span
              className={`p-badge ${
                form.isActive ? "p-badge--active" : "p-badge--inactive"
              }`}
            >
              {form.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="p-card__body">
            <div className="p-field">
              <label className="p-field__label">Category Name *</label>
              <input
                className="p-input"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                disabled={saving}
                placeholder="e.g. Foods, Drinks, Coffee"
              />
            </div>

            <div className="p-field">
              <label className="p-field__label">Code</label>
              <input
                className="p-input"
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, code: e.target.value }))
                }
                disabled={saving}
                placeholder="Optional"
              />
            </div>

            <div className="p-field">
              <label className="p-field__label">
                Default Consumption Location
              </label>

              <select
                className="p-select"
                value={form.defaultConsumptionBranchStockLocationId}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    defaultConsumptionBranchStockLocationId: e.target.value,
                  }))
                }
                disabled={saving || loading}
              >
                <option value="">No default location</option>

                {activeConsumptionLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code ? `${loc.name} (${loc.code})` : loc.name}
                  </option>
                ))}
              </select>

              <span className="p-field__hint">
                This value must be the branch stock location assignment ID, not
                the global stock location ID.
              </span>
            </div>

            <label className="p-checkbox" style={{ marginTop: 14 }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((p) => ({ ...p, isActive: e.target.checked }))
                }
                disabled={saving}
              />
              <span>Active</span>
            </label>
          </div>

          <div className="p-card__footer">
            <button
              className="p-btn p-btn--outline"
              onClick={reset}
              disabled={saving}
            >
              Clear
            </button>

            <button
              className="p-btn p-btn--accent p-btn--lg"
              onClick={() => void save()}
              disabled={!canSave}
            >
              {saving
                ? "Saving..."
                : editing
                ? "Update Category"
                : "Create Category"}
            </button>
          </div>
        </div>

        <div className="p-card">
          <div className="p-card__head">
            <div>
              <p className="p-card__title">Configured Categories</p>
              <p className="p-card__subtitle">
                Category default locations are inherited by menu items and used
                by POS COGS posting.
              </p>
            </div>

            <span className="p-badge">
              {sortedCategories.length} Categories
            </span>
          </div>

          <div className="p-card__body">
            {loading ? (
              <div style={{ color: "var(--p-text-muted)", padding: 24 }}>
                Loading categories...
              </div>
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
                      <th style={{ width: 120 }} />
                    </tr>
                  </thead>

                  <tbody>
                    {sortedCategories.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 700 }}>{row.name}</td>
                        <td>{row.code || "-"}</td>
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
                          <span
                            className={`p-badge ${
                              row.isActive === false
                                ? "p-badge--inactive"
                                : "p-badge--active"
                            }`}
                          >
                            {row.isActive === false ? "Inactive" : "Active"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="p-btn p-btn--outline"
                            onClick={() => edit(row)}
                            disabled={saving}
                          >
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
                ERP rule: configure branch-level consumption defaults at the
                category level first. Use item-level override only when a
                specific menu item consumes from a different branch stock
                location.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}