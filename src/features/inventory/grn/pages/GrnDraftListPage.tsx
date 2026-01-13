import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { grnApi } from "../api/grnApi";
import type { GrnListDto } from "../types/grn";

export default function GrnDraftListPage() {
  const { companyId } = useAppScope();
  const [rows, setRows] = useState<GrnListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    grnApi
      .list(companyId)
      .then(setRows)
      .catch((e) => setError(e?.response?.data?.message ?? e?.message ?? "Failed to load drafts"))
      .finally(() => setLoading(false));
  }, [companyId]);

  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;
  if (loading) return <div style={{ padding: 16 }}>Loading drafts…</div>;
  if (error) return <div style={{ padding: 16, color: "crimson" }}>{error}</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>GRN Drafts</h2>
        <NavLink to={`/companies/${companyId}/grns/drafts/new`}>+ New Draft</NavLink>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.7 }}>No drafts</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              style={{ padding: 12, borderTop: "1px solid #f1f1f1", display: "flex", justifyContent: "space-between" }}
            >
              <div>
                 <div style={{ fontWeight: 600 }}>{r.receivedDate}</div>
                 <div style={{ fontWeight: 600 }}>{r.grnNumber}</div>
                <div style={{ fontWeight: 600 }}>{r.supplierName}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Posting Status: {r.status}
                </div>
              </div>

              <NavLink to={`/companies/${companyId}/grns/drafts/${r.id}`}>Open</NavLink>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
