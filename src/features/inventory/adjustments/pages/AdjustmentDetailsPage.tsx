import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { adjustmentApi } from "../api/adjustmentApi";
import AdjustmentWorkflowActionBar from "../components/AdjustmentWorkflowActionBar";
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

export default function AdjustmentDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAppScope();

  const [item, setItem] = useState<InventoryAdjustmentDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = normalizeAdjustmentStatus(item?.docStatus);

  const totals = useMemo(() => {
    const lines = item?.lines ?? [];

    return lines.reduce(
      (acc, line) => {
        const qty = Number(line.adjustmentQty ?? 0);
        const amount = Number(line.unitCost ?? 0);

        if (qty > 0) acc.qtyIn += qty;
        if (qty < 0) acc.qtyOut += Math.abs(qty);

        acc.amount += amount;
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

  async function run(action: () => Promise<void>) {
    setWorking(true);
    setError(null);

    try {
      await action();
      await load();
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? "Action failed.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6 text-slate-500 shadow-sm">
          Loading adjustment...
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

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {item.adjustmentNo}
          </h1>
          <p className="text-sm text-slate-500">
            {item.adjustmentType} · {formatDate(item.adjustmentDate)}
          </p>
        </div>

        <button
          className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          onClick={() => navigate("/inventory/adjustments")}
        >
          Back
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <AdjustmentWorkflowActionBar
        status={status}
        onEdit={() => navigate(`/inventory/adjustments/${item.id}/edit`)}
        onSubmit={() =>
          run(() => adjustmentApi.submit(companyId!, item.id))
        }
        onApprove={() =>
          navigate(`/inventory/adjustments/${item.id}/approve`)
        }
        onPost={() =>
          run(() => adjustmentApi.post(companyId!, item.id))
        }
        onReverse={() => {
          const note = window.prompt("Reason for reversal?");
          if (!note) return;
          run(() => adjustmentApi.reverse(companyId!, item.id, { note }));
        }}
      />

      {working && (
        <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
          Processing...
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Status</div>
          <div className="mt-1 font-bold">{status}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Qty In</div>
          <div className="mt-1 font-bold">{formatNumber(totals.qtyIn)}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Qty Out</div>
          <div className="mt-1 font-bold">{formatNumber(totals.qtyOut)}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Amount</div>
          <div className="mt-1 font-bold">{formatNumber(totals.amount)}</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Header Information</h2>

        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <div className="text-slate-500">Branch ID</div>
            <div className="font-medium">{item.branchId}</div>
          </div>

          <div>
            <div className="text-slate-500">Location ID</div>
            <div className="font-medium">{item.locationId}</div>
          </div>

          <div>
            <div className="text-slate-500">Reason</div>
            <div className="font-medium">{item.remarks || "—"}</div>
          </div>

          <div>
            <div className="text-slate-500">Remarks</div>
            <div className="font-medium">{item.remarks || "—"}</div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Item</th>
              <th className="p-3 text-left">UOM</th>
              <th className="p-3 text-right">System Qty</th>
              <th className="p-3 text-right">Counted Qty</th>
              <th className="p-3 text-right">Adjustment</th>
              <th className="p-3 text-right">Unit Cost</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-left">Notes</th>
            </tr>
          </thead>

          <tbody>
            {(item.lines ?? []).map((line, index) => (
              <tr key={line.id ?? index} className="border-t">
                <td className="p-3">{ line.itemId}</td>
                <td className="p-3">{line.uomId}</td>
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
                  {formatNumber(line.unitCost)}
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
    </div>
  );
}