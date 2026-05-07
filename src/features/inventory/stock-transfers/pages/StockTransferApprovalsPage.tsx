import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { stockTransfersApi } from "../api/stockTransfersApi";
import  {STOCK_TRANSFER_STATUS, type StockTransferListDto } from "../types";
import { DocHeader, KpiRow, Kpi, Card, StatusPill } from "../../../../shared/ui/DocUI";

export default function StockTransferApprovalsPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();

  const [rows, setRows] = useState<StockTransferListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await stockTransfersApi.list(companyId, STOCK_TRANSFER_STATUS.Submitted);
      setRows(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load approval inbox");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const stats = useMemo(() => ({
    pending: rows.length,
    totalQty: rows.reduce((a, r) => a + (r.totalQuantity ?? 0), 0),
    totalValue: rows.reduce((a, r) => a + (r.totalValue ?? 0), 0),
  }), [rows]);

  return (
    <div className="page space-y-4">
      <DocHeader
        title="Approval Inbox"
        subtitle="Submitted transfers awaiting approval."
        right={<button className="btn btn-secondary" onClick={() => nav("/inventory/stock-transfers")}>Back</button>}
      />

      <KpiRow>
        <Kpi label="Pending" value={stats.pending} />
        <Kpi label="Total Qty" value={stats.totalQty} />
        <Kpi label="Total Value" value={stats.totalValue.toFixed(2)} />
        <Kpi label="Policy" value="HQ → Branch" />
        <Kpi label="Action" value="Approve/Reject" />
      </KpiRow>

      <Card title="Submitted Transfers" subtitle="Open a document to review and approve.">
        {loading && <div className="text-sm text-slate-500">Loading…</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="text-left p-3">Transfer</th>
                  <th className="text-left p-3">Route</th>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Qty</th>
                  <th className="text-right p-3">Value</th>
                  <th className="text-right p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{r.transferNumber}</div>
                      <div className="text-xs text-slate-500">{r.reference ?? "—"}</div>
                    </td>
                    <td className="p-3 text-sm text-slate-700">
                      {r.fromLocationName} → {r.toLocationName}
                    </td>
                    <td className="p-3 text-sm text-slate-700">
                      {new Date(r.transferDateUtc).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <StatusPill text={r.status} tone="bg-amber-100 text-amber-800" />
                    </td>
                    <td className="p-3 text-right font-semibold">{r.totalQuantity}</td>
                    <td className="p-3 text-right">{r.totalValue?.toFixed(2) ?? "—"}</td>
                    <td className="p-3 text-right">
                      <button className="btn btn-primary" onClick={() => nav(`/inventory/stock-transfers/${r.id}`)}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-sm text-slate-500">
                      Nothing pending approval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
