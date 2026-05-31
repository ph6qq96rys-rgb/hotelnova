import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { itemsApi } from "../api/itemsApi";
import { useAppScope } from "../../../../app/useAppScope";

/* ===================== GRN STYLE (your kit) ===================== */

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

const inputStyle = (invalid: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: invalid ? "1px solid rgba(220, 38, 38, 0.9)" : "1px solid rgba(0,0,0,0.15)",
  outline: "none",
  background: "white",
  color: "#0f172a",
});

const errorStyle: React.CSSProperties = {
  color: "rgb(220, 38, 38)",
  fontSize: 12,
  marginTop: 6,
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

const primaryBtnSm: React.CSSProperties = { ...primaryBtn, padding: "8px 10px" };

const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "white",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtnSm: React.CSSProperties = { ...secondaryBtn, padding: "8px 10px" };

const kpiGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
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
};

const badge = (active: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  border: active ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(0,0,0,0.15)",
  background: active ? "rgba(16,185,129,0.12)" : "rgba(0,0,0,0.04)",
  color: active ? "rgba(4,120,87,1)" : "rgba(15,23,42,0.8)",
});

const subtleText: React.CSSProperties = { fontSize: 12, opacity: 0.7 };

// ── Error banner styles ──────────────────────────────────────────────────────

const errorBannerStyle: React.CSSProperties = {
  marginTop: 4,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(220,38,38,0.25)",
  background: "rgba(220,38,38,0.06)",
  color: "rgb(185,28,28)",
  fontSize: 12.5,
};

const errorBannerTitle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 2,
};

const errorBannerDetail: React.CSSProperties = {
  opacity: 0.8,
  marginTop: 4,
  fontFamily: "monospace",
  fontSize: 11.5,
  wordBreak: "break-word",
};

// ── Structured error type ─────────────────────────────────────────────────────

type ApiError = {
  /** Short human-readable summary shown as the banner title. */
  summary: string;
  /**
   * Optional detail line — comes from the backend `error` field or the
   * inner exception message. Shown in a smaller monospace line so it doesn't
   * overwhelm the UI but is still copy-pasteable for bug reports.
   */
  detail?: string;
};

/**
 * Extracts a structured error from any thrown value.
 *
 * Priority order for the summary:
 *   1. Status-code-aware message (401 / 403 / 404 / 429 / 5xx)
 *   2. Backend `error` field  (our Program.cs exception handler shape)
 *   3. Backend `message` or `title` fields (ASP.NET ProblemDetails shape)
 *   4. Network / connectivity error (no HTTP response at all)
 *   5. Generic Axios message as a last resort
 *
 * The `detail` field surfaces the raw backend message so developers can
 * see the actual exception text without opening DevTools.
 */
function extractApiError(e: any): ApiError {
  const status: number | undefined = e?.response?.status;
  const data = e?.response?.data;

  // ── Network / no response ──────────────────────────────────────────────────
  if (!e?.response) {
    const isNetwork =
      e?.code === "ERR_NETWORK" ||
      e?.code === "ECONNREFUSED" ||
      e?.message?.toLowerCase().includes("network");

    return {
      summary: isNetwork
        ? "Cannot reach the server — check your connection or whether the API is running."
        : e?.message ?? "An unexpected error occurred.",
    };
  }

  // ── Known status codes ─────────────────────────────────────────────────────
  const statusSummary = ((): string | null => {
    if (status === 400) return "Bad request — the server rejected the query parameters.";
    if (status === 401) return "Unauthorized — your session may have expired. Please sign in again.";
    if (status === 403) return "Access denied — you don't have permission to view items.";
    if (status === 404) return "Items endpoint not found — the API route may have changed.";
    if (status === 429) return "Too many requests — please wait a moment and try again.";
    if (status != null && status >= 500) return `Server error (${status}) — check the API logs for details.`;
    return null;
  })();

  // ── Backend message fields ─────────────────────────────────────────────────
  // Our Program.cs exception handler emits: { error, inner, detail }
  // ASP.NET ProblemDetails emits:           { title, detail, errors }
  const backendMessage: string | undefined =
    data?.error ??      // our handler
    data?.message ??    // generic convention
    data?.title ??      // ProblemDetails
    undefined;

  const backendDetail: string | undefined =
    data?.inner ??      // our handler (dev only)
    data?.detail ??     // our handler (dev only) / ProblemDetails
    undefined;

  if (statusSummary) {
    return {
      summary: statusSummary,
      // If the backend also sent a message, surface it as detail so devs
      // can see the specific exception without opening the network tab.
      detail: backendMessage ?? backendDetail,
    };
  }

  // ── Fallback: use whatever the backend sent ────────────────────────────────
  return {
    summary: backendMessage ?? e?.message ?? "Failed to load items.",
    detail: backendDetail,
  };
}

// ── Row types ─────────────────────────────────────────────────────────────────

type ItemRow = {
  id: string;
  name?: string;
  type?: string;
  category?: string;
  baseUom?: string;

  // tolerate multiple backend names
  active?: boolean;
  isActive?: boolean;

  categoryName?: string;
  baseUomName?: string;
};

function pickActive(x: any) {
  return !!(x?.active ?? x?.isActive);
}
function pickCategory(x: any) {
  return x?.category ?? x?.categoryName ?? "-";
}
function pickBaseUom(x: any) {
  return x?.baseUom ?? x?.baseUomName ?? "-";
}

/* ===================== PAGE ===================== */

export default function ItemsPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();

  const [items, setItems] = useState<ItemRow[]>([]);
  const [q, setQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  // Debounce search input (GRN-style UX)
  const [qDebounced, setQDebounced] = useState(q);
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = async (cid: string, query: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await itemsApi.list(cid, query);
      setItems(Array.isArray(data) ? (data as any) : []);
      setLastLoadedAt(new Date());
    } catch (e: any) {
      setError(extractApiError(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    (async () => {
      if (cancelled) return;
      await load(companyId, qDebounced);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, qDebounced]);

  const visibleItems = useMemo(() => {
    const src = Array.isArray(items) ? items : [];
    return activeOnly ? src.filter(pickActive) : src;
  }, [items, activeOnly]);

  const stats = useMemo(() => {
    const src = Array.isArray(items) ? items : [];
    const total = src.length;
    const active = src.filter(pickActive).length;
    const inactive = total - active;
    const missingCategory = src.filter((x) => pickCategory(x) === "-" || !pickCategory(x)).length;
    const missingBaseUom = src.filter((x) => pickBaseUom(x) === "-" || !pickBaseUom(x)).length;
    return { total, active, inactive, missingCategory, missingBaseUom };
  }, [items]);

  if (!companyId) {
    return (
      <div style={pageWrap}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Select a company</div>
          <div style={{ marginTop: 6, ...subtleText }}>Choose your company context to view inventory items.</div>
        </div>
      </div>
    );
  }

  const rightStatus =
    loading
      ? "Loading…"
      : error
      ? `Failed · ${new Date().toLocaleTimeString()}`
      : lastLoadedAt
      ? `Updated ${lastLoadedAt.toLocaleTimeString()}`
      : "—";

  return (
    <div style={pageWrap}>
      {/* Header */}
      <div style={headerRow}>
        <div>
          <div style={titleStyle}>Item Enrollment</div>
          <div style={subtitleStyle}>
            Register, manage and review your item catalog (ingredients, stock items, packaging, services).
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={secondaryBtn} onClick={() => nav("/inventory/ledger")}>
            View Ledger
          </button>
          <button style={primaryBtn} onClick={() => nav("new")}>
            + New Item
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={kpiGrid}>
        <Kpi label="Total items" value={stats.total} tone="neutral" />
        <Kpi label="Active" value={stats.active} tone="success" />
        <Kpi label="Inactive" value={stats.inactive} tone="neutral" />
        <Kpi label="Missing category" value={stats.missingCategory} tone="warn" />
        <Kpi label="Missing base UOM" value={stats.missingBaseUom} tone="warn" />
      </div>

      {/* Search & Filters */}
      <div style={cardStyle}>
        <div style={cardHeader}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Search & Filters</div>
            <div style={{ marginTop: 4, ...subtleText }}>
              Search by name (and optionally category/type if your backend supports it).
            </div>
          </div>

          <div style={{ fontSize: 12, opacity: error ? 1 : 0.7, color: error ? "rgb(185,28,28)" : "inherit" }}>
            {rightStatus}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 8" }}>
            <label style={labelStyle}>Search</label>
            <input
              style={inputStyle(false)}
              placeholder="Search items… (e.g., Flour, Coca Cola, Packaging)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div style={{ marginTop: 6, ...subtleText }}>Tip: use short keywords for faster results.</div>
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

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, alignItems: "center" }}>
              <div style={subtleText}>
                Showing: <b style={{ opacity: 1 }}>{visibleItems.length}</b>
              </div>
              <button
                type="button"
                style={{ ...secondaryBtnSm, padding: "6px 10px" }}
                onClick={() => {
                  setQ("");
                  setActiveOnly(true);
                }}
              >
                Reset
              </button>
            </div>

            {/* ── Error banner ──────────────────────────────────────────────── */}
            {error && (
              <div style={errorBannerStyle}>
                <div style={errorBannerTitle}>{error.summary}</div>
                {error.detail && (
                  <div style={errorBannerDetail}>{error.detail}</div>
                )}
                <button
                  type="button"
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                    color: "rgb(185,28,28)",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                  onClick={() => companyId && load(companyId, qDebounced)}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={cardStyle}>
        <div style={cardHeader}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Item Register</div>
            <div style={{ marginTop: 4, ...subtleText }}>
              Click a row to open details. Use "New Item" to register a new catalog entry.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={secondaryBtn}
              onClick={() => companyId && load(companyId, qDebounced)}
              disabled={loading}
              title="Refresh"
            >
              Refresh
            </button>
          </div>
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
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!loading && visibleItems.length === 0 && (() => {
                const emptyTitle = qDebounced
                  ? "No matching items found"
                  : activeOnly ? "No active items" : "No items yet";

                const emptySubtitle = qDebounced
                  ? "Try a different keyword or clear search."
                  : activeOnly
                  ? 'Switch to “All” to see inactive items, or create a new item.'
                  : "Register your first item to start tracking inventory.";

                const emptySecondaryText: string | undefined = qDebounced
                  ? "Clear search"
                  : activeOnly ? "Show all" : undefined;

                const emptyOnSecondary: (() => void) | undefined = qDebounced
                  ? () => setQ("")
                  : activeOnly ? () => setActiveOnly(false) : undefined;

                return (
                  <tr>
                    <td style={{ ...tdStyle, padding: 18 }} colSpan={6}>
                      <EmptyState
                        title={emptyTitle}
                        subtitle={emptySubtitle}
                        actionText="+ New Item"
                        onAction={() => nav("new")}
                        secondaryText={emptySecondaryText}
                        onSecondary={emptyOnSecondary}
                      />
                    </td>
                  </tr>
                );
              })()}

              {!loading &&
                visibleItems.map((i) => {
                  const name = i.name ?? "Unnamed item";
                  const type = i.type ?? "-";
                  const category = pickCategory(i);
                  const baseUom = pickBaseUom(i);
                  const active = pickActive(i);

                  const rowHover: React.CSSProperties = { cursor: "pointer" };

                  return (
                    <tr
                      key={i.id}
                      style={rowHover}
                      onClick={() => nav(String(i.id))}
                      title="Open item details"
                      onMouseEnter={(e) => {
                        (e.currentTarget as any).style.background = "rgba(15, 23, 42, 0.03)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as any).style.background = "transparent";
                      }}
                    >
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              height: 36,
                              width: 36,
                              borderRadius: 10,
                              background: "rgba(15, 23, 42, 0.06)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              color: "rgba(15, 23, 42, 0.7)",
                            }}
                          >
                            {String(name).slice(0, 1).toUpperCase()}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, color: "#0f172a" }}>{name}</div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                              {category !== "-" ? category : "No category"} •{" "}
                              {baseUom !== "-" ? `Base: ${baseUom}` : "No base UOM"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={tdStyle}>{type}</td>
                      <td style={tdStyle}>{category}</td>
                      <td style={tdStyle}>{baseUom}</td>
                      <td style={tdStyle}>
                        <span style={badge(active)}>{active ? "Active" : "Inactive"}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button
                          style={secondaryBtnSm}
                          onClick={(e) => {
                            e.stopPropagation();
                            nav(String(i.id));
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={subtleText}>Tip: keep Base UOM consistent for accurate costing and stock movements.</div>
          <button style={secondaryBtn} onClick={() => nav("new")}>
            + New Item
          </button>
        </div>
      </div>

      {/* Sticky actions (GRN-style) */}
      <div style={stickyBar}>
        <div style={subtleText}>
          Showing <b style={{ opacity: 1 }}>{visibleItems.length}</b> item(s)
          {qDebounced ? (
            <>
              {" "}
              for "<b style={{ opacity: 1 }}>{qDebounced}</b>"
            </>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            style={secondaryBtn}
            onClick={() => {
              setQ("");
              setActiveOnly(true);
            }}
          >
            Reset
          </button>
          <button style={primaryBtn} onClick={() => nav("new")}>
            + New Item
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== UI Bits ===================== */

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
    tone === "success" ? "rgba(16,185,129,0.07)" : tone === "warn" ? "rgba(245,158,11,0.08)" : "white";

  const toneColor =
    tone === "success" ? "rgba(4,120,87,1)" : tone === "warn" ? "rgba(120,53,15,1)" : "rgba(15,23,42,0.85)";

  return (
    <div style={{ ...kpiCardBase, border: toneBorder, background: toneBg }}>
      <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6, color: toneColor }}>{value}</div>
    </div>
  );
}

function SkeletonRow() {
  const sk: React.CSSProperties = {
    height: 10,
    borderRadius: 999,
    background: "rgba(15,23,42,0.08)",
    animation: "pulse 1.2s ease-in-out infinite",
  };

  return (
    <tr>
      <td style={tdStyle}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ height: 36, width: 36, borderRadius: 10, background: "rgba(15,23,42,0.06)" }} />
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
      <td style={{ ...tdStyle, textAlign: "right" }}><div style={{ ...sk, width: 70, height: 28, marginLeft: "auto" }} /></td>
    </tr>
  );
}

function EmptyState(props: {
  title: string;
  subtitle: string;
  actionText: string;
  onAction: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
}) {
  const { title, subtitle, actionText, onAction, secondaryText, onSecondary } = props;

  return (
    <div style={{ padding: "22px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 34 }}>📦</div>
      <div style={{ marginTop: 10, fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 12.5, opacity: 0.75 }}>{subtitle}</div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button style={primaryBtn} onClick={onAction}>
          {actionText}
        </button>
        {secondaryText != null && onSecondary != null ? (
          <button style={secondaryBtn} onClick={onSecondary}>
            {secondaryText}
          </button>
        ) : null}
      </div>
    </div>
  );
}