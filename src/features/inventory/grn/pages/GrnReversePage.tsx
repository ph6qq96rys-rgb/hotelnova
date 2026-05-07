// GrnReversePage.tsx (UI/UX aligned with GrnDraftEditorPage)
// ✅ Uses shared inventoryStyles (card/buttons/sticky bar)
// ✅ Validates: requires GRN number OR Batch number
// ✅ Passes batchNo only if your API supports it (see NOTE below)
// ✅ Clear success/error messaging

import { useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { grnApi } from "../api/grnApi";

import {
  cardStyle,
  labelStyle,
  inputStyle,
  errorStyle,
  secondaryBtn,
  dangerBtn,
  stickyBar,
} from "../../../../shared/inventoryStyles";

const clean = (s?: string | null) => (s ?? "").trim();

export default function GrnReversePage() {
  const { companyId } = useAppScope();

  const [grnNumber, setGrnNumber] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [reason, setReason] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error" | null>(null);

  async function onReverse() {
    if (!companyId) return;

    setMsg(null);
    setTone(null);

    const gn = clean(grnNumber);
    const bn = clean(batchNo);
    const rs = clean(reason);

    if (!gn && !bn) {
      setTone("error");
      setMsg("Enter GRN number or Batch number.");
      return;
    }

    setBusy(true);
    try {
      /**
       * Your current API call only accepts (companyId, grnNumber, body).
       * If you want to support batchNo, you have 2 options:
       * 1) Add an endpoint reverseByNumberOrBatch(companyId, { grnNumber, batchNo, reason })
       * 2) Add reverseByBatch(companyId, batchNo, { reason })
       *
       * For now we keep it compatible with your existing reverseByNumber call:
       * - If grnNumber is provided, use it.
       * - If only batchNo is provided, we still call reverseByNumber(companyId, batchNo, ...)
       *   BUT that will only work if backend treats it as "number or batch". If not, adjust API.
       */
      const key = gn || bn;

      await grnApi.reverseByNumber(companyId, key, {
        reason: rs ? rs : null,
        // batchNo: bn ? bn : null, // ✅ enable only if backend supports it
      });

      setTone("success");
      setMsg("Reversal submitted successfully.");
      setGrnNumber("");
      setBatchNo("");
      setReason("");
    } catch (e: any) {
      setTone("error");
      setMsg(e?.response?.data?.message ?? e?.message ?? "Failed to reverse GRN");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !!clean(grnNumber) || !!clean(batchNo);

  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      {/* Header (Editor-style) */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Reverse GRN</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Enter a <b>GRN Number</b> or a <b>Batch Number</b>, then provide an optional reason.
          </div>

          {msg && (
            <div style={{ marginTop: 10, ...(tone === "success" ? { color: "green", fontSize: 12 } : errorStyle) }}>
              {msg}
            </div>
          )}
        </div>
      </div>

      {/* Form Card */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 6" }}>
            <label style={labelStyle}>GRN Number</label>
            <input
              style={inputStyle(false)}
              value={grnNumber}
              onChange={(e) => setGrnNumber(e.target.value)}
              placeholder="e.g. GRN-000123"
              disabled={busy}
            />
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              If provided, this will be used first.
            </div>
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <label style={labelStyle}>Batch Number</label>
            <input
              style={inputStyle(false)}
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              placeholder="e.g. BATCH-001"
              disabled={busy}
            />
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              Use this if you don’t have the GRN number.
            </div>
          </div>

          <div style={{ gridColumn: "span 12" }}>
            <label style={labelStyle}>Reason (optional)</label>
            <input
              style={inputStyle(false)}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you reversing this GRN?"
              disabled={busy}
            />
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          You must enter at least one identifier: <b>GRN Number</b> or <b>Batch Number</b>.
        </div>
      </div>

      {/* Sticky Action Bar (Editor-style) */}
      <div style={stickyBar}>
        <div style={{ opacity: 0.85 }}>
          <b>Tip:</b> Reversal may be blocked if the GRN has already been issued.
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={secondaryBtn}
            disabled={busy}
            onClick={() => {
              setMsg(null);
              setTone(null);
              setGrnNumber("");
              setBatchNo("");
              setReason("");
            }}
          >
            Clear
          </button>

          <button style={dangerBtn} disabled={busy || !canSubmit} onClick={onReverse}>
            {busy ? "Reversing..." : "Reverse"}
          </button>
        </div>
      </div>
    </div>
  );
}
