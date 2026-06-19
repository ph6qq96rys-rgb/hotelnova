import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { itemsApi } from "../api/itemsApi";

type ApiError = {
  summary: string;
  detail?: string;
};

type ItemApiRow = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  itemType?: string | null;
  category?: string | null;
  categoryName?: string | null;
  baseUom?: string | null;
  baseUomName?: string | null;
  active?: boolean | null;
  isActive?: boolean | null;
};

type ItemRow = {
  id: string;
  name: string;
  type: string;
  category: string;
  baseUom: string;
  isActive: boolean;
};

type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded" }
  | { status: "error"; error: ApiError };

type ItemPaths = {
  ledger: string;
  newItem: string;
  importItems: string;
  itemEdit: (itemId: string) => string;
};

function safeText(value: unknown, fallback = "-"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeItem(row: ItemApiRow): ItemRow | null {
  const id = safeText(row.id, "");
  if (!id) return null;

  return {
    id,
    name: safeText(row.name, "Unnamed item"),
    type: safeText(row.type ?? row.itemType),
    category: safeText(row.category ?? row.categoryName),
    baseUom: safeText(row.baseUom ?? row.baseUomName),
    isActive: Boolean(row.active ?? row.isActive),
  };
}

function extractApiError(error: any): ApiError {
  const status: number | undefined = error?.response?.status;
  const data = error?.response?.data;

  if (!error?.response) {
    const message = String(error?.message ?? "");
    const isNetwork =
      error?.code === "ERR_NETWORK" ||
      error?.code === "ECONNREFUSED" ||
      message.toLowerCase().includes("network");

    return {
      summary: isNetwork
        ? "Cannot reach the server. Check whether the API is running."
        : message || "An unexpected error occurred.",
    };
  }

  const detail =
    data?.error ?? data?.message ?? data?.title ?? data?.detail ?? data?.inner;

  if (status === 400) {
    return { summary: "Bad request. The server rejected the item query.", detail };
  }

  if (status === 401) {
    return { summary: "Unauthorized. Please sign in again.", detail };
  }

  if (status === 403) {
    return {
      summary: "Access denied. Your user may not have item permission.",
      detail,
    };
  }

  if (status === 404) {
    return { summary: "Items endpoint not found. Check the API route.", detail };
  }

  if (status === 429) {
    return { summary: "Too many requests. Please wait and try again.", detail };
  }

  if (status != null && status >= 500) {
    return { summary: `Server error (${status}). Check API logs.`, detail };
  }

  return {
    summary: detail ?? error?.message ?? "Failed to load items.",
  };
}

export default function ItemsPage() {
  const navigate = useNavigate();
  const { companyId } = useAppScope();

  const [items, setItems] = useState<ItemRow[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [pageState, setPageState] = useState<PageState>({ status: "idle" });
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const requestIdRef = useRef(0);

  const go = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  const paths = useMemo<ItemPaths | null>(() => {
    if (!companyId) return null;

    const base = `/companies/${companyId}/inventory-master`;

    return {
      ledger: `${base}/ledger`,
      newItem: `${base}/items/new`,
      importItems: `${base}/items/import`,
      itemEdit: (itemId: string) => `${base}/items/${itemId}/edit`,
    };
  }, [companyId]);

  const isLoading = pageState.status === "loading";
  const error = pageState.status === "error" ? pageState.error : null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  const loadItems = useCallback(
    async (nextQuery = debouncedQuery): Promise<void> => {
      if (!companyId) {
        setPageState({
          status: "error",
          error: {
            summary: "Missing company scope.",
            detail: "Open this page under /companies/{companyId}/inventory-master/items.",
          },
        });
        return;
      }

      const requestId = ++requestIdRef.current;

      setPageState({ status: "loading" });

      try {
        const response = await itemsApi.list(companyId, nextQuery);

        if (requestId !== requestIdRef.current) return;

        const normalized = Array.isArray(response)
          ? response
              .map((row) => normalizeItem(row as ItemApiRow))
              .filter((row): row is ItemRow => row !== null)
          : [];

        setItems(normalized);
        setLastLoadedAt(new Date());
        setPageState({ status: "loaded" });
      } catch (e: any) {
        if (requestId !== requestIdRef.current) return;

        setItems([]);
        setPageState({
          status: "error",
          error: extractApiError(e),
        });
      }
    },
    [companyId, debouncedQuery]
  );

  useEffect(() => {
    void loadItems(debouncedQuery);
  }, [debouncedQuery, loadItems]);

  const visibleItems = useMemo(() => {
    return activeOnly ? items.filter((item) => item.isActive) : items;
  }, [items, activeOnly]);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((item) => item.isActive).length;

    return {
      total,
      active,
      inactive: total - active,
      missingCategory: items.filter((item) => item.category === "-").length,
      missingBaseUom: items.filter((item) => item.baseUom === "-").length,
    };
  }, [items]);

  const rightStatus = isLoading
    ? "Loading…"
    : error
    ? `Failed · ${new Date().toLocaleTimeString()}`
    : lastLoadedAt
    ? `Updated ${lastLoadedAt.toLocaleTimeString()}`
    : "—";

  if (!companyId || !paths) {
    return (
      <div style={pageWrap}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Missing company scope</div>
          <div style={{ marginTop: 6, ...subtleText }}>
            This page requires a valid route like{" "}
            <b>/companies/&lt;companyId&gt;/inventory-master/items</b>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={headerRow}>
        <div>
          <div style={titleStyle}>Item Enrollment</div>
          <div style={subtitleStyle}>
            Register, manage, and review inventory catalog items.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={secondaryBtn} onClick={() => go(paths.ledger)}>
            View Ledger
          </button>

          <button type="button" style={secondaryBtn} onClick={() => go(paths.importItems)}>
            Import
          </button>

          <button type="button" style={primaryBtn} onClick={() => go(paths.newItem)}>
            + New Item
          </button>
        </div>
      </div>

      <div style={kpiGrid}>
        <Kpi label="Total items" value={stats.total} tone="neutral" />
        <Kpi label="Active" value={stats.active} tone="success" />
        <Kpi label="Inactive" value={stats.inactive} tone="neutral" />
        <Kpi label="Missing category" value={stats.missingCategory} tone="warn" />
        <Kpi label="Missing base UOM" value={stats.missingBaseUom} tone="warn" />
      </div>

      <div style={cardStyle}>
        <div style={cardHeader}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Search & Filters</div>
            <div style={{ marginTop: 4, ...subtleText }}>
              Search by name, category, or type depending on API support.
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: error ? 1 : 0.7,
              color: error ? "rgb(185,28,28)" : "inherit",
            }}
          >
            {rightStatus}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 8" }}>
            <label style={labelStyle}>Search</label>
            <input
              style={inputStyle}
              placeholder="Search items…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div style={{ marginTop: 6, ...subtleText }}>
              Tip: use short keywords for faster results.
            </div>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>Status</label>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={activeOnly ? primaryBtnSm : secondaryBtnSm}
                onClick={() => setActiveOnly(true)}
              >
                Active only
              </button>

              <button
                type="button"
                style={!activeOnly ? primaryBtnSm : secondaryBtnSm}
                onClick={() => setActiveOnly(false)}
              >
                All
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <div style={subtleText}>
                Showing: <b style={{ opacity: 1 }}>{visibleItems.length}</b>
              </div>

              <button
                type="button"
                style={{ ...secondaryBtnSm, padding: "6px 10px" }}
                onClick={() => {
                  setQuery("");
                  setActiveOnly(true);
                }}
              >
                Reset
              </button>
            </div>

            {error ? <ErrorBanner error={error} onRetry={() => void loadItems()} /> : null}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeader}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Item Register</div>
            <div style={{ marginTop: 4, ...subtleText }}>
              Click a row to edit the item inside the current company workspace.
            </div>
          </div>

          <button
            type="button"
            style={isLoading ? { ...secondaryBtn, ...disabledBtn } : secondaryBtn}
            onClick={() => void loadItems()}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 360 }}>Item</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Base UOM</th>
                <th style={{ ...thStyle, width: 140 }}>Status</th>
                <th style={{ ...thStyle, width: 120 }} />
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : null}

              {!isLoading && visibleItems.length === 0 ? (
                <tr>
                  <td style={{ ...tdStyle, padding: 18 }} colSpan={6}>
                    <EmptyState
                      title={
                        debouncedQuery
                          ? "No matching items found"
                          : activeOnly
                          ? "No active items"
                          : "No items yet"
                      }
                      subtitle={
                        debouncedQuery
                          ? "Try a different keyword or clear search."
                          : activeOnly
                          ? "Switch to All to see inactive items, or create a new item."
                          : "Register your first item to start tracking inventory."
                      }
                      actionText="+ New Item"
                      onAction={() => go(paths.newItem)}
                      secondaryText={
                        debouncedQuery ? "Clear search" : activeOnly ? "Show all" : undefined
                      }
                      onSecondary={
                        debouncedQuery
                          ? () => setQuery("")
                          : activeOnly
                          ? () => setActiveOnly(false)
                          : undefined
                      }
                    />
                  </td>
                </tr>
              ) : null}

              {!isLoading &&
                visibleItems.map((item) => (
                  <ItemTableRow
                    key={item.id}
                    item={item}
                    onOpen={(itemId) => go(paths.itemEdit(itemId))}
                  />
                ))}
            </tbody>
          </table>
        </div>

        <div style={footerActions}>
          <div style={subtleText}>
            Tip: keep Base UOM consistent for accurate costing and stock movement.
          </div>

          <button type="button" style={secondaryBtn} onClick={() => go(paths.newItem)}>
            + New Item
          </button>
        </div>
      </div>

      <div style={stickyBar}>
        <div style={subtleText}>
          Showing <b style={{ opacity: 1 }}>{visibleItems.length}</b> item(s)
          {debouncedQuery ? (
            <>
              {" "}
              for <b style={{ opacity: 1 }}>{debouncedQuery}</b>
            </>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={secondaryBtn}
            onClick={() => {
              setQuery("");
              setActiveOnly(true);
            }}
          >
            Reset
          </button>

          <button type="button" style={primaryBtn} onClick={() => go(paths.newItem)}>
            + New Item
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <div style={errorBannerStyle}>
      <div style={{ fontWeight: 800, marginBottom: 2 }}>{error.summary}</div>

      {error.detail ? (
        <div
          style={{
            opacity: 0.8,
            marginTop: 4,
            fontFamily: "monospace",
            fontSize: 11.5,
            wordBreak: "break-word",
          }}
        >
          {error.detail}
        </div>
      ) : null}

      <button type="button" style={linkButtonDanger} onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function ItemTableRow({
  item,
  onOpen,
}: {
  item: ItemRow;
  onOpen: (itemId: string) => void;
}) {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <tr
      style={{
        cursor: "pointer",
        background: isHovering ? "rgba(15, 23, 42, 0.03)" : "transparent",
      }}
      onClick={() => onOpen(item.id)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <td style={tdStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={avatarStyle}>{item.name.slice(0, 1).toUpperCase()}</div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: "#0f172a" }}>{item.name}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {item.category !== "-" ? item.category : "No category"} •{" "}
              {item.baseUom !== "-" ? `Base: ${item.baseUom}` : "No base UOM"}
            </div>
          </div>
        </div>
      </td>

      <td style={tdStyle}>{item.type}</td>
      <td style={tdStyle}>{item.category}</td>
      <td style={tdStyle}>{item.baseUom}</td>
      <td style={tdStyle}>
        <span style={statusBadge(item.isActive)}>
          {item.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        <button
          type="button"
          style={secondaryBtnSm}
          onClick={(event) => {
            event.stopPropagation();
            onOpen(item.id);
          }}
        >
          Edit
        </button>
      </td>
    </tr>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warn";
}) {
  const toneBorder =
    tone === "success"
      ? "1px solid rgba(16,185,129,0.28)"
      : tone === "warn"
      ? "1px solid rgba(245,158,11,0.28)"
      : "1px solid rgba(0,0,0,0.10)";

  const toneBg =
    tone === "success"
      ? "rgba(16,185,129,0.07)"
      : tone === "warn"
      ? "rgba(245,158,11,0.08)"
      : "white";

  const toneColor =
    tone === "success"
      ? "rgba(4,120,87,1)"
      : tone === "warn"
      ? "rgba(120,53,15,1)"
      : "rgba(15,23,42,0.85)";

  return (
    <div style={{ ...kpiCardBase, border: toneBorder, background: toneBg }}>
      <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6, color: toneColor }}>
        {value}
      </div>
    </div>
  );
}

function SkeletonRow() {
  const sk: React.CSSProperties = {
    height: 10,
    borderRadius: 999,
    background: "rgba(15,23,42,0.08)",
  };

  return (
    <tr>
      <td style={tdStyle}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={skeletonAvatarStyle} />
          <div style={{ flex: 1 }}>
            <div style={{ ...sk, width: 220 }} />
            <div style={{ ...sk, width: 160, marginTop: 8 }} />
          </div>
        </div>
      </td>
      <td style={tdStyle}><div style={{ ...sk, width: 90 }} /></td>
      <td style={tdStyle}><div style={{ ...sk, width: 120 }} /></td>
      <td style={tdStyle}><div style={{ ...sk, width: 80 }} /></td>
      <td style={tdStyle}><div style={{ ...sk, width: 90, height: 22 }} /></td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        <div style={{ ...sk, width: 70, height: 28, marginLeft: "auto" }} />
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
    <div style={{ padding: "22px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 34 }}>📦</div>
      <div style={{ marginTop: 10, fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
        {title}
      </div>
      <div style={{ marginTop: 6, fontSize: 12.5, opacity: 0.75 }}>
        {subtitle}
      </div>

      <div style={emptyActionsStyle}>
        <button type="button" style={primaryBtn} onClick={onAction}>
          {actionText}
        </button>

        {secondaryText && onSecondary ? (
          <button type="button" style={secondaryBtn} onClick={onSecondary}>
            {secondaryText}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function statusBadge(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: active
      ? "1px solid rgba(16,185,129,0.35)"
      : "1px solid rgba(0,0,0,0.15)",
    background: active ? "rgba(16,185,129,0.12)" : "rgba(0,0,0,0.04)",
    color: active ? "rgba(4,120,87,1)" : "rgba(15,23,42,0.8)",
  };
}

/* styles */

const pageWrap: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "18px 14px 28px",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
};

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: "-0.3px",
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12.5,
  opacity: 0.75,
  color: "#0f172a",
};

const cardStyle: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
  padding: 14,
  background: "white",
  color: "#0f172a",
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  paddingBottom: 12,
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  marginBottom: 12,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#181822ff",
  opacity: 0.75,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  outline: "none",
  background: "white",
  color: "#0f172a",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
  overflow: "hidden",
};

const thStyle: React.CSSProperties = {
  padding: "12px 12px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#F8FAFC",
  background: "#373738ff",
  borderBottom: "1px solid #E2E8F0",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  verticalAlign: "top",
  color: "#0f172a",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "black",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "white",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
};

const primaryBtnSm: React.CSSProperties = {
  ...primaryBtn,
  padding: "8px 10px",
};

const secondaryBtnSm: React.CSSProperties = {
  ...secondaryBtn,
  padding: "8px 10px",
};

const disabledBtn: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
};

const kpiGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  marginTop: 14,
};

const kpiCardBase: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.10)",
  padding: 12,
  background: "white",
  color: "#0f172a",
};

const stickyBar: React.CSSProperties = {
  position: "sticky",
  bottom: 0,
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const subtleText: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
};

const errorBannerStyle: React.CSSProperties = {
  marginTop: 4,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(220,38,38,0.25)",
  background: "rgba(220,38,38,0.06)",
  color: "rgb(185,28,28)",
  fontSize: 12.5,
};

const footerActions: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const linkButtonDanger: React.CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  background: "none",
  border: "none",
  color: "rgb(185,28,28)",
  padding: 0,
  textDecoration: "underline",
};

const avatarStyle: React.CSSProperties = {
  height: 36,
  width: 36,
  borderRadius: 10,
  background: "rgba(15, 23, 42, 0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  color: "rgba(15, 23, 42, 0.7)",
};

const skeletonAvatarStyle: React.CSSProperties = {
  height: 36,
  width: 36,
  borderRadius: 10,
  background: "rgba(15,23,42,0.06)",
};

const emptyActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 8,
  marginTop: 14,
  flexWrap: "wrap",
};