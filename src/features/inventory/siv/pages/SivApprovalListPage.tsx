// src/features/inventory/siv/pages/SivApprovalListPage.tsx

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { sivApi } from "../api/sivApi";
import "./siv-draft.css";

type Guid = string;

type DocStatus =
  | ""
  | "Draft"
  | "Submitted"
  | "Approved"
  | "RequestedChanges"
  | "Rejected"
  | "Issued"
  | "Posted"
  | "Reversed";

type SivApprovalItemDto = {
  id: Guid;
  number?: string | null;
  docStatus?: string | null;
  status?: string | null;
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
  linesCount?: number | null;
  totalLines?: number | null;
  totalQty?: number | null;

  createdAt?: string | null;
  createdOn?: string | null;
  updatedAt?: string | null;
  modifiedAt?: string | null;
  lastModifiedAt?: string | null;
};

type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};

type ApprovalQuery = {
  branchId?: string;
  fromLocationId?: string;
  docStatus?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
};

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
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
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function normalizeStatus(value?: string | null): string {
  const s = safeString(value).trim().toLowerCase();

  switch (s) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "requestedchanges":
    case "requested_changes":
    case "requested-changes":
      return "RequestedChanges";
    case "rejected":
      return "Rejected";
    case "issued":
      return "Issued";
    case "posted":
      return "Posted";
    case "reversed":
      return "Reversed";
    default:
      return safeString(value) || "—";
  }
}

function statusTone(status?: string | null): "neutral" | "good" | "warn" {
  const s = normalizeStatus(status);

  switch (s) {
    case "Approved":
    case "Posted":
      return "good";
    case "Submitted":
    case "RequestedChanges":
    case "Issued":
      return "warn";
    default:
      return "neutral";
  }
}

function normalizeItem(x: any): SivApprovalItemDto {
  return {
    id: safeString(x?.id),
    number: x?.number ?? null,
    docStatus: x?.docStatus ?? x?.status ?? null,
    status: x?.status ?? null,
    issueDate: x?.issueDate ?? null,

    fromLocationId: x?.fromLocationId ?? null,
    fromLocationName: x?.fromLocationName ?? x?.fromLocation?.name ?? null,

    toLocationId: x?.toLocationId ?? null,
    toLocationName: x?.toLocationName ?? x?.toLocation?.name ?? null,

    departmentId: x?.departmentId ?? null,
    departmentName: x?.departmentName ?? x?.department?.name ?? null,

    remarks: x?.remarks ?? null,
    notes: x?.notes ?? null,

    lineCount: x?.lineCount ?? x?.linesCount ?? x?.totalLines ?? null,
    linesCount: x?.linesCount ?? null,
    totalLines: x?.totalLines ?? null,
    totalQty: x?.totalQty ?? null,

    createdAt: x?.createdAt ?? x?.createdOn ?? null,
    createdOn: x?.createdOn ?? null,
    updatedAt: x?.updatedAt ?? x?.modifiedAt ?? x?.lastModifiedAt ?? null,
    modifiedAt: x?.modifiedAt ?? null,
    lastModifiedAt: x?.lastModifiedAt ?? null,
  };
}

function normalizePaged(input: any, requestedPage: number, requestedPageSize: number): PagedResult<SivApprovalItemDto> {
  const itemsRaw = Array.isArray(input)
    ? input
    : Array.isArray(input?.items)
      ? input.items
      : Array.isArray(input?.data?.items)
        ? input.data.items
        : Array.isArray(input?.data)
          ? input.data
          : [];

  const items = itemsRaw.map(normalizeItem);

  return {
    items,
    page: asNumber(input?.page ?? input?.data?.page, requestedPage),
    pageSize: asNumber(input?.pageSize ?? input?.data?.pageSize, requestedPageSize),
    totalCount: asNumber(
      input?.totalCount ?? input?.data?.totalCount,
      Array.isArray(input) || Array.isArray(input?.data) ? items.length : items.length
    ),
  };
}

function Chip(props: { tone?: "neutral" | "good" | "warn"; children: React.ReactNode }) {
  return <span className={`lux-chip ${props.tone ?? "neutral"}`}>{props.children}</span>;
}

function resolveApprovalApi():
  | ((companyId: string, params: ApprovalQuery) => Promise<any>)
  | null {
  const api = sivApi as any;

  if (typeof api.getForApproval === "function") return api.getForApproval.bind(api);
  if (typeof api.listForApproval === "function") return api.listForApproval.bind(api);
  if (typeof api.forApproval === "function") return api.forApproval.bind(api);
  if (typeof api.list === "function") {
    return async (companyId: string, params: ApprovalQuery) =>
      api.list(companyId, { ...params, docStatus: params.docStatus ?? "Submitted" });
  }

  return null;
}

export default function SivApprovalListPage() {
  const navigate = useNavigate();
  const scope = useAppScope() as any;

  const companyId = safeString(scope?.companyId);
  const branchId = safeString(scope?.branchId);

  const scopedFromLocationId = safeString(
    scope?.defaultFromLocationId ??
      scope?.locationId ??
      (Array.isArray(scope?.locationIds) ? scope.locationIds[0] : "")
  );

  const [items, setItems] = React.useState<SivApprovalItemDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalCount, setTotalCount] = React.useState(0);

  const [qInput, setQInput] = React.useState("");
  const [q, setQ] = React.useState("");

  const [docStatus, setDocStatus] = React.useState<DocStatus>("Submitted");
  const [fromLocationId, setFromLocationId] = React.useState(scopedFromLocationId);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const canLoad = React.useMemo(() => isUuid(companyId), [companyId]);

  React.useEffect(() => {
    setFromLocationId(scopedFromLocationId);
  }, [scopedFromLocationId]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setPage(1);
      setQ(qInput.trim());
    }, 250);

    return () => window.clearTimeout(t);
  }, [qInput]);

  const load = React.useCallback(async () => {
    if (!canLoad) return;

    setLoading(true);
    setError("");

    try {
      const approvalApi = resolveApprovalApi();

      if (!approvalApi) {
        throw new Error(
          "Approval API is not available. Add sivApi.getForApproval(companyId, params) or sivApi.listForApproval(companyId, params)."
        );
      }

      const params: ApprovalQuery = {
        page,
        pageSize,
      };

      if (isUuid(branchId)) params.branchId = branchId;
      if (isUuid(fromLocationId)) params.fromLocationId = fromLocationId;
      if (docStatus) params.docStatus = docStatus;
      if (q) params.q = q;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const result = await approvalApi(companyId, params);
      const paged = normalizePaged(result, page, pageSize);

      setItems(paged.items);
      setTotalCount(paged.totalCount);
    } catch (e: any) {
      setItems([]);
      setTotalCount(0);
      setError(
        e?.response?.data?.title ||
          e?.response?.data?.message ||
          e?.message ||
          "Failed to load approval list."
      );
    } finally {
      setLoading(false);
    }
  }, [canLoad, companyId, branchId, fromLocationId, docStatus, q, dateFrom, dateTo, page, pageSize]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  if (!isUuid(companyId)) {
    return (
      <div className="lux-page">
        <div className="lux-container">
          <div className="lux-card">
            <div className="lux-card__title">Invalid Company Scope</div>
            <div className="lux-card__desc">useAppScope() did not provide a valid companyId.</div>
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
            <div className="lux-title">SIV Approval Queue</div>
            <div className="lux-subtitle">
              Review submitted stock issue vouchers <span className="lux-dot">•</span>{" "}
              <span className="lux-muted">{companyId}</span>
            </div>
          </div>

          <div className="lux-sticky__right">
            <button className="lux-btn ghost" type="button" onClick={() => void load()} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="lux-container">
        <div className="lux-hero">
          <div className="lux-hero__bg" />
          <div className="lux-hero__content">
            <div className="lux-hero__kicker">Inventory • Approval</div>
            <div className="lux-hero__headline">SIVs For Approval</div>
            <div className="lux-hero__meta">
              <Chip>Status: {docStatus || "All"}</Chip>
              <Chip>Branch: {isUuid(branchId) ? branchId : "—"}</Chip>
              <Chip tone="good">Total: {totalCount}</Chip>
            </div>
          </div>
        </div>

        {error ? (
          <div className="lux-alert error" style={{ marginTop: 14 }}>
            <div className="lux-alert__msg">{error}</div>
            <button className="lux-btn ghost" type="button" onClick={() => setError("")}>
              ✕
            </button>
          </div>
        ) : null}

        <div className="lux-card" style={{ marginTop: 14 }}>
          <div className="lux-card__head">
            <div>
              <div className="lux-card__title">Filters</div>
              <div className="lux-card__desc">Narrow the queue for reviewers and approvers.</div>
            </div>
          </div>

          <div className="lux-grid">
            <div className="lux-field span-2">
              <label>Search</label>
              <input
                className="lux-input"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Number, remarks, department, location..."
              />
            </div>

            <div className="lux-field">
              <label>Status</label>
              <select
                className="lux-input"
                value={docStatus}
                onChange={(e) => {
                  setPage(1);
                  setDocStatus(e.target.value as DocStatus);
                }}
              >
                <option value="">All</option>
                <option value="Submitted">Submitted</option>
                <option value="RequestedChanges">RequestedChanges</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Issued">Issued</option>
                <option value="Posted">Posted</option>
                <option value="Draft">Draft</option>
                <option value="Reversed">Reversed</option>
              </select>
            </div>

            <div className="lux-field">
              <label>From Location Id</label>
              <input
                className="lux-input"
                value={fromLocationId}
                onChange={(e) => {
                  setPage(1);
                  setFromLocationId(e.target.value.trim());
                }}
                placeholder="Optional UUID only"
              />
            </div>

            <div className="lux-field">
              <label>Date From</label>
              <input
                className="lux-input"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setPage(1);
                  setDateFrom(e.target.value);
                }}
              />
            </div>

            <div className="lux-field">
              <label>Date To</label>
              <input
                className="lux-input"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setPage(1);
                  setDateTo(e.target.value);
                }}
              />
            </div>

            <div className="lux-field">
              <label>Page Size</label>
              <select
                className="lux-input"
                value={pageSize}
                onChange={(e) => {
                  setPage(1);
                  setPageSize(Number(e.target.value));
                }}
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
              <div className="lux-card__title">Approval Queue</div>
              <div className="lux-card__desc">
                {loading ? "Loading..." : `${items.length} item(s) on this page`}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="lux-empty">
              <div className="lux-empty__title">Loading approval queue</div>
              <div className="lux-empty__desc">Please wait while the queue is loaded.</div>
            </div>
          ) : !items.length ? (
            <div className="lux-empty">
              <div className="lux-empty__title">No SIVs found</div>
              <div className="lux-empty__desc">No documents matched the current approval filters.</div>
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
                    <th style={{ width: 180 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.number || row.id}</td>
                      <td>
                        <Chip tone={statusTone(row.docStatus ?? row.status)}>
                          {normalizeStatus(row.docStatus ?? row.status)}
                        </Chip>
                      </td>
                      <td>{formatDate(row.issueDate)}</td>
                      <td>{row.fromLocationName || "—"}</td>
                      <td>{row.toLocationName || "—"}</td>
                      <td>{row.departmentName || "—"}</td>
                      <td>{asNumber(row.lineCount ?? row.linesCount ?? row.totalLines, 0)}</td>
                      <td>{formatQty(row.totalQty)}</td>
                      <td>{row.remarks || row.notes || "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            className="lux-btn primary"
                            type="button"
                            onClick={() =>
                              navigate(
                                `/companies/${encodeURIComponent(companyId)}/siv/drafts${encodeURIComponent(row.id)}`
                              )
                            }
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="lux-footerActions">
            <div className="lux-muted">
              Page {page} of {pageCount} <span className="lux-dot">•</span> Total {totalCount}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="lux-btn ghost"
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                className="lux-btn ghost"
                type="button"
                disabled={page >= pageCount || loading}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
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