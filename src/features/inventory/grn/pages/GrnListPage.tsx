import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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

const clean = (s?: string | null) => (s ?? "").trim();
const norm = (v: unknown) => String(v ?? "").trim().toUpperCase();

function getErrorMessage(e: unknown) {
  const anyE = e as any;
  return anyE?.response?.data?.message ?? anyE?.message ?? "Failed to load GRNs";
}

function fmtDateTime(v?: string | null) {
  const s = clean(v);
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

/**
 * ✅ Match this to your actual DTO.
 * Right now, GrnListDto you showed does NOT include an "issued" flag,
 * so this uses common fallbacks and stays safe (defaults to "issued" = false if unknown).
 */
function hasIssuedFromPostedGrn(r: GrnListDto): boolean {
  const anyR = r as any;
  const issueStatus = norm(anyR?.issueStatus);
  return Boolean(anyR?.issued ?? anyR?.hasIssue ?? anyR?.issuedAtUtc ?? issueStatus === "ISSUED");
}

export default function GrnListPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();

  const [rows, setRows] = useState<GrnListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusOption>("ALL");
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reverseError, setReverseError] = useState<string | null>(null);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await grnApi.list(companyId);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    if (!companyId) return;

    setLoading(true);
    setError(null);

    grnApi
      .list(companyId)
      .then((data) => alive && setRows(Array.isArray(data) ? data : []))
      .catch((e) => alive && setError(getErrorMessage(e)))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [companyId]);

  const filtered = useMemo(() => {
    if (status === "ALL") return rows;
    return rows.filter((r) => norm((r as any).status) === status);
  }, [rows, status]);

  const onReverse = async (r: GrnListDto) => {
    if (!companyId) return;

    const anyR = r as any;
    const id = String(anyR?.id ?? "");
    if (!id) return;

    const posted = norm(anyR?.status) === "POSTED";
    if (!posted) return;

    const issued = hasIssuedFromPostedGrn(r);
    if (issued) return;

    const ok = window.confirm("Reverse this posted GRN? This cannot be undone.");
    if (!ok) return;

    setReverseError(null);
    setReversingId(id);

    try {
      const apiAny: any = grnApi as any;
      const fn = apiAny.reversePosted ?? apiAny.reverse ?? apiAny.reverseGrn ?? null;
      if (typeof fn !== "function") {
        throw new Error("Reverse API not implemented on grnApi (expected reversePosted/reverse/reverseGrn).");
      }

      await fn(companyId, id);
      await load();
    } catch (e) {
      setReverseError(getErrorMessage(e));
    } finally {
      setReversingId(null);
    }
  };

  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header (Editor-style) */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>GRNs</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            View posted GRNs and manage reversals. Drafts can be opened from the Drafts page.
          </div>

          {error && <div style={{ marginTop: 10, ...errorStyle }}>{error}</div>}
          {reverseError && <div style={{ marginTop: 6, ...errorStyle }}>{reverseError}</div>}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Showing</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{filtered.length}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>of {rows.length}</div>
        </div>
      </div>

      {/* Filters Card */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12, alignItems: "end" }}>
          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>Status</label>
            <select
              style={inputStyle(false)}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusOption)}
              disabled={loading}
            >
              <option value="ALL">All</option>
              <option value="DRAFT">Draft</option>
              <option value="POSTED">Posted</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div style={{ gridColumn: "span 8", display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button style={secondaryBtn} onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <NavLink to={`/companies/${companyId}/grns/drafts`} style={{ textDecoration: "none" }}>
              <button style={secondaryBtn}>Drafts</button>
            </NavLink>

            <button style={primaryBtn} onClick={() => nav(`/companies/${companyId}/grns/drafts/new`)}>
              + New Draft
            </button>
          </div>
        </div>
      </div>

      {/* List Card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>List</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>Use the status filter to narrow results.</div>
          </div>
        </div>

        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>GRN #</th>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>Receipt Date</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Issued</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 18, opacity: 0.75 }}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 18, opacity: 0.75 }}>
                    No GRNs
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const anyR = r as any;
                  const id = String(anyR?.id ?? "");
                  const statusVal = norm(anyR?.status);

                  const isDraft = statusVal === "DRAFT";
                  const isPosted = statusVal === "POSTED";
                  const issued = isPosted ? hasIssuedFromPostedGrn(r) : false;
                  const canReverse = isPosted && !issued;

                  return (
                    <tr key={id}>
                      <td style={{ ...tdStyle, fontWeight: 800 }}>{clean(anyR?.grnNumber) || "—"}</td>
                      <td style={tdStyle}>{clean(anyR?.supplierName) || "—"}</td>
                      <td style={tdStyle}>{fmtDateTime(anyR?.receiptDate)}</td>
                      <td style={tdStyle}>{clean(anyR?.status) || "—"}</td>
                      <td style={tdStyle}>{isPosted ? (issued ? "Yes" : "No") : "—"}</td>

                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                          {/* View for non-draft; Drafts are opened in draft editor page */}
                          {!isDraft ? (
                            <NavLink to={`/companies/${companyId}/grns/${id}`} style={{ textDecoration: "none" }}>
                              <button style={secondaryBtn}>View</button>
                            </NavLink>
                          ) : (
                            <span style={{ fontSize: 12, opacity: 0.6 }}>Open from Drafts</span>
                          )}

                          {/* Reverse only for posted and not issued */}
                          {isPosted ? (
                            <button
                              style={dangerBtn}
                              disabled={!canReverse || reversingId === id}
                              onClick={() => onReverse(r)}
                              title={issued ? "Cannot reverse: issued from this posted GRN" : "Reverse this posted GRN"}
                            >
                              {reversingId === id ? "Reversing..." : "Reverse"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Reverse is enabled only for <b>POSTED</b> GRNs that have <b>not</b> been issued.
        </div>
      </div>

      {/* Sticky Action Bar (Editor-style) */}
      <div style={stickyBar}>
        <div style={{ opacity: 0.85 }}>
          <b>Tip:</b> Drafts are managed in the Drafts page. Reverse only when you’re sure (and only if not issued).
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} onClick={() => nav(`/companies/${companyId}/grns/drafts`)}>Drafts</button>
          <button style={secondaryBtn} onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button style={primaryBtn} onClick={() => nav(`/companies/${companyId}/grns/drafts/new`)}>
            + New Draft
          </button>
        </div>
      </div>
    </div>
  );
}
