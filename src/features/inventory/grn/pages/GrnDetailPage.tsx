// ─── GrnDetailPage ────────────────────────────────────────────────────────────
// Read-only view of a posted GRN with optional reversal action.

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";

import { useGrnDetail } from "../hooks/useGrn.hooks";
import { grnApi } from "../api/grnApi";
import {
  normalize, trim, fmtDateTime, fmtDateOnly, money, moneyInt,
  hasIssuedFromPostedGrn, extractApiError,
} from "../utils/grn.utils";
import {
  pageWrap, cardStyle, stickyBar, tableStyle, tableWrap,
  thStyle, tdStyle, secondaryBtn, dangerBtn, StatusBadge,
  StatCard, PageHeader, InlineAlert, EmptyRow, NavBtn,
  SectionHead, tokens, IssuedBadge,
} from "../components/grn.ui";

export default function GrnDetailPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();
  const { grnId } = useParams<{ grnId: string }>();

  const { value, loading, error, refresh } = useGrnDetail(grnId);

  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const status = useMemo(() => normalize((value as any)?.status), [value]);
  const isPosted = status === "POSTED";
  const issued = value ? hasIssuedFromPostedGrn(value) : false;
  const canReverse = isPosted && !issued;

  const totalCost = useMemo(
    () => (value?.lines ?? []).reduce((acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0),
    [value]
  );

  const onReverse = async () => {
    if (!companyId || !value || !canReverse) return;
    if (!window.confirm(`Reverse GRN "${value.grnNumber}"? This cannot be undone.`)) return;
    setActionMsg(null);
    setActionErr(null);
    setBusy(true);
    try {
      await grnApi.reverseById(companyId, value.grnNumber!, { reason: null });
      setActionMsg("Reversal submitted. Refreshing…");
      refresh();
    } catch (e) {
      setActionErr(extractApiError(e, "Reversal failed"));
    } finally {
      setBusy(false);
    }
  };

  if (!companyId) return <div style={{ padding: 24 }}>Select a company to continue.</div>;
  if (loading) return <div style={{ padding: 24, color: tokens.colorMuted }}>Loading GRN…</div>;
  if (error) return <div style={{ padding: 24 }}><InlineAlert type="error" message={error} /></div>;
  if (!value) return <div style={{ padding: 24 }}>GRN not found.</div>;

  const anyV = value as any;

  return (
    <div style={pageWrap}>
      {/* Header */}
      <PageHeader
        title={`GRN ${value.grnNumber || "—"}`}
        subtitle={`${trim(value.supplierName) || "No supplier"}  ·  ${fmtDateTime(anyV.receiptDate)}`}
        errorMsg={actionErr}
        successMsg={actionMsg}
        rightSlot={
          <>
            <NavBtn to={`/companies/${companyId}/grns`} style={secondaryBtn}>← All GRNs</NavBtn>
            {isPosted && (
              <button
                style={{
                  ...dangerBtn,
                  opacity: canReverse ? 1 : 0.4,
                  cursor: canReverse ? "pointer" : "not-allowed",
                }}
                disabled={!canReverse || busy}
                onClick={onReverse}
                title={!canReverse ? "Cannot reverse (already issued or not posted)" : "Reverse this GRN"}
              >
                {busy ? "Reversing…" : "Reverse GRN"}
              </button>
            )}
          </>
        }
      />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 20 }}>
        <StatCard label="Status" value={trim(anyV?.status) || "—"} />
        <StatCard label="Lines" value={value.lines?.length ?? 0} />
        <StatCard label="Total cost" value={`$${moneyInt(totalCost)}`} accent />
        <StatCard label="Issued" value={isPosted ? (issued ? "Yes" : "No") : "N/A"} />
      </div>

      {/* Header Card */}
      <div style={cardStyle}>
        <SectionHead title="Receipt information" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 16 }}>
          <Field label="GRN Number" value={value.grnNumber} bold />
          <Field label="Status" value={<StatusBadge status={trim(anyV?.status)} />} />
          <Field label="Issued" value={isPosted ? <IssuedBadge issued={issued} /> : <span style={{ color: tokens.colorHint }}>N/A</span>} />
          <Field label="Supplier" value={trim(value.supplierName)} />
          <Field label="Receipt Date" value={fmtDateTime(anyV?.receiptDate)} />
          <Field label="Location" value={trim(anyV?.locationName)} />
          {anyV?.createdAtUtc && <Field label="Created" value={fmtDateTime(anyV.createdAtUtc)} />}
          {anyV?.postedAtUtc && <Field label="Posted" value={fmtDateTime(anyV.postedAtUtc)} />}
          {anyV?.reversedAtUtc && <Field label="Reversed" value={fmtDateTime(anyV.reversedAtUtc)} />}
          {anyV?.reversedByUser && <Field label="Reversed by" value={trim(anyV.reversedByUser)} />}
          {anyV?.reverseReason && <Field label="Reversal reason" value={trim(anyV.reverseReason)} />}
          {anyV?.notes && <Field label="Notes" value={trim(anyV.notes)} span={3} />}
        </div>
      </div>

      {/* Lines Card */}
      <div style={cardStyle}>
        <SectionHead
          title="Line items"
          subtitle={`${value.lines?.length ?? 0} item${(value.lines?.length ?? 0) !== 1 ? "s" : ""} received`}
        />
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Item</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Qty</th>
                <th style={thStyle}>UOM</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Unit Cost</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Line Total</th>
                <th style={thStyle}>Batch</th>
                <th style={thStyle}>Expiry</th>
                <th style={thStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(value.lines ?? []).length === 0 ? (
                <EmptyRow message="No line items on this GRN." colSpan={9} />
              ) : (
                value.lines.map((l: any, idx: number) => {
                  const lineTotal = (Number(l.quantity) || 0) * (Number(l.unitCost) || 0);
                  return (
                    <tr key={idx}>
                      <td style={{ ...tdStyle, color: tokens.colorHint, fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        {trim(l.itemName) || trim(l.itemCode) || trim(l.itemId) || "—"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {Number(l.quantity ?? 0).toLocaleString()}
                      </td>
                      <td style={tdStyle}>{trim(l.uomName) || trim(l.uomCode) || "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        ${money(Number(l.unitCost ?? 0))}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: tokens.accent }}>
                        ${money(lineTotal)}
                      </td>
                      <td style={tdStyle}>{trim(l.batchNo) || <span style={{ color: tokens.colorHint }}>—</span>}</td>
                      <td style={tdStyle}>{fmtDateOnly(l.expiryDate)}</td>
                      <td style={{ ...tdStyle, color: tokens.colorMuted }}>{trim(l.notes) || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Grand Total */}
        {(value.lines ?? []).length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <div style={{ minWidth: 220, borderTop: `1px solid #E8EAF0`, paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: tokens.accent }}>${moneyInt(totalCost)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky */}
      <div style={stickyBar}>
        <span style={{ fontSize: 12, color: tokens.colorMuted }}>
          {isPosted && !canReverse && "This GRN has been issued and cannot be reversed."}
          {isPosted && canReverse && "This GRN can be reversed — stock will be credited back."}
          {!isPosted && `GRN is ${trim(anyV?.status) || "—"}.`}
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} onClick={() => nav(`/companies/${companyId}/grns`)}>← Back</button>
          {isPosted && (
            <button
              style={{ ...dangerBtn, opacity: canReverse ? 1 : 0.4 }}
              disabled={!canReverse || busy}
              onClick={onReverse}
            >
              {busy ? "Reversing…" : "Reverse GRN"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Field Display Helper ──────────────────────────────────────────────────────

function Field({
  label,
  value,
  bold,
  span,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  span?: number;
}) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: tokens.colorMuted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color: tokens.colorPrimary }}>
        {value || <span style={{ color: tokens.colorHint }}>—</span>}
      </div>
    </div>
  );
}