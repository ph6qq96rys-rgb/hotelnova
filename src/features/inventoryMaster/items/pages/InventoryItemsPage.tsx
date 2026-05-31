// src/features/inventory/items/pages/InventoryItemsPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { inventoryItemsApi, type CreateItemBody, type UpdateItemBody } from "../api/inventoryItemsApi";
import { itemTypeLabel } from "../constants/itemTypes";
import type { InventoryItemDto, CategoryDto, UomDto, ItemUomDto } from "../types";
import type { InventoryItemFormDto, SelectOption } from "../components/InventoryItemForm";
import InventoryItemForm from "../components/InventoryItemForm";
import "./inventory-items.css";
import { useNavigate } from "react-router-dom";



// ── Types ─────────────────────────────────────────────────────────────────────

type InventoryItemRow = InventoryItemDto & {
  localName?:    string | null;
  reorderLevel?: number | null;
  issueUomId?:   string | null;
  allowedUoms?:  ItemUomDto[];
  type?:         string;
};

type ActiveFilter = "all" | "active" | "inactive";

type ConfirmState =
  | { kind: "none" }
  | { kind: "toggleActive"; item: InventoryItemDto; next: boolean };

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractApiError(error: unknown): string {
  const e    = error as any;
  const data = e?.response?.data;
  if (!data)                   return e?.message ?? "Request failed.";
  if (typeof data === "string") return data;
  if (data?.message)            return data.message;
  if (data?.title && data?.errors) return `${data.title}: ${JSON.stringify(data.errors)}`;
  if (data?.title)              return data.title;
  return e?.message ?? "Request failed.";
}

function formatUom(uom: UomDto): string {
  if (!uom) return "—";
  const code = (uom as any).code ?? uom.symbol ?? "";
  return code ? `${uom.name} (${code})` : uom.name;
}

function getIssueUomId(item: InventoryItemRow): string | null {
  return item.issueUomId ?? item.allowedUoms?.find(u => u.isIssue)?.uomId ?? null;
}

function isItemActive(item: InventoryItemDto): boolean {
  // treat isActive === undefined/null as active (not explicitly deactivated)
  return item.isActive == null ? true : Boolean(item.isActive);
}

function buildCreateBody(companyId: string, form: InventoryItemFormDto): CreateItemBody {
  return {
    companyId,
    name:           form.name.trim(),
    localName:      form.localName || null,
    sku:            form.sku || null,
    barcode:        form.barcode || null,
    categoryId:     form.categoryId || null,
    baseUomId:      form.baseUomId,
    type:           form.type,
    allowedUoms:    form.allowedUoms ?? [],
    trackInventory: Boolean(form.trackInventory),
    defaultCost:    form.defaultCost ?? null,
    defaultPrice:   form.defaultPrice ?? null,
    reorderLevel:   form.reorderLevel ?? 0,
    isActive:       true,
  };
}

function buildUpdateBody(companyId: string, itemId: string, form: InventoryItemFormDto): UpdateItemBody {
  if (!itemId) throw new Error("Missing item ID.");
  return { ...buildCreateBody(companyId, form), id: itemId, isActive: form.isActive ?? true };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inv-badge ${active ? "inv-badge--active" : "inv-badge--inactive"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Kpi({ label, value, tone = "neutral" }: {
  label: string; value: number; tone?: "neutral" | "success" | "warn";
}) {
  return (
    <div className={`inv-kpi${tone !== "neutral" ? ` inv-kpi--${tone}` : ""}`}>
      <div className="inv-kpi__label">{label}</div>
      <div className="inv-kpi__value">{value}</div>
    </div>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {[1, 2, 3, 4].map(i => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: "12px 14px" }}>
              <span className="inv-skeleton"
                style={{ width: j === 0 ? 200 : j === cols - 1 ? 80 : 100 }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyState({ title, subtitle, onNew, onReset }: {
  title: string; subtitle: string; onNew: () => void; onReset?: () => void;
}) {
  return (
    <div className="inv-empty">
      <div className="inv-empty__icon">📦</div>
      <div className="inv-empty__title">{title}</div>
      <div className="inv-empty__subtitle">{subtitle}</div>
      <div className="inv-empty__actions">
        <button className="inv-btn inv-btn--primary" onClick={onNew}>+ New Item</button>
        {onReset && (
          <button className="inv-btn inv-btn--outline" onClick={onReset}>Clear filter</button>
        )}
      </div>
    </div>
  );
}

// ── ConfirmModal ──────────────────────────────────────────────────────────────
// FIX: replaces window.confirm() — a blocking native dialog suppressed in
// iframes and strict CSP contexts. Inline modal with the same two actions.

function ConfirmModal({ state, busy, onConfirm, onCancel }: {
  state:     ConfirmState;
  busy:      boolean;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  if (state.kind === "none") return null;

  const activating = state.kind === "toggleActive" && state.next;
  const itemName   = state.kind === "toggleActive" ? state.item.name : "";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(15,23,42,.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 14, padding: 28, width: 400,
        boxShadow: "0 20px 60px rgba(15,23,42,.18)",
        border: "1px solid #e2e8f0",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
          {activating ? "Activate item" : "Deactivate item"}
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          {activating
            ? <>Activate <b>{itemName}</b>? It will appear in all item dropdowns.</>
            : <>Deactivate <b>{itemName}</b>? It will be hidden from all item dropdowns.</>}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            disabled={busy}
            onClick={onCancel}
            style={{
              padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: "1px solid #e2e8f0", background: "#f8fafc",
              color: "#475569", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={onConfirm}
            style={{
              padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: activating ? "1px solid #059669" : "1px solid #dc2626",
              background: activating ? "#059669" : "#dc2626",
              color: "#fff",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Working…" : activating ? "Activate" : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InventoryItemsPage() {
  const { companyId } = useAppScope();

  const [items,         setItems]         = useState<InventoryItemDto[]>([]);
  const [categoriesRaw, setCategoriesRaw] = useState<CategoryDto[]>([]);
  const [uomsRaw,       setUomsRaw]       = useState<UomDto[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const navigate = useNavigate();

  const [itemsError,  setItemsError]  = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [rawQuery,    setRawQuery]    = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const [editing,  setEditing]  = useState<InventoryItemDto | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirm,  setConfirm]  = useState<ConfirmState>({ kind: "none" });

  // Ref guard — prevents double-submit before React re-renders saving state.
  const inFlight = useRef(false);

  // Debounce search 250 ms
  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(rawQuery.trim().toLowerCase()), 250);
    return () => window.clearTimeout(t);
  }, [rawQuery]);

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setItemsError(null);
    setLookupError(null);

    try {
      setItems((await inventoryItemsApi.list(companyId)) ?? []);
    } catch (e) {
      setItemsError(extractApiError(e));
      setLoading(false);
      return;
    }

    const lookupErrors: string[] = [];

    try {
      setCategoriesRaw((await inventoryItemsApi.getCategories(companyId)) ?? []);
    } catch (e) {
      lookupErrors.push(`Categories: ${extractApiError(e)}`);
    }

    try {
      setUomsRaw((await inventoryItemsApi.getUoms(companyId)) ?? []);
    } catch (e) {
      lookupErrors.push(`UOMs: ${extractApiError(e)}`);
    }

    if (lookupErrors.length)
      setLookupError(`Some lookup data could not be loaded — ${lookupErrors.join("; ")}`);

    setLoading(false);
  }, [companyId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const uomById = useMemo(
    () => new Map(uomsRaw.map(u => [u.id, formatUom(u)])),
    [uomsRaw]
  );

  const categories: SelectOption[] = useMemo(
    () => categoriesRaw.map(({ id, name }) => ({ id, name })),
    [categoriesRaw]
  );

  const uomOptions: SelectOption[] = useMemo(
    () => uomsRaw.map(u => ({
      id:   u.id,
      name: u.name,
      code: (u as any).code ?? u.symbol ?? "",
    })),
    [uomsRaw]
  );

  const filteredItems = useMemo(() => items.filter(raw => {
    const item = raw as InventoryItemRow;
    const active = isItemActive(item);

    const passesActive =
      activeFilter === "all"      ? true :
      activeFilter === "active"   ? active :
                                    !active;

    const passesSearch = !searchQuery || (
      (item.name ?? "").toLowerCase().includes(searchQuery) ||
      (item.localName ?? "").toLowerCase().includes(searchQuery) ||
      (item.sku ?? "").toLowerCase().includes(searchQuery)
    );

    return passesActive && passesSearch;
  }), [items, activeFilter, searchQuery]);

  const totalCount    = items.length;
  const activeCount   = items.filter(isItemActive).length;
  const inactiveCount = totalCount - activeCount;
  const trackedCount  = items.filter(i => (i as any).trackInventory).length;
  const reorderCount  = items.filter(i => {
    const r = (i as InventoryItemRow).reorderLevel;
    return typeof r === "number" && r > 0;
  }).length;

  // ── Handlers ───────────────────────────────────────────────────────────────

  // FIX: all handlers wrapped in useCallback — previously recreated on every
  // render and passed into InventoryItemForm and every table row.

  const handleSubmit = useCallback(async (formDto: InventoryItemFormDto) => {
    if (!companyId || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      if (!editing) {
        await inventoryItemsApi.create(companyId, buildCreateBody(companyId, formDto));
      } else {
        await inventoryItemsApi.update(
          companyId, editing.id,
          buildUpdateBody(companyId, editing.id, formDto)
        );
      }
      setShowForm(false);
      setEditing(null);
      await loadAll();
    } catch (e) {
      setSubmitError(extractApiError(e));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [companyId, editing, loadAll]);

  // FIX: replaces window.confirm() with the ConfirmModal state machine.
  const handleToggleActive = useCallback((item: InventoryItemDto) => {
    setConfirm({ kind: "toggleActive", item, next: !isItemActive(item) });
  }, []);

  const handleConfirmToggle = useCallback(async () => {
    if (confirm.kind !== "toggleActive" || !companyId || inFlight.current) return;
    const { item, next } = confirm;
    inFlight.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      await inventoryItemsApi.setActive(companyId, item.id, next);
      setConfirm({ kind: "none" });
      await loadAll();
    } catch (e) {
      setSubmitError(extractApiError(e));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [confirm, companyId, loadAll]);

  const handleEdit = useCallback((item: InventoryItemDto) => {
    setEditing(item);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleCreateNew = useCallback(() => {
    setEditing(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditing(null);
    setSubmitError(null);
  }, []);

  const handleResetFilter = useCallback(() => {
    setRawQuery("");
    setActiveFilter("all");
  }, []);

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!companyId) {
    return (
      <div className="inv-page">
        <div className="inv-page-guard">
          <div style={{ fontSize: 32 }}>⚙</div>
          <div>Select a company to manage inventory items.</div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="inv-page">

      {/* Banner */}
      <div className="inv-banner">
        <div>
          <p className="inv-banner__kicker">Item master</p>
          <h1 className="inv-banner__title">Inventory items</h1>
          <p className="inv-banner__subtitle">
            Manage names, FUOM, store UOM, conversions, costing defaults,
            reorder levels, and status.
          </p>
        </div>
        <div className="inv-banner__right">
          <div className="inv-banner__count">
            <span className="inv-banner__count-label">Showing</span>
            <span className="inv-banner__count-value">{filteredItems.length}</span>
          </div>
          <button className="inv-btn inv-btn--outline" onClick={handleCreateNew}>
            + New item
          </button>
          <button className="inv-btn inv-btn--outline" onClick={() => navigate("/inventory/items/import")}>
          Import from Excel
        </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="inv-kpi-grid">
        <Kpi label="Total items"  value={totalCount} />
        <Kpi label="Active"       value={activeCount}   tone="success" />
        <Kpi label="Inactive"     value={inactiveCount} tone={inactiveCount > 0 ? "warn" : "neutral"} />
        <Kpi label="Tracked"      value={trackedCount} />
        <Kpi label="With reorder" value={reorderCount} />
      </div>

      {/* Form */}
      {showForm && (
        <InventoryItemForm
          mode={editing ? "edit" : "create"}
          initial={editing}
          categories={categories}
          uoms={uomOptions}
          saving={saving}
          onCancel={handleCancelForm}
          onSubmit={handleSubmit}
        />
      )}

      {/* Errors */}
      {submitError && (
        <div className="inv-alert inv-alert--error" role="alert">{submitError}</div>
      )}
      {itemsError && (
        <div className="inv-alert inv-alert--error" role="alert">
          Failed to load items — {itemsError}
        </div>
      )}
      {lookupError && (
        <div className="inv-alert inv-alert--warn" role="alert">
          ⚠ {lookupError} — dropdowns may be incomplete.
        </div>
      )}

      {/* Register card */}
      <div className="inv-card">
        <div className="inv-card__head">
          <div>
            <h2 className="inv-card__title">Item register</h2>
            <p className="inv-card__subtitle">Search by English name, local name, or SKU.</p>
          </div>

          <div className="inv-filter-bar">
            <div className="inv-toggle-group">
              {(["active", "all", "inactive"] as ActiveFilter[]).map(f => (
                <button
                  key={f}
                  className={`inv-toggle-group__btn${activeFilter === f ? " is-active" : ""}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f === "active" ? "Active" : f === "inactive" ? "Inactive" : "All"}
                </button>
              ))}
            </div>
            <div className="inv-search-wrap">
              <input
                className="inv-search"
                value={rawQuery}
                onChange={e => setRawQuery(e.target.value)}
                placeholder="Search items…"
              />
            </div>
          </div>
        </div>

        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>SKU</th>
                <th>FUOM</th>
                <th>Issue UOM</th>
                <th className="num">Reorder</th>
                <th>Track</th>
                <th>Status</th>
                <th className="inv-table__actions-col" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows cols={9} />
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 0 }}>
                    <EmptyState
                      title={
                        searchQuery       ? "No matching items"
                        : activeFilter !== "all" ? "No items in this filter"
                        : "No items yet"
                      }
                      subtitle={
                        searchQuery       ? "Try a different keyword or clear the search."
                        : activeFilter !== "all" ? "Switch filter to 'All' or create a new item."
                        : "Register your first inventory item to start tracking stock."
                      }
                      onNew={handleCreateNew}
                      onReset={searchQuery || activeFilter !== "all" ? handleResetFilter : undefined}
                    />
                  </td>
                </tr>
              ) : filteredItems.map(raw => {
                const item       = raw as InventoryItemRow;
                const issueUomId = getIssueUomId(item);
                const active     = isItemActive(item);
                const initials   = (item.name ?? "?").slice(0, 1).toUpperCase();

                return (
                  <tr key={item.id} className="is-clickable"
                    onClick={() => handleEdit(item)} title="Click to edit">
                    <td>
                      <div className="inv-item-cell">
                        <div className="inv-item-avatar">{initials}</div>
                        <div>
                          <div className="inv-item-name">{item.name}</div>
                          {item.localName && (
                            <div className="inv-item-sub" dir="auto">{item.localName}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{item.type ? itemTypeLabel(item.type as any) : "—"}</td>
                    <td>{item.sku ?? "—"}</td>
                    <td>{uomById.get(item.baseUomId) ?? "—"}</td>
                    <td>{issueUomId ? (uomById.get(issueUomId) ?? "—") : "—"}</td>
                    <td className="num">
                      {item.reorderLevel == null ? "—" : String(item.reorderLevel)}
                    </td>
                    <td>{(item as any).trackInventory ? "Yes" : "No"}</td>
                    <td><StatusBadge active={active} /></td>
                    <td>
                      <div className="inv-row-actions">
                        <button
                          className="inv-btn inv-btn--sm inv-btn--outline"
                          onClick={e => { e.stopPropagation(); handleEdit(item); }}
                        >
                          Edit
                        </button>
                        <button
                          className={`inv-btn inv-btn--sm ${active ? "inv-btn--danger" : "inv-btn--outline"}`}
                          onClick={e => { e.stopPropagation(); handleToggleActive(item); }}
                          disabled={saving}
                        >
                          {active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="inv-sticky-bar">
        <div className="inv-sticky-bar__count">
          Showing <b>{filteredItems.length}</b> of <b>{totalCount}</b> item(s)
          {searchQuery && <> matching &ldquo;<b>{searchQuery}</b>&rdquo;</>}
        </div>
        <div className="inv-filter-bar">
          {(searchQuery || activeFilter !== "all") && (
            <button
              className="inv-btn inv-btn--outline inv-btn--sm"
              onClick={handleResetFilter}
            >
              Reset filter
            </button>
          )}
          <button className="inv-btn inv-btn--primary inv-btn--sm" onClick={handleCreateNew}>
            + New Item
          </button>
        </div>
      </div>

      {/* Confirm modal — replaces window.confirm() */}
      <ConfirmModal
        state={confirm}
        busy={saving}
        onConfirm={handleConfirmToggle}
        onCancel={() => { setConfirm({ kind: "none" }); setSubmitError(null); }}
      />
    </div>
  );
}