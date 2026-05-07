import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { stockTransfersApi } from "../api/stockTransfersApi";
import  { STOCK_TRANSFER_STATUS, type StockTransferDetailDto, type StockTransferStatus } from "../types";
import { DocHeader, StatusPill, KpiRow, Kpi, Card, InfoGrid, Info } from "../../../../shared/ui/DocUI";
import { useAppScope } from "../../../../app/useAppScope";

const statusTone: Record<StockTransferStatus, string> = {
  [STOCK_TRANSFER_STATUS.Draft]: "bg-slate-100 text-slate-700",
  [STOCK_TRANSFER_STATUS.Submitted]: "bg-amber-100 text-amber-800",
  [STOCK_TRANSFER_STATUS.Approved]: "bg-blue-100 text-blue-800",
  [STOCK_TRANSFER_STATUS.Rejected]: "bg-rose-100 text-rose-800",
  [STOCK_TRANSFER_STATUS.Posted]: "bg-emerald-100 text-emerald-800",
  [STOCK_TRANSFER_STATUS.Reversed]: "bg-purple-100 text-purple-800",
  [STOCK_TRANSFER_STATUS.Cancelled]: "bg-gray-100 text-gray-800",
};
export default function StockTransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
const {companyId}=useAppScope();
  const [data, setData] = useState<StockTransferDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await stockTransfersApi.get(companyId,id));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load stock transfer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canSubmit = data?.status === STOCK_TRANSFER_STATUS.Draft;
  const canApproveReject = data?.status === STOCK_TRANSFER_STATUS.Submitted;
  const canPost = data?.status === STOCK_TRANSFER_STATUS.Approved;

  const act = async (name: string, fn: () => Promise<any>) => {
    if (!id) return;
    setBusy(name);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    const reason = prompt("Rejection reason (required):");
    if (!reason || !reason.trim()) return;
    await act("reject", () => stockTransfersApi.reject(companyId,id!, reason.trim()));
  };

  return (
    <div className="page space-y-4">
      <DocHeader
        title={
          <div className="flex items-center gap-2">
            <span>Stock Transfer {data?.transferNumber ?? ""}</span>
            {data?.status && <StatusPill text={STOCK_TRANSFER_STATUS[data.status]} tone={statusTone[data.status]} />}
          </div>
        }
        subtitle="HQ → Branch inventory distribution, controlled by approval workflow."
        right={<button className="btn btn-secondary" onClick={() => nav("/inventory/stock-transfers")}>Back</button>}
      />

      {loading && <div className="card p-4 text-sm text-slate-500">Loading…</div>}
      {error && <div className="card p-4 text-sm text-rose-600">{error}</div>}

      {data && (
        <>
          <KpiRow>
            <Kpi label="Lines" value={data.items.length} />
            <Kpi label="Total Qty" value={data.totalQuantity} />
            <Kpi label="Total Value" value={data.totalValue?.toFixed(2) ?? "—"} />
            <Kpi label="From (Warehouse)" value={data.fromLocationName} />
            <Kpi label="To (Branch)" value={data.toLocationName} />
          </KpiRow>

          {data.status === STOCK_TRANSFER_STATUS.Rejected && data.rejectionReason && (
            <div className="card">
              <div className="p-4 bg-rose-50 text-rose-700 border border-rose-100 rounded-2xl">
                <div className="font-semibold">Rejected</div>
                <div className="text-sm">{data.rejectionReason}</div>
              </div>
            </div>
          )}

          <Card title="Transfer Header" subtitle="Document header and audit trail (GRN-style)">
            <InfoGrid>
              <Info label="Transfer No" value={data.transferNumber} />
              <Info label="Transfer date" value={new Date(data.transferDateUtc).toLocaleString()} />
              <Info label="Route" value={`${data.fromLocationName} → ${data.toLocationName}`} />
              <Info label="Reference" value={data.reference ?? "—"} />
            </InfoGrid>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              <Info label="Submitted by" value={data.submittedBy ?? "—"} />
              <Info label="Approved by" value={data.approvedBy ?? "—"} />
              <Info label="Posted by" value={data.postedBy ?? "—"} />
              <Info label="Status" value={data.status} />
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              <Info label="Submitted at" value={data.submittedAtUtc ? new Date(data.submittedAtUtc).toLocaleString() : "—"} />
              <Info label="Approved at" value={data.approvedAtUtc ? new Date(data.approvedAtUtc).toLocaleString() : "—"} />
              <Info label="Posted at" value={data.postedAtUtc ? new Date(data.postedAtUtc).toLocaleString() : "—"} />
              <Info label="Rejected at" value={data.rejectedAtUtc ? new Date(data.rejectedAtUtc).toLocaleString() : "—"} />
            </div>
          </Card>

          <div className="card">
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Lines</div>
                <div className="text-xs text-slate-500">Items moved from HQ warehouse to branch store.</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="text-xs text-slate-500">
                    <th className="text-left p-3">Item</th>
                    <th className="text-right p-3">Qty</th>
                    <th className="text-left p-3">UOM</th>
                    <th className="text-right p-3">Unit Cost</th>
                    <th className="text-right p-3">Line Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="p-3">
                        <div className="text-sm font-semibold text-slate-900">{l.itemName}</div>
                      {!!l.itemCode ? (
                            <div className="text-xs text-slate-500">Code: {l.itemCode}</div>
                          ) : (
                            <div className="text-xs text-slate-400"> </div>
                          )}

                      </td>
                      <td className="p-3 text-right text-sm font-semibold text-slate-900">{l.quantity}</td>
                      <td className="p-3 text-sm text-slate-700">{l.uom}</td>
                      <td className="p-3 text-right text-sm text-slate-700">
                        {l.avgUnitCost?.toFixed(2) ?? "—"}
                      </td>
                      <td className="p-3 text-right text-sm font-semibold text-slate-900">
                        {l.lineValue?.toFixed(2) ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-sm text-slate-500">No lines.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 md:p-5 border-t border-slate-100 flex items-center justify-end gap-2">
              {canSubmit && (
                <button className="btn btn-primary" disabled={!!busy} onClick={() => act("submit", () => stockTransfersApi.submit(companyId,data.id))}>
                  {busy === "submit" ? "Submitting…" : "Submit for Approval"}
                </button>
              )}

              {canApproveReject && (
                <>
                  <button className="btn btn-primary" disabled={!!busy} onClick={() => act("approve", () => stockTransfersApi.approve(companyId,data.id))}>
                    {busy === "approve" ? "Approving…" : "Approve"}
                  </button>
                  <button className="btn btn-danger" disabled={!!busy} onClick={reject}>
                    {busy === "reject" ? "Rejecting…" : "Reject"}
                  </button>
                </>
              )}

              {canPost && (
                <button className="btn btn-primary" disabled={!!busy} onClick={() => act("post", () => stockTransfersApi.post(companyId,data.id))}>
                  {busy === "post" ? "Posting…" : "Post (FIFO + Ledger)"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
