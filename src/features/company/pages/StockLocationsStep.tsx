import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { branchSetupApi } from "../api/branchSetupApi";
import type { StockLocation} from "../types";

/**
 * Must match your .NET enum numeric values exactly.
 * Update numbers here if your backend uses different ones.
 */
export enum StockLocationType {
  Warehouse = 1,
  Kitchen = 2,
  Bar = 3,
  Transit = 4,
  WIP = 5,
}

const locationTypeOptions = [
  { label: "Warehouse", value: StockLocationType.Warehouse },
  { label: "Kitchen", value: StockLocationType.Kitchen },
  { label: "Bar", value: StockLocationType.Bar },
  { label: "Transit", value: StockLocationType.Transit },
  { label: "WIP", value: StockLocationType.WIP },
] as const;

function requireParam(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing route param: ${name}`);
  return value;
}

function typeLabel(t: unknown): string {
  // backend may return number or string; handle both safely
  if (typeof t === "string") return t;
  if (typeof t === "number") return StockLocationType[t] ?? String(t);
  return "—";
}

export default function StockLocationsStep() {
  const params = useParams();

  const companyId = requireParam("companyId", params.companyId);
  const branchId = requireParam("branchId", params.branchId);

  const [items, setItems] = useState<StockLocation[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<StockLocationType>(StockLocationType.Warehouse);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await branchSetupApi.listStockLocations(companyId, branchId);
      setItems([...data].reverse());
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load stock locations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, branchId]);

  const canCreate = useMemo(() => name.trim().length >= 2, [name]);

  async function create() {
    if (!canCreate) return;
    setErr(null);
    try {
      await branchSetupApi.createStockLocation(companyId, branchId, {
        name: name.trim(),
        code: name.trim().toLowerCase().replace(/\s+/g, "-"), // simple code generation
        locationType: type, // ✅ sends number (enum)
      });
      setName("");
      setType(StockLocationType.Warehouse);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create stock location");
    }
  }

  async function setDefaultReceiving(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      await branchSetupApi.setDefaultReceiving(companyId, branchId, id);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to set default receiving");
    } finally {
      setBusyId(null);
    }
  }

  async function setDefaultIssue(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      await branchSetupApi.setDefaultIssue(companyId, branchId, id);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to set default issue");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">Step 1 — Stock Locations</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Create at least one <b>Default Receiving</b> location and one{" "}
        <b>Default Issue / Consume</b> location.
      </p>

      {err && (
        <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
          {err}
        </div>
      )}

      {/* Create */}
      <div className="mt-4 rounded-2xl border p-4">
        <div className="font-medium mb-3">Add Stock Location</div>

        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-6">
            <label className="text-sm">Name</label>
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg border"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Warehouse"
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className="text-sm">Type</label>
            <select
              className="mt-1 w-full px-3 py-2 rounded-lg border"
              value={type}
              onChange={(e) => setType(Number(e.target.value) as StockLocationType)}
            >
              {locationTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-2 flex items-end">
            <button
              className="w-full px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
              onClick={create}
              disabled={!canCreate}
            >
              Create
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="mt-4 rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b font-medium">
          Existing Stock Locations
        </div>

        {loading ? (
          <div className="p-4 text-sm opacity-70">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm opacity-70">No stock locations yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Defaults</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="p-3">{x.name}</td>
                  <td className="p-3">{typeLabel((x as any).type)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {x.isDefaultReceiving && (
                        <span className="px-2 py-1 rounded-full bg-green-50 border text-green-800">
                          Receiving
                        </span>
                      )}
                      {x.isDefaultIssue && (
                        <span className="px-2 py-1 rounded-full bg-blue-50 border text-blue-800">
                          Issue
                        </span>
                      )}
                      {!x.isDefaultReceiving && !x.isDefaultIssue && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        className="px-3 py-2 rounded-lg border hover:bg-accent disabled:opacity-50"
                        onClick={() => setDefaultReceiving(x.id)}
                        disabled={busyId === x.id}
                      >
                        Set Receiving
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg border hover:bg-accent disabled:opacity-50"
                        onClick={() => setDefaultIssue(x.id)}
                        disabled={busyId === x.id}
                      >
                        Set Issue
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}