import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { adjustmentApi } from "../api/adjustmentApi";
import type { InventoryAdjustmentDto } from "../types";
import { normalizeAdjustmentStatus } from "../utils/adjustmentWorkflow";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function formatNumber(value?: number | null) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AdjustmentApprovalPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAppScope();

  const [item, setItem] = useState<InventoryAdjustmentDto | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = normalizeAdjustmentStatus(item?.docStatus);

  const totals = useMemo(() => {
    return (item?.lines ?? []).reduce(
      (acc, line) => {
        const adj = Number(line.adjustmentQty ?? 0);
        if (adj > 0) acc.qtyIn += adj;
        if (adj < 0) acc.qtyOut += Math.abs(adj);
        acc.amount += Number(line.unitCost ?? 0) * Number(line.adjustmentQty ?? 0);
        return acc;
      },
      { qtyIn: 0, qtyOut: 0, amount: 0 }
    );
  }, [item]);

  async function load() {
    if (!companyId || !id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await adjustmentApi.get(companyId, id);
      setItem(data);
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? "Failed to load adjustment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [companyId, id]);

  async function approve() {
    if (!companyId || !id) return;

    setWorking(true);
    setError(null);

    try {
      await adjustmentApi.approve(companyId, id);
      navigate(`/inventory/adjustments/${id}`);
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? "Approval failed.");
    } finally {
      setWorking(false);
    }
  }

  async function reject() {
    setError(
      "Reject endpoint is not currently included in adjustmentApi. Add reject() if you want rejection workflow."
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6 text-slate-500 shadow-sm">
          Loading approval page...
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6 text-slate-500 shadow-sm">
          Adjustment not found.
        </div>
      </div>
    );
  }

  const canApprove = status === "Submitted";

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Approve Adjustment
          </h1>
          <p className="text-sm text-slate-500">
            Review and approve inventory adjustment before ledger posting.
          </p>
        </div>

        <button
          className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          onClick={() => navigate(`/inventory/adjustments/${item.id}`)}
        >
          Back
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Adjustment No</div>
          <div className="mt-1 font-bold">{item.adjustmentNo}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Date</div>
          <div className="mt-1 font-bold">{formatDate(item.adjustmentDate)}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Type</div>
          <div className="mt-1 font-bold">{item.adjustmentType}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Status</div>
          <div className="mt-1 font-bold">{status}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Positive Adjustment</div>
          <div className="mt-1 text-xl font-bold">
            {formatNumber(totals.qtyIn)}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Negative Adjustment</div>
          <div className="mt-1 text-xl font-bold">
            {formatNumber(totals.qtyOut)}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Amount Impact</div>
          <div className="mt-1 text-xl font-bold">
            {formatNumber(totals.amount)}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Item</th>
              <th className="p-3 text-left">UOM</th>
              <th className="p-3 text-right">System</th>
              <th className="p-3 text-right">Counted</th>
              <th className="p-3 text-right">Difference</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-left">Notes</th>
            </tr>
          </thead>

          <tbody>
            {(item.lines ?? []).map((line, index) => (
              <tr key={line.id ?? index} className="border-t">
                <td className="p-3">{line.itemName || line.itemId}</td>
                <td className="p-3">{line.uomName || line.uomId}</td>
                <td className="p-3 text-right">
                  {formatNumber(line.systemQty)}
                </td>
                <td className="p-3 text-right">
                  {formatNumber(line.countedQty)}
                </td>
                <td className="p-3 text-right font-semibold">
                  {formatNumber(line.adjustmentQty)}
                </td>
                <td className="p-3 text-right">
                  {formatNumber(line.unitCost && line.adjustmentQty ? line.unitCost * line.adjustmentQty : 0)}
                </td>
                <td className="p-3">{line.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium">Approval Note</label>
        <textarea
          className="min-h-[90px] w-full rounded-xl border px-3 py-2 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional approval note"
        />

        <div className="mt-4 flex justify-end gap-3">
          <button
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            disabled={working}
            onClick={reject}
          >
            Reject
          </button>

          <button
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={!canApprove || working}
            onClick={approve}
          >
            Approve Adjustment
          </button>
        </div>

        {!canApprove && (
          <p className="mt-3 text-sm text-amber-700">
            Only submitted adjustments can be approved.
          </p>
        )}
      </div>
    </div>
  );
}