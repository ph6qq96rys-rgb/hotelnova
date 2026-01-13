import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { grnApi } from "../api/grnApi";
import type { GrnDetailDto } from "../types/grn";

export default function GrnDetailPage() {
  const { companyId } = useAppScope();
  const { grnId } = useParams<{ grnId: string }>();
  const [value, setValue] = useState<GrnDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !grnId) return;
    setLoading(true);
    setError(null);
    grnApi
      .getById(companyId, grnId)
      .then(setValue)
      .catch((e) => setError(e?.response?.data?.message ?? e?.message ?? "Failed to load GRN"))
      .finally(() => setLoading(false));
  }, [companyId, grnId]);

  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;
  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (error) return <div style={{ padding: 16, color: "crimson" }}>{error}</div>;
  if (!value) return <div style={{ padding: 16 }}>Not found.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>GRN {value.grnNumber}</h2>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        Supplier: <b>{value.supplierName}</b> • Received: <b>{new Date(value.receiptDate).toLocaleString()}</b> • Status: <b>{value.status}</b>
      </div>

      <h3 style={{ marginTop: 16 }}>Lines</h3>
      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden", marginTop: 10 }}>
        {value.lines.map((l, idx) => (
          <div key={idx} style={{ padding: 12, borderTop: "1px solid #f1f1f1" }}>
            <div style={{ fontWeight: 700 }}>{l.itemId}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {l.quantity} {l.uomName} @ {l.unitCost} • Batch: {l.batchNo ?? "-"} • Exp: {l.expiryDate ?? "-"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
