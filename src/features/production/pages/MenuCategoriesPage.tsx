// src/features/production/pages/MenuCategoriesPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { useI18n } from "../../../i18n";
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

  return data?.message ?? data?.detail ?? data?.title ?? err?.message ?? fallback;
}

type FormState = {
  id: string;
  name: string;
  localName: string;
  code: string;
  isActive: boolean;
  defaultConsumptionBranchStockLocationId: string;
};

function createEmptyForm(): FormState {
  return {
    id: "",
    name: "",
    localName: "",
    code: "",
    isActive: true,
    defaultConsumptionBranchStockLocationId: "",
  };
}

function isProductionOutputCategory(value: Pick<MenuCategoryDto, "name" | "code"> | Pick<FormState, "name" | "code">): boolean {
  const code = (value.code ?? "").trim().toUpperCase();
  const name = (value.name ?? "").trim().toUpperCase();
  return code === "CAT-PRODUCTION-OUTPUTS" || name === "PRODUCTION OUTPUTS";
}

export default function MenuCategoriesPage() {
  const { companyId, branchId } = useAppScope();
  const { tx } = useI18n();

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
        .filter(
          (x) =>
            x.isActive !== false &&
            x.isConsumptionLocation === true &&
            x.canReceiveGrn !== true &&
            x.isMainWarehouse !== true &&
            x.isProductionCenter !== true
        )
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [locations]
  );

  const isEditingProductionOutputCategory = isProductionOutputCategory(form);

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
      setError(extractApiError(e, tx("Failed to load menu categories.")));
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, tx]);

  useEffect(() => {
    void load();
  }, [load]);

  function edit(row: MenuCategoryDto) {
    setNotice(null);
    setError(null);

    setForm({
      id: row.id,
      name: row.name ?? "",
      localName: row.localName ?? "",
      code: row.code ?? "",
      isActive: row.isActive !== false,
      defaultConsumptionBranchStockLocationId:
        row.defaultConsumptionBranchStockLocationId ?? "",
    });
  }

  async function save() {
    if (!companyId) return setError(tx("Select a company first."));
    if (!branchId) return setError(tx("Select a branch first."));
    if (!form.name.trim()) return setError(tx("Category name is required."));

    const payload: UpsertMenuCategoryRequest = {
      name: form.name.trim(),
      localName: form.localName.trim() || null,
      code: form.code.trim() || null,
      isActive: form.isActive,
      defaultConsumptionBranchStockLocationId: isProductionOutputCategory(form)
        ? null
        : form.defaultConsumptionBranchStockLocationId || null,
    };

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      if (editing) {
        await menuCategoriesApi.update(companyId, branchId, form.id, payload);
        setNotice(tx("Menu category updated."));
      } else {
        await menuCategoriesApi.create(companyId, branchId, payload);
        setNotice(tx("Menu category created."));
      }

      setForm(createEmptyForm());
      await load();
    } catch (e) {
      setError(extractApiError(e, tx("Failed to save menu category.")));
    } finally {
      setSaving(false);
    }
  }

  if (!companyId || !branchId) {
    return (
      <div className="p-page">
        <div className="p-guard">
          <div className="p-guard__icon"></div>
          {tx("Select a company and branch to continue.")}
        </div>
      </div>
    );
  }

  return (
    <div className="p-page" style={{ maxWidth: 1180 }}>
      <ProductionWorkflowBar active="menu" />

      <div className="p-page-header">
        <div>
          <p className="p-kicker">{tx("Menu Configuration")}</p>
          <h1 className="p-title">{tx("Menu Categories")}</h1>
          <p className="p-subtitle">
            {tx("Configure category defaults such as Kitchen, Bar, Coffee Bar, or Bakery consumption locations. Menu items inherit these defaults unless individually overridden.")}
          </p>
        </div>

        <button
          className="p-btn p-btn--outline"
          onClick={() => void load()}
          disabled={loading || saving}
        >
          {loading ? tx("Refreshing...") : tx("Refresh")}
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
                {editing ? tx("Edit Category") : tx("Create Category")}
              </p>
              <p className="p-card__subtitle">
                {tx("Assign the branch consumption location used for POS COGS.")}
              </p>
            </div>

            <span
              className={`p-badge ${
                form.isActive ? "p-badge--active" : "p-badge--inactive"
              }`}
            >
              {form.isActive ? tx("Active") : tx("Inactive")}
            </span>
          </div>

          <div className="p-card__body">
            <div className="p-field">
              <label className="p-field__label">{tx("Category Name")} *</label>
              <input
                className="p-input"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                disabled={saving}
                placeholder={tx("e.g. Foods, Drinks, Coffee")}
              />
            </div>

            <div className="p-field">
              <label className="p-field__label">{tx("Amharic Name")}</label>
              <input
                className="p-input"
                value={form.localName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, localName: e.target.value }))
                }
                disabled={saving}
                placeholder={tx("Optional - Amharic / local name")}
              />
            </div>

            <div className="p-field">
              <label className="p-field__label">{tx("Code")}</label>
              <input
                className="p-input"
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, code: e.target.value }))
                }
                disabled={saving}
                placeholder={tx("Optional")}
              />
            </div>

            <div className="p-field">
              <label className="p-field__label">
                {tx("Default Consumption Location")}
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
                disabled={saving || loading || isEditingProductionOutputCategory}
              >
                <option value="">{tx("No default location")}</option>

                {activeConsumptionLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code ? `${loc.name} (${loc.code})` : loc.name}
                  </option>
                ))}
              </select>

              <span className="p-field__hint">
                {isEditingProductionOutputCategory
                  ? tx("Production output categories receive stock through production batches and do not use POS COGS consumption defaults.")
                  : tx("Only branch locations configured for inventory consumption are available. Production, receiving, and main warehouse locations are excluded from POS COGS defaults.")}
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
              <span>{tx("Active")}</span>
            </label>
          </div>

          <div className="p-card__footer">
            <button
              className="p-btn p-btn--outline"
              onClick={reset}
              disabled={saving}
            >
              {tx("Clear")}
            </button>

            <button
              className="p-btn p-btn--accent p-btn--lg"
              onClick={() => void save()}
              disabled={!canSave}
            >
              {saving
                ? tx("Saving...")
                : editing
                ? tx("Update Category")
                : tx("Create Category")}
            </button>
          </div>
        </div>

        <div className="p-card">
          <div className="p-card__head">
            <div>
              <p className="p-card__title">{tx("Configured Categories")}</p>
              <p className="p-card__subtitle">
                {tx("Category default locations are inherited by menu items and used by POS COGS posting.")}
              </p>
            </div>

            <span className="p-badge">
              {sortedCategories.length} {tx("Categories")}
            </span>
          </div>

          <div className="p-card__body">
            {loading ? (
              <div style={{ color: "var(--p-text-muted)", padding: 24 }}>
                {tx("Loading categories...")}
              </div>
            ) : sortedCategories.length === 0 ? (
              <div style={{ color: "var(--p-text-muted)", padding: 24 }}>
                {tx("No categories configured yet.")}
              </div>
            ) : (
              <div className="p-table-wrap">
                <table className="p-table">
                  <thead>
                    <tr>
                      <th>{tx("Name")}</th>
                      <th>{tx("Amharic Name")}</th>
                      <th>{tx("Code")}</th>
                      <th>{tx("Default Consumption Location")}</th>
                      <th>{tx("Status")}</th>
                      <th style={{ width: 120 }} />
                    </tr>
                  </thead>

                  <tbody>
                    {sortedCategories.map((row) => {
                      const productionOutputCategory = isProductionOutputCategory(row);
                      return (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 700 }}>{row.name}</td>
                        <td>{row.localName || "-"}</td>
                        <td>{row.code || "-"}</td>
                        <td>
                          {productionOutputCategory ? (
                            <span className="p-badge">{tx("Production output")}</span>
                          ) : row.defaultConsumptionLocationName ? (
                            <span className="p-badge p-badge--active">
                              {row.defaultConsumptionLocationName}
                            </span>
                          ) : (
                            <span className="p-badge p-badge--inactive">
                              {tx("Missing")}
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
                            {row.isActive === false ? tx("Inactive") : tx("Active")}
                          </span>
                        </td>
                        <td>
                          <button
                            className="p-btn p-btn--outline"
                            onClick={() => edit(row)}
                            disabled={saving}
                          >
                            {tx("Edit")}
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="p-alert p-alert--warning" style={{ marginTop: 16 }}>
              <span className="p-alert__body">
                {tx("ERP rule: configure branch-level consumption defaults at the category level first. Use item-level override only when a specific menu item consumes from a different branch stock location.")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
