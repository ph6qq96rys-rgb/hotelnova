// hooks/useStockLocations.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { stockLocationsApi } from "../api/stockLocationsApi";
import type { StockLocationDto } from "../types";

export function useStockLocations(companyId: string | null, branchId: string | null) {
  const [items, setItems] = useState<StockLocationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const requestId = useRef(0);

  const canFetch = !!companyId && !!branchId;

  const depKey = useMemo(() => {
    return `${companyId ?? ""}|${branchId ?? ""}`;
  }, [companyId, branchId]);

  const refresh = useCallback(async () => {
    if (!companyId || !branchId) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    const current = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const data = await stockLocationsApi.list(companyId, branchId);

      if (current === requestId.current) {
        setItems(data ?? []);
      }
    } catch (e) {
      if (current === requestId.current) {
        setError(e);
        setItems([]);
      }
    } finally {
      if (current === requestId.current) {
        setLoading(false);
      }
    }
  }, [depKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, error, refresh, canFetch };
}
