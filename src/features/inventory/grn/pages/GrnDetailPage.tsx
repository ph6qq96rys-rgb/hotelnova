// GrnDetailPage.tsx (UI/UX aligned with GrnDraftEditorPage)
// ✅ shared inventoryStyles (card/table/buttons/sticky bar)
// ✅ safer date formatting + empty states
// ✅ shows Reverse action for POSTED only (uses reverseByNumber with GRN number) — optional
//    (remove the Reverse bits if you don't want actions on detail page)

import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { grnApi } from "../api/grnApi";
import type { GrnDetailDto } from "../types/grn";

import {
  cardStyle,
  errorStyle,
  tableStyle,
  thStyle,
  tdStyle,
  secondaryBtn,
  dangerBtn,
  stickyBar,
} from "../../../../shared/inventoryStyles";

const clean = (s?: string | null) => (s ?? "").trim();
const norm = (v: unknown) => String(v ?? "").trim().toUpperCase();

function getErrorMessage(e: unknown) {
  const anyE = e as any;
  return anyE?.response?.data?.message ?? anyE?.message ?? "Failed to load GRN";
}

function fmtDateTime(v?: string | null) {
  const s = clean(v);
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

function fmtDateOnly(v?: string | null) {
  const s = clean(v);
  if (!s) return "—";
  // if ISO date, slice; else fallback to Date parse
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

/**
 * If your GrnDetailDto has a better issued indicator, use it here.
 * Otherwise, this is a conservative heuristic:
 * - if any line has batchNo (or issue-related markers), assume issuance may have happened.
 * Adjust as per your domain rules.
 */
function hasIssuedFromPostedGrn(value: GrnDetailDto): boolean {
  const anyV = value as any;
  const issueStatus = norm(anyV?.issueStatus);
  if (issueStatus === "ISSUED") return true;

  // Heuristic fallback — change/remove if wrong for your system
  return Boolean(anyV?.issued ?? anyV?.issuedAtUtc);
}

export default function GrnDetailPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();
  const { grnId } = useParams<{ grnId: string }>();

  const [value, setValue] = useState<GrnDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!companyId || !grnId) return;

    setLoading(true);
    setError(null);

    grnApi
      .getById(companyId, grnId)
      .then((v) => alive && setValue(v))
      .catch((e) => alive && setError(getErrorMessage(e)))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [companyId, grnId]);

  const status = useMemo(() => norm((value as any)?.status), [value]);
  const isPosted = status === "POSTED";
  const issued = value ? hasIssuedFromPostedGrn(value) : false;
  const canReverse = isPosted && !issued;

  async function onReverse() {
    if (!companyId || !value) return;

    setActionMsg(null);
    setActionErr(null);

    if (!canReverse) return;

    const ok = window.confirm("Reverse this posted GRN? This cannot be undone.");
    if (!ok) return;

    setBusy(true);
    try {
      // Uses your existing reverseByNumber API. Assumes backend reverses by GRN number.
      await grnApi.reverseByNumber(companyId, value.grnNumber, { reason: null });
      setActionMsg("Reversal submitted successfully.");
    } catch (e) {
      setActionErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;
  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (error) return <div style={{ padding: 16, ...errorStyle }}>{error}</div>;
  if (!value) return <div style={{ padding: 16 }}>Not found.</div>;

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header (Editor-style) */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>GRN {value.grnNumber}</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Supplier: <b>{clean(value.supplierName) || "—"}</b> • Received: <b>{fmtDateTime((value as any).receiptDate)}</b> • Status:{" "}
            <b>{clean((value as any).status) || "—"}</b>
            {isPosted ? (
              <>
                {" "}
                • Issued: <b>{issued ? "Yes" : "No"}</b>
              </>
            ) : null}
          </div>

          {actionMsg && <div style={{ marginTop: 10, fontSize: 12, color: "green" }}>{actionMsg}</div>}
          {actionErr && <div style={{ marginTop: 10, ...errorStyle }}>{actionErr}</div>}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <NavLink to={`/companies/${companyId}/grns`} style={{ textDecoration: "none" }}>
            <button style={secondaryBtn}>Back to List</button>
          </NavLink>

          {/* Optional action */}
          {isPosted ? (
            <button
              style={dangerBtn}
              disabled={!canReverse || busy}
              onClick={onReverse}
              title={!canReverse ? "Cannot reverse (already issued or not posted)" : "Reverse this posted GRN"}
            >
              {busy ? "Reversing..." : "Reverse"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Summary Card */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 4" }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Supplier</div>
            <div style={{ fontWeight: 800 }}>{clean(value.supplierName) || "—"}</div>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Receipt Date</div>
            <div style={{ fontWeight: 800 }}>{fmtDateTime((value as any).receiptDate)}</div>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Status</div>
            <div style={{ fontWeight: 800 }}>{clean((value as any).status) || "—"}</div>
          </div>

          {(value as any).notes ? (
            <div style={{ gridColumn: "span 12" }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Notes</div>
              <div style={{ fontWeight: 600, opacity: 0.9 }}>{String((value as any).notes)}</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Lines Card */}
      <div style={cardStyle}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Lines</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>Items received in this GRN.</div>
        </div>

        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>UOM</th>
                <th style={thStyle}>Unit Cost</th>
                <th style={thStyle}>Batch</th>
                <th style={thStyle}>Expiry</th>
              </tr>
            </thead>

            <tbody>
              {(value.lines ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 18, opacity: 0.75 }}>
                    No lines.
                  </td>
                </tr>
              ) : (
                value.lines.map((l: any, idx: number) => (
                  <tr key={idx}>
                    {/* You currently show itemId; if you have itemName in DTO, swap it in */}
                    <td style={{ ...tdStyle, fontWeight: 800 }}>{clean(l.itemName) || clean(l.itemCode) || clean(l.itemId) || "—"}</td>
                    <td style={tdStyle}>{Number(l.quantity ?? 0)}</td>
                    <td style={tdStyle}>{clean(l.uomName) || clean(l.uomCode) || "—"}</td>
                    <td style={tdStyle}>{Number(l.unitCost ?? 0)}</td>
                    <td style={tdStyle}>{clean(l.batchNo) || "—"}</td>
                    <td style={tdStyle}>{fmtDateOnly(l.expiryDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Bar (Editor-style) */}
      <div style={stickyBar}>
        <div style={{ opacity: 0.85 }}>
          <b>Tip:</b> Posted GRNs can be reversed only if they have not been issued.
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} onClick={() => nav(`/companies/${companyId}/grns`)}>
            Back
          </button>

          {isPosted ? (
            <button style={dangerBtn} disabled={!canReverse || busy} onClick={onReverse}>
              {busy ? "Reversing..." : "Reverse"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
