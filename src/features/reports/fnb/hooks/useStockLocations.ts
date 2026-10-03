import { useEffect, useState } from "react";

import { stockLocationsApi } from "../../../../features/inventory/stock-locations/api/stockLocationsApi";

export type StockLocationOption = {
  id: string;
  name: string;
  code?: string | null;
  branchId?: string | null;
};

type RawStockLocation = {
  id?: string | null;
  stockLocationId?: string | null;
  locationId?: string | null;
  name?: string | null;
  code?: string | null;
  branchId?: string | null;
};

function getCanonicalStockLocationId(location: RawStockLocation): string {
  return (
    location.stockLocationId ||
    location.locationId ||
    location.id ||
    ""
  );
}

export function useStockLocations(
  companyId?: string | null,
  branchId?: string | null,
) {
  const [items, setItems] = useState<StockLocationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setItems([]);
    if (!companyId || !branchId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadStockLocations() {
      setLoading(true);

      try {
        const locations = await stockLocationsApi.list(
          companyId!,
          branchId || undefined,
          undefined,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        const mapped = (locations ?? [])
          .map((location: RawStockLocation) => ({
            id: getCanonicalStockLocationId(location),
            name: location.name || "Unnamed location",
            code: location.code ?? null,
            branchId: location.branchId ?? null,
          }))
          .filter((location) => location.id);

        setItems(mapped);
      } catch (error: unknown) {
        if (controller.signal.aborted) return;

        setError(error instanceof Error ? error.message : "Failed to load stock locations.");
        setItems([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadStockLocations();

    return () => {
      controller.abort();
    };
  }, [companyId, branchId]);

  return {
    items,
    loading,
    error,
  };
}
