import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { grnApi } from "../api/grnApi";
import type { GrnListDto } from "../types/grn";

import {
  cardStyle,
  labelStyle,
  inputStyle,
  errorStyle,
  tableStyle,
  thStyle,
  tdStyle,
  primaryBtn,
  secondaryBtn,
  dangerBtn,
  stickyBar,
} from "../../../../shared/inventoryStyles";

type StatusOption = "DRAFT" | "POSTED" | "CANCELLED" | "ALL";

type GrnRow = GrnListDto & {
  id?: string;
  grnNumber?: string | null;
  supplierName?: string | null;
  status?: string | null;
  receiptDate?: string | null;
  receivedDate?: string | null;
  receivedAtUtc?: string | null;
  issued?: boolean | null;
  hasIssue?: boolean | null;
  issuedAtUtc?: string | null;
  issueStatus?: string | null;
};

const STATUS_OPTIONS: { value: StatusOption; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "POSTED", label: "Posted" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ALL", label: "All" },
];

function clean(value?: string | null): string {
  return (value ?? "").trim();
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function getErrorMessage(error: unknown): string {
  const e = error as {
    response?: { data?: { message?: string; title?: string } };
    message?: string;
  };

  return (
    e?.response?.data?.message ??
    e?.response?.data?.title ??
    e?.message ??
    "Failed to load GRNs."
  );
}

function formatDateTime(value?: string | null): string {
  const text = clean(value);
  if (!text) return "—";

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleString();
}

function getReceivedDate(row: GrnRow): string | null {
  return row.receiptDate ?? row.receivedDate ?? row.receivedAtUtc ?? null;
}

function getGrnStatus(row: GrnRow): StatusOption | string {
  return normalize(row.status);
}

function isDraft(row: GrnRow): boolean {
  return getGrnStatus(row) === "DRAFT";
}

function isPosted(row: GrnRow): boolean {
  return getGrnStatus(row) === "POSTED";
}

function hasIssuedFromPostedGrn(row: GrnRow): boolean {
  const issueStatus = normalize(row.issueStatus);

  return Boolean(
    row.issued ||
      row.hasIssue ||
      row.issuedAtUtc ||
      issueStatus === "ISSUED"
  );
}

function canReverse(row: GrnRow): boolean {
  return isPosted(row) && !hasIssuedFromPostedGrn(row);
}

function StatusBadge({ status }: { status: string }) {
  const value = normalize(status);

  const styleByStatus: Record<string, React.CSSProperties> = {
    DRAFT: {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    },
    POSTED: {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    },
    CANCELLED: {
      background: "#fee2e2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 24,
        padding: "0 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        ...(styleByStatus[value] ?? {
          background: "#f1f5f9",
          color: "#334155",
          border: "1px solid #e2e8f0",
        }),
      }}
    >
      {status || "—"}
    </span>
  );
}

export default function GrnDraftListPage() {
  const { companyId } = useAppScope();

  const [rows, setRows] = useState<GrnRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusOption>("DRAFT");

  const [error, setError] = useState<string | null>(null);
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [reverseOk, setReverseOk] = useState<string | null>(null);
  const [reversingGrnNumber, setReversingGrnNumber] = useState<string | null>(
    null
  );

  const load = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await grnApi.list(companyId);
      setRows(Array.isArray(data) ? (data as GrnRow[]) : []);
    } catch (err) {
      setRows([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    if (status === "ALL") return rows;
    return rows.filter((row) => getGrnStatus(row) === status);
  }, [rows, status]);

  const handleReverse = async (row: GrnRow) => {
    if (!companyId) return;

    setReverseError(null);
    setReverseOk(null);

    if (!isPosted(row)) return;

    if (hasIssuedFromPostedGrn(row)) {
      setReverseError("Cannot reverse: this posted GRN has already been issued.");
      return;
    }

    const grnNumber = clean(row.grnNumber);

    if (!grnNumber) {
      setReverseError("Cannot reverse: missing GRN number.");
      return;
    }

    const confirmed = window.confirm(
      `Reverse posted GRN ${grnNumber}? This cannot be undone.`
    );

    if (!confirmed) return;

    setReversingGrnNumber(grnNumber);

    try {
      await grnApi.reverseByNumber(companyId, grnNumber, { reason: null });
      setReverseOk("GRN reversed successfully.");
      await load();
    } catch (err) {
      setReverseError(getErrorMessage(err));
    } finally {
      setReversingGrnNumber(null);
    }
  };

  if (!companyId) {
    return <div style={{ padding: 16 }}>Select a company first.</div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <PageHeader
        totalRows={rows.length}
        visibleRows={filteredRows.length}
        error={error}
        reverseError={reverseError}
        reverseOk={reverseOk}
      />

      <div style={cardStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>Status</label>
            <select
              style={inputStyle(false)}
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusOption)}
              disabled={loading}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              gridColumn: "span 8",
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <button style={secondaryBtn} onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <NavButton
              to={`/companies/${companyId}/grns/drafts/new`}
              buttonStyle={primaryBtn}
            >
              + New Draft
            </NavButton>

            <NavButton
              to={`/companies/${companyId}/grns/reverse`}
              buttonStyle={secondaryBtn}
            >
              Reverse by Number
            </NavButton>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Received</th>
                <th style={thStyle}>GRN #</th>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Issued</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <EmptyRow message="Loading…" />
              ) : filteredRows.length === 0 ? (
                <EmptyRow message="No records for the selected status." />
              ) : (
                filteredRows.map((row) => {
                  const id = String(row.id ?? "");
                  const grnNumber = clean(row.grnNumber);
                  const posted = isPosted(row);
                  const draft = isDraft(row);
                  const issued = posted && hasIssuedFromPostedGrn(row);
                  const reverseBusy = reversingGrnNumber === grnNumber;

                  return (
                    <tr key={id || grnNumber}>
                      <td style={tdStyle}>{formatDateTime(getReceivedDate(row))}</td>

                      <td style={{ ...tdStyle, fontWeight: 800 }}>
                        {grnNumber || "—"}
                      </td>

                      <td style={tdStyle}>{clean(row.supplierName) || "—"}</td>

                      <td style={tdStyle}>
                        <StatusBadge status={clean(row.status)} />
                      </td>

                      <td style={tdStyle}>
                        {posted ? (issued ? "Yes" : "No") : "—"}
                      </td>

                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            justifyContent: "flex-end",
                          }}
                        >
                          {draft ? (
                            <NavButton
                              to={`/companies/${companyId}/grns/drafts/${id}`}
                              buttonStyle={secondaryBtn}
                            >
                              Open
                            </NavButton>
                          ) : (
                            <span style={{ opacity: 0.6, fontSize: 12 }}>—</span>
                          )}

                          {posted && (
                            <button
                              style={dangerBtn}
                              disabled={!canReverse(row) || reverseBusy}
                              onClick={() => handleReverse(row)}
                              title={
                                issued
                                  ? "Cannot reverse: issued from this posted GRN"
                                  : "Reverse this posted GRN"
                              }
                            >
                              {reverseBusy ? "Reversing..." : "Reverse"}
                            </button>
                          )}
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

      <div style={stickyBar}>
        <div style={{ opacity: 0.85 }}>
          <b>Tip:</b> Open drafts to edit. Reverse posted GRNs only if not issued.
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <NavButton
            to={`/companies/${companyId}/grns/drafts`}
            buttonStyle={secondaryBtn}
          >
            Drafts
          </NavButton>

          <button style={secondaryBtn} onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <NavButton
            to={`/companies/${companyId}/grns/drafts/new`}
            buttonStyle={primaryBtn}
          >
            + New Draft
          </NavButton>
        </div>
      </div>
    </div>
  );
}

function PageHeader({
  totalRows,
  visibleRows,
  error,
  reverseError,
  reverseOk,
}: {
  totalRows: number;
  visibleRows: number;
  error: string | null;
  reverseError: string | null;
  reverseOk: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>GRN Drafts</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          Drafts can be opened. Posted GRNs can be reversed if not issued.
        </div>

        {error && <div style={{ marginTop: 10, ...errorStyle }}>{error}</div>}

        {reverseError && (
          <div style={{ marginTop: 6, ...errorStyle }}>{reverseError}</div>
        )}

        {reverseOk && (
          <div style={{ marginTop: 6, fontSize: 12, color: "green" }}>
            {reverseOk}
          </div>
        )}
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Showing</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{visibleRows}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>of {totalRows}</div>
      </div>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={6} style={{ padding: 18, opacity: 0.75 }}>
        {message}
      </td>
    </tr>
  );
}

function NavButton({
  to,
  buttonStyle,
  children,
}: {
  to: string;
  buttonStyle: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <NavLink to={to} style={{ textDecoration: "none" }}>
      <button style={buttonStyle}>{children}</button>
    </NavLink>
  );
}