// src/features/inventory/siv/pages/SivListPage.tsx
//
// Wired to GET /api/companies/{companyId}/siv via sivApi.getList.
// Debounced search, status filter tabs, sortable columns, pagination.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useErpNavigate }                             from "../../../../routes/useErpNavigation";
import { useAppScope }                                 from "../../../../app/useAppScope";
import { sivApi }                                      from "../api/sivApi";
import {
  sivApprovalPath,
  sivCreatePath,
  sivDraftPath,
  sivOpenPath,
} from "../utils/sivWorkflowRoutes";
import {
  normalizeStatus, STATUS_BADGE,
  mapToListItem, fmtDate, fmtQty, getApiError,
  type SivListItemDto, type PagedResult,
}                                                      from "../types/sivTypes";
import "./siv-draft.css";

// '-' Helpers '-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-'

function normalizePaged(input: unknown): PagedResult<SivListItemDto> {
  const raw = input as any;
  const rawItems = Array.isArray(raw)             ? raw
    :              Array.isArray(raw?.items)       ? raw.items
    :              Array.isArray(raw?.data?.items) ? raw.data.items
    :              Array.isArray(raw?.data)        ? raw.data
    :              [];
  return {
    items:      rawItems.map(mapToListItem).filter(Boolean) as SivListItemDto[],
    page:       Number(raw?.page       ?? 1),
    pageSize:   Number(raw?.pageSize   ?? 20),
    totalCount: Number(raw?.totalCount ?? rawItems.length),
  };
}

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

type FilterState = {
  q:         string;
  docStatus: string;
  dateFrom:  string;
  dateTo:    string;
  pageSize:  number;
};

const DEFAULT_FILTERS: FilterState = {
  q: "", docStatus: "", dateFrom: "", dateTo: "", pageSize: 20,
};

// Tab config ' drives the status filter tabs above the table
const STATUS_TABS = [
  { value: "",                 label: "All" },
  { value: "Draft",            label: "Draft" },
  { value: "Submitted",        label: "Submitted" },
  { value: "Approved",         label: "Approved" },
  { value: "Issued",           label: "Issued" },
  { value: "Posted",           label: "Posted" },
  { value: "Rejected",         label: "Rejected" },
  { value: "ChangesRequested", label: "Changes Requested" },
];

// '-' Component '-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-'

export default function SivListPage() {
  const nav = useErpNavigate();
  const { companyId, branchId } = useAppScope();

  const [filters,  setFilters]  = useState<FilterState>(DEFAULT_FILTERS);
  const [page,     setPage]     = useState(1);
  const [result,   setResult]   = useState<PagedResult<SivListItemDto>>({
    items: [], page: 1, pageSize: 20, totalCount: 0,
  });
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState<string | null>(null);

  const debouncedQ = useDebouncedValue(filters.q);
  const hasInvalidDateRange =
    Boolean(filters.dateFrom && filters.dateTo) && filters.dateFrom > filters.dateTo;

// Load

  const load = useCallback(async () => {
    if (!companyId || hasInvalidDateRange) return;
    setLoading(true);
    setErr(null);
    try {
      const raw = await sivApi.getList(companyId, {
        branchId:   branchId    || undefined,
        q:          debouncedQ  || undefined,
        docStatus:  filters.docStatus || undefined,
        dateFrom:   filters.dateFrom  || undefined,
        dateTo:     filters.dateTo    || undefined,
        page,
        pageSize:   filters.pageSize,
      });
      setResult(normalizePaged(raw));
    } catch (e) {
      setErr(getApiError(e, "Failed to load SIV list."));
    } finally {
      setLoading(false);
    }
  }, [
    companyId, branchId, debouncedQ,
    filters.docStatus, filters.dateFrom, filters.dateTo,
    filters.pageSize, page, hasInvalidDateRange,
  ]);

  useEffect(() => { void load(); }, [load]);

  // '-' Derived '-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-''-'

  const { items, totalCount } = result;
  const pageCount = Math.max(1, Math.ceil(totalCount / filters.pageSize));

  const kpis = useMemo(() => ({
    pending:  items.filter(r => normalizeStatus(r.docStatus) === "Submitted").length,
    totalQty: items.reduce((s, r) => s + (r.totalQty ?? 0), 0),
  }), [items]);

  // Count per status for tab badges
  const tabCounts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(r => {
      const k = String(r.docStatus);
      map[k] = (map[k] ?? 0) + 1;
    });
    return map;
  }, [items]);

  function patchFilter<K extends keyof FilterState>(k: K, v: FilterState[K]) {
    setPage(1);
    setFilters(prev => ({ ...prev, [k]: v }));
  }

  function clearFilters() {
    setPage(1);
    setFilters(DEFAULT_FILTERS);
  }

  function openRow(row: SivListItemDto) {
    if (!companyId || !row.id) return;

    const status = normalizeStatus(row.docStatus);

    if (status === "Draft" || status === "ChangesRequested") {
      const rowBranchId = row.branchId || branchId || "";

      if (!rowBranchId) {
        setErr("A branch is required to open this SIV draft.");
        return;
      }

      nav(sivDraftPath(companyId, rowBranchId, row.id));
      return;
    }

    if (status === "Submitted") {
      nav(sivApprovalPath(companyId, row.id));
      return;
    }

    nav(sivOpenPath(companyId, row.id));
  }

  function openCreatePage() {
    if (!companyId) {
      setErr("Select a company before creating an SIV.");
      return;
    }

    if (!branchId) {
      setErr("Select a branch before creating an SIV.");
      return;
    }

    nav(sivCreatePath(companyId, branchId));
  }

// Render

  return (
    <div className="page">

      {/* '-' Page header '-' */}
      <div className="page-header">
        <div>
          <div className="page-kicker">Inventory</div>
          <div className="page-title">Stock Issue Vouchers</div>
          <div className="page-sub">
            Warehouse requisitions from consuming locations
          </div>
        </div>
        <button
          className="btn btn-primary"
          disabled={!companyId || !branchId}
          onClick={openCreatePage}
        >
          + New SIV
        </button>
      </div>

      {/* '-' KPI strip '-' */}
      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}
      >
        <div className="kpi">
          <div className="kpi-label">Total documents</div>
          <div className="kpi-val">{totalCount}</div>
          <div className="kpi-sub">in current filter</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">On this page</div>
          <div className="kpi-val">{items.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pending approval</div>
          <div className="kpi-val">{kpis.pending}</div>
          {kpis.pending > 0 && (
            <div className="kpi-badge badge-warn">Action needed</div>
          )}
        </div>
        <div className="kpi">
          <div className="kpi-label">Total qty (page)</div>
          <div className="kpi-val">{fmtQty(kpis.totalQty)}</div>
        </div>
      </div>

      {/* '-' Status filter tabs '-' */}
      <div
        style={{
          display:      "flex",
          gap:          0,
          borderBottom: "1px solid var(--border-soft)",
          marginBottom: 14,
          overflowX:    "auto",
          scrollbarWidth: "none",
        }}
      >
        {STATUS_TABS.map(tab => {
          const active  = filters.docStatus === tab.value;
          const cnt     = tab.value === "" ? items.length : (tabCounts[tab.value] ?? 0);
          return (
            <button
              key={tab.value}
              onClick={() => patchFilter("docStatus", tab.value)}
              style={{
                padding:      "7px 14px",
                fontSize:     12,
                fontWeight:   500,
                cursor:       "pointer",
                background:   "none",
                border:       "none",
                borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                color:        active ? "var(--accent)" : "var(--text-muted)",
                display:      "flex",
                alignItems:   "center",
                gap:          5,
                whiteSpace:   "nowrap",
                transition:   "color 0.1s",
                marginBottom: -1,
              }}
            >
              {tab.label}
              {cnt > 0 && (
                <span
                  style={{
                    fontSize:    9,
                    padding:     "1px 5px",
                    borderRadius:10,
                    fontWeight:  700,
                    background:  active ? "var(--accent-light)" : "var(--surface-2)",
                    color:       active ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* '-' Search & date filters '-' */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <div className="card-title">Filters</div>
          <button className="btn btn-sm" onClick={clearFilters}>
            Clear all
          </button>
        </div>
        <div className="card-body">
          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
              gap:                 12,
            }}
          >
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Search</label>
              <input
                className="input"
                value={filters.q}
                onChange={(e) => patchFilter("q", e.target.value)}
                placeholder="SIV number, department, location, remarks'"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Date from</label>
              <input
                className="input"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => patchFilter("dateFrom", e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Date to</label>
              <input
                className="input"
                type="date"
                value={filters.dateTo}
                onChange={(e) => patchFilter("dateTo", e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Page size</label>
              <select
                className="select"
                value={filters.pageSize}
                onChange={(e) => patchFilter("pageSize", Number(e.target.value))}
              >
                {[10, 20, 50, 100].map(n => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                className="btn"
                onClick={() => void load()}
                disabled={loading || hasInvalidDateRange}
                style={{ whiteSpace: "nowrap" }}
              >
                {loading ? "Loading..." : "-"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* '-' Error '-' */}
      {hasInvalidDateRange && (
        <div className="alert alert-warn" role="alert">Date from cannot be after Date to.</div>
      )}
      {err && <div className="alert alert-danger" role="alert">{err}</div>}

      {/* '-' Table '-' */}
      <div className="card siv-table-card" style={{ padding: 0 }}>
        <div className="siv-table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Status</th>
              <th>Issue date</th>
              <th>From  ' To</th>
              <th>Department</th>
              <th>Requested by</th>
              <th style={{ textAlign: "right" }}>Lines</th>
              <th style={{ textAlign: "right" }}>Total qty</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    padding:   48,
                    textAlign: "center",
                    color:     "var(--text-muted)",
                    fontSize:  13,
                  }}
                >
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    padding:   56,
                    textAlign: "center",
                    color:     "var(--text-soft)",
                    fontSize:  13,
                  }}
                >
                  No SIV documents found.{" "}
                  {!filters.docStatus && !filters.q && (
                    <span
                      style={{ color: "var(--accent)", cursor: "pointer" }}
                      onClick={openCreatePage}
                    >
                      Create one  '
                    </span>
                  )}
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const s = normalizeStatus(row.docStatus);
                const isUrgent =
                  s === "Submitted" || s === "Approved" || s === "Issued";
                return (
                  <tr
                    key={row.id}
                    style={{
                      cursor:     "pointer",
                      borderLeft: isUrgent
                        ? "3px solid var(--warn)"
                        : "3px solid transparent",
                    }}
                    onClick={() => openRow(row)}
                  >
                    <td>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize:   13,
                          fontFamily: "var(--mono)",
                          color:      "var(--accent)",
                        }}
                      >
                        {row.number || "Pending SIV number"}
                      </div>
                      {row.hasRecommendationOverride && (
                        <div
                          style={{
                            display:"inline-flex",
                            marginTop:4,
                            padding:"2px 7px",
                            borderRadius:999,
                            background:"rgba(245,158,11,.14)",
                            color:"var(--warn)",
                            fontSize:10,
                            fontWeight:700,
                          }}
                          title={row.recommendationOverrideReason || "System recommendation was overridden"}
                        >
                          Recommendation override
                        </div>
                      )}                      {row.remarks && (
                        <div
                          style={{
                            fontSize:     11,
                            color:        "var(--text-soft)",
                            marginTop:    1,
                            maxWidth:     200,
                            overflow:     "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace:   "nowrap",
                          }}
                          title={row.remarks}
                        >
                          {row.remarks}
                        </div>
                      )}
                    </td>

                    <td>
                      <span className={STATUS_BADGE[s]}>{s}</span>
                    </td>

                    <td
                      style={{
                        fontSize:   12,
                        fontFamily: "var(--mono)",
                        color:      "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDate(row.issueDate)}
                    </td>

                    <td style={{ fontSize: 12 }}>
                      <div style={{ color: "var(--text-muted)" }}>
                        {row.fromLocationName || "-"}
                      </div>
                      {(row.toLocationName || row.departmentName) && (
                        <div
                          style={{
                            marginTop: 1,
                            fontSize:  11,
                            color:     "var(--text-soft)",
                          }}
                        >
                           ' {row.toLocationName || row.departmentName}
                        </div>
                      )}
                    </td>

                    <td style={{ fontSize: 12 }}>
                      {row.departmentName || "-"}
                    </td>

                    <td style={{ fontSize: 12 }}>
                      {row.requestedByName || "-"}
                    </td>

                    <td
                      style={{
                        textAlign:  "right",
                        fontFamily: "var(--mono)",
                        fontSize:   12,
                        color:      "var(--text-muted)",
                      }}
                    >
                      {row.lineCount ?? 0}
                    </td>

                    <td
                      style={{
                        textAlign:  "right",
                        fontFamily: "var(--mono)",
                        fontSize:   12,
                      }}
                    >
                      {fmtQty(row.totalQty)}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRow(row);
                        }}
                      >
                        Open  '
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        </div>

        {/* Pagination footer */}
        <div
          style={{
            padding:         "10px 16px",
            borderTop:       "1px solid var(--border-soft)",
            background:      "var(--surface-2)",
            display:         "flex",
            justifyContent:  "space-between",
            alignItems:      "center",
            fontSize:        12,
            color:           "var(--text-muted)",
          }}
        >
          <div>
            Page {page} of {pageCount} '- {totalCount} total
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              className="btn btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
                Prev
            </button>
            <span style={{ padding: "2px 8px", background: "var(--accent-light)", color: "var(--accent)", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
              {page}
            </span>
            <button
              className="btn btn-sm"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next  '
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
