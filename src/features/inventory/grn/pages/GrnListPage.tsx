import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { grnApi, type GrnStatus } from "../api/grnApi";
import type { GrnListDto } from "../types/grn.types";
import "./GrnListPage.css";

type GrnStatusFilter = GrnStatus | "ALL";

type ApiError = {
  response?: {
    data?: {
      title?: string;
      detail?: string;
      message?: string;
    };
  };
  message?: string;
};

type NormalizedGrn = GrnListDto & {
  id: string;
  grnNumber?: string | null;
  supplierName?: string | null;
  receivingLocationName?: string | null;
  locationName?: string | null;
  warehouseName?: string | null;
  receivedDate?: string | Date | null;
  receivedAt?: string | Date | null;
  receiptDate?: string | Date | null;
  receivedAtUtc?: string | Date | null;
  status?: string | null;
  totalCost?: number | null;
  totalAmount?: number | null;
  grandTotal?: number | null;
  lineCount?: number | null;
  linesCount?: number | null;
  hasIssues?: boolean | null;
  hasIssuedLines?: boolean | null;
  isIssued?: boolean | null;
  issued?: boolean | null;
};

const STATUS_OPTIONS: GrnStatusFilter[] = [
  "ALL",
  "DRAFT",
  "POSTED",
  "REVERSED",
  "CANCELLED",
];

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: unknown): string {
  return toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: unknown): string {
  const raw = toText(value);
  if (!raw) return "—";

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleString();
}

function getStatus(row: NormalizedGrn): GrnStatus {
  const status = toText(row.status).toUpperCase();
  return (status || "DRAFT") as GrnStatus;
}

function isDraft(row: NormalizedGrn): boolean {
  return getStatus(row) === "DRAFT";
}

function isPosted(row: NormalizedGrn): boolean {
  return getStatus(row) === "POSTED";
}

function hasIssuedStock(row: NormalizedGrn): boolean {
  return Boolean(
    row.hasIssues ||
      row.hasIssuedLines ||
      row.isIssued ||
      row.issued
  );
}

function canReverse(row: NormalizedGrn): boolean {
  return isPosted(row) && !hasIssuedStock(row);
}

function getLocationName(row: NormalizedGrn): string {
  return toText(
    row.receivingLocationName ??
      row.locationName ??
      row.warehouseName
  );
}

function getReceiptDate(row: NormalizedGrn): unknown {
  return (
    row.receivedDate ??
    row.receivedAt ??
    row.receiptDate ??
    row.receivedAtUtc
  );
}

function getTotal(row: NormalizedGrn): number {
  return toNumber(row.totalCost ?? row.totalAmount ?? row.grandTotal);
}

function getLineCount(row: NormalizedGrn): string | number {
  return row.lineCount ?? row.linesCount ?? "—";
}

function getErrorMessage(error: unknown, fallback: string): string {
  const e = error as ApiError;

  return (
    e?.response?.data?.title ||
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    e?.message ||
    fallback
  );
}

function StatusBadge({ status }: { status: GrnStatus }) {
  return (
    <span className={`grn-status grn-status--${status.toLowerCase()}`}>
      {status}
    </span>
  );
}

export default function GrnListPage() {
  const navigate = useNavigate();
  const { companyId } = useAppScope();

  const [rows, setRows] = useState<NormalizedGrn[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<GrnStatusFilter>("ALL");

  // Permission-ready flags.
  // Replace these with your real auth/permission hook later.
  const canCreateGrn = true;
  const canViewGrn = true;
  const canReverseGrn = true;

  const load = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await grnApi.list(companyId, {
        status,
      });

      setRows((result ?? []) as NormalizedGrn[]);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load GRNs."));
    } finally {
      setLoading(false);
    }
  }, [companyId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();

    return rows.filter((row) => {
      const rowStatus = getStatus(row);

      if (status !== "ALL" && rowStatus !== status) return false;
      if (!q) return true;

      return (
        toText(row.grnNumber).toLowerCase().includes(q) ||
        toText(row.supplierName).toLowerCase().includes(q) ||
        getLocationName(row).toLowerCase().includes(q)
      );
    });
  }, [rows, search, status]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      drafts: rows.filter(isDraft).length,
      posted: rows.filter(isPosted).length,
      reversed: rows.filter((x) => getStatus(x) === "REVERSED").length,
      value: rows.reduce((sum, row) => sum + getTotal(row), 0),
    };
  }, [rows]);

  async function handleReverse(row: NormalizedGrn) {
    if (!companyId) return;

    if (!canReverseGrn) {
      setError("You do not have permission to reverse GRNs.");
      return;
    }

    if (!canReverse(row)) {
      setError("Only posted GRNs with no issued stock can be reversed.");
      return;
    }

    const id = toText(row.id);
    const grnNo = toText(row.grnNumber) || id;

    const confirmed = window.confirm(
      `Reverse posted GRN ${grnNo}? This will create reversal inventory entries.`
    );

    if (!confirmed) return;

    setBusyId(id);
    setError(null);

    try {
      await grnApi.reverseById(companyId, id, {
        reason: "",
      });

      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reverse GRN."));
    } finally {
      setBusyId(null);
    }
  }

  function openGrn(row: NormalizedGrn) {
    if (!companyId || !canViewGrn) return;

    const id = toText(row.id);
    const path = isDraft(row)
      ? `/companies/${companyId}/grns/drafts/${id}`
      : `/companies/${companyId}/grns/${id}`;

    navigate(path);
  }

  if (!companyId) {
    return (
      <main className="grn-page">
        <section className="grn-empty">
          Select a company to continue.
        </section>
      </main>
    );
  }

  return (
    <main className="grn-page">
      <header className="grn-header">
        <div>
          <h1>Goods Receipt Notes</h1>
          <p>
            Receive supplier stock, manage drafts, post to inventory, and
            reverse eligible receipts.
          </p>
        </div>

        <div className="grn-actions">
          {canReverseGrn && (
            <button
              type="button"
              className="grn-btn"
              onClick={() => navigate(`/companies/${companyId}/grns/reverse`)}
            >
              Reverse Center
            </button>
          )}

          {canCreateGrn && (
            <button
              type="button"
              className="grn-btn grn-btn--primary"
              onClick={() =>
                navigate(`/companies/${companyId}/grns/drafts/new`)
              }
            >
              + New GRN
            </button>
          )}
        </div>
      </header>

      {error && (
        <div role="alert" className="grn-alert">
          {error}
        </div>
      )}

      <section className="grn-stats">
        <article>
          <span>Total GRNs</span>
          <strong>{stats.total}</strong>
        </article>

        <article>
          <span>Drafts</span>
          <strong>{stats.drafts}</strong>
        </article>

        <article>
          <span>Posted</span>
          <strong>{stats.posted}</strong>
        </article>

        <article>
          <span>Reversed</span>
          <strong>{stats.reversed}</strong>
        </article>

        <article>
          <span>Total Value</span>
          <strong>${formatMoney(stats.value)}</strong>
        </article>
      </section>

      <section className="grn-card">
        <div className="grn-filters">
          <div className="grn-field">
            <label htmlFor="grn-search">Search</label>
            <input
              id="grn-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="GRN number, supplier, or location"
            />
          </div>

          <div className="grn-field">
            <label htmlFor="grn-status">Status</label>
            <select
              id="grn-status"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as GrnStatusFilter)
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All" : option}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="grn-btn"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </section>

      <section className="grn-card">
        <div className="grn-table-wrap">
          <table className="grn-table">
            <thead>
              <tr>
                <th>GRN #</th>
                <th>Supplier</th>
                <th>Location</th>
                <th>Receipt Date</th>
                <th>Lines</th>
                <th>Total</th>
                <th>Status</th>
                <th>Issued</th>
                <th className="grn-align-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9}>Loading GRNs…</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9}>No GRNs found.</td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const id = toText(row.id);
                  const statusValue = getStatus(row);
                  const reverseAllowed = canReverse(row);
                  const isBusy = busyId === id;

                  return (
                    <tr key={id}>
                      <td className="grn-number">
                        {toText(row.grnNumber) || "—"}
                      </td>

                      <td>{toText(row.supplierName) || "—"}</td>

                      <td>{getLocationName(row) || "—"}</td>

                      <td>{formatDate(getReceiptDate(row))}</td>

                      <td>{getLineCount(row)}</td>

                      <td>${formatMoney(getTotal(row))}</td>

                      <td>
                        <StatusBadge status={statusValue} />
                      </td>

                      <td>
                        {isPosted(row)
                          ? hasIssuedStock(row)
                            ? "Yes"
                            : "No"
                          : "—"}
                      </td>

                      <td className="grn-row-actions">
                        <button
                          type="button"
                          className="grn-btn grn-btn--sm"
                          disabled={!canViewGrn}
                          onClick={() => openGrn(row)}
                        >
                          {isDraft(row) ? "Edit" : "View"}
                        </button>

                        {isPosted(row) && canReverseGrn && (
                          <button
                            type="button"
                            className="grn-btn grn-btn--sm grn-btn--danger"
                            disabled={!reverseAllowed || isBusy}
                            title={
                              reverseAllowed
                                ? "Reverse this GRN"
                                : "Cannot reverse after stock has been issued"
                            }
                            onClick={() => void handleReverse(row)}
                          >
                            {isBusy ? "…" : "Reverse"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}