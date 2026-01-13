import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { itemsApi } from "../api/itemsApi";
import { useAppScope } from "../../../../app/useAppScope";

/**
 * GRN-style (production-ready) Items list page
 * - Header + actions
 * - KPI summary cards
 * - Filter/Search card
 * - Clean table with empty/loading/error states
 * - No IDs shown in UI
 */
export default function ItemsPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();

  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input (GRN-style UX: avoids calling API on every keystroke)
  const [qDebounced, setQDebounced] = useState(q);
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!companyId) return;
      try {
        setLoading(true);
        setError(null);

        // Keep your backend signature; if you later add activeOnly, pass it.
        // Example: itemsApi.list(companyId, qDebounced, { activeOnly })
        const data = await itemsApi.list(companyId, qDebounced);

        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load items.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, qDebounced]);

  const visibleItems = useMemo(() => {
    const src = Array.isArray(items) ? items : [];
    return activeOnly ? src.filter((x) => !!x.active) : src;
  }, [items, activeOnly]);

  const stats = useMemo(() => {
    const src = Array.isArray(items) ? items : [];
    const total = src.length;
    const active = src.filter((x) => !!x.active).length;
    const inactive = total - active;

    // Optional “data quality” KPIs (safe even if fields don’t exist)
    const missingCategory = src.filter((x) => !x.category).length;
    const missingBaseUom = src.filter((x) => !x.baseUom).length;

    return { total, active, inactive, missingCategory, missingBaseUom };
  }, [items]);

  if (!companyId) {
    return (
      <div className="page">
        <div className="card p-4">
          <div className="text-sm font-semibold text-slate-900">Select a company</div>
          <div className="text-xs text-slate-500 mt-1">
            Choose your company context to view inventory items.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Page Header (GRN style) */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xl font-bold text-slate-900">Inventory Items</div>
          <div className="text-xs text-slate-500">
            Register, manage and review your item catalog (ingredients, stock items, packaging, services).
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-outline" onClick={() => nav("/inventory/ledger")}>
            View Ledger
          </button>
          <button className="btn btn-primary" onClick={() => nav("new")}>
            + New Item
          </button>
        </div>
      </div>

      {/* KPI Row (GRN style) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Kpi label="Total items" value={stats.total} />
        <Kpi label="Active" value={stats.active} tone="success" />
        <Kpi label="Inactive" value={stats.inactive} tone="neutral" />
        <Kpi label="Missing category" value={stats.missingCategory} tone="warn" />
        <Kpi label="Missing base UOM" value={stats.missingBaseUom} tone="warn" />
      </div>

      {/* Filters Card (GRN style) */}
      <div className="card">
        <div className="p-4 md:p-5 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-900">Search & Filters</div>
          <div className="text-xs text-slate-500 mt-1">
            Search by name, category, type, SKU/barcode (if supported by backend).
          </div>
        </div>

        <div className="p-4 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8">
              <label className="label">Search</label>
              <input
                className="input w-full"
                placeholder="Search items… (e.g., Flour, Coca Cola, Packaging)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="mt-1 text-[11px] text-slate-500">
                Tip: use short keywords for faster results.
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="label">Status</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={activeOnly ? "btn btn-primary w-full" : "btn btn-outline w-full"}
                  onClick={() => setActiveOnly(true)}
                >
                  Active only
                </button>
                <button
                  type="button"
                  className={!activeOnly ? "btn btn-primary w-full" : "btn btn-outline w-full"}
                  onClick={() => setActiveOnly(false)}
                >
                  All
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  Showing: <span className="font-semibold text-slate-700">{visibleItems.length}</span>
                </div>
                <button
                  type="button"
                  className="text-xs text-slate-700 hover:underline"
                  onClick={() => {
                    setQ("");
                    setActiveOnly(true);
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Loading/Error */}
          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Table Card (GRN style) */}
      <div className="card mt-4">
        <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-slate-900">Item Register</div>
            <div className="text-xs text-slate-500 mt-1">
              Click a row to open details. Use “New Item” to register a new catalog entry.
            </div>
          </div>

          {loading ? (
            <div className="text-xs text-slate-500">Loading…</div>
          ) : (
            <div className="text-xs text-slate-500">
              Updated just now
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 320 }}>Item</th>
                <th>Type</th>
                <th>Category</th>
                <th>Base UOM</th>
                <th style={{ width: 140 }}>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!loading && visibleItems.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title={qDebounced ? "No matching items found" : "No items yet"}
                      subtitle={
                        qDebounced
                          ? "Try a different keyword or clear filters."
                          : "Register your first item to start tracking inventory."
                      }
                      actionText="+ New Item"
                      onAction={() => nav("new")}
                      secondaryText={qDebounced ? "Clear search" : undefined}
                      onSecondary={() => setQ("")}
                    />
                  </td>
                </tr>
              )}

              {!loading &&
                visibleItems.map((i) => {
                  const name = i.name ?? "Unnamed item";
                  const type = i.type ?? "-";
                  const category = i.category ?? "-";
                  const baseUom = i.baseUom ?? "-";
                  const active = !!i.active;

                  return (
                    <tr
                      key={i.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => nav(String(i.id))}
                      title="Open item details"
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 text-sm">
                            {String(name).slice(0, 1).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{name}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {category !== "-" ? category : "No category"} • {baseUom !== "-" ? `Base: ${baseUom}` : "No base UOM"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="text-slate-700">{type}</td>
                      <td className="text-slate-700">{category}</td>
                      <td className="text-slate-700">{baseUom}</td>
                      <td>
                        <span className={active ? "badge green" : "badge gray"}>
                          {active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Footer (GRN style) */}
        <div className="p-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="text-xs text-slate-500">
            Tip: keep Base UOM consistent for accurate costing and stock movements.
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline" onClick={() => nav("new")}>
              + New Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- UI Bits ------------------------------- */

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warn";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : tone === "warn"
      ? "border-amber-100 bg-amber-50 text-amber-700"
      : "border-slate-100 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-2xl border ${toneClass}`}>
      <div className="p-3">
        <div className="text-[11px] font-semibold opacity-80">{label}</div>
        <div className="text-xl font-bold mt-1">{value}</div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      <td>
        <div className="flex items-center gap-3 py-2">
          <div className="h-9 w-9 rounded-xl bg-slate-100 animate-pulse" />
          <div className="flex-1">
            <div className="h-3 w-56 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-40 bg-slate-100 rounded mt-2 animate-pulse" />
          </div>
        </div>
      </td>
      <td>
        <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
      </td>
      <td>
        <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
      </td>
      <td>
        <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
      </td>
      <td>
        <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
      </td>
    </tr>
  );
}

function EmptyState({
  title,
  subtitle,
  actionText,
  onAction,
  secondaryText,
  onSecondary,
}: {
  title: string;
  subtitle: string;
  actionText: string;
  onAction: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="py-10 flex flex-col items-center text-center">
      <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
        📦
      </div>
      <div className="mt-3 text-sm font-bold text-slate-900">{title}</div>
      <div className="mt-1 text-xs text-slate-500 max-w-md">{subtitle}</div>

      <div className="mt-4 flex items-center gap-2">
        <button className="btn btn-primary" onClick={onAction}>
          {actionText}
        </button>
        {secondaryText && onSecondary && (
          <button className="btn btn-outline" onClick={onSecondary}>
            {secondaryText}
          </button>
        )}
      </div>
    </div>
  );
}
