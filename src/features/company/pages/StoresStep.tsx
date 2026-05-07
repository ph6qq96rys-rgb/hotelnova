import { useCallback, useEffect, useMemo, useState } from "react";
import { branchSetupApi } from "../api/branchSetupApi";
import { type StoreDto, storesApi } from "../api/storesApi";
import { stockLocationsApi } from "../api/stockLocationsApi";
import type { StockLocation } from "../types";

const storeTypes = ["DineIn", "Takeaway", "Delivery", "Bar", "Retail"] as const;
//const locationTypes = ["Warehouse", "Store", "Kitchen", "Production"] as const;
type StoreType = (typeof storeTypes)[number];

export default function StoresStep(props: {
  companyId: string;
  branchId: string;
  onChanged: () => void;
}) {
  const { companyId, branchId, onChanged } = props;

  const [stores, setStores] = useState<StoreDto[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);

  const [name, setName] = useState("");
  const [storeType, setStoreType] = useState<StoreType>("DineIn");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [busyStoreId, setBusyStoreId] = useState<string | null>(null);

  const issueCandidates = useMemo(
    () => stockLocations.filter((x) => x.isActive),
    [stockLocations]
  );

  const canCreate = useMemo(
    () => name.trim().length >= 2,
    [name]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    let cancelled = false;

    try {
     
    const storesData = await storesApi.list(companyId, branchId);
    const locationsData = await branchSetupApi.listStockLocations(companyId, branchId);
      if (!cancelled) {
        setStores(storesData);
        setStockLocations(locationsData);
      }
    } catch (e: any) {
      if (!cancelled) {
        setError(e?.message ?? "Failed to load stores");
      }
    } finally {
      if (!cancelled) setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!canCreate) return;

    setError(null);
    setCreating(true);

    try {
      await storesApi.create(companyId, branchId, {
        name: name.trim(),
      });

      setName("");

      const newStores = await storesApi.list(companyId, branchId);
      setStores(newStores.slice().reverse());

      onChanged();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create store");
    } finally {
      setCreating(false);
    }
  }

  async function mapStore(storeId: string, stockLocationId: string) {
    if (!stockLocationId) return;

    setBusyStoreId(storeId);
    setError(null);

    try {
      await stockLocationsApi.setStoreIssueLocation(
        companyId,
        branchId,
        stockLocationId
      );

      setStores((prev) =>
        prev.map((s) =>
          s.id === storeId
            ? { ...s, defaultIssueStockLocationId: stockLocationId }
            : s
        )
      );

      onChanged();
    } catch (e: any) {
      setError(e?.message ?? "Failed to map store");
    } finally {
      setBusyStoreId(null);
    }
  }

  function resolveName(list: StockLocation[], id: string) {
    return list.find((x) => x.id === id)?.name ?? id;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">
        Step 2 — Stores & Mapping
      </h2>

      <p className="text-sm text-muted-foreground mt-1">
        Create Stores (POS/Sales units) and map each Store to an{" "}
        <b>Issue/Consume Stock Location</b>.
      </p>

      {error && (
        <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Add Store */}
      <div className="mt-4 rounded-2xl border p-4">
        <div className="font-medium mb-3">Add Store</div>

        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-6">
            <label className="text-sm">Store Name</label>
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg border"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Dine-In POS"
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className="text-sm">Store Type</label>
            <select
              className="mt-1 w-full px-3 py-2 rounded-lg border"
              value={storeType}
              onChange={(e) =>
                setStoreType(e.target.value as StoreType)
              }
            >
              {storeTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-2 flex items-end">
            <button
              className="w-full px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
              onClick={create}
              disabled={!canCreate || creating}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </div>

      {/* Existing Stores */}
      <div className="mt-4 rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b font-medium">
          Existing Stores
        </div>

        {loading ? (
          <div className="p-4 text-sm opacity-70">Loading…</div>
        ) : stores.length === 0 ? (
          <div className="p-4 text-sm opacity-70">
            No stores yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Store</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">
                  Issue Stock Location
                </th>
                <th className="text-right p-3">Map</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3">{s.name}</td>
                  <td className="p-3">{s.code}</td>
                  <td className="p-3">
                    {s.branchId ? (
                      <span className="px-2 py-1 rounded-full border bg-green-50 text-green-800">
                        {resolveName(
                          stockLocations,
                          s.branchId
                        )}
                      </span>
                    ) : (
                      <span className="text-amber-700">
                        Not mapped
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <select
                      className="px-3 py-2 rounded-lg border"
                      value={s.branchId ?? ""}
                      onChange={(e) =>
                        mapStore(s.id, e.target.value)
                      }
                      disabled={
                        busyStoreId === s.id ||
                        issueCandidates.length === 0
                      }
                    >
                      <option value="" disabled>
                        Select stock location…
                      </option>
                      {issueCandidates.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} ({x.type})
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {issueCandidates.length === 0 && (
        <div className="mt-4 p-3 rounded-xl border bg-amber-50 border-amber-200 text-amber-900 text-sm">
          No active Stock Locations available. Create Stock
          Locations first.
        </div>
      )}
    </div>
  );
}