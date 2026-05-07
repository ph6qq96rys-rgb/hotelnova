import * as React from "react";
import { useNavigate } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { sivApi } from "../api/sivApi";
import {
  type DocStatus,
  normalizeStatus,
  buildSivOpenRoute,
  buildSivDraftRoute,
  buildSivNewDraftRoute,
} from "../../../../routes/sivWorkflowRoutes";

import "./siv-draft.css";

type Guid = string;

type SivListItemDto = {
  id: Guid;
  number?: string | null;
  docStatus?: string | number | null;
  issueDate?: string | null;
  fromLocationId?: Guid | null;
  fromLocationName?: string | null;
  toLocationId?: Guid | null;
  toLocationName?: string | null;
  departmentId?: Guid | null;
  departmentName?: string | null;
  remarks?: string | null;
  notes?: string | null;
  lineCount?: number | null;
  totalQty?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};

type SivListRequest = {
  branchId?: string;
  departmentId?: string;
  q?: string;
  search?: string;
  docStatus?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  page: number;
  pageSize: number;
};

type FilterState = {
  q: string;
  docStatus: DocStatus;
  dateFrom: string;
  dateTo: string;
  pageSize: number;
};

const DEFAULT_FILTERS: FilterState = {
  q: "",
  docStatus: "",
  dateFrom: "",
  dateTo: "",
  pageSize: 20,
};

const STATUS_OPTIONS: Array<{ label: string; value: DocStatus }> = [
  { label: "All", value: "" },
  { label: "Draft", value: "Draft" },
  { label: "Submitted", value: "Submitted" },
  { label: "Approved", value: "Approved" },
  { label: "Issued", value: "Issued" },
  { label: "Posted", value: "Posted" },
  { label: "Requested Changes", value: "RequestedChanges" },
  { label: "Rejected", value: "Rejected" },
  { label: "Reversed", value: "Reversed" },
  { label: "Cancelled", value: "Cancelled" },
  { label: "Unknown", value: "Unknown" },
];

function isUuid(value: string | null | undefined): value is string {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    value
  );
}

function safeString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleDateString();
}

function formatQty(value?: number | null): string {
  const n = Number(value ?? 0);

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function statusTone(
  status: DocStatus
): "neutral" | "good" | "warn" | "danger" {
  switch (status) {
    case "Approved":
    case "Issued":
    case "Posted":
      return "good";
    case "Submitted":
    case "RequestedChanges":
      return "warn";
    case "Rejected":
    case "Reversed":
    case "Cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

function StatusChip({ status }: { status?: string | number | null }) {
  const normalized = normalizeStatus(status);

  return (
    <span className={`lux-chip ${statusTone(normalized)}`}>
      {normalized || "Unknown"}
    </span>
  );
}

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delay]);

  return debounced;
}

function getLinesFromRaw(raw: any): any[] {
  if (Array.isArray(raw?.lines)) return raw.lines;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.lineItems)) return raw.lineItems;

  return [];
}

function getTotalQty(raw: any, lines: any[]): number | null {
  const explicit =
    raw?.totalQty ??
    raw?.totalQuantity ??
    raw?.quantity ??
    raw?.issuedQty ??
    raw?.requestQty;

  if (explicit != null) {
    const n = Number(explicit);
    return Number.isFinite(n) ? n : null;
  }

  if (!lines.length) return null;

  return lines.reduce((sum: number, line: any) => {
    const qty = Number(
      line?.quantity ??
        line?.qty ??
        line?.issuedQty ??
        line?.requestQty ??
        0
    );

    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);
}

function normalizeListItem(raw: any): SivListItemDto | null {
  const id = safeString(raw?.id);
  if (!id) return null;

  const lines = getLinesFromRaw(raw);

  const lineCount =
    raw?.lineCount ??
    raw?.linesCount ??
    raw?.totalLines ??
    raw?.lineItemsCount ??
    raw?.lineItemCount ??
    lines.length;

  return {
    id,
    number: raw?.number ?? raw?.documentNo ?? raw?.docNo ?? null,
    docStatus: raw?.docStatus ?? raw?.status ?? null,
    issueDate: raw?.issueDate ?? raw?.date ?? raw?.documentDate ?? null,

    fromLocationId: raw?.fromLocationId ?? raw?.fromLocation?.id ?? null,
    fromLocationName:
      raw?.fromLocationName ?? raw?.fromLocation?.name ?? raw?.fromLocation?.code ?? null,

    toLocationId: raw?.toLocationId ?? raw?.toLocation?.id ?? null,
    toLocationName:
      raw?.toLocationName ?? raw?.toLocation?.name ?? raw?.toLocation?.code ?? null,

    departmentId: raw?.departmentId ?? raw?.department?.id ?? null,
    departmentName: raw?.departmentName ?? raw?.department?.name ?? null,

    remarks: raw?.remarks ?? raw?.notes ?? null,
    notes: raw?.notes ?? null,

    lineCount: asNumber(lineCount, 0),
    totalQty: getTotalQty(raw, lines),

    createdAt: raw?.createdAt ?? raw?.createdOn ?? null,
    updatedAt: raw?.updatedAt ?? raw?.modifiedAt ?? raw?.lastModifiedAt ?? null,
  };
}

function normalizePaged(input: unknown): PagedResult<SivListItemDto> {
  const raw = input as any;

  const rawItems = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data?.items)
        ? raw.data.items
        : Array.isArray(raw?.data)
          ? raw.data
          : [];

  const items = rawItems
    .map(normalizeListItem)
    .filter(Boolean) as SivListItemDto[];

  return {
    items,
    page: asNumber(raw?.page ?? raw?.data?.page, 1),
    pageSize: asNumber(raw?.pageSize ?? raw?.data?.pageSize, 20),
    totalCount: asNumber(
      raw?.totalCount ?? raw?.data?.totalCount ?? raw?.count,
      items.length
    ),
  };
}

function buildRequest(args: {
  branchId: string;
  departmentId: string;
  q: string;
  docStatus: DocStatus;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
}): SivListRequest {
  const {
    branchId,
    departmentId,
    q,
    docStatus,
    dateFrom,
    dateTo,
    page,
    pageSize,
  } = args;

  const trimmed = q.trim();

  return {
    branchId: isUuid(branchId) ? branchId : undefined,
    departmentId: isUuid(departmentId) ? departmentId : undefined,

    q: trimmed || undefined,
    search: trimmed || undefined,

    docStatus: docStatus || undefined,
    status: docStatus || undefined,

    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    issueDateFrom: dateFrom || undefined,
    issueDateTo: dateTo || undefined,

    page,
    pageSize,
  };
}

function canEdit(status: DocStatus): boolean {
  return status === "Draft" || status === "RequestedChanges";
}

function getErrorMessage(error: any): string {
  return (
    error?.response?.data?.title ||
    error?.response?.data?.message ||
    error?.message ||
    "Failed to load SIV list."
  );
}

export default function SivListPage() {
  const navigate = useNavigate();
  const scope = useAppScope() as any;

  const {companyId, branchId} = useAppScope();
  const departmentId = safeString(scope?.departmentId);

  const [items, setItems] = React.useState<SivListItemDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [page, setPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const [filters, setFilters] = React.useState<FilterState>(DEFAULT_FILTERS);

  const debouncedQ = useDebouncedValue(filters.q, 250);
  const canLoad =true;// isUuid(companyId);

  React.useEffect(() => {
    setPage(1);
  }, [
    debouncedQ,
    filters.docStatus,
    filters.dateFrom,
    filters.dateTo,
    filters.pageSize,
  ]);

  const request = React.useMemo(
    () =>
      buildRequest({
        branchId,
        departmentId,
        q: debouncedQ,
        docStatus: filters.docStatus,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        page,
        pageSize: filters.pageSize,
      }),
    [
      branchId,
      departmentId,
      debouncedQ,
      filters.docStatus,
      filters.dateFrom,
      filters.dateTo,
      filters.pageSize,
      page,
    ]
  );

  const load = React.useCallback(async () => {
    if (!canLoad) return;

    setLoading(true);
    setError("");

    try {
      const result = await sivApi.getList(companyId, request);
      const paged = normalizePaged(result);

      setItems(paged.items);
      setTotalCount(paged.totalCount);
    } catch (e: any) {
      setError(getErrorMessage(e));
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [canLoad, companyId, request]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(totalCount / filters.pageSize));

  const handleFilterChange = React.useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleOpen = React.useCallback(
    (row: SivListItemDto) => {
      if (!row.id || !companyId) return;
      navigate(buildSivOpenRoute(companyId, row.id));
    },
    [companyId, navigate]
  );

  const handleEdit = React.useCallback(
    (row: SivListItemDto) => {
      if (!row.id || !companyId) return;
      navigate(buildSivDraftRoute(companyId, row.id));
    },
    [companyId, navigate]
  );

  const handleNewDraft = React.useCallback(() => {
    if (!companyId) return;
    navigate(buildSivNewDraftRoute(companyId));
  }, [companyId, navigate]);

  const handleClear = React.useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  if (!canLoad) {
    return (
      <div className="lux-page">
        <div className="lux-container">
          <div className="lux-card">
            <div className="lux-card__title">Invalid Company Scope</div>
            <div className="lux-card__desc">
              useAppScope() did not provide a valid companyId.
            </div>

            <div className="lux-card__desc" style={{ marginTop: 8 }}>
              companyId: {companyId || "—"} • branchId: {branchId || "—"} •
              departmentId: {departmentId || "—"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lux-page">
      <div className="lux-sticky">
        <div className="lux-sticky__inner">
          <div className="lux-sticky__left">
            <div className="lux-title">Stock Issue Vouchers</div>
            <div className="lux-subtitle">
              Workflow-aware list <span className="lux-dot">•</span>{" "}
              <span className="lux-muted">{companyId}</span>
            </div>
          </div>

          <div className="lux-sticky__right">
            <button
              className="lux-btn ghost"
              type="button"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              className="lux-btn primary"
              type="button"
              onClick={handleNewDraft}
            >
              New Draft
            </button>
          </div>
        </div>
      </div>

      <div className="lux-container">
        <div className="lux-hero">
          <div className="lux-hero__bg" />
          <div className="lux-hero__content">
            <div className="lux-hero__kicker">Inventory • SIV</div>
            <div className="lux-hero__headline">SIV List</div>

            <div className="lux-hero__meta">
              <span className="lux-chip neutral">Branch: {branchId || "—"}</span>
              <span className="lux-chip neutral">
                Status: {filters.docStatus || "All"}
              </span>
              <span className="lux-chip good">Total: {totalCount}</span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="lux-alert error" style={{ marginTop: 14 }}>
            <div className="lux-alert__msg">{error}</div>

            <button
              className="lux-btn ghost"
              type="button"
              onClick={() => setError("")}
            >
              ✕
            </button>
          </div>
        ) : null}

        <div className="lux-card" style={{ marginTop: 14 }}>
          <div className="lux-card__head">
            <div>
              <div className="lux-card__title">Filters</div>
              <div className="lux-card__desc">
                Search and narrow the voucher list.
              </div>
            </div>

            <button className="lux-btn ghost" type="button" onClick={handleClear}>
              Clear
            </button>
          </div>

          <div className="lux-grid">
            <div className="lux-field span-2">
              <label htmlFor="siv-search">Search</label>
              <input
                id="siv-search"
                className="lux-input"
                value={filters.q}
                onChange={(e) => handleFilterChange("q", e.target.value)}
                placeholder="Number, remarks, department, location..."
              />
            </div>

            <div className="lux-field">
              <label htmlFor="siv-status">Status</label>
              <select
                id="siv-status"
                className="lux-input"
                value={filters.docStatus}
                onChange={(e) =>
                  handleFilterChange("docStatus", e.target.value as DocStatus)
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="lux-field">
              <label htmlFor="siv-date-from">Date From</label>
              <input
                id="siv-date-from"
                className="lux-input"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
              />
            </div>

            <div className="lux-field">
              <label htmlFor="siv-date-to">Date To</label>
              <input
                id="siv-date-to"
                className="lux-input"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
              />
            </div>

            <div className="lux-field">
              <label htmlFor="siv-page-size">Page Size</label>
              <select
                id="siv-page-size"
                className="lux-input"
                value={filters.pageSize}
                onChange={(e) =>
                  handleFilterChange("pageSize", Number(e.target.value))
                }
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        <div className="lux-card" style={{ marginTop: 14 }}>
          <div className="lux-card__head">
            <div>
              <div className="lux-card__title">Documents</div>
              <div className="lux-card__desc">
                {loading ? "Loading..." : `${items.length} item(s) on this page`}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="lux-empty">
              <div className="lux-empty__title">Loading documents</div>
              <div className="lux-empty__desc">
                Please wait while the list is loaded.
              </div>
            </div>
          ) : !items.length ? (
            <div className="lux-empty">
              <div className="lux-empty__title">No SIV documents found</div>
              <div className="lux-empty__desc">
                Try changing filters or create a new draft.
              </div>

              <button
                className="lux-btn primary"
                type="button"
                onClick={handleNewDraft}
              >
                New Draft
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="lux-table">
                <thead>
                  <tr>
                    <th style={{ width: 180 }}>Number</th>
                    <th style={{ width: 130 }}>Status</th>
                    <th style={{ width: 130 }}>Issue Date</th>
                    <th style={{ width: 180 }}>From</th>
                    <th style={{ width: 180 }}>To</th>
                    <th style={{ width: 180 }}>Department</th>
                    <th style={{ width: 100 }}>Lines</th>
                    <th style={{ width: 120 }}>Qty</th>
                    <th>Remarks</th>
                    <th style={{ width: 240 }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((row) => {
                    const status = normalizeStatus(row.docStatus);
                    const editable = canEdit(status);

                    return (
                      <tr key={row.id}>
                        <td>{row.number || row.id}</td>

                        <td>
                          <StatusChip status={row.docStatus} />
                        </td>

                        <td>{formatDate(row.issueDate)}</td>

                        <td>{row.fromLocationName || "—"}</td>

                        <td>{row.toLocationName || "—"}</td>

                        <td>{row.departmentName || "—"}</td>

                        <td>{row.lineCount ?? 0}</td>

                        <td>{formatQty(row.totalQty)}</td>

                        <td>{row.remarks || row.notes || "—"}</td>

                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              className="lux-btn ghost"
                              type="button"
                              onClick={() => handleOpen(row)}
                            >
                              Open
                            </button>

                            {editable ? (
                              <button
                                className="lux-btn"
                                type="button"
                                onClick={() => handleEdit(row)}
                              >
                                Edit
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="lux-footerActions">
            <div className="lux-muted">
              Page {page} of {pageCount} <span className="lux-dot">•</span>{" "}
              Total {totalCount}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="lux-btn ghost"
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Prev
              </button>

              <button
                className="lux-btn ghost"
                type="button"
                disabled={page >= pageCount || loading}
                onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
