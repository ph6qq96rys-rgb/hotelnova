import { useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { grnApi } from "../api/grnApi";

export default function GrnReversePage() {
  const { companyId } = useAppScope();
  const [grnNumber, setGrnNumber] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onReverse() {
    if (!companyId) return;
    setMsg(null);

    const gn = grnNumber.trim();
    const bn = batchNo.trim();

    if (!gn && !bn) {
      setMsg("Enter GRN number or Batch number.");
      return;
    }

    setBusy(true);
    try {
      await grnApi.reverseByNumber(companyId, grnNumber, {
        reason: reason.trim() ? reason.trim() : null,
      });
      setMsg("Reversal submitted successfully.");
      setGrnNumber("");
      setBatchNo("");
      setReason("");
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? e?.message ?? "Failed to reverse GRN");
    } finally {
      setBusy(false);
    }
  }

  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Reverse GRN</h2>

      {msg && <div style={{ marginTop: 10, color: msg.includes("success") ? "green" : "crimson" }}>{msg}</div>}

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>GRN Number</div>
          <input
            value={grnNumber}
            onChange={(e) => setGrnNumber(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Batch Number</div>
          <input
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>Reason</div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>
      </div>

      <button style={{ marginTop: 12 }} disabled={busy} onClick={onReverse}>
        Reverse
      </button>
    </div>
  );
}
