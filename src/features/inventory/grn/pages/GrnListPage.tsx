// ─── GrnListPage ──────────────────────────────────────────────────────────────
// Primary GRN list view. Thin rendering shell — all state via hooks.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";

import { useGrnList } from "../hooks/useGrn.hooks";
import { grnApi } from "../api/grnApi";
import type { GrnListDto, GrnStatusFilter } from "../types/grn.types";
import {
  getGrnStatus, isDraft, isPosted, hasIssuedFromPostedGrn,
  canReverseGrn, getReceivedDate, fmtDateTime, trim, moneyInt, extractApiError,
} from "../utils/grn.utils";
import {
  pageWrap, cardStyle, stickyBar, tableStyle, tableWrap,
  thStyle, tdStyle, labelStyle, inputStyle, primaryBtn, secondaryBtn,
  dangerBtn, StatusBadge, IssuedBadge, StatCard, PageHeader,
   EmptyRow, LoadingRows, NavBtn, SectionHead, tokens,
} from "../components/grn.ui";

const STATUS_OPTIONS: { value: GrnStatusFilter; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "POSTED", label: "Posted" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REVERSED", label: "Reversed" },
];

export default function GrnListPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();
  const { rows, loading, error, refresh } = useGrnList();

  const [statusFilter, setStatusFilter] = useState<GrnStatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [reverseOk, setReverseOk] = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = rows;
    if (statusFilter !== "ALL") result = result.filter((r) => getGrnStatus(r) === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          trim((r as any).grnNumber).toLowerCase().includes(q) ||
          trim(r.supplierName).toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, statusFilter, search]);

  const stats = useMemo(() => ({
    total: rows.length,
    draft: rows.filter((r) => getGrnStatus(r) === "DRAFT").length,
    posted: rows.filter((r) => getGrnStatus(r) === "POSTED").length,
    totalValue: rows.reduce((acc, r) => acc + (Number((r as any).totalCost) || 0), 0),
  }), [rows]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const onReverse = async (r: GrnListDto) => {
    if (!companyId || !canReverseGrn(r)) return;
    const anyR = r as any;
    const id = String(anyR?.id ?? "");
    const grnNumber = trim(anyR?.grnNumber) || id;
    if (!window.confirm(`Reverse posted GRN "${grnNumber}"? This cannot be undone.`)) return;

    setReverseError(null);
    setReverseOk(null);
    setReversingId(id);
    try {
      await grnApi.reverseById(companyId, id, { reason: null });
      setReverseOk(`GRN ${grnNumber} reversed successfully.`);
      refresh();
    } catch (e) {
      setReverseError(extractApiError(e, "Failed to reverse GRN"));
    } finally {
      setReversingId(null);
    }
  };

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (!companyId) return <div style={{ padding: 24 }}>Select a company to continue.</div>;

  return (
    <div style={pageWrap}>
      {/* Page Header */}
      <PageHeader
        title="Goods Receipt Notes"
        subtitle="Manage stock receipts, drafts, and reversals across all locations."
        errorMsg={error || reverseError}
        successMsg={reverseOk}
        rightSlot={
          <>
            <NavBtn to={`/companies/${companyId}/grns/reverse`} style={secondaryBtn}>
              Reverse by number
            </NavBtn>
            <button style={primaryBtn} onClick={() => nav(`/companies/${companyId}/grns/drafts/new`)}>
              + New GRN
            </button>
          </>
        }
      />

      {/* Stat Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 20 }}>
        <StatCard label="Total GRNs" value={stats.total} />
        <StatCard label="Drafts" value={stats.draft} />
        <StatCard label="Posted" value={stats.posted} />
        <StatCard label="Total value" value={`$${moneyInt(stats.totalValue)}`} accent />
      </div>

      {/* Filters */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Search</label>
            <input
              style={inputStyle()}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="GRN number or supplier…"
              disabled={loading}
            />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
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
          <button style={secondaryBtn} onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={cardStyle}>
        <SectionHead
          title="Records"
          subtitle={`Showing ${filtered.length} of ${rows.length}`}
        />
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>GRN #</th>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>Receipt Date</th>
                <th style={thStyle}>Lines</th>
                <th style={thStyle}>Total Cost</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Issued</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRows colSpan={9} />
              ) : filtered.length === 0 ? (
                <EmptyRow message="No GRNs match the current filters." colSpan={9} />
              ) : (
                filtered.map((r) => {
                  const anyR = r as any;
                  const id = String(anyR?.id ?? "");
                  const grnNumber = trim(anyR?.grnNumber);
                  const posted = isPosted(r);
                  const draft = isDraft(r);
                  const issued = posted && hasIssuedFromPostedGrn(r);
                  const canRev = canReverseGrn(r);
                  const busy = reversingId === id;

                  return (
                    <tr key={id} style={{ cursor: "default" }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: tokens.accent }}>
                        {grnNumber || <span style={{ color: tokens.colorHint }}>—</span>}
                      </td>
                      <td style={tdStyle}>{trim(r.supplierName) || <span style={{ color: tokens.colorHint }}>—</span>}</td>
                      <td style={tdStyle}>{trim(anyR?.locationName) || <span style={{ color: tokens.colorHint }}>—</span>}</td>
                      <td style={{ ...tdStyle, color: tokens.colorMuted }}>{fmtDateTime(getReceivedDate(r))}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{anyR?.lineCount ?? "—"}</td>
                      <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>
                        {anyR?.totalCost != null ? `$${moneyInt(Number(anyR.totalCost))}` : "—"}
                      </td>
                      <td style={tdStyle}><StatusBadge status={trim((r as any).status)} /></td>
                      <td style={tdStyle}>
                        {posted ? <IssuedBadge issued={issued} /> : <span style={{ color: tokens.colorHint, fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          {draft ? (
                            <NavBtn to={`/companies/${companyId}/grns/drafts/${id}`} style={secondaryBtn}>
                              Edit
                            </NavBtn>
                          ) : (
                            <NavBtn to={`/companies/${companyId}/grns/${id}`} style={secondaryBtn}>
                              View
                            </NavBtn>
                          )}
                          {posted && (
                            <button
                              style={{ ...dangerBtn, opacity: canRev ? 1 : 0.45, cursor: canRev ? "pointer" : "not-allowed" }}
                              disabled={!canRev || busy}
                              onClick={() => onReverse(r)}
                              title={issued ? "Cannot reverse: already issued" : canRev ? "Reverse this GRN" : "Not reversible"}
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

      {/* Sticky Bar */}
      <div style={stickyBar}>
        <span style={{ fontSize: 12, color: tokens.colorMuted }}>
          <b>Tip:</b> Only posted GRNs that haven't been issued can be reversed.
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <NavBtn to={`/companies/${companyId}/grns/drafts`} style={secondaryBtn}>Drafts</NavBtn>
          <button style={secondaryBtn} onClick={refresh} disabled={loading}>↺ Refresh</button>
          <button style={primaryBtn} onClick={() => nav(`/companies/${companyId}/grns/drafts/new`)}>+ New GRN</button>
        </div>
      </div>
    </div>
  );
}