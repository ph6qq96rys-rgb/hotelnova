// ─── GrnReversePage ───────────────────────────────────────────────────────────
// Manual reversal by GRN or batch number.

import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { useGrnReverse } from "../hooks/useGrn.hooks";
import {
  pageWrap, cardStyle, stickyBar, labelStyle, inputStyle,
  secondaryBtn, dangerBtn, PageHeader, InlineAlert, SectionHead, tokens,
} from "../components/grn.ui";

export default function GrnReversePage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();
  const {
    grnNumber, setGrnNumber,
    batchNo, setBatchNo,
    reason, setReason,
    busy, message, tone, canSubmit,
    onReverse, onClear,
  } = useGrnReverse();

  if (!companyId) return <div style={{ padding: 24 }}>Select a company to continue.</div>;

  return (
    <div style={{ ...pageWrap, maxWidth: 720 }}>
      <PageHeader
        title="Reverse GRN"
        subtitle="Enter a GRN number or batch number to trigger a stock reversal."
        rightSlot={
          <button style={secondaryBtn} onClick={() => nav(`/companies/${companyId}/grns`)}>
            ← GRNs
          </button>
        }
      />

      {/* Alert */}
      {message && tone && (
        <div style={{ marginTop: 16 }}>
          <InlineAlert type={tone} message={message} />
        </div>
      )}

      {/* Form Card */}
      <div style={cardStyle}>
        <SectionHead
          title="Identify the GRN"
          subtitle="Provide at least one identifier. GRN number takes priority if both are entered."
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>GRN Number</label>
            <input
              style={inputStyle()}
              value={grnNumber}
              onChange={(e) => setGrnNumber(e.target.value)}
              placeholder="e.g. GRN-000123"
              disabled={busy}
            />
            <div style={{ marginTop: 5, fontSize: 11, color: tokens.colorHint }}>
              Used first if provided.
            </div>
          </div>

          <div>
            <label style={labelStyle}>Batch Number</label>
            <input
              style={inputStyle()}
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              placeholder="e.g. BATCH-001"
              disabled={busy}
            />
            <div style={{ marginTop: 5, fontSize: 11, color: tokens.colorHint }}>
              Fallback if no GRN number.
            </div>
          </div>
        </div>
      </div>

      {/* Reason Card */}
      <div style={cardStyle}>
        <SectionHead
          title="Reversal reason"
          subtitle="Optional — helps with audit trails."
        />
        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>Reason</label>
          <input
            style={inputStyle()}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you reversing this GRN?"
            disabled={busy}
          />
        </div>
      </div>

      {/* Warning card */}
      <div style={{
        marginTop: 16,
        padding: "14px 18px",
        background: "#FFFBEB",
        border: "1px solid #FDE68A",
        borderRadius: 8,
        fontSize: 13,
        color: "#78350F",
        fontFamily: tokens.fontFamily,
      }}>
        <b>⚠ Important:</b> Reversal will deduct the received quantities from stock. GRNs that have already been issued cannot be reversed. This action is permanent.
      </div>

      {/* Sticky */}
      <div style={stickyBar}>
        <span style={{ fontSize: 12, color: tokens.colorMuted }}>
          At least one of GRN number or batch number is required.
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} disabled={busy} onClick={onClear}>
            Clear
          </button>
          <button
            style={{
              ...dangerBtn,
              opacity: canSubmit ? 1 : 0.4,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
            disabled={busy || !canSubmit}
            onClick={onReverse}
          >
            {busy ? "Reversing…" : "Reverse GRN"}
          </button>
        </div>
      </div>
    </div>
  );
}