// src/features/inventory/siv/pages/SivListPage.tsx
//
// Wired to GET /api/companies/{companyId}/siv via sivApi.getList.
// Debounced search, status filter tabs, sortable columns, pagination.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useErpNavigate }                             from "../../../../routes/useErpNavigation";
import { useAppScope }                                 from "../../../../app/useAppScope";
import { useI18n } from "../../../../i18n";
import { sivApi }                                      from "../api/sivApi";
import type { SivDetailsDto, SivLookupOptionDto }      from "../api/sivApi";
import {
  sivApprovalPath,
  sivCreatePath,
  sivDraftPath,
  sivOpenPath,
} from "../utils/sivWorkflowRoutes";
import {
  normalizeStatus, STATUS_BADGE,
  mapToListItem, fmtDate, fmtQty, fmt$, getApiError,
  type SivListItemDto, type PagedResult,
}                                                      from "../types/sivTypes";
import "./siv-draft.css";
import { OverrideReasonTooltip } from "./OverrideReasonTooltip";

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
  departmentId: string;
  dateFrom:  string;
  dateTo:    string;
  pageSize:  number;
};

const DEFAULT_FILTERS: FilterState = {
  q: "", docStatus: "", departmentId: "", dateFrom: "", dateTo: "", pageSize: 20,
};

type SivPreviewState = {
  rowId: string;
  loading: boolean;
  error: string | null;
  detail: SivDetailsDto | null;
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
  const { tx } = useI18n();

  const [filters,  setFilters]  = useState<FilterState>(DEFAULT_FILTERS);
  const [page,     setPage]     = useState(1);
  const [result,   setResult]   = useState<PagedResult<SivListItemDto>>({
    items: [], page: 1, pageSize: 20, totalCount: 0,
  });
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [departments, setDepartments] = useState<SivLookupOptionDto[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [preview, setPreview] = useState<SivPreviewState | null>(null);
  const previewCacheRef = useRef<Map<string, SivDetailsDto>>(new Map());
  const previewOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRequestRef = useRef(0);


  const debouncedQ = useDebouncedValue(filters.q);
  const hasInvalidDateRange =
    Boolean(filters.dateFrom && filters.dateTo) && filters.dateFrom > filters.dateTo;
  const effectiveBranchId = branchId || "";

  useEffect(() => {
    if (!companyId) return;

    let disposed = false;
    setLookupsLoading(true);

    sivApi.getFilterLookups(companyId, branchId || null)
      .then((lookups) => {
        if (disposed) return;
        setDepartments(lookups.departments);
      })
      .catch(() => {
        if (disposed) return;
        setDepartments([]);
      })
      .finally(() => {
        if (!disposed) setLookupsLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [companyId, branchId]);

// Load

  const load = useCallback(async () => {
    if (!companyId || hasInvalidDateRange) return;
    setLoading(true);
    setErr(null);
    try {
      const raw = await sivApi.getList(companyId, {
        branchId:     effectiveBranchId || undefined,
        departmentId: filters.departmentId || undefined,
        q:            debouncedQ  || undefined,
        docStatus:    filters.docStatus || undefined,
        dateFrom:     filters.dateFrom  || undefined,
        dateTo:       filters.dateTo    || undefined,
        page,
        pageSize:     filters.pageSize,
      });
      setResult(normalizePaged(raw));
    } catch (e) {
      setErr(getApiError(e, tx("Failed to load SIV list.")));
    } finally {
      setLoading(false);
    }
  }, [
    companyId, effectiveBranchId, debouncedQ,
    filters.docStatus, filters.departmentId, filters.dateFrom, filters.dateTo,
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

  const closeSivPreview = useCallback(() => {
    if (previewOpenTimerRef.current) clearTimeout(previewOpenTimerRef.current);
    if (previewCloseTimerRef.current) clearTimeout(previewCloseTimerRef.current);

    previewCloseTimerRef.current = setTimeout(() => {
      setPreview(null);
    }, 160);
  }, []);

  const keepSivPreviewOpen = useCallback(() => {
    if (previewCloseTimerRef.current) clearTimeout(previewCloseTimerRef.current);
  }, []);

  const openSivPreview = useCallback((row: SivListItemDto) => {
    if (!companyId || !row.id) return;

    if (previewCloseTimerRef.current) clearTimeout(previewCloseTimerRef.current);
    if (previewOpenTimerRef.current) clearTimeout(previewOpenTimerRef.current);

    const cached = previewCacheRef.current.get(row.id);
    setPreview({ rowId: row.id, loading: !cached, error: null, detail: cached ?? null });

    if (cached) return;

    const requestId = ++previewRequestRef.current;
    previewOpenTimerRef.current = setTimeout(() => {
      sivApi.getById(companyId, row.id)
        .then((detail) => {
          previewCacheRef.current.set(row.id, detail);
          if (previewRequestRef.current === requestId) {
            setPreview({ rowId: row.id, loading: false, error: null, detail });
          }
        })
        .catch((e) => {
          if (previewRequestRef.current === requestId) {
            setPreview({
              rowId: row.id,
              loading: false,
              error: getApiError(e, tx("Unable to load SIV item details.")),
              detail: null,
            });
          }
        });
    }, 180);
  }, [companyId, tx]);

  useEffect(() => () => {
    if (previewOpenTimerRef.current) clearTimeout(previewOpenTimerRef.current);
    if (previewCloseTimerRef.current) clearTimeout(previewCloseTimerRef.current);
  }, []);

  function renderSivPreview(row: SivListItemDto) {
    if (preview?.rowId !== row.id) return null;

    const detail = preview.detail;
    const lines = detail?.lines ?? [];
    const totalRequested = detail ? lines.reduce((sum, line) => sum + Number(line.requestedQty ?? line.qty ?? 0), 0) : row.totalQty;
    const totalApproved = detail ? lines.reduce((sum, line) => sum + Number(line.approvedQty ?? 0), 0) : 0;
    const totalIssued = detail ? lines.reduce((sum, line) => sum + Number(line.issuedQty ?? line.issuedBaseQty ?? 0), 0) : 0;
    const totalValue = detail ? lines.reduce((sum, line) => sum + Number(line.postedLineCost ?? 0), 0) : 0;
    const status = normalizeStatus(detail?.docStatus ?? row.docStatus);
    const previewLines = lines.slice(0, 5);

    return (
      <div
        id={"siv-preview-" + row.id}
        className="siv-reference-preview"
        role="tooltip"
        onMouseEnter={keepSivPreviewOpen}
        onMouseLeave={closeSivPreview}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="siv-reference-preview__head">
          <div>
            <span>{tx("SIV item details")}</span>
            <strong>{detail?.number || row.number || tx("Pending SIV number")}</strong>
          </div>
          <span className={STATUS_BADGE[status]}>{tx(status)}</span>
        </div>

        {preview.loading ? (
          <div className="siv-reference-preview__state">{tx("Loading item list...")}</div>
        ) : preview.error ? (
          <div className="siv-reference-preview__state error">{preview.error}</div>
        ) : (
          <>
            <div className="siv-reference-preview__summary">
              <div><span>{tx("Issue date")}</span><strong>{fmtDate(detail?.issueDate ?? row.issueDate)}</strong></div>
              <div><span>{tx("From")}</span><strong title={detail?.fromLocationName ?? row.fromLocationName}>{detail?.fromLocationName || row.fromLocationName || "-"}</strong></div>
              <div><span>{tx("To")}</span><strong title={detail?.toLocationName ?? row.toLocationName ?? row.departmentName}>{detail?.toLocationName || row.toLocationName || row.departmentName || "-"}</strong></div>
              <div><span>{tx("Department")}</span><strong>{detail?.departmentName || row.departmentName || "-"}</strong></div>
              <div><span>{tx("Requested")}</span><strong>{fmtQty(totalRequested)}</strong></div>
              <div><span>{tx("Approved")}</span><strong>{totalApproved > 0 ? fmtQty(totalApproved) : "-"}</strong></div>
              <div><span>{tx("Issued")}</span><strong>{totalIssued > 0 ? fmtQty(totalIssued) : "-"}</strong></div>
              <div><span>{tx("Posted value")}</span><strong>{totalValue > 0 ? fmt$(totalValue) : "-"}</strong></div>
            </div>

            <div className="siv-reference-preview__lines">
              {previewLines.length === 0 ? (
                <div className="siv-reference-preview__state">{tx("No item lines found on this voucher.")}</div>
              ) : previewLines.map((line) => (
                <div key={line.id || line.lineNo} className="siv-reference-preview__line">
                  <div className="siv-reference-preview__item">
                    <strong>{line.itemName || tx("Unnamed item")}</strong>
                    <span>{line.itemCode || "-"}{line.batchNo ? " | " + tx("Batch") + " " + line.batchNo : ""}{line.expiryDate ? " | " + tx("Exp") + " " + fmtDate(line.expiryDate) : ""}</span>
                  </div>
                  <div className="siv-reference-preview__qty">
                    <span>{fmtQty(line.requestedQty ?? line.qty)} {line.uomCode || ""}</span>
                    <small>{line.postedLineCost ? fmt$(line.postedLineCost) : tx("Cost pending")}</small>
                  </div>
                </div>
              ))}
              {lines.length > previewLines.length && (
                <div className="siv-reference-preview__more">+{lines.length - previewLines.length} {tx("more lines")}</div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  function openRow(row: SivListItemDto) {
    if (!companyId || !row.id) return;

    const status = normalizeStatus(row.docStatus);

    if (status === "Draft" || status === "ChangesRequested") {
      const rowBranchId = row.branchId || branchId || "";

      if (!rowBranchId) {
        setErr(tx("A branch is required to open this SIV draft."));
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
      setErr(tx("Select a company before creating an SIV."));
      return;
    }

    if (!branchId) {
      setErr(tx("Select a branch before creating an SIV."));
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
          <div className="page-kicker">{tx("Inventory")}</div>
          <div className="page-title">{tx("Stock Issue Vouchers")}</div>
          <div className="page-sub">
            {tx("Warehouse requisitions from consuming locations")}
          </div>
        </div>
        <button
          className="btn btn-primary"
          disabled={!companyId}
          onClick={openCreatePage}
        >
          {tx("+ New SIV")}
        </button>
      </div>

      {/* '-' KPI strip '-' */}
      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}
      >
        <div className="kpi">
          <div className="kpi-label">{tx("Total documents")}</div>
          <div className="kpi-val">{totalCount}</div>
          <div className="kpi-sub">{tx("in current filter")}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{tx("On this page")}</div>
          <div className="kpi-val">{items.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{tx("Pending approval")}</div>
          <div className="kpi-val">{kpis.pending}</div>
          {kpis.pending > 0 && (
            <div className="kpi-badge badge-warn">{tx("Action needed")}</div>
          )}
        </div>
        <div className="kpi">
          <div className="kpi-label">{tx("Total qty (page)")}</div>
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
              {tx(tab.label)}
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
          <div className="card-title">{tx("Filters")}</div>
          <button className="btn btn-sm" onClick={clearFilters}>
            {tx("Clear all")}
          </button>
        </div>
        <div className="card-body">
          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "minmax(220px,2fr) minmax(160px,1fr) minmax(130px,1fr) minmax(130px,1fr) minmax(120px,.8fr) auto",
              gap:                 12,
            }}
          >
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">{tx("Search")}</label>
              <input
                className="input"
                value={filters.q}
                onChange={(e) => patchFilter("q", e.target.value)}
                placeholder={tx("SIV number, department, location, remarks")}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">{tx("Department")}</label>
              <select
                className="select"
                value={filters.departmentId}
                onChange={(e) => patchFilter("departmentId", e.target.value)}
                disabled={lookupsLoading || departments.length === 0}
              >
                <option value="">{tx("All departments")}</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}{department.code ? ` (${department.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">{tx("Date from")}</label>
              <input
                className="input"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => patchFilter("dateFrom", e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">{tx("Date to")}</label>
              <input
                className="input"
                type="date"
                value={filters.dateTo}
                onChange={(e) => patchFilter("dateTo", e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">{tx("Page size")}</label>
              <select
                className="select"
                value={filters.pageSize}
                onChange={(e) => patchFilter("pageSize", Number(e.target.value))}
              >
                {[10, 20, 50, 100].map(n => (
                  <option key={n} value={n}>{n} {tx("per page")}</option>
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
                {loading ? tx("Loading...") : tx("Apply")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* '-' Error '-' */}
      {hasInvalidDateRange && (
        <div className="alert alert-warn" role="alert">{tx("Date from cannot be after Date to.")}</div>
      )}
      {err && <div className="alert alert-danger" role="alert">{err}</div>}

      {/* '-' Table '-' */}
      <div className="card siv-table-card" style={{ padding: 0 }}>
        <div className="siv-table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{tx("Document")}</th>
              <th>{tx("Status")}</th>
              <th>{tx("Submitted branch")}</th>
              <th>{tx("Issue date")}</th>
              <th>{tx("From / To")}</th>
              <th>{tx("Department")}</th>
              <th>{tx("Requested by")}</th>
              <th style={{ textAlign: "right" }}>{tx("Lines")}</th>
              <th style={{ textAlign: "right" }}>{tx("Total qty")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    padding:   48,
                    textAlign: "center",
                    color:     "var(--text-muted)",
                    fontSize:  13,
                  }}
                >
                  {tx("Loading...")}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    padding:   56,
                    textAlign: "center",
                    color:     "var(--text-soft)",
                    fontSize:  13,
                  }}
                >
                  {tx("No SIV documents found.")}{" "}
                  {!filters.docStatus && !filters.q && (
                    <span
                      style={{ color: "var(--accent)", cursor: "pointer" }}
                      onClick={openCreatePage}
                    >
                      {tx("Create one")}
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
                        className="siv-reference-cell"
                        onMouseEnter={() => openSivPreview(row)}
                        onMouseLeave={closeSivPreview}
                      >
                        <button
                          type="button"
                          className="siv-reference-button"
                          aria-describedby={preview?.rowId === row.id ? "siv-preview-" + row.id : undefined}
                          onFocus={() => openSivPreview(row)}
                          onBlur={closeSivPreview}
                          onClick={(e) => {
                            e.stopPropagation();
                            openRow(row);
                          }}
                        >
                          {row.number || tx("Pending SIV number")}
                        </button>
                        {renderSivPreview(row)}
                      </div>
                      {row.hasRecommendationOverride && (
                        <OverrideReasonTooltip
                          label={tx("Recommendation override")}
                          reason={row.recommendationOverrideReason?.trim() || tx("System recommendation was overridden")}
                        />
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
                      <span className={STATUS_BADGE[s]}>{tx(s)}</span>
                    </td>

                    <td style={{ fontSize: 12 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color:      "var(--text)",
                          maxWidth:   180,
                          overflow:   "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={row.branchName || tx("Branch not assigned")}
                      >
                        {row.branchName || "-"}
                      </div>
                      {s === "Submitted" && (
                        <div
                          style={{
                            marginTop: 2,
                            fontSize:  11,
                            color:     "var(--text-soft)",
                          }}
                        >
                          {tx("Awaiting approval")}
                        </div>
                      )}
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
                           {"->"} {row.toLocationName || row.departmentName}
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
                        {tx("Open")}
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
            {tx("Page")} {page} {tx("of")} {pageCount} - {totalCount} {tx("total")}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              className="btn btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
                {tx("Prev")}
            </button>
            <span style={{ padding: "2px 8px", background: "var(--accent-light)", color: "var(--accent)", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
              {page}
            </span>
            <button
              className="btn btn-sm"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              {tx("Next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
