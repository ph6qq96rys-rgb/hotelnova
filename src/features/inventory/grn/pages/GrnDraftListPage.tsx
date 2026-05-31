// ─── GrnDraftListPage ─────────────────────────────────────────────────────────
// Focused draft management view. Refactored as a thin shell.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";

import { useGrnList } from "../hooks/useGrn.hooks";
import { grnApi } from "../api/grnApi";
import type { GrnListDto, GrnStatusFilter } from "../types/grn.types";
import {
  getGrnStatus, isDraft, isPosted, hasIssuedFromPostedGrn,
  canReverseGrn, getReceivedDate, fmtDateTime, trim, extractApiError, 
} from "../utils/grn.utils";
import {
  pageWrap, cardStyle, stickyBar, tableStyle, tableWrap,
  thStyle, tdStyle, labelStyle, inputStyle, primaryBtn, secondaryBtn,
  dangerBtn, StatusBadge, IssuedBadge, StatCard, PageHeader,
  EmptyRow, LoadingRows, NavBtn, SectionHead, tokens,
} from "../components/grn.ui";

const STATUS_OPTIONS: { value: GrnStatusFilter; label: string }[] = [
  { value: "DRAFT", label: "Drafts" },
  { value: "POSTED", label: "Posted" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ALL", label: "All" },
];

export default function GrnDraftListPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();
  const { rows, loading, error, refresh } = useGrnList();

  const [statusFilter, setStatusFilter] = useState<GrnStatusFilter>("DRAFT");
  const [reversingGrnNumber, setReversingGrnNumber] = useState<string | null>(null);
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [reverseOk, setReverseOk] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return rows;
    return rows.filter((r) => getGrnStatus(r) === statusFilter);
  }, [rows, statusFilter]);

  const stats = useMemo(() => ({
    drafts: rows.filter((r) => getGrnStatus(r) === "DRAFT").length,
    posted: rows.filter((r) => getGrnStatus(r) === "POSTED").length,
    reversible: rows.filter(canReverseGrn).length,
  }), [rows]);

  const handleReverse = async (row: GrnListDto) => {
    if (!companyId || !canReverseGrn(row)) return;
    const grnNumber = trim((row as any).grnNumber);
    if (!grnNumber) { setReverseError("Missing GRN number."); return; }
    if (!window.confirm(`Reverse GRN "${grnNumber}"? This cannot be undone.`)) return;

    setReverseError(null);
    setReverseOk(null);
    setReversingGrnNumber(grnNumber);
    try {
      await grnApi.reverseById(companyId, grnNumber, { reason: null });
      setReverseOk(`GRN ${grnNumber} reversed.`);
      refresh();
    } catch (e) {
      setReverseError(extractApiError(e, "Failed to reverse GRN"));
    } finally {
      setReversingGrnNumber(null);
    }
  };

  if (!companyId) return <div style={{ padding: 24 }}>Select a company to continue.</div>;

  return (
    <div style={pageWrap}>
      <PageHeader
        title="Draft GRNs"
        subtitle="Create and edit draft receipts before posting to inventory."
        errorMsg={error || reverseError}
        successMsg={reverseOk}
        rightSlot={
          <>
            <NavBtn to={`/companies/${companyId}/grns`} style={secondaryBtn}>All GRNs</NavBtn>
            <NavBtn to={`/companies/${companyId}/grns/reverse`} style={secondaryBtn}>Reverse by number</NavBtn>
            <button style={primaryBtn} onClick={() => nav(`/companies/${companyId}/grns/drafts/new`)}>
              + New Draft
            </button>
          </>
        }
      />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 20 }}>
        <StatCard label="Drafts" value={stats.drafts} />
        <StatCard label="Posted" value={stats.posted} />
        <StatCard label="Can reverse" value={stats.reversible} />
      </div>

      {/* Filter */}
      <div style={cardStyle}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 200px" }}>
            <label style={labelStyle}>Filter by status</label>
            <select
              style={inputStyle()}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as GrnStatusFilter)}
              disabled={loading}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 18 }}>
            <button style={secondaryBtn} onClick={refresh} disabled={loading}>
              {loading ? "Refreshing…" : "↺ Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={cardStyle}>
        <SectionHead
          title="GRN List"
          subtitle={`Showing ${filtered.length} of ${rows.length} records`}
        />
        <div style={tableWrap}>
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
                <LoadingRows colSpan={6} />
              ) : filtered.length === 0 ? (
                <EmptyRow message="No records for the selected status." colSpan={6} />
              ) : (
                filtered.map((row) => {
                  const anyR = row as any;
                  const id = String(anyR?.id ?? "");
                  const grnNumber = trim(anyR?.grnNumber);
                  const posted = isPosted(row);
                  const draft = isDraft(row);
                  const issued = posted && hasIssuedFromPostedGrn(row);
                  const canRev = canReverseGrn(row);
                  const busy = reversingGrnNumber === grnNumber;

                  return (
                    <tr key={id || grnNumber}>
                      <td style={{ ...tdStyle, color: tokens.colorMuted }}>
                        {fmtDateTime(getReceivedDate(row))}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: tokens.accent }}>
                        {grnNumber || <span style={{ color: tokens.colorHint }}>—</span>}
                      </td>
                      <td style={tdStyle}>{trim(row.supplierName) || <span style={{ color: tokens.colorHint }}>—</span>}</td>
                      <td style={tdStyle}><StatusBadge status={trim(anyR?.status)} /></td>
                      <td style={tdStyle}>
                        {posted ? <IssuedBadge issued={issued} /> : <span style={{ color: tokens.colorHint, fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          {draft ? (
                            <NavBtn to={`/companies/${companyId}/grns/drafts/${id}`} style={secondaryBtn}>
                              Open
                            </NavBtn>
                          ) : (
                            <NavBtn to={`/companies/${companyId}/grns/${id}`} style={secondaryBtn}>
                              View
                            </NavBtn>
                          )}
                          {posted && (
                            <button
                              style={{
                                ...dangerBtn,
                                opacity: canRev ? 1 : 0.4,
                                cursor: canRev ? "pointer" : "not-allowed",
                              }}
                              disabled={!canRev || busy}
                              onClick={() => handleReverse(row)}
                              title={issued ? "Cannot reverse: already issued" : "Reverse this posted GRN"}
                            >
                              {busy ? "…" : "Reverse"}
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

      {/* Sticky */}
      <div style={stickyBar}>
        <span style={{ fontSize: 12, color: tokens.colorMuted }}>
          <b>Tip:</b> Open drafts to edit. Reverse posted GRNs only if not yet issued.
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} onClick={refresh} disabled={loading}>↺ Refresh</button>
          <button style={primaryBtn} onClick={() => nav(`/companies/${companyId}/grns/drafts/new`)}>+ New Draft</button>
        </div>
      </div>
    </div>
  );
}