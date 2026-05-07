import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import {
  Plus,
  Search,
  FileText,
  CalendarDays,
  Building2,
  MapPin,
  RefreshCcw,
  AlertCircle,
  Eye,
  ChevronRight,
} from "lucide-react";
import { sivApi } from "../api/sivApi";

type DraftListItem = {
  id: string;
  number?: string | null;
  docStatus?: string | number | null;
  issueDate?: string | null;
  remarks?: string | null;
  notes?: string | null;
  fromLocationId?: string | null;
  fromLocationName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
};

type StatusKey =
  | "all"
  | "draft"
  | "submitted"
  | "approved"
  | "requestedchanges"
  | "rejected"
  | "posted"
  | "reversed"
  | "cancelled"
  | "unknown";

type PagedResultLike<T> = {
  items?: T[];
  data?: T[];
  results?: T[];
};

function toIsoDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function normalizeText(value?: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeStatusKey(status?: unknown): StatusKey {
  if (status == null || status === "") return "unknown";

  const raw = String(status).trim().toLowerCase().replace(/\s+/g, "");

  switch (raw) {
    case "0":
    case "10":
    case "draft":
      return "draft";

    case "1":
    case "20":
    case "submitted":
      return "submitted";

    case "2":
    case "30":
    case "approved":
      return "approved";

    case "3":
    case "25":
    case "requestedchanges":
    case "requestedchange":
      case "ChangesRequested":
      return "requestedchanges";

    case "4":
    case "40":
    case "rejected":
      return "rejected";

    case "5":
    case "50":
    case "posted":
      return "posted";

    case "6":
    case "60":
    case "reversed":
      return "reversed";

    case "70":
    case "cancelled":
    case "canceled":
      return "cancelled";

    default:
      return "unknown";
  }
}

function prettyStatus(status?: unknown): string {
  const key = normalizeStatusKey(status);

  switch (key) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "requestedchanges":
      return "Requested Changes";
    case "rejected":
      return "Rejected";
    case "posted":
      return "Posted";
    case "reversed":
      return "Reversed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unknown";
  }
}

function extractRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  if (payload && typeof payload === "object") {
    const p = payload as PagedResultLike<T>;
    if (Array.isArray(p.items)) return p.items;
    if (Array.isArray(p.data)) return p.data;
    if (Array.isArray(p.results)) return p.results;
  }

  return [];
}

function statusToApiValue(status: StatusKey): string | number | undefined {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "requestedchanges":
      return "RequestedChanges";
    case "rejected":
      return "Rejected";
    case "posted":
      return "Posted";
    case "reversed":
      return "Reversed";
    case "cancelled":
      return "Cancelled";
    default:
      return undefined;
  }
}

function getStatusBadgeClass(status?: unknown): string {
  switch (normalizeStatusKey(status)) {
    case "draft":
      return "lux-badge lux-badge-draft";
    case "submitted":
      return "lux-badge lux-badge-submitted";
    case "approved":
      return "lux-badge lux-badge-approved";
    case "requestedchanges":
      return "lux-badge lux-badge-requested";
    case "rejected":
      return "lux-badge lux-badge-rejected";
    case "posted":
      return "lux-badge lux-badge-posted";
    case "reversed":
      return "lux-badge lux-badge-reversed";
    case "cancelled":
      return "lux-badge lux-badge-cancelled";
    default:
      return "lux-badge";
  }
}

/**
 * Central route resolver.
 * Adjust only this function if your route map changes.
 */
function resolveSivDetailsRoute(companyId: string, item: DraftListItem): string {
  const status = normalizeStatusKey(item.docStatus);

  switch (status) {
    case "draft":
    case "requestedchanges":
      return `/companies/${companyId}/siv/drafts/${item.id}`;
    case "submitted":
      return `/companies/${companyId}/siv/approval/${item.id}`;
    case "approved":
    case "rejected":
    case "posted":
    case "reversed":
    case "cancelled":
    case "unknown":
    default:
      return `/companies/${companyId}/siv/${item.id}`;
  }
}

const STATUS_OPTIONS: Array<{ value: StatusKey; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "requestedchanges", label: "Requested Changes" },
  { value: "rejected", label: "Rejected" },
  { value: "posted", label: "Posted" },
  { value: "reversed", label: "Reversed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "unknown", label: "Unknown" },
];

export default function SivDraftListPage() {
  const navigate = useNavigate();
  const appScope = useAppScope();

  const companyId = appScope.companyId ?? "";
  const appBranchId = appScope.branchId ?? "";

  const {
    departmentId: routeDepartmentId = "",
    locationId: routeLocationId = "",
  } = useParams<{
    companyId?: string;
    branchId?: string;
    departmentId?: string;
    locationId?: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<DraftListItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<StatusKey>("draft");

  const loadDrafts = useCallback(async (): Promise<void> => {
    if (!companyId) {
      setItems([]);
      setError("No company scope found.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await sivApi.listDrafts(companyId, {
        branchId: appBranchId || undefined,
        departmentId: routeDepartmentId || undefined,
        fromLocationId: routeLocationId || undefined,
        q: query.trim() || undefined,
        docStatus: statusToApiValue(selectedStatus),
      } as any);

      const rows = extractRows<DraftListItem>(result);
      setItems(rows);
    } catch (ex) {
      const message =
        ex instanceof Error ? ex.message : "Failed to load SIV drafts.";
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    companyId,
    appBranchId,
    routeDepartmentId,
    routeLocationId,
    query,
    selectedStatus,
  ]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((x) => {
      const matchesStatus =
        selectedStatus === "all"
          ? true
          : normalizeStatusKey(x.docStatus) === selectedStatus;

      if (!matchesStatus) return false;
      if (!q) return true;

      return [
        x.number,
        x.docStatus,
        x.remarks,
        x.notes,
        x.fromLocationName,
        x.departmentName,
        x.id,
      ]
        .filter((v) => v != null && v !== "")
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, query, selectedStatus]);

  function openItem(item: DraftListItem) {
    if (!companyId || !item.id) return;
    navigate(resolveSivDetailsRoute(companyId, item));
  }

  function openNew() {
    if (!companyId) return;
    navigate(`/companies/${companyId}/siv/drafts/new`);
  }

  return (
    <div className="lux-page min-h-screen">
      <style>{`
        :root {
          --lux-bg: #08111f;
          --lux-panel: rgba(10, 19, 36, 0.88);
          --lux-panel-2: rgba(13, 25, 47, 0.92);
          --lux-line: rgba(148, 163, 184, 0.16);
          --lux-line-strong: rgba(148, 163, 184, 0.28);
          --lux-text: #e5edf8;
          --lux-muted: #94a3b8;
          --lux-accent: #c8a96b;
          --lux-accent-soft: rgba(200, 169, 107, 0.14);
          --lux-danger: #f87171;
          --lux-danger-soft: rgba(248, 113, 113, 0.12);
          --lux-success: #34d399;
          --lux-success-soft: rgba(52, 211, 153, 0.14);
          --lux-info: #60a5fa;
          --lux-info-soft: rgba(96, 165, 250, 0.14);
          --lux-warning: #fbbf24;
          --lux-warning-soft: rgba(251, 191, 36, 0.14);
          --lux-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
        }

        * { box-sizing: border-box; }

        body {
          margin: 0;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          background: #06101d;
          color: var(--lux-text);
        }

        .lux-page {
          background:
            radial-gradient(circle at top left, rgba(200, 169, 107, 0.08), transparent 26%),
            radial-gradient(circle at right, rgba(59, 130, 246, 0.08), transparent 20%),
            linear-gradient(180deg, #07101d 0%, #091523 100%);
          color: var(--lux-text);
          padding: 24px;
          min-height: 100vh;
        }

        .lux-shell {
          max-width: 1480px;
          margin: 0 auto;
          display: grid;
          gap: 20px;
        }

        .lux-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .lux-title {
          margin: 0;
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .lux-subtitle {
          margin-top: 8px;
          color: var(--lux-muted);
          font-size: 14px;
          line-height: 1.6;
          max-width: 860px;
        }

        .lux-card {
          background: var(--lux-panel);
          border: 1px solid var(--lux-line);
          border-radius: 24px;
          box-shadow: var(--lux-shadow);
          backdrop-filter: blur(12px);
          padding: 20px;
        }

        .lux-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .lux-toolbar-left {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          flex: 1;
        }

        .lux-search {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 320px;
          flex: 1;
          max-width: 520px;
          background: var(--lux-panel-2);
          border: 1px solid var(--lux-line);
          border-radius: 16px;
          padding: 10px 14px;
        }

        .lux-search input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--lux-text);
          width: 100%;
          font-size: 14px;
        }

        .lux-select {
          background: var(--lux-panel-2);
          border: 1px solid var(--lux-line);
          color: var(--lux-text);
          border-radius: 16px;
          padding: 11px 14px;
          min-width: 220px;
          font-size: 14px;
          outline: none;
        }

        .lux-btn-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .lux-btn {
          appearance: none;
          border: none;
          cursor: pointer;
          border-radius: 16px;
          padding: 12px 16px;
          font-weight: 700;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          transition: 0.18s ease;
          text-decoration: none;
        }

        .lux-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .lux-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .lux-btn-primary {
          background: linear-gradient(135deg, #d8b67c 0%, #b48b4d 100%);
          color: #1f1607;
        }

        .lux-btn-secondary {
          background: rgba(255, 255, 255, 0.04);
          color: var(--lux-text);
          border: 1px solid var(--lux-line);
        }

        .lux-banner {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 18px;
          font-size: 14px;
          border: 1px solid rgba(248, 113, 113, 0.25);
          background: var(--lux-danger-soft);
          color: #ffd0d0;
        }

        .lux-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          color: var(--lux-muted);
          font-size: 13px;
        }

        .lux-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .lux-draft {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--lux-line);
          border-radius: 20px;
          padding: 18px;
          display: grid;
          gap: 14px;
          transition: 0.18s ease;
        }

        .lux-draft:hover {
          border-color: var(--lux-line-strong);
          transform: translateY(-1px);
        }

        .lux-draft-head {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
        }

        .lux-draft-title {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
        }

        .lux-draft-sub {
          color: var(--lux-muted);
          font-size: 12px;
          margin-top: 4px;
          word-break: break-all;
        }

        .lux-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid var(--lux-line);
          background: rgba(255,255,255,0.05);
          white-space: nowrap;
        }

        .lux-badge-draft {
          background: rgba(255,255,255,0.06);
        }

        .lux-badge-submitted {
          background: var(--lux-info-soft);
          border-color: rgba(96, 165, 250, 0.25);
          color: #bfdbfe;
        }

        .lux-badge-approved {
          background: var(--lux-success-soft);
          border-color: rgba(52, 211, 153, 0.25);
          color: #bbf7d0;
        }

        .lux-badge-requested {
          background: var(--lux-warning-soft);
          border-color: rgba(251, 191, 36, 0.25);
          color: #fde68a;
        }

        .lux-badge-rejected {
          background: var(--lux-danger-soft);
          border-color: rgba(248, 113, 113, 0.25);
          color: #fecaca;
        }

        .lux-badge-posted {
          background: rgba(168, 85, 247, 0.14);
          border-color: rgba(168, 85, 247, 0.25);
          color: #ddd6fe;
        }

        .lux-badge-reversed,
        .lux-badge-cancelled {
          background: rgba(148, 163, 184, 0.12);
          border-color: rgba(148, 163, 184, 0.25);
          color: #cbd5e1;
        }

        .lux-meta {
          display: grid;
          gap: 8px;
          font-size: 13px;
          color: var(--lux-muted);
        }

        .lux-meta-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          min-width: 0;
        }

        .lux-meta-row span {
          min-width: 0;
          word-break: break-word;
        }

        .lux-card-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 4px;
        }

        .lux-linkish {
          color: var(--lux-accent);
          font-size: 13px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .lux-empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--lux-muted);
          border: 1px dashed var(--lux-line-strong);
          border-radius: 20px;
        }

        @media (max-width: 1100px) {
          .lux-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 760px) {
          .lux-page {
            padding: 14px;
          }

          .lux-hero,
          .lux-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .lux-toolbar-left {
            width: 100%;
          }

          .lux-search {
            min-width: 0;
            max-width: none;
          }

          .lux-select {
            width: 100%;
          }

          .lux-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="lux-shell">
        <section className="lux-hero">
          <div>
            <h1 className="lux-title">SIV Workflow</h1>
            <div className="lux-subtitle">
              Search, filter, and open Stock Issue Vouchers in the correct workflow
              screen. Drafts and requested changes open in the editable draft page,
              submitted items open in approval view, and completed states open in the
              details page.
            </div>
          </div>

          <div className="lux-btn-row">
            <button type="button" className="lux-btn lux-btn-primary" onClick={openNew}>
              <Plus size={16} />
              New SIV
            </button>
          </div>
        </section>

        {error ? (
          <div className="lux-banner">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        ) : null}

        <section className="lux-card">
          <div className="lux-toolbar">
            <div className="lux-toolbar-left">
              <div className="lux-search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by number, location, department, remarks, notes, or id"
                />
              </div>

              <select
                className="lux-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as StatusKey)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="lux-btn-row">
              <button
                type="button"
                className="lux-btn lux-btn-secondary"
                onClick={() => void loadDrafts()}
                disabled={loading}
              >
                <RefreshCcw size={16} />
                Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="lux-card">
          <div className="lux-summary">
            <div>
              Showing <strong>{filtered.length}</strong> item(s)
            </div>
            <div>
              Current filter: <strong>{STATUS_OPTIONS.find(x => x.value === selectedStatus)?.label}</strong>
            </div>
          </div>
        </section>

        <section className="lux-card">
          {loading ? (
            <div className="lux-empty">Loading SIV records...</div>
          ) : filtered.length === 0 ? (
            <div className="lux-empty">No SIV records found for the current scope and filter.</div>
          ) : (
            <div className="lux-grid">
              {filtered.map((item) => (
                <div key={item.id} className="lux-draft">
                  <div className="lux-draft-head">
                    <div>
                      <h3 className="lux-draft-title">
                        {normalizeText(item.number) || "Unnumbered SIV"}
                      </h3>
                      <div className="lux-draft-sub">{item.id}</div>
                    </div>

                    <div className={getStatusBadgeClass(item.docStatus)}>
                      {prettyStatus(item.docStatus)}
                    </div>
                  </div>

                  <div className="lux-meta">
                    <div className="lux-meta-row">
                      <CalendarDays size={14} />
                      <span>{toIsoDate(item.issueDate) || "No issue date"}</span>
                    </div>

                    <div className="lux-meta-row">
                      <MapPin size={14} />
                      <span>{normalizeText(item.fromLocationName) || "Unknown location"}</span>
                    </div>

                    <div className="lux-meta-row">
                      <Building2 size={14} />
                      <span>{normalizeText(item.departmentName) || "Unknown department"}</span>
                    </div>

                    <div className="lux-meta-row">
                      <FileText size={14} />
                      <span>{normalizeText(item.remarks) || normalizeText(item.notes) || "No remarks"}</span>
                    </div>
                  </div>

                  <div className="lux-card-actions">
                    <button
                      type="button"
                      className="lux-btn lux-btn-primary"
                      onClick={() => openItem(item)}
                    >
                      <Eye size={16} />
                      View Details
                    </button>

                    <span className="lux-linkish">
                      Opens correct page
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}