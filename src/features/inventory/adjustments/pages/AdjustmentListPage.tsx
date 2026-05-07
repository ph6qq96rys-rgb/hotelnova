import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function getErrorMessage(e: any, fallback: string) {
  const data = e?.response?.data;

  if (typeof data === "string") return data;
  if (data?.detail) return data.detail;
  if (data?.title) return data.title;
  if (data?.message) return data.message;

  return e?.message || fallback;
}

export default function AdjustmentListPage() {
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [items, setItems] = useState<InventoryAdjustmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, row) => {
        const lines = row.lines ?? [];

        acc.count += 1;
        acc.lines += lines.length;
        acc.amount += lines.reduce(
          (sum, line) => sum + Number(line.unitCost ?? 0),
          0
        );

        return acc;
      },
      { count: 0, lines: 0, amount: 0 }
    );
  }, [items]);

  async function load() {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await adjustmentApi.list(companyId, {
        branchId,
        status: status || undefined,
      });

      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(getErrorMessage(e, "Failed to load adjustments."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, branchId, status]);

function goToNewAdjustment() {
  navigate(`/inventory/adjustments/new`);
}

function openAdjustment(id: string) {
  navigate(`/inventory/adjustments/${id}`);
}

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Inventory Adjustments
          </h1>
          <p className="text-sm text-slate-500">
            Manage stock count, waste, damage, expiry, spoilage, and variance
            corrections.
          </p>
        </div>

        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!companyId}
          onClick={goToNewAdjustment}
        >
          New Adjustment
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Documents</div>
          <div className="mt-1 text-2xl font-bold">{totals.count}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Total Lines</div>
          <div className="mt-1 text-2xl font-bold">{totals.lines}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Total Amount</div>
          <div className="mt-1 text-2xl font-bold">
            {formatNumber(totals.amount)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-600">Status</label>

        <select
          className="rounded-xl border px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted</option>
          <option value="Approved">Approved</option>
          <option value="Posted">Posted</option>
          <option value="Reversed">Reversed</option>
        </select>

        <button
          className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading || !companyId}
          onClick={load}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Adjustment No</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-right">Lines</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="p-5 text-center text-slate-500" colSpan={7}>
                  Loading adjustments...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="p-5 text-center text-slate-500" colSpan={7}>
                  No adjustments found.
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const rowStatus = normalizeAdjustmentStatus(row.docStatus);

                const amount = (row.lines ?? []).reduce(
                  (sum, line) => sum + Number(line.unitCost ?? 0),
                  0
                );

                return (
                  <tr key={row.id} className="border-t hover:bg-slate-50">
                    <td className="p-3">{formatDate(row.adjustmentDate)}</td>

                    <td className="p-3 font-medium">
                      {row.adjustmentNo || "—"}
                    </td>

                    <td className="p-3">{row.adjustmentType || "—"}</td>

                    <td className="p-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                        {rowStatus}
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      {row.lines?.length ?? 0}
                    </td>

                    <td className="p-3 text-right">{formatNumber(amount)}</td>

                    <td className="p-3 text-right">
                      <button
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-white"
                        onClick={() => openAdjustment(row.id)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}