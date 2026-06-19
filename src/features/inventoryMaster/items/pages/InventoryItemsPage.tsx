// src/features/inventory/items/pages/InventoryItemsPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { inventoryItemsApi } from "../api/inventoryItemsApi";
import { itemTypeLabel } from "../constants/itemTypes";
import type { InventoryItemDto, UomDto } from "../types";

import "./inventory-items.css";

export type InventoryItemRow = InventoryItemDto;

type ActiveFilter = "all" | "active" | "inactive";

type ConfirmState =
  | { kind: "none" }
  | { kind: "toggleActive"; item: InventoryItemRow; next: boolean };

type CompanyItemPaths = {
  list: string;
  new: string;
  import: string;
  edit: (itemId: string) => string;
};

export function extractApiError(error: unknown): string {
  const e = error as Record<string, any>;
  const data = e?.response?.data;

  if (!data) return e?.message ?? "Request failed.";
  if (typeof data === "string") return data;
  if (data?.errors && data?.title) return `${data.title}: ${JSON.stringify(data.errors)}`;
  if (data?.message) return String(data.message);
  if (data?.title) return String(data.title);

  return e?.message ?? "Request failed.";
}

function buildItemPaths(companyId: string): CompanyItemPaths {
  const base = `/companies/${companyId}/inventory-master/items`;

  return {
    list: base,
    new: `${base}/new`,
    import: `${base}/import`,
    edit: (itemId: string) => `${base}/${itemId}/edit`,
  };
}

function formatUom(uom: UomDto): string {
  if (!uom) return "—";

  const code = (uom as any).code ?? uom.symbol ?? "";
  return code ? `${uom.name} (${code})` : uom.name;
}

function getIssueUomId(item: InventoryItemRow): string | null {
  return item.allowedUoms?.find((u) => u.isIssue)?.uomId ?? null;
}

function isItemActive(item: InventoryItemDto): boolean {
  return item.isActive == null ? true : Boolean(item.isActive);
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inv-badge ${active ? "inv-badge--active" : "inv-badge--inactive"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warn";
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
      {[1, 2, 3, 4].map((i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: "12px 14px" }}>
              <span
                className="inv-skeleton"
                style={{ width: j === 0 ? 200 : j === cols - 1 ? 80 : 100 }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyState({
  title,
  subtitle,
  onNew,
  onReset,
}: {
  title: string;
  subtitle: string;
  onNew: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="inv-empty">
      <div className="inv-empty__icon">📦</div>
      <div className="inv-empty__title">{title}</div>
      <div className="inv-empty__subtitle">{subtitle}</div>

      <div className="inv-empty__actions">
        <button type="button" className="inv-btn inv-btn--primary" onClick={onNew}>
          + New item
        </button>

        {onReset ? (
          <button type="button" className="inv-btn inv-btn--outline" onClick={onReset}>
            Clear filter
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ConfirmModal({
  state,
  busy,
  onConfirm,
  onCancel,
}: {
  state: ConfirmState;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (state.kind === "none") return null;

  const activating = state.next;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15,23,42,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 28,
          width: 420,
          boxShadow: "0 20px 60px rgba(15,23,42,.18)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
          {activating ? "Activate item" : "Deactivate item"}
        </div>

        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          {activating ? (
            <>
              <b>{state.item.name}</b> will appear in all item pick-lists.
            </>
          ) : (
            <>
              <b>{state.item.name}</b> will be hidden from all item pick-lists.
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#475569",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
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

export default function InventoryItemsPage() {
  const { companyId } = useAppScope();
  const navigate = useNavigate();

  const paths = useMemo(() => {
    return companyId ? buildItemPaths(companyId) : null;
  }, [companyId]);

  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [uomsRaw, setUomsRaw] = useState<UomDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [itemsError, setItemsError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [rawQuery, setRawQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const [confirm, setConfirm] = useState<ConfirmState>({ kind: "none" });

  const inFlight = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(rawQuery.trim().toLowerCase());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [rawQuery]);

  const loadAll = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setItemsError(null);
    setLookupError(null);

    try {
      const [fetchedItems, fetchedUoms] = await Promise.all([
        inventoryItemsApi.list(companyId),
        inventoryItemsApi.getUoms(companyId).catch((e: unknown) => {
          setLookupError(`UOMs could not be loaded — ${extractApiError(e)}`);
          return [] as UomDto[];
        }),
      ]);

      setItems((fetchedItems ?? []) as InventoryItemRow[]);
      setUomsRaw(fetchedUoms ?? []);
    } catch (e) {
      setItemsError(extractApiError(e));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const uomById = useMemo(() => {
    return new Map(uomsRaw.map((u) => [u.id, formatUom(u)]));
  }, [uomsRaw]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const active = isItemActive(item);

      const passesActive =
        activeFilter === "all" ? true : activeFilter === "active" ? active : !active;

      const passesSearch =
        !searchQuery ||
        (item.name ?? "").toLowerCase().includes(searchQuery) ||
        (item.localName ?? "").toLowerCase().includes(searchQuery) ||
        (item.sku ?? "").toLowerCase().includes(searchQuery);

      return passesActive && passesSearch;
    });
  }, [items, activeFilter, searchQuery]);

  const totalCount = items.length;
  const activeCount = useMemo(() => items.filter(isItemActive).length, [items]);
  const inactiveCount = totalCount - activeCount;

  const trackedCount = useMemo(() => {
    return items.filter((i) => i.trackInventory).length;
  }, [items]);

  const reorderCount = useMemo(() => {
    return items.filter((i) => typeof i.reorderLevel === "number" && i.reorderLevel > 0).length;
  }, [items]);

  const handleCreateNew = useCallback(() => {
    if (!paths) return;
    navigate(paths.new);
  }, [navigate, paths]);

  const handleImport = useCallback(() => {
    if (!paths) return;
    navigate(paths.import);
  }, [navigate, paths]);

  const handleEdit = useCallback(
    (item: InventoryItemRow) => {
      if (!paths) return;
      navigate(paths.edit(item.id));
    },
    [navigate, paths]
  );

  const handleToggleActive = useCallback((item: InventoryItemRow) => {
    setSubmitError(null);
    setConfirm({ kind: "toggleActive", item, next: !isItemActive(item) });
  }, []);

  const handleConfirmToggle = useCallback(async () => {
    if (confirm.kind !== "toggleActive" || !companyId || inFlight.current) return;

    inFlight.current = true;
    setSaving(true);
    setSubmitError(null);

    try {
      await inventoryItemsApi.setActive(companyId, confirm.item.id, confirm.next);
      setConfirm({ kind: "none" });
      await loadAll();
    } catch (e) {
      setSubmitError(extractApiError(e));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [confirm, companyId, loadAll]);

  const handleCancelConfirm = useCallback(() => {
    setConfirm({ kind: "none" });
    setSubmitError(null);
  }, []);

  const handleResetFilter = useCallback(() => {
    setRawQuery("");
    setActiveFilter("all");
  }, []);

  if (!companyId || !paths) {
    return (
      <div className="inv-page">
        <div className="inv-page-guard">
          <div style={{ fontSize: 32 }}>⚙</div>
          <div>Select a company to manage inventory items.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="inv-page">
      <div className="inv-banner">
        <div>
          <p className="inv-banner__kicker">Item master</p>
          <h1 className="inv-banner__title">Inventory items</h1>
          <p className="inv-banner__subtitle">
            Manage names, base UOM, issue UOM, conversions, costing defaults, reorder
            levels, and status.
          </p>
        </div>

        <div className="inv-banner__right">
          <div className="inv-banner__count">
            <span className="inv-banner__count-label">Showing</span>
            <span className="inv-banner__count-value">{filteredItems.length}</span>
          </div>

          <button type="button" className="inv-btn inv-btn--outline" onClick={handleCreateNew}>
            + New item
          </button>

          <button type="button" className="inv-btn inv-btn--outline" onClick={handleImport}>
            Import from Excel
          </button>
        </div>
      </div>

      <div className="inv-kpi-grid">
        <Kpi label="Total items" value={totalCount} />
        <Kpi label="Active" value={activeCount} tone="success" />
        <Kpi
          label="Inactive"
          value={inactiveCount}
          tone={inactiveCount > 0 ? "warn" : "neutral"}
        />
        <Kpi label="Tracked" value={trackedCount} />
        <Kpi label="With reorder" value={reorderCount} />
      </div>

      {submitError ? (
        <div className="inv-alert inv-alert--error" role="alert">
          {submitError}
        </div>
      ) : null}

      {itemsError ? (
        <div className="inv-alert inv-alert--error" role="alert">
          Failed to load items — {itemsError}
          <button
            type="button"
            className="inv-btn inv-btn--sm inv-btn--outline"
            style={{ marginLeft: 12 }}
            onClick={() => void loadAll()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {lookupError ? (
        <div className="inv-alert inv-alert--warn" role="alert">
          ⚠ {lookupError} — UOM columns may show IDs.
        </div>
      ) : null}

      <div className="inv-card">
        <div className="inv-card__head">
          <div>
            <h2 className="inv-card__title">Item register</h2>
            <p className="inv-card__subtitle">Search by English name, local name, or SKU.</p>
          </div>

          <div className="inv-filter-bar">
            <div className="inv-toggle-group">
              {(["active", "all", "inactive"] as ActiveFilter[]).map((filter) => (
                <button
                  type="button"
                  key={filter}
                  className={`inv-toggle-group__btn${
                    activeFilter === filter ? " is-active" : ""
                  }`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter === "active" ? "Active" : filter === "inactive" ? "Inactive" : "All"}
                </button>
              ))}
            </div>

            <div className="inv-search-wrap">
              <input
                className="inv-search"
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                placeholder="Search items…"
                aria-label="Search inventory items"
              />

              {rawQuery ? (
                <button
                  type="button"
                  className="inv-search-clear"
                  onClick={() => setRawQuery("")}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              ) : null}
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
                <th>Base UOM</th>
                <th>Issue UOM</th>
                <th className="num">Reorder</th>
                <th>Track</th>
                <th>Status</th>
                <th className="inv-table__actions-col" aria-label="Actions" />
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
                        searchQuery
                          ? "No matching items"
                          : activeFilter !== "all"
                            ? "No items in this filter"
                            : "No items yet"
                      }
                      subtitle={
                        searchQuery
                          ? "Try a different keyword or clear the search."
                          : activeFilter !== "all"
                            ? "Switch to All or create a new item."
                            : "Register your first inventory item to start tracking stock."
                      }
                      onNew={handleCreateNew}
                      onReset={
                        searchQuery || activeFilter !== "all" ? handleResetFilter : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const issueUomId = getIssueUomId(item);
                  const active = isItemActive(item);
                  const initials = (item.name ?? "?").slice(0, 1).toUpperCase();

                  return (
                    <tr
                      key={item.id}
                      className="is-clickable"
                      onClick={() => handleEdit(item)}
                      title="Click to edit"
                    >
                      <td>
                        <div className="inv-item-cell">
                          <div className="inv-item-avatar">{initials}</div>
                          <div>
                            <div className="inv-item-name">{item.name}</div>
                            {item.localName ? (
                              <div className="inv-item-sub" dir="auto">
                                {item.localName}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td>{item.type ? itemTypeLabel(item.type as any) : "—"}</td>
                      <td>{item.sku ?? "—"}</td>
                      <td>{uomById.get(item.baseUomId) ?? "—"}</td>
                      <td>{issueUomId ? uomById.get(issueUomId) ?? "—" : "—"}</td>
                      <td className="num">
                        {item.reorderLevel == null ? "—" : String(item.reorderLevel)}
                      </td>
                      <td>{item.trackInventory ? "Yes" : "No"}</td>
                      <td>
                        <StatusBadge active={active} />
                      </td>

                      <td>
                        <div className="inv-row-actions">
                          <button
                            type="button"
                            className="inv-btn inv-btn--sm inv-btn--outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(item);
                            }}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className={`inv-btn inv-btn--sm ${
                              active ? "inv-btn--danger" : "inv-btn--outline"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(item);
                            }}
                            disabled={saving}
                          >
                            {active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="inv-sticky-bar">
        <div className="inv-sticky-bar__count">
          Showing <b>{filteredItems.length}</b> of <b>{totalCount}</b> item(s)
          {searchQuery ? (
            <>
              {" "}
              matching &ldquo;<b>{searchQuery}</b>&rdquo;
            </>
          ) : null}
        </div>

        <div className="inv-filter-bar">
          {searchQuery || activeFilter !== "all" ? (
            <button
              type="button"
              className="inv-btn inv-btn--outline inv-btn--sm"
              onClick={handleResetFilter}
            >
              Reset filter
            </button>
          ) : null}

          <button
            type="button"
            className="inv-btn inv-btn--primary inv-btn--sm"
            onClick={handleCreateNew}
          >
            + New item
          </button>
        </div>
      </div>

      <ConfirmModal
        state={confirm}
        busy={saving}
        onConfirm={handleConfirmToggle}
        onCancel={handleCancelConfirm}
      />
    </div>
  );
}