// src/features/inventory/items/pages/InventoryItemsPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../../../i18n";

import { useAppScope } from "../../../../app/useAppScope";
import { toUserFriendlyError } from "../../../../shared/errors/errorMessage.utils";
import { inventoryItemsApi } from "../api/inventoryItemsApi";
import { itemTypeLabel } from "../constants/itemTypes";
import type { InventoryItemDto, UomDto } from "../types";

import "./inventory-items.css";

export type InventoryItemRow = InventoryItemDto;

type ActiveFilter = "all" | "active" | "inactive";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const ITEM_INDEX_KEYS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")] as const;

const inventoryItemsAmharicPhrases: Record<string, string> = {
  "Inventory items could not be loaded. Please try again.": "የኢንቬንቶሪ እቃዎችን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
  "Active": "ንቁ",
  "Inactive": "ንቁ ያልሆነ",
  "Total items": "ጠቅላላ እቃዎች",
  "Tracked": "የሚከታተሉ",
  "With reorder": "ዳግም ማዘዣ ያላቸው",
  "Item master": "የእቃ ማስተር",
  "Inventory items": "የኢንቬንቶሪ እቃዎች",
  "Manage names, base UOM, issue UOM, conversions, costing defaults, reorder levels, and status.": "ስሞችን፣ መሰረታዊ መለኪያን፣ የመውጫ መለኪያን፣ ልወጣዎችን፣ የወጪ ነባሪዎችን፣ የዳግም ማዘዣ ደረጃን እና ሁኔታን ያስተዳድሩ።",
  "Showing": "በማሳየት ላይ",
  "New item": "አዲስ እቃ",
  "Import from Excel": "ከExcel አስመጣ",
  "Retry": "እንደገና ሞክር",
  "Warning": "ማስጠንቀቂያ",
  "UOM columns may show IDs.": "የመለኪያ አምዶች ID ሊያሳዩ ይችላሉ።",
  "UOMs could not be loaded": "መለኪያዎችን መጫን አልተቻለም",
  "Item register": "የእቃዎች መዝገብ",
  "Search by English name, local name, or SKU.": "በእንግሊዝኛ ስም፣ በአካባቢ ስም ወይም SKU ይፈልጉ።",
  "All": "ሁሉም",
  "Search items...": "እቃዎችን ፈልግ...",
  "Search inventory items": "የኢንቬንቶሪ እቃዎችን ፈልግ",
  "Clear search": "ፍለጋን አጽዳ",
  "Inventory item pagination": "የኢንቬንቶሪ እቃዎች ገጽ አቀራረብ",
  "No items to show": "ለማሳየት እቃዎች የሉም",
  "of": "ከ",
  "Rows": "ረድፎች",
  "Rows per page": "በገጽ የሚታዩ ረድፎች",
  "Jump to item name initial": "ወደ እቃ ስም መጀመሪያ ፊደል ዝለል",
  "Show items starting with": "በዚህ የሚጀምሩ እቃዎችን አሳይ",
  "No items starting with": "በዚህ የሚጀምሩ እቃዎች የሉም",
  "Item": "እቃ",
  "Type": "አይነት",
  "SKU": "SKU",
  "Base UOM": "መሰረታዊ መለኪያ",
  "Issue UOM": "የመውጫ መለኪያ",
  "Reorder": "ዳግም ማዘዣ",
  "Track": "ክትትል",
  "Status": "ሁኔታ",
  "Actions": "እርምጃዎች",
  "No matching items": "የሚዛመዱ እቃዎች የሉም",
  "No items in this filter": "በዚህ ማጣሪያ ውስጥ እቃዎች የሉም",
  "No items yet": "እስካሁን እቃዎች የሉም",
  "Try a different keyword or clear the search.": "ሌላ ቁልፍ ቃል ይሞክሩ ወይም ፍለጋውን ያጽዱ።",
  "Switch to All or create a new item.": "ወደ ሁሉም ይቀይሩ ወይም አዲስ እቃ ይፍጠሩ።",
  "Register your first inventory item to start tracking stock.": "ስቶክ መከታተል ለመጀመር የመጀመሪያ የኢንቬንቶሪ እቃዎን ይመዝግቡ።",
  "Click to edit": "ለማስተካከል ጠቅ ያድርጉ",
  "Yes": "አዎ",
  "No": "አይ",
  "Edit": "አስተካክል",
  "Activate": "አንቃ",
  "Deactivate": "አቦዝን",
  "Activate item": "እቃ አንቃ",
  "Deactivate item": "እቃ አቦዝን",
  "will appear in all item pick-lists.": "በሁሉም የእቃ ምርጫ ዝርዝሮች ይታያል።",
  "will be hidden from all item pick-lists.": "ከሁሉም የእቃ ምርጫ ዝርዝሮች ይደበቃል።",
  "Cancel": "ሰርዝ",
  "Working...": "በመስራት ላይ...",
  "Clear filter": "ማጣሪያ አጽዳ",
  "Reset filter": "ማጣሪያ ዳግም አስጀምር",
  "filtered item(s), from": "የተጣሩ እቃዎች፣ ከ",
  "total": "ጠቅላላ",
  "matching": "የሚዛመድ",
  "Select a company to manage inventory items.": "የኢንቬንቶሪ እቃዎችን ለማስተዳደር ኩባንያ ይምረጡ።"
};

function inventoryItemsText(language: string, text: string): string {
  return language === "am" ? inventoryItemsAmharicPhrases[text] ?? text : text;
}

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
  return toUserFriendlyError(
    error,
    "Inventory items could not be loaded. Please try again."
  );
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
  if (!uom) return "-";

  const code = (uom as any).code ?? uom.symbol ?? "";
  return code ? `${uom.name} (${code})` : uom.name;
}

function getIssueUomId(item: InventoryItemRow): string | null {
  return item.allowedUoms?.find((u) => u.isIssue)?.uomId ?? null;
}

function getItemLetter(item: InventoryItemRow): string {
  const first = (item.name ?? "").trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}
function isItemActive(item: InventoryItemDto): boolean {
  return item.isActive == null ? true : Boolean(item.isActive);
}

function StatusBadge({ active }: { active: boolean }) {
  const { language } = useI18n();
  const tx = (text: string) => inventoryItemsText(language, text);
  return (
    <span className={`inv-badge ${active ? "inv-badge--active" : "inv-badge--inactive"}`}>
      {active ? tx("Active") : tx("Inactive")}
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
  const { language } = useI18n();
  const tx = (text: string) => inventoryItemsText(language, text);

  return (
    <div className="inv-empty">
      <div className="inv-empty__icon"></div>
      <div className="inv-empty__title">{title}</div>
      <div className="inv-empty__subtitle">{subtitle}</div>

      <div className="inv-empty__actions">
        <button type="button" className="inv-btn inv-btn--primary" onClick={onNew}>
          + {tx("New item")}
        </button>

        {onReset ? (
          <button type="button" className="inv-btn inv-btn--outline" onClick={onReset}>
            {tx("Clear filter")}
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
  const { language } = useI18n();
  const tx = (text: string) => inventoryItemsText(language, text);

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
          {activating ? tx("Activate item") : tx("Deactivate item")}
        </div>

        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          {activating ? (
            <>
              <b>{state.item.name}</b> {tx("will appear in all item pick-lists.")}
            </>
          ) : (
            <>
              <b>{state.item.name}</b> {tx("will be hidden from all item pick-lists.")}
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
            {tx("Cancel")}
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
            {busy ? tx("Working...") : activating ? tx("Activate") : tx("Deactivate")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryItemsPage() {
  const { language } = useI18n();
  const tx = (text: string) => inventoryItemsText(language, text);
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
  const [pageSize, setPageSize] = useState<number>(25);
  const [pageStartIndex, setPageStartIndex] = useState(0);

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
          setLookupError(`${tx("UOMs could not be loaded")} - ${extractApiError(e)}`);
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

  // Sort and normalize once when data changes, rather than on every search.
  const indexedItems = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
    return [...items]
      .sort((a, b) => collator.compare(a.name ?? "", b.name ?? "") || collator.compare(a.sku ?? "", b.sku ?? ""))
      .map(item => ({ item, searchFields: [item.name, item.localName, item.sku].map(value => (value ?? "").toLowerCase()) }));
  }, [items]);

  const filteredItems = useMemo(() => indexedItems
    .filter(({ item, searchFields }) => {
      const active = isItemActive(item);
      return (activeFilter === "all" || (activeFilter === "active" ? active : !active)) &&
        (!searchQuery || searchFields.some(value => value.includes(searchQuery)));
    })
    .map(({ item }) => item), [indexedItems, activeFilter, searchQuery]);

  const totalCount = items.length;
  const filteredCount = filteredItems.length;
  const clampedPageStartIndex = filteredCount === 0 ? 0 : Math.min(pageStartIndex, Math.max(0, filteredCount - 1));
  const pageStart = filteredCount === 0 ? 0 : clampedPageStartIndex + 1;
  const pageEnd = Math.min(clampedPageStartIndex + pageSize, filteredCount);
  const availableLetters = useMemo(() => {
    return new Set(filteredItems.map(getItemLetter));
  }, [filteredItems]);
  const activeLetter = filteredCount === 0 ? "" : getItemLetter(filteredItems[clampedPageStartIndex]);
  const pagedItems = useMemo(() => {
    return filteredItems.slice(clampedPageStartIndex, clampedPageStartIndex + pageSize);
  }, [filteredItems, clampedPageStartIndex, pageSize]);

  const activeCount = useMemo(() => items.filter(isItemActive).length, [items]);
  const inactiveCount = totalCount - activeCount;

  useEffect(() => {
    setPageStartIndex(0);
  }, [activeFilter, searchQuery, pageSize]);

  useEffect(() => {
    setPageStartIndex((start) => Math.min(start, Math.max(0, filteredCount - 1)));
  }, [filteredCount]);

  const handleLetterJump = useCallback(
    (letter: string) => {
      const index = filteredItems.findIndex((item) => getItemLetter(item) === letter);
      if (index >= 0) {
        setPageStartIndex(index);
      }
    },
    [filteredItems]
  );

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
          <div style={{ fontSize: 32 }}></div>
          <div>{tx("Select a company to manage inventory items.")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="inv-page">
      <div className="inv-banner">
        <div>
          <p className="inv-banner__kicker">{tx("Item master")}</p>
          <h1 className="inv-banner__title">{tx("Inventory items")}</h1>
          <p className="inv-banner__subtitle">
            {tx("Manage names, base UOM, issue UOM, conversions, costing defaults, reorder levels, and status.")}
          </p>
        </div>

        <div className="inv-banner__right">
          <div className="inv-banner__count">
            <span className="inv-banner__count-label">{tx("Showing")}</span>
            <span className="inv-banner__count-value">{filteredCount}</span>
          </div>

          <button type="button" className="inv-btn inv-btn--outline" onClick={handleCreateNew}>
            + {tx("New item")}
          </button>

          <button type="button" className="inv-btn inv-btn--outline" onClick={handleImport}>
            {tx("Import from Excel")}
          </button>
        </div>
      </div>

      <div className="inv-kpi-grid">
        <Kpi label={tx("Total items")} value={totalCount} />
        <Kpi label={tx("Active")} value={activeCount} tone="success" />
        <Kpi
          label={tx("Inactive")}
          value={inactiveCount}
          tone={inactiveCount > 0 ? "warn" : "neutral"}
        />
        <Kpi label={tx("Tracked")} value={trackedCount} />
        <Kpi label={tx("With reorder")} value={reorderCount} />
      </div>

      {submitError ? (
        <div className="inv-alert inv-alert--error" role="alert">
          {tx(submitError)}
        </div>
      ) : null}

      {itemsError ? (
        <div className="inv-alert inv-alert--error" role="alert">
          {itemsError}
          <button
            type="button"
            className="inv-btn inv-btn--sm inv-btn--outline"
            style={{ marginLeft: 12 }}
            onClick={() => void loadAll()}
          >
            {tx("Retry")}
          </button>
        </div>
      ) : null}

      {lookupError ? (
        <div className="inv-alert inv-alert--warn" role="alert">
          {tx("Warning")}: {lookupError} - {tx("UOM columns may show IDs.")}
        </div>
      ) : null}

      <div className="inv-card">
        <div className="inv-card__head">
          <div>
            <h2 className="inv-card__title">{tx("Item register")}</h2>
            <p className="inv-card__subtitle">{tx("Search by English name, local name, or SKU.")}</p>
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
                  {filter === "active" ? tx("Active") : filter === "inactive" ? tx("Inactive") : tx("All")}
                </button>
              ))}
            </div>

            <div className="inv-search-wrap">
              <input
                className="inv-search"
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                placeholder={tx("Search items...")}
                aria-label={tx("Search inventory items")}
              />

              {rawQuery ? (
                <button
                  type="button"
                  className="inv-search-clear"
                  onClick={() => setRawQuery("")}
                  aria-label={tx("Clear search")}
                >
                  
                </button>
              ) : null}
            </div>
          </div>
        </div>

      <div className="inv-pagination" aria-label={tx("Inventory item pagination")}>
        <div className="inv-pagination__summary">
          {filteredCount === 0 ? (
            tx("No items to show")
          ) : (
            <>
              {tx("Showing")} <b>{pageStart}</b>-<b>{pageEnd}</b> {tx("of")} <b>{filteredCount}</b>
            </>
          )}
        </div>

        <div className="inv-pagination__controls">
          <label className="inv-page-size">
            <span>{tx("Rows")}</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              aria-label={tx("Rows per page")}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <div className="inv-letter-index" aria-label={tx("Jump to item name initial")}>
            {ITEM_INDEX_KEYS.map((letter) => {
              const available = availableLetters.has(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  className={`inv-letter-index__btn ${activeLetter === letter ? "is-active" : ""}`}
                  onClick={() => handleLetterJump(letter)}
                  disabled={loading || !available}
                  aria-pressed={activeLetter === letter}
                  title={available ? `${tx("Show items starting with")} ${letter}` : `${tx("No items starting with")} ${letter}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      </div>

        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>{tx("Item")}</th>
                <th>{tx("Type")}</th>
                <th>{tx("SKU")}</th>
                <th>{tx("Base UOM")}</th>
                <th>{tx("Issue UOM")}</th>
                <th className="num">{tx("Reorder")}</th>
                <th>{tx("Track")}</th>
                <th>{tx("Status")}</th>
                <th className="inv-table__actions-col" aria-label={tx("Actions")} />
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
                          ? tx("No matching items")
                          : activeFilter !== "all"
                            ? tx("No items in this filter")
                            : tx("No items yet")
                      }
                      subtitle={
                        searchQuery
                          ? tx("Try a different keyword or clear the search.")
                          : activeFilter !== "all"
                            ? tx("Switch to All or create a new item.")
                            : tx("Register your first inventory item to start tracking stock.")
                      }
                      onNew={handleCreateNew}
                      onReset={
                        searchQuery || activeFilter !== "all" ? handleResetFilter : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                pagedItems.map((item) => {
                  const issueUomId = getIssueUomId(item);
                  const active = isItemActive(item);
                  const initials = (item.name ?? "?").slice(0, 1).toUpperCase();

                  return (
                    <tr
                      key={item.id}
                      className="is-clickable"
                      onClick={() => handleEdit(item)}
                      title={tx("Click to edit")}
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

                      <td>{item.type ? itemTypeLabel(item.type as any) : "-"}</td>
                      <td>{item.sku ?? "-"}</td>
                      <td>{uomById.get(item.baseUomId) ?? "-"}</td>
                      <td>{issueUomId ? uomById.get(issueUomId) ?? "-" : "-"}</td>
                      <td className="num">
                        {item.reorderLevel == null ? "-" : String(item.reorderLevel)}
                      </td>
                      <td>{item.trackInventory ? tx("Yes") : tx("No")}</td>
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
                            {tx("Edit")}
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
                            {active ? tx("Deactivate") : tx("Activate")}
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
          {tx("Showing")} <b>{pageStart}</b>-<b>{pageEnd}</b> {tx("of")} <b>{filteredCount}</b>{" "}{tx("filtered item(s), from")} <b>{totalCount}</b> {tx("total")}
          {searchQuery ? (
            <>
              {" "}
              {tx("matching")} &ldquo;<b>{searchQuery}</b>&rdquo;
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
              {tx("Reset filter")}
            </button>
          ) : null}

          <button
            type="button"
            className="inv-btn inv-btn--primary inv-btn--sm"
            onClick={handleCreateNew}
          >
            + {tx("New item")}
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
